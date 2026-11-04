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
if __name__=='__main__':unittest.main()
