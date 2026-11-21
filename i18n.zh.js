// ULA FACTORY — словарь: 中文. Подключает i18n.js (скачивается только выбранный язык).
// Новые фразы добавлять во все четыре словаря: i18n.ru.js, i18n.en.js, i18n.zh.js, i18n.vi.js.
I18N.zh = {
  app_title: "ULA Factory — 中国订单管理",

  login_title: "登录",
  email: "邮箱",
  password: "密码",
  login_btn: "登录",
  logging_in: "登录中…",
  logout: "退出",
  login_error: "邮箱或密码错误",
  no_access: "此账号没有访问权限",

  config_title: "请先填写 config.js",
  config_text: "打开 config.js 文件，填入 Supabase 项目地址和公开密钥。",
  lib_missing: "supabase.js 文件未加载。请确认它与 index.html 放在同一文件夹。",

  nav_orders: "订单",

  nav_home: "首页",

  home_place: "下单",

  home_new_d: "商品、价格、运费、付款",

  home_link_d: "客户自己提交需求",

  home_import_d: "一次导入多个订单",

  home_quote_d: "向客户报多少钱",

  home_money: "订单金额",

  home_all_orders: "全部订单（{n}）›",
  nav_menu: "菜单",
  nav_clients: "客户",
  nav_suppliers: "供应商",
  suppliers_search: "按名称、联系人、电话或微信搜索",
  suppliers_count: "供应商：{n}",
  supplier_add: "添加供应商",
  supplier_save: "保存供应商",
  supplier_name: "公司或工厂名称",
  supplier_contact: "联系人",
  supplier_phone: "电话",
  supplier_wechat: "微信",
  supplier_city: "城市",
  supplier_category: "商品类别",
  supplier_address: "地址",
  supplier_notes: "备注（仅您可见）",
  suppliers_empty_title: "暂无供应商",
  suppliers_empty_text: "添加供应商以保存联系方式。",
  supplier_saved: "供应商已保存",
  supplier_deleted: "供应商已删除",
  supplier_confirm_delete: "删除供应商“{name}”？",
  nav_calc: "汇率",
  fx_title: "汇率计算器",
  fx_amount: "金额",
  fx_from_cur: "从",
  fx_to: "到",
  fx_swap: "互换",
  fx_use: "在新订单中使用此汇率",
  fx_used: "新订单将自动填入汇率 {r}",
  fx_updated: "汇率日期：{d}。来源：open.er-api.com（每日更新）。银行和兑换点的汇率可能不同。",
  fx_table: "1 单位货币折合 {c}",
  fx_error: "无法加载汇率，请检查网络后点击 ↻。",
  fx_loading: "正在加载汇率…",
  rq_title: "提交订单申请",
  rq_to: "卖家：{n}",
  rq_hint: "发送商品照片、链接或文字描述，并填写数量。需要多件商品？可添加更多卡片。我们会核算价格并联系您。",
  rq_link: "商品链接",
  rq_link_hint: "复制商品页面的地址。没有链接的话，请在下方描述商品。",
  rq_product: "商品名称或描述",
  rq_product_ph: "例如：耐克运动鞋，黑色，39–44码",
  rq_qty: "数量",
  rq_name: "您的姓名",
  rq_phone: "电话",
  rq_phone_hint: "请带国家区号，方便我们通过 WhatsApp 联系您",
  rq_telegram: "Telegram（选填）",
  rq_comment: "备注（选填）",
  rq_comment_ph: "颜色、尺码、期限、特殊要求",
  rq_send: "提交申请",
  rq_sending: "正在提交…",
  rq_consent: "提交申请即表示您同意我们处理您的姓名和电话，以便就订单联系您。",
  rq_e_link: "请检查链接，或用文字描述商品",
  rq_e_product: "请添加商品照片、链接或描述",
  rq_e_qty: "数量必须大于零",
  rq_sent_title: "申请已收到",
  rq_sent_text: "{n} 已收到您的申请，将核算价格并联系您。",
  rq_track: "查看申请进度",
  rq_track_hint: "通过此链接可查看订单状态并填写收货地址。请保存好它。",
  rq_again: "再提交一个申请",
  rq_nf_title: "链接已失效",
  rq_nf_text: "此申请链接已停用或已过期。请向卖家索取新链接。",
  rq_err_title: "无法打开",
  rq_err_load: "请检查网络并刷新页面。",
  rq_err_many: "短时间内申请过多，请稍后再试或直接联系卖家。",
  rq_err: "申请未能发送，请检查网络后重试。",
  rq_photos: "商品照片",
  rq_photos_hint: "最多 {n} 张：商品本身、截图、标签——任何有助于找到商品的图片。",
  rq_photo_add: "添加照片",
  rq_photos_max: "最多可添加 {n} 张照片",
  rq_by_photo: "按照片找货",
  rq_photo_fail: "申请已提交，但部分照片未上传成功。请通过 WhatsApp 发给卖家。",
  rq_m_buy: "采购价",
  rq_m_sell: "客户价",
  rq_m_supplier: "供应商或链接",
  rq_m_weight: "重量",
  rq_fill: "客户申请。请完善订单——未填写：{f}。",
  rq_fill_btn: "完善",
  rq_fill_left: "已保存。仍未填写：{f}。可以稍后补充。",
  rq_new_title: "🛍 新申请 № {n}",
  rq_new_toast: "新申请 № {n}。请打开并完善订单。",
  rq_new_many: "新申请：{n} 个。请打开并完善订单。",
  rq_item_n: "商品 {n}",
  rq_add_item: "再添加一件商品",
  rq_items_max: "一次申请最多 {n} 件商品，其余请另提交一次。",
  rq_you: "您的联系方式",
  rq_send_n: "提交申请（{n} 件商品）",
  rq_sent_many: "{n} 已收到您的申请，将逐件核算价格并联系您。",
  rq_left: "部分商品未发送成功：还剩 {n} 件。请点击下方按钮，稍后再次发送。",
  rq_finish: "返回未发送的商品",
  rq_tag: "申请",
  h_requests: "客户的新申请：{n}",
  cl_price_pending: "价格正在核算中，准备好后我们会通知您。",
  rl_btn: "申请链接",
  rl_title: "申请链接",
  rl_hint: "把它发给客户：客户粘贴商品链接并填写数量，您这里会立刻出现一个标记为“申请”的新订单。客户无需注册。",
  rl_active: "链接有效",
  rl_disabled: "链接已停用。创建链接后即可接收申请。",
  rl_create: "创建链接",
  rl_rotate: "更换链接",
  rl_revoke: "停用链接",
  rl_confirm_rotate: "确定更换链接吗？旧链接会立即失效，保存了旧链接的客户将无法提交申请。",
  rl_confirm_revoke: "确定停用链接吗？在您创建新链接之前，客户无法提交申请。",
  rl_created: "链接已创建",
  rl_created_copied: "链接已创建并复制",
  rl_revoked: "链接已停用",
  rl_wa_text: "您好！如需订购商品，请通过此链接提交申请（粘贴商品链接并填写数量），我来核算价格：",
  tm_btn: "团队",
  tm_title: "团队：助手",
  tm_hint: "助手使用自己的密码登录，在您的账户中工作：订单、客户、批次、供应商。助手不能删除、不能修改设置、也看不到利润报表。",
  tm_invites: "邀请（尚未接受）",
  tm_create: "邀请助手",
  tm_limits: "邀请链接有效期3天，仅限一人使用。最多5位助手。",
  tm_role_owner: "所有者",
  tm_role_staff: "助手",
  tm_remove: "移除",
  tm_cancel: "取消",
  tm_invite_until: "有效期至 {d}",
  tm_wa_text: "您好！请通过此链接注册并登录——您将在我的 ULA Factory 账户中工作：",
  tm_created: "邀请已创建",
  tm_created_copied: "邀请已创建，链接已复制",
  tm_confirm_remove: "要移除这位助手吗？他将无法再看到您的订单。",
  tm_removed: "助手已移除",
  tm_err_own: "您的账户中已有订单或客户，无法加入其他账户。",
  tm_err_full: "团队助手人数已达上限。",
  tm_err_many: "未使用的邀请过多，请取消不需要的。",
  tm_err_admin: "管理员不能成为助手。",
  tm_err_invalid: "邀请无效：已被使用或已过期。请索取新链接。",
  tm_joined: "完成！您现在以助手身份在该账户中工作。",
  tm_login_note: "您被邀请加入团队。登录或注册后即可进入账户。",
  rl_limits: "防垃圾保护：同一电话每小时最多 5 个申请，每个账户每小时最多 20 个。如果链接被公开传播，请更换它。",
  nav_shipments: "批次",
  sh_hint: "多个订单一起发货：重量和运费自动在订单之间分摊。",
  sh_new: "新建批次",
  sh_empty: "还没有批次。创建批次并添加订单，运费会按重量分摊。",
  sh_err_db: "数据库中尚未启用批次：请在 Supabase 运行 migration_16_shipments.sql。",
  sh_no_orders: "批次中还没有订单",
  sh_orders: "订单数：{n}",
  sh_weight: "重量：{w} kg",
  sh_per_kg: "约 {x} / kg",
  sh_flag_ok: "运费已分摊",
  sh_flag_recalc: "需要重新计算：打开并保存",
  sh_flag_noweight: "未填重量的订单：{n}",
  sh_open: "打开",
  sh_title_new: "新建批次",
  sh_f_name: "批次名称",
  sh_f_name_ph: "例如：广州 24.10",
  sh_f_cargo: "物流公司",
  sh_f_date: "发货日期",
  sh_f_tariff: "每公斤运价，{c}",
  sh_f_weight: "物流称重的批次重量，kg",
  sh_f_weight_hint: "留空则使用订单重量之和",
  sh_f_total: "物流账单金额，{c}",
  sh_f_total_hint: "填写后不再使用运价",
  sh_f_notes: "备注",
  sh_sum_empty: "向批次添加订单后，这里会显示计算结果。",
  sh_sum_none: "填写每公斤运价或物流账单金额，运费就会在订单之间分摊。",
  sh_sum_weights: "订单重量：{a} kg。批次重量：{b} kg。",
  sh_sum_total: "分摊：{x}（约 {t} / kg）",
  sh_w_noweight: "未填重量的订单：{n}。它们不分摊运费，请在订单中填写重量。",
  sh_w_allnoweight: "所有订单都没有重量，无法分摊。请在订单中填写重量。",
  sh_w_diff: "批次重量与订单重量之和相差 {d} kg：差额将按比例分摊到各订单。",
  sh_w_rate: "没有保存运费汇率 {a}→{b}。请在“报价计算”中保存（“保存汇率”按钮）。目前 {b} 订单沿用原汇率。",
  sh_orders_title: "批次中的订单",
  sh_no_weight: "无重量",
  sh_remove: "移出批次",
  sh_add: "添加订单",
  sh_add_search: "按编号、客户或商品搜索",
  sh_add_none: "没有可添加的订单（不在其他批次、未取消、未交付）。",
  sh_add_apply: "添加所选（{n}）",
  sh_status_title: "整批状态",
  sh_status_apply: "应用到全部",
  sh_status_done: "已更改状态的订单：{n}",
  sh_notify_title: "通知客户",
  sh_notify_btn: "通知",
  sh_removed_note: "已移出批次的订单：{n}。它们保留原运费，请在订单中调整。",
  sh_save: "保存并分摊",
  sh_saved: "批次已保存，运费已分摊到订单",
  sh_saved_nocost: "批次已保存。填写运价或账单金额后即可分摊运费。",
  sh_saved_noweight: "批次已保存。订单没有重量，因此未分摊运费。",
  sh_err_name: "请填写批次名称",
  sh_delete: "删除批次",
  sh_delete_confirm: "删除批次“{n}”？订单会保留但移出批次（其运费保持不变）。",
  sh_tag: "批次",
  sh_tag_short: "批次",
  sh_order_note: "该订单属于批次“{n}”：运费由批次分摊。手动修改运费金额会在下次重新计算时被覆盖。",
  nav_report: "报表",
  r_hint: "您赚了多少：按月份、客户和商品。",
  r_p_month: "本月",
  r_p_3m: "近3个月",
  r_p_12m: "近12个月",
  r_p_all: "全部",
  r_v_months: "按月",
  r_v_clients: "按客户",
  r_v_products: "按商品",
  r_profit: "利润",
  r_revenue: "收入",
  r_cost: "成本",
  r_paid: "客户已付",
  r_debt: "尚欠",
  r_orders: "订单数：{n}",
  r_qty: "数量：{n}",
  r_rev_short: "收入 {x}",
  r_markup: "加价 {n}%",
  r_share: "占利润 {n}%",
  r_empty: "还没有填写客户价格的订单。在订单中填写客户价格后，利润会显示在这里。",
  r_note: "统计已填写客户价格的订单，不含已取消订单。月份按下单日期。利润 = 客户价格 − 成本；加价 = 利润 / 成本。未付余额在客户付款后到账。",
  r_unpriced: "未填客户价格（不统计）：{n}。",
  r_col_month: "月份",
  r_col_client: "客户",
  r_col_product: "商品",
  r_col_orders: "订单数",
  r_col_qty: "数量",
  r_col_revenue: "收入",
  r_col_cost: "成本",
  r_col_profit: "利润",
  r_col_markup: "加价，%",
  r_col_paid: "已付",
  r_col_debt: "欠款",
  r_col_share: "利润占比，%",
  r_col_cur: "币种",
  nav_debts: "欠款",
  d_hint: "谁欠款、欠多少、多久了。点击“提醒”，文字已备好。",
  d_total: "客户欠您",
  d_clients: "客户数：{n}",
  d_filter_all: "全部",
  d_filter_overdue: "已逾期",
  d_empty: "没有欠款，所有客户都已付清",
  d_empty_overdue: "没有逾期欠款",
  d_overdue: "已逾期 {n} 天",
  d_days: "{n} 天",
  d_orders: "订单数：{n}",
  d_at_client: "货物已在客户手中",
  d_reminded: "已提醒：{when}",
  d_never: "尚未提醒",
  d_today: "今天",
  d_ago: "{n} 天前",
  d_remind: "提醒付款",
  d_remind_title: "付款提醒",
  d_note: "欠款只统计已填写客户价格的订单。逾期：自下单或最近一次付款起满 7 天。“已提醒”标记保存在此浏览器中。",
  d_unpriced: "未列入（未填客户价格）：{n}。",
  nav_quote: "报价计算",
  q_title: "给客户报价",
  q_hint: "客户问“多少钱？”——三步即可得到带价格的回复。",
  q_name: "商品名称（选填）",
  q_link: "商品链接，如 1688（选填）",
  q_weight_total: "总重量，kg",
  q_weight_unit: "单件重量，kg",
  q_wm_total: "按总重量",
  q_wm_unit: "按单件",
  q_margin: "加价",
  q_round: "价格向上取整",
  q_round_0: "不取整",
  q_round_n: "取整到 {n}",
  q_result: "结果",
  q_need: "填写数量、价格和汇率后，结果将显示在这里。",
  q_price_client: "客户价格",
  q_unit: "每件",
  q_rate_market: "汇率栏中是市场汇率（仅供参考）。请填写您自己的汇率并点击“保存汇率”。",
  q_warn_drate: "请填写运费汇率，否则运费不会计入。",
  q_save_rate: "保存汇率",
  q_msg_title: "回复客户",
  q_msg_note: "回复中只有客户价格，成本和利润不会显示。",
  q_order: "用报价创建订单",
  q_clear: "清空",
  client_notify: "通知客户",
  notify_title: "发给客户的消息",
  notify_after_status: "状态：{s}。通知客户吗？",
  notify_lang: "消息语言",
  notify_to: "收件人：{p}",
  notify_to_none: "未填写客户电话（需带国家区号，如 +…）。WhatsApp 将让您自选联系人。",
  notify_wa: "通过 WhatsApp 发送",
  notify_tg: "通过 Telegram 发送",
  notify_tg_user: "打开与 @{u} 的聊天",
  notify_tg_copied: "文字已复制，请粘贴到聊天中",
  notify_no_link: "客户链接已停用，因此消息中没有链接。请在“客户链接”中新建。",
  notify_no_price: "未填写客户价格，因此消息中不含金额。",
  notify_auto: "更改状态后提示",
  notify_later: "暂不通知",
  f_dates: "日期",
  more_actions: "更多操作",
  tg_title: "Telegram 通知",
  tg_step1: "在 Telegram 中打开 @BotFather → Start → 发送 /newbot → 设置名称和以 bot 结尾的用户名 → 复制 token。",
  tg_step2: "Supabase → Edge Functions → Secrets → 添加 TELEGRAM_BOT_TOKEN，值为 token。",
  tg_step3: "在 Telegram 中打开您的新机器人并点击 Start。",
  tg_step4: "点击下方按钮，机器人会发送“✅ 通知已连接”。",
  tg_connect: "连接 Telegram",
  tg_on: "✅ 已连接：{name}。机器人 {bot} 会通知每一条新咨询。",
  tg_off_bot: "已找到机器人 {bot}，但尚未连接。请在机器人中点击 Start，然后点击下方按钮。",
  tg_no_token: "机器人尚未添加到 Supabase（第 2 步）。",
  tg_bad_token: "机器人 token 不正确，请检查 TELEGRAM_BOT_TOKEN（第 2 步）。",
  tg_no_start: "机器人收不到您的消息。请在 Telegram 中打开机器人，点击 Start 后重试。",
  tg_connected: "完成！请查看 Telegram。",
  tg_error: "无法连接机器人，请重试。",
  support: "客服",
  nav_support: "客服",
  support_title: "技术支持",
  support_hint: "遇到问题或有疑问？请在这里留言，管理员会在此窗口回复。",
  support_placeholder: "消息…",
  sp_attach: "附加照片或文件",
  sp_file: "文件",
  sp_photo: "截图",
  sp_too_many_files: "一次最多 6 个文件",
  sp_bad_type: "无法发送此类文件。可发送：照片、视频、PDF、Word、Excel、文本",
  sp_too_big: "文件超过 20 MB",
  sp_upload_failed: "上传失败 — 点击消息重试",
  sp_typing: "正在输入",
  sp_online: "在线",
  sp_team: "ULA Factory 客服 · 将在此回复",
  sp_today: "今天",
  sp_yesterday: "昨天",
  sp_retry: "未发送 — 点击重试",
  support_send: "发送",
  support_note: "消息会自动附带技术信息：网站页面、浏览器和最近的错误。不会发送密码和客户资料。",
  support_empty: "您好！请写下遇到的问题，我们会在此窗口回复。有新回复时 💬 图标上会显示红色数字。",
  support_none: "暂无消息。",
  support_sent: "消息已发送",
  support_new: "有新的客服消息",
  support_reply_new: "客服已回复，请打开 💬",
  fx_new_req: "新的兑换申请",
  push_on: "开启通知",
  push_retry: "再试一次",
  push_t_off: "通知已关闭",
  push_d_off: "开启后，即使应用关闭，也能听到提示音并收到申请和消息通知。",
  push_t_fail: "通知未连接",
  push_d_fail: "已授权，但手机未订阅。请再点一次；如仍不行，请联系客服。",
  push_t_denied: "通知被禁止",
  push_d_denied: "您已禁止通知。请在手机设置中开启：设置 → ULA（或浏览器）→ 通知 → 允许。然后重新打开应用。",
  push_t_ios: "在 iPhone 上，只有从应用中才能收到通知",
  push_d_ios: "点击“分享”（带箭头的方框）→“添加到主屏幕”。从主屏幕打开 ULA，在这里开启通知。",
  push_ok_toast: "通知已开启，马上会收到一条测试通知",
  push_fail_toast: "无法连接通知",
  push_test_body: "通知正常 ✅",
  kyc_new_ping: "新的身份审核，请打开“兑换”",
  kyc_approve: "批准并开通",
  kyc_ok_done: "完成：买手已通过审核，已开通客户兑换",
  kyc_no_done: "已拒绝，买手会看到原因",
  kyc_t_front: "证件",
  kyc_t_back: "背面",
  kyc_t_selfie: "自拍",
  support_too_many: "消息太多，请稍后再试。",
  support_admin_title: "采购员的咨询",
  support_admin_hint: "这里是采购员发给技术支持的消息。新消息在上方并带红色数字。点击即可查看并回复。",
  support_no_threads: "暂无咨询。",
  support_tech: "技术信息",
  support_you: "您",
  support_team: "客服",
  support_buyer: "采购员",
  q_rates_title: "我的汇率",
  q_rates_hint: "您保存的汇率，会自动填入报价和新订单。点击汇率可选择该货币对。",
  fx_my_label: "我的汇率：1 {a} = ? {b}",
  fx_my_save: "保存我的汇率",
  fx_my_bad: "请输入大于零的汇率",
  fx_my_deleted: "汇率已删除",
  fx_my_empty: "还没有自定义汇率。请在上方选择货币，输入汇率并点击“保存我的汇率”。",
  fx_by_my: "按您的汇率",
  fx_by_market: "按市场汇率（未设定自己的汇率）",
  fx_market: "市场汇率仅供参考：{r}。留空并点击保存即可使用。",

  warehouse_title: "中国仓库",
  copy_address: "复制地址",
  copied: "已复制",

  sum_orders: "订单总数",
  sum_total: "客户应付总额",
  sum_paid: "已付款",
  sum_debt: "客户欠款",
  sum_note: "不含已取消订单，不同币种分别统计。",
  as_title: "今日待办",
  as_admin_title: "管理员助手",
  ai_title: "AI 助手",
  ai_placeholder: "可以询问采购商、订单、利润等任何问题，也可以让它给供应商写消息",
  ai_send: "提问",
  ai_thinking: "思考中…",
  ai_note: "问题由 Google Gemini 处理。不会发送客户姓名、电话和地址。",
  ai_ex1: "本月哪个采购商利润最高？",
  ai_ex2: "现在有多少订单在运输中？",
  ai_ex3: "用中文给供应商写：发货推迟 3 天",
  ai_ex4: "哪些采购商的客户欠款最多？",
  ai_err_key: "AI 尚未连接：需要在 Supabase 中添加 Gemini 密钥。",
  ai_err_limit: "提问太频繁，请稍等一分钟。",
  ai_err: "AI 暂时无响应，请一分钟后重试。",
  as_all_good: "一切正常，没有需要处理的问题",
  as_show: "查看",
  as_open: "打开",
  as_filter: "当前显示：{t}",
  h_no_price: "未填写客户价格的订单：{n} 个，无法计算利润。",
  h_no_address: "客户未填写收货地址：{n} 个订单。请把订单链接发给客户。",
  h_loss: "订单 {num} 亏损：{sum}，请检查客户价格。",
  h_no_rate: "未填写汇率的订单：{n} 个，金额计算不正确。",
  h_stuck: "订单 {num} 已 {days} 天未更新，请为客户更新状态。",
  h_debt: "客户 {name} 欠款 {sum}（订单 {num} 已到货）。",
  h_no_wh: "未填写中国仓库地址，请在设置中添加。",
  h_profit_month: "本月利润：{sum}。",
  ha_new: "最近 7 天新增采购商：{n} 位。",
  ha_idle: "{name} 注册已 {days} 天，还没有创建订单。",
  ha_blocked: "已停用的采购商：{n} 位。",
  ha_total: "工作台共 {n} 个，所有订单共 {o} 个。",

  filter_all: "全部",
  filter_new: "新订单",
  filter_awaiting_payment: "待付款",
  filter_purchasing: "采购中",
  filter_china_warehouse: "已入库",
  filter_in_transit: "运输中",
  filter_arrived: "已到货",
  filter_delivered: "已交付",
  filter_cancelled: "已取消",
  search_placeholder: "搜索：订单号、客户、电话、城市、商品、供应商",
  date_from: "起始日期",
  date_to: "截止日期",
  reset: "重置",

  new_order: "新订单",
  edit_order: "编辑订单",
  open: "查看",
  edit: "编辑",
  remove: "删除",
  change_status: "修改状态",
  client_link: "客户链接",
  save: "保存订单",
  saving: "保存中…",
  cancel: "取消",
  close: "关闭",
  a11y_back: "返回",
  a11y_prev: "上一张照片",
  a11y_next: "下一张照片",
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
  f_supplier_wechat: "供应商微信",
  l_supplier_wechat: "供应商微信",
  f_purchase_currency: "采购币种（供应商）",
  f_client_currency: "客户币种",
  f_price_cur: "单价（{c}）",
  f_rate_cur: "汇率：1 {a} = ? {b}",
  f_rate_same: "汇率（币种相同）",
  f_delivery_cur: "运费金额（{c}）",
  f_paid_cur: "客户已付款（{c}）",
  f_markup: "加价（%）",
  f_markup_hint: "填写百分比，客户价格会自动计算",
  f_client_price_cur: "客户价格（{c}）",
  f_client_price_hint: "客户能看到此价格。成本和利润只有您能看到。",
  c_cost: "成本（商品 + 运费）",
  c_client_price: "客户价格",
  c_profit: "您的利润",
  l_cost: "成本",
  l_client_price: "应付金额",
  l_profit: "利润",
  sum_profit: "利润",
  cl_due: "应付金额",
  cl_left: "待付金额",
  no_price: "未填写客户价格",
  k_goods: "商品",
  k_delivery: "运费（物流）",
  k_payment: "客户付款",
  f_delivery_currency: "运费币种",
  f_tariff_cur: "每公斤运价（{c}）",
  f_delivery_rate_cur: "运费汇率：1 {a} = ? {b}",
  f_delivery_hint: "自动计算：重量 × 运价，也可以手动填写。",
  s_def_delivery: "默认运费币种",
  s_def_tariff: "默认每公斤运价",
  s_def_purchase: "默认采购币种",
  s_def_client: "默认客户币种",
  s_currency_hint: "新订单会自动使用，每个订单中也可以单独修改。",
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
  c_goods_som: "商品金额（客户币种）",
  c_delivery: "运费",
  c_total: "合计",
  c_paid: "已付款",
  c_balance: "欠款",

  l_qty: "数量",
  l_price: "价格",
  l_rate: "汇率",
  l_weight: "重量",
  l_goods_som: "商品金额（客户币种）",
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
  l_name: "姓名",
  l_telegram: "Telegram",
  l_city: "城市",
  l_address: "地址",
  l_pickup: "自提点",
  l_orders: "订单",
  l_added: "添加时间",
  pcs: "件",
  kg: "公斤",
  som: "索姆",

  cb_title: "客户收货信息",
  cb_empty: "客户尚未填写信息。请把订单链接发给客户。",
  no_delivery_data: "无地址",

  clients_search: "按姓名或电话搜索",
  clients_count: "客户：{n}",
  export_csv: "导出 Excel",
  export_done: "Excel 文件已下载",
  x_made: "导出日期 {d}",
  x_count: "记录数：{n}",
  x_total: "合计",
  bulk_select: "多选",
  bulk_done_btn: "完成",
  bulk_n: "已选：{n}",
  bulk_all: "全选（{n}）",
  bulk_none: "取消全选",
  bulk_status: "状态…",
  bulk_cancel: "取消",
  bulk_set_for: "为 {n} 个订单设置新状态",
  bulk_same: "所选订单已是该状态",
  bulk_changed: "已更改订单状态：{n}",
  bulk_q_title: "通知客户",
  bulk_q_hint: "状态已更改。点击每个订单的“通知”，将打开现成的 WhatsApp 文本。",
  bulk_q_next: "通知下一位（剩余 {n}）",
  bulk_q_all: "已全部通知",
  bulk_q_again: "再次",
  q_for: "为申请 № {n}（{name}）报价",
  q_for_cancel: "取消关联",
  q_apply: "应用到申请",
  rq_calc: "计算价格",
  menu_main: "主要",
  menu_money: "资金",
  menu_more: "工具",
  tk_late_by: "预计日期已过去 {n} 天。",
  tk_ask: "询问采购员",
  tk_src_dates: "到达日期由您的采购员填写，不是承运商数据。",
  tk_src_days: "从发货起的天数由您的采购员填写，不是承运商数据。",
  tk_src_usual: "这是该货运的一般时效，不是您包裹的承运商数据。",
  fin_approx: "利润为估算值：按录入的价格、汇率和运费计算，未计入退款、手续费和汇差。",
  fin_approx_short: "≈ 未含退款和手续费",
  im_steps: "导入步骤",
  im_s_file: "文件",
  im_s_map: "列",
  im_s_check: "检查",
  im_s_done: "完成",
  im_next: "检查各行",
  im_back_cols: "返回列设置",
  im_dups_file: "文件中重复：{n} 行，只导入一次。",
  im_c_ready: "将导入",
  im_c_warn: "有提示",
  im_c_skip: "跳过",
  im_c_total: "文件行数",
  im_c_issues: "逐行提示",
  im_c_all_ok: "所有行都没有问题。",
  im_c_row: "第 {n} 行",
  im_c_row_photo: "第 {n} 条",
  im_c_will_load: "将导入",
  im_c_will_skip: "将跳过",
  im_c_more: "还有 {n} 行有提示，全部在报告中。",
  im_c_safe: "点击“导入”之前工作区不会有任何变化。如果导入出错，不会只导入一部分订单。",
  im_report: "下载检查报告 (CSV)",
  im_rep_line: "行",
  im_rep_result: "结果",
  im_rep_notes: "提示",
  im_rep_ok: "将导入",
  im_rep_ok_warn: "将导入，请核对",
  im_rep_skip: "跳过",
  im_r_no_client: "没有客户姓名",
  im_r_dup_cabinet: "工作区中已有此订单",
  im_r_dup_file: "与第 {n} 行重复",
  im_r_date: "无法识别日期，将使用今天的日期",
  im_r_status: "无法识别状态，将使用默认状态",
  im_r_price: "金额不是数字，将留空",
  im_r_paid: "付款不是数字，记为 0",
  im_r_qty: "无法识别数量，记为 1 件",
  im_r_phone: "电话没有国家代码，按原样保存",
  im_r_overpaid: "已付金额超过总额，请核对",
  im_r_formula: "文本类似 Excel 公式，已去掉公式符号",
  im_r_cost: "没有人民币汇率，成本记为运费",
  im_r_unsure: "字迹不清，请与照片核对",
  im_failed_none: "未导入任何内容：保存时出错。工作区没有任何变化，可以再试一次。",
  im_rolled_back: "导入因错误中断。已导入的订单（{n}）已自动删除，工作区没有任何变化。",
  cc_open: "客户卡片",
  cc_title: "客户卡片",
  cc_none: "未找到客户。请刷新客户列表。",
  cc_call: "打电话",
  cc_write: "联系客户",
  cc_no_contact: "没有带国家代码的电话或 Telegram，无法从这里联系。",
  cc_orders: "订单",
  cc_active: "进行中",
  cc_debt: "欠款",
  cc_overdue: "逾期",
  cc_paid_total: "订单已付：{s}",
  cc_new_order: "新订单",
  cc_repeat_last: "再次下单 № {n}",
  cc_open_debt: "查看欠款",
  cc_wallet: "余额",
  cc_orders_list: "订单",
  cc_left: "剩余 {s}",
  cc_more: "还有 {n} 个订单，请在“订单”中查看",
  cc_no_orders: "暂无订单。",
  cc_payments: "付款",
  cc_no_payments: "历史中没有付款记录。",
  cc_history: "状态变更",
  cc_no_history: "暂无状态记录。",
  tpl_title: "快速开始：",
  tpl_1688: "1688 订单",
  tpl_taobao: "淘宝订单",
  tpl_repeat: "再次下单",
  tpl_note_platform: "“{name}”模板：以人民币采购，使用今天的汇率，平台已填入供应商。请粘贴商品链接。所有内容都可以修改。",
  tpl_note_repeat: "重复订单 № {n}。已复制客户、商品、供应商、币种和运费单价；汇率为今天的汇率。客户价格、付款、重量、快递单号、照片和备注不会复制，请重新填写。",
  tpl_note_addr: "收货地址未复制：地址尚未确认，请向客户核实。",
  gm_f_client: "客户电话",
  gm_f_photo: "商品照片",
  gm_f_track: "快递单号",
  gm_ring: "已填写 {p}%",
  gm_full: "订单已完整填写",
  gm_fill_title: "已填写 {p}%",
  gm_fill_n: "{a} / {b}",
  gm_sum: "完整填写：{a} / {b}",
  gm_full_toast: "订单已完整填写！🎉",
  gm_alldone: "今天的事都做完了！",
  gm_alldone_toast: "今天的任务全部完成！🎉",
  gm_alldone_streak: "连续天数：{n}。继续加油！",
  gm_alldone_first: "连续第一天，明天就是第二天！",
  gm_best: "最高纪录：连续 {n} 天",
  gm_streak_ok: "连续天数：{n}",
  gm_streak_keep: "连续天数：{n} — 完成今天的任务以保持连续",
  gm_week: "上周总结",
  gm_w_orders: "新订单",
  gm_w_done: "已交付",
  gm_w_clients: "新客户",
  gm_level: "你的等级",
  gm_points: "{n} 分",
  gm_lv_novice: "新手",
  gm_lv_buyer: "采购员",
  gm_lv_skilled: "熟手",
  gm_lv_pro: "专家",
  gm_lv_master: "ULA 大师",
  gm_lv_next: "距离“{l}”还差 {n} 分",
  gm_lv_max: "最高等级 — 你是 ULA 大师",
  gm_how: "如何获得积分",
  gm_how_text: "交付一个订单 10 分，完整填写一个订单 5 分，新客户 2 分，回头客再加 10 分。积分按工作区订单计算，所有设备上都一样。",
  gm_rw_frame: "“采购员”等级：头像边框",
  gm_rw_gold: "“专家”等级：金色按钮",
  gm_lvup: "升级了！",
  gm_lvup_ok: "太好了！",
  gm_badges: "徽章",
  gm_badge_new: "新徽章：“{b}”",
  pf_col_gold: "金色",
  gm_b_first: "第一个订单",
  gm_b_first_how: "添加第一个订单",
  gm_b_deliv1: "首次交付",
  gm_b_deliv1_how: "交付第一个订单",
  gm_b_deliv10: "交付 10 单",
  gm_b_deliv10_how: "交付 10 个订单",
  gm_b_deliv50: "交付 50 单",
  gm_b_deliv50_how: "交付 50 个订单",
  gm_b_repeat: "回头客",
  gm_b_repeat_how: "有客户下了第二单",
  gm_b_clients10: "10 位客户",
  gm_b_clients10_how: "与 10 位客户合作",
  gm_b_full10: "细心",
  gm_b_full10_how: "完整填写 10 个订单",
  gm_b_tracked: "全部有单号",
  gm_b_tracked_how: "所有已发货订单（5 个以上）都有快递单号",
  gm_b_paid: "无欠款",
  gm_b_paid_how: "5 个以上已交付订单全部付清",
  gm_b_alldone: "全部完成",
  gm_b_alldone_how: "完成今天的所有任务",
  gm_b_streak7: "连续一周",
  gm_b_streak7_how: "连续 7 天完成所有任务",
  menu_goods: "商品与物流",
  menu_admin: "管理",
  nav_fmap: "工厂地图",
  nav_all: "全部栏目",
  r_back: "← 返回分析",
  an_detail: "详情：按月份、客户和商品",
  s_menu_sections: "菜单栏目",
  s_show_shipments: "显示“批次”",
  s_show_suppliers: "显示“供应商”",
  ob_title: "从这4步开始",
  ob_progress: "{a}/{b}",
  ob_wh: "填写中国仓库地址",
  ob_rates: "设置您自己的汇率",
  ob_link: "创建客户申请链接",
  ob_order: "添加第一个订单",
  ob_hide: "隐藏提示",
  tgw_title: "Telegram：客户申请",
  tgw_hint: "连接 Telegram 后，新的客户申请会由机器人发到您的聊天中，无需反复查看网站。",
  tgw_off: "Telegram 未连接。",
  tgw_on: "已连接：{n}。新申请会发到此聊天。",
  tgw_unavailable: "暂不可用，请稍后再试。",
  tgw_start: "连接 Telegram",
  tgw_open: "1. 打开 Telegram 并点击 Start",
  tgw_check: "2. 我已点击 Start — 检查",
  tgw_disable: "断开 Telegram",
  tgw_done: "Telegram 已连接",
  tgw_no_bot: "无法联系机器人，请联系技术支持。",
  tgw_no_start: "没有看到 Start。请打开链接，在 Telegram 中点击 Start 后再检查。",
  tgw_expired: "连接时间已过，请重新开始。",
  tgw_confirm_off: "要断开申请的 Telegram 通知吗？",
  tgw_off_done: "Telegram 已断开",
  pay_owe: "欠款 {s}",
  pay_full: "已全部付清",
  cl_page_hint: "您的所有客户：联系方式、收货地址及其订单。",
  sup_page_hint: "您采购的中国工厂和卖家。",
  s_current_password: "当前密码",
  s_current_hint: "仅在修改密码时需要。",
  e_current_password: "修改密码需要输入当前密码。",
  e_current_wrong: "当前密码不正确。",
  password_repeat: "再次输入密码",
  e_password_match: "两次密码不一致，请在两个框中输入相同的密码。",
  mfa_title: "验证码登录 (2FA)",
  mfa_hint: "额外保护：输入密码后，网站会要求手机应用中的6位验证码。即使密码被盗，没有您的手机也无法登录。",
  mfa_off: "验证码登录未开启。",
  mfa_on: "验证码登录已开启。",
  mfa_start: "开启验证码登录",
  mfa_disable: "关闭验证码登录",
  mfa_step1: "在手机上安装 Google Authenticator（或 Authy、1Password）。",
  mfa_step2: "在应用中点击“添加”并扫描此二维码。若无法扫描，请手动输入密钥。",
  mfa_secret: "密钥：",
  mfa_step3: "应用中的6位验证码",
  mfa_confirm: "确认并开启",
  mfa_cancel: "取消",
  mfa_err_code: "请输入应用中的6位数字。",
  mfa_err_wrong: "验证码错误。请检查手机时间后重试。",
  mfa_done: "验证码登录已开启",
  mfa_off_done: "验证码登录已关闭",
  mfa_confirm_off: "要关闭验证码登录吗？账号的安全性会降低。",
  mfa_confirm_off_admin: "要关闭管理员的验证码登录吗？能看到所有买手的账号安全性会降低。",
  mfa_login_title: "输入验证码",
  mfa_login_hint: "打开手机上的验证器应用，输入此网站的6位验证码。",
  mfa_login_btn: "登录",
  mfa_banner: "请开启验证码登录：您的账号可看到所有买手，应优先保护。",
  mfa_banner_btn: "开启",
  mfa_off_code: "要关闭，请输入应用中当前的6位验证码",
  captcha_err: "“我不是机器人”验证失败。请刷新页面后重试。",
  tour_btn: "新手教程",
  tour_step: "第 {a} 步，共 {b} 步",
  tour_start: "开始",
  tour_next: "下一步",
  tour_back: "上一步",
  tour_skip: "跳过",
  tour_finish: "开始工作",
  tour_welcome_t: "欢迎使用 ULA Factory！",
  tour_welcome: "一分钟带您了解如何使用。可以跳过，之后随时通过菜单 →“新手教程”回来。",
  tour_menu_t: "栏目",
  tour_menu: "所有栏目都在这里：订单、客户、欠款、数据分析、报价。点击即可切换。",
  tour_wh_t: "中国仓库",
  tour_wh: "这是您的仓库地址。点击“复制地址”发给供应商。通过“修改”填写您自己的地址。",
  tour_link_t: "申请链接",
  tour_link: "创建链接并通过聊天软件发给客户。客户自己留下商品链接和数量，您这边会出现新订单。",
  tour_new_t: "新订单",
  tour_new: "这样手动添加订单：客户、商品、价格、重量。状态、欠款和利润会自动计算。",
  tour_chips_t: "订单状态",
  tour_chips: "按阶段查看订单：新订单、待付款、运输中等。点击状态即可只看这类订单。",
  tour_card_t: "订单卡片",
  tour_card: "可看到金额、已付款和欠款。“通知客户”会准备好 WhatsApp 文本。“⋯”按钮可打开客户链接、编辑和更改状态。",
  tour_bulk_t: "多选",
  tour_bulk: "勾选多个订单，一次更改全部状态。之后网站会提示需要通知哪些客户。",
  tour_menu2_t: "资金与工具",
  tour_menu2: "欠款：谁欠多少并有现成的提醒。数据分析：利润和图表。报价：快速回复客户“多少钱”。",
  tour_fx_t: "货币兑换",
  tour_fx: "需要用人民币付款给供应商？在这里与经过验证的人兑换。确认收款前资金由网站托管，有争议时客服会协助。",
  tour_settings_t: "设置",
  tour_settings: "这里有汇率和币种、仓库、申请的 Telegram 通知、验证码登录 (2FA) 和团队助手。",
  tour_support_t: "需要帮助？",
  tour_support: "有问题或不明白？点击这里留言，我们会在窗口中回复。",
  tour_done_t: "完成！",
  tour_done: "请从订单页的“从这4步开始”卡片入手：仓库、汇率、申请链接和第一个订单。随时可通过菜单 →“新手教程”重看。",
  refresh_menu: "刷新数据",
  forgot_link: "忘记密码？",
  reset_title: "找回密码",
  reset_hint: "输入您注册时使用的邮箱，我们会发送一封带链接的邮件，用于设置新密码。",
  reset_send: "发送邮件",
  reset_sent: "如果 {e} 已注册，我们已向其发送带链接的邮件。请检查收件箱和垃圾邮件。",
  reset_wait: "邮件刚发送过，请等待一分钟后重试。",
  newpass_title: "新密码",
  newpass_hint: "设置新密码并输入两次，至少8位。",
  newpass_save: "保存并登录",
  auth_tag: "买手工作台：中国订单尽在掌握",
  auth_b1: "订单、付款和物流集中管理",
  auth_b2: "客户通过链接自行查看订单",
  auth_b3: "利润和欠款一目了然",
  auth_err_google: "Google 无法完成登录。Supabase 中的 Google 密钥可能已过期或不正确。请暂时使用邮箱和密码登录。修复方法：Google Cloud → APIs & Services → Credentials → 选择 OAuth 客户端 → 创建新的 Client secret；然后进入 Supabase → Authentication → Sign In / Providers → Google → 粘贴密钥并点击 Save。请勿把密钥发给他人。",
  auth_err_expired: "邮件中的链接已过期或已使用。请点击“忘记密码？”重新获取。",
  auth_err_generic: "登录失败，请重试",
  nav_shop: "店铺",
  sh2_page_hint: "您的小店：添加带图片和价格的商品，把一个链接发给客户。",
  sh2_add: "商品",
  sh2_edit: "编辑商品",
  sh2_link_title: "店铺链接",
  sh2_link_off: "尚未创建链接。创建后可发到 WhatsApp、Instagram、Telegram。",
  sh2_link_make: "创建店铺链接",
  sh2_wa_text: "您好！我的中国商品——请挑选并提交申请：",
  sh2_none: "暂无商品。点击“+ 商品”，添加图片、名称和价格。",
  sh2_hidden: "已隐藏",
  sh2_saved: "商品已保存",
  sh2_err_db: "该功能尚未启用，请联系技术支持。",
  sh2_photo_pick: "选择图片",
  sh2_photo_del: "移除图片",
  sh2_f_title: "商品名称",
  sh2_f_price: "客户单价（可选）",
  sh2_f_desc: "描述：尺码、颜色、周期（可选）",
  sh2_f_active: "在店铺中显示",
  sh2_e_title: "请输入商品名称",
  sh2_e_price: "请检查价格",
  sh2_e_photo: "请选择图片（JPG 或 PNG）",
  sh2_confirm_del: "要从店铺删除“{n}”吗？",
  sh2_title: "店铺",
  sh2_hint: "挑选商品并提交申请，卖家会联系您。",
  sh2_empty: "暂无商品，请稍后再来。",
  sh2_price_ask: "价格面议",
  sh2_all: "全部商品",
  sh2_order: "下单",
  sh2_sent_text: "{n} 已收到您的订单，很快会联系您。",
  sh2_back: "返回店铺",
  sh2_gone: "该商品已下架，请返回店铺选择其他商品。",
  sh2_nf_title: "未找到店铺",
  sh2_nf_text: "链接已关闭或过期，请向卖家索取新链接。",
  rq_e_tg: "请检查 Telegram 用户名：5–32 位拉丁字母、数字或 _",
  bc_btn: "群发",
  bc_title: "给客户群发消息",
  bc_hint: "选择发给谁和内容。点击每位客户的按钮会打开 WhatsApp 并填好消息，您只需点“发送”。",
  bc_who: "发给谁",
  bc_what: "内容",
  bc_seg_buyers: "买过的",
  bc_seg_debtors: "欠款的",
  bc_seg_sleeping: "很久没下单",
  bc_seg_all: "全部",
  bc_tpl_promo: "促销",
  bc_tpl_arrivals: "新品到货",
  bc_tpl_debt: "付款提醒",
  bc_tpl_custom: "自定义",
  bc_text: "消息",
  bc_text_hint: "{имя} 会替换为客户名字，{долг} 会替换为欠款金额。",
  bc_count: "客户：{n}，还需发送：{left}",
  bc_next: "在 WhatsApp 给下一位发送（剩余 {n}）",
  bc_none: "没有符合条件的客户，请选择其他分组。",
  bc_owes: "欠 {s}",
  bc_e_text: "请输入消息内容",
  nav_expenses: "支出",
  nav_volume: "体积重",
  trk_title: "物流单号",
  trk_short: "单号",
  trk_where: "包裹在哪里？",
  trk_hint: "点击“包裹在哪里？”查看货物当前位置。",
  f_tracking: "物流单号",
  f_tracking_hint: "客户会在订单页面和“运输中”消息里看到它。",
  copied_track: "物流单号已复制",
  vol_title: "体积重",
  vol_hint: "填写箱子尺寸，网站会计算体积、体积重和密度。承运商按实际重量和体积重中较大的一个收费。",
  vol_box: "单箱尺寸，厘米",
  vol_l: "长",
  vol_w: "宽",
  vol_h: "高",
  vol_n: "箱数",
  vol_kg: "重量，公斤",
  vol_kg_ph: "可不填",
  vol_kg_mode: "重量是",
  vol_kg_total: "总重",
  vol_kg_box: "每箱",
  vol_how: "承运商计算方式",
  vol_div_6000: "空运 ÷6000",
  vol_div_5000: "快递 ÷5000",
  vol_div_cargo: "货运（密度）",
  vol_r_m3: "体积",
  vol_r_vol: "体积重",
  vol_r_weight: "实际重量",
  vol_r_density: "密度",
  vol_r_pay: "计费重量",
  vol_kgm3: "公斤/立方米",
  vol_by_volume: "按体积计费——箱子轻但体积大",
  vol_by_weight: "按实际重量计费",
  vol_light: "密度低于 200 公斤/立方米——轻货。货运通常按立方米收费，而不是按公斤。",
  vol_heavy: "密度 200 公斤/立方米及以上——货运通常按公斤收费。",
  vol_empty: "请填写长、宽、高。",
  vol_apply: "把重量填入订单：{n} 公斤",
  vol_applied: "重量已填入",
  vol_by_size: "按尺寸计算",
  q_more_extra: "+ 中国境内费用（到仓库、佣金、包装）",
  q_extra_cur: "中国境内费用合计（{c}）",
  q_extra_hint: "您在中国支付的、商品价格之外的所有费用：供应商送到仓库的运费、代理佣金、包装、银行手续费。计入成本和客户价格，不会作为单独一行显示给客户。",
  q_dm_kg: "物流按重量（公斤）收费",
  q_dm_m3: "物流按体积（立方米）收费",
  q_lbl_volume: "总体积（立方米）",
  f_tariff_m3_cur: "每立方米运价（{c}）",
  c_extra: "中国境内费用",
  c_cost_unit: "单件成本",
  c_profit_unit: "单件利润",
  vol_per: "每箱件数",
  vol_kg_unit: "每件",
  vol_boxes: "总箱数",
  vol_need_qty: "请填写总件数，箱数将自动计算。",
  vol_apply_m3: "填入体积：{n} 立方米",
  vol_applied_m3: "已填入体积",
  pr_print: "打印 / 保存为 PDF",
  pr_how: "将打开新标签页。要得到 PDF，请在打印窗口选择“另存为 PDF”。",
  inv_none: "只有未取消的订单可以开账单",
  inv_btn: "PDF 账单",
  inv_btn_short: "账单",
  inv_title: "账单",
  inv_title_modal: "给客户的账单（PDF）",
  inv_sum: "订单：{n}。客户：{c}——每位客户单独一页。",
  inv_no_price: "{n} 个订单还没有价格——账单中显示为横线。",
  inv_pay_label: "付款方式（可不填）",
  inv_pay_ph: "例如：银行、卡号或账号、收款人姓名",
  inv_pay_hint: "网站会记住这段文字，下次自动填入。",
  inv_make: "生成账单",
  inv_to: "客户",
  inv_c_order: "订单",
  inv_c_product: "商品",
  inv_c_qty: "数量",
  inv_c_sum: "金额",
  inv_c_left: "待付",
  inv_total: "合计",
  inv_due: "应付",
  inv_pay: "付款方式",
  inv_thanks: "感谢您的订单！",
  lb_btn: "二维码标签",
  lb_btn_short: "标签",
  lb_title: "二维码标签",
  lb_hint: "标签上有订单号、客户、电话、城市、商品和重量。二维码里是同样的信息——仓库用手机摄像头扫描即可。",
  lb_size: "尺寸",
  lb_size_58x40: "58×40 毫米（热敏）",
  lb_size_100x70: "100×70 毫米",
  lb_size_a4: "A4 纸（8 张）",
  lb_places: "每个订单的件数（箱数）",
  lb_places_hint: "如果有 3 箱，会打印 3 张标签：“第 1/3 件”“2/3”“3/3”。",
  lb_sum: "订单：{o}，标签：{n}",
  lb_make: "打印标签",
  lb_place: "第 {a}/{b} 件",
  ex_hint: "房租、工资、广告等开销。只有您能看到。净利润 = 订单利润 − 支出。",
  ex_add: "添加支出",
  ex_edit: "修改支出",
  ex_orders_profit: "订单利润",
  ex_spent: "支出",
  ex_net: "净利润",
  ex_net_hint: "利润按本期 {n} 个已定价订单（不含已取消）计算。",
  ex_by_cat: "钱花在哪里",
  ex_list: "全部支出（{n}）",
  ex_empty: "本期没有支出。点击“添加支出”，例如仓库租金或广告。",
  ex_cat_rent: "房租",
  ex_cat_salary: "工资",
  ex_cat_ads: "广告",
  ex_cat_transport: "交通和打车",
  ex_cat_packing: "包装和仓库",
  ex_cat_phone: "通讯和网络",
  ex_cat_fees: "手续费和转账",
  ex_cat_other: "其他",
  ex_f_cat: "用途",
  ex_f_amount: "金额",
  ex_f_cur: "货币",
  ex_f_date: "日期",
  ex_f_note: "备注",
  ex_f_note_ph: "例如：十月仓库租金",
  ex_e_amount: "请输入大于零的金额",
  ex_confirm_del: "删除这笔支出？",
  ex_saved: "支出已保存",
  ex_deleted: "支出已删除",
  an_net: "支出 {s} → 净利润",
  an_net_add: "记录支出，查看净利润",
  filter_active: "进行中",
  done_hidden: "已交付并付清：{n} — 已从主页隐藏",
  done_all_title: "所有订单都已交付",
  done_all_text: "没有新的或进行中的订单。已交付并付清的订单在“已交付”里。",
  progress_step: "第 {a}/{b} 步",
  im_menu: "从 Excel 导入",
  im_btn: "从 Excel",
  im_title: "导入旧订单",
  im_empty_btn: "从 Excel 导入旧订单",
  ob_import: "把 Excel 里的旧订单搬过来——只要几分钟",
  im_hint: "几分钟就能搬好旧订单——用 Excel 表格或本子照片。",
  im_drop: "把文件拖到这里",
  im_pick: "选择文件",
  im_formats: "Excel（.xlsx）或 CSV",
  im_tip1: "您自己的任何表格都可以：第一行是标题（日期、客户、电话、商品、金额、已付、状态……），列的顺序无所谓。",
  im_tip2: "Google 表格：文件 → 下载 → Microsoft Excel（.xlsx）。旧的 .xls 文件：在 Excel 里“另存为” → .xlsx。",
  im_template: "下载表格样本",
  im_e_xls: "这是旧的 .xls 格式。请在 Excel 里打开并另存为 .xlsx（文件 → 另存为 → Excel 工作簿）。",
  im_e_big: "文件大于 15 MB，请拆成几个文件。",
  im_e_empty: "文件里没有找到订单行。",
  im_e_read: "无法读取文件。请确认是 Excel（.xlsx）或 CSV，然后重试。",
  im_file: "文件「{f}」—— 行数：{n}",
  im_cols: "每一列是什么",
  im_cols_hint: "网站已自动识别，请检查并按需修改。“客户”必须选，其他可选。",
  im_more: "其他字段（{n}）",
  im_more_rows: "……还有 {n} 个",
  im_sum: "金额",
  im_none: "—— 无 ——",
  im_col: "第 {n} 列",
  im_f_date: "日期",
  im_f_client: "客户",
  im_f_phone: "电话",
  im_f_product: "商品",
  im_f_qty: "数量",
  im_f_price: "客户金额",
  im_f_paid: "已付",
  im_f_cost: "成本",
  im_f_weight: "重量，公斤",
  im_f_status: "状态",
  im_f_tracking: "物流单号",
  im_f_number: "订单号",
  im_f_supplier: "供应商",
  im_f_currency: "货币",
  im_f_comment: "备注",
  im_cur: "金额的货币",
  im_status_def: "没有状态时使用",
  im_status_hint: "旧订单一般已经交付——选“已交付”。已交付并付清的订单不会挤在主页上。",
  im_preview: "订单会这样显示",
  im_skip: "将跳过 {n} 行——没有客户姓名。",
  im_dups: "账户里已有：{n}——不会重复添加。",
  im_cut: "每次最多导入 {n} 个订单——其余的用第二个文件导入。",
  im_need_client: "请选择客户姓名所在的列。",
  im_back: "换个文件",
  im_go: "导入订单（{n}）",
  im_go_none: "没有可导入的",
  im_progress: "正在导入…… {a}/{b}",
  im_done: "完成！已导入 {n} 个订单，已经在账户里了。",
  im_partial: "已导入 {n}/{b}：其余因错误未能导入。可以撤销后重试。",
  im_finish: "好的",
  im_undo: "撤销导入",
  im_undo_confirm: "删除刚导入的 {n} 个订单？",
  im_undone: "已撤销导入",
  im_no_product: "未命名商品",
  im_note_ref: "Excel 编号：{n}",
  im_note_cost: "Excel 里的成本已记为运费（没有人民币汇率）",
  im_tpl_sheet: "订单",
  im_tpl_title: "订单导入样本",
  im_tpl_sub: "把您的订单填进各行。多余的列可以删除，顺序随意。",
  im_tpl_note: "备注示例",
  im_photo_title: "订单记在本子上？",
  im_photo_text: "拍下这些页面——AI 会把订单整理成表格，由您核对。每次最多 5 张。",
  im_photo_btn: "拍本子",
  im_photo_privacy: "照片只发送给 Google Gemini 用于识别，不会保存。每天最多 30 张。",
  im_reading: "正在识别字迹……",
  im_reading_hint: "通常需要 10–40 秒，请不要关闭窗口。",
  im_photo_max: "每次最多 {n} 张照片，其余的下次再发。",
  im_photo_file: "本子照片：{n}",
  im_photo_found: "从照片识别出 {n} 行",
  im_photo_left: "今天还可发 {n} 张",
  im_photo_check: "请逐行核对：AI 可能认错字迹。黄色行表示它不确定。多余的行用 × 删除。",
  im_unsure: "请核对——字迹不清",
  im_st_default: "默认状态",
  im_e_quota: "今天的照片额度已用完（每天 30 张），请明天再试。",
  im_e_busy: "AI 现在很忙，请稍等一分钟再试。",
  im_e_photo_empty: "照片里没有找到订单。请拍近一点，光线要好。",
  im_e_photo: "无法识别照片。请检查网络后重试。",
  sm_show_all: "显示全部栏目",
  sm_simple: "简洁模式",
  sm_on: "简洁模式：只显示订单、客户和欠款",
  sm_off: "已显示全部栏目",
  sm_setting: "简洁模式——菜单里只有订单、客户和欠款",
  video_btn: "视频：如何使用（2 分钟）",
  tgc_title: "Telegram 通知",
  tgc_text: "订单发货、到货和可以取货时，您会收到消息。不用打电话，也不用一直查看。",
  tgc_btn: "在 Telegram 开通",
  tgc_check: "检查是否开通",
  tgc_checking: "正在检查……",
  tgc_hint: "在 Telegram 里点击 “Start”，然后回到这里——会自动检查是否开通。",
  tgc_on: "已开通——订单状态会发到您的 Telegram",
  tgc_off: "关闭通知",
  tgc_off_confirm: "关闭这个订单的 Telegram 通知？",
  tgc_done: "完成！通知已开通",
  tgc_off_done: "通知已关闭",
  tgc_e_start: "还没有看到 “Start”。请打开机器人，点击 “Start” 后再试一次。",
  tgc_e: "出错了，请一分钟后再试。",
  tgc_sent: "已发送到客户 Telegram：{n}",
  tgc_tag_title: "客户已在 Telegram 订阅：新状态会自动发送给他",
  pwa_btn: "安装到手机",
  pwa_title: "安装到手机",
  pwa_sub: "屏幕上的图标，像应用一样打开",
  pwa_ios1: "在 Safari 底部点击“分享”——带向上箭头的方框 ⬆️。",
  pwa_ios2: "向下滑动，选择“添加到主屏幕”。",
  pwa_ios3: "点击“添加”，屏幕上就会出现 ULA Factory 图标。",
  pwa_and1: "点击浏览器菜单——右上角的三个点 ⋮。",
  pwa_and2: "选择“安装应用”或“添加到主屏幕”。",
  pwa_and3: "确认后，屏幕上就会出现 ULA Factory 图标。",
  pwa_note: "还是同一个网站：数据都会保存，更新会自动到来。",
  pwa_ok: "知道了",
  pwa_done: "应用已安装",
  nav_analytics: "数据分析",
  an_hint: "核心数据和图表：卖了多少、赚了多少、谁欠款。",
  an_export: "全部订单导出 Excel",
  an_m: "百万",
  an_k: "千",
  an_markup: "加价率",
  an_orders: "订单数",
  an_avg: "平均订单金额",
  an_live: "当前进行中（订单）",
  an_by_month: "按月营收与利润",
  an_by_status: "按状态的订单",
  an_more: "更多",
  an_top: "排行与欠款",
  an_top_clients: "客户",
  an_top_products: "商品",
  an_top_debtors: "欠款客户",
  an_attention: "需要关注",
  an_i_up: "利润比上一个相同周期增长了 {n}%。",
  an_i_down: "利润比上一个相同周期下降了 {n}%。",
  an_i_best: "最佳月份 — {m}：利润 {s}。",
  an_i_client: "{name} 贡献的利润最多 — 占 {n}%。",
  an_i_debt: "{name} 欠款最多 — {s}。",
  an_a_noprice: "没有客户价格：{n}",
  an_a_debts: "超过一周的欠款：{n}",
  an_a_stuck: "超过10天无进展：{n}",
  an_a_live: "当前进行中的订单：{n}",
  an_a_ok: "一切正常：没有逾期欠款或被遗忘的订单。",
  an_days: "{n} 天",
  an_goal: "本月目标（{c}）",
  an_g_of: "目标 {s}",
  an_g_done: "目标已达成！",
  an_g_left: "已完成 {p}%。本月剩余天数：{d}。",
  an_g_need: "要完成目标，平均每天需要 {s}。",
  an_g_none: "尚未设置目标。设置每月想赚多少，这里会显示进度条。",
  an_g_set: "设置目标",
  an_g_change: "修改目标",
  an_g_clear: "移除",
  an_g_ph: "想赚多少，{c}",
  an_g_bad: "请输入大于零的金额",
  an_a_loss: "亏损订单：{n}",
  an_none: "暂无数据",
  an_empty: "该期间没有订单。",
  an_no_price: "该期间订单尚无客户价格，无法计算利润。",
  an_c_num: "订单号",
  an_c_date: "日期",
  an_c_status: "状态",
  an_c_product: "商品",
  an_c_qty: "数量",
  an_c_cur: "币种",
  export_empty: "没有可导出的客户",
  clients_empty_title: "还没有客户",
  clients_empty_text: "客户通过订单链接填写信息后，会显示在这里。",

  empty_title: "还没有订单",
  empty_text: "点击“新订单”添加第一个订单。",
  nothing_found: "没有找到结果，请修改搜索或筛选条件。",
  show_more: "显示更多",
  loading: "加载中…",
  confirm_delete: "确定删除订单 {n} 及其照片吗？此操作无法撤销。",
  deleted: "订单已删除",
  saved: "订单已保存",
  status_changed: "状态已更新",
  error_generic: "无法连接服务器，请检查网络后重试。",
  error_session: "登录已过期，请重新登录。",
  dup_number: "该订单号已存在，请修改订单号。",
  photo_failed: "照片上传失败：{n}",
  detail_title: "订单 {n}",

  link_title: "客户链接",
  link_hint: "客户只能查看这一个订单，并可以填写自己的收货信息。",
  lk_all_title: "客户所有订单共用一个链接",
  lk_all_hint: "客户可以在一个页面查看自己的全部订单、状态和应付总额。订单按客户手机号归类（没有手机号则按姓名）。",
  lk_all_create: "创建共用链接",
  lk_all_revoke: "关闭共用链接",
  lk_all_confirm_revoke: "关闭该客户的共用链接？关闭后客户将无法再用它打开订单列表。单个订单的链接不受影响。",
  lk_all_created: "共用链接已创建并复制",
  lk_all_revoked: "共用链接已关闭",
  lk_all_wa: "您好！您的所有订单、状态和付款情况都在这里：",
  cab_title: "您的订单",
  cab_debt: "应付总额",
  cab_no_debt: "已全部付清",
  cab_empty: "暂无订单。",
  cab_active: "进行中",
  cab_done: "已完成",
  cab_back: "全部订单",
  link_active: "链接有效。更换后，旧链接会立即失效。",
  link_disabled: "链接已停用，客户无法再通过旧链接打开订单。",
  link_create: "创建链接",
  link_rotate: "更换链接",
  link_revoke: "停用链接",
  link_confirm_rotate: "为订单 {n} 创建新链接吗？旧链接将立即失效。",
  link_confirm_revoke: "停用订单 {n} 的链接吗？客户将无法再打开该链接。",
  link_created: "新链接已创建，旧链接已停用。",
  link_revoked: "链接已停用",
  link_whatsapp: "通过 WhatsApp 发送",
  link_open: "以客户身份打开",
  wa_text: "您的订单 {n}。打开链接可查看状态、付款和照片，并填写收货地址：",

  cl_order: "订单 {n}",
  cl_product: "商品",
  cl_status: "订单状态",
  history_title: "订单记录",
  history_empty: "暂无状态变更",
  history_last: "最近更新",
  history_payment: "累计已付：{amount}",
  history_address: "已添加或修改收货地址",
  cl_payment: "费用与付款",
  cl_paid_full: "已全额付款",
  cl_delivery_info: "物流",
  cl_comment: "备注",
  cl_updated: "更新时间",
  cl_not_found_title: "未找到订单",
  cl_not_found_text: "请检查链接。如果无法打开，请让客户经理重新发送。",
  cl_cancelled: "此订单已取消",

  cd_title: "收货信息",
  cd_intro: "请填写收货人和收货地址。",
  cd_name: "姓名",
  cd_phone: "电话",
  cd_phone_hint: "请带国家区号，例如 +1…、+86…、+971…",
  cd_telegram: "Telegram",
  cd_optional: "选填",
  cd_city: "城市",
  cd_method: "收货方式",
  cd_m_address: "送货上门",
  cd_m_pickup: "自提点",
  cd_address: "地址：街道、门牌号、房间号",
  cd_pickup: "自提点名称或地址",
  cd_privacy: "这些信息仅您的客户经理可见，仅用于配送。",
  cd_save: "保存信息",
  cd_saving: "保存中…",
  cd_saved: "信息已保存",
  cd_edit: "修改",
  cd_cancel: "取消",
  cd_locked: "订单已完成，信息无法修改。如需更正，请联系客户经理。",

  e_required: "请填写此项",
  e_name: "请输入姓名，2–120 个字符",
  e_phone: "请检查号码：9–15 位数字，开头可带 +",
  e_telegram: "Telegram 用户名：5–32 位字母、数字或下划线",
  e_city: "请输入城市，2–80 个字符",
  e_address: "请输入地址，5–300 个字符",
  e_pickup: "请输入自提点，2–200 个字符",
  e_form: "请检查标出的字段",

  // Этап A: байеры, кабинеты, приглашения
  nav_buyers: "采购商",
  login_hint: "ULA Factory 采购商工作台",
  account_blocked: "该账号已被停用，请联系管理员。",
  auto_number: "自动生成",
  req_fields: "请填写客户和商品名称。",
  settings: "设置",
  refresh: "刷新",
  refreshed: "已刷新",
  wh_edit: "修改",
  wh_add: "添加仓库地址",
  wh_empty: "尚未填写中国仓库地址。填写后可一键复制发给客户。",
  s_name: "工作台名称",
  s_prefix: "订单号字母",
  s_prefix_hint: "1–5 个大写英文字母。例如 CN，订单号为 CN-000125。",
  s_address: "中国仓库地址",
  s_address_hint: "建议用中文填写，方便卖家和快递识别。",
  s_contacts: "仓库联系人",
  s_contacts_hint: "每行一个联系人：姓名和电话。",
  s_save: "保存",
  s_saved: "设置已保存",
  e_ws_name: "请输入工作台名称",
  e_prefix: "只能是 1–5 个大写英文字母",
  readonly_banner: "您正在查看“{n}”，此处无法修改。",
  back_to_mine: "我的工作台",
  b_invite_title: "邀请采购商",
  b_invite_hint: "采购商将获得独立的工作台，其他采购商看不到他的客户和订单。",
  b_invite_note: "邀请对象（选填）",
  b_invite_btn: "生成邀请",
  b_invite_ready: "邀请已生成。请把链接发给采购商：14 天内有效，仅限一人使用。",
  b_invites: "有效邀请",
  b_invites_empty: "暂无有效邀请。",
  b_until: "至 {d}",
  b_delete_invite: "删除",
  b_invite_deleted: "邀请已删除",
  b_workspaces: "采购商工作台",
  b_open: "查看",
  b_block: "停用",
  b_unblock: "启用",
  b_blocked: "已停用",
  b_active: "正常",
  b_you: "您的工作台",
  b_counts: "订单：{o} · 客户：{c}",
  b_confirm_block: "确定停用“{n}”吗？采购商将无法登录，数据会保留。",
  b_wa_text: "ULA Factory 采购商工作台邀请：",
  join_title: "采购商注册",
  or: "或",
  google_btn: "使用 Google 登录",
  no_account: "还没有账号？",
  signup_link: "注册",
  have_account: "已有账号？",
  legal_terms: "使用条款",
  legal_privacy: "隐私政策",
  legal_agree: "注册即表示您同意使用条款和隐私政策：",
  s_sec_look: "外观",
  s_theme: "主题",
  theme_auto: "自动",
  theme_light: "浅色",
  theme_dark: "深色",
  s_language: "语言",
  s_sec_profile: "个人资料",
  s_new_password: "新密码",
  s_password_hint: "不修改请留空，至少 8 位。",
  s_sec_workspace: "工作台",
  s_sec_money: "币种与运费",
  password_changed: "密码已修改",
  nav_fx: "货币兑换",
  fx_hint: "您给客户的汇率、申请，以及 ULA 给买手的汇率",
  fx_platform_title: "ULA 给买手的汇率",
  fx_platform_none: "今天的汇率尚未设置",
  fx_rate_line: "1 ¥ = {r} 索姆",
  fx_date: "{d} 的汇率",
  fx_old: "{d} 的汇率，兑换前请确认",
  fx_from: "{n} ¥ 起",
  fx_som_short: "索姆",
  fx_cny: "需要多少人民币",
  fx_pay: "应付",
  fx_ask_admin: "提交兑换申请",
  fx_s1_admin: "按收款信息向管理员付款",
  fx_s1: "按收款信息付款",
  fx_s2: "上传付款凭证",
  fx_s3_admin: "向管理员提交申请",
  fx_s3: "您的信息并提交",
  fx_attach: "上传凭证",
  fx_replace: "更换",
  fx_receipt: "凭证",
  fx_send_rcpt: "提交申请（附凭证）",
  fx_e_receipt: "请先付款并上传凭证，没有凭证无法提交",
  fx_qr_label: "付款二维码",
  fx_qr_add: "上传二维码",
  fx_qr_scan: "用手机扫描二维码付款，点击可放大。",
  fx_qr_off: "暂时无法上传二维码：需要运行数据库更新（文件 42）。",
  fx_send_no_file: "聊天暂不接收文件。不附凭证直接提交申请吗？请另外通过 WhatsApp 或 Telegram 把凭证发给管理员。",
  fx_no_file_note: "（未附凭证——买手会另行发送。）",
  fx_ula_eta_label: "买手付款后等待收到人民币的时间",
  fx_eta_need41: "汇率已保存，但等待时间未保存：数据库文件 41 尚未运行。",
  fx_e_upload_off: "尚未开启文件上传，需要运行数据库更新（文件 40）。",
  fx_e_rcpt_img: "请上传照片或截图（JPG、PNG、WEBP）",
  fx_e_rcpt_type: "请上传照片、截图或 PDF",
  fx_req_chat: "暂无收款信息，请在聊天中询问管理员。",
  fx_req_none: "暂无收款信息，请向买手询问。",
  fx_req_copied: "收款信息已复制",
  fx_tab_ula: "通过 ULA 兑换",
  fx_tab_mine: "我的客户兑换",
  fx_ula_title: "ULA 汇率",
  fx_all_tiers: "全部汇率档位",
  fx_step_t: "流程说明",
  fx_step1: "输入您需要的人民币金额",
  fx_step2: "点击“提交兑换申请”——申请会发给管理员",
  fx_step3: "管理员会在“客服”中回复，并告诉您如何付款",
  fx_open_chat: "打开客服聊天",
  fx_admin_msg: "兑换申请：¥ {cny} = {som} 索姆，汇率 {r}",
  fx_sent_admin: "申请已发送，回复将在“客服”中。",
  fx_admin_set: "给买手的汇率（由您设置）",
  fx_ed_from: "起点，¥",
  fx_ed_rate: "汇率，1 ¥ 多少索姆",
  fx_ed_add: "添加档位",
  fx_ed_hint: "例如：1 000 ¥ 起 — 12.60；10 000 ¥ 起 — 12.40。最小档位即最低金额。",
  fx_e_many: "最多 {n} 个档位",
  fx_note_label: "付款信息和备注",
  fx_note_ph: "例如：Mbank 0555 123 456（Azamat K.）。人民币转到客户的支付宝 / 微信。",
  fx_save: "保存汇率",
  fx_saved: "汇率已保存",
  fx_my_title: "我给客户的汇率",
  fx_my_hint: "客户输入需要多少人民币，看到索姆金额和您的付款信息，付款后上传截图。请每天更新汇率。",
  fx_on_label: "向客户显示兑换",
  fx_e_rate: "请检查档位：起点为 0 或以上，汇率大于 0",
  fx_link_title: "给客户的兑换链接",
  fx_link_hint: "发给客户。汇率和计算器也会显示在商店页和订单链接中。",
  fx_copy: "复制",
  fx_wa_text: "索姆 → 人民币兑换：{url}",
  fx_link_make: "创建链接",
  fx_req_title: "客户兑换申请",
  fx_req_empty: "暂无申请",
  fx_active: "进行中",
  fx_all: "全部",
  fx_st_new: "待付款",
  fx_st_paid: "已付款",
  fx_st_done: "已完成",
  fx_st_cancelled: "已取消",
  fx_done_btn: "完成",
  fx_cancel_btn: "取消",
  fx_proof_btn: "付款截图",
  fx_readonly: "只有工作台所有者可以修改汇率",
  fx_pub_title: "索姆 → 人民币兑换",
  fx_pub_btn: "提交申请",
  fx_pub_send: "下一步 — 付款",
  fx_to_pay: "应付",
  fx_requisites: "付款信息",
  fx_pay_hint: "请按付款信息转账，并上传付款截图。",
  fx_upload: "上传付款截图",
  fx_uploading: "上传中…",
  fx_pay_later: "卖家已收到您的申请。如果无法上传截图，请通过 WhatsApp 发给卖家。",
  fx_pub_done: "截图已收到！卖家确认付款后会转人民币给您。",
  fx_pub_again: "新申请",
  fx_back: "修改",
  fx_comment_ph: "例如：转到支付宝，方便的时间",
  fx_page_hint: "输入需要多少人民币，即可看到索姆金额。",
  fx_page_none: "暂无兑换",
  fx_e_min: "最低金额为 {n} ¥",
  fx_e_amount: "请输入需要多少人民币",
  fx_e_off: "暂时无法兑换",
  fx_locked: "身份审核通过后，这里将开放：",
  fx_locked_1: "您给客户的汇率",
  fx_locked_2: "收款信息和二维码",
  fx_locked_3: "发给客户的链接",
  fx_next_title: "审核已通过！还剩 3 步：",
  fx_next_1: "设置给客户的汇率（下方）",
  fx_next_2: "添加收款信息和二维码，点击“保存”",
  fx_next_3: "点击“为客户开启兑换”，把链接发给客户",
  kyc_msg_ok: "✅ 您的身份审核已通过！打开“兑换”→“我的客户兑换”：设置汇率和收款信息，点击“为客户开启兑换”，然后把链接发给客户。",
  kyc_msg_no: "❌ 身份审核未通过。原因：{r}。请修改后在“兑换”中重新提交资料。",
  fx_off_warn: "兑换已关闭，客户打开此链接会看到“无法兑换”。请开启：",
  fx_off_warn_kyc: "兑换已关闭，客户会看到“无法兑换”。请先完成上方的身份审核。",
  fx_turn_on: "为客户开启兑换",
  fx_off_copied: "已复制，但兑换已关闭，客户会看到“无法兑换”。请开启兑换。",
  fx_e_off_hint: "卖家还没有开启兑换。请联系对方，开启后链接即可使用。",
  fx_e_upload: "截图上传失败，请重试。",
  fx_st_confirmed: "正在转人民币",
  fx_eta_m: "{n} 分钟",
  fx_eta_h: "{n} 小时",
  fx_eta_d: "{n} 天",
  fx_eta_label: "通常在多长时间内转出人民币",
  fx_eta_q: "客户需要等多久收到人民币？",
  fx_eta_usual: "付款后通常 {n} 内到账",
  fx_eta_change: "修改时间",
  fx_wait_until: "预计 {t} 前到账",
  fx_left: "还剩约 {n}",
  fx_late: "时间快到了——卖家很快会转出人民币。如等待太久，请联系卖家。",
  fx_confirm_btn: "已收到付款",
  fx_confirm_go: "确认并通知客户",
  fx_confirmed: "客户能看到状态和等待时间",
  fx_sent_btn: "人民币已转出",
  fx_msg_label: "给客户的留言（可选）",
  fx_msg_ph: "例如：15:00 后转到支付宝",
  fx_wa_status: "{name}，您的兑换申请状态：{url}",
  fx_track: "申请状态与聊天",
  fx_my_reqs: "我的申请",
  fx_req_from: "{d} 的申请",
  fx_status_title: "兑换申请状态",
  fx_s_new: "等待您付款",
  fx_s_paid: "已收到截图——正在核对付款",
  fx_s_confirmed: "付款已确认——正在转人民币",
  fx_s_done: "人民币已转出",
  fx_s_cancelled: "申请已取消",
  fx_step_new: "申请已收到",
  fx_step_paid: "付款",
  fx_step_confirmed: "付款已确认",
  fx_step_done: "人民币已转出",
  fx_paid_wait: "核对付款通常需要 {n} 以内。转出人民币后会通知您。",
  fx_paid_wait0: "卖家核对付款后会告诉您需要等多久。",
  fx_created: "{d} 的申请",
  fx_auto: "页面会自动刷新",
  fx_st_none: "未找到申请",
  fx_st_none_hint: "请检查链接或联系卖家。",
  kyc_title: "身份验证",
  kyc_ok: "身份已验证——可以开启兑换",
  kyc_pending: "证件审核中（{d} 提交）。通常一天内完成。",
  kyc_rejected: "验证未通过",
  kyc_revoked: "验证已撤销",
  kyc_why: "为了让客户信任您，只有通过验证后才能开启兑换。只需上传一次护照和手持护照自拍。只有 ULA Factory 管理员能看到，客户看不到。",
  kyc_name: "护照上的姓名",
  kyc_name_ph: "张三",
  kyc_doc: "护照号码",
  kyc_front: "护照：照片页",
  kyc_back: "背面",
  kyc_selfie: "手持护照自拍",
  kyc_photo_hint: "照片清晰、无反光、文字可读。自拍：您的脸和护照在一起。",
  kyc_consent: "我同意为兑换业务存储和核验我的护照信息。",
  kyc_send: "提交审核",
  kyc_e_name: "请填写护照上的姓名",
  kyc_e_doc: "请检查护照号码：只能是拉丁字母和数字",
  kyc_e_files: "请上传护照照片和手持护照自拍",
  kyc_e_consent: "请勾选同意",
  kyc_admin_msg: "兑换身份验证：{name} 已提交证件",
  kyc_sent: "证件已提交——请等待审核",
  kyc_admin_title: "兑换商验证",
  kyc_f_pending: "待审核",
  kyc_admin_empty: "没有验证申请",
  kyc_st_pending: "待审核",
  kyc_st_approved: "已验证",
  kyc_st_rejected: "已拒绝",
  kyc_st_revoked: "已撤销",
  kyc_view: "查看照片",
  kyc_reject: "拒绝",
  kyc_revoke: "撤销验证",
  kyc_reason_q: "原因（买手会看到）：",
  kyc_e_reason: "请填写原因",
  kyc_e_required: "请先完成身份验证（见下方）",
  kyc_pub_badge: "卖家已通过 ULA Factory 身份验证",
  fx_who_me: "您",
  fx_who_client: "客户",
  fx_who_buyer: "卖家",
  fx_who_admin: "ULA 管理员",
  fx_d_photo: "照片",
  fx_st_sent: "等待客户确认",
  fx_st_dispute: "争议",
  fx_flag: "该号码在平台黑名单中——请注意",
  fx_wait_client: "等待客户确认收款 · {t} 自动完成",
  fx_sent_proof_btn: "转账截图",
  fx_send_pick: "请选择人民币转账截图——必须上传",
  fx_sent_ok: "已标记为已转出，等待客户确认",
  fx_d_btn: "发起争议",
  fx_d_btn_notrecv: "未收到人民币——发起争议",
  fx_d_open_me: "您发起了争议",
  fx_d_open_client: "客户发起了争议",
  fx_d_open_buyer: "卖家发起了争议",
  fx_d_closed: "争议已关闭",
  fx_d_res_client: "裁决：客户有理",
  fx_d_res_buyer: "裁决：卖家有理",
  fx_d_msg_ph: "关于争议的留言",
  fx_d_send: "发送",
  fx_d_attach: "照片",
  fx_d_hint_buyer: "争议期间不能修改状态。请上传流水或截图——由 ULA Factory 管理员裁决。",
  fx_d_hint_client: "ULA Factory 管理员会核对双方截图并裁决。请上传证据：付款截图、流水、聊天记录。",
  fx_d_reason_q: "发生了什么？（客户和管理员可见）",
  fx_d_reason_ph: "请说明情况：何时付款、金额、问题是什么",
  fx_d_reason_short: "请写得详细一些（至少 5 个字）",
  fx_d_from: "如果卖家没有回应，{t} 之后可在此发起争议",
  fx_d_err: "操作失败，请刷新后重试",
  fx_e_dispute: "争议期间不能修改状态",
  fx_disputes_title: "兑换争议",
  fx_d_open_f: "进行中",
  fx_disputes_empty: "没有争议",
  fx_bl_tag: "在黑名单中",
  fx_strikes: "买手败诉次数：{n}",
  fx_res_client_btn: "客户有理",
  fx_res_buyer_btn: "卖家有理",
  fx_res_note_q: "裁决说明（双方可见）：",
  fx_res_bl_q: "将客户电话加入黑名单？所有买手都会在其新申请上看到警告。",
  fx_t_created: "申请",
  fx_t_paid: "付款截图",
  fx_t_eta: "承诺时间",
  fx_t_sent: "已转出",
  fx_s_sent: "人民币已转出——请核对并确认",
  fx_s_dispute: "争议处理中——平台正在核查",
  fx_s_done2: "交易完成",
  fx_step_sent: "已转出",
  fx_step_recv: "已收到",
  fx_sent_proof_cap: "卖家的转账截图",
  fx_recv_q: "收到人民币了吗？请给卖家评分",
  fx_recv_btn: "已收到人民币",
  fx_recv_auto: "如在 {t} 前未确认也未发起争议，交易将自动完成",
  fx_protect: "ULA Factory 保障：卖家已通过身份验证。如有问题，请在此发起争议，平台会处理。",
  pwa_update: "网站已更新",
  pwa_reload: "刷新",
  board_news_title: "新闻",
  board_news_ok: "知道了",
  board_rate_title: "ULA 今日汇率",
  board_news_add: "发布新闻",
  board_news_ph: "想对买手说什么？",
  board_news_post: "发布",
  board_news_posted: "新闻已发布",
  board_news_del: "删除",
  board_news_del_q: "删除这条新闻？",
  board_news_err: "出错了，请重试",
  rc_title: "人民币汇率",
  rc_sum: "金额",
  rc_rate: "1 ¥ 兑索姆",
  rc_days: "{n} 天",
  rc_chart_none: "汇率变化后将显示图表",
  rc_min: "最低 {n}",
  rc_max: "最高 {n}",
  rc_main: "{n} ¥ 起的汇率",
  rc_calc: "需要多少人民币？",
  rc_go: "兑换",
  rc_more: "详情：走势图和备注",
  rc_per: "索姆 / 1 ¥",
  rc_edit: "修改汇率",
  rc_warn_old: "今天的汇率尚未更新，买手看到的是旧汇率",
  rc_warn_none: "尚未设置汇率，买手看不到",
  fx_big_change: "“{from} ¥ 起”的汇率从 {a} 变为 {b}（{p}%）。不是输错了吗？",
  fx_notify_label: "通知买手：网站新闻和 Telegram",
  fx_news_text: "ULA 新汇率：\n{lines}",
  fx_saved_news: "汇率已保存，买手将收到新闻",
  board_news_tg: "同时发送到 Telegram",
  board_news_sent_tg: "已发送到 Telegram：{n}",
  ref_promo_t: "您也在销售中国商品吗？",
  ref_promo_b: "此页面由 ULA Factory 生成：订单、客户和人民币汇率集于一处。免费试用。",
  ref_promo_btn: "免费试用",
  ref_inv_t: "邀请买手朋友",
  ref_inv_b: "把此链接发给认识的买手。他注册后，我们会记住是您邀请的。",
  ref_inv_copy: "复制链接",
  ref_inv_copied: "链接已复制",
  ref_inv_wa: "通过 WhatsApp 发送",
  ref_inv_wa_text: "我用 ULA Factory 管理中国订单，很方便，人民币汇率也划算。试试：{url}",
  sh3_add: "加入购物车",
  sh3_cart: "购物车",
  sh3_checkout: "去下单（{n}）",
  sh3_more: "继续添加商品",
  sh3_remove: "删除",
  f_more_show: "显示全部字段 ▾",
  f_more_hide: "隐藏更多字段 ▴",
  q_s1: "商品价格",
  q_s1_sub: "供应商报价",
  q_s2: "运费",
  q_s2_sub: "重量和物流运价",
  q_s3: "您的加价",
  q_s3_sub: "您想赚多少",
  q_more_item: "+ 名称和链接（可选）",
  q_more_rates: "⚙ 货币和汇率",
  bn_more: "更多",
  bn_new: "新建",
  pf_title: "个人资料",
  pf_role_owner: "所有者",
  pf_role_staff: "助手",
  pf_role_admin: "管理员",
  pf_orders: "订单",
  pf_active: "进行中",
  pf_clients: "客户",
  pf_ready: "账户设置",
  pf_ready_n: "{a}/{b}",
  pf_c_name: "姓名",
  pf_c_phone: "电话",
  pf_c_logo: "标志",
  pf_c_wh: "仓库地址",
  pf_c_tariff: "运费",
  pf_month: "本月",
  pf_m_new: "订单：{n}",
  pf_m_done: "已交付：{n}",
  pf_m_top: "最佳客户：{name}",
  pf_m_empty: "本月暂无订单",
  pf_look: "外观",
  pf_dark: "深色模式",
  pf_dark_sub: "夜间更护眼",
  pf_color: "按钮颜色",
  pf_col_ula: "品牌红",
  pf_col_blue: "蓝色",
  pf_col_violet: "紫色",
  pf_col_green: "绿色",
  pf_col_orange: "橙色",
  pf_text: "文字大小",
  pf_ts_s: "小",
  pf_ts_m: "标准",
  pf_ts_l: "大",
  pf_ts_xl: "特大",
  pf_style: "风格",
  pf_ui_rounded: "圆润",
  pf_ui_soft: "柔和",
  pf_ui_crisp: "利落",
  pf_settings: "账户设置",
  pf_device_note: "外观保存在此设备上。",
  pf_edit: "编辑资料",
  pf_photo: "我的照片",
  pf_photo_hint: "显示在您的资料中",
  pf_photo_up: "上传照片",
  pf_photo_change: "更换照片",
  pf_remove: "删除",
  pf_name: "您的名字",
  pf_company: "公司名称",
  pf_logo: "公司标志",
  pf_logo_hint: "客户在订单页和商店中可见",
  pf_logo_up: "上传标志",
  pf_logo_change: "更换标志",
  pf_save: "保存",
  pf_cancel: "取消",
  pf_photo_del: "删除照片",
  bn_fx: "兑换",
  bn_support: "聊天",
  join_country: "国家",
  country_pick: "请选择国家",
  country_other: "其他国家",
  country_none: "未填写",
  e_country: "请选择您的国家",
  country_kg: "吉尔吉斯斯坦",
  fs_main_sub: "编号、日期和状态",
  fs_client_sub: "谁下的订单",
  fs_product_sub: "买什么、向谁买",
  fs_delivery_sub: "重量和物流运价",
  fs_price: "客户价格",
  fs_price_sub: "客户应付和已付金额",
  fs_photos_sub: "客户会在链接中看到",
  fs_notes_sub: "给客户和自己的备注",
  fs_sh_main: "批次",
  fs_sh_main_sub: "名称、物流和发货日期",
  fs_sh_cost_sub: "总重量和整批运费",
  fs_sh_orders_sub: "本批次包含哪些订单",
  fs_pr_photo_sub: "好照片带来更多订单",
  fs_pr_main: "名称和价格",
  fs_pr_main_sub: "顾客在橱窗看到的内容",
  fs_pr_desc_sub: "尺寸、颜色、材质（可选）",
  er_title: "用户端错误",
  er_none: "无 ✓",
  er_hint: "当买手或客户端出现故障时，网站会自动报告。请把错误内容发给开发者，修复后点击“已修复”。",
  er_hits: "{n} 次",
  er_people: "买手：{n}",
  er_clients: "客户端：{n}",
  er_details: "开发者详情",
  er_fixed: "已修复",
  er_clear_all: "清空列表",
  er_clear_q: "删除列表中的所有错误？",
  logo_title: "标志",
  logo_hint: "客户将在订单页、统一链接和商店页看到它，代替“ULA Factory”。建议方形或横向的 png/jpg。",
  logo_upload: "上传标志",
  logo_change: "更换标志",
  logo_remove: "移除",
  logo_err_type: "请使用 png、jpg 或 webp 文件",
  logo_err_size: "文件太大",
  onboard_title: "完成注册",
  onboard_text: "请填写您公司的信息，否则无法进入工作台。",
  e_ob_addr: "请填写中国仓库地址（货物寄到的地址）",
  google_failed: "Google 登录失败，请重试或使用邮箱登录。",
  join_hint: "创建您的工作台。其他采购商看不到您的客户和订单。",
  join_name: "您的姓名",
  join_phone: "电话",
  join_ws: "工作台或公司名称",
  join_password: "密码，至少 8 位",
  join_btn: "创建工作台",
  join_busy: "创建中…",
  join_invalid_title: "邀请无效",
  join_invalid_text: "链接已过期或已被使用，请索取新的邀请。",
  join_done_title: "请查收邮件",
  join_done_text: "我们已向 {e} 发送邮件。请打开邮件确认邮箱，然后登录。",
  join_exists: "该邮箱已注册。请登录或使用其他邮箱。",
  e_email: "请检查邮箱",
  e_password: "密码至少 8 位",

  // разрешения и устройство (js/device.js)
  perm_title: "设置 ULA",
  perm_sub: "两项权限，应用即可正常工作。",
  perm_push: "通知",
  perm_push_d: "新申请、客服消息和订单状态——即使应用关闭也能立即收到。",
  perm_geo: "位置",
  perm_geo_d: "客服可以看到您的位置，更快地帮助解决配送和问题。可在手机设置中关闭。",
  perm_allow: "允许",
  perm_on: "已开启",
  perm_denied: "已在设置中禁止",
  perm_later: "以后再说",
  perm_done: "完成",
  dev_now: "当前在线",
  dev_min: "{n} 分钟前",
  dev_hour: "{n} 小时前",
  dev_phone: "手机",
  dev_tablet: "平板",
  dev_desktop: "电脑",
  dev_app: "应用",
  dev_seen: "在线",
  dev_first: "首次",
  dev_version: "版本",
  dev_push: "通知",
  dev_place: "位置",
  dev_map: "在地图上打开",
  dev_m: "米",
  dev_geo_no: "已拒绝",
  dev_geo_none: "未允许",
  dev_ip: "IP",
  dev_tz: "时区、语言",
  dev_screen: "屏幕",
  dev_window: "窗口 {v}",
  dev_dark: "深色主题",
  dev_net: "网络",
  dev_offline: "离线",
  dev_gb: "{n} GB",
  dev_cores: "{n} 核",
  dev_ua: "浏览器",

  // режим правки администратора (js/adminedit.js)
  adm_edit_on: "✏️ 开启编辑",
  adm_edit_off: "结束编辑",
  adm_log: "日志",
  adm_edit_banner: "编辑模式：工作区「{n}」。您正在修改买手的数据——所有操作都会记录。截止 {t}。",
  adm_edit_confirm: "开启工作区「{n}」的编辑 2 小时？\n\n您可以像所有者一样修改订单、客户、批次和设置。每次修改都会记录在日志中。",
  adm_edit_started: "已开启编辑 2 小时",
  adm_edit_stopped: "编辑已结束——恢复只读",
  adm_edit_expired: "编辑时间已到——工作区恢复只读",
  adm_log_title: "编辑日志：「{n}」",
  adm_log_empty: "管理员尚未在此修改任何内容",
  adm_someone: "管理员",
  adm_fields: "字段：",
  adm_op_INSERT: "添加了",
  adm_op_UPDATE: "修改了",
  adm_op_DELETE: "删除了",
  adm_op_edit_on: "开启了编辑",
  adm_op_edit_off: "结束了编辑",
  adm_t_orders: "订单",
  adm_t_clients: "客户",
  adm_t_order_photos: "订单照片",
  adm_t_shipments: "批次",
  adm_t_suppliers: "供应商",
  adm_t_shop_products: "商店商品",
  adm_t_expenses: "支出",
  adm_t_workspaces: "工作区设置",
  adm_t_exchange_requests: "换汇申请",
  adm_t_workspace_members: "团队",
  adm_t_team_invites: "团队邀请",
  adm_t_client_cabinets: "客户账户",

  // вход по Face ID (js/passkey.js)
  pk_title: "Face ID 登录",
  pk_hint: "无需密码——用面容或指纹登录。密钥只保存在您的手机上，密码仍可作为备用方式。",
  pk_login_apple: "使用面容 ID 登录",
  pk_login_android: "使用指纹登录",
  pk_login_windows: "使用 Windows Hello 登录",
  pk_login_other: "使用通行密钥登录",
  pk_add_apple: "在此设备上开启 Face ID",
  pk_add_android: "开启指纹登录",
  pk_add_windows: "开启 Windows Hello",
  pk_add_other: "添加通行密钥",
  pk_none: "尚未在任何设备上开启。",
  pk_noname: "通行密钥",
  pk_created: "添加于 {d}",
  pk_used: "登录 {d}",
  pk_delete: "删除",
  pk_delete_confirm: "删除此密钥？该设备将需要重新使用密码登录。",
  pk_deleted: "密钥已删除",
  pk_added: "完成！现在可以用 Face ID 登录",
  pk_unsupported: "此浏览器不支持 Face ID 登录。请在 Safari 或 Chrome 中打开 ULA。",
  pk_off: "即将推出。",
  pk_off_admin: "需开启一次：Supabase → Authentication → Passkeys → Enable。",
  pk_err_off: "Face ID 登录目前已关闭。请使用密码登录。",
  pk_err_login: "Face ID 登录失败。请使用密码登录。",
  pk_err_add: "开启失败，请重试。",
  pk_err_exists: "此设备已开启 Face ID。",
  pk_app: "应用内即将支持。目前在 Safari 中打开 ULA 可使用 Face ID。",

  // Face ID: блокировка и настройки (js/passkey.js)
  pk_sec: "登录与锁定",
  pk_foot_off: "开启后无需密码即可登录，返回 ULA 时看一眼即可解锁——就像银行应用。",
  pk_lock_row: "锁定 ULA",
  pk_lock_after: "需要验证",
  pk_after_0: "立即",
  pk_after_60: "1 分钟后",
  pk_after_300: "5 分钟后",
  pk_after_900: "15 分钟后",
  pk_other: "其他设备",
  pk_locked: "应用已锁定",
  pk_with_password: "使用密码登录",
  pk_row_apple: "面容 ID 登录",
  pk_use_apple: "使用面容 ID",
  pk_foot_on_apple: "看一眼即可登录和解锁 ULA，无需密码。面容由 iPhone 自行验证，不会上传。",
  pk_row_android: "指纹登录",
  pk_use_android: "使用指纹",
  pk_foot_on_android: "用指纹登录和解锁 ULA，无需密码。指纹由手机自行验证，不会上传。",
  pk_row_windows: "Windows Hello",
  pk_use_windows: "使用 Windows Hello",
  pk_foot_on_windows: "使用 Windows Hello 登录和解锁 ULA，无需密码。",
  pk_row_other: "通行密钥登录",
  pk_use_other: "使用通行密钥",
  pk_foot_on_other: "无需密码即可登录和解锁 ULA。",
  // баланс клиента (js/wallet.js)
  wl_title: "客户余额",
  wl_chip: "余额",
  wl_btn_add: "充值",
  wl_btn_out: "退款给客户",
  wl_amount: "金额",
  wl_currency: "货币",
  wl_note: "备注（可选）",
  wl_note_ph: "例如：现金、银行转账",
  wl_apply: "立即支付订单欠款：{s}（{n}）",
  wl_save_add: "入账",
  wl_save_out: "退款",
  wl_empty: "暂无记录。客户提前付款时，点击“充值”。",
  wl_history: "明细",
  wl_k_deposit: "充值",
  wl_k_withdraw: "退款给客户",
  wl_k_order: "支付订单 {n}",
  wl_k_return: "退回余额 · 订单 {n}",
  wl_k_fix: "更正",
  wl_deleted: "订单已删除",
  wl_debt: "订单欠款",
  wl_net: "扣除欠款后",
  wl_pay: "用余额支付 · {s}",
  wl_back: "把付款退回余额",
  wl_back_q: "把订单 {n} 的付款 {s} 退回客户余额？",
  wl_paid_ok: "已用余额支付 {s}",
  wl_add_ok: "已入账 {s}",
  wl_add_paid: "已入账 {s}，其中 {p} 用于订单（{n}）",
  wl_out_ok: "已退款给客户 {s}",
  wl_back_ok: "已退回余额 {s}",
  wl_undo: "撤销",
  wl_undo_q: "撤销这条记录？如果是订单付款，订单将恢复为未付款。",
  wl_undo_ok: "记录已撤销",
  wl_no_funds: "余额不足",
  wl_bad_amount: "请输入大于零的金额",
  wl_prepaid: "客户预付款",
  wl_balance_line: "客户余额{s}：",
  cab_wallet: "您的余额",
  cab_wallet_hint: "您提前支付的款项，会用于您的订单。",
  cab_wallet_ops: "余额明细",
  bi_title: "商业分析", bi_hint: "管理员查看所选工作区的概览。",
  bi_choose_workspace: "请在上方列表中选择工作区。", bi_workspace: "工作区：{name}", bi_workspace_label: "买手工作区", bi_select_workspace: "选择工作区", bi_no_workspaces: "没有可用的工作区。请检查管理员登录和双重验证。",
  bi_period: "时间范围", bi_7: "7天", bi_30: "30天", bi_90: "90天", bi_365: "1年", bi_custom: "自定义日期", bi_from: "开始", bi_to: "结束", bi_show: "查看",
  bi_insufficient: "数据不足", bi_empty: "此期间没有订单或费用记录。", bi_no_orders: "此期间没有使用该货币的订单。", bi_bad_dates: "请选择有效日期，开始日期不能晚于结束日期。",
  bi_load_error: "无法加载概览。请重试并向支持人员提供错误代码。", bi_login_error: "登录已过期，请重新登录。", bi_access_error: "需要管理员权限。如果已启用双重验证，请完成验证。", bi_migration_error: "找不到概览函数，请检查 Supabase 中是否已运行迁移51。", bi_network_error: "网络未连接，请检查网络后重试。", bi_render_error: "数据已获取，但无法显示概览。请联系支持人员。",
  bi_scope: "订单按订单日期筛选，费用按费用日期筛选。已取消的订单不计入，显示当前状态。",
  bi_currency_note: "不同货币分别显示，不进行汇率换算。", bi_active: "进行中订单", bi_completed: "已交付订单", bi_delayed: "延迟订单", bi_status_note: "所选期间订单的当前状态。", bi_missing_deadline: "订单缺少确认的交付期限。",
  bi_order_value: "订单金额", bi_order_value_note: "订单的客户报价，并非已收款金额。", bi_expenses: "已记录费用", bi_recorded_expenses: "仅包括费用栏目中记录的费用。", bi_missing_expenses: "此期间没有费用记录，并不代表没有费用。",
  bi_order_profit: "订单利润", bi_profit_note: "根据已输入的价格和运费计算，不含一般费用。", bi_net: "净利润", bi_net_missing: "无法确认费用是否完整或重复计算。", bi_average: "平均订单金额", bi_average_profit: "平均订单利润", bi_missing_price: "请填写该货币所有订单的客户价格。", bi_missing_cost: "请填写所有订单的客户价格、采购价格和汇率。",
  bi_more_metrics: "还需要的数据", bi_suppliers: "供应商表现", bi_suppliers_missing: "需要关联记录及交付和质量数据。", bi_retention: "客户留存", bi_retention_missing: "需要统一的计算规则和可靠的客户识别。", bi_logistics: "物流表现", bi_logistics_missing: "需要计划和实际交付日期。",
  cl_links_btn: "匹配",
  cl_links_title: "客户匹配",
  cl_links_hint: "这里程序只提出建议，不会自动合并任何人：由您逐对决定。",
  cl_links_pairs: "可能是同一个人",
  cl_links_none: "没有匹配。",
  cl_links_r_same_phone: "电话号码完全相同。",
  cl_links_r_same_last9: "只有后9位数字相同。国家区号不同或缺失：可能是不同的人。",
  cl_links_r_same_name: "姓名相同，没有可比较的电话。",
  cl_links_orders: "订单：{n}",
  cl_links_ops: "操作：{n}",
  cl_links_same: "是同一个人",
  cl_links_diff: "不是同一个人",
  cl_links_merge_q: "合并“{a}”和“{b}”？订单和余额将归到同一客户。两人的共享链接都会停用，之后请重新创建。无法撤销。",
  cl_links_merged: "已合并：订单 {o} 个，余额记录 {w} 条。已停用共享链接：{l}。",
  cl_links_dismissed: "已隐藏：不是同一个人。",
  cl_links_wallet: "无归属的预付款",
  cl_links_owner_only: "由店铺所有者决定。",
  cl_links_err_neg: "这样会使客户余额变为负数。",
  cl_links_wallet_hint: "这些款项以前挂在多人共用的标识下。它们不计入任何人的余额，但会计入下方对账。请为每一笔操作单独选择客户：程序不会替您选择。已用于支付订单的款项只能归该订单的客户。",
  cl_links_pick: "— 选择客户 —",
  cl_links_new_opt: "新客户“{n}”",
  cl_links_assign: "归属",
  cl_links_assign_q: "将这笔 {s}（{k}）归属给客户“{n}”？无法撤销，决定将记入日志。",
  cl_links_assigned: "完成：该笔已归属，合计已核对一致。",
  cl_links_err_done: "这笔操作已分配，列表已刷新。",
  cl_links_err_order: "已用于支付订单的款项只能归该订单的客户。",
  cl_links_recon: "预付款对账",
  cl_links_recon_line: "{c}：合计 {t} · 客户名下 {a} · 未分配 {u}（{k} 笔）",
  cl_links_unres_note: "未分配预付款：{s}。这些款项不计入客户余额。",
  cl_links_open: "处理",
  cl_nocard: "无地址",
  cl_show_nocard: "无地址客户（{n}）",
  cl_hide_nocard: "隐藏无地址客户",
  cl_edit: "修改",
  cl_sum: "订单：{n}，进行中：{a}",
  cl_edit_title: "客户资料",
  cl_edit_save: "保存",
  cl_edit_hint: "地址由客户在自己的订单页面填写。",
  cl_edit_err_name: "姓名：2 到 120 个字符。",
  cl_edit_err_phone: "电话：9–15 位数字，可以以 + 开头。",
  cl_edit_err_tg: "Telegram：5–32 个字符，字母、数字和下划线。",
  cl_edit_ok: "客户资料已保存。",
  nq_title: "客户通知",
  nq_hint: "订单状态消息由服务器发送，更改状态后可以关闭网站。这里可以看到待发送、已发送和失败的消息。",
  nq_open: "打开日志",
  nq_pending: "待发送：{n}",
  nq_sent: "7 天内已发送：{n}",
  nq_failed: "失败：{n}",
  nq_modal_hint: "最近 50 条客户消息。失败后可以重试：消息会回到同一队列，操作会记入历史。",
  nq_refresh: "刷新",
  nq_none: "暂无消息。",
  nq_s_pending: "待发送",
  nq_s_processing: "发送中",
  nq_s_sent: "已发送",
  nq_s_failed: "失败",
  nq_s_skipped: "未发送",
  nq_next: "第 {n}/{m} 次尝试，下次约 {t}",
  nq_retry: "重试",
  nq_retry_q: "再次向客户发送这条消息吗？如果上一条其实已送达，客户会收到两次。",
  nq_retried: "消息已回到队列。",
  nq_err_state: "该条已不是失败状态，列表已刷新。",
  nq_history: "历史",
  nq_e_telegram_400: "Telegram 拒绝了消息（找不到聊天或请求有误）",
  nq_e_telegram_401_bot_not_configured: "服务器未配置机器人",
  nq_e_telegram_404_bot_not_configured: "服务器未配置机器人",
  nq_e_telegram_429: "Telegram 要求稍后再试",
  nq_e_telegram_500: "Telegram 端故障",
  nq_e_telegram_502: "Telegram 端故障",
  nq_e_telegram_503: "Telegram 端故障",
  nq_e_network_error: "无法连接 Telegram",
  nq_e_delivery_unknown: "不确定消息是否送达（没有响应）",
  nq_e_delivery_unknown_retry: "没有响应，稍后重试",
  nq_e_max_attempts: "尝试次数已用完",
  nq_e_subscription_removed: "客户已关闭通知或订单链接已更换",
  nq_e_subscription_changed: "事件之后客户的订阅发生了变化",
  nq_e_link_revoked: "订单链接已停用",
  nq_e_client_blocked_bot: "客户屏蔽了机器人",
  nq_e_no_text_for_status: "该状态没有文本",
  nq_a_created: "已创建",
  dl_title: "期限",
  dl_tz: "店铺时间：{z}",
  dl_pay_now: "请在 {d} 前付款",
  dl_none: "未设置付款期限（不会逾期）",
  dl_pay: "付款期限",
  dl_eta_from: "送达：从",
  dl_eta_to: "送达：到",
  dl_save: "保存期限",
  dl_pause: "暂停提醒",
  dl_resume: "恢复提醒",
  dl_paused: "此订单的提醒自 {d} 起已暂停。",
  dl_paused_ok: "此订单的提醒已暂停。",
  dl_resumed_ok: "提醒已恢复。",
  dl_saved: "期限已保存。",
  dl_snooze: "推迟 3 天",
  dl_snoozed: "任务已推迟 3 天。",
  dl_history: "期限历史",
  dl_hist_none: "没有变更。",
  dl_f_payment_due_at: "付款期限",
  dl_f_delivery_eta_from: "送达开始",
  dl_f_delivery_eta_to: "送达截止",
  dl_f_reminders_paused_at: "提醒暂停",
  dl_err_eta_incomplete: "请填写两个送达日期，或两个都清空。",
  dl_err_eta_order: "“从”日期晚于“到”日期。",
  dl_h_payment_overdue: "订单 {n}：付款期限已过（{d}），还需付款 {s}。请联系客户确认付款。",
  dl_h_delivery_soon: "订单 {n}：预计送达不晚于 {d}。请确认进展正常。",
  dl_h_delivery_overdue: "订单 {n}：预计送达期已过（{d}）。请向供应商或承运人核实。不会给客户发消息，状态也不会自动更改。",
  dl_h_missing_no_price: "订单 {n}：等待付款，但未设置客户价格。请填写价格。",
  dl_h_missing_no_weight: "订单 {n}：已在中国仓库，但未填写重量。请称重并填写，用于计算运费。",
  dl_h_missing_no_tracking: "订单 {n}：运输中，但没有物流单号。请补充。",
  rm_title: "付款提醒",
  rm_hint: "期限后自动通过 Telegram 提醒客户付款。默认关闭。仅适用于设置了付款期限且客户已连接 Telegram 的订单。送达延误不会通知客户。",
  rm_on: "当前：已开启。",
  rm_off: "当前：已关闭。",
  rm_enable: "开启自动提醒",
  rm_from: "发送时间从（点）",
  rm_to: "到（点）",
  rm_grace: "期限后等待（小时）",
  rm_gap: "提醒间隔（小时）",
  rm_max: "每单最多",
  rm_day: "每天最多（整个店铺）",
  rm_tz: "店铺时区",
  rm_rules: "规则：仅在 {z} 时间 {f}:00 至 {to}:00 发送；首次在付款期限后 {g} 小时；之后至少间隔 {gap} 小时；每单最多 {m} 条，每天最多 {d} 条。付款、取消、期限变更、订单暂停、关闭自动化、客户链接或订阅被撤销后停止。",
  rm_confirm_on: "开启对客户的自动提醒？\n\n{rules}",
  rm_save: "保存规则",
  rm_saved: "规则已保存。",
  rm_err_values: "请检查数值（小时 0–24，开始早于结束）。",
  rm_err_tz: "未知时区（例：Asia/Bishkek）。",
  dj_never: "服务器任务“{name}”从未运行：计划未启用。",
  dj_stale: "服务器任务“{name}”已停止：上次运行 {t}。",
  dj_error: "服务器任务“{name}”出错（上次运行 {t}）。",
  dj_ok: "服务器任务“{name}”运行正常（上次运行 {t}）。",
  dj_name_deadlines_scan: "期限监控",
  dj_name_fx_autoclose: "兑换自动关闭",
  dj_name_order_notify_worker: "通知发送",
  nq_k_payment_reminder: "付款提醒",
  nq_e_automation_off: "自动提醒已关闭",
  nq_e_paused: "该订单的提醒已暂停",
  nq_e_cancelled: "订单已取消",
  nq_e_deadline_changed: "付款期限已变更",
  nq_e_paid: "款项已付清",
  nq_e_daily_limit: "已达每日提醒上限",
  nq_a_claimed: "已领取",
  nq_a_sent: "已发送",
  nq_a_retry: "重试",
  nq_a_failed: "失败",
  nq_a_skipped: "已跳过",
  nq_a_requeued: "手动重试",
  nq_a_deferred: "已推迟到发送时段",
  nav_today: "今日",
  td_title: "今天要做的事",
  td_empty: "今天没有紧急事项。",
  td_empty_new: "还没有订单。点“新建”添加第一个。",
  td_more: "再显示 {n} 条",
  td_r_request: "客户 {name} 的新申请",
  td_r_no_price: "等待付款，但未填写客户价格",
  td_r_no_weight: "货物在中国仓库，未填写重量",
  td_r_no_tracking: "订单运输中，没有运单号",
  td_r_payment_overdue: "付款期限已过，还需支付 {s}",
  td_r_delivery_overdue: "送达期限已过（预计 {d}）",
  td_r_delivery_soon: "送达期限临近（预计 {d}）",
  td_btn_calc: "计算价格",
  td_btn_price: "填写价格",
  td_btn_weight: "填写重量",
  td_btn_track: "添加运单号",
  td_btn_open: "打开订单",
  td_r_nq_failed: "有 {n} 条客户通知未发送，客户不知道状态已变更",
  td_btn_nq: "查看",
  ca_pay: "登记付款",
  ca_next: "下一步：{s}",
  ca_step: "下一步：{s}",
  ca_left: "待付：{s}",
  ca_price_unknown: "未填写价格",
  ca_eta: "送达：{d}",
  ca_eta_none: "未设置送达时间",
  ca_details: "详情",
  mod_shop: "商店（商品展示）",
  mod_fx: "货币兑换",
  mod_note: "关闭后菜单项会隐藏。数据和规则不变，随时可以重新开启。",
  mod_old: "模块和时区暂时不可用：数据库缺少更新（文件 55）或网络不通。订单照常使用。简易模式目前只保存在本设备上。",
  mod_note_open: "兑换已关闭，但还有 {n} 笔未完成的交易或争议。处理完成前“兑换”入口保留。",
  mod_saved: "已保存",
  tz_title: "工作区时区",
  tz_zone: "时区（例如 Asia/Bishkek）",
  tz_rule: "付款和送达期限按此时区填写和显示，提醒发送时段也按它计算。更换时区后，已设置的期限仍是同一时刻，只是显示方式改变。",
  tz_confirm: "是的，时区正确",
  tz_change: "保存时区",
  tz_state_ok: "工作区时区：{z}。已于 {d} 确认。",
  tz_state_new: "工作区时区：{z}。您还没有确认——请检查后点“是的，时区正确”。",
  tz_saved: "时区已保存",
  tz_err: "没有这个时区，或保存失败。",
  tz_preview: "{n} 个进行中订单的期限保持同一时刻，其中 {d} 个的当地日期会改变。",
  tz_confirm_change: "将时区从 {a} 改为 {b}？\n\n{n} 个进行中订单的期限仍是同一时刻，但其中 {d} 个的当地日期会改变。改回时区即可恢复。",
  f_unsaved: "有未保存的更改。不保存就关闭吗？",
  f_unsaved_keep: "继续编辑",
  f_unsaved_drop: "不保存并关闭",
  f_stage_hint: "订单到达中国仓库后才会出现重量和运单号。其他字段在“显示所有字段”下。",
  f_err_num: "请检查“{f}”中的数字：只能填数字。",
  req_client: "请填写客户。",
  req_product: "请填写商品名称。",
  cp_search: "从列表中查找客户",
  cp_ph: "姓名、电话或 Telegram",
  cp_clear: "换一个",
  cp_chosen: "客户：{name}（{info}）",
  cp_noname: "无姓名",
  cp_nophone: "无电话",
  cp_noaddr: "无地址",
  cp_orders: "订单：{n}",
  cp_none: "没有这个客户。请在下方填写姓名——系统会自动创建客户。",
  cp_last: "最近订单 № {n}",
  cab_nf_title: "链接无法使用",
  cab_nf_text: "链接有误或已被停用。请向代购索取新链接。",
  cab_retry: "重试",
  cab_net_err: "加载失败。请检查网络后重试。",
  cab_unpriced: "价格尚未确定",
  cab_unpriced_note: "未定价订单：{n}。不计入待付金额。",
  cab_cancelled: "已取消",
  cab_eta: "预计送达",
  cab_eta_none: "暂无预计日期",
  cab_next: "下一步",
  ns_unpriced: "代购正在核算价格，暂时无需付款。",
  ns_pay: "请支付余款：{sum}。付款信息请向代购咨询。",
  ns_addr: "请填写收货地址。",
  ns_progress: "代购正在处理订单，您无需操作。",
  ns_transit: "包裹在途中，可凭单号查询。",
  ns_transit_notrack: "包裹在途中，代购尚未提供单号。",
  ns_arrived: "订单已到达，请与代购约定取货。",
  ns_done: "订单已完成。",
  ns_cancelled: "订单已取消。",
  cab_contact_title: "联系代购",
  cab_contact_btn: "联系代购",
  cab_contact_tg: "Telegram 联系",
  cab_contact_set_tg: "客户 Telegram",
  cab_contact_wa: "WhatsApp",
  cab_contact_call: "拨打电话",
  cab_contact_none: "代购未提供联系方式，请用您下单时的方式联系。",
  cab_addr_none: "未填写地址",
  cab_addr_ro: "地址只能由代购修改，请联系代购。",
  cab_addr_btn: "填写地址",
  cab_addr_exists: "地址已填写，只能由代购修改。",
  cab_pre_have: "余额预付款：{sum}。只有代购可将其抵扣本订单。",
  cab_cancel_paid: "已付：{sum}。请向代购咨询此款项。",
  cab_cost: "订单金额",
  cab_tg_on: "仅订单 № {n} 已开启 Telegram 通知，其他订单需单独开启。",
  cab_tg_off: "订单 № {n} 未开启 Telegram 通知。可通过该订单自己的链接开启，请向代购索取。",
  tgc_scope: "此订阅仅适用于订单 № {n}。",
  cab_updating: "加载中…",
  cab_card_exists_err: "地址已存在，只能由代购修改。",
  dl_proposed: "地址已发送给代购核对。代购确认之前，这只是您的建议。",
  dl_confirmed: "代购已确认该地址，只能由代购修改。",
  dl_form_note: "该地址仅适用于此订单，将提交给代购核对，核对后才算确认。",
  dl_confirmed_err: "代购已确认地址，只能由代购修改。",
  dl_staff_title: "客户填写的地址",
  dl_staff_proposed: "客户的建议：尚未核对。请与客户核实后确认。",
  dl_staff_confirmed: "您已确认该地址。",
  dl_staff_source_link: "来源：订单链接",
  dl_staff_source_cab: "来源：客户的通用链接",
  dl_confirm: "确认地址",
  dl_reject: "拒绝",
  dl_done_confirm: "地址已确认",
  dl_done_reject: "建议已拒绝",
  cab_contact_set: "客户联系方式",
  cab_contact_set_hint: "客户会在页面看到这些信息。留空则不显示。个人资料手机号不会公开。",
  cab_contact_phone: "客户电话",
  cab_contact_save: "保存联系方式",
  cab_contact_saved: "联系方式已保存",
  cab_contact_bad_phone: "电话：9–15 位数字，可以 + 开头。",
  cab_contact_bad_tg: "Telegram：5–32 位，字母、数字和下划线。",

  // путь заказа для клиента (js/tracking.js, файл 64)
  tk_path: "订单进度",
  tk_done: "已完成",
  tk_current: "当前",
  tk_todo: "未开始",
  tk_step_of: "第 {n} 步，共 {total} 步",
  tk_s_accepted: "已收到订单",
  tk_s_buying: "正在采购",
  tk_s_bought: "已采购",
  tk_s_cn_warehouse: "已到中国仓库",
  tk_s_packing: "准备发货",
  tk_s_shipped: "已从中国发出",
  tk_s_arrived_dest: "已到达目的国",
  tk_s_local: "同城配送中",
  tk_s_ready: "可以取货",
  tk_s_received: "已签收",
  tk_d_accepted: "我们已收到您的订单，即将开始处理",
  tk_d_buying: "采购员正在向供应商下单",
  tk_d_bought: "商品已向供应商采购完成",
  tk_d_cn_warehouse: "商品已到达中国仓库",
  tk_d_packing: "正在检查、称重并打包商品",
  tk_d_shipped: "货物已从中国发出，正在运往您处",
  tk_d_arrived_dest: "货物已到达目的国，正在处理中",
  tk_d_local: "订单已交给同城配送",
  tk_d_ready: "订单可以领取了",
  tk_d_received: "谢谢！订单已签收",
  tk_late: "配送时间延长了。我们正在向货运公司核实情况",
  tk_route: "运输路线",
  tk_route_local: "同城配送",
  tk_route_aria: "路线示意：{a} → {b}",
  tk_from_cn: "中国",
  tk_to_door: "地址或取货点",
  tk_days_label: "运输中",
  tk_days_one: "{n} 天",
  tk_days_few: "{n} 天",
  tk_days_many: "{n} 天",
  tk_days_other: "{n} 天",
  tk_usual_label: "通常运输时间",
  tk_usual: "{a}–{b} 天",
  tk_eta_label: "预计到达",
  tk_shipped_label: "发货日期",
  tk_approx: "进度仅供参考，取决于货运公司和海关",
  tk_h_stage: "客户进度已更新",
  tk_h_buyer: "采购员备注",
  tk_b_title: "客户可见的订单进度",
  tk_b_hint: "客户通过链接可以看到进度、时间和备注。更改进度不会发送任何消息。",
  tk_b_stage: "进度",
  tk_b_status_change: "订单状态将变为「{s}」。如果客户在 Telegram 订阅了此订单，会收到常规的状态通知。",
  tk_b_ship: "运输",
  tk_b_shipped: "从中国发货日期",
  tk_b_min: "最短天数",
  tk_b_max: "最长天数",
  tk_b_track: "运单号",
  tk_b_comment: "给客户的公开备注",
  tk_b_comment_hint: "客户可以看到，并会记录在订单历史中。请勿填写内部备注。",
  tk_b_save: "保存订单进度",
  tk_b_saved: "订单进度已保存",
  tk_b_history: "进度历史",
  tk_e_days: "天数必须在 1 到 180 之间。",
  tk_e_both: "请同时填写最短和最长天数，或都留空。",
  tk_e_order: "最短天数不能大于最长天数。",
  tk_e_date: "请检查发货日期：不能是未来的日期。",
  // карта маршрута Китай → Бишкек (js/tracking.js)
  tk_g_wh: "中国仓库",
  tk_g_kg: "吉尔吉斯斯坦",
  tk_g_kz: "哈萨克斯坦",
  tk_c_bishkek: "比什凯克",
  tk_bd_kg: "边境口岸",
  // срок доставки: Настройки и продление (js/tracking.js, файл 65)
  tk_def_title: "客户可见的运输时间",
  tk_def_hint: "所有未单独设置时间的订单，客户都会看到这个时间。留空则显示“10–20 天”。",
  tk_def_save: "保存运输时间",
  tk_def_saved: "运输时间已保存",
  tk_ext_label: "延长：",
  tk_ext_btn: "+{n} 天",
  tk_ext_done: "运输时间已延长：最多 {n} 天",
  tk_ext_eta: "时间由“期限”中的日期设置，请在那里修改。",
};

