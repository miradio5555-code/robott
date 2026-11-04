import unittest
from supervisor import Supervisor
class PairingTests(unittest.TestCase):
 def setUp(self):
  self.default='11111111-1111-1111-1111-111111111111';self.other='22222222-2222-2222-2222-222222222222'
  self.s=Supervisor({'WORKSPACE_ID':self.default,'WEBHOOK_SECRET':'s'*40,'SUPABASE_URL':'https://test.supabase.co','SUPABASE_SERVICE_KEY':'key','EVOLUTION_URL':'http://evo','EVOLUTION_ADMIN_KEY':'admin'})
  self.s.connections={self.default:{'active':True},self.other:{'active':True}}
 def tearDown(self):self.s.jobs.shutdown(wait=True)
 def test_signed_webhook_is_workspace_specific(self):
  self.assertEqual(self.s.allowed('/webhook/'+self.s.secret(self.default)+'/'+self.default),self.default)
  self.assertIsNone(self.s.allowed('/webhook/'+self.s.secret(self.default)+'/'+self.other))
 def test_inactive_workspace_rejected(self):
  self.s.connections[self.other]['active']=False
  self.assertIsNone(self.s.allowed('/webhook/'+self.s.secret(self.other)+'/'+self.other))
 def test_unknown_workspace_rejected_even_with_valid_format(self):
  w='33333333-3333-3333-3333-333333333333'
  self.assertIsNone(self.s.allowed('/webhook/'+self.s.secret(w)+'/'+w))
 def test_legacy_webhook_only_routes_default_workspace(self):
  self.assertEqual(self.s.allowed('/webhook/'+'s'*40),self.default)
 def test_payload_workspace_cannot_override_route(self):
  class B:
   c={}
   def handle(self,event):self.last=event
  a=B();b=B();self.s.bridges={self.default:a,self.other:b}
  self.s.handle(self.default,{'workspace_id':self.other})
  self.assertTrue(hasattr(a,'last'));self.assertFalse(hasattr(b,'last'))
 def test_instances_are_created_once_per_workspace(self):
  stored={};instances=[];created=[]
  def db(table,params=None,data=None,method=None,prefer=None):
   if table=='wa_connections':
    if data:stored.setdefault(data['workspace_id'],dict(data));return None
    return [stored[params['workspace_id'][3:]]] if params['workspace_id'][3:] in stored else []
   return []
  def evo(route,token,data=None):
   if route.startswith('/instance/info/'):
    return {'data':next((i for i in instances if i['id']==route.rsplit('/',1)[-1]),None)}
   if route=='/instance/create':
    created.append(data);instances.append({'id':data['instanceId'],'token':data['token']});return {'message':'success'}
   raise AssertionError(route)
  self.s.db=db;self.s.evo=evo;self.s.add_bridge=lambda conn:None
  a=self.s.ensure_connection(self.default);b=self.s.ensure_connection(self.other);again=self.s.ensure_connection(self.default)
  self.assertEqual(len(created),2);self.assertNotEqual(a['api_token'],b['api_token']);self.assertEqual(a['api_token'],again['api_token'])
 def test_qr_publishes_image_only_and_has_short_ttl(self):
  from datetime import datetime,timezone
  class B:c={}
  self.s.bridges[self.default]=B();updates=[]
  self.s.db=lambda *a,**k:[{'state':'starting','request_seq':1,'handled_seq':1,'requested_at':datetime.now(timezone.utc).isoformat()}]
  self.s.evo=lambda route,*a:({'data':{'Connected':False,'LoggedIn':False}} if route=='/instance/status' else {'data':{'qrcode':'data:image/png;base64,aGVsbG8=|private-pairing-reference'}})
  self.s.pairing=lambda ws,fields,seq:updates.append(fields)
  self.s.poll_pairing({'workspace_id':self.default,'api_token':'token','instance_id':'instance'})
  self.assertEqual(updates[0]['state'],'qr');self.assertNotIn('|',updates[0]['qr'])
  self.assertLess((datetime.fromisoformat(updates[0]['qr_expires_at'])-datetime.now(timezone.utc)).total_seconds(),21)
 def test_connected_clears_qr(self):
  from datetime import datetime,timezone
  class B:c={}
  self.s.bridges[self.default]=B();updates=[]
  self.s.db=lambda *a,**k:[{'state':'qr','request_seq':1,'handled_seq':1,'requested_at':datetime.now(timezone.utc).isoformat()}]
  self.s.evo=lambda *a,**k:{'data':{'Connected':True,'LoggedIn':True}}
  self.s.pairing=lambda ws,fields,seq:updates.append(fields)
  self.s.poll_pairing({'workspace_id':self.default,'api_token':'token'})
  self.assertEqual(updates[0]['state'],'connected');self.assertIsNone(updates[0]['qr'])
  self.assertTrue(self.s.bridges[self.default].c['PAIRING_READY'])
 def test_qr_event_is_published_without_waiting_for_poll(self):
  updates=[]
  self.s.db=lambda *a,**k:[{'state':'starting','request_seq':4}]
  self.s.evo=lambda *a,**k:(_ for _ in ()).throw(AssertionError('event must not wait for polling'))
  self.s.pairing=lambda ws,fields,seq:updates.append((ws,fields,seq))
  self.assertTrue(self.s.pairing_event(self.default,{'event':'QRCode','data':{'qrcode':'data:image/png;base64,aGVsbG8=|private'}}))
  self.assertEqual(updates[0][1]['state'],'qr');self.assertEqual(updates[0][2],4);self.assertNotIn('|',updates[0][1]['qr'])
 def test_start_finish_cannot_overwrite_an_early_qr_event(self):
  updates=[];self.s.db=lambda *args,**kwargs:updates.append(args)
  self.s.finish({'workspace_id':self.default,'processing_seq':4},'starting')
  self.assertEqual(updates[0][1]['state'],'in.(queued,starting)')
 def test_connected_event_clears_qr_immediately(self):
  updates=[];settings=[]
  self.s.db=lambda *a,**k:[{'state':'qr','request_seq':4}]
  self.s.pairing=lambda ws,fields,seq:updates.append(fields)
  self.s.settings=lambda ws,fields:settings.append(fields)
  self.s.pairing_event(self.default,{'event':'Connected','data':{'status':'open'}})
  self.assertEqual(updates[0]['state'],'connected');self.assertIsNone(updates[0]['qr']);self.assertTrue(settings[0]['connection_ok'])
