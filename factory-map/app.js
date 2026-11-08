if(location.protocol==='file:')location.replace('http://127.0.0.1:4173/');

/* ---------- Утилиты ---------- */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{const v=String(u||'').trim();return /^https?:\/\//i.test(v)?v:''};
const today=()=>new Date().toISOString().slice(0,10);
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone=()=>matchMedia('(max-width:800px)').matches;
const chevron='<svg class="icon chevron"><use href="#i-next"/></svg>';

function toast(text){
  const el=$('#toast');
  el.textContent=text;
  el.style.display='block';
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>{el.style.display='none'},2600);
}

/* ---------- Справочники ---------- */
const STATUS_LABELS={not_started:'Изучение ещё не началось',collecting:'Идёт сбор данных',mapped:'Основные производства нанесены',complete:'План изучения выполнен'};
const STATUS_DOT={not_started:'gray',collecting:'yellow',mapped:'blue',complete:'green'};
const NEWS_THEMES={official:'Официальное объявление',logistics:'Логистика',exhibition:'Фабрики и выставки',work:'Моя работа'};
const TERM_GROUPS=[['毛衣','毛织','针织','свитер','трикотаж','кардиган','knit','sweater']];
const ACCENT='#ff6a3d'; // оранжевый из логотипа ULA Factory

// Ключи совпадают с shapeName в data/geo/china-adm1.geojson (Гуандун там подписан как Guangzhou Province).
const PROVINCES={
  'Anhui Province':{ru:'Аньхой',cn:'安徽',en:'Anhui'},
  'Beijing Municipality':{ru:'Пекин',cn:'北京',en:'Beijing'},
  'Chongqing Municipality':{ru:'Чунцин',cn:'重庆',en:'Chongqing'},
  'Fujian Province':{ru:'Фуцзянь',cn:'福建',en:'Fujian'},
  'Gansu Province':{ru:'Ганьсу',cn:'甘肃',en:'Gansu'},
  'Guangxi Zhuang Autonomous Region':{ru:'Гуанси',cn:'广西',en:'Guangxi'},
  'Guangzhou Province':{ru:'Гуандун',cn:'广东',en:'Guangdong'},
  'Guizhou Province':{ru:'Гуйчжоу',cn:'贵州',en:'Guizhou'},
  'Hainan Province':{ru:'Хайнань',cn:'海南',en:'Hainan'},
  'Hebei Province':{ru:'Хэбэй',cn:'河北',en:'Hebei'},
  'Heilongjiang Province':{ru:'Хэйлунцзян',cn:'黑龙江',en:'Heilongjiang'},
  'Henan Province':{ru:'Хэнань',cn:'河南',en:'Henan'},
  'Hong Kong Special Administrative Region':{ru:'Гонконг',cn:'香港',en:'Hong Kong'},
  'Hubei Province':{ru:'Хубэй',cn:'湖北',en:'Hubei'},
  'Hunan Province':{ru:'Хунань',cn:'湖南',en:'Hunan'},
  'Inner Mongolia Autonomous Region':{ru:'Внутренняя Монголия',cn:'内蒙古',en:'Inner Mongolia'},
  'Jiangsu Province':{ru:'Цзянсу',cn:'江苏',en:'Jiangsu'},
  'Jiangxi Province':{ru:'Цзянси',cn:'江西',en:'Jiangxi'},
  'Jilin Province':{ru:'Цзилинь',cn:'吉林',en:'Jilin'},
  'Liaoning Province':{ru:'Ляонин',cn:'辽宁',en:'Liaoning'},
  'Macau Special Administrative Region':{ru:'Макао',cn:'澳门',en:'Macau'},
  'Ningxia Ningxia Hui Autonomous Region':{ru:'Нинся',cn:'宁夏',en:'Ningxia'},
  'Qinghai Province':{ru:'Цинхай',cn:'青海',en:'Qinghai'},
  'Shaanxi Province':{ru:'Шэньси',cn:'陕西',en:'Shaanxi'},
  'Shandong Province':{ru:'Шаньдун',cn:'山东',en:'Shandong'},
  'Shanghai Municipality':{ru:'Шанхай',cn:'上海',en:'Shanghai'},
  'Shanxi Province':{ru:'Шаньси',cn:'山西',en:'Shanxi'},
  'Sichuan Province':{ru:'Сычуань',cn:'四川',en:'Sichuan'},
  'Taiwan Province':{ru:'Тайвань',cn:'台湾',en:'Taiwan'},
  'Tianjin Municipality':{ru:'Тяньцзинь',cn:'天津',en:'Tianjin'},
  'Tibet Autonomous Region':{ru:'Тибет',cn:'西藏',en:'Tibet'},
  'Xinjiang Uyghur Autonomous Region':{ru:'Синьцзян',cn:'新疆',en:'Xinjiang'},
  'Yunnan Province':{ru:'Юньнань',cn:'云南',en:'Yunnan'},
  'Zhejiang Province':{ru:'Чжэцзян',cn:'浙江',en:'Zhejiang'}
};

/* ---------- Состояние ---------- */
const dbName=new URLSearchParams(location.search).get('db')||'main';
const STATE_KEY=`china-map-state-v2:${dbName}`;
const STACK_LIMIT=40;

let db,map,provinceLayer,pinLayer,baseLayer;
let cities=[];                    // Города базы + справочник data/china-cities.json
let allAreas=[];                  // Районы базы + справочник data/china-districts.json
const provinceLayers={};
let pins=[];
let nav={level:'china'};          // Единственный источник правды о том, где находится пользователь
let stack=[];                     // История для «Назад»: {nav, view}
let sheetOpen=true;
let searchQuery='';
let searchOrigin=null;            // Вид карты до начала поиска
let searchFitTimer=null;
let pickHandler=null;             // Режим «Поставить точку» для фабрики
let transient=null;               // Временная панель: результаты «рядом», «в области»
let filters={product:'',status:'',visits:false};
let moving=false;
let pendingMove=null;
let pickingPoint=false;
let workPoint=null,workPointLayer=null;
let importRows=[],importedNews=[];
let lastMapWidth=0;

/* ---------- Данные ---------- */
const areaById=id=>allAreas.find(a=>a.id===id);
const cityById=id=>cities.find(c=>c.id===id);
const factoryById=id=>db.factories.find(f=>f.id===id);
const areaCityId=a=>a.city||db.cities[0]?.id||null;
const provinceKeyByRu=ru=>Object.keys(PROVINCES).find(k=>PROVINCES[k].ru===ru)||null;
const citiesOf=key=>cities.filter(c=>provinceKeyByRu(c.province)===key);
const areasOf=cityId=>allAreas.filter(a=>areaCityId(a)===cityId);
const hasStudiedAreas=cityId=>areasOf(cityId).some(a=>!a.ref);
const shortCn=s=>String(s||'').replace(/(镇|市|省)$/,'');
// Короткое имя для метки: без города, района и общих слов, чтобы на карте читалось отличие фабрик.
function shortName(s){
  const full=String(s||'').replace(/,?\s*(Co\.?,?\s*Ltd\.?|有限公司)\s*$/i,'').trim();
  if(/[一-鿿]/.test(full)){
    let cn=full.replace(/[（(].*?[)）]/g,'').replace(/^[一-鿿]{2,3}市/,'');
    const town=allAreas.map(a=>String(a.cn||'').replace(/(街道|镇|区|县|市)$/,'')).find(t=>t.length>=2&&cn.startsWith(t)&&cn.length>t.length+2);
    if(town)cn=cn.slice(town.length);
    return cn.length>12?cn.slice(0,11)+'…':cn;
  }
  const places=new Set([...cities.map(c=>(c.en||'').toLowerCase()),...allAreas.map(a=>(a.en||a.id).toLowerCase())]);
  const words=full.split(/\s+/);
  while(words.length>1&&places.has(words[0].toLowerCase()))words.shift();
  const v=words.join(' ').replace(/\s+(High-End\s+)?(Apparel|Clothing|Garments?|Knitted|Knitwear|Knitting|Factory|Trading)\b.*$/i,'').trim()||full;
  return v.length>18?v.slice(0,17)+'…':v;
}
const visitFor=id=>db.visits.find(v=>v.factoryId===id&&v.status!=='removed');

// Точка на карте только при реальных координатах в пределах Китая. Район не подменяет координаты фабрики.
function coordsOf(f){
  if(f.lat==null||f.lat===''||f.lng==null||f.lng==='')return null;
  const lat=+f.lat,lng=+f.lng;
  return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=15&&lat<=54&&lng>=73&&lng<=136?[lat,lng]:null;
}

const provinceFromText=text=>Object.keys(PROVINCES).find(k=>text.includes(PROVINCES[k].cn)||new RegExp(`\\b${PROVINCES[k].en}\\b`,'i').test(text))||null;

// Город определяется по адресу только при однозначном совпадении (есть две Сучжоу и две Тайчжоу).
const cityMemo=new Map();
function cityFromAddress(text){
  if(!text)return null;
  if(cityMemo.has(text))return cityMemo.get(text);
  const province=provinceFromText(text);
  const found=cities.filter(c=>(!province||provinceKeyByRu(c.province)===province)&&(text.includes(shortCn(c.cn))||(c.en&&new RegExp(`\\b${c.en}\\b`,'i').test(text))));
  const id=found.length===1?found[0].id:null;
  cityMemo.set(text,id);
  return id;
}

// Район определяется по адресу так же осторожно: только одно совпадение внутри города фабрики.
// Название улицы вроде Nanshan Road районом не считается.
const areaMemo=new Map();
function areaFromAddress(text,cityId){
  const key=`${cityId}|${text}`;
  if(areaMemo.has(key))return areaMemo.get(key);
  const found=areasOf(cityId).filter(a=>{
    const cn=shortCn(a.cn),en=a.en||(a.ref?'':a.id);
    return new RegExp(`${cn}(区|县|镇|市|街道)`).test(text)||(cn.length>=3&&text.includes(cn))||(en&&new RegExp(`\\b${en}\\b(?!\\s+(Road|Rd|Street|St|Avenue|Ave|Lu)\\b)`,'i').test(text));
  });
  const id=found.length===1?found[0].id:null;
  areaMemo.set(key,id);
  return id;
}

function factoryAreaId(f){
  if(areaById(f.area))return f.area;
  const city=cityFromAddress(f.address_cn);
  return city?areaFromAddress(f.address_cn,city):null;
}

