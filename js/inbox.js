// WhatsApp inbox. All mutations are authorized by Supabase RPCs, never by UI flags.
(function (U) {
  'use strict';
  var c=U.core, state=c.state, esc=c.esc, $=c.$;
  var ws=null, selected=null, threads=[], orders=[], quotes=[], settings={}, pairing={}, owner=false, generation=0, limit=100, messageLimit=100, busy=false, signature='', timer=null, pairTimer=null, pairLoading=false;
  var labels={
    ru:{title:'Сообщения',hint:'WhatsApp, клиенты и заказы — в одном месте',all:'Все',unread:'Непрочитанные',human:'Нужен менеджер',mine:'Мои',search:'Имя или телефон',empty:'Диалогов пока нет. Входящие сообщения появятся здесь.',choose:'Выберите диалог',send:'Отправить',placeholder:'Сообщение клиенту…',take:'Взять диалог',bot:'Вернуть боту',close:'Закрыть',refresh:'Обновить',settings:'Автоматизация',enabled:'Отправка сообщений',bot_enabled:'Автоответчик',notify_new:'Новые заказы',notify_status:'Статусы заказов',notify_payment:'Изменения оплаты',language:'Язык уведомлений',template:'Шаблон статуса',tokens:'Подстановки: {order} — номер, {status} — статус.',save:'Сохранить',online:'WhatsApp подключён',offline:'Сервис недоступен или давно не обновлялся',notConfigured:'WhatsApp для этого кабинета ещё не настроен.',error:'Не удалось загрузить сообщения. Обновите страницу или проверьте подключение.',migration:'Раздел сообщений ещё не установлен в базе.',client:'Карточка клиента',related:'Связанные заказы',noOrders:'Связанных заказов пока нет.',quote:'Отправить расчёт',quoteConfirm:'Отправить клиенту расчёт по текущей сумме заказа? Подтверждение не является оплатой.',queued:'В очереди',sending:'Отправляется',sent:'Отправлено',delivered:'Доставлено',read:'Прочитано',received:'Получено',failed:'Ошибка отправки',cancelled:'Отменено',retry:'Повторить',photo:'Фото',paused:'Менеджер',auto:'Бот',closed:'Закрыт',optedOut:'Клиент отключил сообщения',assigned:'Назначено вам',other:'Назначено сотруднику',older:'Ранее',more:'Ещё диалоги',accepted:'Расчёт подтверждён',declined:'Расчёт отклонён',pending:'Ожидает подтверждения',expired:'Расчёт устарел',noWorkspace:'Сначала откройте нужный кабинет.',saved:'Сохранено',quoteSent:'Расчёт поставлен в очередь',readOnly:'Только просмотр. Для ответа откройте кабинет с правом изменения.',working:'Обработка…',photoError:'Не удалось открыть фото',writeError:'Действие не выполнено. Проверьте подключение, права и состояние заказа.'},
    en:{title:'Messages',hint:'WhatsApp, customers and orders together',all:'All',unread:'Unread',human:'Needs an agent',mine:'Assigned to me',search:'Name or phone',empty:'No conversations yet. Incoming messages will appear here.',choose:'Select a conversation',send:'Send',placeholder:'Message the customer…',take:'Take conversation',bot:'Return to bot',close:'Close',refresh:'Refresh',settings:'Automation',enabled:'Message sending',bot_enabled:'Automatic replies',notify_new:'New orders',notify_status:'Order status changes',notify_payment:'Payment changes',language:'Notification language',template:'Status template',tokens:'Placeholders: {order}, {status}.',save:'Save',online:'WhatsApp connected',offline:'Service offline or heartbeat expired',notConfigured:'WhatsApp has not been configured for this workspace.',error:'Could not load messages. Check your connection and refresh.',migration:'The inbox database update is not installed.',client:'Customer',related:'Related orders',noOrders:'No linked orders yet.',quote:'Send quote',quoteConfirm:'Send the current order total to this customer? Confirmation is not a payment.',queued:'Queued',sending:'Sending',sent:'Sent',delivered:'Delivered',read:'Read',received:'Received',failed:'Sending failed',cancelled:'Cancelled',retry:'Retry',photo:'Photo',paused:'Agent',auto:'Bot',closed:'Closed',optedOut:'Customer opted out',assigned:'Assigned to you',other:'Assigned to a colleague',older:'Earlier',more:'More conversations',accepted:'Quote accepted',declined:'Quote declined',pending:'Awaiting confirmation',expired:'Quote expired',noWorkspace:'Open a workspace first.',saved:'Saved',quoteSent:'Quote queued',readOnly:'Read only. Open an editable workspace to reply.',working:'Working…',photoError:'Could not open photo',writeError:'Action failed. Check connection, permissions and order status.'},
    zh:{title:'消息',hint:'在此管理 WhatsApp、客户和订单',all:'全部',unread:'未读',human:'需要人工',mine:'我的会话',search:'姓名或电话',empty:'暂无会话，收到的消息将在此显示。',choose:'选择会话',send:'发送',placeholder:'给客户发送消息…',take:'接管会话',bot:'交回机器人',close:'关闭',refresh:'刷新',settings:'自动化',enabled:'消息发送',bot_enabled:'自动回复',notify_new:'新订单',notify_status:'订单状态',notify_payment:'付款变更',language:'通知语言',template:'状态模板',tokens:'占位符：{order} 订单号，{status} 状态。',save:'保存',online:'WhatsApp 已连接',offline:'服务离线或状态已过期',notConfigured:'此工作区尚未配置 WhatsApp。',error:'无法加载消息，请检查网络后刷新。',migration:'尚未安装消息数据库更新。',client:'客户资料',related:'关联订单',noOrders:'暂无关联订单。',quote:'发送报价',quoteConfirm:'将当前订单金额发送给客户？确认报价不代表付款。',queued:'排队中',sending:'发送中',sent:'已发送',delivered:'已送达',read:'已读',received:'已收到',failed:'发送失败',cancelled:'已取消',retry:'重试',photo:'照片',paused:'人工',auto:'机器人',closed:'已关闭',optedOut:'客户已取消订阅',assigned:'已分配给您',other:'已分配给同事',older:'更早消息',more:'更多会话',accepted:'报价已确认',declined:'报价已拒绝',pending:'等待确认',expired:'报价已过期',noWorkspace:'请先打开工作区。',saved:'已保存',quoteSent:'报价已加入队列',readOnly:'只读，请打开可编辑的工作区以回复。',working:'处理中…',photoError:'无法打开照片',writeError:'操作失败，请检查网络、权限和订单状态。'},
    vi:{title:'Tin nhắn',hint:'WhatsApp, khách hàng và đơn hàng cùng một nơi',all:'Tất cả',unread:'Chưa đọc',human:'Cần nhân viên',mine:'Của tôi',search:'Tên hoặc số điện thoại',empty:'Chưa có hội thoại. Tin nhắn mới sẽ hiện ở đây.',choose:'Chọn hội thoại',send:'Gửi',placeholder:'Nhắn cho khách…',take:'Nhận hội thoại',bot:'Chuyển lại bot',close:'Đóng',refresh:'Làm mới',settings:'Tự động hóa',enabled:'Gửi tin nhắn',bot_enabled:'Trả lời tự động',notify_new:'Đơn hàng mới',notify_status:'Trạng thái đơn',notify_payment:'Thay đổi thanh toán',language:'Ngôn ngữ thông báo',template:'Mẫu trạng thái',tokens:'Biến: {order}, {status}.',save:'Lưu',online:'WhatsApp đã kết nối',offline:'Dịch vụ ngoại tuyến hoặc hết hạn trạng thái',notConfigured:'WhatsApp chưa được cấu hình cho không gian này.',error:'Không tải được tin nhắn. Kiểm tra kết nối và làm mới.',migration:'Chưa cài bản cập nhật cơ sở dữ liệu tin nhắn.',client:'Khách hàng',related:'Đơn hàng liên quan',noOrders:'Chưa có đơn hàng liên kết.',quote:'Gửi báo giá',quoteConfirm:'Gửi tổng tiền hiện tại của đơn hàng? Xác nhận không phải thanh toán.',queued:'Đang chờ',sending:'Đang gửi',sent:'Đã gửi',delivered:'Đã giao',read:'Đã đọc',received:'Đã nhận',failed:'Gửi thất bại',cancelled:'Đã hủy',retry:'Thử lại',photo:'Ảnh',paused:'Nhân viên',auto:'Bot',closed:'Đã đóng',optedOut:'Khách đã tắt tin nhắn',assigned:'Được giao cho bạn',other:'Được giao cho đồng nghiệp',older:'Trước đó',more:'Thêm hội thoại',accepted:'Đã chấp nhận báo giá',declined:'Đã từ chối báo giá',pending:'Chờ xác nhận',expired:'Báo giá hết hạn',noWorkspace:'Hãy mở không gian làm việc trước.',saved:'Đã lưu',quoteSent:'Báo giá đã vào hàng đợi',readOnly:'Chỉ xem. Mở không gian có quyền sửa để trả lời.',working:'Đang xử lý…',photoError:'Không mở được ảnh',writeError:'Thao tác thất bại. Kiểm tra kết nối, quyền và trạng thái đơn.'}
  };
  Object.assign(labels.ru,{pairTitle:'Ваш WhatsApp',pairHelp:'На телефоне: WhatsApp → Связанные устройства → Привязка устройства. Отсканируйте QR-код своего кабинета.',pairConnect:'Подключить WhatsApp',pairRefresh:'Обновить QR-код',pairDisconnect:'Отключить',pairPrivate:'QR-код доступен только владельцу кабинета.',pairWait:'Готовим подключение…',pairQueued:'Запрос принят. Ожидаем сервис подключения…',pairQR:'Отсканируйте QR-код телефоном',pairExpired:'QR-код истёк. Нажмите «Обновить QR-код».',pairError:'Не удалось подготовить подключение. Повторите попытку или обратитесь к администратору.',pairOff:'WhatsApp ещё не подключён',pairConfirm:'Остановить интеграцию WhatsApp для этого кабинета? История сообщений сохранится.'});
  Object.assign(labels.en,{pairTitle:'Your WhatsApp',pairHelp:'On your phone: WhatsApp → Linked devices → Link a device. Scan the QR code for your workspace.',pairConnect:'Connect WhatsApp',pairRefresh:'Refresh QR code',pairDisconnect:'Disconnect',pairPrivate:'Only the workspace owner can see this QR code.',pairWait:'Preparing connection…',pairQueued:'Request received. Waiting for the connection service…',pairQR:'Scan the QR code with your phone',pairExpired:'QR code expired. Refresh to get a new code.',pairError:'Could not prepare connection. Retry or contact the administrator.',pairOff:'WhatsApp is not connected yet',pairConfirm:'Stop WhatsApp integration for this workspace? Message history will be preserved.'});
  Object.assign(labels.zh,{pairTitle:'您的 WhatsApp',pairHelp:'在手机上打开 WhatsApp → 已关联的设备 → 关联设备，扫描此工作区的二维码。',pairConnect:'连接 WhatsApp',pairRefresh:'刷新二维码',pairDisconnect:'断开连接',pairPrivate:'只有工作区所有者可以查看此二维码。',pairWait:'正在准备连接…',pairQueued:'请求已接收，正在等待连接服务…',pairQR:'请使用手机扫描二维码',pairExpired:'二维码已过期，请刷新。',pairError:'无法建立连接，请重试或联系管理员。',pairOff:'WhatsApp 尚未连接',pairConfirm:'停止此工作区的 WhatsApp 集成？消息历史将保留。'});
  Object.assign(labels.vi,{pairTitle:'WhatsApp của bạn',pairHelp:'Trên điện thoại: WhatsApp → Thiết bị liên kết → Liên kết thiết bị. Quét mã QR cho không gian của bạn.',pairConnect:'Kết nối WhatsApp',pairRefresh:'Làm mới mã QR',pairDisconnect:'Ngắt kết nối',pairPrivate:'Chỉ chủ không gian có thể xem mã QR này.',pairWait:'Đang chuẩn bị kết nối…',pairQueued:'Đã nhận yêu cầu. Đang chờ dịch vụ kết nối…',pairQR:'Quét mã QR bằng điện thoại',pairExpired:'Mã QR hết hạn. Hãy làm mới.',pairError:'Không thể chuẩn bị kết nối. Thử lại hoặc liên hệ quản trị viên.',pairOff:'WhatsApp chưa được kết nối',pairConfirm:'Dừng tích hợp WhatsApp cho không gian này? Lịch sử tin nhắn được giữ lại.'});
  function l(k){var lang=typeof getLang==='function'?getLang():'ru';return (labels[lang]||labels.ru)[k]||k;}
  function live(){return state.me&&state.ws&&state.ws.id===ws&&state.tab==='inbox';}
  function writable(){return live()&&!state.readOnly;}
  function date(v){return v?new Date(v).toLocaleString(c.locale(),{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';}
  function button(action,text,extra){return '<button type="button" class="btn btn-ghost" data-wa-action="'+action+'" '+(extra||'')+'>'+esc(text)+'</button>';}
  function showError(e){$('#wa-feedback').textContent=e&&['42P01','PGRST205'].indexOf(e.code)>=0?l('migration'):l('error');}
  async function rpc(name,args){var r=await c.db().rpc(name,args);if(r.error)throw r.error;return r.data;}
  function renderList(){
    var q=$('#wa-search').value.trim().toLowerCase(),f=$('#wa-filter').value;
    var rows=threads.filter(function(t){return (!q||(t.display_name+' '+t.phone).toLowerCase().indexOf(q)>=0)&&(f!=='unread'||t.unread>0)&&(f!=='human'||t.mode==='human')&&(f!=='mine'||t.assigned_to===state.me.id);});
    $('#wa-list').innerHTML=rows.length?rows.map(function(t){return '<button type="button" class="wa-thread '+(t.id===selected?'selected':'')+'" data-wa-thread="'+esc(t.id)+'"><span class="wa-avatar">'+esc((t.display_name||t.phone).slice(0,2).toUpperCase())+'</span><span class="wa-thread-copy"><b>'+esc(t.display_name||'+'+t.phone)+'</b><small>'+esc(t.mode==='human'?l('paused'):t.mode==='closed'?l('closed'):l('auto'))+' · '+esc(date(t.last_message_at))+'</small></span>'+(t.unread?'<span class="wa-count">'+esc(t.unread)+'</span>':'')+'</button>';}).join(''):'<p class="wa-empty">'+esc(l('empty'))+'</p>';
    $('#wa-more').hidden=threads.length<limit;
  }
  function connection(){
    var on=settings.connection_ok&&settings.last_heartbeat&&Date.now()-new Date(settings.last_heartbeat).getTime()<120000;
    $('#wa-connection').textContent=!settings.workspace_id?l('notConfigured'):on?l('online'):l('offline');$('#wa-connection').classList.toggle('wa-online',!!on);
  }
  function renderPairing(){
    $('#wa-pairing').hidden=!owner||state.readOnly;
    var status=pairing.state||'disconnected',pending=['queued','starting','disconnecting'].indexOf(status)>=0;
    var valid=status==='qr'&&pairing.qr_expires_at&&new Date(pairing.qr_expires_at).getTime()>Date.now()&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(pairing.qr||'');
    $('#wa-pair-state').textContent=l(status==='connected'?(settings.connection_ok?'online':'offline'):status==='queued'?'pairQueued':pending?'pairWait':status==='qr'?(valid?'pairQR':'pairExpired'):status==='error'?'pairError':'pairOff');
    $('#wa-qr-wrap').hidden=!valid;$('#wa-qr').src=valid?pairing.qr:'';
    $('#wa-connect').hidden=status==='connected'||pending||status==='qr';
    $('#wa-pair-refresh').hidden=pending||(status==='connected'&&settings.connection_ok)||status==='disconnected';
    $('#wa-disconnect').hidden=status==='disconnected'||status==='disconnecting';
  }
  function acceptPairing(next){
    if((next.request_seq||0)<(pairing.request_seq||0))return;
    if(next.request_seq===pairing.request_seq&&next.updated_at&&pairing.updated_at&&next.updated_at<pairing.updated_at)return;
    pairing=next;
  }
  async function fastPairing(){
    if(!live()||!owner||pairLoading||document.visibilityState!=='visible'||['queued','starting','qr','disconnecting'].indexOf(pairing.state)<0)return;
    pairLoading=true;var id=ws,g=generation;
    try{
      var result=await c.db().from('wa_pairing').select('*').eq('workspace_id',id).maybeSingle();
      if(g!==generation||!live()||ws!==id||result.error)return;
      var previous=pairing.state;acceptPairing(result.data||{});
      if(previous!=='connected'&&pairing.state==='connected'){settings.connection_ok=true;settings.last_heartbeat=new Date().toISOString();connection();}
      renderPairing();
    }finally{pairLoading=false;}
  }
  async function requestPair(action){
    if(!owner||!writable()||busy)return;
    if(action==='disconnect'&&!window.confirm(l('pairConfirm')))return;
    busy=true;['wa-connect','wa-pair-refresh','wa-disconnect'].forEach(function(id){$('#'+id).disabled=true;});
    try{await rpc('wa_request_connection',{p_workspace:ws,p_action:action});await load();}
    catch(e){c.toast(l('pairError'),'error');}
    finally{busy=false;['wa-connect','wa-pair-refresh','wa-disconnect'].forEach(function(id){$('#'+id).disabled=false;});}
  }
  async function load(){
    if(!live())return;
    var g=generation,w=ws;
    var results=await Promise.all([c.db().from('wa_threads').select('*').eq('workspace_id',w).order('last_message_at',{ascending:false}).limit(limit),c.db().from('wa_settings').select('*').eq('workspace_id',w).maybeSingle(),owner?c.db().from('wa_pairing').select('*').eq('workspace_id',w).maybeSingle():Promise.resolve({data:null})]);
    if(g!==generation||!live())return;
    if(results[0].error||results[1].error||results[2].error){showError(results[0].error||results[1].error||results[2].error);return;}
    threads=results[0].data||[];settings=results[1].data||{};acceptPairing(results[2].data||{});$('#wa-feedback').textContent='';renderList();connection();renderPairing();
    if(selected)await loadThread(false);
  }
  async function loadThread(read){
    if(!selected||!live())return;var id=selected,g=generation;
    var results=await Promise.all([c.db().from('wa_messages').select('*').eq('thread_id',id).order('created_at',{ascending:false}).limit(messageLimit),c.db().from('wa_thread_orders').select('order_id').eq('thread_id',id).limit(100),c.db().from('wa_quotes').select('*').eq('thread_id',id).order('created_at',{ascending:false}).limit(30)]);
    if(g!==generation||id!==selected||!live())return;
    var err=results.filter(function(r){return r.error;})[0];if(err){showError(err.error);return;}
    quotes=results[2].data||[];
    var ids=(results[1].data||[]).map(function(x){return x.order_id;});
    var or=ids.length?await c.db().from('orders').select('id,order_number,client_name,product_ru,status,total_som,paid_amount,client_currency,tracking_number').eq('workspace_id',ws).in('id',ids).order('created_at',{ascending:false}):{data:[]};
    if(g!==generation||id!==selected||!live())return;if(or.error){showError(or.error);return;}orders=or.data||[];
    var thread=threads.find(function(t){return t.id===id;});if(!thread)return;
    $('#wa-conversation').hidden=false;$('#wa-select-empty').hidden=true;
    $('#wa-name').textContent=thread.display_name||'+'+thread.phone;$('#wa-phone').textContent='+'+thread.phone;
    $('#wa-owner').textContent=(thread.opted_out?l('optedOut')+' · ':'')+(thread.mode==='human'?l('paused'):thread.mode==='closed'?l('closed'):l('auto'))+(thread.assigned_to?' · '+l(thread.assigned_to===state.me.id?'assigned':'other'):'');
    $('#wa-composer').hidden=!writable()||thread.opted_out||!settings.enabled;$('#wa-actions').hidden=!writable();
    $('#wa-older').hidden=(results[0].data||[]).length<messageLimit;
    var msgs=(results[0].data||[]).slice().reverse(), sig=JSON.stringify([id,msgs,quotes,orders]);
    if(sig!==signature){signature=sig;var log=$('#wa-log'),nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<90;
      log.innerHTML=msgs.map(function(m){return '<article class="wa-message '+(m.direction==='out'?'wa-out':'wa-in')+'"><p>'+esc(m.body)+'</p>'+(m.media_path?button('photo',l('photo'),'data-wa-media="'+esc(m.media_path)+'"'):'')+'<small>'+esc(date(m.created_at))+' · '+esc(l(m.state))+(m.attempts>1?' · ×'+m.attempts:'')+'</small>'+(m.state==='failed'&&writable()?button('retry',l('retry'),'data-wa-id="'+esc(m.id)+'"'):'')+'</article>';}).join('');
      if(read||nearBottom)log.scrollTop=log.scrollHeight;
      $('#wa-orders').innerHTML=orders.length?orders.map(function(o){var q=quotes.find(function(x){return x.order_id===o.id;});return '<article class="wa-order"><button type="button" class="wa-order-link" data-wa-order="'+esc(o.id)+'">№'+esc(o.order_number)+'</button><p>'+esc(o.product_ru)+'</p><small>'+esc(typeof t==='function'?t('status_'+o.status):o.status)+'</small><p>'+esc(c.money(o.total_som))+' '+esc(o.client_currency)+'</p>'+(o.tracking_number?'<p>'+esc(o.tracking_number)+'</p>':'')+(q?'<p class="wa-quote-state">'+esc(l(q.state))+'</p>':'')+(writable()&&settings.enabled&&!thread.opted_out&&Number(o.total_som)>0&&['cancelled','delivered'].indexOf(o.status)<0?button('quote',l('quote'),'data-wa-id="'+esc(o.id)+'"'):'')+'</article>';}).join(''):'<p class="wa-empty">'+esc(l('noOrders'))+'</p>';
    }
    if(read&&writable()){await rpc('wa_thread_action',{p_thread:id,p_action:'read'});thread.unread=0;renderList();}
  }
  function renderSettings(){
    $('#wa-settings').hidden=!owner||state.readOnly;
    ['enabled','bot_enabled','notify_new','notify_status','notify_payment'].forEach(function(k){$('#wa-setting-'+k).checked=!!settings[k];});
    $('#wa-setting-language').value=settings.language||'ru';$('#wa-setting-template').value=settings.status_template||'ULA Factory · №{order}: {status}';
  }
  async function select(id){selected=id;messageLimit=100;signature='';$('#wa-compose-text').value='';await loadThread(true);}
  async function action(e){
    var threadEl=e.target.closest('[data-wa-thread]');if(threadEl){select(threadEl.dataset.waThread).catch(showError);return;}
    var orderEl=e.target.closest('[data-wa-order]');if(orderEl){var id=orderEl.dataset.waOrder;c.switchTab('orders');c.openDetail(id);return;}
    var b=e.target.closest('[data-wa-action]');if(!b||busy)return;
    var a=b.dataset.waAction;
    if(a==='photo'){
      var photoWs=ws,photoThread=selected,photo=await c.db().storage.from('wa-attachments').createSignedUrl(b.dataset.waMedia,60);
      if(photoWs!==ws||photoThread!==selected||!live())return;
      if(photo.error){c.toast(l('photoError'),'error');return;}c.openLightbox([photo.data.signedUrl],0);return;
    }
    if(!writable())return;
    busy=true;b.disabled=true;
    try{
      if(['take','bot','close'].indexOf(a)>=0)await rpc('wa_thread_action',{p_thread:selected,p_action:a});
      else if(a==='retry')await rpc('wa_retry',{p_message:b.dataset.waId});
      else if(a==='quote'){
        if(!window.confirm(l('quoteConfirm')))return;
        await rpc('wa_publish_quote',{p_thread:selected,p_order:b.dataset.waId});c.toast(l('quoteSent'),'ok');
      }
      await load();
    }catch(err){c.toast(l('writeError'),'error');}finally{busy=false;b.disabled=false;}
  }
  async function open(){
    generation++;var previous=ws;ws=state.ws&&state.ws.id;
    if(previous!==ws){pairing={};selected=null;threads=[];orders=[];signature='';$('#wa-list').innerHTML='';$('#wa-log').innerHTML='';$('#wa-orders').innerHTML='';$('#wa-compose-text').value='';}
    document.querySelectorAll('#tab-inbox [data-wa-label]').forEach(function(el){el.textContent=l(el.dataset.waLabel);});
    $('#wa-search').placeholder=l('search');$('#wa-compose-text').placeholder=l('placeholder');
    $('#wa-no-workspace').hidden=!!ws;$('#wa-layout').hidden=!ws;$('#wa-settings').hidden=true;$('#wa-pairing').hidden=true;$('#wa-qr').src='';$('#wa-conversation').hidden=!selected;$('#wa-select-empty').hidden=!!selected;
    $('#wa-read-only').hidden=!state.readOnly;
    if(!ws||!c.db())return;
    var g=generation,own=await c.db().rpc('is_owner',{p_ws:ws});if(g!==generation||!live())return;owner=!!own.data;
    await load();if(g!==generation||!live())return;renderSettings();
    clearInterval(pairTimer);pairTimer=setInterval(function(){fastPairing().catch(function(){});},1000);
    clearInterval(timer);timer=setInterval(function(){if(live())renderPairing();if(live()&&document.visibilityState==='visible')load().catch(showError);},5000);
  }
  function clearSensitive(){
    generation++;clearInterval(timer);clearInterval(pairTimer);timer=null;pairTimer=null;ws=null;selected=null;owner=false;pairing={};threads=[];orders=[];quotes=[];signature='';
    $('#wa-qr').removeAttribute('src');$('#wa-pairing').hidden=true;
    ['wa-list','wa-log','wa-orders'].forEach(function(id){$('#'+id).innerHTML='';});
    $('#wa-compose-text').value='';$('#wa-conversation').hidden=true;
  }
  async function welcome(){
    var box=$('#wa-welcome');if(!box)return;box.classList.add('hidden');
    if(!state.ws||!state.me||state.readOnly||!c.db())return;
    var id=state.ws.id,results=await Promise.all([c.db().rpc('is_owner',{p_ws:id}),c.db().from('wa_settings').select('connection_ok,last_heartbeat').eq('workspace_id',id).maybeSingle()]);
    if(!state.ws||state.ws.id!==id||state.tab!=='home'||results[0].error||results[1].error)return;
    var st=results[1].data||{},connected=st.connection_ok&&st.last_heartbeat&&Date.now()-new Date(st.last_heartbeat).getTime()<120000;
    box.classList.toggle('hidden',!results[0].data||connected);
  }
  function bind(){
    $('#wa-connect').addEventListener('click',function(){requestPair('connect');});
    $('#wa-pair-refresh').addEventListener('click',function(){requestPair('refresh');});
    $('#wa-disconnect').addEventListener('click',function(){requestPair('disconnect');});
    $('#tab-inbox').addEventListener('click',function(e){action(e).catch(showError);});
    $('#wa-search').addEventListener('input',renderList);$('#wa-filter').addEventListener('change',renderList);
    $('#wa-older').addEventListener('click',function(){messageLimit+=100;loadThread(false).catch(showError);});
    $('#wa-refresh').addEventListener('click',function(){load().catch(showError);});$('#wa-more').addEventListener('click',function(){limit+=100;load().catch(showError);});
    $('#wa-settings').addEventListener('toggle',function(){if(this.open)renderSettings();});
    $('#wa-composer').addEventListener('submit',async function(e){e.preventDefault();if(busy||!writable()||!selected)return;var input=$('#wa-compose-text'),text=input.value.trim(),id=selected,w=ws;if(!text)return;busy=true;$('#wa-send').disabled=true;
      try{await rpc('wa_send',{p_thread:id,p_body:text});if(w===ws&&id===selected)input.value='';await load();}catch(err){c.toast(l('writeError'),'error');}finally{busy=false;$('#wa-send').disabled=false;}
    });
    $('#wa-settings-form').addEventListener('submit',async function(e){e.preventDefault();if(!owner||!writable()||busy)return;var data={};['enabled','bot_enabled','notify_new','notify_status','notify_payment'].forEach(function(k){data[k]=$('#wa-setting-'+k).checked;});data.language=$('#wa-setting-language').value;data.status_template=$('#wa-setting-template').value;busy=true;$('#wa-settings-save').disabled=true;
      try{await rpc('wa_settings_save',{p_workspace:ws,p_settings:data});await load();c.toast(l('saved'),'ok');}catch(err){c.toast(l('writeError'),'error');}finally{busy=false;$('#wa-settings-save').disabled=false;}
    });
  }
  U.inbox={bind:bind,open:open,load:load,welcome:welcome,clear:clearSensitive};
})(window.ULA);
