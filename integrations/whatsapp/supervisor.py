"""One isolated Evolution instance and local state directory per workspace."""
import hashlib,hmac,json,re,secrets,threading,time,uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone,timedelta
from urllib.parse import urlencode
from urllib.error import HTTPError
from pathlib import Path
from bridge import Bridge

class Supervisor:
    def __init__(self,config):
        self.c=config;self.bridges={};self.connections={};self.lock=threading.RLock();self.jobs=ThreadPoolExecutor(max_workers=4);self.last_scan=0;self.last_qr={};self.last_status={};self.configured=set()
        # Transport only; no local/customer state is created for this helper.
        self.transport=object.__new__(Bridge);self.transport.c=config
    def db(self,table,params=None,data=None,method=None,prefer=None):
        route=table+('?' +urlencode(params) if params else '')
        if prefer:
            from urllib.request import Request,urlopen
            req=Request(self.c['SUPABASE_URL']+'/rest/v1/'+route,headers={'apikey':self.c['SUPABASE_SERVICE_KEY'],'Content-Type':'application/json','Prefer':prefer},data=json.dumps(data).encode(),method=method or 'POST')
            with urlopen(req,timeout=20) as r:
                raw=r.read();return json.loads(raw) if raw else None
        return self.transport.api(self.c['SUPABASE_URL']+'/rest/v1/'+route,self.c['SUPABASE_SERVICE_KEY'],data,method)
    def evo(self,route,token,data=None):return self.transport.api(self.c['EVOLUTION_URL']+route,token,data)
    def secret(self,ws):return hmac.new(self.c['WEBHOOK_SECRET'].encode(),ws.encode(),hashlib.sha256).hexdigest()
    def webhook(self,ws):return 'http://whatsapp-bridge:8091/webhook/'+self.secret(ws)+'/'+ws
    def allowed(self,path):
        parts=path.split('/')
        if len(parts)==3 and parts[1]=='webhook' and hmac.compare_digest(parts[2],self.c['WEBHOOK_SECRET']):return self.c['WORKSPACE_ID']
        if len(parts)!=4 or parts[1]!='webhook':return None
        try:ws=str(uuid.UUID(parts[3]))
        except ValueError:return None
        if not hmac.compare_digest(parts[2],self.secret(ws)):return None
        with self.lock:return ws if ws in self.connections and self.connections[ws]['active'] else None
    def settings(self,ws,fields):return self.db('wa_settings',{'workspace_id':'eq.'+ws},fields,'PATCH')
    def pairing(self,ws,fields,seq=None):
        fields={**fields,'updated_at':datetime.now(timezone.utc).isoformat()}
        params={'workspace_id':'eq.'+ws}
        if seq is not None:params['request_seq']='eq.'+str(seq)
        return self.db('wa_pairing',params,fields,'PATCH')
    def configure(self,conn):
        result=self.evo('/instance/connect',conn['api_token'],{'webhookUrl':self.webhook(conn['workspace_id']),'subscribe':['MESSAGE','READ_RECEIPT','SEND_MESSAGE','QRCODE','CONNECTION']})
        self.configured.add(conn['workspace_id']);return result
    def add_bridge(self,conn):
        ws=conn['workspace_id']
        with self.lock:
            self.connections[ws]=conn
            if ws in self.bridges:
                self.bridges[ws].c['DISABLED']=not conn['active'];return self.bridges[ws]
        # A new workspace's metadata lookup must not block existing webhooks.
        config={**self.c,'WORKSPACE_ID':ws,'INSTANCE_TOKEN':conn['api_token'],'WEBHOOK_URL':self.webhook(ws),'DISABLED':not conn['active'],'MULTI_TENANT':True}
        if ws!=self.c['WORKSPACE_ID']:config['STATE_SUBDIR']=ws
        rows=self.db('workspaces',{'id':'eq.'+ws,'select':'name,default_purchase_currency,default_client_currency,default_delivery_currency,default_delivery_tariff','limit':1})
        if not rows:raise ValueError('workspace_not_found')
        config['BRAND_NAME']=rows[0]['name'][:120]
        config['ORDER_DEFAULTS']={k.replace('default_',''):v for k,v in rows[0].items() if k.startswith('default_') and v is not None}
        with self.lock:
            if ws in self.bridges:
                self.bridges[ws].c['DISABLED']=not conn['active'];return self.bridges[ws]
            b=Bridge(config);self.bridges[ws]=b
            threading.Thread(target=b.poll,daemon=True).start();return b
    def ensure_connection(self,ws):
        rows=self.db('wa_connections',{'workspace_id':'eq.'+ws,'select':'*','limit':1})
        if rows:conn=rows[0]
        else:
            conn={'workspace_id':ws,'instance_id':str(uuid.uuid5(uuid.NAMESPACE_URL,'ula-whatsapp-instance:'+ws)),'instance_name':'ula-'+ws.replace('-',''),'api_token':secrets.token_hex(32),'active':True}
            self.db('wa_connections',{'on_conflict':'workspace_id'},conn,prefer='resolution=ignore-duplicates')
            conn=self.db('wa_connections',{'workspace_id':'eq.'+ws,'select':'*','limit':1})[0]
        # Fetch only this workspace's deterministic instance; never enumerate other tokens.
        try:existing=self.evo('/instance/info/'+conn['instance_id'],self.c['EVOLUTION_ADMIN_KEY']).get('data')
        except HTTPError as e:
            if e.code==404:existing=None
            elif e.code==500:
                try:detail=json.loads(e.read()).get('error','')
                except (ValueError,AttributeError):raise
                if detail not in ('record not found','instance not found'):raise
                existing=None
            else:raise
        if existing and existing.get('token')!=conn['api_token']:raise ValueError('instance_mismatch')
        if not existing:
            self.evo('/instance/create',self.c['EVOLUTION_ADMIN_KEY'],{'instanceId':conn['instance_id'],'name':conn['instance_name'],'token':conn['api_token']})
        if not conn['active']:
            self.db('wa_connections',{'workspace_id':'eq.'+ws},{'active':True},'PATCH');conn['active']=True
        self.add_bridge(conn);return conn
    def finish(self,job,state,error=None):
        fields={'error_code':error,'handled_seq':job['processing_seq'],'lease_until':None}
        if state in ('connected','error','disconnected'):fields.update(pairing_code=None,code_expires_at=None,phone=None)
        if state=='starting':
            # QR/Connected events can arrive before configure() returns. Do not overwrite them.
            self.db('wa_pairing',{'workspace_id':'eq.'+job['workspace_id'],'request_seq':'eq.'+str(job['processing_seq']),'state':'in.(queued,starting)'},{**fields,'state':state,'updated_at':datetime.now(timezone.utc).isoformat()},'PATCH')
        else:self.pairing(job['workspace_id'],{**fields,'state':state},job['processing_seq'])
    def process(self,job):
        ws=job['workspace_id'];seq=job['processing_seq']
        try:
            # A later owner action supersedes an older queued action.
            current=self.db('wa_pairing',{'workspace_id':'eq.'+ws,'select':'request_seq','limit':1})
            if not current or current[0]['request_seq']!=seq:return
            if job['action']=='disconnect':
                rows=self.db('wa_connections',{'workspace_id':'eq.'+ws,'select':'*','limit':1})
                if rows:
                    conn=rows[0]
                    self.settings(ws,{'enabled':False,'connection_ok':False})
                    self.db('wa_connections',{'workspace_id':'eq.'+ws},{'active':False},'PATCH');conn['active']=False;self.add_bridge(conn)
                    try:self.evo('/instance/disconnect',conn['api_token'],{})
                    except HTTPError as e:
                        # An already disconnected runtime is also disabled locally and in the DB.
                        if e.code!=500:raise
                self.pairing(ws,{'qr':None,'qr_expires_at':None,'pairing_code':None,'code_expires_at':None,'phone':None},seq);self.finish(job,'disconnected');return
            conn=self.ensure_connection(ws)
            wsrow=self.db('workspaces',{'id':'eq.'+ws,'select':'name','limit':1})[0]
            self.db('wa_settings',{'on_conflict':'workspace_id'},{'workspace_id':ws,'enabled':True,'status_template':wsrow['name']+' · №{order}: {status}'},prefer='resolution=ignore-duplicates')
            self.settings(ws,{'enabled':True})
            if job['action']=='refresh':
                try:self.evo('/instance/reconnect',conn['api_token'],{})
                except HTTPError as e:
                    if e.code!=500:raise
            self.configure(conn)
            if job['action']=='phone':
                phone=job.get('phone') or ''
                if not re.fullmatch(r'[1-9][0-9]{8,14}',phone):raise ValueError('invalid_phone')
                status=self.evo('/instance/status',conn['api_token']).get('data') or {}
                if status.get('Connected') and status.get('LoggedIn'):
                    self.finish(job,'connected');return
                result=self.evo('/instance/pair',conn['api_token'],{'phone':phone}).get('data') or {}
                code=result.get('PairingCode') or ''
                if not re.fullmatch(r'[A-Z0-9]{4}-?[A-Z0-9]{4}',code):raise ValueError('invalid_pairing_code')
                # A Connected event may have arrived while the provider request completed.
                self.db('wa_pairing',{'workspace_id':'eq.'+ws,'request_seq':'eq.'+str(seq),'state':'in.(queued,starting)'},{'state':'code','pairing_code':code,'code_expires_at':(datetime.now(timezone.utc)+timedelta(seconds=120)).isoformat(),'phone':None,'updated_at':datetime.now(timezone.utc).isoformat()},'PATCH')
            self.last_status[ws]=time.time()
            self.finish(job,'starting');self.last_qr[ws]=0
        except Exception as e:
            code='license_or_instance_limit' if isinstance(e,HTTPError) and e.code in (402,403,503) else 'connection_failed'
            self.finish(job,'error',code)
        finally:
            try:self.db('wa_pairing',{'workspace_id':'eq.'+ws,'processing_seq':'eq.'+str(seq)},{'lease_until':None,'handled_seq':seq},'PATCH')
            except Exception:pass
    def poll_pairing(self,conn):
        ws=conn['workspace_id'];now=time.time()
        rows=self.db('wa_pairing',{'workspace_id':'eq.'+ws,'select':'state,method,code_expires_at,request_seq,handled_seq,requested_at','limit':1})
        if not rows:return
        p=rows[0]
        with self.lock:
            if ws in self.bridges:self.bridges[ws].c['PAIRING_READY']=p['state']=='connected'
        if p['state']=='connected' and ws not in self.configured:self.configure(conn)
        if p['request_seq']!=p['handled_seq'] or p['state'] in ('queued','disconnecting','disconnected','error'):return
        if now-self.last_status.get(ws,0)<5:return
        self.last_status[ws]=now
        s=self.evo('/instance/status',conn['api_token']).get('data') or {}
        if s.get('Connected') and s.get('LoggedIn'):
            with self.lock:
                if ws in self.bridges:self.bridges[ws].c['PAIRING_READY']=True
            if p['state']!='connected':self.pairing(ws,{'state':'connected','qr':None,'qr_expires_at':None,'pairing_code':None,'code_expires_at':None,'phone':None,'error_code':None},p['request_seq'])
            return
        # Connected records may be temporarily offline; don't silently issue a new pairing.
        if p['state']=='connected':return
        if p.get('requested_at') and datetime.now(timezone.utc)-datetime.fromisoformat(p['requested_at'])>timedelta(minutes=3):
            self.pairing(ws,{'state':'error','error_code':'qr_expired','qr':None,'qr_expires_at':None,'pairing_code':None,'code_expires_at':None,'phone':None},p['request_seq']);return
        if p.get('method')=='phone':
            if p.get('code_expires_at') and datetime.now(timezone.utc)>=datetime.fromisoformat(p['code_expires_at']):
                self.pairing(ws,{'state':'error','error_code':'code_expired','pairing_code':None,'code_expires_at':None,'phone':None},p['request_seq'])
            return
        if now-self.last_qr.get(ws,0)<10:return
        self.last_qr[ws]=now
        info=self.evo('/instance/info/'+conn['instance_id'],self.c['EVOLUTION_ADMIN_KEY']).get('data') or {}
        qr=(info.get('qrcode') or '').split('|')[0]
        if not qr.startswith('data:image/png;base64,') or len(qr)>30000:return
        self.pairing(ws,{'state':'qr','qr':qr,'qr_expires_at':(datetime.now(timezone.utc)+timedelta(seconds=20)).isoformat(),'error_code':None},p['request_seq'])
    def run(self):
        while True:
            try:
                jobs=self.db('rpc/wa_pairing_claim',data={}) or []
                for job in jobs:self.jobs.submit(self.process,job)
                if time.time()-self.last_scan>=10:
                    rows=self.db('wa_connections',{'select':'*'}) or []
                    for conn in rows:
                        self.add_bridge(conn)
                        if conn['active']:
                            try:self.poll_pairing(conn)
                            except Exception:pass
                    self.last_scan=time.time()
            except Exception as e:print('Pairing retry:',type(e).__name__,flush=True)
            time.sleep(2)
    def pairing_event(self,ws,event):
        kind=event.get('event');data=event.get('data') or {}
        if not isinstance(data,dict):return kind in ('QRCode','Connected','PairSuccess')
        if kind not in ('QRCode','Connected','PairSuccess'):return False
        if kind!='QRCode' and data.get('status')!='open':return True
        rows=self.db('wa_pairing',{'workspace_id':'eq.'+ws,'select':'state,method,request_seq,requested_at','limit':1})
        if not rows or rows[0]['state'] in ('disconnected','disconnecting'):return True
        p=rows[0]
        if kind=='QRCode':
            if p['state'] in ('connected','error') or p.get('method')=='phone':return True
            qr=(data.get('qrcode') or '').split('|')[0]
            if not qr.startswith('data:image/png;base64,') or len(qr)>30000:return True
            self.pairing(ws,{'state':'qr','qr':qr,'qr_expires_at':(datetime.now(timezone.utc)+timedelta(seconds=20)).isoformat(),'error_code':None},p['request_seq'])
        else:
            self.pairing(ws,{'state':'connected','qr':None,'qr_expires_at':None,'pairing_code':None,'code_expires_at':None,'phone':None,'error_code':None},p['request_seq'])
            self.settings(ws,{'connection_ok':True,'last_heartbeat':datetime.now(timezone.utc).isoformat()})
            with self.lock:
                if ws in self.bridges:self.bridges[ws].c['PAIRING_READY']=True
        return True
    def handle(self,ws,event):
        with self.lock:b=self.bridges.get(ws)
        if not b or b.c.get('DISABLED'):raise ValueError('inactive_workspace')
        if self.pairing_event(ws,event):return
        # Ignore any workspace/instance identifiers contained in the untrusted payload.
        b.handle(event)

def serve(config):
    from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
    supervisor=Supervisor(config)
    threading.Thread(target=supervisor.run,daemon=True).start()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):self.send_response(200 if self.path=='/health' else 404);self.end_headers()
        def do_POST(self):
            ws=supervisor.allowed(self.path)
            if not ws:self.send_response(403);self.end_headers();return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=8388608:raise ValueError('size')
                supervisor.handle(ws,json.loads(self.rfile.read(size)))
            except (ValueError,TypeError):self.send_response(400)
            except Exception:self.send_response(503)
            else:self.send_response(200)
            self.end_headers()
    ThreadingHTTPServer(('0.0.0.0',8091),Handler).serve_forever()
