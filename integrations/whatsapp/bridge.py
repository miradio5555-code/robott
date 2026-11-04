"""Local Evolution Go adapter. No third-party Python dependencies."""
import hashlib, hmac, http.client, io, json, os, re, sqlite3, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.request import Request, urlopen
from urllib.parse import urlencode, urlsplit
from urllib.error import HTTPError
from pathlib import Path

_http_connections = threading.local()

ROOT = Path(__file__).resolve().parent
STATUS = {'new':'создан', 'awaiting_payment':'ожидает оплаты', 'purchasing':'закупается',
          'china_warehouse':'на складе в Китае', 'in_transit':'в пути', 'arrived':'прибыл',
          'delivered':'выдан клиенту', 'cancelled':'отменён'}
MENU = ('Здравствуйте! Это автоматический помощник ULA Factory.\n'
        '1 — заказ\n2 — доставка\n3 — менеджер\nСТОП — отключить автоответы и уведомления.')

def reply(text):
    t=text.strip().lower()
    if t in ('стоп','stop','отписаться'): return 'Уведомления и автоответы отключены. Для включения напишите СТАРТ.'
    if t in ('1','заказ','статус'): return 'Статус заказа доступен в личном кабинете: https://miradio5555-code.github.io/robott/ . Для уточнения напишите номер заказа в этот чат — его увидит менеджер.'
    if t in ('2','доставка'): return 'Данные о доставке указаны в карточке заказа. Для уточнения сроков напишите номер заказа и вопрос в этот чат — его увидит менеджер.'
    if t in ('3','менеджер','оператор'): return 'Напишите ваш вопрос и, если есть, номер заказа. Сообщение останется в этом чате для менеджера.'
    return MENU

def incoming(payload):
    if payload.get('event') != 'Message': return None
    d=payload.get('data') or {}; info=d.get('Info') or d
    source=info.get('MessageSource') or info
    if source.get('IsFromMe') or source.get('FromMe') or source.get('IsGroup'): return None
    chat=source.get('Chat',''); mid=info.get('ID')
    if not re.fullmatch(r'[0-9]{9,15}@s.whatsapp.net',chat) or not mid: return None
    m=d.get('Message') or {}; text=m.get('conversation') or (m.get('extendedTextMessage') or {}).get('text')
    if not isinstance(text,str):
        if m.get('imageMessage') is not None: text=(m['imageMessage'].get('caption') or '')
        else:
            media_types={'audioMessage':'Голосовое сообщение — откройте в WhatsApp','videoMessage':'Видео — откройте в WhatsApp','documentMessage':'Документ — откройте в WhatsApp','stickerMessage':'Стикер — откройте в WhatsApp'}
            text=next((label for key,label in media_types.items() if key in m),None)
            if text is None:return None
    return str(mid),chat.split('@')[0],text