const areaOfFactory=f=>areaById(factoryAreaId(f));

function factoryCityId(f){
  const area=areaById(f.area);
  return area?areaCityId(area):cityFromAddress(f.address_cn);
}

const factoriesOfCity=id=>db.factories.filter(f=>factoryCityId(f)===id);

function factoryProvince(f){
  const city=cityById(factoryCityId(f));
  if(city)return provinceKeyByRu(city.province);
  return provinceFromText(f.address_cn||'');
}

function cityCenter(c){
  if(c.lat!=null)return[c.lat,c.lng];
  return L.latLngBounds(areasOf(c.id).map(a=>[a.lat,a.lng])).getCenter();
}

async function loadCities(){
  cities=[...db.cities];
  try{
    const ref=await fetch(`${serverBase}/data/china-cities.json`).then(r=>r.json());
    const seen=new Set();
    const list=Object.entries(ref).flatMap(([province,rows])=>rows.map(([cn,ru,en,lat,lng])=>{
      let id=en.toLowerCase().replace(/[^a-z]/g,'');
      if(seen.has(id))id+=`-${PROVINCES[provinceKeyByRu(province)].en.toLowerCase().replace(/[^a-z]/g,'')}`;
      seen.add(id);
      return{id,ru,cn,en,lat,lng,province};
    }));
    // Запись из базы главнее справочника, справочник только дополняет её центром города.
    cities=[...list.map(c=>({...c,...db.cities.find(x=>x.id===c.id)})),...db.cities.filter(x=>!list.some(c=>c.id===x.id))];
  }catch(e){console.warn('Справочник городов не загружен',e)}
}

// Объекты районов из базы не копируются: изменения их статуса по-прежнему попадают в базу.
async function loadAreas(){
  allAreas=[...db.areas];
  try{
    const ref=await fetch(`${serverBase}/data/china-districts.json`).then(r=>r.json());
    Object.entries(ref).forEach(([city,rows])=>rows.forEach(([cn,ru,en,lat,lng])=>{
      if(!cityById(city)||areasOf(city).some(a=>shortCn(a.cn)===cn))return;
      allAreas.push({id:`${city}-${en.toLowerCase()}`,ru,cn,en,lat,lng,city,ref:true});
    }));
  }catch(e){console.warn('Справочник районов не загружен',e)}
}

function statusInfo(status){
  if(status==='посещена лично')return{label:'Посещена лично',cls:'green'};
  if(status==='производство подтверждено источниками')return{label:'Подтверждено источниками',cls:'blue'};
  return{label:'Кандидат',cls:'orange'};
}

function productTerms(q){
  const key=q.toLowerCase().trim();
  if(!key)return[];
  const group=TERM_GROUPS.find(g=>g.some(t=>key.includes(t)||(key.length>=2&&t.startsWith(key))));
  return group?[...new Set([key,...group])]:[key];
}

function listMatch(f){
  const terms=productTerms(filters.product);
  const text=Object.values(f).join(' ').toLowerCase();
  return(!terms.length||terms.some(t=>text.includes(t)))&&(!filters.status||f.status===filters.status)&&(!filters.visits||!!visitFor(f.id));
}

function counts(areaId){
  const list=db.factories.filter(f=>factoryAreaId(f)===areaId);
  return{found:list.length,verified:list.filter(f=>f.status!=='кандидат').length,planned:list.filter(f=>visitFor(f.id)?.status==='planned').length};
}

/* ---------- База ---------- */
const serverBase=location.protocol==='file:'?'http://127.0.0.1:4173':'.';

