/* Хранение карты в Supabase для раздела внутри ULA Factory. Подключается только на опубликованной странице. */
(function(){
  'use strict';
  const TABLE='factory_map_data',NAME='main',HOME='../';
  const cfg=window.CARGO_CONFIG||{};
  const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  let version=null;

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
    el.style.cssText='display:block;text-align:center;text-decoration:none';
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
    label.style.cssText='display:block;text-align:center;cursor:pointer';
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
        const{error}=await client.from(TABLE).insert({name:NAME,data});
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
    if(!session)return stop('Нужен вход','Войдите в ULA Factory как администратор и снова откройте карту.',[backHome]);
    const{data,error}=await client.from(TABLE).select('data,version').eq('name',NAME);
    if(error){
      if(error.code==='PGRST205'||error.code==='42P01')return stop('Карта ещё не подключена','В базе нет таблицы карты. Запустите файл factory-map/setup.sql в Supabase.',[backHome]);
      return stop('Карта не загрузилась',error.message,[reload,backHome]);
    }
    if(data.length){
      version=data[0].version;
      return{db:NAME,data:data[0].data};
    }
    const admin=await client.rpc('is_admin');
    if(admin.error||admin.data!==true)return stop('Нет доступа','Карта фабрик открыта только администратору ULA Factory.',[backHome]);
    return askImport();
  }

  async function save(body){
    validate(body);
    body.updatedAt=new Date().toISOString().slice(0,10);
    const{data,error}=await client.from(TABLE).update({data:body,version:version+1}).eq('name',NAME).eq('version',version).select('version');
    if(error)throw Error(error.message);
    if(data.length){
      version=data[0].version;
      return{ok:true,updatedAt:body.updatedAt};
    }
    // Запись не прошла: либо данные уже новее, либо доступ закончился.
    const now=await client.from(TABLE).select('version').eq('name',NAME);
    if(now.data?.length&&now.data[0].version!==version){
      showScreen('Карта уже изменилась','Данные изменили в другой вкладке или на другом устройстве. Последняя правка не сохранена. Обновите страницу и повторите её.',[reload]);
      throw Error('данные уже изменились');
    }
    showScreen('Нужен вход','Доступ закончился. Последняя правка не сохранена. Войдите в ULA Factory как администратор.',[backHome]);
    throw Error('нет доступа');
  }

  window.FACTORY_MAP_REMOTE={request:(method,body)=>method==='PUT'?save(body):load()};

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