class Bridge:
    def __init__(self, config):
        self.c=config
        state_dir=Path(os.environ.get('STATE_DIR',str(ROOT))) / self.c.get('STATE_SUBDIR','')
        state_dir.mkdir(parents=True,exist_ok=True)
        state_dir.chmod(0o700)
        self.db=sqlite3.connect(state_dir/'state.sqlite',check_same_thread=False)
        (state_dir/'state.sqlite').chmod(0o600)
        self.db.executescript('CREATE TABLE IF NOT EXISTS seen(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS contacts(phone TEXT PRIMARY KEY, stopped INTEGER DEFAULT 0, last_reply REAL DEFAULT 0);')
        self.db.execute('CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY, text TEXT NOT NULL)')
        from business import Business
        self.business=Business(self)
        from ai import NaturalReplies
        self.natural=NaturalReplies(self)
        self.cloud=None
        if self.c.get('INBOX_ENABLED'):
            from cloud import Cloud
            self.cloud=Cloud(self)
        self.lock=threading.RLock()
    def api(self,url,key,data=None,method=None,extra_headers=None):
        # One verified TLS connection per host and worker. Avoid a new handshake
        # for every queue poll / pairing step on high-latency connections.
        u=urlsplit(url)
        if u.scheme not in ('http','https') or not u.hostname:raise ValueError('invalid_api_url')
        headers={'Content-Type':'application/json','apikey':key}
        if u.hostname.endswith(('.supabase.co','.supabase.in')) and not key.startswith('sb_secret_'):
            headers['Authorization']='Bearer '+key
        if extra_headers:headers.update(extra_headers)
        body=json.dumps(data).encode() if data is not None else None
        verb=method or ('POST' if data is not None else 'GET')
        route=u.path or '/'
        if u.query:route+='?'+u.query
        if not hasattr(_http_connections,'pool'):_http_connections.pool={}
        pool=_http_connections.pool;host=(u.scheme,u.hostname,u.port)
        for attempt in range(2):
            conn=pool.get(host)
            if conn is None:
                cls=http.client.HTTPSConnection if u.scheme=='https' else http.client.HTTPConnection
                conn=pool[host]=cls(u.hostname,u.port,timeout=20)
            try:
                conn.request(verb,route,body=body,headers=headers)
                res=conn.getresponse();raw=res.read()
                if res.will_close:conn.close();pool.pop(host,None)
                if res.status>=400:raise HTTPError(url,res.status,res.reason,res.headers,io.BytesIO(raw))
                return json.loads(raw) if raw else None
            except HTTPError:raise
            except (OSError,http.client.HTTPException):
                conn.close();pool.pop(host,None)
                # Mutations may have reached the server: never replay them here.
                if attempt or verb not in ('GET','HEAD'):raise
        raise RuntimeError('request_failed')
    def send(self,phone,text,id):
        return self.api(self.c['EVOLUTION_URL']+'/send/text',self.c['INSTANCE_TOKEN'],{'number':phone,'text':text,'id':hashlib.sha256(id.encode()).hexdigest()[:32]})
    def handle(self,event):
        if self.cloud and event.get('event')=='Receipt':
            self.cloud.receipt(event);return
        item=incoming(event)
        if not item:
            if self.cloud:self.cloud.device_message(event)
            return
        mid,phone,text=item
        with self.lock:
            thread=self.cloud.ingest(event,phone,mid,text) if self.cloud else None
            if self.db.execute('select 1 from seen where id=?',(mid,)).fetchone(): return
            self.db.execute('insert or ignore into contacts(phone) values(?)',(phone,))
            stopped,last=self.db.execute('select stopped,last_reply from contacts where phone=?',(phone,)).fetchone()
            if thread:
                session=self.business.load(phone)
                if thread['mode']=='human':session['human']=True
                else:session.pop('human',None)
                self.business.save(phone,session)
                self.db.execute('update contacts set stopped=? where phone=?',(int(thread['opted_out']),phone))
                stopped=thread['opted_out']
            t=text.strip().lower(); stop=t in ('стоп','stop','отписаться'); start=t in ('старт','start')
            if stop or start:
                if self.cloud:self.cloud.set_thread(phone,{'opted_out':stop})
                self.db.execute('update contacts set stopped=? where phone=?',(int(stop),phone))
                self.db.commit()
            if stopped and not start:
                self.db.execute('insert into seen values(?)',(mid,));self.db.commit();return
            cached=self.db.execute('select text from responses where id=?',(mid,)).fetchone()
            if cached:
                answer=cached[0]
            else:
                msg=(event.get('data') or {}).get('Message') or {}
                media=msg if msg.get('imageMessage') is not None else None
                cfg=self.cloud.settings() if self.cloud else {}
                quote=self.cloud.quote(phone,text) if self.cloud and not stop else None
                if self.cloud and not stop and not start and not quote and (not cfg.get('enabled') or not cfg.get('bot_enabled')):
                    self.db.execute('insert into seen values(?)',(mid,));self.db.commit();return
                if any(k in msg for k in ('audioMessage','videoMessage','documentMessage','stickerMessage')):
                    session=self.business.load(phone);session['human']=True;self.business.save(phone,session)
                    answer='Вложение получено. Менеджер сможет открыть его в WhatsApp. Для возвращения к меню напишите МЕНЮ.'
                else:answer=quote or (reply(text) if stop else self.business.respond(phone,text,mid,media))
                if self.cloud and not stop:
                    human=bool(quote) or bool(self.business.load(phone).get('human'))
                    self.cloud.set_thread(phone,{'mode':'human' if human else 'bot'})
                if answer is None:
                    self.db.execute('insert into seen values(?)',(mid,));self.db.commit();return
                answer=self.natural.improve(answer)
                answer=answer.replace('ULA Factory',self.c.get('BRAND_NAME','ULA Factory'))
                self.db.execute('insert into responses values(?,?)',(mid,answer));self.db.commit()
            if self.cloud:self.cloud.queue(phone,mid,answer,stop or start)
            else:self.send(phone,answer,mid)
            self.db.execute('insert into seen values(?)',(mid,))
            self.db.execute('update contacts set last_reply=? where phone=?',(time.time(),phone));self.db.commit()
    def poll(self):
        while True:
            if self.c.get('DISABLED'):
                time.sleep(2);continue
            try:
                if self.cloud:self.cloud.tick()
                elif self.c.get('SUPABASE_SERVICE_KEY'):
                    # Legacy queue is disabled once the shared inbox is active.
                    base=self.c['SUPABASE_URL']+'/rest/v1/whatsapp_outbox'; key=self.c['SUPABASE_SERVICE_KEY']
                    rows=self.api(base+'?'+urlencode({'select':'*,orders!inner(workspace_id)','orders.workspace_id':'eq.'+self.c['WORKSPACE_ID'],'sent_at':'is.null','order':'created_at.asc','limit':'25'}),key)
                    for row in rows:
                        with self.lock:
                            phone=row['phone'].lstrip('+')
                            stopped=self.db.execute('select stopped from contacts where phone=?',(phone,)).fetchone()
                            if not (stopped and stopped[0]):self.send(phone,f"ULA Factory: заказ №{row['order_number']} — {STATUS.get(row['status'],'статус обновлён')}.\nСТОП — отключить уведомления.",row['id'])
                            self.api(base+'?'+urlencode({'id':'eq.'+row['id']}),key,{'sent_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())},'PATCH')
            except Exception as e:print('Notification retry:',type(e).__name__,flush=True)
            time.sleep(2 if self.cloud else 15)

def main():
    config=json.loads((ROOT/'config.local.json').read_text())
    if len(config.get('WEBHOOK_SECRET',''))<32: raise ValueError('Webhook secret too short')
    if config.get('MULTI_TENANT'):
        from supervisor import serve
        serve(config);return
    bridge=Bridge(config)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass  # Do not log callback URLs/secrets.
        def do_GET(self):
            self.send_response(200 if self.path=='/health' else 404);self.end_headers()
        def do_POST(self):
            if not hmac.compare_digest(self.path,'/webhook/'+config['WEBHOOK_SECRET']):
                self.send_response(403);self.end_headers();return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=8388608: raise ValueError('size')
                bridge.handle(json.loads(self.rfile.read(size)))
            except (ValueError,TypeError): self.send_response(400)
            except Exception: self.send_response(503)
            else: self.send_response(200)
            self.end_headers()
    threading.Thread(target=bridge.poll,daemon=True).start()
    HTTPServer(('0.0.0.0',8091),Handler).serve_forever()
if __name__=='__main__': main()