async function api(method='GET',body){
  if(window.FACTORY_MAP_REMOTE)return window.FACTORY_MAP_REMOTE.request(method,body);
  const res=await fetch(`${serverBase}/api/data?db=${encodeURIComponent(dbName)}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Ошибка базы');
  return data;
}

async function save(note){
  db.logs.unshift({date:today(),text:note});
  try{
    await api('PUT',db);
    toast('Сохранено');
    return true;
  }catch(e){
    db.logs.shift();
    toast('Не сохранено: '+e.message);
    return false;
  }
}

/* ---------- Навигация ---------- */
const toChina=()=>({level:'china'});
const toProvince=key=>({level:'province',province:key});
const toCity=id=>({level:'city',province:provinceKeyByRu(cityById(id).province),city:id});
function toArea(id){
  const cityId=areaCityId(areaById(id)),city=cityById(cityId);
  return{level:'area',province:city?provinceKeyByRu(city.province):null,city:cityId,area:id};
}
function toFactory(id){
  const f=factoryById(id);
  const areaId=factoryAreaId(f);
  return areaId?{...toArea(areaId),level:'factory',factory:id}:{level:'factory',province:factoryProvince(f),city:factoryCityId(f),area:null,factory:id};
}

function rebuildNav(n){
  if(n?.level==='factory'&&factoryById(n.factory))return toFactory(n.factory);
  if(n?.level==='area'&&areaById(n.area))return toArea(n.area);
  if(n?.level==='city'&&cityById(n.city))return toCity(n.city);
  if(n?.level==='province'&&PROVINCES[n.province])return toProvince(n.province);
  return toChina();
}

const sameNav=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validView=v=>v&&Number.isFinite(v.lat)&&Number.isFinite(v.lng)&&Number.isFinite(v.zoom)?v:null;

function currentView(){
  if(!map||moving)return null;
  const c=map.getCenter();
  return validView({lat:c.lat,lng:c.lng,zoom:map.getZoom()});
}

function clearOverlayPanels(){
  searchQuery='';
  $('#globalSearch').value='';
  searchOrigin=null;
  transient=null;
}

function navigate(next,{record=true}={}){
  const origin=searchOrigin;
  cancelPicking();
  clearOverlayPanels();
  sheetOpen=true;
  if(!sameNav(next,nav)){
    if(record){
      stack.push({nav,view:origin||currentView()});
      if(stack.length>STACK_LIMIT)stack.shift();
    }
    nav=next;
  }
  renderNav();
  // Пока карта летит к новому месту, старый вид сохранять нельзя: перезагрузка показала бы не то место.
  moveForNav();
  persist.view=null;
  persist();
}

function goBack(){
  if(cancelPicking()){
    renderNav();
    return;
  }
  if(searchQuery||transient){
    const origin=searchOrigin;
    clearOverlayPanels();
    renderNav();
    if(origin)flyToView(origin);
    return;
  }
  const previous=stack.pop();
  if(!previous)return;
  nav=previous.nav;
  sheetOpen=true;
  renderNav();
  if(previous.view)flyToView(previous.view);
  else moveForNav();
  persist.view=previous.view;
  persist();
}

function persist(){
  if(!map)return;
  const view=currentView();
  if(view&&!searchQuery)persist.view=view;
  try{
    localStorage.setItem(STATE_KEY,JSON.stringify({v:2,nav,view:persist.view||null,stack,sheetOpen,filters}));
  }catch{}
}

function restoreState(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{}
  if(!saved||saved.v!==2)return null;
  nav=rebuildNav(saved.nav);
  stack=(Array.isArray(saved.stack)?saved.stack:[]).slice(-STACK_LIMIT).map(e=>({nav:rebuildNav(e.nav),view:validView(e.view)}));
  sheetOpen=saved.sheetOpen!==false;
  filters={...filters,...saved.filters};
  persist.view=validView(saved.view);
  return persist.view;
}

/* ---------- Движение карты ---------- */
// Какая часть карты закрыта панелями: выбранное место должно оказаться в открытой части.
function insets(){
  const size=map.getSize();
  const top=$('#chrome').getBoundingClientRect().bottom+10;
  if(isPhone()){
    // Шторка на телефоне начинается от нижнего края, плавающее меню лежит поверх неё.
    const menuHeight=innerHeight-$('#tabbar').getBoundingClientRect().top+6;
    const covered=sheetOpen?$('#sheet').offsetHeight:76+menuHeight;
    return{top,left:0,right:0,bottom:Math.min(covered+10,Math.max(0,size.y-top-120))};
  }
  return{top,left:60,right:$('#sheet').offsetWidth+32,bottom:84};
}

function whenMapReady(run){
  const size=map.getSize();
  if(!size.x||!size.y){pendingMove=run;return}
  if(map._animatingZoom){map.once('zoomend',()=>whenMapReady(run));return}
  map.stop();
  run();
}

const animateOption=()=>!reduceMotion()&&!document.hidden;

function flyToView(view){
  whenMapReady(()=>map.flyTo([view.lat,view.lng],view.zoom,{animate:animateOption(),duration:.45}));
}

function focusPoint(latlng,zoom,animate=animateOption()){
  whenMapReady(()=>{
    const i=insets();
    const offset=L.point((i.right-i.left)/2,(i.bottom-i.top)/2);
    const center=map.unproject(map.project(latlng,zoom).add(offset),zoom);
    map.flyTo(center,zoom,{animate,duration:.5});
  });
}

function focusBounds(bounds,maxZoom,animate=animateOption()){
  whenMapReady(()=>{
    const i=insets();
    map.flyToBounds(bounds,{animate,duration:.5,maxZoom,paddingTopLeft:[i.left+24,i.top+16],paddingBottomRight:[i.right+24,i.bottom+16]});
  });
}

function moveForNav(animate=animateOption()){
  const province=nav.province&&provinceLayers[nav.province]?.getBounds();
  if(nav.level==='china')return focusBounds(provinceLayer.getBounds(),undefined,animate);
  if(nav.level==='province')return focusBounds(province,undefined,animate);
  if(nav.level==='city'){
    const points=[...areasOf(nav.city).map(a=>[a.lat,a.lng]),...factoriesOfCity(nav.city).map(coordsOf).filter(Boolean)];
    if(points.length>1)return focusBounds(L.latLngBounds(points).pad(.12),11.5,animate);
    return focusPoint(points[0]||cityCenter(cityById(nav.city)),10.75,animate);
  }
  if(nav.level==='area'){
    const a=areaById(nav.area);
    return focusPoint([a.lat,a.lng],13,animate);
  }
  const c=coordsOf(factoryById(nav.factory));
  if(c)return focusPoint(c,16,animate);
  if(nav.area){
    const a=areaById(nav.area);
    return focusPoint([a.lat,a.lng],13,animate);
  }
  if(nav.city)return focusPoint(cityCenter(cityById(nav.city)),10.75,animate);
  if(province)focusBounds(province,undefined,animate);
}

function focusLatLng(){
  if(nav.level==='factory'){
    const c=coordsOf(factoryById(nav.factory));
    if(c)return c;
  }
  if(nav.area){
    const a=areaById(nav.area);
    return[a.lat,a.lng];
  }
  if(nav.level==='factory'&&nav.city)return cityCenter(cityById(nav.city));
  return null;
}

function keepFocusVisible(animate=animateOption()){
  const latlng=focusLatLng();
  if(!latlng||moving)return;
  const p=map.latLngToContainerPoint(latlng),s=map.getSize(),i=insets(),m=44;
  let dx=0,dy=0;
  if(p.x<i.left+m)dx=p.x-(i.left+m);else if(p.x>s.x-i.right-m)dx=p.x-(s.x-i.right-m);
  if(p.y<i.top+m)dy=p.y-(i.top+m);else if(p.y>s.y-i.bottom-m)dy=p.y-(s.y-i.bottom-m);
  if(dx||dy)map.panBy([dx,dy],{animate});
}

function onMapResize(){
  if(!map)return;
  map.invalidateSize({animate:false});
  syncChromeHeight();
  const size=map.getSize();
  if(pendingMove&&size.x&&size.y){
    const run=pendingMove;
    pendingMove=null;
    run();
  }else if(lastMapWidth&&Math.abs(size.x-lastMapWidth)>40){
    keepFocusVisible(false);
  }
  lastMapWidth=size.x;
  declutterPins();
}

/* ---------- Карта и метки ---------- */
function provinceHasData(key){
  return db.cities.some(c=>provinceKeyByRu(c.province)===key)||db.factories.some(f=>factoryProvince(f)===key);
}

// Подложка с улицами нужна только при приближении: на уровне страны хватает контуров провинций.
const showsStreets=()=>nav.level!=='china'||!!searchQuery;

function syncBaseLayer(){
  if(showsStreets())baseLayer.addTo(map);
  else baseLayer.remove();
}

function provinceStyle(key){
  const selected=nav.province===key;
  if(selected&&!searchQuery)return{className:'province',color:ACCENT,weight:2,opacity:1,fillColor:ACCENT,fillOpacity:nav.level==='province'?.07:.02};
  if(showsStreets())return{className:'province',color:'#ffffff',weight:1,opacity:.9,fillColor:'#eceef2',fillOpacity:searchQuery?.2:.62};
  return{className:'province',color:'#ffffff',weight:1.2,opacity:1,fillColor:provinceHasData(key)?'#ffcdbb':'#dcdfe5',fillOpacity:1};
}

const provincesClickable=()=>nav.level==='china'||nav.level==='province';

async function initMap(){
  map=L.map('leafletMap',{zoomControl:false,attributionControl:false,zoomSnap:.25,minZoom:2.5,maxZoom:18}).setView([35,104],4);
  L.control.zoom({position:'bottomleft',zoomInTitle:'Приблизить',zoomOutTitle:'Отдалить'}).addTo(map);
  L.control.attribution({position:'topleft',prefix:false}).addTo(map);
  baseLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'});
  const geo=await fetch(`${serverBase}/data/geo/china-adm1.geojson`).then(r=>r.json());
  provinceLayer=L.geoJSON(geo,{
    style:f=>provinceStyle(f.properties.shapeName),
    onEachFeature:(feature,layer)=>{
      const key=feature.properties.shapeName,p=PROVINCES[key]||{ru:key,cn:''};
      provinceLayers[key]=layer;
      layer.bindTooltip(`${p.ru} · ${p.cn}`,{sticky:true});
      layer.on({
        mouseover:()=>{if(provincesClickable()&&nav.province!==key)layer.setStyle({fillColor:'#ffb49b',fillOpacity:showsStreets()?.45:1})},
        mouseout:()=>layer.setStyle(provinceStyle(key)),
        click:()=>{
          if(pickingPoint||!provincesClickable())return;
          navigate(toProvince(key));
        }
      });
    }
  }).addTo(map);
  pinLayer=L.layerGroup().addTo(map);
  map.on('movestart',()=>{moving=true});
  map.on('moveend',()=>{moving=false;persist();declutterPins()});
  map.on('zoomend',declutterPins);
  new ResizeObserver(onMapResize).observe($('#leafletMap'));
  lastMapWidth=map.getSize().x;
}

function addPin(latlng,{title,sub,count,selected,dot,kind='',label,minor=false,noDot=false,start=null,align=0,noLeader=false},onClick){
  const html=`<i class="pin-leader"></i><i class="pin-point"></i><div class="pin ${kind} ${selected?'selected':''}">${dot?`<i class="status-dot ${dot}"></i>`:''}<span class="pin-text"><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span>${count!=null?`<em>${esc(count)}</em>`:''}</div>`;
  const rootClass=`pin-root${minor?' minor':''}${noDot?' no-dot':''}`;
  const marker=L.marker(latlng,{icon:L.divIcon({className:rootClass,html,iconSize:[0,0]}),title:label||title,zIndexOffset:selected?2000:minor?-1000:0}).addTo(pinLayer);
  marker.on('click',onClick);
  const root=marker.getElement();
  root.setAttribute('aria-label',label||title);
  pins.push({latlng:L.latLng(latlng),el:root.querySelector('.pin'),leader:root.querySelector('.pin-leader'),selected:!!selected,minor,noDot,start,align,noLeader});
}

// Центр самой большой части провинции: острова не смещают подпись.
const anchorMemo={};
function provinceAnchor(key){
  if(anchorMemo[key])return anchorMemo[key];
  let best=null,bestArea=0;
  const walk=x=>{
    if(!Array.isArray(x[0])){
      let area=0,cx=0,cy=0;
      x.forEach((p,i)=>{
        const q=x[(i+1)%x.length],cross=p.lng*q.lat-q.lng*p.lat;
        area+=cross;cx+=(p.lng+q.lng)*cross;cy+=(p.lat+q.lat)*cross;
      });
      if(Math.abs(area)>bestArea){bestArea=Math.abs(area);best=[cy/(3*area),cx/(3*area)]}
      return;
    }
    x.forEach(walk);
  };
  walk(provinceLayers[key].getLatLngs());
  return anchorMemo[key]=best||provinceLayers[key].getBounds().getCenter();
}

function renderChinaPins(){
  Object.keys(PROVINCES).forEach(key=>{
    const p=PROVINCES[key];
    if(!provinceHasData(key)){
      addPin(provinceAnchor(key),{title:p.ru,kind:'place-label',minor:true,noDot:true,label:`${p.ru} · ${p.cn}`},()=>navigate(toProvince(key)));
      return;
    }
    const count=db.factories.filter(f=>factoryProvince(f)===key&&listMatch(f)).length;
    addPin(provinceAnchor(key),{title:p.cn,sub:p.ru,count,label:`${p.ru}: ${count} фабрик`},()=>navigate(toProvince(key)));
  });
}

function renderProvincePins(){
  citiesOf(nav.province).forEach(c=>{
    const all=factoriesOfCity(c.id);
    if(!all.length&&!hasStudiedAreas(c.id)){
      addPin(cityCenter(c),{title:c.ru,kind:'place-label',minor:true,label:`${c.ru} · ${shortCn(c.cn)}: фабрик в базе нет`},()=>navigate(toCity(c.id)));
      return;
    }
    const count=all.filter(listMatch).length;
    addPin(cityCenter(c),{title:shortCn(c.cn),sub:c.ru,count,dot:STATUS_DOT[c.status],label:`${c.ru}: ${count} фабрик`},()=>navigate(toCity(c.id)));
  });
}

const CHIP_ROW=52;

// Фабрики без точного адреса стоят ровными колонками рядом с районом. Что не помещается, остаётся в списке.
function addApproxChips(anchor,list){
  const size=map.getSize(),area=insets();
  const rows=Math.max(3,Math.floor((size.y-area.top-area.bottom-16)/CHIP_ROW));
  const twoColumns=size.x-area.left-area.right>=560;
  const capacity=twoColumns?rows*2:rows-1;
  const overflow=list.length>capacity;
  const shown=overflow?[...list].sort((a,b)=>(b.id===nav.factory)-(a.id===nav.factory)).slice(0,capacity-1):list;
  const total=shown.length+(overflow?1:0),above=Math.floor(total/2);
  const slot=i=>{
    if(!twoColumns)return{start:[0,(i<above?i-above:i-above+1)*CHIP_ROW],align:0};
    const side=i%2?-1:1,inColumn=i%2?above:total-above;
    return{start:[side*92,(Math.floor(i/2)-(inColumn-1)/2)*CHIP_ROW],align:side};
  };
  shown.forEach((f,i)=>{
    addPin(anchor,{title:`≈ ${shortName(f.company_cn)}`,kind:'factory-pin approx',selected:nav.factory===f.id,noDot:true,noLeader:true,...slot(i),label:`${f.company_cn}: точный адрес не подтверждён`},()=>navigate(toFactory(f.id)));
  });
  if(overflow){
    const rest=list.length-shown.length;
    addPin(anchor,{title:`+${rest} в списке`,kind:'factory-pin approx',noDot:true,noLeader:true,...slot(shown.length),label:`Ещё ${rest} фабрик в списке`},()=>setSheet(true));
  }
}

// На уровне города видны только районы. Фабрики района появляются после выбора района.
function renderCityPins(){
  const city=cityById(nav.city),scope=factoriesOfCity(nav.city).filter(f=>listMatch(f)||f.id===nav.factory);
  const areas=areasOf(nav.city),selectedFactory=nav.level==='factory'?factoryById(nav.factory):null;
  areas.forEach(a=>{
    const count=scope.filter(f=>factoryAreaId(f)===a.id).length;
    const current=nav.area===a.id;
    const noExactPoint=selectedFactory&&!coordsOf(selectedFactory)&&current;
    if(!current&&(!count||nav.area)){
      addPin([a.lat,a.lng],{title:count?`${shortCn(a.cn)} · ${count}`:shortCn(a.cn),kind:'place-label',minor:true,label:`${a.ru} ${a.cn}: ${count?`${count} фабрик`:'фабрик нет'}`},()=>navigate(toArea(a.id)));
      return;
    }
    addPin([a.lat,a.lng],{title:shortCn(a.cn),sub:noExactPoint?'показан только район':a.ru,count,dot:STATUS_DOT[a.status],selected:nav.level==='area'&&nav.area===a.id,label:`${a.ru} ${a.cn}: ${count} фабрик`},()=>navigate(toArea(a.id)));
  });
  if(!areas.length){
    addPin(cityCenter(city),{title:shortCn(city.cn),sub:city.ru,count:scope.length,selected:nav.level==='city',label:`${city.ru}: ${scope.length} фабрик`},()=>navigate(toCity(city.id)));
  }
  const inView=scope.filter(f=>nav.area?factoryAreaId(f)===nav.area:!factoryAreaId(f));
  inView.filter(coordsOf).forEach(f=>{
    addPin(coordsOf(f),{title:shortName(f.company_cn),kind:'factory-pin',selected:nav.factory===f.id,label:f.company_cn},()=>navigate(toFactory(f.id)));
  });
  const groups=new Map();
  inView.filter(f=>!coordsOf(f)).forEach(f=>{
    const key=factoryAreaId(f)||'';
    groups.set(key,[...(groups.get(key)||[]),f]);
  });
  groups.forEach((list,key)=>{
    const a=areaById(key),anchor=a?[a.lat,a.lng]:cityCenter(city);
    L.circle(anchor,{radius:a?2500:9000,color:ACCENT,weight:1.5,dashArray:'4 6',fillColor:ACCENT,fillOpacity:.12,interactive:false}).addTo(pinLayer);
    addApproxChips(anchor,list);
  });
}

function searchHits(){
  const terms=productTerms(searchQuery);
  const has=text=>terms.some(t=>text.toLowerCase().includes(t));
  return{
    areas:allAreas.filter(a=>has(`${a.ru} ${a.cn} ${a.en||''} ${(a.industries||[]).join(' ')}`)),
    cities:cities.filter(c=>has(`${c.ru} ${c.cn} ${c.en||''}`)),
    factories:db.factories.filter(f=>has(Object.values(f).join(' ')))
  };
}

// Результаты поиска видны на карте: одна метка на район, город или провинцию.
function searchBuckets(){
  const hits=searchHits(),buckets=new Map();
  const put=(key,make,n)=>{
    const b=buckets.get(key)||{...make(),count:0};
    b.count+=n;
    buckets.set(key,b);
  };
  const forArea=a=>[`a:${a.id}`,()=>({latlng:[a.lat,a.lng],title:shortCn(a.cn),sub:a.ru,go:toArea(a.id)})];
  const forCity=c=>[`c:${c.id}`,()=>({latlng:cityCenter(c),title:shortCn(c.cn),sub:c.ru,go:toCity(c.id)})];
  hits.areas.forEach(a=>put(...forArea(a),0));
  hits.cities.forEach(c=>put(...forCity(c),0));
  hits.factories.forEach(f=>{
    const a=areaOfFactory(f),c=cityById(factoryCityId(f)),key=factoryProvince(f);
    if(a)put(...forArea(a),1);
    else if(c)put(...forCity(c),1);
    else if(key)put(`p:${key}`,()=>({latlng:provinceAnchor(key),title:PROVINCES[key].cn,sub:PROVINCES[key].ru,go:toProvince(key)}),1);
  });
  return[...buckets.values()];
}

function renderSearchPins(){
  searchBuckets().forEach(b=>addPin(b.latlng,{title:b.title,sub:b.sub,count:b.count||null,label:`${b.sub}: ${b.count} фабрик`},()=>navigate(b.go)));
}

function fitSearchResults(){
  if(!searchQuery)return;
  const points=searchBuckets().map(b=>b.latlng);
  if(points.length===1)focusPoint(points[0],10);
  else if(points.length)focusBounds(L.latLngBounds(points).pad(.25),11);
}

function renderLayers(){
  $('#mapScreen').classList.toggle('map-deep',!provincesClickable());
  syncBaseLayer();
  Object.keys(provinceLayers).forEach(k=>provinceLayers[k].setStyle(provinceStyle(k)));
  pinLayer.clearLayers();
  pins=[];
  if(searchQuery)renderSearchPins();
  else if(nav.level==='china')renderChinaPins();
  else if(nav.level==='province')renderProvincePins();
  else if(nav.city)renderCityPins();
  else if(nav.level==='factory'){
    const c=coordsOf(factoryById(nav.factory));
    if(c)addPin(c,{title:shortName(factoryById(nav.factory).company_cn),kind:'factory-pin',selected:true},()=>{setSheet(true)});
  }
  declutterPins();
}

// Близкие районы (大岭山 и 松山湖) разводятся на экране, чтобы по каждому можно было попасть пальцем.
function declutterPins(){
  if(!map||!pins.length)return;
  const size=map.getSize();
  if(!size.x||!size.y)return;
  const measured=pins.map(p=>{
    const point=map.latLngToContainerPoint(p.latlng),w=p.el.offsetWidth+8,h=p.el.offsetHeight+8;
    return{pin:p,x:point.x+(p.start?.[0]||0)+p.align*w/2,y:point.y+(p.start?.[1]||0),ox:point.x,oy:point.y,w,h};
  });
  const items=measured.filter(item=>!item.pin.minor);
  // Метки на видимой части карты не должны уходить под панели.
  const area=insets(),minX=area.left+4,maxX=size.x-area.right-4,minY=area.top,maxY=size.y-area.bottom;
  const onScreen=item=>item.ox>=minX-60&&item.ox<=maxX+60&&item.oy>=minY-60&&item.oy<=maxY+60;
  const clampItem=item=>{
    const x=Math.min(Math.max(item.x,minX+item.w/2),maxX-item.w/2);
    const y=Math.min(Math.max(item.y,minY+item.h/2),maxY-item.h/2);
    const moved=Math.abs(x-item.x)>.5||Math.abs(y-item.y)>.5;
    item.x=x;
    item.y=y;
    return moved;
  };
  for(let pass=0;pass<80;pass++){
    let changed=false;
    items.filter(onScreen).forEach(item=>{if(clampItem(item))changed=true});
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const a=items[i],b=items[j];
      const dx=b.x-a.x,dy=b.y-a.y;
      const overlapX=(a.w+b.w)/2-Math.abs(dx),overlapY=(a.h+b.h)/2-Math.abs(dy);
      if(overlapX<=0||overlapY<=0)continue;
      changed=true;
      const shareA=a.pin.selected?0:b.pin.selected?1:.5,shareB=1-shareA;
      if(overlapY<overlapX){
        const sign=dy>=0?1:-1;
        a.y-=sign*overlapY*shareA;
        b.y+=sign*overlapY*shareB;
      }else{
        const sign=dx>=0?1:-1;
        a.x-=sign*overlapX*shareA;
        b.x+=sign*overlapX*shareB;
      }
    }
    if(!changed)break;
  }
  items.forEach(({pin,x,y,ox,oy})=>{
    const dx=x-ox,dy=y-oy,length=Math.hypot(dx,dy);
    pin.el.style.transform=`translate(-50%,-50%) translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    pin.leader.style.width=length>10&&!pin.noLeader?`${length.toFixed(1)}px`:'0';
    pin.leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
  });
  // Второстепенные подписи не двигаются: как на обычной карте, лишние скрываются до приближения.
  const placed=items.map(({x,y,w,h})=>({x,y,w,h}));
  measured.filter(item=>item.pin.minor).forEach(({pin,ox,oy,w,h})=>{
    const lift=pin.noDot?0:-(h/2+3);
    const box={x:ox,y:oy+lift,w,h};
    const hidden=placed.some(p=>Math.abs(p.x-box.x)<(p.w+box.w)/2&&Math.abs(p.y-box.y)<(p.h+box.h)/2);
    pin.el.classList.toggle('label-hidden',hidden);
    pin.el.style.transform=`translate(-50%,-50%) translate(0,${lift.toFixed(1)}px)`;
    if(!hidden)placed.push(box);
  });
}

