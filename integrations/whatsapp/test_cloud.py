import unittest
from cloud import Cloud
class BridgeStub:
    def __init__(self):self.c={'WORKSPACE_ID':'own','SUPABASE_URL':'https://example.supabase.co','SUPABASE_SERVICE_KEY':'key','EVOLUTION_URL':'http://api','INSTANCE_TOKEN':'token'};self.sent=[]
    def send(self,*args):self.sent.append(args)
class CloudTests(unittest.TestCase):
    def setUp(self):self.b=BridgeStub();self.c=Cloud(self.b);self.c.last_heartbeat=10**20;self.c.connection_ok=True;self.patches=[];self.c.patch=lambda table,params,data:self.patches.append((table,params,data))
    def test_offline_does_not_consume_attempts(self):
        self.c.connection_ok=False;self.c.last_reconnect=10**20
        self.c.call=lambda *a,**k:(_ for _ in ()).throw(AssertionError('offline claim'))
        self.c.tick();self.assertFalse(self.b.sent)
    def test_redact_secret_cabinet_link(self):
        value='https://miradio5555-code.github.io/robott/?c='+'a'*32
        self.assertNotIn('a'*32,Cloud.redact(value))
    def test_receipt_does_not_downgrade_read(self):
        self.c.receipt({'data':{'Type':'delivered','MessageIDs':['WA1']}})
        self.assertEqual(self.patches[0][1]['workspace_id'],'eq.own');self.assertEqual(self.patches[0][1]['state'],'in.(sending,sent)')
    def test_opt_out_cancels_delivery(self):
        self.c.call=lambda *a,**k:[{'id':'m','thread_id':'t','kind':'status','attempts':1,'body':'hello'}]
        self.c.thread_by_id=lambda id:{'phone':'996555000000','opted_out':True}
        self.c.tick();self.assertFalse(self.b.sent);self.assertEqual(self.patches[0][2]['state'],'cancelled')
    def test_control_ack_can_be_sent_after_opt_out(self):
        self.c.call=lambda *a,**k:[{'id':'m','thread_id':'t','kind':'control','attempts':1,'body':'stopped'}]
        self.c.thread_by_id=lambda id:{'phone':'996555000000','opted_out':True}
        self.c.tick();self.assertEqual(len(self.b.sent),1)
    def test_failure_is_queued_with_backoff(self):
        self.c.call=lambda *a,**k:[{'id':'m','thread_id':'t','kind':'text','attempts':2,'body':'hello'}]
        self.c.thread_by_id=lambda id:{'phone':'996555000000','opted_out':False}
        self.b.send=lambda *a:(_ for _ in ()).throw(ConnectionError())
        self.c.tick();self.assertTrue(any(p[2].get('state')=='queued' and p[2].get('error')=='ConnectionError' for p in self.patches))
    def test_quote_decision_uses_sender_not_arbitrary_thread(self):
        calls=[];self.c.call=lambda route,data:(calls.append(data) or 'accepted')
        self.assertIn('подтверждён',self.c.quote('996555000000','ДА ABCDEF1234'))
        self.assertEqual(calls[0]['p_phone'],'996555000000');self.assertEqual(calls[0]['p_workspace'],'own')
if __name__=='__main__':unittest.main()
