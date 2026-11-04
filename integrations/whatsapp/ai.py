"""Cached generic wording only: never sends customer text, names or orders to AI."""
import re,time
from business import MENU
CONDITIONS='Мы принимаем заявки на товары. Стоимость и сроки менеджер подтверждает после проверки товара и доставки. Заявка не означает оплату или подтверждение покупки. Для начала выберите 2, для менеджера — 3.'
class NaturalReplies:
 def __init__(self,bridge):
  self.b=bridge;self.db=bridge.db;self.cooldown=0
  self.db.execute('CREATE TABLE IF NOT EXISTS ai_phrases(intent TEXT PRIMARY KEY, body TEXT NOT NULL, created REAL NOT NULL)')
  self.db.execute('CREATE TABLE IF NOT EXISTS ai_daily(day TEXT PRIMARY KEY, count INTEGER NOT NULL)')
 def improve(self,answer):
  if not self.b.c.get('GEMINI_REPLY_ENABLED') or not self.b.c.get('SUPABASE_GATEWAY_JWT'):return answer
  intent='menu' if answer==MENU else 'conditions' if answer==CONDITIONS else None
  if not intent:return answer
  now=time.time();row=self.db.execute('select body,created from ai_phrases where intent=?',(intent,)).fetchone()
  text=row[0] if row and now-row[1]<86400 else None
  if not text:
   if now<self.cooldown:return answer
   day=time.strftime('%Y-%m-%d',time.gmtime(now))
   used=self.db.execute('select count from ai_daily where day=?',(day,)).fetchone()
   if used and used[0]>=4:return answer
   # Count attempts before the request; failures also consume the local budget.
   self.db.execute('insert into ai_daily values(?,1) on conflict(day) do update set count=count+1',(day,));self.db.commit()
   try:
    result=self.b.api(self.b.c['SUPABASE_URL']+'/functions/v1/whatsapp-ai',self.b.c['SUPABASE_SERVICE_KEY'],{'workspace':self.b.c['WORKSPACE_ID'],'intent':intent},extra_headers={'Authorization':'Bearer '+self.b.c['SUPABASE_GATEWAY_JWT']})
    text=result.get('answer','').strip()
    if not text or len(text)>600 or re.search(r'[0-9]|https?:|www\.|@',text,re.I):raise ValueError('invalid_ai_response')
    self.db.execute('insert or replace into ai_phrases values(?,?,?)',(intent,text,now));self.db.commit()
   except Exception:
    self.cooldown=now+600;return answer
  if intent=='menu':return text+'\n'+MENU
  return text+'\nДля новой заявки — 2, для связи с менеджером — 3.'
