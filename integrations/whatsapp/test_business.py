import json,os,tempfile,unittest
from unittest.mock import patch
from bridge import Bridge
from business import Business

class BusinessTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.env=patch.dict(os.environ,{'STATE_DIR':self.tmp.name});self.env.start()
        self.b=Bridge({'WORKSPACE_ID':'own','SUPABASE_URL':'https://example.supabase.co','SUPABASE_SERVICE_KEY':'test','EVOLUTION_URL':'http://test','INSTANCE_TOKEN':'test'})
        self.bot=self.b.business;self.calls=[];self.orders=[]
        def api(route,data=None):
            self.calls.append((route,data))
            if route.startswith('client_cabinets?'):return [{'workspace_id':'own'}] if 'valid' in route else []
            if route=='rpc/get_client_cabinet':return {'orders':[{'order_number':'ULA-1','status':'in_transit','product_ru':'Товар'}]}
            if route=='orders':self.orders.append({**data,'order_number':'ULA-001'});return None
            if route.startswith('orders?'):
                if 'created_at' in route:return []
                return self.orders
            return []
        self.bot.api=api
    def tearDown(self):self.b.db.close();self.env.stop();self.tmp.cleanup()
    def say(self,text,mid='m'):return self.bot.respond('996555000000',text,mid)
    def test_personal_orders_require_link(self):
        self.assertIn('личную ссылку',self.say('1'));self.assertFalse(self.calls)
    def test_only_official_cabinet_link(self):
        self.assertIsNone(Business.cabinet_token('https://evil.example/?c='+'a'*32))
        self.assertEqual(Business.cabinet_token('https://miradio5555-code.github.io/robott/?c='+'a'*32),'a'*32)
    def test_other_workspace_token_rejected(self):
        self.assertIn('не найдена',self.say('https://miradio5555-code.github.io/robott/?c='+'a'*32))
        self.assertIn('workspace_id=eq.own',self.calls[0][0]);self.assertNotIn('cabinet',self.bot.load('996555000000'))
    def test_request_ids_are_workspace_scoped(self):
        ids=[]
        self.bot.create=lambda phone,d:(ids.append(d['id']) or 'saved')
        for workspace in ('own','another'):
            self.b.c['WORKSPACE_ID']=workspace
            for msg in ('2','Иван','Товар','1','Нет'):self.say(msg)
            self.say('ДА','same-provider-id')
        self.assertNotEqual(ids[0],ids[1])
    def test_cancel_draft(self):
        self.say('2');self.say('Иван');self.say('отмена');self.assertNotIn('draft',self.bot.load('996555000000'));self.assertFalse(self.orders)
    def test_quantity_validation(self):
        for msg in ('2','Иван','Товар'):self.say(msg)
        self.assertIn('целое',self.say('-10'));self.assertIn('целое',self.say('999999'))
    def test_confirm_before_insert_and_idempotent_create(self):
        for msg in ('2','Иван','https://example.com/product','2','Красный'):self.say(msg)
        self.assertFalse(self.orders)
        self.assertIn('сохранена',self.say('ДА','confirm-id'));self.assertEqual(len(self.orders),1)
        d=self.orders[0];self.assertEqual(d['workspace_id'],'own');self.assertEqual(d['client_phone'],'+996555000000')
        self.bot.create('996555000000',{'id':d['id']});self.assertEqual(len(self.orders),1)
    def test_human_pause_and_resume(self):
        self.assertIn('приостановлены',self.say('3'));self.assertIsNone(self.say('Здравствуйте'));self.assertIn('Мои заказы',self.say('меню'))
    def test_media_requires_decodable_image(self):
        self.say('2');self.say('Иван');self.assertIn('загрузить',self.bot.respond('996555000000','','img',{'imageMessage':{}}))
    def test_response_retry_does_not_advance_wizard(self):
        self.b.send=lambda *args:(_ for _ in ()).throw(ConnectionError())
        event={'event':'Message','data':{'Info':{'ID':'id1','Chat':'996555000000@s.whatsapp.net'},'Message':{'conversation':'2'}}}
        with self.assertRaises(ConnectionError):self.b.handle(event)
        self.assertEqual(self.bot.load('996555000000')['step'],'name')
        sent=[];self.b.send=lambda phone,text,id:sent.append(text)
        self.b.handle(event);self.b.handle(event)
        self.assertEqual(len(sent),1);self.assertIn('Как к вам',sent[0]);self.assertEqual(self.bot.load('996555000000')['step'],'name')

    def test_natural_order_question_still_requires_private_link(self):
        self.assertIn('личную ссылку',self.say('Здравствуйте, где мой заказ?'));self.assertFalse(self.calls)
    def test_natural_request_keeps_wizard_fields_literal(self):
        self.assertIn('Как к вам обращаться',self.say('Хочу заказать'))
        self.say('Иван');self.say('Оплата доставки товара')
        self.assertEqual(self.bot.load('996555000000')['step'],'qty')
        self.assertEqual(self.bot.load('996555000000')['draft']['product'],'Оплата доставки товара')
    def test_payment_statement_never_confirms_payment(self):
        self.assertIn('нужно проверить',self.say('Я уже оплатил'))
        self.assertFalse(self.orders);self.assertFalse(self.calls)
    def test_human_handoff_understands_regular_phrase(self):
        self.assertIn('приостановлены',self.say('Хочу поговорить с менеджером'))
        self.assertIsNone(self.say('Как оплатить?'))
    def test_delivery_faq_does_not_invent_a_date(self):
        answer=self.say('Когда приедет доставка?');self.assertIn('уточняет менеджер',answer);self.assertFalse(self.calls)

    def test_private_contact_is_not_copied_into_business_inbox(self):
        class PrivateCloud:
            def audience(self,*args):return {'allowed':False}
            def ingest(self,*args):raise AssertionError('Private message copied')
            def queue(self,*args):raise AssertionError('Private contact replied to')
        self.b.cloud=PrivateCloud()
        self.b.handle({'event':'Message','data':{'Info':{'ID':'family','Chat':'996555000000@s.whatsapp.net'},'Message':{'conversation':'Привет, как дела?'}}})
        self.assertEqual(self.b.db.execute('select count(*) from contacts').fetchone()[0],0)
    def test_buyer_delivery_text_is_scoped_to_current_call(self):
        first=self.bot.respond('996555000000','Доставка','m',settings={'delivery_message':'Условия доставки нашего магазина'})
        self.assertIn('нашего магазина',first)
        self.assertNotIn('нашего магазина',self.say('Доставка'))

if __name__=='__main__':unittest.main()
