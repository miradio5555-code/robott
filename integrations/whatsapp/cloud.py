"""Supabase inbox adapter. Only server credentials cross this boundary."""
import base64,hashlib,json,re,time
from datetime import datetime,timezone,timedelta
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from urllib.error import HTTPError

class Cloud:
    def __init__(self,bridge):self.b=bridge;self.c=bridge.c;self.ws=self.c['WORKSPACE_ID'];self.last_heartbeat=0;self.last_reconnect=0;self.connection_ok=False
    def call(self,route,data=None,method=None):
        return self.b.api(self.c['SUPABASE_URL']+'/rest/v1/'+route,self.c['SUPABASE_SERVICE_KEY'],data,method)
    def query(self,table,params):return self.call(table+'?'+urlencode(params))
    def patch(self,table,params,data):return self.call(table+'?'+urlencode(params),data,'PATCH')
    def settings(self):
        rows=self.query('wa_settings',{'workspace_id':'eq.'+self.ws,'select':'*'})
        return rows[0] if rows else {}
    def thread(self,phone):
        rows=self.query('wa_threads',{'workspace_id':'eq.'+self.ws,'phone':'eq.'+phone,'select':'*','limit':1})
        return rows[0] if rows else None
    def set_thread(self,phone,data):return self.patch('wa_threads',{'workspace_id':'eq.'+self.ws,'phone':'eq.'+phone},data)
    def link(self,phone,order_id):
        t=self.thread(phone)
        if t:self.call('rpc/wa_link_order',{'p_workspace':self.ws,'p_thread':t['id'],'p_order':order_id})
    @staticmethod
    def redact(text):
        text=re.sub(r'https://miradio5555-code\.github\.io/robott/\?[^\s]*\bc=[a-f0-9]{32}[^\s]*','[Личная ссылка клиента скрыта]',text)
        return text[:4000]
    def ingest(self,event,phone,mid,text,direction='in'):
        msg=(event.get('data') or {}).get('Message') or {}
        t=self.call('rpc/wa_ingest',{'p_workspace':self.ws,'p_phone':phone,'p_provider':mid,'p_body':self.redact(text) or ('Фото' if msg.get('imageMessage') else ''),'p_direction':direction,'p_kind':'photo' if msg.get('imageMessage') else 'text'})
        if msg.get('imageMessage') and msg.get('base64'):
            raw=base64.b64decode(msg['base64'],validate=True)
            if len(raw)<=5*1024*1024:
                kind='jpeg' if raw.startswith(b'\xff\xd8\xff') else 'png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else None
                if kind:
                    path=self.ws+'/'+t['id']+'/'+hashlib.sha256(mid.encode()).hexdigest()+'.'+kind
                    req=Request(self.c['SUPABASE_URL']+'/storage/v1/object/wa-attachments/'+path,data=raw,headers={'apikey':self.c['SUPABASE_SERVICE_KEY'],'Content-Type':'image/'+kind,'x-upsert':'true'},method='POST')
                    with urlopen(req,timeout=25):pass
                    self.patch('wa_messages',{'workspace_id':'eq.'+self.ws,'direction':'eq.'+direction,'provider_id':'eq.'+mid},{'media_path':path})
        info=(event.get('data') or {}).get('Info') or {}
        name=info.get('PushName')
        if isinstance(name,str) and name.strip() and not t.get('display_name'):self.set_thread(phone,{'display_name':name.strip()[:120]})
        return t
    def receipt(self,event):
        d=event.get('data') or {};kind=str(d.get('Type','')).lower();state='read' if kind in ('read','read-self') else 'delivered' if kind in ('','delivered','delivery') else None
        if not state:return
        for mid in (d.get('MessageIDs') or [])[:100]:
            params={'workspace_id':'eq.'+self.ws,'direction':'eq.out','provider_id':'eq.'+str(mid),'state':'in.(sending,sent,delivered)' if state=='read' else 'in.(sending,sent)'}
            self.patch('wa_messages',params,{'state':state,'sent_at':datetime.now(timezone.utc).isoformat()})
    def quote(self,phone,text):
        m=re.fullmatch(r'(ДА|НЕТ|YES|NO)\s+([A-F0-9]{10})',text.strip().upper())
        if not m:return None
        state=self.call('rpc/wa_decide_quote',{'p_workspace':self.ws,'p_phone':phone,'p_code':m[2],'p_accept':m[1] in ('ДА','YES')})
        return {'accepted':'Расчёт подтверждён. Менеджер увидит ваш ответ. Оплата ещё не подтверждена.','declined':'Расчёт отклонён. Менеджер уточнит детали.','expired':'Этот расчёт устарел. Попросите менеджера прислать новый.','not_found':'Расчёт не найден для вашего номера. Проверьте код из сообщения.'}.get(state,'Расчёт уже обработан.')
    def queue(self,phone,mid,text,control=False):
        return self.call('rpc/wa_queue_reply',{'p_workspace':self.ws,'p_phone':phone,'p_incoming':mid,'p_body':self.redact(text),'p_control':control})
    def device_message(self,event):
        d=event.get('data') or {};info=d.get('Info') or {};source=info.get('MessageSource') or info
        if not source.get('IsFromMe'):return
        chat=source.get('Chat','');mid=info.get('ID');msg=d.get('Message') or {};text=msg.get('conversation') or (msg.get('extendedTextMessage') or {}).get('text') or ''
        if not re.fullmatch(r'[0-9]{9,15}@s.whatsapp.net',chat) or not mid:return
        found=self.query('wa_messages',{'workspace_id':'eq.'+self.ws,'direction':'eq.out','provider_id':'eq.'+mid,'select':'id','limit':1})
        if found:return
        phone=chat.split('@')[0];self.ingest(event,phone,mid,text,'out');self.set_thread(phone,{'mode':'human'})
    def tick(self):
        now=time.time()
        if now-self.last_heartbeat>=30:
            connected=False
            try:
                r=self.b.api(self.c['EVOLUTION_URL']+'/instance/status',self.c['INSTANCE_TOKEN']);connected=bool((r.get('data') or {}).get('Connected') and (r.get('data') or {}).get('LoggedIn'))
            except Exception:pass
            self.connection_ok=connected
            self.patch('wa_settings',{'workspace_id':'eq.'+self.ws},{'last_heartbeat':datetime.now(timezone.utc).isoformat(),'connection_ok':connected})
            self.last_heartbeat=now
        if not self.connection_ok:
            if self.c.get('MULTI_TENANT') and not self.c.get('PAIRING_READY'):return
            if now-self.last_reconnect>=60:
                self.last_reconnect=now
                try:self.b.api(self.c['EVOLUTION_URL']+'/instance/reconnect',self.c['INSTANCE_TOKEN'],{})
                except Exception:
                    # The engine may have no runtime client after a failed initial dial.
                    try:self.b.api(self.c['EVOLUTION_URL']+'/instance/connect',self.c['INSTANCE_TOKEN'],{'webhookUrl':self.c.get('WEBHOOK_URL') or 'http://whatsapp-bridge:8091/webhook/'+self.c['WEBHOOK_SECRET'],'subscribe':['MESSAGE','READ_RECEIPT','SEND_MESSAGE','QRCODE','CONNECTION']})
                    except Exception:pass
            return
        rows=self.call('rpc/wa_claim',{'p_workspace':self.ws}) or []
        for m in rows:
            t=self.thread_by_id(m['thread_id'])
            if not t or (t['opted_out'] and m['kind']!='control'):
                self.patch('wa_messages',{'id':'eq.'+m['id'],'workspace_id':'eq.'+self.ws},{'state':'cancelled','lease_until':None});continue
            # Set provider ID before send: echoed events cannot pause the bot.
            provider=hashlib.sha256(m['id'].encode()).hexdigest()[:32]
            try:
                self.patch('wa_messages',{'id':'eq.'+m['id'],'workspace_id':'eq.'+self.ws},{'provider_id':provider})
                self.b.send(t['phone'],m['body'],m['id'])
                # Do not downgrade a receipt which arrived during the send call.
                self.patch('wa_messages',{'id':'eq.'+m['id'],'workspace_id':'eq.'+self.ws,'state':'eq.sending'},{'state':'sent','sent_at':datetime.now(timezone.utc).isoformat(),'error':None,'lease_until':None})
            except Exception as e:
                retry=m['attempts']<5
                self.patch('wa_messages',{'id':'eq.'+m['id'],'workspace_id':'eq.'+self.ws,'state':'eq.sending'},{'state':'queued' if retry else 'failed','next_attempt_at':(datetime.now(timezone.utc)+timedelta(seconds=min(300,15*2**m['attempts']))).isoformat(),'lease_until':None,'error':('HTTP '+str(e.code)) if isinstance(e,HTTPError) else type(e).__name__})
        # A process killed after its final claim cannot leave a message stuck forever.
        self.patch('wa_messages',{'workspace_id':'eq.'+self.ws,'state':'eq.sending','attempts':'gte.5','lease_until':'lt.'+datetime.now(timezone.utc).isoformat()},{'state':'failed','error':'lease_expired','lease_until':None})
    def thread_by_id(self,id):
        rows=self.query('wa_threads',{'id':'eq.'+id,'workspace_id':'eq.'+self.ws,'select':'*','limit':1});return rows[0] if rows else None
