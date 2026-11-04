"""Generic phrasing is prepared in the background; no customer text leaves here."""
import re,time,threading
from business import MENU
CONDITIONS='Мы принимаем заявки на товары. Стоимость и сроки менеджер подтверждает после проверки товара и доставки. Заявка не означает оплату или подтверждение покупки. Для начала выберите 2, для менеджера — 3.'
class NaturalReplies:
 def __init__(self,bridge):
  self.b=bridge;self.db=bridge.db;self.cooldown=0;self.pending=False;self.state_lock=threading.Lock()
  self.db_lock=getattr(bridge,'lock',threading.RLock());self.cache={}
  self.db.execute('CREATE TABLE IF NOT EXISTS ai_phrases(intent TEXT PRIMARY KEY, body TEXT NOT NULL, created REAL NOT NULL)')
  self.db.execute('CREATE TABLE IF NOT EXISTS ai_daily(day TEXT PRIMARY KEY, count INTEGER NOT NULL)')
  for intent,body,created in self.db.execute('select intent,body,created from ai_phrases'):self.cache[intent]=(body,created)
 def enabled(self):
  return self.b.c.get('GEMINI_REPLY_ENABLED') and self.b.c.get('SUPABASE_GATEWAY_JWT') and not self.b.c.get('DISABLED')
 def cached(self,intent):
  with self.state_lock:
   row=self.cache.get(intent)
   return row[0] if row and time.time()-row[1]<86400 else None
 def start(self,intent='menu'):
  if not self.enabled() or self.cached(intent):return
  with self.state_lock:
   if self.pending or time.time()<self.cooldown:return
   self.pending=True
  def run():
   try:self.warm(intent)
   finally:
    with self.state_lock:self.pending=False
  threading.Thread(target=run,daemon=True).start()
 def warm(self,intent):
  if intent not in ('menu','conditions') or not self.enabled() or self.cached(intent):return
  now=time.time()
  with self.state_lock:
   if now<self.cooldown:return
  day=time.strftime('%Y-%m-%d',time.gmtime(now))
  with self.db_lock:
   used=self.db.execute('select count from ai_daily where day=?',(day,)).fetchone()
   if used and used[0]>=4:return
   self.db.execute('insert into ai_daily values(?,1) on conflict(day) do update set count=count+1',(day,));self.db.commit()
  try:
   result=self.b.api(self.b.c['SUPABASE_URL']+'/functions/v1/whatsapp-ai',self.b.c['SUPABASE_SERVICE_KEY'],{'workspace':self.b.c['WORKSPACE_ID'],'intent':intent},extra_headers={'Authorization':'Bearer '+self.b.c['SUPABASE_GATEWAY_JWT']},timeout=55)
   text=result.get('answer','').strip()
   if not text or len(text)>600 or re.search(r'[0-9]|https?:|www\.|@',text,re.I):raise ValueError('invalid_ai_response')
   with self.db_lock:
    self.db.execute('insert or replace into ai_phrases values(?,?,?)',(intent,text,now));self.db.commit()
   with self.state_lock:self.cache[intent]=(text,now)
  except Exception:
   with self.state_lock:self.cooldown=time.time()+600
 def improve(self,answer):
  if not self.enabled():return answer
  intent='menu' if answer==MENU else 'conditions' if answer==CONDITIONS else None
  if not intent:return answer
  text=self.cached(intent)
  if not text:self.start(intent);return answer
  if intent=='menu':return text+'\n'+MENU
  return text+'\nДля новой заявки — 2, для связи с менеджером — 3.'
