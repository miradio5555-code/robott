/* Хранение карты в Supabase для раздела внутри ULA Factory. Подключается только на опубликованной странице.
   Администратор работает со своей прежней картой (factory_map_data, строка 'main', factory-map/setup.sql).
   Любой другой вошедший человек — со своей личной картой (factory_maps, файл 73): чужие карты база не отдаёт. */
(function(){
  'use strict';
  const ADMIN_TABLE='factory_map_data',NAME='main',OWN_TABLE='factory_maps',HOME='../';
  const cfg=window.CARGO_CONFIG||{};
  const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  let version=null,mode=null,uid=null;
  const empty=()=>({factories:[],areas:[],tasks:[],news:[],visits:[],logs:[],cities:[]});
  const missing=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01');

  const BUTTON='display:block;padding:12px 16px;border-radius:12px;background:#151417;color:#fff;font-weight:600;text-align:center;text-decoration:none;border:0;cursor:pointer;font:inherit';
  const never=()=>new Promise(()=>{});
  const backHome={label:'Открыть ULA Factory',href:HOME};
  const reload={label:'Обновить страницу',onClick:()=>location.reload()};

  function showScreen(title,text,actions){
    document.getElementById('remoteScreen')?.remove();
    const box=document.createElement('div');
    box.id='remoteScreen';
    box.setAttribute('role','alertdialog');
    box.style.cssText='position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:16px;background:var(--bg,#f5f5f7)';
    const card=document.createElement('div');
    card.style.cssText='display:grid;gap:12px;width:100%;max-width:420px;padding:24px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(20,20,30,.12)';
    const h=document.createElement('h2');
    h.style.margin='0';
    h.textContent=title;
    const p=document.createElement('p');
    p.style.margin='0';
    p.textContent=text;
    card.append(h,p);
    actions.forEach(a=>card.append(a.el||actionButton(a)));
    box.append(card);
    document.body.append(box);
  }

  function actionButton(a){
    const el=document.createElement(a.href?'a':'button');
    el.textContent=a.label;
    el.className='primary';
    el.style.cssText=BUTTON;
    if(a.href)el.href=a.href;
    else{el.type='button';el.addEventListener('click',a.onClick)}
    return el;
  }

  function stop(title,text,actions){
    showScreen(title,text,actions);
    return never();
  }

  function validate(data){
    if(!data||!Array.isArray(data.areas)||!Array.isArray(data.factories)||!Array.isArray(data.tasks)||!Array.isArray(data.news||[])||!Array.isArray(data.visits||[]))throw Error('Неверная структура базы');
    const seen=new Set();
    data.factories.forEach(f=>{
      if(!String(f.company_cn||'').trim())throw Error('У фабрики нет китайского юрлица');
      const key=`${f.company_cn.trim()}|${String(f.address_cn||'').trim()}`;
      if(seen.has(key))throw Error(`Дубликат: ${f.company_cn} / ${f.address_cn||'адрес не указан'}`);
      seen.add(key);
    });
  }

  function askImport(){
    const label=document.createElement('label');
    label.textContent='Выбрать файл main.json';
    label.className='primary';
    label.style.cssText=BUTTON;
    const input=document.createElement('input');
    input.type='file';
    input.id='remoteImportFile';
    input.accept='application/json,.json';
    input.hidden=true;
    label.append(input);
    input.addEventListener('change',async()=>{
      try{
        const data=JSON.parse(await input.files[0].text());
        validate(data);
        const{error}=await client.from(ADMIN_TABLE).insert({name:NAME,data});
        if(error)throw Error(error.message);
        location.reload();
      }catch(e){
        showScreen('Файл не загружен',e.message,[reload]);
      }
    });
    return stop('База карты пуста','Загрузите файл data/db/main.json из папки China map. Это нужно сделать один раз.',[{el:label}]);
  }

  async function load(){
    const{data:{session}}=await client.auth.getSession();
    if(!session)return stop('Нужен вход','Войдите в ULA Factory и снова откройте карту.',[backHome]);
    uid=session.user.id;
    // Один заход в базу: роль, карта администратора (база отдаёт её только администратору) и своя карта.
    const[admin,role,main,own]=await Promise.all([
      client.rpc('is_admin'),
      client.from('profiles').select('role').eq('user_id',uid).maybeSingle(),
      client.from(ADMIN_TABLE).select('data,version').eq('name',NAME),
      client.from(OWN_TABLE).select('data,version').eq('user_id',uid)
    ]);
    if(admin.data===true){
      mode='admin';
      if(main.error){
        if(missing(main.error))return stop('Карта ещё не подключена','В базе нет таблицы карты. Запустите файл factory-map/setup.sql в Supabase.',[backHome]);
        return stop('Карта не загрузилась',main.error.message,[reload,backHome]);
      }
      if(main.data.length){
        version=main.data[0].version;
        return{db:NAME,data:main.data[0].data};
      }
      return askImport();
    }
    // Администратор без входа с кодом: не подменять его карту пустой личной.
    if(role.data?.role==='admin')return stop('Нужен вход с кодом','Карта администратора открывается после входа с кодом. Войдите в ULA Factory заново и снова откройте карту.',[backHome]);
    mode='own';
    if(own.error){
      if(missing(own.error))return stop('Карта фабрик скоро появится','Раздел ещё подключается. Попробуйте позже.',[backHome]);
      return stop('Карта не загрузилась',own.error.message,[reload,backHome]);
    }
    if(own.data.length){
      version=own.data[0].version;
      return{db:`u-${uid}`,data:own.data[0].data};
    }
    // Первый вход: создать пустую личную карту. Если её только что создала другая вкладка — взять ту.
    const made=await client.from(OWN_TABLE).insert({data:empty()}).select('data,version');
    const row=made.data?.[0]||(made.error?.code==='23505'?(await client.from(OWN_TABLE).select('data,version').eq('user_id',uid)).data?.[0]:null);
    if(!row)return stop('Карта не загрузилась',made.error?.message||'Нет ответа базы',[reload,backHome]);
    version=row.version;
    return{db:`u-${uid}`,data:row.data};
  }

  async function save(body){
    validate(body);
    body.updatedAt=new Date().toISOString().slice(0,10);
    const table=mode==='admin'?ADMIN_TABLE:OWN_TABLE;
    const mine=q=>mode==='admin'?q.eq('name',NAME):q.eq('user_id',uid);
    const{data,error}=await mine(client.from(table).update({data:body,version:version+1})).eq('version',version).select('version');
    if(error)throw Error(error.message);
    if(data.length){
      version=data[0].version;
      return{ok:true,updatedAt:body.updatedAt};
    }
    // Запись не прошла: либо данные уже новее, либо доступ закончился.
    const now=await mine(client.from(table).select('version'));
    if(now.data?.length&&now.data[0].version!==version){
      showScreen('Карта уже изменилась','Данные изменили в другой вкладке или на другом устройстве. Последняя правка не сохранена. Обновите страницу и повторите её.',[reload]);
      throw Error('данные уже изменились');
    }
    showScreen('Нужен вход','Доступ закончился. Последняя правка не сохранена. Войдите в ULA Factory заново.',[backHome]);
    throw Error('нет доступа');
  }

  // mode: 'admin' — карта администратора, 'own' — личная карта байера (известно после загрузки).
  window.FACTORY_MAP_REMOTE={request:(method,body)=>method==='PUT'?save(body):load(),get mode(){return mode}};

  // Обратный путь в основное приложение: логотип на компьютере и строка в «Ещё» на телефоне.
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.brand').forEach(el=>{
      el.style.cursor='pointer';
      el.title='Вернуться в ULA Factory';
      el.addEventListener('click',()=>{location.href=HOME});
    });
    const more=document.querySelector('#more .group');
    if(more){
      const back=document.createElement('a');
      back.className='row';
      back.href=HOME;
      back.style.textDecoration='none';
      back.innerHTML='<span class="row-main"><b>Вернуться в ULA Factory</b></span>';
      more.prepend(back);
    }
  });
})();
