"""Business flows, scoped to one workspace and a bearer-authorized client cabinet."""
import base64, json, re, uuid
from urllib.parse import parse_qs, urlparse, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError
SITE='https://miradio5555-code.github.io/robott/'
MENU=('ULA Factory · помощник\n1 — Мои заказы\n2 — Новая заявка (фото или ссылка)\n3 — Менеджер\n4 — Условия работы\nМЕНЮ — начать заново · СТОП — отключить сообщения')

class Business:
    def __init__(self, bridge):
        self.b=bridge; self.db=bridge.db; self.c=bridge.c
        self.db.execute('CREATE TABLE IF NOT EXISTS sessions(phone TEXT PRIMARY KEY, data TEXT NOT NULL)')
    def load(self,phone):
        row=self.db.execute('select data from sessions where phone=?',(phone,)).fetchone()
        return json.loads(row[0]) if row else {}
    def save(self,phone,s):
        self.db.execute('insert or replace into sessions values(?,?)',(phone,json.dumps(s)));self.db.commit()
    def api(self,route,data=None):
        return self.b.api(self.c['SUPABASE_URL']+'/rest/v1/'+route,self.c['SUPABASE_SERVICE_KEY'],data)
    def respond(self,phone,text,mid,media=None):
        s=self.load(phone);t=text.strip();cmd=t.lower().rstrip('?! .')
        if cmd in ('меню','отмена','старт','start'):
            s.pop('draft',None);s.pop('step',None);s.pop('human',None);self.save(phone,s);return MENU
        if cmd in ('отвязать','выйти'):
            self.save(phone,{});return 'Личный кабинет отвязан от WhatsApp. '+MENU
        if s.get('human'): return None
        if cmd in ('3','менеджер','оператор') and not s.get('step'):
            s['human']=True;self.save(phone,s)
            return 'Автоответы приостановлены. Напишите вопрос и номер заказа здесь — менеджер увидит их в WhatsApp. Чтобы вернуться к боту, напишите МЕНЮ.'
        if cmd in ('4','условия') and not s.get('step'):
            return 'Мы принимаем заявки на товары. Стоимость и сроки менеджер подтверждает после проверки товара и доставки. Заявка не означает оплату или подтверждение покупки. Для начала выберите 2, для менеджера — 3.'
        token=self.cabinet_token(t)
        if token:
            # Possession of the existing cabinet link authorizes access, as on the website.
            found=self.api('client_cabinets?'+urlencode({'token':'eq.'+token,'workspace_id':'eq.'+self.c['WORKSPACE_ID'],'select':'workspace_id','limit':'1'}))
            if not found:return 'Ссылка не найдена в ULA Factory или отключена. Попросите менеджера прислать актуальную личную ссылку.'
            s['cabinet']=token;self.save(phone,s);return self.orders(token,phone)
        if cmd in ('1','мои заказы','заказы','где мой заказ','статус') and not s.get('step'):
            if not s.get('cabinet'):return 'Пришлите вашу личную ссылку на кабинет ULA Factory (с параметром ?c=…). Её выдаёт менеджер. По одному имени или номеру чужие заказы не показываем.'
            return self.orders(s['cabinet'],phone)
        if cmd in ('2','заявка','новая заявка') and not s.get('step'):
            s['draft']={};s['step']='name';self.save(phone,s);return 'Создадим заявку. Как к вам обращаться? Напишите имя (2–120 символов). ОТМЕНА — выйти.'
        if s.get('step'):
            d=s['draft'];step=s['step']
            if step=='name':
                if not 2<=len(t)<=120:return 'Укажите имя длиной 2–120 символов.'
                d['name']=t;s['step']='product';ans='Пришлите фото товара или ссылку https://… . Можно также описать товар текстом (до 300 символов).'
            elif step=='product':
                if media:
                    if not media.get('base64'):return 'Фото не удалось загрузить. Попробуйте отправить его ещё раз или пришлите ссылку на товар.'
                    try:raw=base64.b64decode(media['base64'],validate=True)
                    except ValueError:return 'Не удалось прочитать фото. Пришлите его повторно.'
                    if len(raw)>5*1024*1024:return 'Фото больше 5 МБ. Пришлите уменьшенное фото или ссылку.'
                    if raw.startswith(b'\xff\xd8\xff'):kind='jpeg'
                    elif raw.startswith(b'\x89PNG\r\n\x1a\n'):kind='png'
                    elif raw[:4]==b'RIFF' and raw[8:12]==b'WEBP':kind='webp'
                    else:return 'Поддерживаются фото JPEG, PNG и WebP. Пришлите другой файл или ссылку.'
                    d.update(photo=media['base64'],photo_type=kind,product=(t or 'Товар по фото')[:300])
                elif re.fullmatch(r'https?://[^\s]{1,2040}',t): d.update(link=t,product='Товар по ссылке')
                elif 3<=len(t)<=300:d['product']=t
                else:return 'Пришлите фото, ссылку или описание товара (3–300 символов).'
                s['step']='qty';ans='Какое количество нужно? Укажите целое число от 1 до 100000.'
            elif step=='qty':
                if not t.isdigit() or not 1<=int(t)<=100000:return 'Укажите целое количество от 1 до 100000.'
                d['qty']=int(t);s['step']='comment';ans='Добавьте размер, цвет и другие пожелания (до 1000 символов). Если пожеланий нет, отправьте «Нет».'
            elif step=='comment':
                if len(t)>1000:return 'Сократите пожелания до 1000 символов.'
                d['comment']='' if cmd=='нет' else t;s['step']='confirm'
                ans=f"Проверьте заявку:\nИмя: {d['name']}\nТовар: {d['product']}\nКоличество: {d['qty']}\nПожелания: {d['comment'] or 'нет'}\nНапишите ДА для отправки менеджеру или ОТМЕНА."
            elif step=='confirm':
                if cmd not in ('да','подтвердить'):return 'Для создания заявки напишите ДА, для отмены — ОТМЕНА.'
                # Stable ID makes retrying the same draft safe after network errors.
                d.setdefault('id',str(uuid.uuid5(uuid.NAMESPACE_URL,'ula-whatsapp:'+phone+':'+mid)));self.save(phone,s)
                ans=self.create(phone,d);s.pop('step',None);s.pop('draft',None)
            else:ans=MENU
            self.save(phone,s);return ans
        if media:return 'Чтобы оформить заявку по фото, сначала выберите 2. Затем бот попросит имя и фото товара.'
        return MENU
    @staticmethod
    def cabinet_token(text):
        try:
            u=urlparse(text)
            if u.scheme!='https' or u.netloc!='miradio5555-code.github.io' or u.path!='/robott/':return None
            t=parse_qs(u.query).get('c',[''])[0]
            return t if re.fullmatch('[a-f0-9]{32}',t) else None
        except ValueError:return None
    def orders(self,token,phone=None):
        result=self.api('rpc/get_client_cabinet',{'p_token':token})
        if not result:return 'Личная ссылка отключена. Попросите менеджера новую и пришлите её сюда.'
        rows=result.get('orders') or []
        if not rows:return 'В личном кабинете пока нет заказов.'
        if phone and getattr(self.b,'cloud',None):
            numbers=[o['order_number'] for o in rows[:100]]
            for number in numbers:
                matches=self.api('orders?'+urlencode({'workspace_id':'eq.'+self.c['WORKSPACE_ID'],'order_number':'eq.'+number,'select':'id','limit':1}))
                if matches:self.b.cloud.link(phone,matches[0]['id'])
        from bridge import STATUS
        lines=['Ваши заказы ULA Factory:']
        for o in rows[:10]:
            lines.append(f"№{o['order_number']} · {str(o.get('product_ru',''))[:90]} · {STATUS.get(o['status'],o['status'])}"+(f"\nТрек: {o['tracking_number']}" if o.get('tracking_number') else ''))
        lines.append('Все подробности — в вашем личном кабинете. Для менеджера отправьте 3. ОТВЯЗАТЬ — отключить доступ из WhatsApp.')
        return '\n'.join(lines)
    def create(self,phone,d):
        exists=self.api('orders?'+urlencode({'id':'eq.'+d['id'],'workspace_id':'eq.'+self.c['WORKSPACE_ID'],'select':'id,order_number','limit':'1'}))
        if not exists:
            from datetime import datetime,timezone,timedelta
            since=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()
            recent=self.api('orders?'+urlencode({'workspace_id':'eq.'+self.c['WORKSPACE_ID'],'client_phone':'eq.+'+phone,'source':'eq.request','created_at':'gte.'+since,'select':'id','limit':'5'}))
            if len(recent)>=5:return 'Лимит: до 5 заявок в час. Напишите 3 для связи с менеджером.'
            payload={'id':d['id'],'workspace_id':self.c['WORKSPACE_ID'],'source':'request','client_name':d['name'],'client_phone':'+'+phone,'product_ru':d['product'],'supplier_link':d.get('link'),'quantity':d['qty'],'status':'new','admin_comment':'Заявка WhatsApp. '+d.get('comment','')}
            payload.update(self.c.get('ORDER_DEFAULTS',{}))
            # One request per draft; DB unique primary key prevents duplicate orders.
            self.api('orders',payload)
            exists=self.api('orders?'+urlencode({'id':'eq.'+d['id'],'workspace_id':'eq.'+self.c['WORKSPACE_ID'],'select':'id,order_number','limit':'1'}))
        if not exists:raise ValueError('Order not persisted')
        if getattr(self.b,'cloud',None):
            self.b.cloud.link(phone,d['id'])
            self.b.cloud.set_thread(phone,{'display_name':d['name'][:120]})
        if d.get('photo'):
            path=d['id']+'/whatsapp.'+d['photo_type'];raw=base64.b64decode(d['photo'])
            req=Request(self.c['SUPABASE_URL']+'/storage/v1/object/order-photos/'+path,data=raw,headers={'apikey':self.c['SUPABASE_SERVICE_KEY'],'Content-Type':'image/'+d['photo_type'],'x-upsert':'true'},method='POST')
            with urlopen(req,timeout=25):pass
            photos=self.api('order_photos?'+urlencode({'order_id':'eq.'+d['id'],'storage_path':'eq.'+path,'select':'id'}))
            if not photos:self.api('order_photos',{'order_id':d['id'],'storage_path':path})
        return f"Заявка №{exists[0]['order_number']} сохранена в ULA Factory"+(' с фото' if d.get('photo') else '')+'. Менеджер проверит товар и уточнит условия. Для новой заявки — 2, для связи с менеджером — 3.'
