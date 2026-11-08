import io,unittest
from unittest.mock import patch
from urllib.error import HTTPError
from bridge import Bridge,_http_connections

class TransportTests(unittest.TestCase):
 def setUp(self):
  _http_connections.pool={};self.b=object.__new__(Bridge)
 def test_keepalive_reuses_tls_and_keeps_credentials_per_request(self):
  class Response:
   will_close=False;status=200
   def read(self):return b'{"ok":true}'
  class Connection:
   def __init__(self,*a,**kw):self.headers=[]
   def request(self,*a,**kw):self.headers.append(kw['headers'])
   def getresponse(self):return Response()
  with patch('bridge.http.client.HTTPSConnection',side_effect=Connection) as factory:
   self.b.api('https://project.supabase.co/rest/v1/a','sb_secret_one')
   self.b.api('https://project.supabase.co/rest/v1/b','sb_secret_two')
   self.assertEqual(factory.call_count,1)
   headers=next(iter(_http_connections.pool.values())).headers
   self.assertEqual(headers[0]['apikey'],'sb_secret_one');self.assertEqual(headers[1]['apikey'],'sb_secret_two')
   self.assertNotIn('Authorization',headers[1])
 def test_only_reads_are_replayed_after_disconnect(self):
  from http.client import RemoteDisconnected
  for method,expected in [('GET',2),('POST',1)]:
   _http_connections.pool={}
   with patch('bridge.http.client.HTTPSConnection') as factory:
    factory.return_value.request.side_effect=RemoteDisconnected()
    with self.assertRaises(RemoteDisconnected):self.b.api('https://example.com/api','key',method=method)
    self.assertEqual(factory.call_count,expected)
 def test_http_error_preserves_body_for_safe_classification(self):
  class Response:
   will_close=False;status=500;reason='Error';headers={}
   def read(self):return b'{"error":"TLS handshake timeout"}'
  with patch('bridge.http.client.HTTPSConnection') as factory:
   factory.return_value.getresponse.return_value=Response()
   with self.assertRaises(HTTPError) as caught:self.b.api('https://example.com/api','key')
   self.assertIn(b'handshake',caught.exception.read());self.assertEqual(factory.call_count,1);caught.exception.close()
