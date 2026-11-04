import sqlite3,unittest
from ai import NaturalReplies,CONDITIONS
from business import MENU
class NaturalReplyTests(unittest.TestCase):
 def setUp(self):
  class B:pass
  self.b=B();self.b.db=sqlite3.connect(':memory:');self.b.c={'GEMINI_REPLY_ENABLED':True,'SUPABASE_GATEWAY_JWT':'public-jwt','SUPABASE_URL':'https://example.supabase.co','SUPABASE_SERVICE_KEY':'private','WORKSPACE_ID':'ws'};self.calls=[]
  def api(*a,**kw):self.calls.append((a,kw));return {'answer':'Здравствуйте! Чем могу помочь?'}
  self.b.api=api;self.ai=NaturalReplies(self.b)
 def tearDown(self):self.b.db.close()
 def test_only_static_intents_leave_server_and_are_cached(self):
  first=self.ai.improve(MENU);again=self.ai.improve(MENU)
  self.assertEqual(first,again);self.assertEqual(len(self.calls),1)
  self.assertEqual(self.calls[0][0][2],{'workspace':'ws','intent':'menu'});self.assertIn(MENU,first)
 def test_private_order_data_and_actions_never_use_model(self):
  for body in ['Имя: Анна, номер +996555555555','Заказ №123 оплачен','СТОП',None]:
   self.assertEqual(self.ai.improve(body),body)
  self.assertFalse(self.calls)
 def test_unavailable_model_falls_back_without_blocking_bot(self):
  def fail(*a,**kw):raise TimeoutError()
  self.b.api=fail
  self.assertEqual(self.ai.improve(MENU),MENU);self.assertEqual(self.ai.improve(MENU),MENU)
 def test_suspicious_output_is_rejected(self):
  self.b.api=lambda *a,**kw:{'answer':'Цена 500, звоните @agent'}
  self.assertEqual(self.ai.improve(CONDITIONS),CONDITIONS)
 def test_disabled_flag_sends_no_requests(self):
  self.b.c['GEMINI_REPLY_ENABLED']=False;self.assertEqual(self.ai.improve(MENU),MENU);self.assertFalse(self.calls)