/* ---------- Верхняя панель ---------- */
function renderCrumbs(){
  const parts=[{label:'Китай',action:'china'}];
  if(nav.province)parts.push({label:PROVINCES[nav.province].ru,action:'province',id:nav.province});
  if(nav.city)parts.push({label:cityById(nav.city).ru,action:'city',id:nav.city});
  if(nav.area)parts.push({label:shortCn(areaById(nav.area).cn),action:'area',id:nav.area});
  if(nav.level==='factory')parts.push({label:shortName(factoryById(nav.factory).company_cn),action:'factory',id:nav.factory});
  const el=$('#breadcrumbs');
  el.innerHTML=parts.map((p,i)=>`${i?'<span class="crumb-sep" aria-hidden="true">›</span>':''}<button type="button" data-action="${p.action}" data-id="${esc(p.id||'')}" ${i===parts.length-1?'aria-current="location"':''}>${esc(p.label)}</button>`).join('');
  el.scrollLeft=el.scrollWidth;
}

function syncChromeHeight(){
  $('#mapScreen').style.setProperty('--chrome-bottom',`${Math.round($('#chrome').getBoundingClientRect().bottom)}px`);
}

function renderBack(){
  $('#backBtn').disabled=!stack.length&&!searchQuery&&!transient&&!pickHandler;
}

function renderFilterBadge(){
  const n=[filters.product,filters.status,filters.visits].filter(Boolean).length;
  const el=$('#filterCount');
  el.hidden=!n;
  el.textContent=n||'';
}

function applySheet(){
  const sheet=$('#sheet');
  sheet.classList.toggle('collapsed',!sheetOpen);
  $('#sheetToggle').textContent=sheetOpen?'Свернуть':'Развернуть';
}

function setSheet(open){
  sheetOpen=open;
  applySheet();
  persist();
  setTimeout(()=>{
    if(open)keepFocusVisible();
    if(isPhone()){
      if(!open&&nav.level==='area')moveForNav();
      renderLayers();
    }else declutterPins();
  },320);
}

function renderNav(){
  syncChromeHeight();
  renderCrumbs();
  renderBack();
  renderFilterBadge();
  renderPanel();
  applySheet();
  renderLayers();
}

/* ---------- Панель: карточка справа или снизу ---------- */
function row({action,id,title,sub,count,badge,cls=''}){
  return `<button type="button" class="row ${cls}" data-action="${action}" data-id="${esc(id)}"><span class="row-main"><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span>${badge?`<span class="badge ${badge.cls}">${esc(badge.label)}</span>`:''}${count!=null?`<span class="count">${esc(count)}</span>`:''}${chevron}</button>`;
}

