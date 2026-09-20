// =====================================================
// CARGO CHINA — переводы (Русский / 中文)
// Чтобы изменить надпись, найдите её здесь и поправьте.
// =====================================================

var I18N = {
  ru: {
    app_title: "Cargo China — учёт заказов",

    // Вход
    login_title: "Вход для администратора",
    login_hint: "Доступ только для владельца системы",
    email: "Электронная почта",
    password: "Пароль",
    login_btn: "Войти",
    logging_in: "Входим…",
    logout: "Выйти",
    login_error: "Неверная почта или пароль",
    no_access: "У этого аккаунта нет доступа к админке",

    // Настройка
    config_title: "Нужно заполнить config.js",
    config_text: "Откройте файл config.js и вставьте адрес проекта Supabase и публичный ключ (Шаг 3).",
    lib_missing: "Не загрузился файл supabase.js. Проверьте, что он лежит рядом с index.html.",

    // Склад
    warehouse_title: "Склад в Китае",
    copy_address: "Копировать адрес",
    copied: "Скопировано",

    // Сводка
    sum_orders: "Всего заказов",
    sum_total: "Общая сумма заказов",
    sum_paid: "Оплачено",
    sum_debt: "Задолженность",
    sum_note: "Суммы считаются без отменённых заказов",

    // Фильтры
    filter_all: "Все",
    filter_new: "Новые",
    filter_awaiting_payment: "Ожидают оплаты",
    filter_purchasing: "Закупаются",
    filter_china_warehouse: "На складе",
    filter_in_transit: "В пути",
    filter_arrived: "Прибыли",
    filter_delivered: "Выданы",
    filter_cancelled: "Отменены",
    search_placeholder: "Поиск: номер, клиент, телефон, товар, поставщик, WeChat",
    date_from: "С даты",
    date_to: "По дату",
    reset: "Сбросить",

    // Кнопки
    new_order: "Новый заказ",
    edit_order: "Изменить заказ",
    open: "Открыть",
    edit: "Изменить",
    remove: "Удалить",
    change_status: "Изменить статус",
    client_link: "Создать ссылку клиенту",
    save: "Сохранить заказ",
    saving: "Сохраняем…",
    cancel: "Отмена",
    close: "Закрыть",
    copy: "Копировать",
    add_photos: "Добавить фото",

    // Статусы
    status_new: "Новый",
    status_awaiting_payment: "Ожидает оплаты",
    status_purchasing: "Закупается",
    status_china_warehouse: "На складе Китая",
    status_in_transit: "В пути",
    status_arrived: "Прибыл",
    status_delivered: "Выдан клиенту",
    status_cancelled: "Отменён",

    // Поля формы
    sec_main: "Основное",
    sec_client: "Клиент",
    sec_product: "Товар и поставщик",
    sec_money: "Цена и оплата",
    sec_photos: "Фото товара",
    sec_comments: "Комментарии",
    f_order_number: "Номер заказа",
    f_date: "Дата",
    f_status: "Статус",
    f_client: "Клиент",
    f_phone: "Телефон клиента",
    f_wechat: "WeChat клиента",
    f_product_ru: "Товар на русском",
    f_product_zh: "Товар на китайском",
    f_supplier: "Поставщик",
    f_link: "Ссылка на 1688 / Alibaba",
    f_qty: "Количество",
    f_price: "Цена за единицу, ¥",
    f_rate: "Курс ¥ → сом",
    f_weight: "Вес, кг",
    f_delivery: "Стоимость доставки, сом",
    f_paid: "Оплачено клиентом, сом",
    f_delivery_info: "Информация о доставке (видит клиент)",
    f_comment_client: "Комментарий для клиента (видит клиент)",
    f_comment_admin: "Внутренний комментарий (только вы)",

    // Расчёт
    c_title: "Расчёт",
    c_goods_cny: "Стоимость товара",
    c_goods_som: "Товар в сомах",
    c_delivery: "Доставка",
    c_total: "Итого",
    c_paid: "Оплачено",
    c_balance: "Остаток",

    // Карточка
    l_qty: "Количество",
    l_price: "Цена",
    l_rate: "Курс",
    l_weight: "Вес",
    l_goods_som: "Стоимость в сомах",
    l_delivery: "Доставка",
    l_total: "Итого",
    l_paid: "Оплачено",
    l_balance: "Остаток",
    l_supplier: "Поставщик",
    l_phone: "Телефон",
    l_wechat: "WeChat",
    l_link: "Ссылка",
    l_comment: "Комментарий",
    l_comment_admin: "Внутренний комментарий",
    l_comment_client: "Комментарий для клиента",
    l_delivery_info: "Информация о доставке",
    l_photos: "Фото",
    pcs: "шт",
    kg: "кг",
    som: "сом",

    // Сообщения
    empty_title: "Заказов пока нет",
    empty_text: "Нажмите «Новый заказ», чтобы добавить первый.",
    nothing_found: "Ничего не найдено. Измените поиск или фильтр.",
    show_more: "Показать ещё",
    loading: "Загрузка…",
    confirm_delete: "Удалить заказ № {n} вместе с фотографиями? Это нельзя отменить.",
    deleted: "Заказ удалён",
    saved: "Заказ сохранён",
    status_changed: "Статус обновлён",
    error_generic: "Что-то пошло не так. Проверьте интернет и попробуйте ещё раз.",
    error_session: "Сессия закончилась. Войдите заново.",
    dup_number: "Заказ с таким номером уже есть. Измените номер.",
    req_fields: "Заполните номер заказа, клиента и название товара.",
    photo_failed: "Не удалось загрузить фото: {n}",
    detail_title: "Заказ № {n}",

    // Ссылка клиенту
    link_title: "Ссылка для клиента",
    link_hint: "Клиент увидит только этот заказ и не сможет ничего изменить.",
    link_whatsapp: "Отправить в WhatsApp",
    link_open: "Открыть как клиент",
    wa_text: "Ваш заказ № {n}. Смотрите статус, оплату и фото по ссылке:",

    // Клиентская страница
    cl_order: "Заказ № {n}",
    cl_product: "Товар",
    cl_status: "Статус заказа",
    cl_payment: "Стоимость и оплата",
    cl_paid_full: "Оплачено полностью",
    cl_delivery_info: "Доставка",
    cl_comment: "Комментарий",
    cl_updated: "Обновлено",
    cl_not_found_title: "Заказ не найден",
    cl_not_found_text: "Проверьте ссылку. Если она не открывается, попросите отправить её ещё раз.",
    cl_cancelled: "Этот заказ отменён"
  },

  zh: {
    app_title: "Cargo China — 订单管理",

    login_title: "管理员登录",
    login_hint: "仅限系统所有者使用",
    email: "邮箱",
    password: "密码",
    login_btn: "登录",
    logging_in: "登录中…",
    logout: "退出",
    login_error: "邮箱或密码错误",
    no_access: "此账号没有管理权限",

    config_title: "请先填写 config.js",
    config_text: "打开 config.js 文件，填入 Supabase 项目地址和公开密钥（第 3 步）。",
    lib_missing: "supabase.js 文件未加载。请确认它与 index.html 放在同一文件夹。",

    warehouse_title: "中国仓库",
    copy_address: "复制地址",
    copied: "已复制",

    sum_orders: "订单总数",
    sum_total: "订单总金额",
    sum_paid: "已付款",
    sum_debt: "欠款",
    sum_note: "金额不含已取消的订单",

    filter_all: "全部",
    filter_new: "新订单",
    filter_awaiting_payment: "待付款",
    filter_purchasing: "采购中",
    filter_china_warehouse: "已入库",
    filter_in_transit: "运输中",
    filter_arrived: "已到货",
    filter_delivered: "已交付",
    filter_cancelled: "已取消",
    search_placeholder: "搜索：订单号、客户、电话、商品、供应商、微信",
    date_from: "起始日期",
    date_to: "截止日期",
    reset: "重置",

    new_order: "新订单",
    edit_order: "编辑订单",
    open: "查看",
    edit: "编辑",
    remove: "删除",
    change_status: "修改状态",
    client_link: "生成客户链接",
    save: "保存订单",
    saving: "保存中…",
    cancel: "取消",
    close: "关闭",
    copy: "复制",
    add_photos: "添加照片",

    status_new: "新订单",
    status_awaiting_payment: "待付款",
    status_purchasing: "采购中",
    status_china_warehouse: "中国仓库已入库",
    status_in_transit: "运输中",
    status_arrived: "已到货",
    status_delivered: "已交付客户",
    status_cancelled: "已取消",

    sec_main: "基本信息",
    sec_client: "客户",
    sec_product: "商品与供应商",
    sec_money: "价格与付款",
    sec_photos: "商品照片",
    sec_comments: "备注",
    f_order_number: "订单号",
    f_date: "日期",
    f_status: "状态",
    f_client: "客户",
    f_phone: "客户电话",
    f_wechat: "客户微信",
    f_product_ru: "商品（俄文）",
    f_product_zh: "商品（中文）",
    f_supplier: "供应商",
    f_link: "1688 / 阿里巴巴链接",
    f_qty: "数量",
    f_price: "单价（¥）",
    f_rate: "汇率 ¥ → 索姆",
    f_weight: "重量（公斤）",
    f_delivery: "运费（索姆）",
    f_paid: "客户已付款（索姆）",
    f_delivery_info: "物流信息（客户可见）",
    f_comment_client: "给客户的备注（客户可见）",
    f_comment_admin: "内部备注（仅自己可见）",

    c_title: "费用计算",
    c_goods_cny: "商品金额",
    c_goods_som: "商品金额（索姆）",
    c_delivery: "运费",
    c_total: "合计",
    c_paid: "已付款",
    c_balance: "欠款",

    l_qty: "数量",
    l_price: "价格",
    l_rate: "汇率",
    l_weight: "重量",
    l_goods_som: "商品金额（索姆）",
    l_delivery: "运费",
    l_total: "合计",
    l_paid: "已付款",
    l_balance: "欠款",
    l_supplier: "供应商",
    l_phone: "电话",
    l_wechat: "微信",
    l_link: "链接",
    l_comment: "备注",
    l_comment_admin: "内部备注",
    l_comment_client: "给客户的备注",
    l_delivery_info: "物流信息",
    l_photos: "照片",
    pcs: "件",
    kg: "公斤",
    som: "索姆",

    empty_title: "还没有订单",
    empty_text: "点击“新订单”添加第一个订单。",
    nothing_found: "没有找到结果，请修改搜索或筛选条件。",
    show_more: "显示更多",
    loading: "加载中…",
    confirm_delete: "确定删除订单 {n} 及其照片吗？此操作无法撤销。",
    deleted: "订单已删除",
    saved: "订单已保存",
    status_changed: "状态已更新",
    error_generic: "出错了，请检查网络后重试。",
    error_session: "登录已过期，请重新登录。",
    dup_number: "该订单号已存在，请修改订单号。",
    req_fields: "请填写订单号、客户和商品名称。",
    photo_failed: "照片上传失败：{n}",
    detail_title: "订单 {n}",

    link_title: "客户链接",
    link_hint: "客户只能查看这一个订单，无法修改任何内容。",
    link_whatsapp: "通过 WhatsApp 发送",
    link_open: "以客户身份打开",
    wa_text: "您的订单 {n}，请点击链接查看状态、付款和照片：",

    cl_order: "订单 {n}",
    cl_product: "商品",
    cl_status: "订单状态",
    cl_payment: "费用与付款",
    cl_paid_full: "已全额付款",
    cl_delivery_info: "物流",
    cl_comment: "备注",
    cl_updated: "更新时间",
    cl_not_found_title: "未找到订单",
    cl_not_found_text: "请检查链接。如果无法打开，请让对方重新发送。",
    cl_cancelled: "此订单已取消"
  }
};