I18N.zh.wa_title = "消息";

I18N.zh.wa_connect_title = "为客户连接 WhatsApp";
I18N.zh.wa_connect_hint = "扫描二维码连接您的号码，在工作区管理消息、订单和通知。";
I18N.zh.wa_connect_button = "连接 WhatsApp";

// Раздел «Команда» (файлы 67–68)
I18N.zh.nav_team = "团队";
I18N.zh.tw_page_hint = "任务、员工、部门和权限";
I18N.zh.tw_invite_btn = "+ 邀请";
I18N.zh.tw_access_revoked = "工作区所有者已关闭您的访问权限。您的工作记录已保留。如有误，请联系所有者。";
I18N.zh.tw_e_forbidden = "您没有执行此操作的权限";
I18N.zh.tw_e_role = "只有所有者可以授予此角色";
I18N.zh.tw_e_dup = "已有同名部门";
I18N.zh.tw_e_cycle = "不允许：这会在结构中形成循环";
I18N.zh.tw_e_role_used = "该角色正在使用中。请先为员工和邀请更换角色";
I18N.zh.tw_e_system_role = "内置角色不能删除，但可以修改";
I18N.zh.tw_e_self = "不能停用自己";
I18N.zh.tw_e_elsewhere = "此人已在其他工作区工作";
I18N.zh.tw_e_checklist = "请先勾选清单中的所有项目";
I18N.zh.tw_e_note = "请填写原因";
I18N.zh.tw_e_no_reviewer = "请先指定审核人";
I18N.zh.tw_e_review_required = "此任务有审核人：请提交审核";
I18N.zh.tw_e_reviewer = "审核人必须是执行人以外的人";
I18N.zh.tw_e_assignee = "只有在职员工才能担任执行人";
I18N.zh.tw_e_closed = "任务已关闭。请先重新打开";
I18N.zh.tw_e_locked = "任务在审核中或已关闭时不能修改清单";
I18N.zh.tw_e_not_found = "找不到任务或您无权访问";
I18N.zh.tw_e_name = "请填写名称";
I18N.zh.tw_e_items = "项目过多（最多 50 项）";
I18N.zh.tw_role_manager = "运营经理";
I18N.zh.tw_role_sourcing = "采购";
I18N.zh.tw_role_qc = "质检";
I18N.zh.tw_role_logistics = "物流";
I18N.zh.tw_role_assistant = "助理";
I18N.zh.tw_nobody = "未指定";
I18N.zh.tw_no_name = "未命名";
I18N.zh.tw_former = "前员工";
I18N.zh.tw_you = "您";
I18N.zh.tw_reports_to = "上级：{n}";
I18N.zh.tw_my_rights = "我的权限：";
I18N.zh.tw_perm_none = "仅自己的任务";
I18N.zh.tw_perm_team_manage = "管理团队";
I18N.zh.tw_perm_team_manage_d = "邀请员工，设置部门、职位和角色，停用员工，管理部门";
I18N.zh.tw_perm_tasks_create = "给他人分配任务";
I18N.zh.tw_perm_tasks_create_d = "没有此权限只能给自己创建任务";
I18N.zh.tw_perm_tasks_view_all = "查看所有任务";
I18N.zh.tw_perm_tasks_view_all_d = "否则只能看到自己的、自己创建的和下属的任务";
I18N.zh.tw_perm_tasks_manage = "管理任何任务";
I18N.zh.tw_perm_tasks_manage_d = "修改、重新分配和取消他人的任务";
I18N.zh.tw_perm_tasks_review = "审核任务";
I18N.zh.tw_perm_tasks_review_d = "批准或退回任何已提交的任务（自己的除外）";
I18N.zh.tw_overdue_n = "逾期任务：{n}";
I18N.zh.tw_v_mine = "我的";
I18N.zh.tw_v_review = "待审核";
I18N.zh.tw_v_created = "我创建的";
I18N.zh.tw_v_all = "全部任务";
I18N.zh.tw_v_notif = "通知";
I18N.zh.tw_v_people = "员工";
I18N.zh.tw_v_depts = "部门";
I18N.zh.tw_v_roles = "角色";
I18N.zh.tw_v_audit = "日志";
I18N.zh.tw_edit = "修改";
I18N.zh.tw_deactivate = "停用";
I18N.zh.tw_reactivate = "重新启用";
I18N.zh.tw_delete = "删除";
I18N.zh.tw_off_since = "自 {d} 起停用";
I18N.zh.tw_invite_link = "邀请链接";
I18N.zh.tw_inactive = "已停用员工";
I18N.zh.tw_limit = "成员：{n} / {max}。已停用的不计入。";
I18N.zh.tw_no_dept = "无部门";
I18N.zh.tw_invite_title = "邀请员工";
I18N.zh.tw_invite_hint = "链接有效期 3 天，仅限一人使用。员工用自己的密码登录后会立即获得角色和部门。";
I18N.zh.tw_f_name = "邀请对象";
I18N.zh.tw_f_name_hint = "填写姓名，以免混淆邀请";
I18N.zh.tw_f_role = "角色";
I18N.zh.tw_f_dept = "部门";
I18N.zh.tw_f_title = "职位";
I18N.zh.tw_invite_create = "生成链接";
I18N.zh.tw_edit_title = "员工：{n}";
I18N.zh.tw_no_manager = "无上级";
I18N.zh.tw_f_manager = "上级（向谁汇报）";
I18N.zh.tw_off_title = "停用：{n}";
I18N.zh.tw_off_hint = "将立即失去工作区访问权限。订单、评论和工作记录会保留。可随时重新启用。";
I18N.zh.tw_f_handover = "未完成任务移交给";
I18N.zh.tw_leave_unassigned = "暂不分配";
I18N.zh.tw_f_handover_hint = "\"进行中\"的任务会变为新执行人的\"新任务\"。审核也会一并移交。";
I18N.zh.tw_f_note = "原因（仅管理者可见）";
I18N.zh.tw_off_done = "员工已停用。已移交任务：{n}";
I18N.zh.tw_on_confirm = "重新启用 {n}？将恢复工作区访问权限。";
I18N.zh.tw_on_done = "员工已重新加入团队";
I18N.zh.tw_dept_head = "负责人：{n}";
I18N.zh.tw_people_n = "人数：{n}";
I18N.zh.tw_dept_add = "添加部门";
I18N.zh.tw_dept_edit = "部门";
I18N.zh.tw_dept_empty = "还没有部门。部门可以显示谁负责什么。";
I18N.zh.tw_no_dept_people = "无部门：{n}";
I18N.zh.tw_f_dept_name = "名称";
I18N.zh.tw_f_parent = "上级部门";
I18N.zh.tw_f_head = "部门负责人";
I18N.zh.tw_dept_del_confirm = "删除部门\"{n}\"？员工会保留，但没有部门。";
I18N.zh.tw_role_add = "新角色";
I18N.zh.tw_role_edit = "角色";
I18N.zh.tw_roles_hint_owner = "角色是一组权限。权限由数据库检查：没有权限的操作不会执行。";
I18N.zh.tw_roles_hint = "角色是一组权限。只有所有者可以修改角色。";
I18N.zh.tw_role_system = "内置";
I18N.zh.tw_roles_orders_note = "订单权限暂时不变：员工可处理工作区订单，但不能删除订单或修改设置。按订单分配权限将在下一阶段实现。";
I18N.zh.tw_f_role_name = "角色名称";
I18N.zh.tw_f_perms = "权限";
I18N.zh.tw_role_del_confirm = "删除角色\"{n}\"？";
I18N.zh.tw_moved_n = "已移交任务：{n}";
I18N.zh.tw_a_invite_create = "{who}：新邀请 {x}";
I18N.zh.tw_a_invite_revoke = "{who}：邀请已取消";
I18N.zh.tw_a_member_join = "{whom}：已接受邀请（{x}）";
I18N.zh.tw_a_member_rejoin = "{whom}：重新加入团队（{x}）";
I18N.zh.tw_a_member_update = "{who}：修改了 {whom} 的信息";
I18N.zh.tw_a_member_deactivate = "{who}：停用了 {whom}，{x}";
I18N.zh.tw_a_member_reactivate = "{who}：重新启用了 {whom}";
I18N.zh.tw_a_member_reassign = "{who}：移交了 {whom} 的任务";
I18N.zh.tw_a_department_create = "{who}：新部门\"{x}\"";
I18N.zh.tw_a_department_update = "{who}：修改了部门\"{x}\"";
I18N.zh.tw_a_department_delete = "{who}：删除了部门\"{x}\"";
I18N.zh.tw_a_role_create = "{who}：新角色\"{x}\"";
I18N.zh.tw_a_role_update = "{who}：修改了角色\"{x}\"";
I18N.zh.tw_a_role_delete = "{who}：删除了角色\"{x}\"";
I18N.zh.tw_audit_empty = "暂无记录";
I18N.zh.tw_n_assigned = "您有新任务：任务{n}\"{x}\"（来自 {who}）";
I18N.zh.tw_n_unassigned = "任务{n}\"{x}\"已转给他人（{who}）";
I18N.zh.tw_n_reviewer = "您负责审核任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_submitted = "已提交审核：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_approved = "已通过：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_rejected = "已退回修改：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_blocked = "受阻：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_done = "已完成：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_cancelled = "已取消：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_reopened = "重新进行：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_comment = "任务{n}\"{x}\"有新评论（{who}）";
I18N.zh.tw_n_updated = "已修改：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_n_handover = "任务已移交给您：任务{n}\"{x}\"（{who}）";
I18N.zh.tw_read_all = "全部标为已读";
I18N.zh.tw_notif_empty = "暂无通知";
I18N.zh.tw_task_no = "任务{n}";
I18N.zh.tw_st_todo = "新任务";
I18N.zh.tw_st_in_progress = "进行中";
I18N.zh.tw_st_blocked = "受阻";
I18N.zh.tw_st_submitted = "审核中";
I18N.zh.tw_st_done = "已完成";
I18N.zh.tw_st_cancelled = "已取消";
I18N.zh.tw_pr_low = "低";
I18N.zh.tw_pr_normal = "普通";
I18N.zh.tw_pr_high = "重要";
I18N.zh.tw_pr_urgent = "紧急";
I18N.zh.tw_due = "截止 {d}";
I18N.zh.tw_due_over = "已逾期：{d}";
I18N.zh.tw_unassigned = "未分配";
I18N.zh.tw_items_n = "{a}/{b}";
I18N.zh.tw_comments_n = "评论：{n}";
I18N.zh.tw_empty_mine = "没有分配给您的任务。";
I18N.zh.tw_empty_review = "没有待审核的任务。";
I18N.zh.tw_empty_created = "您还没有创建任务。";
I18N.zh.tw_empty_all = "暂无任务。";
I18N.zh.tw_task_new = "新任务";
I18N.zh.tw_closed_n = "近 30 天已关闭：{n}";
I18N.zh.tw_act_start = "开始处理";
I18N.zh.tw_act_resume = "继续";
I18N.zh.tw_act_submit = "提交审核";
I18N.zh.tw_act_done = "完成";
I18N.zh.tw_act_block = "报告受阻";
I18N.zh.tw_act_withdraw = "撤回";
I18N.zh.tw_act_approve = "通过";
I18N.zh.tw_act_reject = "退回修改";
I18N.zh.tw_act_edit = "修改";
I18N.zh.tw_act_cancel = "取消任务";
I18N.zh.tw_act_restore = "恢复";
I18N.zh.tw_act_reopen = "重新打开";
I18N.zh.tw_f_assignee = "执行人";
I18N.zh.tw_f_reviewer = "审核人";
I18N.zh.tw_no_review = "无需审核";
I18N.zh.tw_f_due = "截止时间";
I18N.zh.tw_f_author = "创建人";
I18N.zh.tw_checklist = "清单";
I18N.zh.tw_item_add = "新项目";
I18N.zh.tw_add = "添加";
I18N.zh.tw_items_first = "提交任务前请勾选清单中的所有项目。";
I18N.zh.tw_confirm = "确认";
I18N.zh.tw_reason = "原因（必填）";
I18N.zh.tw_reason_opt = "原因（选填）";
I18N.zh.tw_comments = "评论";
I18N.zh.tw_no_comments = "暂无评论";
I18N.zh.tw_comment_ph = "写评论…";
I18N.zh.tw_send = "发送";
I18N.zh.tw_internal_note = "任务和评论仅团队可见。持链接的客户看不到。";
I18N.zh.tw_history = "历史";
I18N.zh.tw_ev_created = "{who}：创建了任务";
I18N.zh.tw_ev_status = "{who}：{a} → {b}";
I18N.zh.tw_ev_approved = "{who}：已通过";
I18N.zh.tw_ev_rejected = "{who}：退回修改";
I18N.zh.tw_ev_assigned = "{who}：执行人 — {n}";
I18N.zh.tw_ev_reviewer = "{who}：审核人 — {n}";
I18N.zh.tw_ev_handover = "移交：执行人 {a} → {b}";
I18N.zh.tw_ev_handover_r = "移交：审核人 {a} → {b}";
I18N.zh.tw_ev_edited = "{who}：修改了任务信息";
I18N.zh.tw_ev_item_added = "{who}：添加了项目\"{x}\"";
I18N.zh.tw_ev_item_checked = "{who}：勾选了\"{x}\"";
I18N.zh.tw_ev_item_unchecked = "{who}：取消勾选\"{x}\"";
I18N.zh.tw_ev_item_removed = "{who}：删除了项目\"{x}\"";
I18N.zh.tw_saved_status = "已完成";
I18N.zh.tw_task_edit = "任务";
I18N.zh.tw_task_create = "创建任务";
I18N.zh.tw_task_created = "任务已创建";
I18N.zh.tw_f_task_title = "要做什么";
I18N.zh.tw_f_desc = "详细说明";
I18N.zh.tw_f_priority = "优先级";
I18N.zh.tw_f_items_hint = "每行一项";
I18N.zh.tw_only_self = "您的角色只能给自己创建任务。";
I18N.zh.tw_perm_orders_all = "工作区全部订单";
I18N.zh.tw_perm_orders_all_d = "查看和管理所有订单、客户和资金。没有此权限时，只能看到分配给自己的订单及与职责相关的字段";
I18N.zh.tw_perm_orders_assign = "为订单分配人员";
I18N.zh.tw_perm_orders_assign_d = "订单负责人和团队、阶段模板、延误汇总";
I18N.zh.tw_roles_orders_note69 = "没有\"工作区全部订单\"权限的员工只能看到分配给自己的订单及与职责相关的字段，永远看不到客户价格、付款和利润。";
I18N.zh.tw_a_template_save = "{who}：保存了模板\"{x}\"";
I18N.zh.tw_a_template_delete = "{who}：删除了模板\"{x}\"";
I18N.zh.to_v_orders = "我的订单";
I18N.zh.to_v_attention = "需要关注";
I18N.zh.to_v_templates = "阶段模板";
I18N.zh.to_duty_lead = "订单负责人";
I18N.zh.to_duty_sourcing = "采购";
I18N.zh.to_duty_qc = "质检";
I18N.zh.to_duty_logistics = "物流";
I18N.zh.to_duty_support = "支持";
I18N.zh.to_duty_none = "无职责";
I18N.zh.to_state_on_track = "按计划";
I18N.zh.to_state_at_risk = "有风险";
I18N.zh.to_state_delayed = "延误";
I18N.zh.to_ms_pending = "待开始";
I18N.zh.to_ms_in_progress = "进行中";
I18N.zh.to_ms_done = "已完成";
I18N.zh.to_ms_delayed = "延误";
I18N.zh.to_ms_skipped = "已跳过";
I18N.zh.to_lead_n = "负责人：{n}";
I18N.zh.to_no_lead = "无负责人";
I18N.zh.to_next = "下一步：{x}，截止 {d}";
I18N.zh.to_delays_n = "延误：{n}";
I18N.zh.to_mine_hint = "您所在团队的订单。只显示您需要的数据。";
I18N.zh.to_attention_hint = "存在未解决延误或逾期阶段的订单。";
I18N.zh.to_empty_mine = "您还没有被分配到任何订单。";
I18N.zh.to_empty_attention = "所有订单均按计划进行。";
I18N.zh.to_my_duties = "我的职责：{x}";
I18N.zh.to_f_product = "商品";
I18N.zh.to_f_qty = "数量";
I18N.zh.to_f_date = "下单日期";
I18N.zh.to_f_eta = "预计送达";
I18N.zh.to_f_ship_to = "目的地";
I18N.zh.to_f_client = "客户";
I18N.zh.to_f_supplier = "供应商";
I18N.zh.to_link = "链接";
I18N.zh.to_f_price = "单件采购价";
I18N.zh.to_f_track = "运单号";
I18N.zh.to_f_dest = "客户收货地";
I18N.zh.to_f_order = "订单";
I18N.zh.to_edit_fields = "修改信息";
I18N.zh.to_scoped_note = "您只能看到与职责相关的字段。客户价格、付款和利润已隐藏。";
I18N.zh.to_team = "订单团队";
I18N.zh.to_team_empty = "此订单尚未分配人员。";
I18N.zh.to_assign = "分配到订单";
I18N.zh.to_milestones = "阶段";
I18N.zh.to_ms_start = "开始";
I18N.zh.to_ms_finish = "完成";
I18N.zh.to_ms_undo = "重新打开";
I18N.zh.to_ms_skip = "跳过";
I18N.zh.to_report_delay = "报告延误";
I18N.zh.to_ms_empty = "暂无阶段。";
I18N.zh.to_tpl_apply = "按模板添加阶段";
I18N.zh.to_tpl_replace = "按模板替换";
I18N.zh.to_ms_add = "阶段";
I18N.zh.to_delay_open = "延误未解决";
I18N.zh.to_delay_closed = "已解决";
I18N.zh.to_cat_supplier = "供应商";
I18N.zh.to_cat_quality = "质量";
I18N.zh.to_cat_logistics = "物流";
I18N.zh.to_cat_customs = "海关";
I18N.zh.to_cat_client = "客户";
I18N.zh.to_cat_other = "其他";
I18N.zh.to_new_due = "截止 {a} → {b}";
I18N.zh.to_actions = "纠正措施：";
I18N.zh.to_resolution = "结果：{x}";
I18N.zh.to_action_add = "纠正措施";
I18N.zh.to_resolve = "关闭延误";
I18N.zh.to_delays = "延误";
I18N.zh.to_delays_none = "没有延误。";
I18N.zh.to_internal_note = "阶段、延误和团队为内部数据。持链接的客户看不到。";
I18N.zh.to_ev_team_add = "{who}：{n} — {d}";
I18N.zh.to_ev_team_remove = "{who}：移除了 {n}（{d}）";
I18N.zh.to_ev_handover = "移交：{a} → {b}（{d}）";
I18N.zh.to_ev_template = "{who}：按模板\"{x}\"添加阶段";
I18N.zh.to_ev_ms_add = "{who}：新阶段\"{x}\"";
I18N.zh.to_ev_ms_edit = "{who}：修改了阶段\"{x}\"";
I18N.zh.to_ev_ms_delete = "{who}：删除了阶段\"{x}\"";
I18N.zh.to_ev_ms_status = "{who}：\"{x}\" — {s}";
I18N.zh.to_ev_fields = "{who}：已修改 — {x}";
I18N.zh.to_ev_delay = "{who}：延误（{x}）";
I18N.zh.to_ev_action = "{who}：措施\"{x}\"";
I18N.zh.to_ev_resolve = "{who}：延误已关闭";
I18N.zh.to_fld_supplier = "供应商";
I18N.zh.to_fld_supplier_link = "供应商商品链接";
I18N.zh.to_fld_supplier_wechat = "供应商微信";
I18N.zh.to_fld_tracking_number = "运单号";
I18N.zh.to_fields_hint = "价格、重量和订单状态由拥有全部订单权限的人修改。";
I18N.zh.to_f_person = "员工";
I18N.zh.to_f_duty = "职责";
I18N.zh.to_assign_hint = "每个订单只有一位负责人：新负责人会替换旧的。被分配者会收到通知。";
I18N.zh.to_ms_edit = "阶段";
I18N.zh.to_f_ms_title = "阶段名称";
I18N.zh.to_ms_delete = "删除阶段";
I18N.zh.to_f_template = "模板";
I18N.zh.to_tpl_hint = "阶段日期从今天开始计算。";
I18N.zh.to_tpl_replace_hint = "未完成的阶段将被替换，已完成的保留。";
I18N.zh.to_delay_hint = "该阶段将标记为\"延误\"，负责人和所有者会收到通知。不会向客户发送任何内容。";
I18N.zh.to_f_milestone = "阶段";
I18N.zh.to_whole_order = "整个订单";
I18N.zh.to_f_category = "原因类别";
I18N.zh.to_f_reason = "发生了什么";
I18N.zh.to_f_new_due = "阶段新日期";
I18N.zh.to_f_shift = "将后续阶段顺延相同时间";
I18N.zh.to_delay_saved = "延误已记录，已通知相关负责人";
I18N.zh.to_f_action = "要做什么";
I18N.zh.to_action_hint = "该措施将成为与订单关联的团队任务。";
I18N.zh.to_f_resolution = "如何解决";
I18N.zh.to_resolved = "延误已关闭";
I18N.zh.to_tpl_new = "新模板";
I18N.zh.to_tpl_edit = "模板";
I18N.zh.to_tpl_page_hint = "模板是包含职责和天数期限的订单阶段清单。";
I18N.zh.to_day_n = "第 {n} 天";
I18N.zh.to_f_days = "距开始天数";
I18N.zh.to_tpl_steps_hint = "阶段 · 职责 · 距开始天数";
I18N.zh.to_step_add = "步骤";
I18N.zh.to_e_steps = "需要名称和至少一个步骤";
I18N.zh.to_tpl_del_confirm = "删除模板\"{n}\"？订单中的阶段会保留。";
I18N.zh.to_detail_title = "团队和阶段";
I18N.zh.to_detail_hint = "订单负责人、阶段、延误";
I18N.zh.to_detail_open = "打开";
I18N.zh.to_unassign_confirm = "将此人从该订单职责中移除？";
I18N.zh.to_ms_del_confirm = "删除此阶段？";
I18N.zh.to_n_assigned = "您被分配到订单 {x}（{who}）";
I18N.zh.to_n_unassigned = "您已从订单 {x} 移除（{who}）";
I18N.zh.to_n_delay = "订单 {x} 延误（{who}）";
I18N.zh.to_n_resolved = "订单 {x} 的延误已关闭（{who}）";
I18N.zh.to_e_not_found = "找不到订单或您未被分配到该订单";
I18N.zh.to_e_ms_exist = "该订单已有阶段";
I18N.zh.to_e_delay_open = "请先关闭该阶段的延误";
I18N.zh.to_e_closed = "订单已关闭";
I18N.zh.to_e_category = "请选择原因";
I18N.zh.to_e_delay_closed = "延误已关闭";
I18N.zh.to_e_ms_closed = "该阶段已完成或已跳过";
I18N.zh.tw_g_tasks = "任务";
I18N.zh.tw_g_orders = "订单";
I18N.zh.tw_g_ops = "运营";
I18N.zh.tw_g_people = "人员";
I18N.zh.tw_g_reports = "报告";
I18N.zh.tw_perm_ops_manage = "管理运营";
I18N.zh.tw_perm_ops_manage_d = "规程和事件：指定负责人、关闭、编辑日历事件";
I18N.zh.tw_perm_reports_view = "查看团队分析";
I18N.zh.tw_perm_reports_view_d = "所有员工指标和团队汇总。没有此权限只能看到自己的指标";
I18N.zh.tw_a_sop_save = "{who}：保存了规程\"{x}\"";
I18N.zh.op_v_dashboard = "概览";
I18N.zh.op_v_incidents = "事件";
I18N.zh.op_v_calendar = "日历";
I18N.zh.op_v_sops = "规程";
I18N.zh.op_v_analytics = "分析";
I18N.zh.op_dash_hint = "当前需要关注的事项。点击数字打开列表。";
I18N.zh.op_dash_orders = "订单";
I18N.zh.op_dash_tasks = "任务";
I18N.zh.op_dash_incidents = "事件与规程";
I18N.zh.op_dash_workload = "团队工作量";
I18N.zh.op_d_open = "进行中";
I18N.zh.op_d_no_lead = "无负责人";
I18N.zh.op_d_ms_overdue = "阶段逾期";
I18N.zh.op_d_ms_week = "7 天内阶段";
I18N.zh.op_d_delays_by = "未解决延误：{n}。原因：";
I18N.zh.op_d_overdue = "逾期";
I18N.zh.op_d_done_week = "7 天内完成";
I18N.zh.op_d_inc_open = "未解决事件";
I18N.zh.op_d_sops = "规程";
I18N.zh.op_d_sops_unread = "未读（人 × 规程）";
I18N.zh.op_w_open = "任务";
I18N.zh.op_inc_new = "报告事件";
I18N.zh.op_inc_report = "报告";
I18N.zh.op_inc_hint = "事件是需要调查的问题：次品、丢失、违规。相关负责人会收到通知。";
I18N.zh.op_inc_saved = "事件已记录";
I18N.zh.op_inc_no = "事件{n}";
I18N.zh.op_inc_show_all = "显示近半年全部";
I18N.zh.op_inc_show_open = "仅未解决";
I18N.zh.op_inc_empty = "没有未解决的事件。";
I18N.zh.op_inc_empty_all = "没有事件。";
I18N.zh.op_owner_n = "负责人：{n}";
I18N.zh.op_no_owner = "无负责人";
I18N.zh.op_no_order = "无订单";
I18N.zh.op_actions_open = "未完成措施：{n}";
I18N.zh.op_f_inc_title = "发生了什么";
I18N.zh.op_f_inc_desc = "详细说明";
I18N.zh.op_f_severity = "严重程度";
I18N.zh.op_f_owner = "负责人";
I18N.zh.op_f_reporter = "报告人";
I18N.zh.op_f_root = "根本原因：";
I18N.zh.op_f_resolution = "解决方案：";
I18N.zh.op_sev_low = "低";
I18N.zh.op_sev_medium = "中";
I18N.zh.op_sev_high = "高";
I18N.zh.op_sev_critical = "严重";
I18N.zh.op_ist_open = "未处理";
I18N.zh.op_ist_investigating = "调查中";
I18N.zh.op_ist_resolved = "已解决";
I18N.zh.op_ist_closed = "已关闭";
I18N.zh.op_cat_supplier = "供应商";
I18N.zh.op_cat_quality = "质量";
I18N.zh.op_cat_logistics = "物流";
I18N.zh.op_cat_customs = "海关";
I18N.zh.op_cat_client = "客户";
I18N.zh.op_cat_finance = "财务";
I18N.zh.op_cat_safety = "安全";
I18N.zh.op_cat_other = "其他";
I18N.zh.op_act_investigate = "开始调查";
I18N.zh.op_act_resolve = "已解决";
I18N.zh.op_act_close = "关闭";
I18N.zh.op_act_reopen = "重新调查";
I18N.zh.op_act_owner = "负责人和严重程度";
I18N.zh.op_resolve_hint = "所有纠正措施完成后才能标记解决。由运营负责人关闭。";
I18N.zh.op_e_resolution = "请填写原因和解决方案";
I18N.zh.op_internal_note = "事件仅团队可见。不会向客户发送任何内容。";
I18N.zh.op_ev_created = "{who}：创建了事件";
I18N.zh.op_ev_status = "{who}：{a} → {b}";
I18N.zh.op_ev_owner = "{who}：负责人 — {n}";
I18N.zh.op_ev_severity = "{who}：严重程度 — {s}";
I18N.zh.op_ev_comment = "{who}：评论";
I18N.zh.op_ev_action = "{who}：纠正措施";
I18N.zh.op_n_incident_new = "新事件{n}\"{x}\"（{s}，{who}）";
I18N.zh.op_n_incident_owner = "您负责事件{n}\"{x}\"（{who}）";
I18N.zh.op_n_incident_status = "事件{n}\"{x}\"：{s}（{who}）";
I18N.zh.op_n_sop_published = "新的或更新的规程\"{x}\"——请阅读（{who}）";
I18N.zh.op_cal_prev = "更早";
I18N.zh.op_cal_next = "更晚";
I18N.zh.op_cal_today = "今天";
I18N.zh.op_cal_mine = "只看我的";
I18N.zh.op_event_new = "事件安排";
I18N.zh.op_event_edit = "事件安排";
I18N.zh.op_event_del_confirm = "删除此安排？";
I18N.zh.op_f_event_title = "标题";
I18N.zh.op_f_starts = "开始";
I18N.zh.op_f_ends = "结束";
I18N.zh.op_f_note = "备注";
I18N.zh.op_k_event = "安排";
I18N.zh.op_k_task = "任务";
I18N.zh.op_k_milestone = "阶段";
I18N.zh.op_k_incident = "事件";
I18N.zh.op_sop_new = "规程";
I18N.zh.op_sop_edit = "规程";
I18N.zh.op_sop_hint = "规程说明我们的工作方式。请阅读新的和更新的规程并标记已读。";
I18N.zh.op_sop_empty = "暂无规程。";
I18N.zh.op_sop_unread = "未读";
I18N.zh.op_sop_read = "已读";
I18N.zh.op_sop_read_v = "已读第 {n} 版";
I18N.zh.op_sop_ack = "我已阅读";
I18N.zh.op_sop_acked_ok = "已标记为已读";
I18N.zh.op_sop_ver = "第 {n} 版 · {d}";
I18N.zh.op_sop_acked = "{b} 人中 {a} 人已读";
I18N.zh.op_sop_who = "谁读过当前版本";
I18N.zh.op_sop_ack_ok = "{d} 已读";
I18N.zh.op_sop_ack_old = "只读过第 {n} 版";
I18N.zh.op_sop_ack_no = "未读";
I18N.zh.op_sop_versions = "历史版本：{n}";
I18N.zh.op_sop_st_draft = "草稿";
I18N.zh.op_sop_st_published = "已发布";
I18N.zh.op_sop_st_archived = "已归档";
I18N.zh.op_f_sop_title = "标题";
I18N.zh.op_f_sop_cat = "分类";
I18N.zh.op_f_sop_body = "规程正文";
I18N.zh.op_f_sop_status = "状态";
I18N.zh.op_sop_body_hint = "每行一个步骤。每次修改正文都会保留旧版本，员工需要重新标记已读。";
I18N.zh.op_e_sop = "需要标题和正文";
I18N.zh.rp_days_7 = "7 天";
I18N.zh.rp_days_30 = "30 天";
I18N.zh.rp_days_90 = "90 天";
I18N.zh.rp_days_365 = "一年";
I18N.zh.rp_export = "下载 Excel";
I18N.zh.rp_exported = "报告已下载";
I18N.zh.rp_hint_all = "按任务、订单阶段、延误和事件统计的期间指标。只统计团队工作，不含订单金额。";
I18N.zh.rp_hint_me = "您在该期间的指标。拥有\"查看团队分析\"权限的人可以看到全团队指标。";
I18N.zh.rp_team = "团队";
I18N.zh.rp_k_done = "已完成任务";
I18N.zh.rp_k_on_time = "按时";
I18N.zh.rp_k_cycle = "每任务用时";
I18N.zh.rp_k_returns = "审核退回";
I18N.zh.rp_k_ms_on_time = "阶段按时";
I18N.zh.rp_k_delays = "延误";
I18N.zh.rp_k_incidents = "事件";
I18N.zh.rp_k_overdue_now = "当前逾期";
I18N.zh.rp_of_created = "共创建 {n}";
I18N.zh.rp_of_due = "共 {n} 个有截止日期";
I18N.zh.rp_of_submitted = "共提交 {n}";
I18N.zh.rp_of_done = "共完成 {n}";
I18N.zh.rp_h = "小时";
I18N.zh.rp_resolve_h = "平均 {n} 小时解决";
I18N.zh.rp_quality = "质量";
I18N.zh.rp_q_qc_done = "质检阶段完成";
I18N.zh.rp_q_qc_delayed = "质检阶段延误";
I18N.zh.rp_q_delays = "质量延误";
I18N.zh.rp_q_incidents = "质量事件";
I18N.zh.rp_delays_by = "按原因统计延误";
I18N.zh.rp_c_count = "数量";
I18N.zh.rp_c_shift = "延期天数";
I18N.zh.rp_c_resolve = "关闭用时（小时）";
I18N.zh.rp_inc_by = "按类别统计事件：";
I18N.zh.rp_steps = "延误最多的阶段：";
I18N.zh.rp_weekly = "每周完成任务";
I18N.zh.rp_week_tip = "{d} 起的一周：完成 {n}";
I18N.zh.rp_table = "按周表格";
I18N.zh.rp_c_week = "周";
I18N.zh.rp_c_created = "创建";
I18N.zh.rp_c_done = "完成";
I18N.zh.rp_people = "员工指标";
I18N.zh.rp_me = "我的指标";
I18N.zh.rp_c_ms = "阶段（按时）";
I18N.zh.rp_c_reviewed = "已审核";
I18N.zh.rp_c_open = "当前未完成";
I18N.zh.rp_people_note = "\"按时\"只统计有截止日期的已完成任务。\"退回\"指已提交任务被退回的次数。这些指标用于沟通而非惩罚：请关注原因。";
I18N.zh.rp_period = "期间：{a} – {b}";