function factoryRow(f,extraSub=''){
  const sub=[String(f.product||'').split('/')[0].trim(),coordsOf(f)?'':'нет координат',extraSub].filter(Boolean).join(' · ');
  return row({action:'factory',id:f.id,title:f.company_cn,sub,badge:statusInfo(f.status)});
}

const group=(content,title)=>content?`${title?`<p class="group-title">${esc(title)}</p>`:''}<div class="group">${content}</div>`:'';
const stat=(value,label)=>`<div class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;

function chinaPanel(){
  const list=Object.keys(PROVINCES).filter(provinceHasData).map(key=>row({
    action:'province',id:key,title:`${PROVINCES[key].cn} ${PROVINCES[key].ru}`,
    sub:'Есть данные',count:db.factories.filter(f=>factoryProvince(f)===key&&listMatch(f)).length
  })).join('');
  const newsCount=db.news.length;
  const others=Object.keys(PROVINCES).filter(k=>!provinceHasData(k)).map(key=>row({action:'province',id:key,title:`${PROVINCES[key].cn} ${PROVINCES[key].ru}`})).join('');
  return{
    title:'Китай',
    sub:'Выберите провинцию на карте',
    html:group(list,'Провинции с данными')+`<details class="more"><summary>Все провинции</summary><div class="group">${others}</div></details>`+group(row({action:'page',id:'news',title:'Новости для бизнеса',count:newsCount}))
  };
}

const APPROX_LEGEND='<p class="approx-note"><i></i>Пунктир: точный адрес не подтверждён, показан только район или город.</p>';

function provincePanel(){
  const p=PROVINCES[nav.province],all=citiesOf(nav.province);
  const hasData=c=>factoriesOfCity(c.id).length>0||hasStudiedAreas(c.id);
  const active=all.filter(hasData).map(c=>{
    const n=areasOf(c.id).length;
    return row({action:'city',id:c.id,title:`${shortCn(c.cn)} ${c.ru}`,sub:n?`Районов: ${n}`:'Фабрики в базе',count:factoriesOfCity(c.id).filter(listMatch).length});
  }).join('');
  const rest=all.filter(c=>!hasData(c)).map(c=>row({action:'city',id:c.id,title:`${shortCn(c.cn)} ${c.ru}`})).join('');
  const unassigned=db.factories.filter(f=>!factoryCityId(f)&&factoryProvince(f)===nav.province&&listMatch(f));
  const restBlock=!rest?'':active?`<details class="more"><summary>Другие города</summary><div class="group">${rest}</div></details>`:group(rest,'Города');
  const body=group(active,'Города с фабриками')+restBlock+group(unassigned.map(f=>factoryRow(f)).join(''),`Город не определён · ${unassigned.length}`);
  return{title:p.cn,sub:all.length?`${p.ru} · городов: ${all.length}`:p.ru,html:body||'<p class="empty">Для этой провинции города пока не заведены.</p>'};
}

function cityPanel(){
  const city=cityById(nav.city),all=factoriesOfCity(nav.city),list=all.filter(listMatch);
  const hidden=all.length-list.length;
  const areaCount=a=>db.factories.filter(f=>factoryAreaId(f)===a.id&&listMatch(f)).length;
  const areaRow=a=>row({action:'area',id:a.id,title:`${shortCn(a.cn)} ${a.ru}`,sub:(a.industries||[]).slice(0,2).join(', '),count:areaCount(a)||null});
  const cityAreas=areasOf(nav.city);
  const main=cityAreas.filter(a=>areaCount(a)>0||!a.ref).sort((x,y)=>areaCount(y)-areaCount(x));
  const others=cityAreas.filter(a=>!main.includes(a));
  const areaBlock=group(main.map(areaRow).join(''),'Районы с данными')
    +(!others.length?'':main.length?`<details class="more"><summary>Другие районы · ${others.length}</summary><div class="group">${others.map(areaRow).join('')}</div></details>`:group(others.map(areaRow).join(''),'Районы'));
  const rowOf=f=>factoryRow(f,areaOfFactory(f)?shortCn(areaOfFactory(f).cn):'');
  const loose=list.filter(f=>!areaOfFactory(f)),placed=list.filter(f=>areaOfFactory(f));
  const none=hidden?'<p class="empty">Фабрики скрыты фильтрами.</p>'
    :`<p class="empty">В этом городе пока нет фабрик в базе.</p><div class="actions"><button type="button" class="primary" data-action="add-factory" data-id="${esc(city.id)}">Добавить фабрику</button></div>`;
  const factoryBlock=!list.length?none
    :!cityAreas.length?group(list.map(rowOf).join(''),`Фабрики · ${list.length}`)
    :group(loose.map(rowOf).join(''),`Район не определён · ${loose.length}`)
      +(placed.length?`<details class="more"><summary>Все фабрики города · ${placed.length}</summary><div class="group">${placed.map(rowOf).join('')}</div></details>`:'');
  return{
    title:shortCn(city.cn),
    sub:[city.ru,all.length?`фабрик: ${all.length}`:'',STATUS_LABELS[city.status]||''].filter(Boolean).join(' · '),
    html:areaBlock+factoryBlock+((cityAreas.length?loose:list).some(f=>!coordsOf(f))?APPROX_LEGEND:'')
  };
}

function areaPanel(){
  const a=areaById(nav.area),c=counts(a.id);
  const list=db.factories.filter(f=>factoryAreaId(f)===a.id&&listMatch(f));
  const hidden=c.found-list.length;
  const source=safeUrl(a.source);
  return{
    title:shortCn(a.cn),
    sub:`${a.ru} · ${cityById(nav.city)?.ru||''}`,
    html:`<div class="stats">${stat(c.found,'найдено')}${stat(c.verified,'проверено')}${stat(c.planned,'в поездке')}</div>
      <div class="chips">${(a.industries||[]).map(i=>`<span>${esc(i)}</span>`).join('')}</div>
      ${list.length?group(list.map(f=>factoryRow(f)).join(''),`Фабрики · ${list.length}`):(hidden?'<p class="empty">Фабрики скрыты фильтрами.</p>':`<p class="empty">Фабрик пока нет. Нужны юрлицо, адрес цеха и подтверждение операций.</p><div class="actions"><button type="button" class="primary" data-action="add-factory" data-id="${esc(a.id)}">Добавить фабрику</button></div>`)}
      ${list.some(f=>!coordsOf(f))?APPROX_LEGEND:''}
      ${hidden&&list.length?`<p class="meta center">Скрыто фильтрами: ${hidden}</p>`:''}
      ${a.ref?'<p class="meta center">Район из справочника, центр указан примерно.</p>':`<details class="more"><summary>Что проверить</summary><p>${esc(a.needs||'Уточнить')}</p><p class="meta">${esc(STATUS_LABELS[a.status]||'')}. Обновлено: ${esc(a.updatedAt||db.updatedAt||'')}${source?` · <a href="${esc(source)}" target="_blank" rel="noopener">Источник</a>`:''}</p></details>`}`
  };
}

function factoryPanel(){
  const f=factoryById(nav.factory),a=areaOfFactory(f),st=statusInfo(f.status),point=coordsOf(f);
  const url=safeUrl(f.sourceUrl)||safeUrl(f.evidence);
  const planned=visitFor(f.id);
  const processLabel=f.status==='кандидат'?'Заявлено в каталоге':'Подтверждённые операции';
  return{
    title:f.company_cn,
    sub:[st.label,a?shortCn(a.cn):''].filter(Boolean).join(' · '),
    html:`<p class="lead">${esc(f.product)}</p>
      <div class="badges"><span class="badge ${st.cls}">${esc(st.label)}</span>${f.source?`<span class="badge">${esc(f.source)}</span>`:''}</div>
      ${f.nameLanguage==='en'?'<p class="note">Название из каталога. Китайское юрлицо ещё не подтверждено.</p>':''}
      <div class="group">
        <div class="row row-static"><span class="row-main"><small>Адрес ${f.nameLanguage==='en'?'из каталога':''}</small><b class="address">${esc(f.address_cn||'Уточнить')}</b></span>${f.address_cn?`<button type="button" class="mini" data-action="copy" data-text="${esc(f.address_cn)}">Копировать</button>`:''}</div>
        <div class="row row-static"><span class="row-main"><small>На карте</small><b>${point?(f.pointSource?'Точка поставлена вручную':'Точка по координатам'):a?'Примерно: известен только район':nav.city?'Примерно: известен только город':'Координат и района нет. Точки на карте нет.'}</b></span></div>
      </div>
      <div class="actions">
        <button type="button" class="primary" data-action="toggle-visit" data-id="${esc(f.id)}">${planned?'Убрать из поездки':'Добавить в поездку'}</button>
        ${url?`<a class="button" href="${esc(url)}" target="_blank" rel="noopener">Источник</a>`:''}
      </div>
      <div class="actions">
        <a class="button" href="${esc(amapUrl(f))}" target="_blank" rel="noopener">Найти в 高德</a>
        <button type="button" data-action="place-point" data-id="${esc(f.id)}">${point?'Переставить точку':'Поставить точку'}</button>
      </div>
      <details class="more"><summary>Подробнее</summary>
        <p><b>${processLabel}:</b> ${esc(f.process||'уточнить')}</p>
        <p><b>Следующий шаг:</b> ${esc(f.next||'уточнить')}</p>
        ${f.terms?`<p><b>Условия:</b> ${esc(f.terms)}</p>`:''}
        ${f.contact?`<p><b>Контакт:</b> ${esc(f.contact)}</p>`:''}
        <p class="meta">Проверено: ${esc(f.checkedOn||'не указано')}</p>
        <button type="button" data-action="edit" data-id="${esc(f.id)}">Изменить карточку</button>
      </details>`
  };
}

function searchPanel(){
  const{areas,cities:foundCities,factories:list}=searchHits();
  const html=group(foundCities.map(c=>row({action:'city',id:c.id,title:`${shortCn(c.cn)} ${c.ru}`,sub:PROVINCES[provinceKeyByRu(c.province)]?.ru,count:factoriesOfCity(c.id).length||null})).join(''),`Города · ${foundCities.length}`)
    +group(areas.map(a=>row({action:'area',id:a.id,title:`${shortCn(a.cn)} ${a.ru}`,sub:(a.industries||[]).slice(0,2).join(', ')})).join(''),`Районы · ${areas.length}`)
    +group(list.map(f=>factoryRow(f)).join(''),`Фабрики · ${list.length}`);
  return{
    title:searchQuery,
    sub:`Найдено: городов ${foundCities.length}, районов ${areas.length}, фабрик ${list.length}`,
    html:html||'<p class="empty">В базе ничего не найдено. Попробуйте по-китайски, например 毛衣.</p>'
  };
}

function panelContent(){
  if(searchQuery)return searchPanel();
  if(transient)return transient;
  if(nav.level==='province')return provincePanel();
  if(nav.level==='city')return cityPanel();
  if(nav.level==='area')return areaPanel();
  if(nav.level==='factory')return factoryPanel();
  return chinaPanel();
}

function renderPanel({keepScroll=false}={}){
  const content=panelContent();
  const body=$('#contextPanel');
  const scroll=body.scrollTop;
  $('#sheetTitle').textContent=content.title;
  $('#sheetSub').textContent=content.sub||'';
  body.innerHTML=content.html;
  if(keepScroll){body.scrollTop=scroll;return}
  body.scrollTop=0;
  body.classList.remove('fresh');
  void body.offsetWidth;
  body.classList.add('fresh');
}

function showMapRows(rows,title,withDistance=false){
  const html=rows.map(({f,d})=>factoryRow(f,withDistance?`${d.toFixed(1)} км по прямой`:'')).join('');
  transient={
    title,
    sub:`Найдено: ${rows.length}`,
    html:html?group(html):'<p class="empty">Совпадений с известными координатами нет. Фабрики без координат есть в поиске и в списке.</p>'
  };
  clearSearchOnly();
  sheetOpen=true;
  renderBack();
  renderPanel();
  applySheet();
}

function clearSearchOnly(){
  searchQuery='';
  $('#globalSearch').value='';
}

/* ---------- Действия по клику: один обработчик не теряется при перерисовке ---------- */
const openOnMap=next=>{showPage('map');navigate(next)};
const actions={
  china:()=>openOnMap(toChina()),
  province:id=>openOnMap(toProvince(id)),
  city:id=>cityById(id)&&openOnMap(toCity(id)),
  area:id=>areaById(id)&&openOnMap(toArea(id)),
  factory:id=>factoryById(id)&&openOnMap(toFactory(id)),
  page:id=>showPage(id),
  'news-map':id=>{
    if(id==='china')return openOnMap(toChina());
    if(cityById(id))return openOnMap(toCity(id));
    if(areaById(id))openOnMap(toArea(id));
  },
  copy:(_,button)=>navigator.clipboard.writeText(button.dataset.text).then(()=>toast('Адрес скопирован'),()=>toast('Не удалось скопировать')),
  edit:id=>openFactory(factoryById(id)),
  'add-factory':id=>{
    // id: район или город, откуда пользователь добавляет фабрику.
    openFactory();
    const form=$('#factoryForm'),a=areaById(id),c=a?cityById(areaCityId(a)):cityById(id);
    form.elements.address_cn.value=shortCn(c.cn)+(a?shortCn(a.cn):'');
    if(a)form.elements.area.value=a.id;
  },
  'place-point':id=>placePoint(id),
  'toggle-visit':id=>toggleVisit(id),
  'save-visit':id=>saveVisit(id),
  'remove-visit':id=>removeVisit(id)
};

document.addEventListener('click',e=>{
  const target=e.target.closest('[data-action]');
  if(target)actions[target.dataset.action]?.(target.dataset.id,target);
});

function showPage(page){
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===page));
  document.body.classList.toggle('in-page',page!=='map');
  const tab=page==='progress'||page==='request'?'more':page;
  $$('#tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.page===tab));
  $$('.page.active').forEach(p=>{p.scrollTop=0});
}
$$('#tabbar button').forEach(b=>{b.onclick=()=>showPage(b.dataset.page)});

$('#backBtn').onclick=goBack;
$('#allChina').onclick=()=>navigate(toChina());
function toggleSheetByUser(){
  // Развернуть шторку во время установки точки значит передумать.
  if(cancelPicking())return renderNav();
  setSheet(!sheetOpen);
}
$('#sheetToggle').onclick=toggleSheetByUser;
$('#sheetGrab').onclick=toggleSheetByUser;
$('#globalSearch').oninput=e=>{
  const query=e.target.value.trim();
  if(query&&!searchQuery)searchOrigin=currentView();
  searchQuery=query;
  transient=null;
  if(query)sheetOpen=true;
  renderBack();
  renderPanel();
  applySheet();
  renderLayers();
  clearTimeout(searchFitTimer);
  if(query)searchFitTimer=setTimeout(fitSearchResults,350);
  else if(searchOrigin){
    flyToView(searchOrigin);
    searchOrigin=null;
  }
};

/* ---------- Фильтры и инструменты ---------- */
function syncFilterInputs(){
  $('#mapProduct').value=filters.product;
  $('#mapStatus').value=filters.status;
  $('#mapVisits').checked=filters.visits;
}

function filtersChanged(){
  transient=null;
  renderNav();
  persist();
}

$('#filtersBtn').onclick=()=>$('#filtersDialog').showModal();
$('#mapProduct').oninput=e=>{filters.product=e.target.value;filtersChanged()};
$('#mapStatus').oninput=e=>{filters.status=e.target.value;filtersChanged()};
$('#mapVisits').oninput=e=>{filters.visits=e.target.checked;filtersChanged()};
$('#clearMapFilters').onclick=()=>{
  filters={product:'',status:'',visits:false};
  syncFilterInputs();
  filtersChanged();
};

const closeFilters=()=>$('#filtersDialog').close();

function kmBetween(a,b){
  const rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function setWorkPoint(lat,lng,accuracy=0,label='Выбранная точка'){
  workPoint={lat,lng,accuracy,label};
  try{sessionStorage.setItem('china-map-workpoint',JSON.stringify(workPoint))}catch{}
  if(workPointLayer)map.removeLayer(workPointLayer);
  workPointLayer=L.layerGroup().addTo(map);
  L.circleMarker([lat,lng],{radius:8,color:'#1d1d1f',weight:3,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(workPointLayer);
  if(accuracy>0)L.circle([lat,lng],{radius:accuracy,color:ACCENT,weight:1,fillOpacity:.08,interactive:false}).addTo(workPointLayer);
}

function askForPoint(message){
  toast(message);
  pickingPoint=true;
  map.once('click',e=>{
    pickingPoint=false;
    setWorkPoint(e.latlng.lat,e.latlng.lng,0,'Выбранная точка');
    toast('Точка выбрана. Теперь доступно «Рядом со мной».');
  });
}

// Пользователь сам ставит точку по подложке: статус фабрики от этого не меняется.
function cancelPicking(){
  if(!pickHandler)return false;
  map.off('click',pickHandler);
  pickHandler=null;
  pickingPoint=false;
  $('#mapScreen').classList.remove('picking');
  sheetOpen=true;
  return true;
}

function placePoint(id){
  const f=factoryById(id);
  if(!f||pickHandler)return;
  pickingPoint=true;
  $('#mapScreen').classList.add('picking');
  $('#sheetSub').textContent='Приблизьте карту и нажмите точное место фабрики';
  renderBack();
  if(isPhone())setSheet(false);
  toast('Нажмите точное место на карте. «Назад» отменит.');
  pickHandler=async e=>{
    const candidate={lat:+e.latlng.lat.toFixed(6),lng:+e.latlng.lng.toFixed(6)};
    cancelPicking();
    if(!coordsOf(candidate)){
      toast('Точка вне Китая, координаты не сохранены');
      return renderNav();
    }
    const before={lat:f.lat,lng:f.lng,pointSource:f.pointSource};
    Object.assign(f,candidate,{pointSource:`Поставлена вручную на карте ${today()}`});
    if(!await save(`Точка на карте: ${f.company_cn}`))Object.assign(f,before);
    renderAll();
    renderNav();
    moveForNav();
  };
  map.on('click',pickHandler);
}

$('#manualPoint').onclick=()=>{closeFilters();askForPoint('Нажмите нужную точку на карте')};
$('#myLocation').onclick=()=>{
  closeFilters();
  if(!navigator.geolocation)return askForPoint('Геолокация недоступна. Нажмите точку на карте.');
  navigator.geolocation.getCurrentPosition(p=>{
    setWorkPoint(p.coords.latitude,p.coords.longitude,p.coords.accuracy,'Моё местоположение');
    whenMapReady(()=>map.flyTo([p.coords.latitude,p.coords.longitude],14,{animate:animateOption()}));
    toast('Местоположение показано только для этого сеанса');
  },()=>askForPoint('Нет доступа к геолокации. Нажмите точку на карте.'),{enableHighAccuracy:true,timeout:10000,maximumAge:0});
};
$('#nearbyBtn').onclick=()=>{
  closeFilters();
  if(!workPoint)return toast('Сначала нажмите «Где я» или выберите точку на карте');
  const radius=Number($('#nearRadius').value);
  const rows=db.factories.filter(f=>coordsOf(f)&&listMatch(f)).map(f=>{
    const[lat,lng]=coordsOf(f);
    return{f,d:kmBetween(workPoint,{lat,lng})};
  }).filter(x=>x.d<=radius).sort((a,b)=>a.d-b.d);
  showMapRows(rows,`Рядом · до ${radius} км`,true);
};
$('#searchMapArea').onclick=()=>{
  closeFilters();
  const bounds=map.getBounds();
  showMapRows(db.factories.filter(f=>coordsOf(f)&&listMatch(f)&&bounds.contains(coordsOf(f))).map(f=>({f})),'В этой области');
};
$('#showVisits').onclick=()=>{
  closeFilters();
  const points=db.factories.filter(f=>visitFor(f.id)&&coordsOf(f)).map(coordsOf);
  if(!points.length)return toast('У визитов пока нет проверенных координат');
  focusBounds(L.latLngBounds(points).pad(.1),15);
};

function restoreWorkPoint(){
  try{
    const p=JSON.parse(sessionStorage.getItem('china-map-workpoint')||'null');
    if(p)setWorkPoint(p.lat,p.lng,p.accuracy,p.label);
  }catch{}
}

/* ---------- Новости ---------- */
function workNews(){
  return db.logs.slice(0,8).map((x,i)=>({id:`work-${i}`,theme:'work',title:x.text,publishedAt:x.date,territory:'Моя база',changed:'Изменение записано в рабочей базе.',affected:'Ваша работа с фабриками, районами и визитами.',lastChecked:x.date}));
}

function newsCard(n){
  const url=safeUrl(n.sourceUrl);
  return `<article class="card news-card"><div>
    <span class="badge ${n.theme==='work'?'':'blue'}">${esc(NEWS_THEMES[n.theme]||n.theme)}</span>${n.project?' <span class="badge orange">Проект правила</span>':''}
    <h3>${esc(n.title)}</h3>
    <p class="meta">${esc(n.publishedAt||'дата не указана')} · ${esc(n.territory||'территория не указана')}${n.effectiveAt?` · действует с ${esc(n.effectiveAt)}`:''}</p>
    ${n.cnTitle?`<p class="cn">${esc(n.cnTitle)}</p>`:''}
    <p><b>Что изменилось:</b> ${esc(n.changed||'уточнить')}</p>
    <p><b>Кого касается:</b> ${esc(n.affected||'уточнить')}</p>
    <p class="meta">Проверено: ${esc(n.lastChecked||'не указано')}</p>
  </div><div class="actions">
    ${url?`<a class="button" href="${esc(url)}" target="_blank" rel="noopener">Первоисточник</a>`:''}
    ${n.mapTarget?`<button type="button" data-action="news-map" data-id="${esc(n.mapTarget)}">Показать на карте</button>`:''}
  </div></article>`;
}

function renderNews(){
  const external=[...db.news].sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
  const theme=$('#newsTheme').value,territory=$('#newsTerritory').value;
  const list=[...external,...workNews()].filter(n=>(!theme||n.theme===theme)&&(!territory||(n.territory||'').includes(territory)));
  $('#newsList').innerHTML=list.length?list.map(newsCard).join(''):'<article class="notice">Подходящих новостей нет.</article>';
}
['newsTheme','newsTerritory'].forEach(id=>{$('#'+id).oninput=renderNews});

$('#addNews').onclick=()=>{
  const form=$('#newsForm');
  form.reset();
  form.elements.lastChecked.value=today();
  $('#newsDialog').showModal();
};
$('#newsForm').onsubmit=async e=>{
  e.preventDefault();
  const n=Object.fromEntries(new FormData(e.target));
  n.id=crypto.randomUUID();
  n.project=!!e.target.elements.project.checked;
  if(db.news.some(x=>x.sourceUrl===n.sourceUrl))return toast('Эта публикация уже есть в ленте');
  db.news.push(n);
  if(await save(`Новость: ${n.title}`)){
    $('#newsDialog').close();
    renderNews();
    renderPanel({keepScroll:true});
  }else db.news.pop();
};
$('#importNews').onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const input=JSON.parse(reader.result);
      importedNews=Array.isArray(input)?input:input.news||[];
      const duplicates=importedNews.filter(n=>db.news.some(x=>x.sourceUrl===n.sourceUrl)).length;
      $('#newsImportPreview').innerHTML=`<h3>Предпросмотр: ${importedNews.length} публикаций</h3><p>Повторы по ссылке: ${duplicates}; они не будут добавлены.</p><button id="confirmNewsImport" type="button" class="primary">Импортировать новые</button>`;
      $('#confirmNewsImport').onclick=async()=>{
        const add=importedNews.filter(n=>n.sourceUrl&&!db.news.some(x=>x.sourceUrl===n.sourceUrl)).map(n=>({...n,id:n.id||crypto.randomUUID(),lastChecked:n.lastChecked||today()}));
        db.news.push(...add);
        await save(`Импорт новостей: ${add.length}`);
        $('#newsImportPreview').innerHTML=`<p>Добавлено: ${add.length}. Повторы пропущены.</p>`;
        renderNews();
      };
    }catch{toast('Нужен JSON-массив новостей или объект с полем news')}
  };
  reader.readAsText(file);
};

/* ---------- Поездка ---------- */
async function toggleVisit(id){
  const f=factoryById(id);
  if(!f)return;
  const current=visitFor(id);
  if(current){
    current.status='removed';
    await save(`Фабрика убрана из списка визитов: ${f.company_cn}`);
  }else{
    db.visits.push({id:crypto.randomUUID(),factoryId:id,status:'planned',date:today(),operations:'',next:''});
    await save(`В список визитов добавлена: ${f.company_cn}`);
  }
  renderAll();
  renderNav();
}

function amapUrl(f){
  const c=coordsOf(f);
  return c?`https://uri.amap.com/marker?position=${encodeURIComponent(c[1])},${encodeURIComponent(c[0])}&name=${encodeURIComponent(f.company_cn)}`:`https://www.amap.com/search?query=${encodeURIComponent(f.address_cn||f.company_cn)}`;
}