var currentLang = (function () {
  try {
    var saved = localStorage.getItem("cc_lang");
    if (saved === "ru" || saved === "zh") return saved;
  } catch (e) { /* ignore */ }
  return "ru";
})();

function getLang() {
  return currentLang;
}

// t("key") — вернуть перевод. t("key", {n: 5}) — подставить {n}.
function t(key, vars) {
  var dict = I18N[currentLang] || I18N.ru;
  var text = dict[key];
  if (text === undefined) text = I18N.ru[key];
  if (text === undefined) return key;
  if (vars) {
    Object.keys(vars).forEach(function (k) {
      text = text.split("{" + k + "}").join(vars[k]);
    });
  }
  return text;
}

function setLang(lang) {
  if (lang !== "ru" && lang !== "zh") return;
  currentLang = lang;
  try { localStorage.setItem("cc_lang", lang); } catch (e) { /* ignore */ }
  applyI18n();
}

// Переводит все элементы с data-i18n и data-i18n-placeholder
function applyI18n() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "ru";
  document.title = t("app_title");
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-lang]").forEach(function (el) {
    el.classList.toggle("active", el.getAttribute("data-lang") === currentLang);
    el.setAttribute("aria-pressed", el.getAttribute("data-lang") === currentLang ? "true" : "false");
  });
}