// «Мои цели» (js/goals.js, файл 72)
I18N.zh.nav_goals = "我的目标";
I18N.zh.gl_page_hint = "五年、一年、一个月和一周的目标，任务看板和今日重点。只有您自己能看到。";
I18N.zh.gl_v_today = "今天";
I18N.zh.gl_v_goals = "目标";
I18N.zh.gl_v_calendar = "日历";
I18N.zh.gl_missing = "数据库更新（文件 72）后此栏目即可使用。订单和其他数据不受影响。";
I18N.zh.gl_focus = "今日重点";
I18N.zh.gl_focus_hint = "推动目标前进的三件最重要的事。其他的可以等等。";
I18N.zh.gl_focus_done = "已完成 {n}/{m}";
I18N.zh.gl_pick_slot = "+ 选择重点事项";
I18N.zh.gl_no_goal = "未关联目标";
I18N.zh.gl_in_focus_min = "专注 {n} 分钟";
I18N.zh.gl_timer = "专注计时器";
I18N.zh.gl_t_running = "进行中";
I18N.zh.gl_t_paused = "已暂停";
I18N.zh.gl_t_ready = "就绪";
I18N.zh.gl_t_on = "正在做：";
I18N.zh.gl_t_hint = "点击重点事项旁的 ▶，时间将计入该事项";
I18N.zh.gl_min = "{n} 分钟";
I18N.zh.gl_t_start = "开始";
I18N.zh.gl_t_pause = "暂停";
I18N.zh.gl_t_resume = "继续";
I18N.zh.gl_t_finish = "结束并计入";
I18N.zh.gl_t_done = "本次结束：专注 {n} 分钟";
I18N.zh.gl_t_credited = "已计入 {n} 分钟";
I18N.zh.gl_t_short = "不足一分钟，不计入";
I18N.zh.gl_s_min = "今日专注分钟";
I18N.zh.gl_s_done = "今日完成";
I18N.zh.gl_s_streak = "连续天数";
I18N.zh.gl_quick = "快速记录";
I18N.zh.gl_quick_hint = "放入「收件箱」";
I18N.zh.gl_quick_ph = "需要做什么？";
I18N.zh.gl_quick_btn = "记录";
I18N.zh.gl_quick_ok = "已放入「收件箱」";
I18N.zh.gl_l_overdue = "已逾期";
I18N.zh.gl_l_today = "今天到期";
I18N.zh.gl_l_doing = "进行中";
I18N.zh.gl_e_overdue = "没有逾期事项。";
I18N.zh.gl_e_today = "今天没有到期事项。";
I18N.zh.gl_e_doing = "没有进行中的事项。";
I18N.zh.gl_more = "还有 {n} 项";
I18N.zh.gl_more_focus = "其他重点：{list}";
I18N.zh.gl_to_focus = "加入今日重点";
I18N.zh.gl_focused = "已加入今日重点";
I18N.zh.gl_unfocus = "移出重点";
I18N.zh.gl_timer_task = "为此事项开始计时";
I18N.zh.gl_mark_done = "标记为完成";
I18N.zh.gl_c_inbox = "收件箱";
I18N.zh.gl_c_plan = "计划中";
I18N.zh.gl_c_doing = "进行中";
I18N.zh.gl_c_done = "已完成";
I18N.zh.gl_h_inbox = "想法和临时想到的事";
I18N.zh.gl_h_plan = "决定要做";
I18N.zh.gl_h_doing = "已经开始";
I18N.zh.gl_all_goals = "全部目标";
I18N.zh.gl_new_task = "+ 任务";
I18N.zh.gl_add_card = "+ 添加卡片";
I18N.zh.gl_hidden = "另有 {n} 项已隐藏";
I18N.zh.gl_board_hint = "在列之间拖动卡片。在手机上，打开卡片并选择列。";
I18N.zh.gl_late = "已逾期";
I18N.zh.gl_today_chip = "今天";
I18N.zh.gl_tomorrow = "明天";
I18N.zh.gl_hz_5y = "五年";
I18N.zh.gl_hz_year = "年";
I18N.zh.gl_hz_month = "月";
I18N.zh.gl_hz_week = "周";
I18N.zh.gl_add_5y = "五年目标";
I18N.zh.gl_add_year = "年度目标";
I18N.zh.gl_add_month = "月度目标";
I18N.zh.gl_add_week = "本周目标";
I18N.zh.gl_hint_5y = "您想成为什么样的人、想建立什么。例如：「拥有 20 人团队的自己的公司」。";
I18N.zh.gl_hint_year = "迈向五年目标的一大步。例如：「通过 HSK 5」。";
I18N.zh.gl_hint_month = "月底前应完成的事。";
I18N.zh.gl_hint_week = "本周的具体成果。";
I18N.zh.gl_active = "进行中：{n}";
I18N.zh.gl_leads_to = "通向：{name}";
I18N.zh.gl_steps = "{d}/{t} 步 · {p}%";
I18N.zh.gl_no_steps = "还没有步骤——添加任务或更小的目标";
I18N.zh.gl_why_strategy = "原因与策略";
I18N.zh.gl_why = "为什么重要";
I18N.zh.gl_strategy = "策略";
I18N.zh.gl_edit = "编辑";
I18N.zh.gl_add_step = "+ 步骤";
I18N.zh.gl_achieved = "已达成";
I18N.zh.gl_reopen = "重新进行";
I18N.zh.gl_until = "截至 {d}";
I18N.zh.gl_days_left = "{n} 天";
I18N.zh.gl_overdue_goal = "已过期";
I18N.zh.gl_areas = "事业|财务|健康|家庭|学习|个人";
I18N.zh.gl_cal_task = "任务到期";
I18N.zh.gl_cal_late = "已逾期";
I18N.zh.gl_cal_goal = "目标期限";
I18N.zh.gl_cal_focus = "有专注";
I18N.zh.gl_day_empty = "这一天没有到期事项。";
I18N.zh.gl_day_add = "+ 当天任务";
I18N.zh.gl_day_focus = "专注：{n} 分钟";
I18N.zh.gl_rem_title = "每日提醒";
I18N.zh.gl_rem_hint = "手机日历每天早上会提醒您：「选择今日重点」。下载事件并点击「添加」。";
I18N.zh.gl_rem_time = "时间";
I18N.zh.gl_rem_btn = "添加到日历";
I18N.zh.gl_rem_ok = "打开下载的文件，把事件添加到日历。";
I18N.zh.gl_rem_summary = "选择今日重点";
I18N.zh.gl_rem_desc = "打开 ULA Factory → 我的目标，选出三件重点事项。";
I18N.zh.gl_ics_btn = "加入日历";
I18N.zh.gl_task = "任务";
I18N.zh.gl_task_new = "新任务";
I18N.zh.gl_f_title = "要做什么";
I18N.zh.gl_f_col = "列";
I18N.zh.gl_f_due = "期限";
I18N.zh.gl_f_goal = "关联目标";
I18N.zh.gl_f_nogoal = "无目标";
I18N.zh.gl_f_focus = "今日重点";
I18N.zh.gl_f_notes = "备注";
I18N.zh.gl_f_check = "清单";
I18N.zh.gl_f_check_ph = "新项目";
I18N.zh.gl_f_total = "累计专注：{n} 分钟";
I18N.zh.gl_need_title = "请写下需要做什么。";
I18N.zh.gl_add = "添加";
I18N.zh.gl_delete = "删除";
I18N.zh.gl_delete_sure = "确定删除？";
I18N.zh.gl_cancel = "取消";
I18N.zh.gl_save = "保存";
I18N.zh.gl_close = "关闭";
I18N.zh.gl_goal = "目标";
I18N.zh.gl_goal_new = "新目标";
I18N.zh.gl_g_title = "目标";
I18N.zh.gl_g_ph = "例如：通过 HSK 5";
I18N.zh.gl_g_hz = "期限范围";
I18N.zh.gl_g_area = "领域";
I18N.zh.gl_g_noarea = "无领域";
I18N.zh.gl_g_parent = "通向目标";
I18N.zh.gl_g_top = "这是最大的目标";
I18N.zh.gl_g_none = "无";
I18N.zh.gl_g_why_ph = "目标达成后会有什么改变";
I18N.zh.gl_g_strategy = "策略：我将如何实现";
I18N.zh.gl_g_strategy_ph = "主要步骤、资源、障碍以及如何克服";
I18N.zh.gl_g_need = "请写下目标。";
I18N.zh.gl_pick_title = "今天的重点事项";
I18N.zh.gl_pick_hint = "选择最能推动目标的事项。";
I18N.zh.gl_pick_new = "或输入新事项";
I18N.zh.gl_pick_g1 = "今天或更早到期";
I18N.zh.gl_pick_none = "没有未完成的事项——请在上方输入新事项。";
I18N.zh.gl_e_focus_full = "重点已有三件事。请先移除一件再添加。";
I18N.zh.gl_e_parent = "上级目标的期限范围必须更长。";
I18N.zh.gl_e_limit = "已达到记录上限。请删除旧的已完成任务。";
I18N.zh.gl_e_save = "未保存。请检查网络后重试。";
// «Мои цели» — доски, поиск, шаблоны, неделя, фокус на Главной (js/goals.js, файл 72)
I18N.zh.gl_v_boards = "看板";
I18N.zh.gl_main_board = "我的任务";
I18N.zh.gl_b_search_ph = "搜索看板、卡片或目标";
I18N.zh.gl_b_starred = "已加星标";
I18N.zh.gl_b_recent = "最近查看";
I18N.zh.gl_b_mine = "我的看板";
I18N.zh.gl_b_new = "新建看板";
I18N.zh.gl_b_templates = "模板";
I18N.zh.gl_b_tpl_hint = "现成的看板和列表，只需添加卡片。";
I18N.zh.gl_b_count = "未完成 {n} · 已完成 {d}";
I18N.zh.gl_b_archive = "已归档看板（{n}）";
I18N.zh.gl_b_restore = "恢复";
I18N.zh.gl_b_delete = "永久删除";
I18N.zh.gl_b_delete_sure = "确定连同所有卡片一起删除？";
I18N.zh.gl_b_archive_btn = "归档";
I18N.zh.gl_b_archived = "看板已归档，可在“看板”页面底部恢复。";
I18N.zh.gl_b_in_archive = "此看板已归档。";
I18N.zh.gl_star = "加星标";
I18N.zh.gl_unstar = "取消星标";
I18N.zh.gl_back = "← 看板";
I18N.zh.gl_board_settings = "设置";
I18N.zh.gl_board = "看板";
I18N.zh.gl_board_new = "新看板";
I18N.zh.gl_b_create = "创建";
I18N.zh.gl_b_title = "看板名称";
I18N.zh.gl_b_title_ph = "例如：通过 HSK 5";
I18N.zh.gl_b_need = "请输入名称。";
I18N.zh.gl_b_color = "颜色";
I18N.zh.gl_b_goal = "看板目标";
I18N.zh.gl_b_tpl = "模板";
I18N.zh.gl_b_tpl_empty = "空白：待办 · 进行中 · 完成";
I18N.zh.gl_tpl_empty_lists = "待办|进行中|完成";
I18N.zh.gl_tpl_goal = "目标计划";
I18N.zh.gl_tpl_goal_lists = "目标与策略|本月|下月|以后|完成";
I18N.zh.gl_tpl_goal_d = "目标、按月步骤和已完成";
I18N.zh.gl_tpl_kanban = "看板法";
I18N.zh.gl_tpl_kanban_lists = "想法|待办|进行中|完成";
I18N.zh.gl_tpl_kanban_d = "经典：从想法到完成";
I18N.zh.gl_tpl_day = "每日任务";
I18N.zh.gl_tpl_day_lists = "上午|下午|晚上|已完成";
I18N.zh.gl_tpl_day_d = "按时段安排一天";
I18N.zh.gl_tpl_study = "学习";
I18N.zh.gl_tpl_study_lists = "主题|正在学|复习|已通过";
I18N.zh.gl_tpl_study_d = "主题、复习和已通过";
I18N.zh.gl_tpl_kaizen = "改善";
I18N.zh.gl_tpl_kaizen_lists = "问题|改进想法|尝试中|已落实";
I18N.zh.gl_tpl_kaizen_d = "每天一点小改进";
I18N.zh.gl_tpl_year = "按季度规划全年";
I18N.zh.gl_tpl_year_lists = "第一季度|第二季度|第三季度|第四季度|完成";
I18N.zh.gl_tpl_year_d = "全年大计划";
I18N.zh.gl_list = "列表";
I18N.zh.gl_list_title = "列表名称";
I18N.zh.gl_list_left = "← 左移";
I18N.zh.gl_list_right = "右移 →";
I18N.zh.gl_list_delete = "删除列表";
I18N.zh.gl_list_nonempty = "有卡片的列表不能删除，请先移走或删除卡片。";
I18N.zh.gl_add_card_ph = "输入卡片标题…";
I18N.zh.gl_add_card_btn = "添加卡片";
I18N.zh.gl_add_list_ph = "+ 添加列表";
I18N.zh.gl_cboard_hint = "在列表之间拖动卡片。点击圆圈标记完成。点击列表名称可重命名或移动。";
I18N.zh.gl_board_for_goal = "+ 为目标建看板";
I18N.zh.gl_f_board = "看板";
I18N.zh.gl_f_list = "列表";
I18N.zh.gl_f_done = "已完成";
I18N.zh.gl_no_lists = "此看板没有列表，请先添加列表。";
I18N.zh.gl_sr_none = "没有找到，换个词试试。";
I18N.zh.gl_sr_boards = "看板";
I18N.zh.gl_sr_cards = "卡片";
I18N.zh.gl_sr_goals = "目标";
I18N.zh.gl_undo = "撤销";
I18N.zh.gl_restored = "已恢复";
I18N.zh.gl_del_item = "已删除：“{name}”";
I18N.zh.gl_week = "最近 7 天";
I18N.zh.gl_week_meta = "专注 {m} 分钟 · 完成 {d} · 达成目标 {g}";
I18N.zh.gl_week_bar = "{d}：专注 {n} 分钟";
I18N.zh.gl_home_title = "今日专注";
I18N.zh.gl_home_empty = "今天的三件要事还没选。";
I18N.zh.gl_home_open = "打开“我的目标”";
I18N.zh.gl_home_pick = "选择三件要事";