function renderTrips(){
  const list=db.visits.filter(v=>v.status!=='removed').map(v=>({v,f:factoryById(v.factoryId)})).filter(x=>x.f);
  $('#tripList').innerHTML=list.length?list.map(({v,f})=>{
    const area=areaOfFactory(f),navUrl=amapUrl(f);
    return `<article class="card factory-card"><div>
      <p class="meta">${v.status==='visited'?'Посещена':'Запланирована'} · ${esc(area?.ru||'район не указан')}</p>
      <h3>${esc(f.company_cn)}</h3><p>${esc(f.product)}</p>
      <p class="address">${esc(f.address_cn||'Адрес производства уточнить')}</p>
      <a class="button" href="${esc(navUrl)}" target="_blank" rel="noopener">Открыть в навигаторе</a>
    </div><div class="trip-form">
      <label>Дата визита<input type="date" data-visit-date="${esc(v.id)}" value="${esc(v.date||'')}"></label>
      <label>Статус<select data-visit-status="${esc(v.id)}"><option value="planned" ${v.status==='planned'?'selected':''}>Запланирована</option><option value="visited" ${v.status==='visited'?'selected':''}>Посещена</option></select></label>
      <label>Увиденные операции<textarea data-visit-operations="${esc(v.id)}">${esc(v.operations||'')}</textarea></label>
      <label>Следующий шаг<textarea data-visit-next="${esc(v.id)}">${esc(v.next||'')}</textarea></label>
      <div class="actions"><button type="button" class="primary" data-action="save-visit" data-id="${esc(v.id)}">Сохранить итог</button><button type="button" data-action="remove-visit" data-id="${esc(v.id)}">Убрать</button></div>
    </div></article>`;
  }).join(''):'<article class="notice"><b>Список на день пуст.</b><p>Добавьте фабрику из её карточки. Фабрики без координат тоже можно запланировать: адрес останется доступным для копирования.</p></article>';
}