if __name__=='__main__':unittest.main()

class PhonePairingTests(unittest.TestCase):
 def setUp(self):
  self.s=Supervisor({'WORKSPACE_ID':'ws','WEBHOOK_SECRET':'secret'})
 def test_phone_request_publishes_valid_code_for_same_sequence(self):
  writes=[];calls=[]
  def db(table,params=None,data=None,method=None,**kw):
   if data is not None:writes.append((table,params,data));return []
   if table=='workspaces':return [{'name':'Shop'}]
   return [{'request_seq':9}]
  self.s.db=db;self.s.ensure_connection=lambda ws:{'api_token':'private'};self.s.configure=lambda conn:None;self.s.settings=lambda *args:None
  def evo(route,token,data=None):
   calls.append((route,data))
   return {'data':{'PairingCode':'ABCD-1234'}} if route=='/instance/pair' else {'data':{'Connected':False,'LoggedIn':False}}
  self.s.evo=evo
  self.s.process({'workspace_id':'ws','processing_seq':9,'action':'phone','phone':'996555123456'})
  codes=[w for w in writes if w[2].get('state')=='code']
  self.assertEqual(len(codes),1);self.assertEqual(codes[0][2]['pairing_code'],'ABCD-1234')
  self.assertEqual(codes[0][1]['request_seq'],'eq.9');self.assertEqual(codes[0][1]['state'],'in.(queued,starting)')
  self.assertIsNone(codes[0][2]['phone']);self.assertIn(('/instance/pair',{'phone':'996555123456'}),calls)
 def test_qr_event_does_not_replace_phone_code(self):
  self.s.db=lambda *a,**k:[{'state':'starting','method':'phone','request_seq':9}]
  self.s.pairing=lambda *a,**k:self.fail('QR replaced phone pairing')
  self.assertTrue(self.s.pairing_event('ws',{'event':'QRCode','data':{'qrcode':'data:image/png;base64,aGVsbG8='}}))
 def test_terminal_error_removes_pairing_secret(self):
  updates=[];self.s.pairing=lambda ws,data,seq:updates.append(data)
  self.s.finish({'workspace_id':'ws','processing_seq':9},'error','connection_failed')
  self.assertIsNone(updates[0]['pairing_code']);self.assertIsNone(updates[0]['phone'])