// Главная страница для гостя (js/home.js)
I18N.zh.lp_nav_tools = "核心工具";
I18N.zh.lp_nav_services = "服务";
I18N.zh.lp_nav_how = "如何开始";
I18N.zh.lp_nav_clients = "客户查询";
I18N.zh.lp_login = "登录";
I18N.zh.lp_start = "免费开始";
I18N.zh.lp_about = "ULA Factory 是什么？";
I18N.zh.lp_have_acc = "我已有账号";
I18N.zh.lp_eyebrow = "面向中国采购买手的平台";
I18N.zh.lp_h1_a = "中国订单——";
I18N.zh.lp_h1_b = "从工厂到客户，全程掌控";
I18N.zh.lp_lead = "ULA Factory 是买手的工作台。订单、付款、物流和客户集中管理，客户自己就能看到货物到了哪里。";
I18N.zh.lp_cta_start = "免费创建工作台";
I18N.zh.lp_cta_track = "查询订单";
I18N.zh.lp_trust1 = "1 分钟注册";
I18N.zh.lp_trust2 = "手机和电脑都能用";
I18N.zh.lp_trust3 = "数据只有您能看到";
I18N.zh.lp_demo_label = "订单示例";
I18N.zh.lp_demo_item = "运动鞋，40 双";
I18N.zh.lp_demo_status = "运输中";
I18N.zh.lp_demo_s1 = "已采购";
I18N.zh.lp_demo_s2 = "中国仓库";
I18N.zh.lp_demo_s3 = "边境";
I18N.zh.lp_demo_s4 = "比什凯克";
I18N.zh.lp_demo_eta = "预计送达";
I18N.zh.lp_demo_eta_v = "5–7 天后";
I18N.zh.lp_demo_left = "待付款";
I18N.zh.lp_demo_left_v = "12 400 索姆";
I18N.zh.lp_demo_profit = "本月利润";
I18N.zh.lp_demo_profit_v = "+18%";
I18N.zh.lp_buyer_t = "我是买手——在中国采购";
I18N.zh.lp_buyer_d = "订单、客户和资金在一个工作台管理，不用表格，也不用几十个聊天群。只有您和您的团队能看到。";
I18N.zh.lp_buyer_btn = "创建工作台";
I18N.zh.lp_client_t = "我是客户——在等订单";
I18N.zh.lp_client_d = "买手给您发了链接？粘贴到这里，即可查看订单状态、付款和包裹路线。";
I18N.zh.lp_track_ph = "粘贴买手发来的链接";
I18N.zh.lp_track_btn = "打开";
I18N.zh.lp_track_err = "这不像订单链接。请让买手重新发送。";
I18N.zh.lp_tools_kicker = "注册之后";
I18N.zh.lp_tools_title = "与客户和订单打交道所需的一切";
I18N.zh.lp_p1_t = "客户主页";
I18N.zh.lp_p1_d = "每位客户都有自己的页面：所有订单、欠款和付款。发一个链接，再也不用回答“到哪了？”。";
I18N.zh.lp_p1_b1 = "带订单历史的客户卡片";
I18N.zh.lp_p1_b2 = "一个链接查看客户的全部订单";
I18N.zh.lp_p1_b3 = "客户通过链接提交需求";
I18N.zh.lp_p2_t = "订单跟踪";
I18N.zh.lp_p2_d = "10 个阶段：从工厂采购到比什凯克取货。客户能看到阶段、时效和运单号。";
I18N.zh.lp_p2_b1 = "阶段进度和路线地图";
I18N.zh.lp_p2_b2 = "通过 Telegram 通知客户状态";
I18N.zh.lp_p2_b3 = "付款和送达期限";
I18N.zh.lp_p3_t = "业务管理";
I18N.zh.lp_p3_d = "利润、欠款和支出自动计算。谁欠款、什么卖得好、赚了多少，一目了然。";
I18N.zh.lp_p3_b1 = "数据分析和利润报表";
I18N.zh.lp_p3_b2 = "欠款一键提醒";
I18N.zh.lp_p3_b3 = "团队：角色、任务、权限";
I18N.zh.lp_s_kicker = "平台服务";
I18N.zh.lp_s_title = "买手需要的一切，尽在一处";
I18N.zh.lp_s_sub = "只开启您的业务需要的功能。";
I18N.zh.lp_s1_t = "报价计算";
I18N.zh.lp_s1_d = "按商品价格、重量和货运费率算出客户价，含您的加价。";
I18N.zh.lp_s2_t = "批次与货运";
I18N.zh.lp_s2_d = "多个订单一起发货：运费按重量自动分摊。";
I18N.zh.lp_s3_t = "自己的店铺";
I18N.zh.lp_s3_d = "展示您商品的页面：客户加入购物车并下单。";
I18N.zh.lp_s4_t = "索姆 → 人民币兑换";
I18N.zh.lp_s4_d = "在工作台内兑换，用于向中国供应商付款。";
I18N.zh.lp_s5_t = "工厂地图";
I18N.zh.lp_s5_d = "您的工厂和供应商标在中国地图上，只有您能看到。";
I18N.zh.lp_s6_t = "WhatsApp 群发";
I18N.zh.lp_s6_d = "用现成文本通知客户订单状态或欠款。";
I18N.zh.lp_s7_t = "Excel 与导入";
I18N.zh.lp_s7_d = "从 Excel 或笔记本照片导入订单，报表导出为 .xlsx。";
I18N.zh.lp_s8_t = "团队";
I18N.zh.lp_s8_d = "经理在您的工作台内工作，拥有各自的权限和任务。";
I18N.zh.lp_how_kicker = "如何开始";
I18N.zh.lp_how_title = "三步，订单尽在掌控";
I18N.zh.lp_how1_t = "注册";
I18N.zh.lp_how1_d = "用邮箱或 Google 注册，一分钟工作台就绪。";
I18N.zh.lp_how2_t = "添加订单和客户";
I18N.zh.lp_how2_d = "手动录入、Excel 导入或拍笔记本照片——随您方便。";
I18N.zh.lp_how3_t = "把链接发给客户";
I18N.zh.lp_how3_d = "客户看到状态和付款，您看到利润和欠款。";
I18N.zh.lp_final_t = "从今天起，轻松管理中国订单";
I18N.zh.lp_final_d = "免费注册。界面支持俄语、英语和中文。";
// Главная: «Так выглядит кабинет» и вопросы-ответы
I18N.zh.lp_nav_show = "工作台";
I18N.zh.lp_nav_faq = "常见问题";
I18N.zh.lp_show_kicker = "注册前先看看";
I18N.zh.lp_show_title = "工作台长这样";
I18N.zh.lp_show_sub = "这是程序的真实界面，上面的姓名和金额仅为示例。";
I18N.zh.lp_show_t1 = "订单";
I18N.zh.lp_show_t2 = "数据分析";
I18N.zh.lp_show_t3 = "客户看到什么";
I18N.zh.lp_show_c1 = "所有订单按阶段显示：新订单、采购中、在仓库、运输中。谁欠多少、下一步做什么，一目了然。";
I18N.zh.lp_show_c2 = "任意时间段的利润、营收和欠款，不用 Excel 和计算器。最佳月份和主要客户一看便知。";
I18N.zh.lp_show_c3 = "客户打开您的链接，就能看到订单阶段、路线和待付金额。无需注册，无需安装应用。";
I18N.zh.lp_show_b1 = "订单 10 个阶段";
I18N.zh.lp_show_b2 = "到比什凯克的路线地图";
I18N.zh.lp_show_b3 = "Telegram 状态通知";
I18N.zh.lp_faq_kicker = "问答";
I18N.zh.lp_faq_title = "常见问题";
I18N.zh.lp_faq_sub = "没找到答案？给我们写信，我们会亲自回复。";
I18N.zh.lp_c_mail = "发送邮件";
I18N.zh.lp_q1 = "费用是多少？";
I18N.zh.lp_a1 = "注册免费，无需银行卡。创建工作台，添加几个订单，看看是否适合您。";
I18N.zh.lp_q2 = "谁能看到我的订单和客户？";
I18N.zh.lp_a2 = "只有您和您邀请的团队成员。其他买手看不到您的工作台。与网站的连接是加密的。";
I18N.zh.lp_q3 = "在中国能用吗？";
I18N.zh.lp_a3 = "可以，网站专为在中国使用而设计：不依赖在中国被屏蔽的 Google 服务。在中国无法用 Google 登录，请使用邮箱和密码登录。";
I18N.zh.lp_q4 = "需要安装什么吗？";
I18N.zh.lp_a4 = "不需要。工作台在手机和电脑的浏览器中打开。在手机上可以添加到主屏幕，像应用一样打开。";
I18N.zh.lp_q5 = "我的客户能看到什么？";
I18N.zh.lp_a5 = "只能通过链接看到自己的订单：阶段、路线、时效和待付金额。客户看不到您的采购价和利润，也无需注册。";
I18N.zh.lp_q6 = "怎样把表格和笔记本里的订单搬过来？";
I18N.zh.lp_a6 = "上传 Excel 或 CSV 文件：列会自动匹配，导入前您可以先检查。笔记本上的记录可以拍照上传。";
I18N.zh.lp_q7 = "可以和经理一起工作吗？";
I18N.zh.lp_a7 = "可以。邀请团队成员，分配角色和权限，布置任务。他们能做什么——删除、查看利润、修改设置——由您决定。";
I18N.zh.lp_q8 = "支持哪些语言？";
I18N.zh.lp_a8 = "俄语、英语、中文和越南语。一键切换语言，方便与中国的同事合作。";

