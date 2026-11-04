import unittest
from bridge import incoming,reply
class IncomingTests(unittest.TestCase):
    def event(self,**fields):
        return {'event':'Message','data':{'Info':{'ID':'test','Chat':'996555000000@s.whatsapp.net',**fields},'Message':{'conversation':'Привет'}}}
    def test_private_message(self):
        self.assertEqual(incoming(self.event()),('test','996555000000','Привет'))
    def test_no_self_reply_loop(self):
        self.assertIsNone(incoming(self.event(IsFromMe=True)))
    def test_no_group_or_broadcast_reply(self):
        for chat in ('123@g.us','status@broadcast','123@lid'):
            self.assertIsNone(incoming(self.event(Chat=chat)))
    def test_ignore_other_events(self):
        e=self.event();e['event']='SendMessage';self.assertIsNone(incoming(e))
    def test_unknown_input_shows_menu(self):
        self.assertIn('1 — заказ',reply('произвольный вопрос'))
    def test_stop(self):
        self.assertIn('отключены',reply('STOP'))
if __name__=='__main__': unittest.main()