async function saveVisit(id){
  const v=db.visits.find(x=>x.id===id);
  if(!v)return;
  const field=name=>$(`[data-visit-${name}="${id}"]`).value;
  v.date=field('date');
  v.status=field('status');
  v.operations=field('operations');
  v.next=field('next');
  await save('Итог визита обновлён');
  renderAll();
  renderNav();
}

async function removeVisit(id){
  const v=db.visits.find(x=>x.id===id);
  if(!v)return;
  v.status='removed';
  await save('Фабрика убрана из списка визитов');
  renderAll();
  renderNav();
}

$('#copyTripAddresses').onclick=async()=>{
  const text=db.visits.filter(v=>v.status!=='removed').map(v=>factoryById(v.factoryId)?.address_cn).filter(Boolean).join('\n');
  if(!text)return toast('В списке пока нет адресов');
  try{await navigator.clipboard.writeText(text);toast('Адреса скопированы')}catch{toast('Не удалось открыть буфер обмена')}
};

/* ---------- Фабрики ---------- */
function renderFactories(){
  const q=$('#factorySearch').value.toLowerCase(),areaId=$('#areaFilter').value,status=$('#statusFilter').value;
  const list=db.factories.filter(f=>(!q||Object.values(f).join(' ').toLowerCase().includes(q))&&(!areaId||factoryAreaId(f)===areaId)&&(!status||f.status===status));
  $('#factoryList').innerHTML=list.length?list.map(f=>{
    const area=areaOfFactory(f),st=statusInfo(f.status),planned=visitFor(f.id),url=safeUrl(f.sourceUrl)||safeUrl(f.evidence);
    return `<article class="card factory-card"><div>
      <div class="badges"><span class="badge ${st.cls}">${esc(st.label)}</span>${f.source?`<span class="badge">${esc(f.source)}</span>`:''}${coordsOf(f)?'':'<span class="badge">нет координат</span>'}</div>
      <h3>${esc(f.company_cn)}</h3><p>${esc(f.product)}</p>
      <p class="meta">${esc(area?.ru||'Район не указан')}${area?` · ${esc(area.cn)}`:''}</p>
      <p class="address">${esc(f.address_cn||'Адрес цеха уточнить')}</p>
      <p><b>${f.status==='кандидат'?'Заявлено в каталоге':'Подтверждено'}:</b> ${esc(f.process||'уточнить')}</p>
      <p><b>Следующее:</b> ${esc(f.next||'уточнить')}</p>
      <p class="meta">Проверено: ${esc(f.checkedOn||'уточнить')}${url?` · <a href="${esc(url)}" target="_blank" rel="noopener">Источник</a>`:''}</p>
    </div><div class="actions column">
      <button type="button" class="primary" data-action="factory" data-id="${esc(f.id)}">Открыть на карте</button>
      <button type="button" data-action="toggle-visit" data-id="${esc(f.id)}">${planned?'Убрать из поездки':'В поездку'}</button>
      <button type="button" data-action="edit" data-id="${esc(f.id)}">Изменить</button>
      ${f.address_cn?`<button type="button" data-action="copy" data-text="${esc(f.address_cn)}">Копировать адрес</button>`:''}
    </div></article>`;
  }).join(''):'<article class="notice"><b>Подходящих фабрик пока нет.</b><p>Добавьте кандидата или импортируйте CSV через предпросмотр.</p></article>';
}
['factorySearch','areaFilter','statusFilter'].forEach(id=>{$('#'+id).oninput=renderFactories});