// главная: курс юаня ULA для всех (js/home.js, файл 75)
I18N.zh.lp_rate_h = "今日人民币汇率";
I18N.zh.lp_rate_today = "ULA 汇率 · 今天 {t} 更新";
I18N.zh.lp_rate_on = "ULA 汇率 · {d} 更新";
I18N.zh.lp_rate_down = "便宜 {n} 索姆 · 原为 {was}";
I18N.zh.lp_rate_up = "上涨 {n} 索姆 · 原为 {was}";
I18N.zh.lp_rate_flat = "近 {n} 天汇率未变";
I18N.zh.lp_rate_chart_a = "汇率走势：1 ¥ 兑 {lo}–{hi} 索姆";
I18N.zh.lp_rate_chip_a = "今日人民币汇率：1 ¥ = {n} 索姆";
I18N.zh.lp_rate_calc = "需要多少人民币？";
I18N.zh.lp_rate_pay = "应付";
I18N.zh.lp_rate_hint = "输入人民币金额，自动换算成索姆";
I18N.zh.lp_rate_at = "汇率 {r}";
I18N.zh.lp_rate_cta = "兑换人民币";
I18N.zh.lp_rate_note = "免费注册后即可兑换。ULA 汇率每天更新。";
I18N.zh.lp_rate_note_fx = "无需注册：输入金额 → 查看收款信息 → 上传付款截图。可在网站上查看申请状态。";