function openFactory(f){
  const form=$('#factoryForm');
  form.reset();
  $('#formTitle').textContent=f?'Карточка фабрики':'Новая фабрика';
  Object.entries(f||{}).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v});
  $('#factoryDialog').showModal();
}
$('#addFactory').onclick=()=>openFactory();
$$('dialog .close, dialog .close-text').forEach(b=>{b.onclick=()=>b.closest('dialog').close()});
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));

$('#factoryForm').onsubmit=async e=>{
  e.preventDefault();
  const f=Object.fromEntries(new FormData(e.target));
  if((f.lat||f.lng)&&!coordsOf(f))return toast('Проверьте координаты: нужны широта и долгота в пределах Китая');
  if(f.status!=='кандидат'&&!String(f.evidence||'').trim())return toast('Чтобы снять статус «кандидат», укажите источник подтверждения');
  f.id=f.id||crypto.randomUUID();
  f.checkedOn=today();
  if(db.factories.some(x=>x.id!==f.id&&x.company_cn===f.company_cn&&x.address_cn===f.address_cn))return toast('Дубликат по названию и адресу не сохранён');
  const index=db.factories.findIndex(x=>x.id===f.id);
  // Слияние: поля, которых нет в форме (sourceUrl, source, nameLanguage), остаются в записи.
  if(index<0)db.factories.push(f);else db.factories[index]={...db.factories[index],...f};
  await save(`Карточка ${f.company_cn} сохранена`);
  $('#factoryDialog').close();
  renderAll();
  renderNav();
};

/* ---------- Импорт CSV: только кандидаты, только со ссылкой, без дублей ---------- */
function parseCSV(text){
  const lines=text.replace(/^﻿/,'').trim().split(/\r?\n/);
  const split=s=>{
    const out=[];
    let value='',quoted=false;
    for(let i=0;i<s.length;i++){
      if(s[i]==='"'){
        if(quoted&&s[i+1]==='"'){value+='"';i++}else quoted=!quoted;
      }else if(s[i]===','&&!quoted){out.push(value);value=''}
      else value+=s[i];
    }
    out.push(value);
    return out;
  };
  const head=split(lines.shift());
  return lines.filter(Boolean).map(l=>Object.fromEntries(split(l).map((v,i)=>[head[i],v])));
}

function firstUrl(...values){
  for(const v of values){
    const match=String(v||'').match(/https?:\/\/[^\s,;]+/);
    if(match)return match[0].replace(/[).]+$/,'');
  }
  return '';
}

function mapCsvRow(x){
  const url=firstUrl(x.sourceUrl,x.source_url,x.sources,x.evidence);
  return{
    company_cn:(x.company_cn||'').trim(),
    product:x.product||[x.product_ru,x.product_cn].filter(Boolean).join(' / '),
    process:x.process||x.manufacturing_process_cn||'',
    area:db.areas.find(a=>(x.area||x.district_cn||'').includes(a.id)||(x.area||x.district_cn||'').includes(a.cn))?.id||'',
    address_cn:(x.address_cn||x.workshop_address_cn||'').trim(),
    contact:x.contact||x.public_contact||'',
    terms:x.terms||[x.min_order,x.sample,x.lead_time].filter(Boolean).join(' / '),
    status:'кандидат',
    source:x.source||'Импорт CSV',
    sourceUrl:url,
    evidence:x.evidence||x.sources||url,
    next:x.next||x.next_step||'',
    visitNotes:x.visitNotes||''
  };
}

function classifyImport(rows){
  const groups={fresh:[],exact:[],doubtful:[],noSource:[],noName:[]};
  const names=new Set(db.factories.map(f=>f.company_cn));
  const urls=new Set(db.factories.map(f=>safeUrl(f.sourceUrl)).filter(Boolean));
  const pairs=new Set(db.factories.map(f=>`${f.company_cn}|${f.address_cn}`));
  rows.forEach(r=>{
    if(!r.company_cn)return groups.noName.push(r);
    if(!r.sourceUrl)return groups.noSource.push(r);
    if(pairs.has(`${r.company_cn}|${r.address_cn}`)||urls.has(r.sourceUrl))return groups.exact.push(r);
    if(names.has(r.company_cn))return groups.doubtful.push(r);
    groups.fresh.push(r);
    names.add(r.company_cn);
    urls.add(r.sourceUrl);
    pairs.add(`${r.company_cn}|${r.address_cn}`);
  });
  return groups;
}

$('#importCsv').onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    importRows=parseCSV(reader.result).map(mapCsvRow);
    const g=classifyImport(importRows);
    $('#importPreview').innerHTML=`<h3>Предпросмотр: ${importRows.length} строк</h3>
      <p>Новые кандидаты: ${g.fresh.length}. Точные дубли: ${g.exact.length}. Сомнительные совпадения по названию: ${g.doubtful.length}, они не объединяются автоматически. Без ссылки на источник: ${g.noSource.length}. Без названия: ${g.noName.length}.</p>
      <p class="meta">Все новые записи получат статус «кандидат», даже если в файле указано иное.</p>
      <button id="confirmImport" type="button" class="primary">Импортировать новых (${g.fresh.length})</button>`;
    $('#confirmImport').onclick=confirmImport;
  };
  reader.readAsText(file);
};

async function confirmImport(){
  const{fresh}=classifyImport(importRows);
  fresh.forEach(f=>{f.id=crypto.randomUUID();f.checkedOn=today();db.factories.push(f)});
  await save(`Импорт CSV: ${fresh.length} новых кандидатов`);
  $('#importPreview').innerHTML=`<p>Импортировано кандидатов: ${fresh.length}. Совпадения и записи без источника пропущены.</p>`;
  renderAll();
  renderNav();
}

$('#exportBtn').onclick=()=>{
  const keys=['company_cn','product','process','area','address_cn','lat','lng','contact','terms','status','source','sourceUrl','evidence','visitNotes','next','checkedOn'];
  const csv=[keys.join(','),...db.factories.map(f=>keys.map(k=>`"${String(f[k]??'').replaceAll('"','""')}"`).join(','))].join('\n');
  const link=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:'factories-export.csv'});
  link.click();
  URL.revokeObjectURL(link.href);
};

/* ---------- План и запрос клиента ---------- */
function renderTasks(){
  $('#taskList').innerHTML=db.tasks.map(t=>`<article class="card task ${t.done?'done':''}"><b>${esc(t.week)}: ${esc(t.text)}</b>${t.result?`<p>${esc(t.result)}</p>`:''}</article>`).join('');
}

$('#areaStatusBtn').onclick=()=>$('#statusDialog').showModal();
$('#statusForm').onsubmit=async e=>{
  e.preventDefault();
  const x=Object.fromEntries(new FormData(e.target)),a=areaById(x.area);
  a.status=x.status;
  a.statusReason=x.reason;
  a.updatedAt=today();
  await save(`${a.ru}: ${STATUS_LABELS[x.status]}. ${x.reason}`);
  $('#statusDialog').close();
  renderAll();
  renderNav();
};

$('#clientForm').onsubmit=e=>{
  e.preventDefault();
  const x=Object.fromEntries(new FormData(e.target));
  if(!x.country){
    $('#requestResult').innerHTML='<h3>Укажите страну назначения</h3><p>Без страны нельзя проверить ввоз, транзит и условия перевозчика.</p>';
    return;
  }
  const words=`${x.product} ${x.specs}`.toLowerCase().split(/\s+/).filter(Boolean);
  const found=db.factories.filter(f=>words.some(w=>Object.values(f).join(' ').toLowerCase().includes(w))).slice(0,3);
  const text=`Проверь перевозку Китай → ${x.country}. Товар: ${x.product}. Состав/характеристики: ${x.specs||'уточнить'}. Количество: ${x.quantity||'уточнить'}. Маршрут и транспорт: ${x.route||'уточнить'}. Проверь вывоз из Китая, ввоз в ${x.country}${x.country==='Кыргызстан'?' с учётом правил ЕАЭС':''}, транзит, условия перевозчика, документы и актуальные официальные ссылки.`;
  $('#requestResult').innerHTML=`<h3>${found.length?'Подходящие кандидаты':'Подходящих фабрик в базе нет'}</h3>
    ${found.map(f=>`<p><b>${esc(f.company_cn)}</b> (${esc(statusInfo(f.status).label)}): ${esc(f.product)}. Спросить: ${esc(f.next||'подтвердить адрес и операции')}</p>`).join('')||'<p>Найдите кандидатов в профильном районе и добавьте их в базу.</p>'}
    <h3>Перевозка: требуется проверка</h3><textarea readonly>${esc(text)}</textarea>`;
};

/* ---------- Запуск ---------- */
function fillSelects(){
  const option=a=>`<option value="${esc(a.id)}">${esc(a.ru)} · ${esc(a.cn)}</option>`;
  const withAreas=cities.filter(c=>areasOf(c.id).length).sort((x,y)=>hasStudiedAreas(y.id)-hasStudiedAreas(x.id));
  const grouped=withAreas.map(c=>`<optgroup label="${esc(c.ru)} · ${esc(shortCn(c.cn))}">${areasOf(c.id).map(option).join('')}</optgroup>`).join('');
  $('#areaFilter').innerHTML='<option value="">Все районы</option>'+grouped;
  $('#factoryForm').elements.area.innerHTML='<option value="">Район не указан</option>'+grouped;
  $('#statusForm').elements.area.innerHTML=db.areas.map(option).join(''); // статус ведётся только у изученных районов
}

function renderAll(){
  renderFactories();
  renderTasks();
  renderNews();
  renderTrips();
}

async function boot(){
  db=(await api()).data;
  db.news||=[];
  db.visits||=[];
  db.logs||=[];
  db.cities||=[];
  await loadCities();
  await loadAreas();
  fillSelects();
  const savedView=restoreState();
  syncFilterInputs();
  await initMap();
  renderAll();
  renderNav();
  $('#contextPanel').classList.remove('fresh');
  if(savedView){
    map.setView([savedView.lat,savedView.lng],savedView.zoom,{animate:false});
    keepFocusVisible(false); // место могло быть сохранено при другой ширине окна
  }else moveForNav(false);
  restoreWorkPoint();
  declutterPins();
}

boot().catch(e=>{
  console.error(e);
  $('#sheetTitle').textContent='Не удалось загрузить данные';
  $('#contextPanel').innerHTML=`<p>${esc(e.message)}</p><p>Запустите <code>npm start</code> в папке проекта и откройте <a href="http://127.0.0.1:4173">http://127.0.0.1:4173</a>.</p>`;
});