// чат по заявке на обмен (файл 76)
I18N.zh.xc_title = "申请聊天";
I18N.zh.xc_sub = "我们在这里回复";
I18N.zh.xc_sub_eta = "通常在 {n} 内回复";
I18N.zh.xc_hello_title = "您好！";
I18N.zh.xc_hello = "这是您申请的聊天。可以询问兑换进度或再发一张付款凭证——我们会在这里回复。";
I18N.zh.xc_q_status = "我的申请进展如何？";
I18N.zh.xc_q_paid = "我已付款，请查收";
I18N.zh.xc_q_when = "人民币什么时候到账？";
I18N.zh.xc_ph_client = "输入消息…";
I18N.zh.xc_ph_buyer = "回复客户…";
I18N.zh.xc_note_client = "请只在这里沟通。不要向私信中发来的账户付款。";
I18N.zh.xc_closed = "聊天已关闭";
I18N.zh.xc_closed_hint = "聊天已关闭：申请已完成超过 3 天。如需帮助，请提交新申请。";
I18N.zh.xc_today = "今天";
I18N.zh.xc_yesterday = "昨天";
I18N.zh.xc_photo = "照片";
I18N.zh.xc_photo_open = "查看照片";
I18N.zh.xc_sending = "发送中";
I18N.zh.xc_delivered = "已送达";
I18N.zh.xc_read = "已读";
I18N.zh.xc_failed = "未发送";
I18N.zh.xc_retry = "点击重新发送";
I18N.zh.xc_attach = "附上照片或凭证";
I18N.zh.xc_send = "发送";
I18N.zh.xc_e_fast = "发送太频繁，请稍等一分钟";
I18N.zh.xc_e_many = "此聊天消息过多";
I18N.zh.xc_e_send = "发送失败。请检查网络，点击消息重试";
I18N.zh.xc_new_msg = "新消息";
I18N.zh.xc_new_title = "申请已提交";
I18N.zh.xc_new_text = "这里显示兑换状态以及与兑换方的聊天。请保存此页面链接以便返回。";
I18N.zh.xc_copy_link = "复制链接";
I18N.zh.xc_link_copied = "链接已复制";
I18N.zh.xc_sys_dispute_me = "您发起了争议";
I18N.zh.xc_sys_dispute_client = "客户发起了争议";
I18N.zh.xc_sys_dispute_buyer = "卖家发起了争议";
I18N.zh.xc_sys_resolved = "争议裁决";
I18N.zh.xc_dispute_hint = "请在下方聊天中留言并附上截图——ULA Factory 管理员可以看到全部对话。";
I18N.zh.xc_dispute_hint_buyer = "争议沟通在申请聊天中进行。ULA Factory 管理员可以看到全部内容。";
I18N.zh.xc_btn = "聊天";
I18N.zh.xc_unread = "未读：{n}";
I18N.zh.xc_with = "与客户聊天：{name}";
I18N.zh.xc_client_page = "客户页面";
I18N.zh.xc_empty_buyer = "暂无消息。客户在申请页面可以看到聊天。";
I18N.zh.xc_ping = "客户发来新消息";
I18N.zh.xc_go_chat = "联系兑换方";
