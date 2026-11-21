// ULA FACTORY — вьетнамский интерфейс (Tiếng Việt). Выбирается в «Настройки → Язык».
// Подключает i18n.js (скачивается только выбранный язык). Новые фразы добавлять во все четыре словаря.
I18N.vi = {
  app_title: "ULA Factory — đơn hàng từ Trung Quốc",
  login_title: "Đăng nhập",
  email: "Email",
  password: "Mật khẩu",
  login_btn: "Đăng nhập",
  logging_in: "Đang đăng nhập…",
  logout: "Đăng xuất",
  login_error: "Email hoặc mật khẩu không đúng",
  no_access: "Tài khoản này không có quyền vào trang quản lý",
  config_title: "Hãy điền config.js",
  config_text: "Mở config.js và dán địa chỉ dự án Supabase cùng khóa công khai của bạn.",
  lib_missing: "supabase.js chưa tải được. Hãy chắc chắn nó nằm cùng thư mục với index.html.",
  nav_orders: "Đơn hàng",
  nav_home: "Trang chủ",
  home_place: "Đặt đơn hàng",
  home_new_d: "Hàng, giá, vận chuyển, thanh toán",
  home_link_d: "Khách tự gửi yêu cầu",
  home_import_d: "Nhiều đơn cùng lúc",
  home_quote_d: "Tính giá cho khách",
  home_money: "Tiền theo đơn hàng",
  home_all_orders: "Tất cả đơn ({n}) ›",
  nav_menu: "Mục",
  nav_clients: "Khách hàng",
  nav_suppliers: "Nhà cung cấp",
  suppliers_search: "Tìm theo tên, liên hệ, số điện thoại hoặc WeChat",
  suppliers_count: "Nhà cung cấp: {n}",
  supplier_add: "Thêm nhà cung cấp",
  supplier_save: "Lưu nhà cung cấp",
  supplier_name: "Tên công ty hoặc nhà máy",
  supplier_contact: "Người liên hệ",
  supplier_phone: "Điện thoại",
  supplier_wechat: "WeChat",
  supplier_city: "Thành phố",
  supplier_category: "Nhóm hàng",
  supplier_address: "Địa chỉ",
  supplier_notes: "Ghi chú (chỉ bạn thấy)",
  suppliers_empty_title: "Chưa có nhà cung cấp",
  suppliers_empty_text: "Thêm nhà cung cấp để lưu thông tin liên hệ của họ tại đây.",
  supplier_saved: "Đã lưu nhà cung cấp",
  supplier_deleted: "Đã xóa nhà cung cấp",
  supplier_confirm_delete: "Xóa nhà cung cấp “{name}”?",
  nav_calc: "Tỷ giá",
  fx_title: "Máy tính tiền tệ",
  fx_amount: "Số tiền",
  fx_from_cur: "Từ",
  fx_to: "Sang",
  fx_swap: "Đổi chiều",
  fx_use: "Dùng tỷ giá này cho đơn hàng mới",
  fx_used: "Tỷ giá {r} sẽ được điền vào đơn hàng mới",
  fx_updated: "Tỷ giá tính đến {d}. Nguồn: open.er-api.com (cập nhật hằng ngày). Tỷ giá ngân hàng và quầy đổi tiền có thể khác.",
  fx_table: "1 đơn vị tiền tệ tính bằng {c}",
  fx_error: "Không tải được tỷ giá. Kiểm tra kết nối và nhấn ↻.",
  fx_loading: "Đang tải tỷ giá…",
  rq_title: "Gửi yêu cầu đặt hàng",
  rq_to: "Người bán: {n}",
  rq_hint: "Gửi ảnh sản phẩm, link hoặc mô tả và nhập số lượng. Cần nhiều sản phẩm? Hãy thêm thẻ khác. Chúng tôi sẽ tính giá và liên hệ với bạn.",
  rq_link: "Link sản phẩm",
  rq_link_hint: "Sao chép địa chỉ trang sản phẩm. Nếu không có link, hãy mô tả sản phẩm bên dưới.",
  rq_product: "Tên hoặc mô tả sản phẩm",
  rq_product_ph: "Ví dụ: giày Nike, màu đen, size 39–44",
  rq_qty: "Số lượng",
  rq_name: "Tên của bạn",
  rq_phone: "Điện thoại",
  rq_phone_hint: "Kèm mã quốc gia, để chúng tôi nhắn WhatsApp cho bạn",
  rq_telegram: "Telegram (không bắt buộc)",
  rq_comment: "Mong muốn (không bắt buộc)",
  rq_comment_ph: "Màu, size, thời hạn, điều kiện đặc biệt",
  rq_send: "Gửi yêu cầu",
  rq_sending: "Đang gửi…",
  rq_consent: "Khi gửi yêu cầu, bạn đồng ý cho xử lý tên và số điện thoại để liên hệ về đơn hàng.",
  rq_e_link: "Kiểm tra lại link hoặc mô tả sản phẩm bằng lời",
  rq_e_product: "Thêm ảnh, link hoặc mô tả sản phẩm",
  rq_e_qty: "Nhập số lượng lớn hơn không",
  rq_sent_title: "Đã nhận yêu cầu",
  rq_sent_text: "{n} đã nhận yêu cầu của bạn, sẽ tính giá và liên hệ với bạn.",
  rq_track: "Theo dõi yêu cầu",
  rq_track_hint: "Qua link này bạn xem được trạng thái đơn hàng và nhập địa chỉ giao hàng. Hãy lưu lại.",
  rq_again: "Gửi yêu cầu khác",
  rq_nf_title: "Link không còn hiệu lực",
  rq_nf_text: "Link yêu cầu này đã bị tắt hoặc hết hạn. Hãy nhờ người bán gửi link mới.",
  rq_err_title: "Không mở được",
  rq_err_load: "Kiểm tra kết nối và tải lại trang.",
  rq_err_many: "Quá nhiều yêu cầu trong thời gian ngắn. Hãy thử lại sau hoặc nhắn thẳng cho người bán.",
  rq_err: "Không gửi được yêu cầu. Kiểm tra kết nối và thử lại.",
  rq_photos: "Ảnh sản phẩm",
  rq_photos_hint: "Tối đa {n} ảnh: sản phẩm, ảnh chụp màn hình, nhãn — bất cứ thứ gì giúp tìm hàng.",
  rq_photo_add: "Thêm ảnh",
  rq_photos_max: "Chỉ được đính kèm tối đa {n} ảnh",
  rq_by_photo: "Hàng theo ảnh",
  rq_photo_fail: "Đã nhận yêu cầu, nhưng một số ảnh chưa tải lên. Hãy gửi chúng cho người bán qua WhatsApp.",
  rq_m_buy: "giá nhập",
  rq_m_sell: "giá cho khách",
  rq_m_supplier: "nhà cung cấp hoặc link",
  rq_m_weight: "cân nặng",
  rq_fill: "Yêu cầu của khách. Hãy bổ sung đơn — còn thiếu: {f}.",
  rq_fill_btn: "Bổ sung",
  rq_fill_left: "Đã lưu. Còn trống: {f}. Có thể bổ sung sau.",
  rq_new_title: "🛍 Yêu cầu mới № {n}",
  rq_new_toast: "Yêu cầu mới № {n}. Hãy mở và bổ sung đơn.",
  rq_new_many: "Yêu cầu mới: {n}. Hãy mở và bổ sung đơn.",
  rq_item_n: "Sản phẩm {n}",
  rq_add_item: "Thêm sản phẩm khác",
  rq_items_max: "Một yêu cầu chứa tối đa {n} sản phẩm. Hãy gửi phần còn lại bằng yêu cầu mới.",
  rq_you: "Thông tin liên hệ của bạn",
  rq_send_n: "Gửi yêu cầu ({n} sản phẩm)",
  rq_sent_many: "{n} đã nhận yêu cầu, sẽ tính giá từng sản phẩm và liên hệ với bạn.",
  rq_left: "Chưa gửi hết: còn {n} sản phẩm. Bấm nút bên dưới và gửi lại sau ít phút.",
  rq_finish: "Quay lại sản phẩm chưa gửi",
  rq_tag: "Yêu cầu",
  h_requests: "Yêu cầu mới của khách: {n}",
  cl_price_pending: "Giá vẫn đang được tính. Chúng tôi sẽ nhắn bạn khi có.",
  rl_btn: "Link yêu cầu",
  rl_title: "Link yêu cầu",
  rl_hint: "Gửi cho khách hàng: họ dán link sản phẩm và số lượng, và một đơn hàng mới có nhãn “Yêu cầu” sẽ xuất hiện ngay chỗ bạn. Khách không cần đăng ký.",
  rl_active: "Link đang hoạt động",
  rl_disabled: "Link đang tắt. Hãy tạo link để nhận yêu cầu.",
  rl_create: "Tạo link",
  rl_rotate: "Đổi link",
  rl_revoke: "Tắt link",
  rl_confirm_rotate: "Đổi link? Link cũ ngừng hoạt động ngay, khách đã lưu link cũ sẽ không gửi được yêu cầu.",
  rl_confirm_revoke: "Tắt link? Khách sẽ không gửi được yêu cầu cho đến khi bạn tạo link mới.",
  rl_created: "Đã tạo link",
  rl_created_copied: "Đã tạo và sao chép link",
  rl_revoked: "Đã tắt link",
  rl_wa_text: "Xin chào! Để đặt hàng, hãy gửi yêu cầu qua link này (dán link sản phẩm và số lượng), mình sẽ báo giá:",
  tm_btn: "Nhóm",
  tm_title: "Nhóm: trợ lý",
  tm_hint: "Trợ lý đăng nhập bằng mật khẩu riêng và làm việc trong tài khoản của bạn: đơn hàng, khách hàng, lô hàng, nhà cung cấp. Họ không thể xóa, đổi cài đặt hay xem báo cáo lợi nhuận.",
  tm_invites: "Lời mời (chưa được chấp nhận)",
  tm_create: "Mời trợ lý",
  tm_limits: "Link mời có hiệu lực 3 ngày và chỉ dùng được cho một người. Tối đa 5 trợ lý.",
  tm_role_owner: "Chủ tài khoản",
  tm_role_staff: "Trợ lý",
  tm_remove: "Xóa",
  tm_cancel: "Hủy",
  tm_invite_until: "Có hiệu lực đến {d}",
  tm_wa_text: "Xin chào! Hãy đăng ký và đăng nhập qua link này — bạn sẽ làm việc trong tài khoản ULA Factory của mình:",
  tm_created: "Đã tạo lời mời",
  tm_created_copied: "Đã tạo lời mời, link đã được sao chép",
  tm_confirm_remove: "Xóa trợ lý này? Họ sẽ không còn thấy đơn hàng của bạn.",
  tm_removed: "Đã xóa trợ lý",
  tm_err_own: "Tài khoản của bạn đã có đơn hàng hoặc khách hàng, nên không thể tham gia tài khoản khác.",
  tm_err_full: "Nhóm đã đủ số trợ lý tối đa.",
  tm_err_many: "Quá nhiều lời mời chưa dùng. Hãy hủy những lời mời không cần.",
  tm_err_admin: "Quản trị viên không thể làm trợ lý.",
  tm_err_invalid: "Lời mời không dùng được: đã được dùng hoặc đã hết hạn. Hãy xin link mới.",
  tm_joined: "Xong! Bạn đang làm việc trong tài khoản với vai trò trợ lý.",
  tm_login_note: "Bạn được mời vào một nhóm. Đăng nhập hoặc đăng ký là vào thẳng tài khoản.",
  rl_limits: "Chống spam: tối đa 5 yêu cầu mỗi giờ từ một số điện thoại và 20 yêu cầu mỗi giờ cho mỗi tài khoản. Nếu ai đó đăng link công khai, hãy đổi link.",
  nav_shipments: "Lô hàng",
  sh_hint: "Nhiều đơn hàng trong một chuyến hàng: cân nặng và cước vận chuyển được chia cho các đơn tự động.",
  sh_new: "Lô hàng mới",
  sh_empty: "Chưa có lô hàng. Hãy tạo lô, thêm đơn hàng — cước sẽ được chia theo cân nặng.",
  sh_err_db: "Lô hàng chưa được kết nối trong cơ sở dữ liệu: hãy chạy migration_16_shipments.sql trong Supabase.",
  sh_no_orders: "Lô hàng này chưa có đơn nào",
  sh_orders: "Đơn hàng: {n}",
  sh_weight: "Cân nặng: {w} kg",
  sh_per_kg: "≈ {x} mỗi kg",
  sh_flag_ok: "Đã chia cước",
  sh_flag_recalc: "Cần tính lại — mở và lưu",
  sh_flag_noweight: "Đơn chưa có cân nặng: {n}",
  sh_open: "Mở",
  sh_title_new: "Lô hàng mới",
  sh_f_name: "Tên lô hàng",
  sh_f_name_ph: "Ví dụ: Quảng Châu 24.10",
  sh_f_cargo: "Công ty vận chuyển",
  sh_f_date: "Ngày gửi",
  sh_f_tariff: "Giá cho 1 kg, {c}",
  sh_f_weight: "Cân nặng lô hàng theo cân của hãng vận chuyển, kg",
  sh_f_weight_hint: "Nếu để trống, sẽ dùng tổng cân nặng các đơn",
  sh_f_total: "Số tiền trên hóa đơn vận chuyển, {c}",
  sh_f_total_hint: "Nếu nhập, sẽ không dùng đơn giá",
  sh_f_notes: "Ghi chú",
  sh_sum_empty: "Hãy thêm đơn hàng vào lô — phép tính sẽ hiện ở đây.",
  sh_sum_none: "Nhập giá mỗi kg hoặc số tiền trên hóa đơn vận chuyển — cước sẽ được chia cho các đơn.",
  sh_sum_weights: "Cân nặng các đơn: {a} kg. Cân nặng lô hàng: {b} kg.",
  sh_sum_total: "Chia cước: {x} (≈ {t} mỗi kg)",
  sh_w_noweight: "Đơn chưa có cân nặng: {n}. Chúng không được chia cước — hãy nhập cân nặng trong đơn.",
  sh_w_allnoweight: "Không đơn nào có cân nặng, không có gì để chia. Hãy nhập cân nặng trong các đơn.",
  sh_w_diff: "Cân nặng lô hàng khác tổng cân nặng các đơn {d} kg: phần chênh lệch được chia cho các đơn theo tỷ lệ.",
  sh_w_rate: "Chưa lưu tỷ giá cước {a}→{b}. Hãy lưu trong mục “Báo giá” (nút “Lưu tỷ giá”). Hiện các đơn bằng {b} giữ tỷ giá cũ.",
  sh_orders_title: "Đơn hàng trong lô",
  sh_no_weight: "chưa có cân nặng",
  sh_remove: "Bỏ khỏi lô hàng",
  sh_add: "Thêm đơn hàng",
  sh_add_search: "Tìm theo mã đơn, khách hàng hoặc sản phẩm",
  sh_add_none: "Không có đơn nào để thêm (chưa thuộc lô khác, chưa hủy, chưa giao).",
  sh_add_apply: "Thêm các đơn đã chọn ({n})",
  sh_status_title: "Trạng thái của cả lô hàng",
  sh_status_apply: "Áp dụng cho tất cả",
  sh_status_done: "Đã đổi trạng thái của đơn: {n}",
  sh_notify_title: "Báo cho khách hàng",
  sh_notify_btn: "Báo",
  sh_removed_note: "Số đơn đã bỏ khỏi lô hàng: {n}. Chúng giữ cước vận chuyển cũ: hãy chỉnh trong đơn.",
  sh_save: "Lưu và chia cước",
  sh_saved: "Đã lưu lô hàng, cước đã được chia cho các đơn",
  sh_saved_nocost: "Đã lưu lô hàng. Hãy nhập đơn giá hoặc số tiền trên hóa đơn — khi đó cước sẽ được chia.",
  sh_saved_noweight: "Đã lưu lô hàng. Các đơn chưa có cân nặng nên chưa chia cước.",
  sh_err_name: "Nhập tên lô hàng",
  sh_delete: "Xóa lô hàng",
  sh_delete_confirm: "Xóa lô hàng “{n}”? Các đơn vẫn còn nhưng rời khỏi lô (cước vận chuyển của chúng được giữ nguyên).",
  sh_tag: "Lô hàng",
  sh_tag_short: "Lô hàng",
  sh_order_note: "Đơn này nằm trong lô hàng “{n}”: lô hàng chia cước vận chuyển. Nếu sửa tay số tiền cước, nó sẽ bị ghi đè ở lần tính lại tiếp theo.",
  nav_report: "Báo cáo",
  r_hint: "Bạn kiếm được bao nhiêu: theo tháng, khách hàng và sản phẩm.",
  r_p_month: "Tháng này",
  r_p_3m: "3 tháng",
  r_p_12m: "12 tháng",
  r_p_all: "Tất cả",
  r_v_months: "Theo tháng",
  r_v_clients: "Theo khách hàng",
  r_v_products: "Theo sản phẩm",
  r_profit: "Lợi nhuận",
  r_revenue: "Doanh thu",
  r_cost: "Giá vốn",
  r_paid: "Khách đã trả",
  r_debt: "Còn nợ",
  r_orders: "Đơn hàng: {n}",
  r_qty: "Cái: {n}",
  r_rev_short: "Doanh thu {x}",
  r_markup: "Lãi gộp {n}%",
  r_share: "{n}% lợi nhuận",
  r_empty: "Chưa có đơn nào có giá cho khách. Hãy nhập giá cho khách trong đơn hàng và lợi nhuận sẽ hiện ở đây.",
  r_note: "Tính các đơn có giá cho khách, trừ đơn đã hủy. Tháng = ngày đặt hàng. Lợi nhuận = giá cho khách − giá vốn; lãi gộp = lợi nhuận / giá vốn. Tiền của các khoản còn nợ sẽ về khi khách trả.",
  r_unpriced: "Chưa có giá cho khách (không tính): {n}.",
  r_col_month: "Tháng",
  r_col_client: "Khách hàng",
  r_col_product: "Sản phẩm",
  r_col_orders: "Đơn hàng",
  r_col_qty: "Số lượng",
  r_col_revenue: "Doanh thu",
  r_col_cost: "Giá vốn",
  r_col_profit: "Lợi nhuận",
  r_col_markup: "Lãi gộp, %",
  r_col_paid: "Đã trả",
  r_col_debt: "Nợ",
  r_col_share: "Tỷ trọng lợi nhuận, %",
  r_col_cur: "Tiền tệ",
  nav_debts: "Công nợ",
  d_hint: "Ai nợ, bao nhiêu và từ bao lâu. Nhấn “Nhắc” — nội dung đã soạn sẵn.",
  d_total: "Khách nợ bạn",
  d_clients: "Khách hàng: {n}",
  d_filter_all: "Tất cả",
  d_filter_overdue: "Quá hạn",
  d_empty: "Không có công nợ — mọi khách đã trả đủ",
  d_empty_overdue: "Không có công nợ quá hạn",
  d_overdue: "Quá hạn: {n} ngày",
  d_days: "{n} ngày",
  d_orders: "Đơn hàng: {n}",
  d_at_client: "Hàng đã ở chỗ khách",
  d_reminded: "Đã nhắc: {when}",
  d_never: "Chưa nhắc",
  d_today: "hôm nay",
  d_ago: "{n} ngày trước",
  d_remind: "Nhắc thanh toán",
  d_remind_title: "Nhắc thanh toán",
  d_note: "Công nợ được tính cho các đơn đã đặt giá cho khách. Quá hạn: từ 7 ngày kể từ ngày đặt đơn hoặc lần thanh toán gần nhất. Dấu “Đã nhắc” được lưu trong trình duyệt này.",
  d_unpriced: "Không có trong danh sách (chưa có giá cho khách): {n}.",
  nav_quote: "Báo giá",
  q_title: "Báo giá cho khách",
  q_hint: "Khách hỏi “bao nhiêu tiền?” — 3 bước là có tin trả lời kèm giá.",
  q_name: "Tên sản phẩm (không bắt buộc)",
  q_link: "Link sản phẩm, ví dụ 1688 (không bắt buộc)",
  q_weight_total: "Tổng cân nặng, kg",
  q_weight_unit: "Cân nặng mỗi cái, kg",
  q_wm_total: "Cân nặng: tổng",
  q_wm_unit: "Cân nặng: mỗi cái",
  q_margin: "Lãi",
  q_round: "Làm tròn giá lên",
  q_round_0: "Không làm tròn",
  q_round_n: "Đến {n}",
  q_result: "Kết quả",
  q_need: "Nhập số lượng, giá và tỷ giá — báo giá sẽ hiện ở đây.",
  q_price_client: "Giá cho khách",
  q_unit: "Mỗi cái",
  q_rate_market: "Ô tỷ giá đang là tỷ giá thị trường (để tham khảo). Hãy nhập tỷ giá của bạn và nhấn “Lưu tỷ giá”.",
  q_warn_drate: "Hãy nhập giá cước vận chuyển, nếu không cước sẽ không được tính.",
  q_save_rate: "Lưu tỷ giá",
  q_msg_title: "Trả lời khách",
  q_msg_note: "Tin nhắn chỉ có giá cho khách: giá vốn và lợi nhuận được giữ kín.",
  q_order: "Tạo đơn hàng từ báo giá",
  q_clear: "Xóa",
  client_notify: "Báo cho khách",
  notify_title: "Tin nhắn cho khách",
  notify_after_status: "Trạng thái: {s}. Báo cho khách?",
  notify_lang: "Ngôn ngữ tin nhắn",
  notify_to: "Gửi đến: {p}",
  notify_to_none: "Chưa có số điện thoại của khách (cần kèm mã quốc gia, ví dụ +…). WhatsApp sẽ cho bạn chọn liên hệ.",
  notify_wa: "Gửi qua WhatsApp",
  notify_tg: "Gửi qua Telegram",
  notify_tg_user: "Mở trò chuyện với @{u}",
  notify_tg_copied: "Đã sao chép nội dung — hãy dán vào cuộc trò chuyện",
  notify_no_link: "Link của khách đang tắt nên không có trong tin nhắn. Hãy tạo link mới trong mục “Link cho khách”.",
  notify_no_price: "Chưa đặt giá cho khách nên tin nhắn không có số tiền.",
  notify_auto: "Gợi ý sau khi đổi trạng thái",
  notify_later: "Để sau",
  f_dates: "Ngày",
  more_actions: "Thêm thao tác",
  tg_title: "Thông báo Telegram",
  tg_step1: "Trong Telegram mở @BotFather → Start → gửi /newbot → chọn tên và username kết thúc bằng bot → sao chép token.",
  tg_step2: "Supabase → Edge Functions → Secrets → thêm TELEGRAM_BOT_TOKEN với giá trị là token.",
  tg_step3: "Mở bot mới của bạn trong Telegram và nhấn Start.",
  tg_step4: "Nhấn nút bên dưới — bot sẽ gửi “✅ Đã kết nối thông báo”.",
  tg_connect: "Kết nối Telegram",
  tg_on: "✅ Đã kết nối: {name}. Bot {bot} sẽ nhắn cho bạn về mỗi yêu cầu mới.",
  tg_off_bot: "Đã tìm thấy bot {bot} nhưng chưa kết nối. Nhấn Start trong bot, rồi nhấn nút bên dưới.",
  tg_no_token: "Bot chưa được thêm vào Supabase (bước 2).",
  tg_bad_token: "Token của bot không đúng. Kiểm tra secret TELEGRAM_BOT_TOKEN (bước 2).",
  tg_no_start: "Bot không thấy tin nhắn của bạn. Mở bot trong Telegram, nhấn Start và thử lại.",
  tg_connected: "Xong! Hãy kiểm tra Telegram.",
  tg_error: "Không kết nối được với bot. Hãy thử lại.",
  support: "Hỗ trợ",
  nav_support: "Hỗ trợ",
  support_title: "Hỗ trợ kỹ thuật",
  support_hint: "Có gì không hoạt động hoặc có câu hỏi? Hãy viết ở đây — quản trị viên sẽ trả lời ngay trong cửa sổ này.",
  support_placeholder: "Tin nhắn…",
  sp_attach: "Đính kèm ảnh hoặc tệp",
  sp_file: "Tệp",
  sp_photo: "Ảnh chụp màn hình",
  sp_too_many_files: "Tối đa 6 tệp mỗi lần",
  sp_bad_type: "Không gửi được loại tệp này. Cho phép: ảnh, video, PDF, Word, Excel, văn bản",
  sp_too_big: "Tệp lớn hơn 20 MB",
  sp_upload_failed: "Tải lên thất bại — chạm vào tin nhắn để thử lại",
  sp_typing: "đang nhập",
  sp_online: "đang trực tuyến",
  sp_team: "Hỗ trợ ULA Factory · trả lời ngay tại đây",
  sp_today: "Hôm nay",
  sp_yesterday: "Hôm qua",
  sp_retry: "Chưa gửi — chạm để thử lại",
  support_send: "Gửi",
  support_note: "Thông tin kỹ thuật được đính kèm tự động: mục của trang, trình duyệt và các lỗi gần đây. Mật khẩu và dữ liệu khách hàng không được gửi.",
  support_empty: "Xin chào! Hãy cho chúng tôi biết chuyện gì đã xảy ra — chúng tôi sẽ trả lời ngay trong cửa sổ này. Khi có trả lời mới, biểu tượng 💬 sẽ hiện số màu đỏ.",
  support_none: "Chưa có tin nhắn.",
  support_sent: "Đã gửi tin nhắn",
  support_new: "Tin nhắn hỗ trợ mới",
  support_reply_new: "Bộ phận hỗ trợ đã trả lời — mở 💬",
  fx_new_req: "Yêu cầu đổi tiền mới",
  push_on: "Bật thông báo",
  push_retry: "Thử lại",
  push_t_off: "Thông báo đang tắt",
  push_d_off: "Bật để nghe âm thanh và nhận thông báo về yêu cầu, tin nhắn, kể cả khi ứng dụng đóng.",
  push_t_fail: "Thông báo chưa kết nối",
  push_d_fail: "Đã cho phép nhưng điện thoại chưa đăng ký. Bấm lại; nếu không được, hãy liên hệ hỗ trợ.",
  push_t_denied: "Thông báo bị chặn",
  push_d_denied: "Bạn đã chặn thông báo. Hãy cho phép trong cài đặt: Cài đặt → ULA (hoặc trình duyệt) → Thông báo → Cho phép. Rồi mở lại ứng dụng.",
  push_t_ios: "Trên iPhone, thông báo chỉ hoạt động từ ứng dụng",
  push_d_ios: "Bấm “Chia sẻ” (ô vuông có mũi tên) → “Thêm vào MH chính”. Mở ULA từ màn hình chính và bật thông báo tại đây.",
  push_ok_toast: "Đã bật thông báo — sắp có thông báo thử",
  push_fail_toast: "Không thể kết nối thông báo",
  push_test_body: "Thông báo hoạt động ✅",
  kyc_new_ping: "Có yêu cầu xác minh mới — mở “Đổi tiền”",
  kyc_approve: "Duyệt — cấp quyền",
  kyc_ok_done: "Xong: người mua đã được xác minh, đã mở đổi tiền cho khách",
  kyc_no_done: "Đã từ chối — người mua sẽ thấy lý do",
  kyc_t_front: "Giấy tờ",
  kyc_t_back: "Mặt sau",
  kyc_t_selfie: "Ảnh selfie",
  support_too_many: "Quá nhiều tin nhắn. Vui lòng đợi một chút.",
  support_admin_title: "Yêu cầu của người mua",
  support_admin_hint: "Tin nhắn hỗ trợ của người mua. Tin mới ở trên cùng với số màu đỏ. Nhấn để mở cuộc trò chuyện và trả lời.",
  support_no_threads: "Chưa có yêu cầu nào.",
  support_tech: "Thông tin kỹ thuật",
  support_you: "Bạn",
  support_team: "Hỗ trợ",
  support_buyer: "Người mua",
  q_rates_title: "Tỷ giá của tôi",
  q_rates_hint: "Các tỷ giá bạn đã lưu. Chúng được điền vào báo giá và đơn hàng mới. Nhấn vào một tỷ giá để chọn cặp tiền đó.",
  fx_my_label: "Tỷ giá của tôi: 1 {a} = ? {b}",
  fx_my_save: "Lưu tỷ giá của tôi",
  fx_my_bad: "Nhập tỷ giá lớn hơn không",
  fx_my_deleted: "Đã xóa tỷ giá",
  fx_my_empty: "Chưa có tỷ giá. Hãy chọn tiền tệ ở trên, nhập tỷ giá và nhấn “Lưu tỷ giá của tôi”.",
  fx_by_my: "Theo tỷ giá của bạn",
  fx_by_market: "Theo tỷ giá thị trường (bạn chưa đặt tỷ giá)",
  fx_market: "Tỷ giá thị trường để tham khảo: {r}. Để trống ô này và nhấn Lưu để dùng nó.",
  warehouse_title: "Kho ở Trung Quốc",
  copy_address: "Sao chép địa chỉ",
  copied: "Đã sao chép",
  sum_orders: "Tổng số đơn",
  sum_total: "Khách phải trả",
  sum_paid: "Đã trả",
  sum_debt: "Khách còn nợ",
  sum_note: "Không tính đơn đã hủy. Mỗi loại tiền được cộng riêng.",
  as_title: "Việc cần làm hôm nay",
  as_admin_title: "Trợ lý quản trị",
  ai_title: "Trợ lý AI",
  ai_placeholder: "Hỏi bất cứ điều gì về người mua, đơn hàng, lợi nhuận — hoặc nhờ soạn tin nhắn cho nhà cung cấp",
  ai_send: "Hỏi",
  ai_thinking: "Đang suy nghĩ…",
  ai_note: "Câu hỏi được xử lý bởi Google Gemini. Tên, số điện thoại và địa chỉ khách hàng không được gửi.",
  ai_ex1: "Người mua nào kiếm được nhiều nhất tháng này?",
  ai_ex2: "Hiện có bao nhiêu đơn đang vận chuyển?",
  ai_ex3: "Viết cho nhà cung cấp bằng tiếng Trung: lô hàng hoãn 3 ngày",
  ai_ex4: "Người mua nào có nhiều công nợ khách hàng nhất?",
  ai_err_key: "AI chưa được kết nối: cần khóa Gemini trong Supabase.",
  ai_err_limit: "Quá nhiều câu hỏi liên tiếp. Hãy đợi một phút.",
  ai_err: "AI hiện không phản hồi. Hãy thử lại sau một phút.",
  as_all_good: "Mọi thứ ổn — không cần sửa gì",
  as_show: "Xem",
  as_open: "Mở",
  as_filter: "Đang hiển thị: {t}",
  h_no_price: "Đơn chưa có giá cho khách: {n}. Lợi nhuận của chúng chưa được tính.",
  h_no_address: "Khách chưa nhập địa chỉ giao hàng: {n}. Hãy gửi cho họ link đơn hàng.",
  h_loss: "Đơn {num} đang lỗ: {sum}. Hãy kiểm tra giá cho khách.",
  h_no_rate: "Đơn chưa có tỷ giá: {n}. Tổng số tiền bị sai.",
  h_stuck: "Đơn {num} không thay đổi suốt {days} ngày. Hãy cập nhật trạng thái cho khách.",
  h_debt: "Khách {name} nợ {sum} (đơn {num} đã đến nơi).",
  h_no_wh: "Chưa có địa chỉ kho ở Trung Quốc của bạn. Hãy thêm trong Cài đặt.",
  h_profit_month: "Lợi nhuận tháng này: {sum}.",
  ha_new: "Người mua mới trong 7 ngày qua: {n}.",
  ha_idle: "{name} đã đăng ký {days} ngày trước và chưa tạo đơn hàng nào.",
  ha_blocked: "Người mua bị khóa: {n}.",
  ha_total: "Tài khoản: {n}, số đơn của tất cả tài khoản: {o}.",
  filter_all: "Tất cả",
  filter_new: "Mới",
  filter_awaiting_payment: "Chờ thanh toán",
  filter_purchasing: "Đang mua",
  filter_china_warehouse: "Ở kho",
  filter_in_transit: "Đang vận chuyển",
  filter_arrived: "Đã đến",
  filter_delivered: "Đã giao",
  filter_cancelled: "Đã hủy",
  search_placeholder: "Tìm: mã đơn, khách hàng, điện thoại, thành phố, sản phẩm, nhà cung cấp",
  date_from: "Từ",
  date_to: "Đến",
  reset: "Đặt lại",
  new_order: "Đơn hàng mới",
  edit_order: "Sửa đơn hàng",
  open: "Mở",
  edit: "Sửa",
  remove: "Xóa",
  change_status: "Đổi trạng thái",
  client_link: "Link cho khách",
  save: "Lưu đơn hàng",
  saving: "Đang lưu…",
  cancel: "Hủy",
  close: "Đóng",
  a11y_back: "Quay lại",
  a11y_prev: "Ảnh trước",
  a11y_next: "Ảnh sau",
  copy: "Sao chép",
  add_photos: "Thêm ảnh",
  status_new: "Mới",
  status_awaiting_payment: "Chờ thanh toán",
  status_purchasing: "Đang mua hàng",
  status_china_warehouse: "Ở kho Trung Quốc",
  status_in_transit: "Đang vận chuyển",
  status_arrived: "Đã đến nơi",
  status_delivered: "Đã giao",
  status_cancelled: "Đã hủy",
  sec_main: "Chung",
  sec_client: "Khách hàng",
  sec_product: "Sản phẩm và nhà cung cấp",
  sec_money: "Giá và thanh toán",
  sec_photos: "Ảnh sản phẩm",
  sec_comments: "Ghi chú",
  f_order_number: "Mã đơn hàng",
  f_date: "Ngày",
  f_status: "Trạng thái",
  f_client: "Khách hàng",
  f_phone: "Điện thoại khách",
  f_wechat: "WeChat của khách",
  f_product_ru: "Sản phẩm (tiếng Nga)",
  f_product_zh: "Sản phẩm (tiếng Trung)",
  f_supplier: "Nhà cung cấp",
  f_link: "Link 1688 / Alibaba",
  f_supplier_wechat: "WeChat của nhà cung cấp",
  l_supplier_wechat: "WeChat của nhà cung cấp",
  f_purchase_currency: "Tiền tệ mua hàng (nhà cung cấp)",
  f_client_currency: "Tiền tệ của khách",
  f_price_cur: "Đơn giá, {c}",
  f_rate_cur: "Tỷ giá: 1 {a} = ? {b}",
  f_rate_same: "Tỷ giá (cùng tiền tệ)",
  f_delivery_cur: "Tiền vận chuyển, {c}",
  f_paid_cur: "Khách đã trả, {c}",
  f_markup: "Lãi, %",
  f_markup_hint: "Nhập phần trăm — giá cho khách sẽ được tính giúp bạn",
  f_client_price_cur: "Giá cho khách, {c}",
  f_client_price_hint: "Khách nhìn thấy số này. Giá vốn và lợi nhuận chỉ mình bạn thấy.",
  c_cost: "Giá vốn (hàng + vận chuyển)",
  c_client_price: "Giá cho khách",
  c_profit: "Lợi nhuận của bạn",
  l_cost: "Giá vốn",
  l_client_price: "Số tiền phải trả",
  l_profit: "Lợi nhuận",
  sum_profit: "Lợi nhuận",
  cl_due: "Số tiền phải trả",
  cl_left: "Còn phải trả",
  no_price: "Chưa có giá cho khách",
  k_goods: "Hàng hóa",
  k_delivery: "Vận chuyển (cargo)",
  k_payment: "Khách thanh toán",
  f_delivery_currency: "Tiền tệ vận chuyển",
  f_tariff_cur: "Giá cho 1 kg, {c}",
  f_delivery_rate_cur: "Tỷ giá vận chuyển: 1 {a} = ? {b}",
  f_delivery_hint: "Tự động tính: cân nặng × đơn giá. Bạn cũng có thể nhập tay.",
  s_def_delivery: "Tiền tệ vận chuyển mặc định",
  s_def_tariff: "Giá mặc định cho 1 kg",
  s_def_purchase: "Tiền tệ mua hàng mặc định",
  s_def_client: "Tiền tệ khách hàng mặc định",
  s_currency_hint: "Dùng cho mọi đơn hàng mới. Bạn có thể đổi trong từng đơn.",
  f_qty: "Số lượng",
  f_price: "Đơn giá, ¥",
  f_rate: "Tỷ giá ¥ → som",
  f_weight: "Cân nặng, kg",
  f_delivery: "Phí vận chuyển, som",
  f_paid: "Khách đã trả, som",
  f_delivery_info: "Thông tin giao hàng (khách thấy)",
  f_comment_client: "Ghi chú cho khách (khách thấy)",
  f_comment_admin: "Ghi chú nội bộ (chỉ bạn thấy)",
  c_title: "Tính toán",
  c_goods_cny: "Giá trị hàng",
  c_goods_som: "Hàng tính theo tiền của khách",
  c_delivery: "Vận chuyển",
  c_total: "Tổng cộng",
  c_paid: "Đã trả",
  c_balance: "Còn phải trả",
  l_qty: "Số lượng",
  l_price: "Giá",
  l_rate: "Tỷ giá",
  l_weight: "Cân nặng",
  l_goods_som: "Hàng tính theo tiền của khách",
  l_delivery: "Vận chuyển",
  l_total: "Tổng cộng",
  l_paid: "Đã trả",
  l_balance: "Còn phải trả",
  l_supplier: "Nhà cung cấp",
  l_phone: "Điện thoại",
  l_wechat: "WeChat",
  l_link: "Link",
  l_comment: "Ghi chú",
  l_comment_admin: "Ghi chú nội bộ",
  l_comment_client: "Ghi chú cho khách",
  l_delivery_info: "Thông tin giao hàng",
  l_photos: "Ảnh",
  l_name: "Họ và tên",
  l_telegram: "Telegram",
  l_city: "Thành phố",
  l_address: "Địa chỉ",
  l_pickup: "Điểm nhận hàng",
  l_orders: "Đơn hàng",
  l_added: "Ngày thêm",
  pcs: "cái",
  kg: "kg",
  som: "som",
  cb_title: "Thông tin giao hàng của khách",
  cb_empty: "Khách chưa điền thông tin. Hãy gửi cho họ link đơn hàng.",
  no_delivery_data: "Chưa có địa chỉ",
  clients_search: "Tìm theo tên hoặc số điện thoại",
  clients_count: "Khách hàng: {n}",
  export_csv: "Xuất ra Excel",
  export_done: "Đã tải file Excel",
  x_made: "Xuất ngày {d}",
  x_count: "Số dòng: {n}",
  x_total: "TỔNG",
  bulk_select: "Chọn",
  bulk_done_btn: "Xong",
  bulk_n: "Đã chọn: {n}",
  bulk_all: "Tất cả ({n})",
  bulk_none: "Bỏ chọn",
  bulk_status: "Trạng thái…",
  bulk_cancel: "Hủy",
  bulk_set_for: "Trạng thái mới cho các đơn: {n}",
  bulk_same: "Các đơn đã chọn đã ở trạng thái này",
  bulk_changed: "Đã đổi trạng thái của đơn: {n}",
  bulk_q_title: "Báo cho khách hàng",
  bulk_q_hint: "Đã đổi trạng thái. Nhấn “Báo” cho từng đơn — tin nhắn WhatsApp soạn sẵn sẽ mở ra.",
  bulk_q_next: "Báo người tiếp theo (còn: {n})",
  bulk_q_all: "Đã báo cho tất cả",
  bulk_q_again: "Lại",
  q_for: "Báo giá cho yêu cầu № {n} ({name})",
  q_for_cancel: "Gỡ ra",
  q_apply: "Áp dụng cho yêu cầu",
  rq_calc: "Tính giá",
  menu_main: "Chính",
  menu_money: "Tiền bạc",
  menu_more: "Công cụ",
  tk_late_by: "Ngày dự kiến đã qua {n} ngày.",
  tk_ask: "Hỏi người mua hàng",
  tk_src_dates: "Ngày đến do người mua hàng của bạn đặt. Đây không phải dữ liệu của hãng vận chuyển.",
  tk_src_days: "Số ngày kể từ khi gửi do người mua hàng đặt. Đây không phải dữ liệu của hãng vận chuyển.",
  tk_src_usual: "Đây là thời gian thông thường của đơn vị vận chuyển, không phải dữ liệu của hãng cho kiện hàng của bạn.",
  fin_approx: "Lợi nhuận là ước tính: theo giá, tỷ giá và phí vận chuyển đã nhập. Chưa tính hoàn tiền, phí và chênh lệch tỷ giá.",
  fin_approx_short: "≈ chưa tính hoàn tiền và phí",
  im_steps: "Các bước nhập",
  im_s_file: "Tệp",
  im_s_map: "Cột",
  im_s_check: "Kiểm tra",
  im_s_done: "Xong",
  im_next: "Kiểm tra các dòng",
  im_back_cols: "Quay lại cột",
  im_dups_file: "Lặp lại trong tệp: {n} — chỉ nhập một lần.",
  im_c_ready: "sẽ được nhập",
  im_c_warn: "có lưu ý",
  im_c_skip: "bỏ qua",
  im_c_total: "dòng trong tệp",
  im_c_issues: "Lưu ý theo từng dòng",
  im_c_all_ok: "Tất cả các dòng đều ổn.",
  im_c_row: "Dòng {n}",
  im_c_row_photo: "Mục {n}",
  im_c_will_load: "sẽ nhập",
  im_c_will_skip: "sẽ bỏ qua",
  im_c_more: "Còn {n} dòng có lưu ý — tất cả có trong báo cáo.",
  im_c_safe: "Không có gì thay đổi cho đến khi bạn bấm “Nhập”. Nếu có lỗi, đơn sẽ không bị nhập dở dang.",
  im_report: "Tải báo cáo kiểm tra (CSV)",
  im_rep_line: "Dòng",
  im_rep_result: "Kết quả",
  im_rep_notes: "Lưu ý",
  im_rep_ok: "sẽ được nhập",
  im_rep_ok_warn: "sẽ được nhập, hãy kiểm tra",
  im_rep_skip: "bỏ qua",
  im_r_no_client: "không có tên khách",
  im_r_dup_cabinet: "đơn này đã có trong hệ thống",
  im_r_dup_file: "lặp lại dòng {n}",
  im_r_date: "không nhận ra ngày — sẽ dùng ngày hôm nay",
  im_r_status: "không nhận ra trạng thái — sẽ dùng trạng thái mặc định",
  im_r_price: "số tiền không phải là số — để trống",
  im_r_paid: "thanh toán không phải là số — ghi 0",
  im_r_qty: "không nhận ra số lượng — 1 cái",
  im_r_phone: "số điện thoại không có mã quốc gia — lưu nguyên",
  im_r_overpaid: "đã trả nhiều hơn số tiền — hãy kiểm tra",
  im_r_formula: "văn bản giống công thức Excel — đã bỏ ký hiệu công thức",
  im_r_cost: "không có tỷ giá nhân dân tệ — giá vốn ghi là phí vận chuyển",
  im_r_unsure: "chữ viết khó đọc — hãy đối chiếu với ảnh",
  im_failed_none: "Chưa nhập gì: đã có lỗi khi lưu. Không có gì thay đổi — bạn có thể thử lại.",
  im_rolled_back: "Việc nhập bị dừng do lỗi. Các đơn đã nhập ({n}) đã được tự động xóa — không có gì thay đổi.",
  cc_open: "Hồ sơ",
  cc_title: "Hồ sơ khách hàng",
  cc_none: "Không tìm thấy khách. Hãy làm mới danh sách khách.",
  cc_call: "Gọi",
  cc_write: "Nhắn cho khách",
  cc_no_contact: "Không có số điện thoại kèm mã quốc gia hay Telegram — không thể nhắn từ đây.",
  cc_orders: "Đơn",
  cc_active: "Đang làm",
  cc_debt: "Còn nợ",
  cc_overdue: "Quá hạn",
  cc_paid_total: "Đã trả cho các đơn: {s}",
  cc_new_order: "Đơn mới",
  cc_repeat_last: "Đặt lại № {n}",
  cc_open_debt: "Mở công nợ",
  cc_wallet: "Số dư",
  cc_orders_list: "Đơn hàng",
  cc_left: "còn {s}",
  cc_more: "Còn {n} đơn nữa — xem trong “Đơn hàng”",
  cc_no_orders: "Chưa có đơn nào.",
  cc_payments: "Thanh toán",
  cc_no_payments: "Chưa có thanh toán trong lịch sử.",
  cc_history: "Thay đổi trạng thái",
  cc_no_history: "Chưa có lịch sử trạng thái.",
  tpl_title: "Bắt đầu nhanh:",
  tpl_1688: "Đơn từ 1688",
  tpl_taobao: "Đơn từ Taobao",
  tpl_repeat: "Đặt lại đơn",
  tpl_note_platform: "Mẫu “{name}”: mua bằng nhân dân tệ, tỷ giá hôm nay, sàn được ghi vào nhà cung cấp. Dán liên kết sản phẩm. Bạn có thể sửa mọi thứ.",
  tpl_note_repeat: "Lặp lại đơn № {n}. Đã sao chép khách, sản phẩm, nhà cung cấp, tiền tệ và cước; tỷ giá là của hôm nay. Giá cho khách, thanh toán, cân nặng, mã vận đơn, ảnh và ghi chú không được sao chép — hãy điền lại.",
  tpl_note_addr: "Địa chỉ giao hàng chưa được sao chép: chưa được xác nhận. Hãy hỏi lại khách.",
  gm_f_client: "SĐT khách",
  gm_f_photo: "ảnh sản phẩm",
  gm_f_track: "mã vận đơn",
  gm_ring: "Đã điền {p}%",
  gm_full: "Đơn đã điền đầy đủ",
  gm_fill_title: "Đã điền {p}%",
  gm_fill_n: "{a} / {b}",
  gm_sum: "Điền đầy đủ: {a} / {b}",
  gm_full_toast: "Đơn đã điền đầy đủ! 🎉",
  gm_alldone: "Hôm nay đã xong hết!",
  gm_alldone_toast: "Đã xong mọi việc hôm nay! 🎉",
  gm_alldone_streak: "Số ngày liên tiếp: {n}. Tiếp tục nhé!",
  gm_alldone_first: "Ngày đầu tiên của chuỗi. Mai là ngày thứ hai!",
  gm_best: "Kỷ lục: {n} ngày liên tiếp",
  gm_streak_ok: "Số ngày liên tiếp: {n}",
  gm_streak_keep: "Số ngày liên tiếp: {n} — hoàn thành việc hôm nay để giữ chuỗi",
  gm_week: "Tuần trước",
  gm_w_orders: "đơn mới",
  gm_w_done: "đã giao",
  gm_w_clients: "khách mới",
  gm_level: "Cấp độ của bạn",
  gm_points: "{n} điểm",
  gm_lv_novice: "Người mới",
  gm_lv_buyer: "Người mua hàng",
  gm_lv_skilled: "Có kinh nghiệm",
  gm_lv_pro: "Chuyên gia",
  gm_lv_master: "Bậc thầy ULA",
  gm_lv_next: "Còn {n} điểm đến “{l}”",
  gm_lv_max: "Cấp cao nhất — bạn là Bậc thầy ULA",
  gm_how: "Cách nhận điểm",
  gm_how_text: "Đơn đã giao — 10 điểm, đơn điền đầy đủ — 5, khách mới — 2, khách quay lại — thêm 10. Điểm tính từ đơn của không gian làm việc nên giống nhau trên mọi thiết bị.",
  gm_rw_frame: "Cấp “Người mua hàng”: khung ảnh đại diện",
  gm_rw_gold: "Cấp “Chuyên gia”: nút màu vàng",
  gm_lvup: "Lên cấp!",
  gm_lvup_ok: "Tuyệt!",
  gm_badges: "Huy hiệu",
  gm_badge_new: "Huy hiệu mới: “{b}”",
  pf_col_gold: "Vàng",
  gm_b_first: "Đơn đầu tiên",
  gm_b_first_how: "Thêm đơn đầu tiên",
  gm_b_deliv1: "Lần giao đầu",
  gm_b_deliv1_how: "Giao đơn đầu tiên",
  gm_b_deliv10: "10 lần giao",
  gm_b_deliv10_how: "Giao 10 đơn",
  gm_b_deliv50: "50 lần giao",
  gm_b_deliv50_how: "Giao 50 đơn",
  gm_b_repeat: "Khách quay lại",
  gm_b_repeat_how: "Một khách đặt đơn thứ hai",
  gm_b_clients10: "10 khách",
  gm_b_clients10_how: "Làm việc với 10 khách",
  gm_b_full10: "Cẩn thận",
  gm_b_full10_how: "Điền đầy đủ 10 đơn",
  gm_b_tracked: "Đều có mã",
  gm_b_tracked_how: "Mọi đơn đã gửi (từ 5) đều có mã vận đơn",
  gm_b_paid: "Không nợ",
  gm_b_paid_how: "5+ đơn đã giao, đều đã thanh toán",
  gm_b_alldone: "Xong hết",
  gm_b_alldone_how: "Hoàn thành mọi việc hôm nay",
  gm_b_streak7: "Tuần liên tiếp",
  gm_b_streak7_how: "Hoàn thành mọi việc 7 ngày liên tiếp",
  menu_goods: "Hàng hóa & vận chuyển",
  menu_admin: "Quản lý",
  nav_fmap: "Bản đồ nhà máy",
  nav_all: "Tất cả mục",
  r_back: "← Về phân tích",
  an_detail: "Chi tiết: theo tháng, khách hàng và sản phẩm",
  s_menu_sections: "Các mục trong menu",
  s_show_shipments: "Hiện mục “Lô hàng”",
  s_show_suppliers: "Hiện mục “Nhà cung cấp”",
  ob_title: "Bắt đầu với 4 bước",
  ob_progress: "{a} trên {b}",
  ob_wh: "Thêm địa chỉ kho của bạn ở Trung Quốc",
  ob_rates: "Đặt tỷ giá của riêng bạn",
  ob_link: "Tạo link để khách gửi yêu cầu",
  ob_order: "Thêm đơn hàng đầu tiên",
  ob_hide: "Ẩn gợi ý này",
  tgw_title: "Telegram: yêu cầu của khách",
  tgw_hint: "Kết nối Telegram và các yêu cầu mới của khách sẽ đến cuộc trò chuyện của bạn từ bot — không cần mở trang web để kiểm tra.",
  tgw_off: "Chưa kết nối Telegram.",
  tgw_on: "Đã kết nối: {n}. Yêu cầu mới sẽ đến cuộc trò chuyện này.",
  tgw_unavailable: "Hiện chưa dùng được. Hãy thử lại sau.",
  tgw_start: "Kết nối Telegram",
  tgw_open: "1. Mở Telegram và nhấn Start",
  tgw_check: "2. Tôi đã nhấn Start — kiểm tra",
  tgw_disable: "Ngắt kết nối Telegram",
  tgw_done: "Đã kết nối Telegram",
  tgw_no_bot: "Không kết nối được với bot. Hãy liên hệ hỗ trợ.",
  tgw_no_start: "Chưa thấy bạn nhấn Start. Mở link, nhấn Start trong Telegram rồi kiểm tra lại.",
  tgw_expired: "Hết thời gian kết nối. Hãy bắt đầu lại.",
  tgw_confirm_off: "Ngắt thông báo Telegram về các yêu cầu?",
  tgw_off_done: "Đã ngắt kết nối Telegram",
  pay_owe: "Nợ {s}",
  pay_full: "Đã trả đủ",
  cl_page_hint: "Tất cả khách hàng của bạn: liên hệ, địa chỉ giao hàng và đơn hàng của họ.",
  sup_page_hint: "Nhà máy và người bán ở Trung Quốc mà bạn mua hàng.",
  s_current_password: "Mật khẩu hiện tại",
  s_current_hint: "Chỉ cần khi bạn đổi mật khẩu.",
  e_current_password: "Để đổi mật khẩu, hãy nhập mật khẩu hiện tại.",
  e_current_wrong: "Mật khẩu hiện tại không đúng.",
  password_repeat: "Nhập lại mật khẩu",
  e_password_match: "Mật khẩu không khớp. Hãy nhập giống nhau ở cả hai ô.",
  mfa_title: "Đăng nhập bằng mã (2FA)",
  mfa_hint: "Bảo vệ thêm: sau mật khẩu, trang web sẽ hỏi mã 6 chữ số từ ứng dụng trên điện thoại. Dù mật khẩu bị lộ, không ai đăng nhập được nếu không có điện thoại của bạn.",
  mfa_off: "Đăng nhập bằng mã đang tắt.",
  mfa_on: "Đăng nhập bằng mã đang bật.",
  mfa_start: "Bật đăng nhập bằng mã",
  mfa_disable: "Tắt đăng nhập bằng mã",
  mfa_step1: "Cài Google Authenticator (hoặc Authy, 1Password) trên điện thoại.",
  mfa_step2: "Trong ứng dụng nhấn “Thêm” và quét mã QR này. Nếu không được, hãy nhập khóa bằng tay.",
  mfa_secret: "Khóa:",
  mfa_step3: "Mã 6 chữ số từ ứng dụng",
  mfa_confirm: "Xác nhận và bật",
  mfa_cancel: "Hủy",
  mfa_err_code: "Nhập 6 chữ số từ ứng dụng.",
  mfa_err_wrong: "Mã không đúng. Kiểm tra giờ trên điện thoại và thử lại.",
  mfa_done: "Đã bật đăng nhập bằng mã",
  mfa_off_done: "Đã tắt đăng nhập bằng mã",
  mfa_confirm_off: "Tắt đăng nhập bằng mã? Tài khoản sẽ kém an toàn hơn.",
  mfa_confirm_off_admin: "Tắt đăng nhập bằng mã của quản trị viên? Tài khoản xem được tất cả người mua sẽ kém an toàn hơn.",
  mfa_login_title: "Nhập mã",
  mfa_login_hint: "Mở ứng dụng xác thực trên điện thoại và nhập mã 6 chữ số của trang này.",
  mfa_login_btn: "Đăng nhập",
  mfa_banner: "Hãy bật đăng nhập bằng mã: tài khoản này xem được tất cả người mua, hãy bảo vệ nó trước tiên.",
  mfa_banner_btn: "Bật",
  mfa_off_code: "Để tắt, hãy nhập mã 6 chữ số hiện tại từ ứng dụng",
  captcha_err: "Kiểm tra “Tôi không phải người máy” không thành công. Hãy tải lại trang và thử lại.",
  tour_btn: "Hướng dẫn",
  tour_step: "Bước {a} trên {b}",
  tour_start: "Chỉ cho tôi",
  tour_next: "Tiếp",
  tour_back: "Quay lại",
  tour_skip: "Bỏ qua",
  tour_finish: "Bắt đầu làm việc",
  tour_welcome_t: "Chào mừng đến với ULA Factory!",
  tour_welcome: "Trong một phút tôi sẽ chỉ cho bạn cách hoạt động. Bạn có thể bỏ qua và quay lại sau: menu → “Hướng dẫn”.",
  tour_menu_t: "Các mục",
  tour_menu: "Tất cả các mục ở đây: Đơn hàng, Khách hàng, Công nợ, Phân tích, Báo giá. Nhấn để chuyển qua lại.",
  tour_wh_t: "Kho ở Trung Quốc",
  tour_wh: "Đây là địa chỉ kho của bạn. Nhấn “Sao chép địa chỉ” và gửi cho nhà cung cấp. Nhập địa chỉ của bạn qua “Sửa”.",
  tour_link_t: "Link yêu cầu",
  tour_link: "Tạo link và gửi cho khách qua ứng dụng nhắn tin. Khách để lại link sản phẩm và số lượng, và một đơn hàng mới xuất hiện cho bạn.",
  tour_new_t: "Đơn hàng mới",
  tour_new: "Đây là cách thêm đơn bằng tay: khách hàng, sản phẩm, giá, cân nặng. Trạng thái, công nợ và lợi nhuận được tính tự động.",
  tour_chips_t: "Trạng thái đơn hàng",
  tour_chips: "Đơn hàng theo giai đoạn: Mới, Chờ thanh toán, Đang vận chuyển… Nhấn vào một trạng thái để chỉ xem các đơn đó.",
  tour_card_t: "Thẻ đơn hàng",
  tour_card: "Bạn thấy số tiền, phần đã trả và công nợ. “Báo cho khách” soạn sẵn tin nhắn WhatsApp. Nút “⋯” mở link cho khách, sửa và đổi trạng thái.",
  tour_bulk_t: "Chọn nhiều đơn",
  tour_bulk: "Đánh dấu nhiều đơn và đổi trạng thái cho tất cả cùng lúc. Sau đó trang sẽ cho biết cần nhắn cho những khách nào.",
  tour_menu2_t: "Tiền bạc và công cụ",
  tour_menu2: "Công nợ: ai nợ bao nhiêu và tin nhắn nhắc sẵn. Phân tích: lợi nhuận và biểu đồ. Báo giá: trả lời nhanh khách hỏi “bao nhiêu tiền”.",
  tour_fx_t: "Đổi tiền tệ",
  tour_fx: "Cần trả tiền nhà cung cấp bằng nhân dân tệ? Đổi som sang tệ với người đã xác minh. Trang giữ tiền đến khi bạn xác nhận đã nhận, có tranh chấp thì hỗ trợ sẽ giúp.",
  tour_settings_t: "Cài đặt",
  tour_settings: "Tỷ giá và tiền tệ, kho, Telegram cho yêu cầu, đăng nhập bằng mã (2FA) và trợ lý trong nhóm đều ở đây.",
  tour_support_t: "Cần giúp đỡ?",
  tour_support: "Có gì không hoạt động hoặc chưa rõ? Nhấn vào đây và viết, chúng tôi trả lời ngay trong cửa sổ.",
  tour_done_t: "Xong!",
  tour_done: "Hãy bắt đầu với thẻ “Bắt đầu với 4 bước” ở trang đơn hàng: kho, tỷ giá, link yêu cầu và đơn hàng đầu tiên. Bạn có thể xem lại hướng dẫn bất cứ lúc nào: menu → “Hướng dẫn”.",
  refresh_menu: "Làm mới dữ liệu",
  forgot_link: "Quên mật khẩu?",
  reset_title: "Khôi phục mật khẩu",
  reset_hint: "Nhập email bạn đã đăng ký. Chúng tôi sẽ gửi thư kèm link để đặt mật khẩu mới.",
  reset_send: "Gửi thư",
  reset_sent: "Nếu {e} đã đăng ký, chúng tôi đã gửi thư kèm link. Hãy kiểm tra hộp thư đến và thư mục Spam.",
  reset_wait: "Thư vừa được gửi. Hãy đợi một phút rồi thử lại.",
  newpass_title: "Mật khẩu mới",
  newpass_hint: "Chọn mật khẩu mới và nhập hai lần. Ít nhất 8 ký tự.",
  newpass_save: "Lưu và đăng nhập",
  auth_tag: "Tài khoản người mua: đơn hàng từ Trung Quốc trong tầm kiểm soát",
  auth_b1: "Đơn hàng, thanh toán và giao hàng ở một nơi",
  auth_b2: "Khách theo dõi đơn hàng qua một link",
  auth_b3: "Lợi nhuận và công nợ nhìn là thấy",
  auth_err_google: "Đăng nhập Google không thành công: dịch vụ đăng nhập đã từ chối phản hồi của Google. Hãy đăng nhập bằng email và mật khẩu, chúng tôi đang sửa lỗi.",
  auth_err_expired: "Link trong thư đã hết hạn hoặc đã được dùng. Nhấn “Quên mật khẩu?” và yêu cầu link mới.",
  auth_err_generic: "Không đăng nhập được. Vui lòng thử lại",
  nav_shop: "Gian hàng",
  sh2_page_hint: "Cửa hàng nhỏ của bạn: thêm sản phẩm kèm ảnh và giá rồi gửi cho khách một link.",
  sh2_add: "Sản phẩm",
  sh2_edit: "Sửa sản phẩm",
  sh2_link_title: "Link gian hàng",
  sh2_link_off: "Chưa có link. Hãy tạo và gửi cho khách qua WhatsApp, Instagram, Telegram.",
  sh2_link_make: "Tạo link gian hàng",
  sh2_wa_text: "Xin chào! Hàng của mình từ Trung Quốc — hãy chọn và để lại yêu cầu:",
  sh2_none: "Chưa có sản phẩm. Nhấn “+ Sản phẩm” và thêm ảnh, tên và giá.",
  sh2_hidden: "Đang ẩn",
  sh2_saved: "Đã lưu sản phẩm",
  sh2_err_db: "Mục này chưa được kết nối. Hãy liên hệ hỗ trợ.",
  sh2_photo_pick: "Chọn ảnh",
  sh2_photo_del: "Xóa ảnh",
  sh2_f_title: "Tên sản phẩm",
  sh2_f_price: "Giá cho khách mỗi cái (không bắt buộc)",
  sh2_f_desc: "Mô tả: size, màu, thời gian chờ (không bắt buộc)",
  sh2_f_active: "Hiện trong gian hàng",
  sh2_e_title: "Nhập tên sản phẩm",
  sh2_e_price: "Kiểm tra lại giá",
  sh2_e_photo: "Chọn ảnh (JPG hoặc PNG)",
  sh2_confirm_del: "Xóa “{n}” khỏi gian hàng?",
  sh2_title: "Gian hàng",
  sh2_hint: "Chọn sản phẩm và để lại yêu cầu — người bán sẽ liên hệ với bạn.",
  sh2_empty: "Chưa có sản phẩm. Hãy quay lại sau.",
  sh2_price_ask: "Hỏi giá",
  sh2_all: "Tất cả sản phẩm",
  sh2_order: "Đặt hàng",
  sh2_sent_text: "{n} đã nhận đơn của bạn và sẽ sớm liên hệ.",
  sh2_back: "Về gian hàng",
  sh2_gone: "Sản phẩm này không còn nữa. Hãy quay lại và chọn sản phẩm khác.",
  sh2_nf_title: "Không tìm thấy gian hàng",
  sh2_nf_text: "Link đã bị tắt hoặc hết hạn. Hãy hỏi người bán link mới.",
  rq_e_tg: "Kiểm tra username Telegram: 5–32 chữ cái Latin, chữ số hoặc _",
  bc_btn: "Gửi hàng loạt",
  bc_title: "Nhắn tin cho khách hàng",
  bc_hint: "Chọn người nhận và nội dung. Nút của mỗi khách mở WhatsApp với tin nhắn soạn sẵn — bạn chỉ cần nhấn “Gửi”.",
  bc_who: "Gửi cho ai",
  bc_what: "Nội dung",
  bc_seg_buyers: "Đã mua hàng",
  bc_seg_debtors: "Đang nợ",
  bc_seg_sleeping: "Lâu không mua",
  bc_seg_all: "Tất cả",
  bc_tpl_promo: "Khuyến mãi",
  bc_tpl_arrivals: "Hàng mới về",
  bc_tpl_debt: "Nhắc thanh toán",
  bc_tpl_custom: "Nội dung riêng",
  bc_text: "Tin nhắn",
  bc_text_hint: "{имя} sẽ thành tên khách, {долг} là số tiền họ còn nợ.",
  bc_count: "Khách hàng: {n}, còn phải nhắn: {left}",
  bc_next: "Nhắn người tiếp theo qua WhatsApp (còn {n})",
  bc_none: "Không có khách phù hợp. Hãy chọn nhóm khác.",
  bc_owes: "nợ {s}",
  bc_e_text: "Nhập nội dung tin nhắn",
  nav_expenses: "Chi phí",
  nav_volume: "Cân nặng quy đổi",
  trk_title: "Mã vận đơn",
  trk_short: "Mã vận đơn",
  trk_where: "Hàng của tôi đang ở đâu?",
  trk_hint: "Nhấn “Hàng của tôi đang ở đâu?” để xem hàng hiện ở đâu.",
  f_tracking: "Mã vận đơn",
  f_tracking_hint: "Khách sẽ thấy mã này trên trang đơn hàng và trong tin nhắn “đang trên đường”.",
  copied_track: "Đã sao chép mã vận đơn",
  vol_title: "Cân nặng quy đổi",
  vol_hint: "Nhập kích thước thùng — trang sẽ tính thể tích, cân nặng quy đổi và tỷ trọng. Hãng vận chuyển tính theo giá trị lớn hơn: cân thực tế hoặc cân quy đổi.",
  vol_box: "Kích thước một thùng, cm",
  vol_l: "Dài",
  vol_w: "Rộng",
  vol_h: "Cao",
  vol_n: "Số thùng",
  vol_kg: "Cân nặng, kg",
  vol_kg_ph: "không bắt buộc",
  vol_kg_mode: "Cân nặng là",
  vol_kg_total: "tổng",
  vol_kg_box: "mỗi thùng",
  vol_how: "Hãng vận chuyển tính thế nào",
  vol_div_6000: "Hàng không ÷6000",
  vol_div_5000: "Chuyển phát nhanh ÷5000",
  vol_div_cargo: "Cargo (tỷ trọng)",
  vol_r_m3: "Thể tích",
  vol_r_vol: "Cân nặng quy đổi",
  vol_r_weight: "Cân nặng thực tế",
  vol_r_density: "Tỷ trọng",
  vol_r_pay: "Cân nặng tính phí",
  vol_kgm3: "kg/m³",
  vol_by_volume: "tính theo thể tích — thùng nhẹ nhưng cồng kềnh",
  vol_by_weight: "tính theo cân nặng thực tế",
  vol_light: "Tỷ trọng dưới 200 kg/m³ — hàng nhẹ. Các công ty cargo thường tính theo mét khối chứ không theo kg.",
  vol_heavy: "Tỷ trọng từ 200 kg/m³ trở lên — các công ty cargo thường tính theo kg.",
  vol_empty: "Nhập chiều dài, chiều rộng và chiều cao.",
  vol_apply: "Đưa cân nặng vào đơn hàng: {n} kg",
  vol_applied: "Đã thêm cân nặng",
  vol_by_size: "Tính theo kích thước",
  q_more_extra: "+ Chi phí tại Trung Quốc (về kho, hoa hồng, đóng gói)",
  q_extra_cur: "Chi phí tại Trung Quốc, tổng, {c}",
  q_extra_hint: "Mọi khoản bạn trả ở Trung Quốc ngoài giá hàng: vận chuyển từ nhà cung cấp về kho, hoa hồng trung gian, đóng gói, phí ngân hàng. Được tính vào giá vốn và giá cho khách, không hiện thành dòng riêng cho khách.",
  q_dm_kg: "Cước tính theo cân nặng (kg)",
  q_dm_m3: "Cước tính theo khối (m³)",
  q_lbl_volume: "Tổng thể tích, m³",
  f_tariff_m3_cur: "Cước cho 1 m³, {c}",
  c_extra: "Chi phí tại Trung Quốc",
  c_cost_unit: "Giá vốn mỗi cái",
  c_profit_unit: "Lợi nhuận mỗi cái",
  vol_per: "Số cái mỗi thùng",
  vol_kg_unit: "mỗi cái",
  vol_boxes: "Tổng số thùng",
  vol_need_qty: "Nhập tổng số lượng để số thùng tự được tính.",
  vol_apply_m3: "Đưa thể tích vào: {n} m³",
  vol_applied_m3: "Đã đưa thể tích vào",
  pr_print: "In / Lưu thành PDF",
  pr_how: "Một tab mới sẽ mở ra. Để có file PDF, hãy chọn “Lưu thành PDF” trong cửa sổ in.",
  inv_none: "Chỉ những đơn chưa bị hủy mới đưa vào hóa đơn được",
  inv_btn: "Hóa đơn PDF",
  inv_btn_short: "Hóa đơn",
  inv_title: "Hóa đơn",
  inv_title_modal: "Hóa đơn cho khách (PDF)",
  inv_sum: "Đơn hàng: {n}. Khách hàng: {c} — mỗi khách có một trang riêng.",
  inv_no_price: "{n} đơn chưa có giá — sẽ hiện dấu gạch ngang.",
  inv_pay_label: "Cách thanh toán (không bắt buộc)",
  inv_pay_ph: "Ví dụ: ngân hàng, số thẻ hoặc tài khoản, tên người nhận",
  inv_pay_hint: "Trang sẽ nhớ nội dung này cho các hóa đơn sau.",
  inv_make: "Tạo hóa đơn",
  inv_to: "Khách hàng",
  inv_c_order: "Đơn hàng",
  inv_c_product: "Sản phẩm",
  inv_c_qty: "SL",
  inv_c_sum: "Thành tiền",
  inv_c_left: "Còn lại",
  inv_total: "Tổng cộng",
  inv_due: "Cần thanh toán",
  inv_pay: "Cách thanh toán",
  inv_thanks: "Cảm ơn bạn đã đặt hàng!",
  lb_btn: "Nhãn QR",
  lb_btn_short: "Nhãn",
  lb_title: "Nhãn có mã QR",
  lb_hint: "Nhãn có mã đơn, khách hàng, điện thoại, thành phố, sản phẩm và cân nặng. Mã QR chứa cùng thông tin — kho quét bằng camera điện thoại.",
  lb_size: "Kích thước",
  lb_size_58x40: "58×40 mm (giấy nhiệt)",
  lb_size_100x70: "100×70 mm",
  lb_size_a4: "Tờ A4 (8 nhãn)",
  lb_places: "Số kiện (thùng) mỗi đơn",
  lb_places_hint: "Nếu có 3 thùng, bạn sẽ có 3 nhãn: “Kiện 1/3”, “2/3”, “3/3”.",
  lb_sum: "Đơn hàng: {o}, nhãn: {n}",
  lb_make: "In nhãn",
  lb_place: "Kiện {a}/{b}",
  ex_hint: "Tiền thuê, lương, quảng cáo và các chi phí khác. Chỉ mình bạn thấy. Lợi nhuận ròng = lợi nhuận từ đơn hàng − chi phí.",
  ex_add: "Thêm chi phí",
  ex_edit: "Sửa chi phí",
  ex_orders_profit: "Lợi nhuận từ đơn hàng",
  ex_spent: "Chi phí",
  ex_net: "Lợi nhuận ròng",
  ex_net_hint: "Lợi nhuận được tính từ {n} đơn đã có giá (trừ đơn đã hủy) trong kỳ này.",
  ex_by_cat: "Tiền đi đâu",
  ex_list: "Tất cả chi phí ({n})",
  ex_empty: "Kỳ này chưa có chi phí. Nhấn “Thêm chi phí” — ví dụ tiền thuê kho hoặc quảng cáo.",
  ex_cat_rent: "Tiền thuê",
  ex_cat_salary: "Lương",
  ex_cat_ads: "Quảng cáo",
  ex_cat_transport: "Đi lại và taxi",
  ex_cat_packing: "Đóng gói và kho",
  ex_cat_phone: "Điện thoại và internet",
  ex_cat_fees: "Phí và chuyển tiền",
  ex_cat_other: "Khác",
  ex_f_cat: "Chi cho việc gì",
  ex_f_amount: "Số tiền",
  ex_f_cur: "Tiền tệ",
  ex_f_date: "Ngày",
  ex_f_note: "Ghi chú",
  ex_f_note_ph: "Ví dụ: tiền thuê kho tháng Mười",
  ex_e_amount: "Nhập số tiền lớn hơn không",
  ex_confirm_del: "Xóa khoản chi phí này?",
  ex_saved: "Đã lưu chi phí",
  ex_deleted: "Đã xóa chi phí",
  an_net: "Chi phí {s} → lợi nhuận ròng",
  an_net_add: "Thêm chi phí để xem lợi nhuận ròng",
  filter_active: "Đang xử lý",
  done_hidden: "Đã giao và thanh toán đủ: {n} — được ẩn khỏi màn hình chính",
  done_all_title: "Tất cả đơn hàng đã giao",
  done_all_text: "Không có đơn mới hay đơn đang xử lý. Đơn đã giao và thanh toán đủ nằm trong mục “Đã giao”.",
  progress_step: "Bước {a}/{b}",
  im_menu: "Nhập từ Excel",
  im_btn: "Từ Excel",
  im_title: "Nhập đơn hàng cũ",
  im_empty_btn: "Nhập đơn hàng cũ từ Excel",
  ob_import: "Chuyển đơn hàng cũ từ Excel sang — chỉ mất vài phút",
  im_hint: "Chuyển đơn hàng cũ chỉ trong vài phút — từ bảng Excel hoặc ảnh chụp sổ tay.",
  im_drop: "Kéo thả file vào đây",
  im_pick: "Chọn file",
  im_formats: "Excel (.xlsx) hoặc CSV",
  im_tip1: "Bảng nào của bạn cũng dùng được: dòng đầu là tiêu đề (Ngày, Khách hàng, Điện thoại, Sản phẩm, Số tiền, Đã trả, Trạng thái…). Thứ tự cột không quan trọng.",
  im_tip2: "Google Sheets: Tệp → Tải xuống → Microsoft Excel (.xlsx). File .xls cũ: trong Excel chọn “Lưu thành” → .xlsx.",
  im_template: "Tải bảng mẫu",
  im_e_xls: "Đây là định dạng .xls cũ. Hãy mở bằng Excel và lưu thành .xlsx (Tệp → Lưu thành → Excel Workbook).",
  im_e_big: "File lớn hơn 15 MB. Hãy chia thành nhiều phần.",
  im_e_empty: "Không tìm thấy dòng đơn hàng nào trong file.",
  im_e_read: "Không đọc được file. Hãy chắc chắn đó là Excel (.xlsx) hoặc CSV rồi thử lại.",
  im_file: "File “{f}” — số dòng: {n}",
  im_cols: "Ý nghĩa của từng cột",
  im_cols_hint: "Trang đã tự đoán. Hãy kiểm tra và sửa nếu cần. “Khách hàng” là bắt buộc, còn lại tùy chọn.",
  im_more: "Thêm trường ({n})",
  im_more_rows: "…và {n} nữa",
  im_sum: "Số tiền",
  im_none: "— không —",
  im_col: "Cột {n}",
  im_f_date: "Ngày",
  im_f_client: "Khách hàng",
  im_f_phone: "Điện thoại",
  im_f_product: "Sản phẩm",
  im_f_qty: "SL",
  im_f_price: "Số tiền cho khách",
  im_f_paid: "Đã trả",
  im_f_cost: "Giá vốn",
  im_f_weight: "Cân nặng, kg",
  im_f_status: "Trạng thái",
  im_f_tracking: "Mã vận đơn",
  im_f_number: "Mã đơn hàng",
  im_f_supplier: "Nhà cung cấp",
  im_f_currency: "Tiền tệ",
  im_f_comment: "Ghi chú",
  im_cur: "Tiền tệ của số tiền",
  im_status_def: "Trạng thái nếu dòng không có",
  im_status_hint: "Đơn hàng cũ thường đã giao — “Đã giao”. Đơn đã giao và thanh toán đủ sẽ không làm rối màn hình chính.",
  im_preview: "Đơn hàng sẽ hiện như thế này",
  im_skip: "Số dòng bỏ qua: {n} — chúng không có tên khách hàng.",
  im_dups: "Đã có trong tài khoản: {n} — sẽ không thêm hai lần.",
  im_cut: "Mỗi lần nhập tối đa {n} đơn — hãy nhập phần còn lại bằng file thứ hai.",
  im_need_client: "Hãy chọn cột chứa tên khách hàng.",
  im_back: "File khác",
  im_go: "Nhập đơn hàng ({n})",
  im_go_none: "Không có gì để nhập",
  im_progress: "Đang nhập… {a}/{b}",
  im_done: "Xong! Đã nhập {n} đơn hàng. Chúng đã có trong tài khoản của bạn.",
  im_partial: "Đã nhập {n}/{b}: phần còn lại bị lỗi nên chưa nhập được. Bạn có thể hoàn tác và thử lại.",
  im_finish: "Tuyệt",
  im_undo: "Hoàn tác việc nhập",
  im_undo_confirm: "Xóa {n} đơn hàng vừa nhập?",
  im_undone: "Đã hoàn tác việc nhập",
  im_no_product: "Sản phẩm chưa có tên",
  im_note_ref: "Mã trong Excel: {n}",
  im_note_cost: "Giá vốn từ Excel được lưu như phí vận chuyển (chưa có tỷ giá nhân dân tệ)",
  im_tpl_sheet: "Đơn hàng",
  im_tpl_title: "Mẫu để nhập đơn hàng",
  im_tpl_sub: "Điền các đơn hàng của bạn vào các dòng. Cột thừa có thể xóa, thứ tự tùy ý.",
  im_tpl_note: "Ghi chú mẫu",
  im_photo_title: "Đơn hàng ghi trong sổ tay?",
  im_photo_text: "Chụp ảnh các trang — AI sẽ chép các đơn hàng vào bảng và bạn kiểm tra lại. Tối đa 5 ảnh mỗi lần.",
  im_photo_btn: "Ảnh sổ tay",
  im_photo_privacy: "Ảnh chỉ được gửi cho Google Gemini để nhận dạng và không được lưu lại. Tối đa 30 ảnh mỗi ngày.",
  im_reading: "Đang đọc chữ viết tay…",
  im_reading_hint: "Thường mất 10–40 giây. Đừng đóng cửa sổ.",
  im_photo_max: "Tối đa {n} ảnh mỗi lần. Phần còn lại hãy gửi lần sau.",
  im_photo_file: "Ảnh sổ tay: {n}",
  im_photo_found: "Số dòng chép từ ảnh: {n}",
  im_photo_left: "số ảnh còn lại hôm nay: {n}",
  im_photo_check: "Hãy kiểm tra từng dòng: AI có thể đọc nhầm chữ viết tay. Dòng màu vàng là nơi AI chưa chắc chắn. Xóa dòng thừa bằng ×.",
  im_unsure: "hãy kiểm tra — chữ khó đọc",
  im_st_default: "Trạng thái mặc định",
  im_e_quota: "Hôm nay đã hết lượt ảnh (30 ảnh mỗi ngày). Hãy thử lại vào ngày mai.",
  im_e_busy: "AI hiện đang bận. Hãy đợi một phút rồi thử lại.",
  im_e_photo_empty: "Không tìm thấy đơn hàng nào trong ảnh. Hãy chụp gần hơn và đủ sáng.",
  im_e_photo: "Không đọc được ảnh. Hãy kiểm tra internet và thử lại.",
  sm_show_all: "Hiện tất cả các mục",
  sm_simple: "Chế độ đơn giản",
  sm_on: "Chế độ đơn giản: chỉ có Đơn hàng, Khách hàng và Công nợ",
  sm_off: "Đã hiện tất cả các mục",
  sm_setting: "Chế độ đơn giản — menu chỉ có Đơn hàng, Khách hàng và Công nợ",
  video_btn: "Video: cách sử dụng (2 phút)",
  tgc_title: "Thông báo Telegram",
  tgc_text: "Nhận tin nhắn khi đơn hàng được gửi đi, khi hàng đến và sẵn sàng để nhận. Không cần gọi điện hay kiểm tra.",
  tgc_btn: "Kết nối trong Telegram",
  tgc_check: "Kiểm tra kết nối",
  tgc_checking: "Đang kiểm tra…",
  tgc_hint: "Trong Telegram nhấn “Start” rồi quay lại đây — kết nối sẽ được kiểm tra tự động.",
  tgc_on: "Đã kết nối — cập nhật đơn hàng sẽ gửi đến Telegram của bạn",
  tgc_off: "Tắt thông báo",
  tgc_off_confirm: "Tắt thông báo Telegram cho đơn hàng này?",
  tgc_done: "Xong! Đã bật thông báo",
  tgc_off_done: "Đã tắt thông báo",
  tgc_e_start: "Tôi chưa thấy “Start”. Hãy mở bot, nhấn “Start” và thử lại.",
  tgc_e: "Có lỗi xảy ra. Hãy thử lại sau một phút.",
  tgc_sent: "Đã gửi đến Telegram của khách: {n}",
  tgc_tag_title: "Khách đã đăng ký trong Telegram: họ tự nhận trạng thái mới",
  pwa_btn: "Cài đặt lên điện thoại",
  pwa_title: "Cài đặt lên điện thoại",
  pwa_sub: "Biểu tượng trên màn hình, mở như một ứng dụng",
  pwa_ios1: "Ở cuối Safari nhấn “Chia sẻ” — hình vuông có mũi tên hướng lên ⬆️.",
  pwa_ios2: "Cuộn xuống và chọn “Thêm vào Màn hình chính”.",
  pwa_ios3: "Nhấn “Thêm”. Biểu tượng ULA Factory sẽ xuất hiện trên màn hình.",
  pwa_and1: "Nhấn menu trình duyệt — ba dấu chấm ⋮ ở góc trên bên phải.",
  pwa_and2: "Chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.",
  pwa_and3: "Xác nhận. Biểu tượng ULA Factory sẽ xuất hiện trên màn hình.",
  pwa_note: "Vẫn là trang web này: mọi thứ đều được lưu, bản cập nhật tự đến.",
  pwa_ok: "Đã hiểu",
  pwa_done: "Đã cài đặt ứng dụng",
  nav_analytics: "Phân tích",
  an_hint: "Số liệu chính và biểu đồ: bạn bán được gì, kiếm được bao nhiêu và ai đang nợ bạn.",
  an_export: "Tất cả đơn hàng ra Excel",
  an_m: "triệu",
  an_k: "nghìn",
  an_markup: "Lãi gộp",
  an_orders: "Đơn hàng",
  an_avg: "Đơn trung bình",
  an_live: "Đang xử lý (đơn)",
  an_by_month: "Doanh thu và lợi nhuận theo tháng",
  an_by_status: "Đơn hàng theo trạng thái",
  an_more: "Thêm",
  an_top: "Top và người nợ",
  an_top_clients: "Khách hàng",
  an_top_products: "Sản phẩm",
  an_top_debtors: "Người nợ",
  an_attention: "Cần chú ý",
  an_i_up: "Lợi nhuận tăng {n}% so với kỳ trước cùng độ dài.",
  an_i_down: "Lợi nhuận giảm {n}% so với kỳ trước cùng độ dài.",
  an_i_best: "Tháng tốt nhất — {m}: lợi nhuận {s}.",
  an_i_client: "{name} mang lại nhiều lợi nhuận nhất — {n}% tổng số.",
  an_i_debt: "{name} nợ nhiều nhất — {s}.",
  an_a_noprice: "Chưa có giá cho khách: {n}",
  an_a_debts: "Công nợ quá một tuần: {n}",
  an_a_stuck: "Không có chuyển động hơn 10 ngày: {n}",
  an_a_live: "Đơn đang xử lý: {n}",
  an_a_ok: "Mọi thứ ổn: không có công nợ quá hạn hay đơn hàng bị bỏ quên.",
  an_days: "{n} ngày",
  an_goal: "Mục tiêu tháng ({c})",
  an_g_of: "trên {s}",
  an_g_done: "Đã đạt mục tiêu!",
  an_g_left: "Đã được {p}%. Số ngày còn lại trong tháng: {d}.",
  an_g_need: "Để đạt mục tiêu, bạn cần trung bình {s} mỗi ngày.",
  an_g_none: "Chưa có mục tiêu. Hãy đặt số tiền muốn kiếm mỗi tháng và thanh tiến độ sẽ hiện ở đây.",
  an_g_set: "Đặt mục tiêu",
  an_g_change: "Đổi mục tiêu",
  an_g_clear: "Xóa",
  an_g_ph: "Muốn kiếm bao nhiêu, {c}",
  an_g_bad: "Nhập số tiền lớn hơn không",
  an_a_loss: "Đơn đang lỗ: {n}",
  an_none: "Chưa có dữ liệu",
  an_empty: "Không có đơn hàng nào trong kỳ này.",
  an_no_price: "Các đơn trong kỳ này chưa có giá cho khách nên chưa tính được lợi nhuận.",
  an_c_num: "Mã đơn",
  an_c_date: "Ngày",
  an_c_status: "Trạng thái",
  an_c_product: "Sản phẩm",
  an_c_qty: "SL",
  an_c_cur: "Tiền tệ",
  export_empty: "Không có khách hàng để xuất",
  clients_empty_title: "Chưa có khách hàng",
  clients_empty_text: "Khách hàng sẽ xuất hiện ở đây khi họ điền thông tin từ link đơn hàng.",
  empty_title: "Chưa có đơn hàng",
  empty_text: "Nhấn “Đơn hàng mới” để thêm đơn đầu tiên.",
  nothing_found: "Không tìm thấy gì. Hãy đổi từ khóa hoặc bộ lọc.",
  show_more: "Xem thêm",
  loading: "Đang tải…",
  confirm_delete: "Xóa đơn hàng {n} cùng ảnh? Không thể hoàn tác.",
  deleted: "Đã xóa đơn hàng",
  saved: "Đã lưu đơn hàng",
  status_changed: "Đã cập nhật trạng thái",
  error_generic: "Không kết nối được máy chủ. Hãy kiểm tra kết nối và thử lại.",
  error_session: "Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.",
  dup_number: "Đã có đơn hàng với mã này. Hãy đổi mã.",
  photo_failed: "Số ảnh chưa tải lên được: {n}",
  detail_title: "Đơn hàng {n}",
  link_title: "Link cho khách",
  link_hint: "Khách chỉ thấy đơn hàng này và có thể nhập thông tin giao hàng.",
  lk_all_title: "Một liên kết cho tất cả đơn hàng của khách",
  lk_all_hint: "Khách xem được tất cả đơn hàng, trạng thái và tổng số tiền còn nợ ở một nơi. Đơn hàng được gom theo số điện thoại của khách (nếu không có thì theo tên).",
  lk_all_create: "Tạo liên kết chung",
  lk_all_revoke: "Tắt liên kết chung",
  lk_all_confirm_revoke: "Tắt liên kết chung của khách này? Khách sẽ không mở được danh sách đơn hàng bằng liên kết đó nữa. Liên kết của từng đơn hàng không thay đổi.",
  lk_all_created: "Đã tạo và sao chép liên kết chung",
  lk_all_revoked: "Đã tắt liên kết chung",
  lk_all_wa: "Xin chào! Tất cả đơn hàng, trạng thái và thanh toán của bạn ở một nơi:",
  cab_title: "Đơn hàng của bạn",
  cab_debt: "Tổng số tiền cần thanh toán",
  cab_no_debt: "Đã thanh toán đủ",
  cab_empty: "Chưa có đơn hàng.",
  cab_active: "Đang xử lý",
  cab_done: "Đã hoàn tất",
  cab_back: "Tất cả đơn hàng",
  link_active: "Link đang hoạt động. Nếu đổi link, link cũ sẽ ngừng hoạt động ngay.",
  link_disabled: "Link đã bị tắt. Khách không còn mở được đơn này bằng link cũ.",
  link_create: "Tạo link",
  link_rotate: "Đổi link",
  link_revoke: "Tắt link",
  link_confirm_rotate: "Tạo link mới cho đơn hàng {n}? Link cũ sẽ ngừng hoạt động ngay.",
  link_confirm_revoke: "Tắt link của đơn hàng {n}? Khách sẽ không mở được nữa.",
  link_created: "Đã tạo link mới. Link cũ đã bị tắt.",
  link_revoked: "Đã tắt link",
  link_whatsapp: "Gửi qua WhatsApp",
  link_open: "Mở như khách",
  wa_text: "Đơn hàng {n} của bạn. Hãy dùng link này để xem trạng thái, thanh toán và ảnh, cũng như nhập địa chỉ giao hàng:",
  cl_order: "Đơn hàng {n}",
  cl_product: "Sản phẩm",
  cl_status: "Trạng thái đơn hàng",
  history_title: "Lịch sử đơn hàng",
  history_empty: "Chưa có thay đổi trạng thái",
  history_last: "Cập nhật gần nhất",
  history_payment: "Đã thanh toán đến nay: {amount}",
  history_address: "Đã thêm hoặc đổi địa chỉ giao hàng",
  cl_payment: "Chi phí và thanh toán",
  cl_paid_full: "Đã thanh toán đủ",
  cl_delivery_info: "Giao hàng",
  cl_comment: "Ghi chú",
  cl_updated: "Cập nhật",
  cl_not_found_title: "Không tìm thấy đơn hàng",
  cl_not_found_text: "Hãy kiểm tra lại link. Nếu không mở được, hãy nhờ người phụ trách gửi lại.",
  cl_cancelled: "Đơn hàng này đã bị hủy",
  cd_title: "Thông tin giao hàng",
  cd_intro: "Cho chúng tôi biết ai nhận hàng và giao đến đâu.",
  cd_name: "Họ và tên",
  cd_phone: "Điện thoại",
  cd_phone_hint: "Kèm mã quốc gia, ví dụ +1…, +86…, +971…",
  cd_telegram: "Telegram",
  cd_optional: "không bắt buộc",
  cd_city: "Thành phố",
  cd_method: "Cách nhận hàng",
  cd_m_address: "Giao đến địa chỉ",
  cd_m_pickup: "Điểm nhận hàng",
  cd_address: "Địa chỉ: đường, số nhà, căn hộ",
  cd_pickup: "Tên hoặc địa chỉ điểm nhận hàng",
  cd_privacy: "Chỉ người phụ trách của bạn thấy thông tin này. Chúng chỉ dùng để giao hàng.",
  cd_save: "Lưu thông tin",
  cd_saving: "Đang lưu…",
  cd_saved: "Đã lưu thông tin",
  cd_edit: "Sửa",
  cd_cancel: "Hủy",
  cd_locked: "Đơn hàng này đã hoàn tất nên không sửa được thông tin. Hãy nhắn cho người phụ trách nếu cần sửa.",
  e_required: "Hãy điền ô này",
  e_name: "Nhập họ và tên, từ 2 đến 120 ký tự",
  e_phone: "Kiểm tra số: 9 đến 15 chữ số, được có dấu + ở đầu",
  e_telegram: "Username Telegram: 5 đến 32 chữ cái Latin, chữ số hoặc _",
  e_city: "Nhập thành phố, từ 2 đến 80 ký tự",
  e_address: "Nhập địa chỉ, từ 5 đến 300 ký tự",
  e_pickup: "Nhập điểm nhận hàng, từ 2 đến 200 ký tự",
  e_form: "Hãy kiểm tra các ô được đánh dấu",
  nav_buyers: "Người mua",
  login_hint: "Tài khoản người mua ULA Factory",
  account_blocked: "Tài khoản này đã bị khóa. Hãy liên hệ quản trị viên.",
  auto_number: "Được gán tự động",
  req_fields: "Hãy điền khách hàng và tên sản phẩm.",
  settings: "Cài đặt",
  refresh: "Làm mới",
  refreshed: "Đã cập nhật",
  wh_edit: "Sửa",
  wh_add: "Thêm địa chỉ kho",
  wh_empty: "Chưa đặt địa chỉ kho ở Trung Quốc. Hãy thêm để sao chép gửi khách chỉ với một lần nhấn.",
  s_name: "Tên tài khoản",
  s_prefix: "Chữ cái của mã đơn hàng",
  s_prefix_hint: "1 đến 5 chữ cái Latin viết hoa. Ví dụ CN cho mã dạng CN-000125.",
  s_address: "Địa chỉ kho ở Trung Quốc",
  s_address_hint: "Tốt nhất là tiếng Trung, để người bán và shipper đọc được.",
  s_contacts: "Liên hệ của kho",
  s_contacts_hint: "Mỗi dòng một liên hệ: tên và số điện thoại.",
  s_save: "Lưu",
  s_saved: "Đã lưu cài đặt",
  e_ws_name: "Nhập tên tài khoản",
  e_prefix: "Chỉ chữ cái Latin viết hoa, 1 đến 5 ký tự",
  readonly_banner: "Bạn đang xem “{n}”. Không thể thay đổi gì ở đây.",
  back_to_mine: "Tài khoản của tôi",
  b_invite_title: "Mời người mua",
  b_invite_hint: "Người mua có tài khoản riêng. Những người mua khác không thấy khách hàng hay đơn hàng của họ.",
  b_invite_note: "Dành cho ai (không bắt buộc)",
  b_invite_btn: "Tạo lời mời",
  b_invite_ready: "Lời mời đã sẵn sàng. Hãy gửi link cho người mua: link có hiệu lực 14 ngày và chỉ dùng được cho một người.",
  b_invites: "Lời mời đang hoạt động",
  b_invites_empty: "Không có lời mời nào đang hoạt động.",
  b_until: "đến {d}",
  b_delete_invite: "Xóa",
  b_invite_deleted: "Đã xóa lời mời",
  b_workspaces: "Tài khoản người mua",
  b_open: "Mở",
  b_block: "Khóa",
  b_unblock: "Mở khóa",
  b_blocked: "Đã khóa",
  b_active: "Đang hoạt động",
  b_you: "Tài khoản của bạn",
  b_counts: "Đơn hàng: {o} · Khách hàng: {c}",
  b_confirm_block: "Khóa “{n}”? Người mua sẽ không đăng nhập được. Dữ liệu vẫn được giữ.",
  b_wa_text: "Lời mời vào ULA Factory — tài khoản người mua:",
  join_title: "Đăng ký người mua",
  or: "hoặc",
  google_btn: "Tiếp tục với Google",
  no_account: "Chưa có tài khoản?",
  signup_link: "Đăng ký",
  have_account: "Đã có tài khoản?",
  legal_terms: "Điều khoản dịch vụ",
  legal_privacy: "Chính sách bảo mật",
  legal_agree: "Khi đăng ký, bạn đồng ý với điều khoản và chính sách bảo mật:",
  s_sec_look: "Giao diện",
  s_theme: "Chủ đề",
  theme_auto: "Tự động",
  theme_light: "Sáng",
  theme_dark: "Tối",
  s_language: "Ngôn ngữ",
  s_sec_profile: "Hồ sơ",
  s_new_password: "Mật khẩu mới",
  s_password_hint: "Để trống nếu muốn giữ nguyên. Ít nhất 8 ký tự.",
  s_sec_workspace: "Tài khoản",
  s_sec_money: "Tiền tệ và vận chuyển",
  password_changed: "Đã đổi mật khẩu",
  nav_fx: "Đổi tiền tệ",
  fx_hint: "Tỷ giá của bạn cho khách, yêu cầu và tỷ giá ULA cho người mua hộ",
  fx_platform_title: "Tỷ giá ULA cho người mua hộ",
  fx_platform_none: "Chưa có tỷ giá hôm nay",
  fx_rate_line: "1 ¥ = {r} som",
  fx_date: "Tỷ giá ngày {d}",
  fx_old: "Tỷ giá từ {d}, hãy xác nhận trước khi đổi",
  fx_from: "từ {n} ¥",
  fx_som_short: "som",
  fx_cny: "Cần bao nhiêu nhân dân tệ",
  fx_pay: "Cần trả",
  fx_ask_admin: "Gửi yêu cầu đổi tiền",
  fx_s1_admin: "Thanh toán cho quản trị viên theo thông tin",
  fx_s1: "Thanh toán theo thông tin",
  fx_s2: "Đính kèm biên lai thanh toán",
  fx_s3_admin: "Gửi yêu cầu cho quản trị viên",
  fx_s3: "Thông tin của bạn và gửi",
  fx_attach: "Đính kèm biên lai",
  fx_replace: "Đổi",
  fx_receipt: "Biên lai",
  fx_send_rcpt: "Gửi yêu cầu kèm biên lai",
  fx_e_receipt: "Hãy thanh toán và đính kèm biên lai — không có biên lai thì không gửi được",
  fx_qr_label: "Mã QR thanh toán",
  fx_qr_add: "Tải mã QR lên",
  fx_qr_scan: "Hướng camera điện thoại vào mã QR để thanh toán. Bấm để phóng to.",
  fx_qr_off: "Chưa thể tải mã QR: cần chạy bản cập nhật cơ sở dữ liệu (tệp 42).",
  fx_send_no_file: "Chat chưa nhận tệp. Gửi yêu cầu không kèm biên lai? Hãy gửi biên lai cho quản trị viên riêng (WhatsApp hoặc Telegram).",
  fx_no_file_note: "(Chưa đính kèm biên lai — người mua sẽ gửi riêng.)",
  fx_ula_eta_label: "Người mua chờ nhận tệ bao lâu sau khi thanh toán",
  fx_eta_need41: "Đã lưu tỷ giá nhưng chưa lưu thời gian chờ: chưa chạy tệp cơ sở dữ liệu 41.",
  fx_e_upload_off: "Chưa bật tải tệp. Cần chạy bản cập nhật cơ sở dữ liệu (tệp 40).",
  fx_e_rcpt_img: "Đính kèm ảnh hoặc ảnh chụp màn hình (JPG, PNG, WEBP)",
  fx_e_rcpt_type: "Đính kèm ảnh, ảnh chụp màn hình hoặc PDF",
  fx_req_chat: "Chưa có thông tin thanh toán. Hãy hỏi quản trị viên trong chat.",
  fx_req_none: "Chưa có thông tin thanh toán. Hãy hỏi người mua hộ.",
  fx_req_copied: "Đã sao chép thông tin thanh toán",
  fx_tab_ula: "Đổi qua ULA",
  fx_tab_mine: "Đổi tiền cho khách của tôi",
  fx_ula_title: "Tỷ giá ULA",
  fx_all_tiers: "Tất cả mức tỷ giá",
  fx_step_t: "Cách hoạt động",
  fx_step1: "Nhập số tệ bạn cần",
  fx_step2: "Bấm “Gửi yêu cầu đổi tiền” — yêu cầu sẽ gửi tới quản trị viên",
  fx_step3: "Quản trị viên trả lời trong Hỗ trợ và hướng dẫn cách thanh toán",
  fx_open_chat: "Mở chat hỗ trợ",
  fx_admin_msg: "Yêu cầu đổi: ¥ {cny} = {som} som theo tỷ giá {r}",
  fx_sent_admin: "Đã gửi yêu cầu. Câu trả lời sẽ ở mục Hỗ trợ.",
  fx_admin_set: "Tỷ giá cho người mua hộ (bạn đặt)",
  fx_ed_from: "Từ, ¥",
  fx_ed_rate: "Tỷ giá, som cho 1 ¥",
  fx_ed_add: "Thêm mức",
  fx_ed_hint: "Ví dụ: từ 1 000 ¥ — 12,60; từ 10 000 ¥ — 12,40. Mức nhỏ nhất là số tiền tối thiểu.",
  fx_e_many: "Không quá {n} mức",
  fx_note_label: "Thông tin thanh toán và ghi chú",
  fx_note_ph: "Ví dụ: Mbank 0555 123 456 (Azamat K.). Nhân dân tệ chuyển vào Alipay / WeChat của khách.",
  fx_save: "Lưu tỷ giá",
  fx_saved: "Đã lưu tỷ giá",
  fx_my_title: "Tỷ giá của tôi cho khách",
  fx_my_hint: "Khách nhập số nhân dân tệ cần, thấy số som và thông tin thanh toán của bạn, thanh toán rồi tải ảnh chụp màn hình. Hãy cập nhật tỷ giá mỗi ngày.",
  fx_on_label: "Hiển thị đổi tiền cho khách",
  fx_e_rate: "Kiểm tra các mức: \"từ\" là số từ 0, tỷ giá lớn hơn 0",
  fx_link_title: "Liên kết đổi tiền cho khách",
  fx_link_hint: "Gửi cho khách. Tỷ giá và máy tính cũng hiển thị trên cửa hàng và liên kết đơn hàng.",
  fx_copy: "Sao chép",
  fx_wa_text: "Đổi som → nhân dân tệ: {url}",
  fx_link_make: "Tạo liên kết",
  fx_req_title: "Yêu cầu đổi tiền của khách",
  fx_req_empty: "Chưa có yêu cầu",
  fx_active: "Đang xử lý",
  fx_all: "Tất cả",
  fx_st_new: "Chờ thanh toán",
  fx_st_paid: "Đã thanh toán",
  fx_st_done: "Đã xong",
  fx_st_cancelled: "Đã hủy",
  fx_done_btn: "Xong",
  fx_cancel_btn: "Hủy",
  fx_proof_btn: "Ảnh thanh toán",
  fx_readonly: "Chỉ chủ tài khoản mới đổi được tỷ giá",
  fx_pub_title: "Đổi som → nhân dân tệ",
  fx_pub_btn: "Gửi yêu cầu",
  fx_pub_send: "Tiếp — thanh toán",
  fx_to_pay: "Cần trả",
  fx_requisites: "Thông tin thanh toán",
  fx_pay_hint: "Chuyển khoản theo thông tin và tải ảnh chụp thanh toán.",
  fx_upload: "Tải ảnh thanh toán",
  fx_uploading: "Đang tải…",
  fx_pay_later: "Người bán đã nhận yêu cầu. Nếu không tải được ảnh, hãy gửi cho người bán qua WhatsApp.",
  fx_pub_done: "Đã nhận ảnh! Người bán sẽ kiểm tra và chuyển nhân dân tệ.",
  fx_pub_again: "Yêu cầu mới",
  fx_back: "Sửa",
  fx_comment_ph: "Ví dụ: chuyển vào Alipay, thời gian thuận tiện",
  fx_page_hint: "Nhập số nhân dân tệ cần để thấy số som.",
  fx_page_none: "Không có đổi tiền",
  fx_e_min: "Số tiền tối thiểu là {n} ¥",
  fx_e_amount: "Nhập số nhân dân tệ cần",
  fx_e_off: "Hiện không thể đổi tiền",
  fx_locked: "Sau khi xác minh danh tính, tại đây sẽ mở:",
  fx_locked_1: "tỷ giá của bạn cho khách",
  fx_locked_2: "thông tin thanh toán và mã QR",
  fx_locked_3: "link bạn gửi cho khách",
  fx_next_title: "Đã xác minh! Còn 3 bước:",
  fx_next_1: "Đặt tỷ giá cho khách (bên dưới)",
  fx_next_2: "Thêm thông tin thanh toán, mã QR và bấm “Lưu”",
  fx_next_3: "Bấm “Bật đổi tiền cho khách” và gửi link cho khách",
  kyc_msg_ok: "✅ Bạn đã được xác minh danh tính! Mở “Đổi tiền” → “Đổi tiền của tôi cho khách”: đặt tỷ giá, thông tin thanh toán, bấm “Bật đổi tiền cho khách” và gửi link cho khách.",
  kyc_msg_no: "❌ Xác minh không đạt. Lý do: {r}. Hãy sửa và gửi lại giấy tờ trong mục “Đổi tiền”.",
  fx_off_warn: "Đổi tiền đang tắt — khách mở link sẽ thấy “không khả dụng”. Hãy bật:",
  fx_off_warn_kyc: "Đổi tiền đang tắt — khách sẽ thấy “không khả dụng”. Trước tiên hãy xác minh danh tính ở trên.",
  fx_turn_on: "Bật đổi tiền cho khách",
  fx_off_copied: "Đã sao chép, nhưng đổi tiền đang tắt — khách sẽ thấy “không khả dụng”. Hãy bật.",
  fx_e_off_hint: "Người bán chưa bật đổi tiền. Hãy nhắn cho họ — khi bật, link sẽ hoạt động.",
  fx_e_upload: "Không tải được ảnh. Hãy thử lại.",
  fx_st_confirmed: "Đang chuyển nhân dân tệ",
  fx_eta_m: "{n} phút",
  fx_eta_h: "{n} giờ",
  fx_eta_d: "{n} ngày",
  fx_eta_label: "Thường chuyển nhân dân tệ trong vòng",
  fx_eta_q: "Khách cần chờ bao lâu để nhận nhân dân tệ?",
  fx_eta_usual: "Nhân dân tệ thường đến trong vòng {n} sau khi thanh toán",
  fx_eta_change: "Đổi thời gian",
  fx_wait_until: "Dự kiến trước {t}",
  fx_left: "còn khoảng {n}",
  fx_late: "Sắp hết thời gian — người bán sẽ sớm chuyển. Nếu quá lâu, hãy nhắn cho người bán.",
  fx_confirm_btn: "Đã nhận thanh toán",
  fx_confirm_go: "Xác nhận và báo khách",
  fx_confirmed: "Khách thấy trạng thái và thời gian chờ",
  fx_sent_btn: "Đã chuyển nhân dân tệ",
  fx_msg_label: "Lời nhắn cho khách (không bắt buộc)",
  fx_msg_ph: "Ví dụ: chuyển vào Alipay sau 15:00",
  fx_wa_status: "{name}, trạng thái yêu cầu đổi tiền: {url}",
  fx_track: "Theo dõi trạng thái",
  fx_my_reqs: "Yêu cầu của tôi",
  fx_req_from: "Yêu cầu lúc {d}",
  fx_status_title: "Trạng thái yêu cầu đổi tiền",
  fx_s_new: "Đang chờ bạn thanh toán",
  fx_s_paid: "Đã nhận ảnh — đang kiểm tra thanh toán",
  fx_s_confirmed: "Đã xác nhận thanh toán — đang chuyển nhân dân tệ",
  fx_s_done: "Đã chuyển nhân dân tệ",
  fx_s_cancelled: "Yêu cầu đã hủy",
  fx_step_new: "Đã nhận yêu cầu",
  fx_step_paid: "Thanh toán",
  fx_step_confirmed: "Đã xác nhận",
  fx_step_done: "Đã chuyển",
  fx_paid_wait: "Kiểm tra thanh toán thường mất tối đa {n}. Chúng tôi sẽ báo khi chuyển.",
  fx_paid_wait0: "Người bán sẽ kiểm tra và báo thời gian chờ.",
  fx_created: "Yêu cầu lúc {d}",
  fx_auto: "trang tự cập nhật",
  fx_st_none: "Không tìm thấy yêu cầu",
  fx_st_none_hint: "Hãy kiểm tra liên kết hoặc nhắn người bán.",
  kyc_title: "Xác minh danh tính",
  kyc_ok: "Đã xác minh — có thể bật đổi tiền",
  kyc_pending: "Giấy tờ đang được kiểm tra (gửi {d}). Thường trong một ngày.",
  kyc_rejected: "Xác minh không đạt",
  kyc_revoked: "Đã thu hồi xác minh",
  kyc_why: "Để khách tin tưởng, chỉ bật đổi tiền sau khi xác minh. Tải hộ chiếu và ảnh selfie cầm hộ chiếu một lần. Chỉ quản trị ULA Factory xem được, khách không thấy.",
  kyc_name: "Họ tên như trên hộ chiếu",
  kyc_name_ph: "Nguyễn Văn A",
  kyc_doc: "Số hộ chiếu",
  kyc_front: "Hộ chiếu: trang có ảnh",
  kyc_back: "Mặt sau",
  kyc_selfie: "Selfie cầm hộ chiếu",
  kyc_photo_hint: "Ảnh rõ, không lóa, đọc được chữ. Selfie: khuôn mặt bạn và hộ chiếu bên cạnh.",
  kyc_consent: "Tôi đồng ý lưu trữ và kiểm tra thông tin hộ chiếu cho việc đổi tiền.",
  kyc_send: "Gửi xác minh",
  kyc_e_name: "Nhập họ tên như trên hộ chiếu",
  kyc_e_doc: "Kiểm tra số hộ chiếu: chỉ chữ Latin và số",
  kyc_e_files: "Tải ảnh hộ chiếu và selfie cầm hộ chiếu",
  kyc_e_consent: "Hãy tích ô đồng ý",
  kyc_admin_msg: "Xác minh đổi tiền: {name} đã gửi giấy tờ",
  kyc_sent: "Đã gửi — chờ xác minh",
  kyc_admin_title: "Xác minh người đổi tiền",
  kyc_f_pending: "Chờ xác minh",
  kyc_admin_empty: "Không có yêu cầu",
  kyc_st_pending: "Chờ xác minh",
  kyc_st_approved: "Đã xác minh",
  kyc_st_rejected: "Từ chối",
  kyc_st_revoked: "Đã thu hồi",
  kyc_view: "Xem ảnh",
  kyc_reject: "Từ chối",
  kyc_revoke: "Thu hồi",
  kyc_reason_q: "Lý do (người mua sẽ thấy):",
  kyc_e_reason: "Hãy nhập lý do",
  kyc_e_required: "Hãy xác minh danh tính trước (bên dưới)",
  kyc_pub_badge: "Người bán đã xác minh danh tính trên ULA Factory",
  fx_who_me: "Bạn",
  fx_who_client: "Khách",
  fx_who_buyer: "Người bán",
  fx_who_admin: "Quản trị ULA",
  fx_d_photo: "Ảnh",
  fx_st_sent: "Chờ khách xác nhận",
  fx_st_dispute: "Tranh chấp",
  fx_flag: "Số này nằm trong danh sách đen — hãy cẩn thận",
  fx_wait_client: "Chờ khách xác nhận · tự đóng lúc {t}",
  fx_sent_proof_btn: "Ảnh chuyển tiền",
  fx_send_pick: "Chọn ảnh chụp chuyển tiền — bắt buộc",
  fx_sent_ok: "Đã đánh dấu đã chuyển. Khách sẽ xác nhận",
  fx_d_btn: "Mở tranh chấp",
  fx_d_btn_notrecv: "Chưa nhận được — mở tranh chấp",
  fx_d_open_me: "Bạn đã mở tranh chấp",
  fx_d_open_client: "Khách đã mở tranh chấp",
  fx_d_open_buyer: "Người bán đã mở tranh chấp",
  fx_d_closed: "Tranh chấp đã đóng",
  fx_d_res_client: "Quyết định: khách đúng",
  fx_d_res_buyer: "Quyết định: người bán đúng",
  fx_d_msg_ph: "Tin nhắn về tranh chấp",
  fx_d_send: "Gửi",
  fx_d_attach: "Ảnh",
  fx_d_hint_buyer: "Khi đang tranh chấp không thể đổi trạng thái. Đính kèm sao kê hoặc ảnh — quản trị ULA Factory sẽ quyết định.",
  fx_d_hint_client: "Quản trị ULA Factory sẽ kiểm tra ảnh của hai bên và quyết định. Đính kèm bằng chứng: ảnh thanh toán, sao kê, tin nhắn.",
  fx_d_reason_q: "Chuyện gì xảy ra? (khách và quản trị sẽ thấy)",
  fx_d_reason_ph: "Mô tả: thanh toán bao nhiêu, khi nào, vấn đề gì",
  fx_d_reason_short: "Hãy mô tả chi tiết hơn (ít nhất 5 ký tự)",
  fx_d_from: "Nếu người bán không phản hồi, sau {t} có thể mở tranh chấp",
  fx_d_err: "Không thành công. Hãy tải lại và thử lại",
  fx_e_dispute: "Không thể đổi trạng thái khi đang tranh chấp",
  fx_disputes_title: "Tranh chấp đổi tiền",
  fx_d_open_f: "Đang mở",
  fx_disputes_empty: "Không có tranh chấp",
  fx_bl_tag: "trong danh sách đen",
  fx_strikes: "Số tranh chấp người bán thua: {n}",
  fx_res_client_btn: "Khách đúng",
  fx_res_buyer_btn: "Người bán đúng",
  fx_res_note_q: "Quyết định (hai bên sẽ thấy):",
  fx_res_bl_q: "Thêm số khách vào danh sách đen? Mọi người bán sẽ thấy cảnh báo.",
  fx_t_created: "Yêu cầu",
  fx_t_paid: "Ảnh thanh toán",
  fx_t_eta: "Hẹn trước",
  fx_t_sent: "Đã chuyển",
  fx_s_sent: "Đã chuyển — hãy kiểm tra và xác nhận",
  fx_s_dispute: "Đang tranh chấp — nền tảng đang xem xét",
  fx_s_done2: "Giao dịch hoàn tất",
  fx_step_sent: "Đã chuyển",
  fx_step_recv: "Đã nhận",
  fx_sent_proof_cap: "Ảnh chuyển tiền của người bán",
  fx_recv_q: "Đã nhận được chưa? Đánh giá người bán",
  fx_recv_btn: "Đã nhận",
  fx_recv_auto: "Nếu không xác nhận hoặc mở tranh chấp trước {t}, giao dịch sẽ tự đóng",
  fx_protect: "Bảo vệ ULA Factory: người bán đã xác minh danh tính. Nếu có vấn đề, hãy mở tranh chấp tại đây.",
  pwa_update: "Trang web đã được cập nhật",
  pwa_reload: "Tải lại",
  board_news_title: "Tin tức",
  board_news_ok: "Đã hiểu",
  board_rate_title: "Tỷ giá ULA hôm nay",
  board_news_add: "Đăng tin",
  board_news_ph: "Bạn muốn nói gì với người mua hộ?",
  board_news_post: "Đăng",
  board_news_posted: "Đã đăng tin",
  board_news_del: "Xóa",
  board_news_del_q: "Xóa tin này?",
  board_news_err: "Có lỗi. Hãy thử lại",
  rc_title: "Tỷ giá nhân dân tệ",
  rc_sum: "Số tiền",
  rc_rate: "Som cho 1 ¥",
  rc_days: "{n} ngày",
  rc_chart_none: "Biểu đồ sẽ hiện khi tỷ giá thay đổi",
  rc_min: "thấp nhất {n}",
  rc_max: "cao nhất {n}",
  rc_main: "tỷ giá từ {n} ¥",
  rc_calc: "Bạn cần bao nhiêu tệ?",
  rc_go: "Đổi tiền",
  rc_more: "Chi tiết: biểu đồ và ghi chú",
  rc_per: "som cho 1 ¥",
  rc_edit: "Sửa tỷ giá",
  rc_warn_old: "Tỷ giá hôm nay chưa cập nhật — người mua hộ thấy tỷ giá cũ",
  rc_warn_none: "Chưa có tỷ giá — người mua hộ không thấy",
  fx_big_change: "Tỷ giá “từ {from} ¥” đổi từ {a} sang {b} ({p}%). Có phải gõ nhầm?",
  fx_notify_label: "Báo người mua hộ: tin trên trang và Telegram",
  fx_news_text: "Tỷ giá ULA mới:\n{lines}",
  fx_saved_news: "Đã lưu tỷ giá, người mua hộ sẽ nhận tin",
  board_news_tg: "Gửi cả qua Telegram",
  board_news_sent_tg: "Đã gửi Telegram: {n}",
  ref_promo_t: "Bạn cũng bán hàng từ Trung Quốc?",
  ref_promo_b: "Trang này được tạo bằng ULA Factory: đơn hàng, khách hàng và tỷ giá nhân dân tệ ở một nơi. Dùng thử miễn phí.",
  ref_promo_btn: "Dùng thử miễn phí",
  ref_inv_t: "Mời bạn là người mua hộ",
  ref_inv_b: "Gửi liên kết này cho người mua hộ bạn quen. Khi họ đăng ký, chúng tôi sẽ ghi nhận bạn đã giới thiệu.",
  ref_inv_copy: "Sao chép liên kết",
  ref_inv_copied: "Đã sao chép liên kết",
  ref_inv_wa: "Gửi qua WhatsApp",
  ref_inv_wa_text: "Tôi quản lý đơn hàng Trung Quốc bằng ULA Factory — tiện và tỷ giá tốt. Thử nhé: {url}",
  sh3_add: "Thêm vào giỏ",
  sh3_cart: "Giỏ hàng",
  sh3_checkout: "Đặt hàng ({n})",
  sh3_more: "Thêm sản phẩm",
  sh3_remove: "Xóa",
  f_more_show: "Hiện tất cả trường ▾",
  f_more_hide: "Ẩn bớt trường ▴",
  q_s1: "Giá hàng",
  q_s1_sub: "Giá nhà cung cấp",
  q_s2: "Vận chuyển",
  q_s2_sub: "Cân nặng và cước",
  q_s3: "Tiền lãi của bạn",
  q_s3_sub: "Bạn muốn lãi bao nhiêu",
  q_more_item: "+ Tên và link (không bắt buộc)",
  q_more_rates: "⚙ Tiền tệ và tỷ giá",
  bn_more: "Thêm",
  bn_new: "Tạo mới",
  pf_title: "Hồ sơ",
  pf_role_owner: "Chủ",
  pf_role_staff: "Trợ lý",
  pf_role_admin: "Quản trị",
  pf_orders: "Đơn hàng",
  pf_active: "Đang làm",
  pf_clients: "Khách hàng",
  pf_ready: "Thiết lập tài khoản",
  pf_ready_n: "{a}/{b}",
  pf_c_name: "Tên",
  pf_c_phone: "Điện thoại",
  pf_c_logo: "Logo",
  pf_c_wh: "Địa chỉ kho",
  pf_c_tariff: "Cước vận chuyển",
  pf_month: "Tháng này",
  pf_m_new: "Đơn: {n}",
  pf_m_done: "Đã giao: {n}",
  pf_m_top: "Khách tốt nhất: {name}",
  pf_m_empty: "Tháng này chưa có đơn",
  pf_look: "Giao diện",
  pf_dark: "Chế độ tối",
  pf_dark_sub: "Dịu mắt vào ban đêm",
  pf_color: "Màu nút",
  pf_col_ula: "Đỏ thương hiệu",
  pf_col_blue: "Xanh dương",
  pf_col_violet: "Tím",
  pf_col_green: "Xanh lá",
  pf_col_orange: "Cam",
  pf_text: "Cỡ chữ",
  pf_ts_s: "Nhỏ",
  pf_ts_m: "Vừa",
  pf_ts_l: "Lớn",
  pf_ts_xl: "Rất lớn",
  pf_style: "Kiểu",
  pf_ui_rounded: "Bo tròn",
  pf_ui_soft: "Mềm",
  pf_ui_crisp: "Vuông",
  pf_settings: "Cài đặt tài khoản",
  pf_device_note: "Giao diện được lưu trên thiết bị này.",
  pf_edit: "Sửa hồ sơ",
  pf_photo: "Ảnh của tôi",
  pf_photo_hint: "Hiển thị trong hồ sơ",
  pf_photo_up: "Tải ảnh lên",
  pf_photo_change: "Đổi ảnh",
  pf_remove: "Gỡ",
  pf_name: "Tên của bạn",
  pf_company: "Tên công ty",
  pf_logo: "Logo công ty",
  pf_logo_hint: "Khách thấy trên trang đơn và cửa hàng",
  pf_logo_up: "Tải logo lên",
  pf_logo_change: "Đổi logo",
  pf_save: "Lưu",
  pf_cancel: "Hủy",
  pf_photo_del: "Gỡ ảnh",
  bn_fx: "Đổi tiền",
  bn_support: "Chat",
  join_country: "Quốc gia",
  country_pick: "Chọn quốc gia",
  country_other: "Quốc gia khác",
  country_none: "Chưa chọn",
  e_country: "Hãy chọn quốc gia của bạn",
  country_kg: "Kyrgyzstan",
  fs_main_sub: "Số, ngày và trạng thái",
  fs_client_sub: "Ai đặt hàng",
  fs_product_sub: "Mua gì và mua của ai",
  fs_delivery_sub: "Cân nặng và giá cước",
  fs_price: "Giá cho khách",
  fs_price_sub: "Khách trả bao nhiêu và đã trả bao nhiêu",
  fs_photos_sub: "Khách sẽ thấy trong đường link",
  fs_notes_sub: "Cho khách và cho bạn",
  fs_sh_main: "Lô hàng",
  fs_sh_main_sub: "Tên, đơn vị vận chuyển và ngày gửi",
  fs_sh_cost_sub: "Tổng cân nặng và chi phí cả lô",
  fs_sh_orders_sub: "Những đơn nào đi trong lô này",
  fs_pr_photo_sub: "Ảnh đẹp — nhiều đơn hơn",
  fs_pr_main: "Tên và giá",
  fs_pr_main_sub: "Khách thấy gì trên cửa hàng",
  fs_pr_desc_sub: "Kích thước, màu, chất liệu — không bắt buộc",
  er_title: "Lỗi trên thiết bị người dùng",
  er_none: "không có ✓",
  er_hint: "Trang web tự báo khi có lỗi ở người mua hoặc khách hàng. Gửi nội dung lỗi cho lập trình viên, khi sửa xong hãy bấm «Đã sửa».",
  er_hits: "{n} lần",
  er_people: "người mua: {n}",
  er_clients: "ở khách hàng: {n}",
  er_details: "Chi tiết cho lập trình viên",
  er_fixed: "Đã sửa",
  er_clear_all: "Xoá danh sách",
  er_clear_q: "Xoá tất cả lỗi khỏi danh sách?",
  logo_title: "Logo",
  logo_hint: "Khách hàng sẽ thấy logo này thay cho \"ULA Factory\" trên trang đơn hàng, liên kết chung và cửa hàng. Nên dùng png/jpg vuông hoặc ngang.",
  logo_upload: "Tải logo lên",
  logo_change: "Đổi logo",
  logo_remove: "Xóa",
  logo_err_type: "Hãy dùng tệp png, jpg hoặc webp",
  logo_err_size: "Tệp quá lớn",
  onboard_title: "Hoàn tất đăng ký",
  onboard_text: "Hãy điền thông tin công ty của bạn. Không có chúng, tài khoản sẽ không mở được.",
  e_ob_addr: "Nhập địa chỉ kho ở Trung Quốc nơi hàng được gửi đến",
  google_failed: "Không đăng nhập được bằng Google. Hãy thử lại hoặc đăng nhập bằng email.",
  join_hint: "Tạo tài khoản của bạn. Những người mua khác không thấy khách hàng hay đơn hàng của bạn.",
  join_name: "Tên của bạn",
  join_phone: "Điện thoại",
  join_ws: "Tên tài khoản hoặc công ty",
  join_password: "Mật khẩu, ít nhất 8 ký tự",
  join_btn: "Tạo tài khoản",
  join_busy: "Đang tạo…",
  join_invalid_title: "Lời mời không hợp lệ",
  join_invalid_text: "Link đã hết hạn hoặc đã được dùng. Hãy xin lời mời mới.",
  join_done_title: "Hãy kiểm tra email",
  join_done_text: "Chúng tôi đã gửi email đến {e}. Hãy mở thư, xác nhận địa chỉ và đăng nhập.",
  join_exists: "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.",
  e_email: "Hãy kiểm tra lại email",
  e_password: "Mật khẩu phải có ít nhất 8 ký tự",

  // разрешения и устройство (js/device.js)
  perm_title: "Thiết lập ULA",
  perm_sub: "Hai quyền — và ứng dụng sẽ hoạt động đúng cách.",
  perm_push: "Thông báo",
  perm_push_d: "Yêu cầu mới, tin nhắn hỗ trợ và trạng thái đơn — ngay lập tức, kể cả khi ứng dụng đóng.",
  perm_geo: "Vị trí",
  perm_geo_d: "Bộ phận hỗ trợ sẽ thấy bạn ở đâu và giúp nhanh hơn về giao hàng và sự cố. Có thể tắt trong cài đặt điện thoại.",
  perm_allow: "Cho phép",
  perm_on: "Đã bật",
  perm_denied: "Bị chặn trong cài đặt",
  perm_later: "Để sau",
  perm_done: "Xong",
  dev_now: "đang trực tuyến",
  dev_min: "{n} phút trước",
  dev_hour: "{n} giờ trước",
  dev_phone: "Điện thoại",
  dev_tablet: "Máy tính bảng",
  dev_desktop: "Máy tính",
  dev_app: "ứng dụng",
  dev_seen: "Trực tuyến",
  dev_first: "lần đầu",
  dev_version: "Phiên bản",
  dev_push: "Thông báo",
  dev_place: "Vị trí",
  dev_map: "Mở trên bản đồ",
  dev_m: "m",
  dev_geo_no: "đã từ chối",
  dev_geo_none: "chưa cho phép",
  dev_ip: "IP",
  dev_tz: "Múi giờ, ngôn ngữ",
  dev_screen: "Màn hình",
  dev_window: "cửa sổ {v}",
  dev_dark: "giao diện tối",
  dev_net: "Mạng",
  dev_offline: "ngoại tuyến",
  dev_gb: "{n} GB",
  dev_cores: "{n} lõi",
  dev_ua: "Trình duyệt",

  // режим правки администратора (js/adminedit.js)
  adm_edit_on: "✏️ Bật chỉnh sửa",
  adm_edit_off: "Kết thúc chỉnh sửa",
  adm_log: "Nhật ký",
  adm_edit_banner: "Chế độ chỉnh sửa: không gian «{n}». Bạn đang thay đổi dữ liệu của người mua — mọi thứ được ghi lại. Đến {t}.",
  adm_edit_confirm: "Bật chỉnh sửa không gian «{n}» trong 2 giờ?\n\nBạn có thể thay đổi đơn hàng, khách hàng, lô hàng và cài đặt như chủ sở hữu. Mọi thay đổi đều được ghi lại.",
  adm_edit_started: "Đã bật chỉnh sửa trong 2 giờ",
  adm_edit_stopped: "Đã kết thúc chỉnh sửa — chỉ xem",
  adm_edit_expired: "Hết thời gian chỉnh sửa — không gian chỉ xem",
  adm_log_title: "Nhật ký chỉnh sửa: «{n}»",
  adm_log_empty: "Quản trị viên chưa thay đổi gì ở đây",
  adm_someone: "Quản trị viên",
  adm_fields: "trường:",
  adm_op_INSERT: "đã thêm",
  adm_op_UPDATE: "đã sửa",
  adm_op_DELETE: "đã xóa",
  adm_op_edit_on: "đã bật chỉnh sửa",
  adm_op_edit_off: "đã kết thúc chỉnh sửa",
  adm_t_orders: "đơn hàng",
  adm_t_clients: "khách hàng",
  adm_t_order_photos: "ảnh đơn",
  adm_t_shipments: "lô hàng",
  adm_t_suppliers: "nhà cung cấp",
  adm_t_shop_products: "sản phẩm cửa hàng",
  adm_t_expenses: "chi phí",
  adm_t_workspaces: "cài đặt không gian",
  adm_t_exchange_requests: "yêu cầu đổi tiền",
  adm_t_workspace_members: "nhóm",
  adm_t_team_invites: "lời mời nhóm",
  adm_t_client_cabinets: "tài khoản khách",

  // вход по Face ID (js/passkey.js)
  pk_title: "Đăng nhập bằng Face ID",
  pk_hint: "Đăng nhập không cần mật khẩu — bằng khuôn mặt hoặc vân tay. Khóa chỉ lưu trên điện thoại của bạn; mật khẩu vẫn là cách dự phòng.",
  pk_login_apple: "Đăng nhập bằng Face ID",
  pk_login_android: "Đăng nhập bằng vân tay",
  pk_login_windows: "Đăng nhập bằng Windows Hello",
  pk_login_other: "Đăng nhập bằng khóa truy cập",
  pk_add_apple: "Bật Face ID trên thiết bị này",
  pk_add_android: "Bật đăng nhập bằng vân tay",
  pk_add_windows: "Bật Windows Hello",
  pk_add_other: "Thêm khóa truy cập",
  pk_none: "Chưa bật trên thiết bị nào.",
  pk_noname: "Khóa truy cập",
  pk_created: "thêm {d}",
  pk_used: "đăng nhập {d}",
  pk_delete: "Xóa",
  pk_delete_confirm: "Xóa khóa này? Thiết bị đó sẽ phải đăng nhập lại bằng mật khẩu.",
  pk_deleted: "Đã xóa khóa",
  pk_added: "Xong! Giờ có thể đăng nhập bằng Face ID",
  pk_unsupported: "Trình duyệt này không hỗ trợ đăng nhập bằng Face ID. Hãy mở ULA trong Safari hoặc Chrome.",
  pk_off: "Sắp ra mắt.",
  pk_off_admin: "Cần bật một lần: Supabase → Authentication → Passkeys → Enable.",
  pk_err_off: "Đăng nhập bằng Face ID đang tắt. Hãy dùng mật khẩu.",
  pk_err_login: "Không đăng nhập được bằng Face ID. Hãy dùng mật khẩu.",
  pk_err_add: "Không bật được. Vui lòng thử lại.",
  pk_err_exists: "Face ID đã được bật trên thiết bị này.",
  pk_app: "Sắp có trong ứng dụng. Hiện Face ID hoạt động khi mở ULA bằng Safari.",

  // Face ID: блокировка и настройки (js/passkey.js)
  pk_sec: "Đăng nhập & khóa",
  pk_foot_off: "Bật để đăng nhập không cần mật khẩu và mở khóa ULA bằng một cái nhìn khi quay lại — như ứng dụng ngân hàng.",
  pk_lock_row: "Khóa ULA",
  pk_lock_after: "Yêu cầu",
  pk_after_0: "Ngay lập tức",
  pk_after_60: "Sau 1 phút",
  pk_after_300: "Sau 5 phút",
  pk_after_900: "Sau 15 phút",
  pk_other: "Thiết bị khác",
  pk_locked: "Ứng dụng đã khóa",
  pk_with_password: "Đăng nhập bằng mật khẩu",
  pk_row_apple: "Đăng nhập bằng Face ID",
  pk_use_apple: "Dùng Face ID",
  pk_foot_on_apple: "Đăng nhập và mở khóa ULA chỉ bằng một cái nhìn — không cần mật khẩu. Khuôn mặt do iPhone tự kiểm tra, không gửi đi đâu.",
  pk_row_android: "Đăng nhập bằng vân tay",
  pk_use_android: "Dùng vân tay",
  pk_foot_on_android: "Đăng nhập và mở khóa ULA bằng vân tay — không cần mật khẩu. Điện thoại tự kiểm tra, không gửi đi đâu.",
  pk_row_windows: "Windows Hello",
  pk_use_windows: "Dùng Windows Hello",
  pk_foot_on_windows: "Đăng nhập và mở khóa ULA bằng Windows Hello — không cần mật khẩu.",
  pk_row_other: "Đăng nhập bằng khóa truy cập",
  pk_use_other: "Dùng khóa truy cập",
  pk_foot_on_other: "Đăng nhập và mở khóa ULA không cần mật khẩu.",
  // баланс клиента (js/wallet.js)
  wl_title: "Số dư khách hàng",
  wl_chip: "Số dư",
  wl_btn_add: "Nạp tiền",
  wl_btn_out: "Hoàn tiền cho khách",
  wl_amount: "Số tiền",
  wl_currency: "Tiền tệ",
  wl_note: "Ghi chú (không bắt buộc)",
  wl_note_ph: "Ví dụ: tiền mặt, chuyển khoản",
  wl_apply: "Thanh toán ngay nợ đơn hàng: {s} ({n})",
  wl_save_add: "Ghi có",
  wl_save_out: "Hoàn tiền",
  wl_empty: "Chưa có giao dịch. Khi khách trả trước, nhấn “Nạp tiền”.",
  wl_history: "Sao kê",
  wl_k_deposit: "Nạp tiền",
  wl_k_withdraw: "Hoàn tiền cho khách",
  wl_k_order: "Thanh toán đơn {n}",
  wl_k_return: "Trả về số dư · đơn {n}",
  wl_k_fix: "Điều chỉnh",
  wl_deleted: "đơn đã xóa",
  wl_debt: "Nợ đơn hàng",
  wl_net: "Tổng sau khi trừ nợ",
  wl_pay: "Trả bằng số dư · {s}",
  wl_back: "Trả thanh toán về số dư",
  wl_back_q: "Trả khoản thanh toán {s} của đơn {n} về số dư của khách?",
  wl_paid_ok: "Đã trả bằng số dư {s}",
  wl_add_ok: "Đã ghi có {s}",
  wl_add_paid: "Đã ghi có {s}, {p} dùng cho đơn hàng ({n})",
  wl_out_ok: "Đã hoàn cho khách {s}",
  wl_back_ok: "Đã trả về số dư {s}",
  wl_undo: "Hoàn tác",
  wl_undo_q: "Hoàn tác mục này? Nếu là thanh toán đơn, đơn sẽ trở lại chưa thanh toán.",
  wl_undo_ok: "Đã hoàn tác",
  wl_no_funds: "Số dư không đủ",
  wl_bad_amount: "Nhập số tiền lớn hơn 0",
  wl_prepaid: "Khách trả trước",
  wl_balance_line: "Số dư khách hàng{s}:",
  cab_wallet: "Số dư của bạn",
  cab_wallet_hint: "Số tiền bạn đã trả trước. Dùng để thanh toán đơn hàng.",
  cab_wallet_ops: "Lịch sử số dư",
  bi_title: "Phân tích kinh doanh", bi_hint: "Tổng quan không gian đã chọn dành cho quản trị viên.",
  bi_choose_workspace: "Chọn không gian trong danh sách phía trên.", bi_workspace: "Không gian: {name}", bi_workspace_label: "Không gian người mua", bi_select_workspace: "Chọn không gian", bi_no_workspaces: "Không có không gian khả dụng. Hãy kiểm tra đăng nhập quản trị viên và xác minh 2FA.",
  bi_period: "Khoảng thời gian", bi_7: "7 ngày", bi_30: "30 ngày", bi_90: "90 ngày", bi_365: "1 năm", bi_custom: "Tùy chọn", bi_from: "Từ", bi_to: "Đến", bi_show: "Xem",
  bi_insufficient: "Không đủ dữ liệu", bi_empty: "Không có đơn hàng hoặc chi phí trong kỳ này.", bi_no_orders: "Không có đơn hàng bằng tiền tệ này trong kỳ.", bi_bad_dates: "Chọn ngày hợp lệ: ngày bắt đầu không được sau ngày kết thúc.",
  bi_load_error: "Không thể tải tổng quan. Hãy thử lại và gửi mã lỗi cho bộ phận hỗ trợ.", bi_login_error: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.", bi_access_error: "Cần quyền quản trị viên. Nếu bật 2FA, hãy hoàn tất xác minh.", bi_migration_error: "Không tìm thấy hàm tổng quan. Hãy kiểm tra migration 51 trong Supabase.", bi_network_error: "Không có kết nối mạng. Hãy kiểm tra và thử lại.", bi_render_error: "Đã nhận dữ liệu nhưng không thể hiển thị tổng quan. Hãy liên hệ hỗ trợ.",
  bi_scope: "Đơn hàng lọc theo ngày đặt, chi phí theo ngày chi. Không tính đơn đã hủy; trạng thái là hiện tại.",
  bi_currency_note: "Các loại tiền được hiển thị riêng, không quy đổi tỷ giá.", bi_active: "Đơn đang xử lý", bi_completed: "Đơn đã giao", bi_delayed: "Đơn chậm", bi_status_note: "Trong các đơn thuộc kỳ đã chọn.", bi_missing_deadline: "Đơn hàng chưa có hạn giao được xác nhận.",
  bi_order_value: "Giá trị đơn hàng", bi_order_value_note: "Giá khách hàng của đơn hàng, không phải số tiền đã thu.", bi_expenses: "Chi phí đã ghi", bi_recorded_expenses: "Chỉ gồm chi phí đã nhập trong mục Chi phí.", bi_missing_expenses: "Chưa ghi chi phí trong kỳ; điều đó không có nghĩa là không có chi phí.",
  bi_order_profit: "Lợi nhuận đơn hàng", bi_profit_note: "Tính theo giá và phí vận chuyển đã nhập, chưa gồm chi phí chung.", bi_net: "Lợi nhuận ròng", bi_net_missing: "Chưa thể xác minh chi phí đầy đủ và tránh tính trùng.", bi_average: "Giá trị đơn trung bình", bi_average_profit: "Lợi nhuận trung bình mỗi đơn", bi_missing_price: "Nhập giá khách hàng cho mọi đơn thuộc tiền tệ này.", bi_missing_cost: "Nhập giá khách hàng, giá mua và tỷ giá cho mọi đơn.",
  bi_more_metrics: "Dữ liệu còn thiếu", bi_suppliers: "Hiệu quả nhà cung cấp", bi_suppliers_missing: "Cần liên kết dữ liệu về thời hạn và chất lượng.", bi_retention: "Khách hàng quay lại", bi_retention_missing: "Cần quy tắc nhất quán và nhận dạng khách hàng đáng tin cậy.", bi_logistics: "Hiệu quả vận chuyển", bi_logistics_missing: "Cần ngày giao dự kiến và thực tế.",
  cl_links_btn: "Trùng khớp",
  cl_links_title: "Khách hàng trùng khớp",
  cl_links_hint: "Ở đây ứng dụng chỉ gợi ý. Nó không tự gộp ai: bạn quyết định từng cặp một.",
  cl_links_pairs: "Có thể là cùng một người",
  cl_links_none: "Không có trùng khớp.",
  cl_links_r_same_phone: "Cùng số điện thoại.",
  cl_links_r_same_last9: "Chỉ trùng 9 chữ số cuối. Mã quốc gia khác hoặc thiếu: có thể là những người khác nhau.",
  cl_links_r_same_name: "Cùng tên. Không có số điện thoại để so sánh.",
  cl_links_orders: "đơn: {n}",
  cl_links_ops: "giao dịch: {n}",
  cl_links_same: "Cùng một người",
  cl_links_diff: "Hai người khác nhau",
  cl_links_merge_q: "Gộp “{a}” và “{b}”? Đơn hàng và số dư chuyển sang một khách hàng. Liên kết chung của cả hai sẽ bị tắt, sau đó hãy tạo liên kết mới. Không thể hoàn tác.",
  cl_links_merged: "Đã gộp: {o} đơn, {w} dòng số dư. Liên kết chung đã tắt: {l}.",
  cl_links_dismissed: "Đã ẩn cặp này: hai người khác nhau.",
  cl_links_wallet: "Tiền trả trước chưa có chủ",
  cl_links_owner_only: "Chỉ chủ cửa hàng quyết định.",
  cl_links_err_neg: "Như vậy số dư của khách sẽ bị âm.",
  cl_links_wallet_hint: "Số tiền này trước đây nằm dưới một khóa chung của nhiều người. Nó không thuộc số dư của ai nhưng được tính trong phần đối chiếu bên dưới. Hãy chọn khách hàng cho TỪNG giao dịch: ứng dụng không tự chọn. Tiền đã thanh toán một đơn chỉ được gán cho khách của đơn đó.",
  cl_links_pick: "— chọn khách hàng —",
  cl_links_new_opt: "Khách mới “{n}”",
  cl_links_assign: "Gán",
  cl_links_assign_q: "Gán giao dịch {s} ({k}) cho khách “{n}”? Không thể hoàn tác; quyết định sẽ được ghi nhật ký.",
  cl_links_assigned: "Xong: giao dịch đã được gán, tổng khớp.",
  cl_links_err_done: "Giao dịch này đã được phân bổ. Danh sách đã làm mới.",
  cl_links_err_order: "Tiền đã thanh toán một đơn chỉ được gán cho khách của đơn đó.",
  cl_links_recon: "Đối chiếu tiền trả trước",
  cl_links_recon_line: "{c}: tổng {t} · của khách {a} · chưa phân bổ {u} ({k} giao dịch)",
  cl_links_unres_note: "Tiền trả trước chưa phân bổ: {s}. Không nằm trong số dư của khách.",
  cl_links_open: "Xử lý",
  cl_nocard: "Chưa có địa chỉ",
  cl_show_nocard: "Khách chưa có địa chỉ ({n})",
  cl_hide_nocard: "Ẩn khách chưa có địa chỉ",
  cl_edit: "Sửa",
  cl_sum: "Đơn: {n}, đang xử lý: {a}",
  cl_edit_title: "Thông tin khách hàng",
  cl_edit_save: "Lưu",
  cl_edit_hint: "Khách tự điền địa chỉ trên trang đơn hàng của mình.",
  cl_edit_err_name: "Tên: từ 2 đến 120 ký tự.",
  cl_edit_err_phone: "Điện thoại: 9–15 chữ số, có thể bắt đầu bằng +.",
  cl_edit_err_tg: "Telegram: 5–32 ký tự, chữ, số và _.",
  cl_edit_ok: "Đã lưu thông tin khách hàng.",
  nq_title: "Thông báo cho khách",
  nq_hint: "Tin nhắn trạng thái đơn do máy chủ gửi, nên bạn có thể đóng trang sau khi đổi trạng thái. Ở đây thấy tin đang chờ, đã gửi và bị lỗi.",
  nq_open: "Mở nhật ký",
  nq_pending: "Đang chờ: {n}",
  nq_sent: "Đã gửi trong 7 ngày: {n}",
  nq_failed: "Lỗi: {n}",
  nq_modal_hint: "50 tin nhắn gần nhất cho khách. Sau lỗi có thể thử lại: tin quay về cùng hàng đợi và thao tác được ghi vào lịch sử.",
  nq_refresh: "Làm mới",
  nq_none: "Chưa có tin nhắn.",
  nq_s_pending: "đang chờ",
  nq_s_processing: "đang gửi",
  nq_s_sent: "đã gửi",
  nq_s_failed: "lỗi",
  nq_s_skipped: "không gửi",
  nq_next: "lần {n}/{m}, lần tới khoảng {t}",
  nq_retry: "Thử lại",
  nq_retry_q: "Gửi lại tin này cho khách? Nếu tin trước thực ra đã tới, khách sẽ nhận hai lần.",
  nq_retried: "Tin đã quay lại hàng đợi.",
  nq_err_state: "Dòng này không còn ở trạng thái lỗi. Đã làm mới danh sách.",
  nq_history: "Lịch sử",
  nq_e_telegram_400: "Telegram từ chối tin (không thấy cuộc trò chuyện hoặc yêu cầu sai)",
  nq_e_telegram_401_bot_not_configured: "Bot chưa được cấu hình trên máy chủ",
  nq_e_telegram_404_bot_not_configured: "Bot chưa được cấu hình trên máy chủ",
  nq_e_telegram_429: "Telegram yêu cầu chờ",
  nq_e_telegram_500: "Lỗi phía Telegram",
  nq_e_telegram_502: "Lỗi phía Telegram",
  nq_e_telegram_503: "Lỗi phía Telegram",
  nq_e_network_error: "Không kết nối được Telegram",
  nq_e_delivery_unknown: "Không rõ tin đã tới chưa (không có phản hồi)",
  nq_e_delivery_unknown_retry: "Không có phản hồi, sẽ thử lại sau",
  nq_e_max_attempts: "Đã hết số lần thử",
  nq_e_subscription_removed: "Khách đã tắt thông báo hoặc liên kết đơn đã được thay",
  nq_e_subscription_changed: "Đăng ký của khách đã đổi sau sự kiện",
  nq_e_link_revoked: "Liên kết đơn đã bị tắt",
  nq_e_client_blocked_bot: "Khách đã chặn bot",
  nq_e_no_text_for_status: "Trạng thái này không có nội dung",
  nq_a_created: "đã tạo",
  dl_title: "Thời hạn",
  dl_tz: "Giờ của cửa hàng: {z}",
  dl_pay_now: "thanh toán trước {d}",
  dl_none: "chưa đặt hạn thanh toán (không bao giờ quá hạn)",
  dl_pay: "Hạn thanh toán",
  dl_eta_from: "Giao hàng: từ",
  dl_eta_to: "Giao hàng: đến",
  dl_save: "Lưu thời hạn",
  dl_pause: "Tạm dừng nhắc",
  dl_resume: "Tiếp tục nhắc",
  dl_paused: "Nhắc cho đơn này đã tạm dừng từ {d}.",
  dl_paused_ok: "Đã tạm dừng nhắc cho đơn này.",
  dl_resumed_ok: "Đã tiếp tục nhắc.",
  dl_saved: "Đã lưu thời hạn.",
  dl_snooze: "Hoãn 3 ngày",
  dl_snoozed: "Đã hoãn công việc 3 ngày.",
  dl_history: "Lịch sử thời hạn",
  dl_hist_none: "Chưa có thay đổi.",
  dl_f_payment_due_at: "hạn thanh toán",
  dl_f_delivery_eta_from: "giao từ",
  dl_f_delivery_eta_to: "giao đến",
  dl_f_reminders_paused_at: "tạm dừng nhắc",
  dl_err_eta_incomplete: "Nhập cả hai ngày giao hoặc xóa cả hai.",
  dl_err_eta_order: "Ngày “từ” muộn hơn ngày “đến”.",
  dl_h_payment_overdue: "Đơn số {n}: đã quá hạn thanh toán ({d}), còn phải trả {s}. Hãy liên hệ khách về việc thanh toán.",
  dl_h_delivery_soon: "Đơn số {n}: dự kiến giao trước {d}. Hãy kiểm tra mọi thứ đúng kế hoạch.",
  dl_h_delivery_overdue: "Đơn số {n}: đã quá thời gian giao dự kiến ({d}). Hãy hỏi nhà cung cấp hoặc đơn vị vận chuyển. Khách không được nhắn và trạng thái không tự đổi.",
  dl_h_missing_no_price: "Đơn số {n}: đang chờ thanh toán nhưng chưa có giá cho khách. Hãy nhập giá.",
  dl_h_missing_no_weight: "Đơn số {n}: đã ở kho Trung Quốc nhưng chưa có cân nặng. Hãy cân và nhập để tính phí giao.",
  dl_h_missing_no_tracking: "Đơn số {n}: đang vận chuyển nhưng chưa có mã vận đơn. Hãy bổ sung.",
  rm_title: "Nhắc thanh toán",
  rm_hint: "Tự động nhắc khách qua Telegram sau hạn thanh toán. Mặc định TẮT. Chỉ cho đơn có hạn thanh toán và khách đã kết nối Telegram. Không nhắn khách về việc giao chậm.",
  rm_on: "Hiện tại: bật.",
  rm_off: "Hiện tại: tắt.",
  rm_enable: "Bật nhắc tự động",
  rm_from: "Gửi từ (giờ)",
  rm_to: "đến (giờ)",
  rm_grace: "Chờ sau hạn (giờ)",
  rm_gap: "Khoảng cách giữa các lần nhắc (giờ)",
  rm_max: "Tối đa mỗi đơn",
  rm_day: "Tối đa mỗi ngày cho cửa hàng",
  rm_tz: "Múi giờ cửa hàng",
  rm_rules: "Quy tắc: chỉ gửi từ {f}:00 đến {to}:00 giờ {z}; lần đầu sau hạn thanh toán {g} giờ; lần sau cách ít nhất {gap} giờ; tối đa {m} mỗi đơn và {d} mỗi ngày. Dừng sau khi thanh toán, hủy, dời hạn, tạm dừng đơn, tắt tự động, hoặc khi liên kết hay đăng ký của khách bị thu hồi.",
  rm_confirm_on: "Bật nhắc tự động cho khách?\n\n{rules}",
  rm_save: "Lưu quy tắc",
  rm_saved: "Đã lưu quy tắc.",
  rm_err_values: "Kiểm tra giá trị (giờ 0–24, bắt đầu trước kết thúc).",
  rm_err_tz: "Múi giờ không hợp lệ (ví dụ: Asia/Bishkek).",
  dj_never: "Tác vụ máy chủ “{name}” chưa từng chạy: lịch chưa được bật.",
  dj_stale: "Tác vụ máy chủ “{name}” đã dừng: lần chạy cuối {t}.",
  dj_error: "Tác vụ máy chủ “{name}” kết thúc với lỗi (lần chạy cuối {t}).",
  dj_ok: "Tác vụ máy chủ “{name}” đang chạy (lần cuối {t}).",
  dj_name_deadlines_scan: "kiểm soát thời hạn",
  dj_name_fx_autoclose: "tự đóng giao dịch đổi tiền",
  dj_name_order_notify_worker: "gửi thông báo",
  nq_k_payment_reminder: "nhắc thanh toán",
  nq_e_automation_off: "Nhắc tự động đang tắt",
  nq_e_paused: "Nhắc cho đơn đã tạm dừng",
  nq_e_cancelled: "Đơn đã bị hủy",
  nq_e_deadline_changed: "Hạn thanh toán đã đổi",
  nq_e_paid: "Đã thanh toán đủ",
  nq_e_daily_limit: "Đã đạt giới hạn nhắc trong ngày",
  nq_a_claimed: "đã nhận",
  nq_a_sent: "đã gửi",
  nq_a_retry: "thử lại",
  nq_a_failed: "lỗi",
  nq_a_skipped: "bỏ qua",
  nq_a_requeued: "thử lại thủ công",
  nq_a_deferred: "chuyển sang giờ gửi",
  nav_today: "Hôm nay",
  td_title: "Việc cần làm hôm nay",
  td_empty: "Hôm nay không có việc gấp.",
  td_empty_new: "Chưa có đơn hàng. Nhấn “Tạo mới” để thêm đơn đầu tiên.",
  td_more: "Xem thêm {n}",
  td_r_request: "Yêu cầu mới từ khách {name}",
  td_r_no_price: "Đang chờ thanh toán nhưng chưa có giá cho khách",
  td_r_no_weight: "Hàng ở kho Trung Quốc, chưa có cân nặng",
  td_r_no_tracking: "Đơn đang vận chuyển, chưa có mã vận đơn",
  td_r_payment_overdue: "Đã quá hạn thanh toán, còn phải trả {s}",
  td_r_delivery_overdue: "Đã quá hạn giao hàng (dự kiến {d})",
  td_r_delivery_soon: "Sắp đến hạn giao hàng (dự kiến {d})",
  td_btn_calc: "Tính giá",
  td_btn_price: "Nhập giá",
  td_btn_weight: "Nhập cân nặng",
  td_btn_track: "Thêm mã vận đơn",
  td_btn_open: "Mở đơn",
  td_r_nq_failed: "{n} thông báo cho khách chưa gửi được. Khách chưa biết trạng thái đã đổi",
  td_btn_nq: "Xem",
  ca_pay: "Ghi nhận thanh toán",
  ca_next: "Tiếp theo: {s}",
  ca_step: "Bước tiếp theo: {s}",
  ca_left: "Còn phải trả: {s}",
  ca_price_unknown: "Chưa có giá",
  ca_eta: "Giao hàng: {d}",
  ca_eta_none: "Chưa đặt hạn giao hàng",
  ca_details: "Chi tiết",
  mod_shop: "Cửa hàng (trưng bày sản phẩm)",
  mod_fx: "Đổi tiền",
  mod_note: "Tắt sẽ ẩn mục khỏi menu. Dữ liệu và quy tắc không đổi, có thể bật lại bất cứ lúc nào.",
  mod_old: "Mô-đun và múi giờ tạm thời chưa dùng được: cơ sở dữ liệu chưa có bản cập nhật (tệp 55) hoặc mất kết nối. Đơn hàng vẫn hoạt động như cũ. Chế độ đơn giản hiện chỉ được nhớ trên thiết bị này.",
  mod_note_open: "Đổi tiền đã tắt nhưng còn {n} giao dịch hoặc tranh chấp chưa xong. Mục “Đổi tiền” vẫn hiển thị cho đến khi hoàn tất.",
  mod_saved: "Đã lưu",
  tz_title: "Múi giờ của không gian làm việc",
  tz_zone: "Múi giờ (ví dụ Asia/Bishkek)",
  tz_rule: "Hạn thanh toán và giao hàng được nhập và hiển thị theo múi giờ này, giờ gửi nhắc cũng tính theo đó. Khi đổi múi giờ, các hạn đã đặt vẫn là cùng một thời điểm, chỉ cách hiển thị thay đổi.",
  tz_confirm: "Đúng, múi giờ chính xác",
  tz_change: "Lưu múi giờ",
  tz_state_ok: "Múi giờ: {z}. Đã xác nhận ngày {d}.",
  tz_state_new: "Múi giờ: {z}. Bạn chưa xác nhận — hãy kiểm tra rồi nhấn “Đúng, múi giờ chính xác”.",
  tz_saved: "Đã lưu múi giờ",
  tz_err: "Không có múi giờ này hoặc không lưu được.",
  tz_preview: "Hạn của {n} đơn đang xử lý vẫn là cùng thời điểm. Với {d} đơn, ngày theo giờ địa phương sẽ thay đổi.",
  tz_confirm_change: "Đổi múi giờ từ {a} sang {b}?\n\nHạn của {n} đơn đang xử lý vẫn là cùng thời điểm, nhưng với {d} đơn ngày theo giờ địa phương sẽ thay đổi. Đổi múi giờ lại để hoàn tác.",
  f_unsaved: "Có thay đổi chưa lưu. Đóng mà không lưu?",
  f_unsaved_keep: "Tiếp tục chỉnh sửa",
  f_unsaved_drop: "Đóng không lưu",
  f_stage_hint: "Cân nặng và mã vận đơn sẽ hiện khi đơn đến kho Trung Quốc. Các trường khác nằm dưới “Hiện tất cả trường”.",
  f_err_num: "Kiểm tra số trong “{f}”: chỉ nhập chữ số.",
  req_client: "Hãy nhập khách hàng.",
  req_product: "Hãy nhập tên sản phẩm.",
  cp_search: "Tìm khách trong danh sách",
  cp_ph: "Tên, điện thoại hoặc Telegram",
  cp_clear: "Chọn khác",
  cp_chosen: "Khách: {name} ({info})",
  cp_noname: "không tên",
  cp_nophone: "không có điện thoại",
  cp_noaddr: "không có địa chỉ",
  cp_orders: "đơn: {n}",
  cp_none: "Không có khách này. Nhập tên bên dưới — khách sẽ được tạo tự động.",
  cp_last: "đơn gần nhất № {n}",
  cab_nf_title: "Liên kết không hoạt động",
  cab_nf_text: "Liên kết sai hoặc đã bị tắt. Hãy xin người mua liên kết mới.",
  cab_retry: "Thử lại",
  cab_net_err: "Không tải được. Kiểm tra mạng rồi thử lại.",
  cab_unpriced: "Chưa có giá",
  cab_unpriced_note: "Đơn chưa có giá: {n}. Không tính vào số còn phải trả.",
  cab_cancelled: "Đã hủy",
  cab_eta: "Dự kiến giao",
  cab_eta_none: "Chưa có thời hạn",
  cab_next: "Bước tiếp theo",
  ns_unpriced: "Người mua đang tính giá. Chưa cần thanh toán.",
  ns_pay: "Thanh toán phần còn lại: {sum}. Hỏi người mua thông tin thanh toán.",
  ns_addr: "Vui lòng nhập địa chỉ nhận hàng.",
  ns_progress: "Người mua đang xử lý đơn. Bạn không cần làm gì.",
  ns_transit: "Bưu kiện đang vận chuyển. Theo dõi bằng mã vận đơn.",
  ns_transit_notrack: "Bưu kiện đang vận chuyển. Người mua chưa gửi mã vận đơn.",
  ns_arrived: "Đơn đã đến. Hãy hẹn nhận hàng với người mua.",
  ns_done: "Đơn đã hoàn tất.",
  ns_cancelled: "Đơn đã bị hủy.",
  cab_contact_title: "Liên hệ người mua",
  cab_contact_btn: "Liên hệ người mua",
  cab_contact_tg: "Nhắn Telegram",
  cab_contact_set_tg: "Telegram cho khách",
  cab_contact_wa: "WhatsApp",
  cab_contact_call: "Gọi điện",
  cab_contact_none: "Người mua chưa cung cấp liên hệ. Hãy liên hệ như khi đặt hàng.",
  cab_addr_none: "Chưa có địa chỉ",
  cab_addr_ro: "Chỉ người mua mới sửa được địa chỉ — hãy nhắn họ.",
  cab_addr_btn: "Nhập địa chỉ",
  cab_addr_exists: "Địa chỉ đã có. Chỉ người mua mới sửa được.",
  cab_pre_have: "Tiền trả trước: {sum}. Chỉ người mua mới trừ vào đơn này.",
  cab_cancel_paid: "Đã thanh toán: {sum}. Hãy hỏi người mua về khoản này.",
  cab_cost: "Giá trị đơn",
  cab_tg_on: "Thông báo Telegram chỉ bật cho đơn № {n}. Các đơn khác cài riêng.",
  cab_tg_off: "Thông báo Telegram cho đơn № {n} chưa bật. Bật bằng liên kết riêng của đơn — hãy xin người mua.",
  tgc_scope: "Đăng ký này chỉ áp dụng cho đơn № {n}.",
  cab_updating: "Đang tải…",
  cab_card_exists_err: "Địa chỉ đã có — chỉ người mua mới sửa được.",
  dl_proposed: "Địa chỉ đã gửi cho người mua kiểm tra. Khi người mua chưa xác nhận, đây chỉ là đề xuất của bạn.",
  dl_confirmed: "Người mua đã xác nhận địa chỉ này. Chỉ người mua mới sửa được.",
  dl_form_note: "Địa chỉ chỉ áp dụng cho đơn này và sẽ gửi cho người mua kiểm tra. Địa chỉ được xác nhận sau khi người mua kiểm tra.",
  dl_confirmed_err: "Người mua đã xác nhận địa chỉ — chỉ người mua mới sửa được.",
  dl_staff_title: "Địa chỉ do khách nhập",
  dl_staff_proposed: "Đề xuất của khách: chưa kiểm tra. Hãy xác minh với khách rồi xác nhận.",
  dl_staff_confirmed: "Bạn đã xác nhận địa chỉ này.",
  dl_staff_source_link: "Nguồn: liên kết đơn hàng",
  dl_staff_source_cab: "Nguồn: liên kết chung của khách",
  dl_confirm: "Xác nhận địa chỉ",
  dl_reject: "Từ chối",
  dl_done_confirm: "Đã xác nhận địa chỉ",
  dl_done_reject: "Đã từ chối đề xuất",
  cab_contact_set: "Liên hệ cho khách",
  cab_contact_set_hint: "Khách thấy thông tin này trên trang của họ. Để trống = không hiển thị. Số điện thoại hồ sơ không được chia sẻ.",
  cab_contact_phone: "Điện thoại cho khách",
  cab_contact_save: "Lưu liên hệ",
  cab_contact_saved: "Đã lưu liên hệ",
  cab_contact_bad_phone: "Điện thoại: 9–15 chữ số, có thể bắt đầu bằng +.",
  cab_contact_bad_tg: "Telegram: 5–32 ký tự, chữ, số và _.",

  // путь заказа для клиента (js/tracking.js, файл 64)
  tk_path: "Hành trình đơn hàng",
  tk_done: "đã xong",
  tk_current: "hiện tại",
  tk_todo: "sắp tới",
  tk_step_of: "Bước {n}/{total}",
  tk_s_accepted: "Đã nhận yêu cầu",
  tk_s_buying: "Đang mua hàng",
  tk_s_bought: "Đã mua hàng",
  tk_s_cn_warehouse: "Tại kho Trung Quốc",
  tk_s_packing: "Chuẩn bị gửi hàng",
  tk_s_shipped: "Đã gửi từ Trung Quốc",
  tk_s_arrived_dest: "Đã đến nước nhận",
  tk_s_local: "Đang giao nội thành",
  tk_s_ready: "Sẵn sàng nhận hàng",
  tk_s_received: "Khách đã nhận",
  tk_d_accepted: "Chúng tôi đã nhận yêu cầu của bạn và sẽ sớm bắt đầu",
  tk_d_buying: "Người mua hàng đang đặt hàng với nhà cung cấp",
  tk_d_bought: "Hàng đã được mua từ nhà cung cấp",
  tk_d_cn_warehouse: "Hàng đã về kho tại Trung Quốc",
  tk_d_packing: "Đang kiểm tra, cân và đóng gói hàng",
  tk_d_shipped: "Hàng đã rời Trung Quốc và đang trên đường đến bạn",
  tk_d_arrived_dest: "Hàng đã đến nước nhận và đang được xử lý",
  tk_d_local: "Đơn hàng đã được giao cho đơn vị giao nội thành",
  tk_d_ready: "Đơn hàng sẵn sàng để nhận",
  tk_d_received: "Cảm ơn bạn! Đơn hàng đã được nhận",
  tk_late: "Thời gian giao hàng bị kéo dài. Chúng tôi đang hỏi lại đơn vị vận chuyển",
  tk_route: "Lộ trình",
  tk_route_local: "Giao nội thành",
  tk_route_aria: "Sơ đồ lộ trình: {a} → {b}",
  tk_from_cn: "Trung Quốc",
  tk_to_door: "Địa chỉ hoặc điểm nhận",
  tk_days_label: "Đang vận chuyển",
  tk_days_one: "{n} ngày",
  tk_days_few: "{n} ngày",
  tk_days_many: "{n} ngày",
  tk_days_other: "{n} ngày",
  tk_usual_label: "Thời gian giao thường là",
  tk_usual: "{a}–{b} ngày",
  tk_eta_label: "Dự kiến đến",
  tk_shipped_label: "Ngày gửi",
  tk_approx: "Tiến độ chỉ mang tính ước tính, phụ thuộc vào đơn vị vận chuyển và hải quan",
  tk_h_stage: "Đã cập nhật bước cho khách",
  tk_h_buyer: "Ghi chú của người mua hàng",
  tk_b_title: "Hành trình đơn hàng cho khách",
  tk_b_hint: "Khách xem bước, thời gian và ghi chú qua liên kết của mình. Đổi bước không gửi tin nhắn nào.",
  tk_b_stage: "Bước",
  tk_b_status_change: "Trạng thái đơn sẽ đổi thành “{s}”. Nếu khách theo dõi đơn này qua Telegram, họ sẽ nhận tin báo trạng thái như thường lệ.",
  tk_b_ship: "Vận chuyển",
  tk_b_shipped: "Ngày gửi từ Trung Quốc",
  tk_b_min: "Từ, ngày",
  tk_b_max: "Đến, ngày",
  tk_b_track: "Mã vận đơn",
  tk_b_comment: "Ghi chú công khai cho khách",
  tk_b_comment_hint: "Khách nhìn thấy và ghi chú được lưu vào lịch sử đơn. Đừng viết ghi chú nội bộ ở đây.",
  tk_b_save: "Lưu hành trình đơn",
  tk_b_saved: "Đã lưu hành trình đơn",
  tk_b_history: "Lịch sử các bước",
  tk_e_days: "Số ngày phải từ 1 đến 180.",
  tk_e_both: "Điền cả “từ” và “đến”, hoặc để trống cả hai.",
  tk_e_order: "“Từ” không được lớn hơn “đến”.",
  tk_e_date: "Kiểm tra ngày gửi: không được là ngày trong tương lai.",
  // карта маршрута Китай → Бишкек (js/tracking.js)
  tk_g_wh: "Kho ở Trung Quốc",
  tk_g_kg: "Kyrgyzstan",
  tk_g_kz: "Kazakhstan",
  tk_c_bishkek: "Bishkek",
  tk_bd_kg: "Biên giới",
  // срок доставки: Настройки и продление (js/tracking.js, файл 65)
  tk_def_title: "Thời gian giao hàng cho khách",
  tk_def_hint: "Khách thấy thời gian này ở mọi đơn chưa đặt thời gian riêng. Để trống là “10–20 ngày”.",
  tk_def_save: "Lưu thời gian giao",
  tk_def_saved: "Đã lưu thời gian giao",
  tk_ext_label: "Gia hạn:",
  tk_ext_btn: "+{n} ngày",
  tk_ext_done: "Đã gia hạn: tối đa {n} ngày",
  tk_ext_eta: "Thời gian được đặt bằng ngày trong mục “Thời hạn” — hãy đổi ngày ở đó.",
};

I18N.vi.wa_title = "Tin nhắn";

I18N.vi.wa_connect_title = "WhatsApp cho khách hàng của bạn";
I18N.vi.wa_connect_hint = "Quét mã QR để kết nối số của bạn: tin nhắn, đơn hàng và thông báo trong không gian làm việc.";
I18N.vi.wa_connect_button = "Kết nối WhatsApp";

// Раздел «Команда» (файлы 67–68)
I18N.vi.nav_team = "Nhóm";
I18N.vi.tw_page_hint = "Công việc, nhân viên, phòng ban và quyền";
I18N.vi.tw_invite_btn = "+ Mời";
I18N.vi.tw_access_revoked = "Chủ không gian làm việc đã tắt quyền truy cập của bạn. Lịch sử công việc vẫn được lưu. Nếu có nhầm lẫn, hãy liên hệ chủ sở hữu.";
I18N.vi.tw_e_forbidden = "Bạn không có quyền thực hiện thao tác này";
I18N.vi.tw_e_role = "Chỉ chủ sở hữu mới có thể cấp vai trò này";
I18N.vi.tw_e_dup = "Đã có phòng ban trùng tên";
I18N.vi.tw_e_cycle = "Không được: cấu trúc sẽ bị vòng lặp";
I18N.vi.tw_e_role_used = "Vai trò đang được dùng. Hãy đổi vai trò cho nhân viên và lời mời trước";
I18N.vi.tw_e_system_role = "Không thể xóa vai trò có sẵn, nhưng có thể sửa";
I18N.vi.tw_e_self = "Bạn không thể tự tắt chính mình";
I18N.vi.tw_e_elsewhere = "Người này đang làm việc ở không gian khác";
I18N.vi.tw_e_checklist = "Hãy đánh dấu tất cả mục trong danh sách trước";
I18N.vi.tw_e_note = "Vui lòng ghi lý do";
I18N.vi.tw_e_no_reviewer = "Hãy chỉ định người duyệt trước";
I18N.vi.tw_e_review_required = "Công việc này có người duyệt: hãy gửi để duyệt";
I18N.vi.tw_e_reviewer = "Người duyệt phải khác người thực hiện";
I18N.vi.tw_e_assignee = "Chỉ nhân viên đang hoạt động mới được giao việc";
I18N.vi.tw_e_closed = "Công việc đã đóng. Hãy mở lại trước";
I18N.vi.tw_e_locked = "Không thể sửa danh sách khi công việc đang chờ duyệt hoặc đã đóng";
I18N.vi.tw_e_not_found = "Không tìm thấy công việc hoặc bạn không có quyền truy cập";
I18N.vi.tw_e_name = "Hãy nhập tên";
I18N.vi.tw_e_items = "Quá nhiều mục (tối đa 50)";
I18N.vi.tw_role_manager = "Quản lý vận hành";
I18N.vi.tw_role_sourcing = "Thu mua";
I18N.vi.tw_role_qc = "Kiểm tra chất lượng";
I18N.vi.tw_role_logistics = "Hậu cần";
I18N.vi.tw_role_assistant = "Trợ lý";
I18N.vi.tw_nobody = "chưa chỉ định";
I18N.vi.tw_no_name = "Chưa có tên";
I18N.vi.tw_former = "Cựu nhân viên";
I18N.vi.tw_you = "bạn";
I18N.vi.tw_reports_to = "Quản lý: {n}";
I18N.vi.tw_my_rights = "Quyền của tôi:";
I18N.vi.tw_perm_none = "chỉ công việc của mình";
I18N.vi.tw_perm_team_manage = "Quản lý nhóm";
I18N.vi.tw_perm_team_manage_d = "Mời nhân viên, đặt phòng ban, chức danh và vai trò, tắt nhân viên, quản lý phòng ban";
I18N.vi.tw_perm_tasks_create = "Giao việc cho người khác";
I18N.vi.tw_perm_tasks_create_d = "Không có quyền này thì chỉ tạo việc cho chính mình";
I18N.vi.tw_perm_tasks_view_all = "Xem mọi công việc";
I18N.vi.tw_perm_tasks_view_all_d = "Nếu không, chỉ thấy việc của mình, việc mình giao và việc của cấp dưới";
I18N.vi.tw_perm_tasks_manage = "Quản lý mọi công việc";
I18N.vi.tw_perm_tasks_manage_d = "Sửa, giao lại và hủy việc của người khác";
I18N.vi.tw_perm_tasks_review = "Duyệt công việc";
I18N.vi.tw_perm_tasks_review_d = "Duyệt hoặc trả lại mọi việc đã nộp (trừ việc của mình)";
I18N.vi.tw_overdue_n = "Việc quá hạn: {n}";
I18N.vi.tw_v_mine = "Của tôi";
I18N.vi.tw_v_review = "Cần duyệt";
I18N.vi.tw_v_created = "Tôi đã giao";
I18N.vi.tw_v_all = "Tất cả công việc";
I18N.vi.tw_v_notif = "Thông báo";
I18N.vi.tw_v_people = "Nhân viên";
I18N.vi.tw_v_depts = "Phòng ban";
I18N.vi.tw_v_roles = "Vai trò";
I18N.vi.tw_v_audit = "Nhật ký";
I18N.vi.tw_edit = "Sửa";
I18N.vi.tw_deactivate = "Tắt";
I18N.vi.tw_reactivate = "Bật lại";
I18N.vi.tw_delete = "Xóa";
I18N.vi.tw_off_since = "Đã tắt từ {d}";
I18N.vi.tw_invite_link = "Liên kết mời";
I18N.vi.tw_inactive = "Nhân viên đã tắt";
I18N.vi.tw_limit = "Thành viên: {n}/{max}. Người đã tắt không tính.";
I18N.vi.tw_no_dept = "Không có phòng ban";
I18N.vi.tw_invite_title = "Mời nhân viên";
I18N.vi.tw_invite_hint = "Liên kết dùng được 3 ngày và chỉ cho một người. Nhân viên đăng nhập bằng mật khẩu riêng và nhận ngay vai trò, phòng ban.";
I18N.vi.tw_f_name = "Mời ai";
I18N.vi.tw_f_name_hint = "Ghi tên để không nhầm lời mời";
I18N.vi.tw_f_role = "Vai trò";
I18N.vi.tw_f_dept = "Phòng ban";
I18N.vi.tw_f_title = "Chức danh";
I18N.vi.tw_invite_create = "Tạo liên kết";
I18N.vi.tw_edit_title = "Nhân viên: {n}";
I18N.vi.tw_no_manager = "Không có quản lý";
I18N.vi.tw_f_manager = "Quản lý (báo cáo cho ai)";
I18N.vi.tw_off_title = "Tắt: {n}";
I18N.vi.tw_off_hint = "Quyền truy cập sẽ mất ngay. Đơn hàng, bình luận và lịch sử công việc vẫn được giữ. Có thể bật lại bất cứ lúc nào.";
I18N.vi.tw_f_handover = "Giao việc chưa xong cho";
I18N.vi.tw_leave_unassigned = "Để chưa giao";
I18N.vi.tw_f_handover_hint = "Việc \"đang làm\" sẽ thành \"mới\" cho người nhận. Việc duyệt cũng chuyển sang người đó.";
I18N.vi.tw_f_note = "Lý do (chỉ quản lý thấy)";
I18N.vi.tw_off_done = "Đã tắt nhân viên. Số việc đã giao lại: {n}";
I18N.vi.tw_on_confirm = "Bật lại {n}? Quyền truy cập sẽ được khôi phục.";
I18N.vi.tw_on_done = "Nhân viên đã trở lại nhóm";
I18N.vi.tw_dept_head = "Trưởng phòng: {n}";
I18N.vi.tw_people_n = "số người: {n}";
I18N.vi.tw_dept_add = "Thêm phòng ban";
I18N.vi.tw_dept_edit = "Phòng ban";
I18N.vi.tw_dept_empty = "Chưa có phòng ban. Phòng ban cho biết ai phụ trách việc gì.";
I18N.vi.tw_no_dept_people = "Không có phòng ban: {n}";
I18N.vi.tw_f_dept_name = "Tên";
I18N.vi.tw_f_parent = "Thuộc phòng ban";
I18N.vi.tw_f_head = "Trưởng phòng";
I18N.vi.tw_dept_del_confirm = "Xóa phòng ban \"{n}\"? Nhân viên vẫn còn nhưng không có phòng ban.";
I18N.vi.tw_role_add = "Vai trò mới";
I18N.vi.tw_role_edit = "Vai trò";
I18N.vi.tw_roles_hint_owner = "Vai trò là tập hợp quyền. Cơ sở dữ liệu kiểm tra quyền: không có quyền thì thao tác sẽ không thực hiện được.";
I18N.vi.tw_roles_hint = "Vai trò là tập hợp quyền. Chỉ chủ sở hữu được sửa vai trò.";
I18N.vi.tw_role_system = "có sẵn";
I18N.vi.tw_roles_orders_note = "Quyền với đơn hàng tạm thời giữ nguyên: nhân viên làm việc với đơn của không gian nhưng không xóa đơn và không đổi cài đặt. Quyền theo từng đơn là giai đoạn tiếp theo.";
I18N.vi.tw_f_role_name = "Tên vai trò";
I18N.vi.tw_f_perms = "Quyền";
I18N.vi.tw_role_del_confirm = "Xóa vai trò \"{n}\"?";
I18N.vi.tw_moved_n = "đã giao lại {n} việc";
I18N.vi.tw_a_invite_create = "{who}: lời mời mới {x}";
I18N.vi.tw_a_invite_revoke = "{who}: đã hủy lời mời";
I18N.vi.tw_a_member_join = "{whom}: đã nhận lời mời ({x})";
I18N.vi.tw_a_member_rejoin = "{whom}: trở lại nhóm ({x})";
I18N.vi.tw_a_member_update = "{who}: đã sửa thông tin của {whom}";
I18N.vi.tw_a_member_deactivate = "{who}: đã tắt {whom}, {x}";
I18N.vi.tw_a_member_reactivate = "{who}: đã bật lại {whom}";
I18N.vi.tw_a_member_reassign = "{who}: đã giao lại việc của {whom}";
I18N.vi.tw_a_department_create = "{who}: phòng ban mới \"{x}\"";
I18N.vi.tw_a_department_update = "{who}: đã sửa phòng ban \"{x}\"";
I18N.vi.tw_a_department_delete = "{who}: đã xóa phòng ban \"{x}\"";
I18N.vi.tw_a_role_create = "{who}: vai trò mới \"{x}\"";
I18N.vi.tw_a_role_update = "{who}: đã sửa vai trò \"{x}\"";
I18N.vi.tw_a_role_delete = "{who}: đã xóa vai trò \"{x}\"";
I18N.vi.tw_audit_empty = "Chưa có mục nào";
I18N.vi.tw_n_assigned = "Việc mới cho bạn: CV-{n} \"{x}\" (từ {who})";
I18N.vi.tw_n_unassigned = "Việc CV-{n} \"{x}\" đã giao cho người khác ({who})";
I18N.vi.tw_n_reviewer = "Bạn duyệt CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_submitted = "Đã nộp để duyệt: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_approved = "Đã duyệt: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_rejected = "Trả lại để làm lại: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_blocked = "Bị vướng: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_done = "Hoàn thành: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_cancelled = "Đã hủy: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_reopened = "Mở lại: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_comment = "Bình luận ở CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_updated = "Đã sửa: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_n_handover = "Việc được giao lại cho bạn: CV-{n} \"{x}\" ({who})";
I18N.vi.tw_read_all = "Đánh dấu đã đọc tất cả";
I18N.vi.tw_notif_empty = "Chưa có thông báo";
I18N.vi.tw_task_no = "CV-{n}";
I18N.vi.tw_st_todo = "Mới";
I18N.vi.tw_st_in_progress = "Đang làm";
I18N.vi.tw_st_blocked = "Bị vướng";
I18N.vi.tw_st_submitted = "Chờ duyệt";
I18N.vi.tw_st_done = "Hoàn thành";
I18N.vi.tw_st_cancelled = "Đã hủy";
I18N.vi.tw_pr_low = "Thấp";
I18N.vi.tw_pr_normal = "Bình thường";
I18N.vi.tw_pr_high = "Cao";
I18N.vi.tw_pr_urgent = "Khẩn cấp";
I18N.vi.tw_due = "hạn {d}";
I18N.vi.tw_due_over = "quá hạn: {d}";
I18N.vi.tw_unassigned = "Chưa giao";
I18N.vi.tw_items_n = "{a}/{b}";
I18N.vi.tw_comments_n = "bình luận: {n}";
I18N.vi.tw_empty_mine = "Không có việc cho bạn.";
I18N.vi.tw_empty_review = "Không có việc cần duyệt.";
I18N.vi.tw_empty_created = "Bạn chưa giao việc nào.";
I18N.vi.tw_empty_all = "Chưa có công việc.";
I18N.vi.tw_task_new = "Việc mới";
I18N.vi.tw_closed_n = "Đã đóng trong 30 ngày: {n}";
I18N.vi.tw_act_start = "Bắt đầu";
I18N.vi.tw_act_resume = "Tiếp tục";
I18N.vi.tw_act_submit = "Gửi duyệt";
I18N.vi.tw_act_done = "Hoàn thành";
I18N.vi.tw_act_block = "Báo vướng mắc";
I18N.vi.tw_act_withdraw = "Rút lại";
I18N.vi.tw_act_approve = "Duyệt";
I18N.vi.tw_act_reject = "Trả lại để làm lại";
I18N.vi.tw_act_edit = "Sửa";
I18N.vi.tw_act_cancel = "Hủy việc";
I18N.vi.tw_act_restore = "Khôi phục";
I18N.vi.tw_act_reopen = "Mở lại";
I18N.vi.tw_f_assignee = "Người thực hiện";
I18N.vi.tw_f_reviewer = "Người duyệt";
I18N.vi.tw_no_review = "Không cần duyệt";
I18N.vi.tw_f_due = "Hạn";
I18N.vi.tw_f_author = "Người giao";
I18N.vi.tw_checklist = "Danh sách kiểm tra";
I18N.vi.tw_item_add = "Mục mới";
I18N.vi.tw_add = "Thêm";
I18N.vi.tw_items_first = "Để nộp việc, hãy đánh dấu mọi mục trong danh sách.";
I18N.vi.tw_confirm = "Xác nhận";
I18N.vi.tw_reason = "Lý do (bắt buộc)";
I18N.vi.tw_reason_opt = "Lý do (không bắt buộc)";
I18N.vi.tw_comments = "Bình luận";
I18N.vi.tw_no_comments = "Chưa có bình luận";
I18N.vi.tw_comment_ph = "Viết bình luận…";
I18N.vi.tw_send = "Gửi";
I18N.vi.tw_internal_note = "Chỉ nhóm thấy công việc và bình luận. Khách hàng có liên kết không thấy.";
I18N.vi.tw_history = "Lịch sử";
I18N.vi.tw_ev_created = "{who}: đã tạo việc";
I18N.vi.tw_ev_status = "{who}: {a} → {b}";
I18N.vi.tw_ev_approved = "{who}: đã duyệt";
I18N.vi.tw_ev_rejected = "{who}: trả lại để làm lại";
I18N.vi.tw_ev_assigned = "{who}: người thực hiện — {n}";
I18N.vi.tw_ev_reviewer = "{who}: người duyệt — {n}";
I18N.vi.tw_ev_handover = "Giao lại: người thực hiện {a} → {b}";
I18N.vi.tw_ev_handover_r = "Giao lại: người duyệt {a} → {b}";
I18N.vi.tw_ev_edited = "{who}: đã sửa thông tin việc";
I18N.vi.tw_ev_item_added = "{who}: thêm mục \"{x}\"";
I18N.vi.tw_ev_item_checked = "{who}: đã đánh dấu \"{x}\"";
I18N.vi.tw_ev_item_unchecked = "{who}: bỏ đánh dấu \"{x}\"";
I18N.vi.tw_ev_item_removed = "{who}: đã xóa mục \"{x}\"";
I18N.vi.tw_saved_status = "Xong";
I18N.vi.tw_task_edit = "Công việc";
I18N.vi.tw_task_create = "Giao việc";
I18N.vi.tw_task_created = "Đã giao việc";
I18N.vi.tw_f_task_title = "Cần làm gì";
I18N.vi.tw_f_desc = "Chi tiết";
I18N.vi.tw_f_priority = "Mức ưu tiên";
I18N.vi.tw_f_items_hint = "Mỗi dòng một mục";
I18N.vi.tw_only_self = "Vai trò của bạn chỉ cho phép tạo việc cho chính mình.";
I18N.vi.tw_perm_orders_all = "Mọi đơn hàng của không gian";
I18N.vi.tw_perm_orders_all_d = "Xem và quản lý mọi đơn hàng, khách hàng và tiền. Không có quyền này thì chỉ thấy đơn được giao và các trường theo nhiệm vụ";
I18N.vi.tw_perm_orders_assign = "Phân công người cho đơn hàng";
I18N.vi.tw_perm_orders_assign_d = "Người phụ trách và nhóm của đơn, mẫu giai đoạn, tổng hợp chậm trễ";
I18N.vi.tw_roles_orders_note69 = "Không có quyền \"Mọi đơn hàng của không gian\", nhân viên chỉ thấy đơn được giao và các trường theo nhiệm vụ: giá cho khách, thanh toán và lợi nhuận không bao giờ hiển thị.";
I18N.vi.tw_a_template_save = "{who}: đã lưu mẫu \"{x}\"";
I18N.vi.tw_a_template_delete = "{who}: đã xóa mẫu \"{x}\"";
I18N.vi.to_v_orders = "Đơn của tôi";
I18N.vi.to_v_attention = "Cần chú ý";
I18N.vi.to_v_templates = "Mẫu giai đoạn";
I18N.vi.to_duty_lead = "Người phụ trách đơn";
I18N.vi.to_duty_sourcing = "Thu mua";
I18N.vi.to_duty_qc = "Kiểm tra chất lượng";
I18N.vi.to_duty_logistics = "Hậu cần";
I18N.vi.to_duty_support = "Hỗ trợ";
I18N.vi.to_duty_none = "Không có nhiệm vụ";
I18N.vi.to_state_on_track = "Đúng tiến độ";
I18N.vi.to_state_at_risk = "Có rủi ro";
I18N.vi.to_state_delayed = "Chậm trễ";
I18N.vi.to_ms_pending = "Chờ";
I18N.vi.to_ms_in_progress = "Đang làm";
I18N.vi.to_ms_done = "Xong";
I18N.vi.to_ms_delayed = "Bị chậm";
I18N.vi.to_ms_skipped = "Bỏ qua";
I18N.vi.to_lead_n = "Phụ trách: {n}";
I18N.vi.to_no_lead = "Chưa có người phụ trách";
I18N.vi.to_next = "Tiếp theo: {x} trước {d}";
I18N.vi.to_delays_n = "Chậm trễ: {n}";
I18N.vi.to_mine_hint = "Đơn hàng mà bạn ở trong nhóm. Chỉ hiển thị dữ liệu bạn cần.";
I18N.vi.to_attention_hint = "Đơn có chậm trễ chưa xử lý hoặc giai đoạn quá hạn.";
I18N.vi.to_empty_mine = "Bạn chưa được giao đơn hàng nào.";
I18N.vi.to_empty_attention = "Mọi đơn hàng đều đúng tiến độ.";
I18N.vi.to_my_duties = "Nhiệm vụ của tôi: {x}";
I18N.vi.to_f_product = "Sản phẩm";
I18N.vi.to_f_qty = "Số lượng";
I18N.vi.to_f_date = "Ngày đặt";
I18N.vi.to_f_eta = "Dự kiến giao";
I18N.vi.to_f_ship_to = "Nơi đến";
I18N.vi.to_f_client = "Khách hàng";
I18N.vi.to_f_supplier = "Nhà cung cấp";
I18N.vi.to_link = "liên kết";
I18N.vi.to_f_price = "Giá mua mỗi chiếc";
I18N.vi.to_f_track = "Mã vận đơn";
I18N.vi.to_f_dest = "Giao cho khách";
I18N.vi.to_f_order = "Đơn hàng";
I18N.vi.to_edit_fields = "Sửa thông tin";
I18N.vi.to_scoped_note = "Bạn thấy các trường theo nhiệm vụ. Giá cho khách, thanh toán và lợi nhuận bị ẩn.";
I18N.vi.to_team = "Nhóm của đơn";
I18N.vi.to_team_empty = "Chưa ai được giao đơn này.";
I18N.vi.to_assign = "Giao cho đơn";
I18N.vi.to_milestones = "Giai đoạn";
I18N.vi.to_ms_start = "Bắt đầu";
I18N.vi.to_ms_finish = "Hoàn thành";
I18N.vi.to_ms_undo = "Mở lại";
I18N.vi.to_ms_skip = "Bỏ qua";
I18N.vi.to_report_delay = "Báo chậm trễ";
I18N.vi.to_ms_empty = "Chưa có giai đoạn.";
I18N.vi.to_tpl_apply = "Thêm giai đoạn từ mẫu";
I18N.vi.to_tpl_replace = "Thay bằng mẫu";
I18N.vi.to_ms_add = "Giai đoạn";
I18N.vi.to_delay_open = "Chậm trễ đang mở";
I18N.vi.to_delay_closed = "Đã xử lý";
I18N.vi.to_cat_supplier = "Nhà cung cấp";
I18N.vi.to_cat_quality = "Chất lượng";
I18N.vi.to_cat_logistics = "Hậu cần";
I18N.vi.to_cat_customs = "Hải quan";
I18N.vi.to_cat_client = "Khách hàng";
I18N.vi.to_cat_other = "Khác";
I18N.vi.to_new_due = "hạn {a} → {b}";
I18N.vi.to_actions = "Hành động khắc phục:";
I18N.vi.to_resolution = "Kết quả: {x}";
I18N.vi.to_action_add = "Hành động khắc phục";
I18N.vi.to_resolve = "Đóng chậm trễ";
I18N.vi.to_delays = "Chậm trễ";
I18N.vi.to_delays_none = "Không có chậm trễ.";
I18N.vi.to_internal_note = "Giai đoạn, chậm trễ và nhóm là dữ liệu nội bộ. Khách có liên kết không thấy.";
I18N.vi.to_ev_team_add = "{who}: {n} — {d}";
I18N.vi.to_ev_team_remove = "{who}: đã gỡ {n} ({d})";
I18N.vi.to_ev_handover = "Giao lại: {a} → {b} ({d})";
I18N.vi.to_ev_template = "{who}: giai đoạn từ mẫu \"{x}\"";
I18N.vi.to_ev_ms_add = "{who}: giai đoạn mới \"{x}\"";
I18N.vi.to_ev_ms_edit = "{who}: đã sửa giai đoạn \"{x}\"";
I18N.vi.to_ev_ms_delete = "{who}: đã xóa giai đoạn \"{x}\"";
I18N.vi.to_ev_ms_status = "{who}: \"{x}\" — {s}";
I18N.vi.to_ev_fields = "{who}: đã sửa — {x}";
I18N.vi.to_ev_delay = "{who}: chậm trễ ({x})";
I18N.vi.to_ev_action = "{who}: hành động \"{x}\"";
I18N.vi.to_ev_resolve = "{who}: đã đóng chậm trễ";
I18N.vi.to_fld_supplier = "Nhà cung cấp";
I18N.vi.to_fld_supplier_link = "Liên kết sản phẩm của nhà cung cấp";
I18N.vi.to_fld_supplier_wechat = "WeChat nhà cung cấp";
I18N.vi.to_fld_tracking_number = "Mã vận đơn";
I18N.vi.to_fields_hint = "Giá, cân nặng và trạng thái đơn do người có quyền với mọi đơn thay đổi.";
I18N.vi.to_f_person = "Nhân viên";
I18N.vi.to_f_duty = "Nhiệm vụ";
I18N.vi.to_assign_hint = "Mỗi đơn chỉ có một người phụ trách: người mới thay người cũ. Người được giao sẽ nhận thông báo.";
I18N.vi.to_ms_edit = "Giai đoạn";
I18N.vi.to_f_ms_title = "Tên giai đoạn";
I18N.vi.to_ms_delete = "Xóa giai đoạn";
I18N.vi.to_f_template = "Mẫu";
I18N.vi.to_tpl_hint = "Ngày của giai đoạn tính từ hôm nay.";
I18N.vi.to_tpl_replace_hint = "Giai đoạn chưa xong sẽ được thay, giai đoạn đã xong vẫn giữ.";
I18N.vi.to_delay_hint = "Giai đoạn sẽ chuyển \"bị chậm\", người phụ trách và chủ sở hữu được thông báo. Không gửi gì cho khách.";
I18N.vi.to_f_milestone = "Giai đoạn";
I18N.vi.to_whole_order = "Cả đơn hàng";
I18N.vi.to_f_category = "Nguyên nhân";
I18N.vi.to_f_reason = "Chuyện gì đã xảy ra";
I18N.vi.to_f_new_due = "Ngày mới của giai đoạn";
I18N.vi.to_f_shift = "Dời các giai đoạn sau tương ứng";
I18N.vi.to_delay_saved = "Đã ghi chậm trễ, đã thông báo người phụ trách";
I18N.vi.to_f_action = "Cần làm gì";
I18N.vi.to_action_hint = "Hành động sẽ thành việc của nhóm gắn với đơn.";
I18N.vi.to_f_resolution = "Đã xử lý thế nào";
I18N.vi.to_resolved = "Đã đóng chậm trễ";
I18N.vi.to_tpl_new = "Mẫu mới";
I18N.vi.to_tpl_edit = "Mẫu";
I18N.vi.to_tpl_page_hint = "Mẫu là danh sách giai đoạn có sẵn với nhiệm vụ và hạn tính theo ngày từ khi bắt đầu.";
I18N.vi.to_day_n = "ngày {n}";
I18N.vi.to_f_days = "Số ngày từ đầu";
I18N.vi.to_tpl_steps_hint = "Giai đoạn · nhiệm vụ · số ngày từ đầu";
I18N.vi.to_step_add = "Bước";
I18N.vi.to_e_steps = "Cần tên và ít nhất một bước";
I18N.vi.to_tpl_del_confirm = "Xóa mẫu \"{n}\"? Giai đoạn trong đơn vẫn giữ.";
I18N.vi.to_detail_title = "Nhóm và giai đoạn";
I18N.vi.to_detail_hint = "Ai phụ trách, giai đoạn, chậm trễ";
I18N.vi.to_detail_open = "Mở";
I18N.vi.to_unassign_confirm = "Gỡ người này khỏi nhiệm vụ của đơn?";
I18N.vi.to_ms_del_confirm = "Xóa giai đoạn này?";
I18N.vi.to_n_assigned = "Bạn được giao đơn {x} ({who})";
I18N.vi.to_n_unassigned = "Bạn đã bị gỡ khỏi đơn {x} ({who})";
I18N.vi.to_n_delay = "Chậm trễ ở đơn {x} ({who})";
I18N.vi.to_n_resolved = "Đã đóng chậm trễ ở đơn {x} ({who})";
I18N.vi.to_e_not_found = "Không tìm thấy đơn hoặc bạn không được giao";
I18N.vi.to_e_ms_exist = "Đơn đã có giai đoạn";
I18N.vi.to_e_delay_open = "Hãy đóng chậm trễ của giai đoạn này trước";
I18N.vi.to_e_closed = "Đơn đã đóng";
I18N.vi.to_e_category = "Hãy chọn nguyên nhân";
I18N.vi.to_e_delay_closed = "Chậm trễ đã đóng";
I18N.vi.to_e_ms_closed = "Giai đoạn đã xong hoặc đã bỏ qua";
I18N.vi.tw_g_tasks = "Công việc";
I18N.vi.tw_g_orders = "Đơn hàng";
I18N.vi.tw_g_ops = "Vận hành";
I18N.vi.tw_g_people = "Nhân sự";
I18N.vi.tw_g_reports = "Báo cáo";
I18N.vi.tw_perm_ops_manage = "Điều hành vận hành";
I18N.vi.tw_perm_ops_manage_d = "Quy trình và sự cố: giao người phụ trách, đóng, sửa sự kiện lịch";
I18N.vi.tw_perm_reports_view = "Xem phân tích nhóm";
I18N.vi.tw_perm_reports_view_d = "Chỉ số của mọi người và tổng của nhóm. Không có quyền này thì chỉ thấy chỉ số của mình";
I18N.vi.tw_a_sop_save = "{who}: đã lưu quy trình \"{x}\"";
I18N.vi.op_v_dashboard = "Tổng quan";
I18N.vi.op_v_incidents = "Sự cố";
I18N.vi.op_v_calendar = "Lịch";
I18N.vi.op_v_sops = "Quy trình";
I18N.vi.op_v_analytics = "Phân tích";
I18N.vi.op_dash_hint = "Những việc cần chú ý ngay. Nhấn vào số để mở danh sách.";
I18N.vi.op_dash_orders = "Đơn hàng";
I18N.vi.op_dash_tasks = "Công việc";
I18N.vi.op_dash_incidents = "Sự cố và quy trình";
I18N.vi.op_dash_workload = "Khối lượng công việc";
I18N.vi.op_d_open = "đang mở";
I18N.vi.op_d_no_lead = "chưa có người phụ trách";
I18N.vi.op_d_ms_overdue = "giai đoạn quá hạn";
I18N.vi.op_d_ms_week = "giai đoạn trong 7 ngày";
I18N.vi.op_d_delays_by = "Chậm trễ đang mở: {n}. Nguyên nhân:";
I18N.vi.op_d_overdue = "quá hạn";
I18N.vi.op_d_done_week = "xong trong 7 ngày";
I18N.vi.op_d_inc_open = "sự cố đang mở";
I18N.vi.op_d_sops = "quy trình";
I18N.vi.op_d_sops_unread = "chưa đọc (người × quy trình)";
I18N.vi.op_w_open = "việc";
I18N.vi.op_inc_new = "Báo sự cố";
I18N.vi.op_inc_report = "Báo";
I18N.vi.op_inc_hint = "Sự cố là vấn đề cần xử lý: hàng lỗi, thất lạc, vi phạm. Người phụ trách sẽ được thông báo.";
I18N.vi.op_inc_saved = "Đã ghi sự cố";
I18N.vi.op_inc_no = "SC-{n}";
I18N.vi.op_inc_show_all = "Hiện tất cả (6 tháng)";
I18N.vi.op_inc_show_open = "Chỉ đang mở";
I18N.vi.op_inc_empty = "Không có sự cố đang mở.";
I18N.vi.op_inc_empty_all = "Không có sự cố.";
I18N.vi.op_owner_n = "Phụ trách: {n}";
I18N.vi.op_no_owner = "Chưa có người phụ trách";
I18N.vi.op_no_order = "Không gắn đơn";
I18N.vi.op_actions_open = "hành động đang mở: {n}";
I18N.vi.op_f_inc_title = "Chuyện gì xảy ra";
I18N.vi.op_f_inc_desc = "Chi tiết";
I18N.vi.op_f_severity = "Mức độ";
I18N.vi.op_f_owner = "Người phụ trách";
I18N.vi.op_f_reporter = "Người báo";
I18N.vi.op_f_root = "Nguyên nhân gốc:";
I18N.vi.op_f_resolution = "Cách xử lý:";
I18N.vi.op_sev_low = "Thấp";
I18N.vi.op_sev_medium = "Trung bình";
I18N.vi.op_sev_high = "Cao";
I18N.vi.op_sev_critical = "Nghiêm trọng";
I18N.vi.op_ist_open = "Mở";
I18N.vi.op_ist_investigating = "Đang xử lý";
I18N.vi.op_ist_resolved = "Đã giải quyết";
I18N.vi.op_ist_closed = "Đã đóng";
I18N.vi.op_cat_supplier = "Nhà cung cấp";
I18N.vi.op_cat_quality = "Chất lượng";
I18N.vi.op_cat_logistics = "Hậu cần";
I18N.vi.op_cat_customs = "Hải quan";
I18N.vi.op_cat_client = "Khách hàng";
I18N.vi.op_cat_finance = "Tài chính";
I18N.vi.op_cat_safety = "An toàn";
I18N.vi.op_cat_other = "Khác";
I18N.vi.op_act_investigate = "Bắt đầu xử lý";
I18N.vi.op_act_resolve = "Đã giải quyết";
I18N.vi.op_act_close = "Đóng";
I18N.vi.op_act_reopen = "Mở lại";
I18N.vi.op_act_owner = "Người phụ trách và mức độ";
I18N.vi.op_resolve_hint = "Chỉ giải quyết khi mọi hành động khắc phục đã xong. Người điều hành sẽ đóng.";
I18N.vi.op_e_resolution = "Hãy ghi nguyên nhân và cách xử lý";
I18N.vi.op_internal_note = "Chỉ nhóm thấy sự cố. Không gửi gì cho khách.";
I18N.vi.op_ev_created = "{who}: đã mở sự cố";
I18N.vi.op_ev_status = "{who}: {a} → {b}";
I18N.vi.op_ev_owner = "{who}: người phụ trách — {n}";
I18N.vi.op_ev_severity = "{who}: mức độ — {s}";
I18N.vi.op_ev_comment = "{who}: bình luận";
I18N.vi.op_ev_action = "{who}: hành động khắc phục";
I18N.vi.op_n_incident_new = "Sự cố mới SC-{n} \"{x}\" ({s}, {who})";
I18N.vi.op_n_incident_owner = "Bạn phụ trách sự cố SC-{n} \"{x}\" ({who})";
I18N.vi.op_n_incident_status = "Sự cố SC-{n} \"{x}\": {s} ({who})";
I18N.vi.op_n_sop_published = "Quy trình mới hoặc cập nhật \"{x}\" — hãy đọc ({who})";
I18N.vi.op_cal_prev = "Trước";
I18N.vi.op_cal_next = "Sau";
I18N.vi.op_cal_today = "Hôm nay";
I18N.vi.op_cal_mine = "Chỉ của tôi";
I18N.vi.op_event_new = "Sự kiện";
I18N.vi.op_event_edit = "Sự kiện";
I18N.vi.op_event_del_confirm = "Xóa sự kiện này?";
I18N.vi.op_f_event_title = "Tiêu đề";
I18N.vi.op_f_starts = "Bắt đầu";
I18N.vi.op_f_ends = "Kết thúc";
I18N.vi.op_f_note = "Ghi chú";
I18N.vi.op_k_event = "sự kiện";
I18N.vi.op_k_task = "việc";
I18N.vi.op_k_milestone = "giai đoạn";
I18N.vi.op_k_incident = "sự cố";
I18N.vi.op_sop_new = "Quy trình";
I18N.vi.op_sop_edit = "Quy trình";
I18N.vi.op_sop_hint = "Quy trình mô tả cách chúng ta làm việc. Hãy đọc quy trình mới và đã cập nhật rồi đánh dấu đã đọc.";
I18N.vi.op_sop_empty = "Chưa có quy trình.";
I18N.vi.op_sop_unread = "Chưa đọc";
I18N.vi.op_sop_read = "Đã đọc";
I18N.vi.op_sop_read_v = "Đã đọc phiên bản {n}";
I18N.vi.op_sop_ack = "Tôi đã đọc";
I18N.vi.op_sop_acked_ok = "Đã đánh dấu đã đọc";
I18N.vi.op_sop_ver = "Phiên bản {n} · {d}";
I18N.vi.op_sop_acked = "{a}/{b} người đã đọc";
I18N.vi.op_sop_who = "Ai đã đọc phiên bản hiện tại";
I18N.vi.op_sop_ack_ok = "đã đọc {d}";
I18N.vi.op_sop_ack_old = "chỉ đọc phiên bản {n}";
I18N.vi.op_sop_ack_no = "chưa đọc";
I18N.vi.op_sop_versions = "Phiên bản cũ: {n}";
I18N.vi.op_sop_st_draft = "Bản nháp";
I18N.vi.op_sop_st_published = "Đã công bố";
I18N.vi.op_sop_st_archived = "Đã lưu trữ";
I18N.vi.op_f_sop_title = "Tiêu đề";
I18N.vi.op_f_sop_cat = "Mục";
I18N.vi.op_f_sop_body = "Nội dung quy trình";
I18N.vi.op_f_sop_status = "Trạng thái";
I18N.vi.op_sop_body_hint = "Mỗi bước một dòng. Mỗi lần sửa nội dung, phiên bản cũ được giữ lại và mọi người đánh dấu đã đọc lại.";
I18N.vi.op_e_sop = "Cần tiêu đề và nội dung";
I18N.vi.rp_days_7 = "7 ngày";
I18N.vi.rp_days_30 = "30 ngày";
I18N.vi.rp_days_90 = "90 ngày";
I18N.vi.rp_days_365 = "Năm";
I18N.vi.rp_export = "Tải Excel";
I18N.vi.rp_exported = "Đã tải báo cáo";
I18N.vi.rp_hint_all = "Chỉ số trong kỳ theo công việc, giai đoạn đơn, chậm trễ và sự cố. Chỉ tính công việc của nhóm — không gồm số tiền đơn hàng.";
I18N.vi.rp_hint_me = "Chỉ số của bạn trong kỳ. Ai có quyền \"Xem phân tích nhóm\" mới thấy chỉ số cả nhóm.";
I18N.vi.rp_team = "Nhóm";
I18N.vi.rp_k_done = "việc đã xong";
I18N.vi.rp_k_on_time = "đúng hạn";
I18N.vi.rp_k_cycle = "thời gian mỗi việc";
I18N.vi.rp_k_returns = "bị trả lại khi duyệt";
I18N.vi.rp_k_ms_on_time = "giai đoạn đúng hạn";
I18N.vi.rp_k_delays = "chậm trễ";
I18N.vi.rp_k_incidents = "sự cố";
I18N.vi.rp_k_overdue_now = "đang quá hạn";
I18N.vi.rp_of_created = "trên {n} đã giao";
I18N.vi.rp_of_due = "trên {n} có hạn";
I18N.vi.rp_of_submitted = "trên {n} đã nộp";
I18N.vi.rp_of_done = "trên {n} đã xong";
I18N.vi.rp_h = "giờ";
I18N.vi.rp_resolve_h = "xử lý trung bình {n} giờ";
I18N.vi.rp_quality = "Chất lượng";
I18N.vi.rp_q_qc_done = "giai đoạn QC xong";
I18N.vi.rp_q_qc_delayed = "giai đoạn QC bị chậm";
I18N.vi.rp_q_delays = "chậm trễ do chất lượng";
I18N.vi.rp_q_incidents = "sự cố chất lượng";
I18N.vi.rp_delays_by = "Chậm trễ theo nguyên nhân";
I18N.vi.rp_c_count = "Số lượng";
I18N.vi.rp_c_shift = "Dời hạn, ngày";
I18N.vi.rp_c_resolve = "Đóng sau, giờ";
I18N.vi.rp_inc_by = "Sự cố theo loại:";
I18N.vi.rp_steps = "Chậm nhiều nhất ở giai đoạn:";
I18N.vi.rp_weekly = "Việc xong mỗi tuần";
I18N.vi.rp_week_tip = "Tuần từ {d}: xong {n}";
I18N.vi.rp_table = "Bảng theo tuần";
I18N.vi.rp_c_week = "Tuần";
I18N.vi.rp_c_created = "Đã giao";
I18N.vi.rp_c_done = "Đã xong";
I18N.vi.rp_people = "Chỉ số nhân viên";
I18N.vi.rp_me = "Chỉ số của tôi";
I18N.vi.rp_c_ms = "Giai đoạn (đúng hạn)";
I18N.vi.rp_c_reviewed = "Đã duyệt";
I18N.vi.rp_c_open = "Đang mở";
I18N.vi.rp_people_note = "\"Đúng hạn\" tính trên việc đã xong có hạn. \"Bị trả lại\" là số lần việc đã nộp bị trả lại. Dùng chỉ số để trao đổi, không phải để phạt: hãy xem nguyên nhân.";
I18N.vi.rp_period = "Kỳ: {a} – {b}";

// «Мои цели» (js/goals.js, файл 72)
I18N.vi.nav_goals = "Mục tiêu của tôi";
I18N.vi.gl_page_hint = "Mục tiêu 5 năm, năm, tháng và tuần, bảng công việc và trọng tâm hôm nay. Chỉ mình bạn thấy.";
I18N.vi.gl_v_today = "Hôm nay";
I18N.vi.gl_v_goals = "Mục tiêu";
I18N.vi.gl_v_calendar = "Lịch";
I18N.vi.gl_missing = "Mục này sẽ hoạt động sau khi cập nhật cơ sở dữ liệu (tệp 72). Đơn hàng và dữ liệu khác không bị ảnh hưởng.";
I18N.vi.gl_focus = "Trọng tâm hôm nay";
I18N.vi.gl_focus_hint = "Ba việc chính giúp bạn tiến tới mục tiêu. Những việc khác có thể chờ.";
I18N.vi.gl_focus_done = "Đã xong {n}/{m}";
I18N.vi.gl_pick_slot = "+ Chọn việc chính";
I18N.vi.gl_no_goal = "chưa gắn mục tiêu";
I18N.vi.gl_in_focus_min = "tập trung {n} phút";
I18N.vi.gl_timer = "Hẹn giờ tập trung";
I18N.vi.gl_t_running = "đang chạy";
I18N.vi.gl_t_paused = "tạm dừng";
I18N.vi.gl_t_ready = "sẵn sàng";
I18N.vi.gl_t_on = "Đang làm:";
I18N.vi.gl_t_hint = "Nhấn ▶ cạnh việc trọng tâm để tính thời gian cho việc đó";
I18N.vi.gl_min = "{n} phút";
I18N.vi.gl_t_start = "Bắt đầu";
I18N.vi.gl_t_pause = "Tạm dừng";
I18N.vi.gl_t_resume = "Tiếp tục";
I18N.vi.gl_t_finish = "Kết thúc và tính";
I18N.vi.gl_t_done = "Kết thúc phiên: tập trung {n} phút";
I18N.vi.gl_t_credited = "Đã tính {n} phút";
I18N.vi.gl_t_short = "Dưới một phút — không tính";
I18N.vi.gl_s_min = "phút tập trung hôm nay";
I18N.vi.gl_s_done = "xong hôm nay";
I18N.vi.gl_s_streak = "ngày liên tiếp";
I18N.vi.gl_quick = "Ghi nhanh";
I18N.vi.gl_quick_hint = "vào «Hộp vào»";
I18N.vi.gl_quick_ph = "Cần làm gì?";
I18N.vi.gl_quick_btn = "Ghi";
I18N.vi.gl_quick_ok = "Đã ghi vào «Hộp vào»";
I18N.vi.gl_l_overdue = "Quá hạn";
I18N.vi.gl_l_today = "Hạn hôm nay";
I18N.vi.gl_l_doing = "Đang làm";
I18N.vi.gl_e_overdue = "Không có việc quá hạn.";
I18N.vi.gl_e_today = "Hôm nay không có hạn.";
I18N.vi.gl_e_doing = "Không có việc đang làm.";
I18N.vi.gl_more = "và {n} việc nữa";
I18N.vi.gl_more_focus = "Cũng trọng tâm: {list}";
I18N.vi.gl_to_focus = "Thêm vào trọng tâm";
I18N.vi.gl_focused = "Đã thêm vào trọng tâm";
I18N.vi.gl_unfocus = "Bỏ khỏi trọng tâm";
I18N.vi.gl_timer_task = "Bắt đầu hẹn giờ cho việc này";
I18N.vi.gl_mark_done = "Đánh dấu xong";
I18N.vi.gl_c_inbox = "Hộp vào";
I18N.vi.gl_c_plan = "Kế hoạch";
I18N.vi.gl_c_doing = "Đang làm";
I18N.vi.gl_c_done = "Xong";
I18N.vi.gl_h_inbox = "ý tưởng và mọi điều chợt nghĩ ra";
I18N.vi.gl_h_plan = "đã quyết định làm";
I18N.vi.gl_h_doing = "đã bắt đầu";
I18N.vi.gl_all_goals = "Tất cả mục tiêu";
I18N.vi.gl_new_task = "+ Việc";
I18N.vi.gl_add_card = "+ Thêm thẻ";
I18N.vi.gl_hidden = "ẩn {n} thẻ nữa";
I18N.vi.gl_board_hint = "Kéo thẻ giữa các cột. Trên điện thoại, mở thẻ và chọn cột.";
I18N.vi.gl_late = "quá hạn";
I18N.vi.gl_today_chip = "hôm nay";
I18N.vi.gl_tomorrow = "ngày mai";
I18N.vi.gl_hz_5y = "5 năm";
I18N.vi.gl_hz_year = "Năm";
I18N.vi.gl_hz_month = "Tháng";
I18N.vi.gl_hz_week = "Tuần";
I18N.vi.gl_add_5y = "Mục tiêu 5 năm";
I18N.vi.gl_add_year = "Mục tiêu năm";
I18N.vi.gl_add_month = "Mục tiêu tháng";
I18N.vi.gl_add_week = "Mục tiêu tuần";
I18N.vi.gl_hint_5y = "Bạn muốn trở thành ai và xây dựng điều gì. Ví dụ: «Công ty riêng với đội 20 người».";
I18N.vi.gl_hint_year = "Bước lớn tới mục tiêu 5 năm. Ví dụ: «Đỗ HSK 5».";
I18N.vi.gl_hint_month = "Những gì cần xong trước cuối tháng.";
I18N.vi.gl_hint_week = "Kết quả cụ thể của tuần này.";
I18N.vi.gl_active = "Đang làm: {n}";
I18N.vi.gl_leads_to = "dẫn tới: {name}";
I18N.vi.gl_steps = "{d}/{t} bước · {p}%";
I18N.vi.gl_no_steps = "Chưa có bước nào — thêm việc hoặc mục tiêu nhỏ hơn";
I18N.vi.gl_why_strategy = "Lý do và chiến lược";
I18N.vi.gl_why = "Vì sao điều này quan trọng";
I18N.vi.gl_strategy = "Chiến lược";
I18N.vi.gl_edit = "Sửa";
I18N.vi.gl_add_step = "+ Bước";
I18N.vi.gl_achieved = "Đã đạt";
I18N.vi.gl_reopen = "Mở lại";
I18N.vi.gl_until = "đến {d}";
I18N.vi.gl_days_left = "{n} ngày";
I18N.vi.gl_overdue_goal = "đã quá hạn";
I18N.vi.gl_areas = "Kinh doanh|Tài chính|Sức khỏe|Gia đình|Học tập|Cá nhân";
I18N.vi.gl_cal_task = "hạn việc";
I18N.vi.gl_cal_late = "quá hạn";
I18N.vi.gl_cal_goal = "hạn mục tiêu";
I18N.vi.gl_cal_focus = "có tập trung";
I18N.vi.gl_day_empty = "Ngày này không có hạn.";
I18N.vi.gl_day_add = "+ Việc cho ngày này";
I18N.vi.gl_day_focus = "Tập trung: {n} phút";
I18N.vi.gl_rem_title = "Nhắc nhở hằng ngày";
I18N.vi.gl_rem_hint = "Lịch điện thoại sẽ nhắc mỗi sáng: «Chọn trọng tâm hôm nay». Tải sự kiện và nhấn «Thêm».";
I18N.vi.gl_rem_time = "Giờ";
I18N.vi.gl_rem_btn = "Thêm vào lịch";
I18N.vi.gl_rem_ok = "Mở tệp đã tải để thêm sự kiện vào lịch.";
I18N.vi.gl_rem_summary = "Chọn trọng tâm hôm nay";
I18N.vi.gl_rem_desc = "Mở ULA Factory → Mục tiêu của tôi và chọn ba việc chính.";
I18N.vi.gl_ics_btn = "Vào lịch";
I18N.vi.gl_task = "Việc";
I18N.vi.gl_task_new = "Việc mới";
I18N.vi.gl_f_title = "Cần làm gì";
I18N.vi.gl_f_col = "Cột";
I18N.vi.gl_f_due = "Hạn";
I18N.vi.gl_f_goal = "Dẫn tới mục tiêu";
I18N.vi.gl_f_nogoal = "Không có mục tiêu";
I18N.vi.gl_f_focus = "Trọng tâm hôm nay";
I18N.vi.gl_f_notes = "Ghi chú";
I18N.vi.gl_f_check = "Danh sách kiểm";
I18N.vi.gl_f_check_ph = "Mục mới";
I18N.vi.gl_f_total = "Tổng tập trung: {n} phút";
I18N.vi.gl_need_title = "Hãy ghi việc cần làm.";
I18N.vi.gl_add = "Thêm";
I18N.vi.gl_delete = "Xóa";
I18N.vi.gl_delete_sure = "Chắc chắn xóa?";
I18N.vi.gl_cancel = "Hủy";
I18N.vi.gl_save = "Lưu";
I18N.vi.gl_close = "Đóng";
I18N.vi.gl_goal = "Mục tiêu";
I18N.vi.gl_goal_new = "Mục tiêu mới";
I18N.vi.gl_g_title = "Mục tiêu";
I18N.vi.gl_g_ph = "Ví dụ: đỗ HSK 5";
I18N.vi.gl_g_hz = "Khoảng thời gian";
I18N.vi.gl_g_area = "Lĩnh vực";
I18N.vi.gl_g_noarea = "Không có lĩnh vực";
I18N.vi.gl_g_parent = "Dẫn tới mục tiêu";
I18N.vi.gl_g_top = "Đây là mục tiêu lớn nhất";
I18N.vi.gl_g_none = "Không";
I18N.vi.gl_g_why_ph = "Điều gì sẽ thay đổi khi đạt mục tiêu";
I18N.vi.gl_g_strategy = "Chiến lược: tôi sẽ đạt được bằng cách nào";
I18N.vi.gl_g_strategy_ph = "Các bước chính, nguồn lực, trở ngại và cách vượt qua";
I18N.vi.gl_g_need = "Hãy ghi mục tiêu.";
I18N.vi.gl_pick_title = "Việc chính hôm nay";
I18N.vi.gl_pick_hint = "Chọn việc giúp bạn tiến tới mục tiêu nhiều nhất.";
I18N.vi.gl_pick_new = "Hoặc nhập việc mới";
I18N.vi.gl_pick_g1 = "Hạn hôm nay hoặc sớm hơn";
I18N.vi.gl_pick_none = "Không có việc đang mở — hãy nhập việc mới ở trên.";
I18N.vi.gl_e_focus_full = "Đã có ba việc trọng tâm. Hãy bỏ một việc để thêm việc mới.";
I18N.vi.gl_e_parent = "Mục tiêu lớn phải có khoảng thời gian dài hơn.";
I18N.vi.gl_e_limit = "Đã đạt giới hạn bản ghi. Hãy xóa các việc cũ đã xong.";
I18N.vi.gl_e_save = "Chưa lưu được. Kiểm tra mạng và thử lại.";
// «Мои цели» — доски, поиск, шаблоны, неделя, фокус на Главной (js/goals.js, файл 72)
I18N.vi.gl_v_boards = "Bảng";
I18N.vi.gl_main_board = "Việc của tôi";
I18N.vi.gl_b_search_ph = "Tìm bảng, thẻ hoặc mục tiêu";
I18N.vi.gl_b_starred = "Đã gắn sao";
I18N.vi.gl_b_recent = "Xem gần đây";
I18N.vi.gl_b_mine = "Bảng của tôi";
I18N.vi.gl_b_new = "Tạo bảng";
I18N.vi.gl_b_templates = "Mẫu";
I18N.vi.gl_b_tpl_hint = "Bảng có sẵn danh sách — chỉ cần thêm thẻ.";
I18N.vi.gl_b_count = "{n} đang mở · {d} đã xong";
I18N.vi.gl_b_archive = "Bảng đã lưu trữ ({n})";
I18N.vi.gl_b_restore = "Khôi phục";
I18N.vi.gl_b_delete = "Xóa vĩnh viễn";
I18N.vi.gl_b_delete_sure = "Xóa cùng tất cả thẻ?";
I18N.vi.gl_b_archive_btn = "Lưu trữ";
I18N.vi.gl_b_archived = "Đã lưu trữ bảng. Có thể khôi phục ở cuối trang Bảng.";
I18N.vi.gl_b_in_archive = "Bảng này đã được lưu trữ.";
I18N.vi.gl_star = "Gắn sao bảng";
I18N.vi.gl_unstar = "Bỏ gắn sao";
I18N.vi.gl_back = "← Bảng";
I18N.vi.gl_board_settings = "Cài đặt";
I18N.vi.gl_board = "Bảng";
I18N.vi.gl_board_new = "Bảng mới";
I18N.vi.gl_b_create = "Tạo";
I18N.vi.gl_b_title = "Tên bảng";
I18N.vi.gl_b_title_ph = "Ví dụ: Thi đỗ HSK 5";
I18N.vi.gl_b_need = "Hãy nhập tên.";
I18N.vi.gl_b_color = "Màu";
I18N.vi.gl_b_goal = "Mục tiêu của bảng";
I18N.vi.gl_b_tpl = "Mẫu";
I18N.vi.gl_b_tpl_empty = "Trống: Cần làm · Đang làm · Xong";
I18N.vi.gl_tpl_empty_lists = "Cần làm|Đang làm|Xong";
I18N.vi.gl_tpl_goal = "Kế hoạch mục tiêu";
I18N.vi.gl_tpl_goal_lists = "Mục tiêu và chiến lược|Tháng này|Tháng sau|Để sau|Xong";
I18N.vi.gl_tpl_goal_d = "Mục tiêu, các bước theo tháng và việc đã xong";
I18N.vi.gl_tpl_kanban = "Kanban";
I18N.vi.gl_tpl_kanban_lists = "Ý tưởng|Cần làm|Đang làm|Xong";
I18N.vi.gl_tpl_kanban_d = "Kinh điển: từ ý tưởng đến hoàn thành";
I18N.vi.gl_tpl_day = "Việc trong ngày";
I18N.vi.gl_tpl_day_lists = "Sáng|Chiều|Tối|Đã xong";
I18N.vi.gl_tpl_day_d = "Kế hoạch ngày theo buổi";
I18N.vi.gl_tpl_study = "Học tập";
I18N.vi.gl_tpl_study_lists = "Chủ đề|Đang học|Ôn lại|Đã qua";
I18N.vi.gl_tpl_study_d = "Chủ đề, ôn tập và đã qua";
I18N.vi.gl_tpl_kaizen = "Kaizen";
I18N.vi.gl_tpl_kaizen_lists = "Vấn đề|Ý tưởng cải tiến|Đang thử|Đã áp dụng";
I18N.vi.gl_tpl_kaizen_d = "Cải tiến nhỏ mỗi ngày";
I18N.vi.gl_tpl_year = "Năm theo quý";
I18N.vi.gl_tpl_year_lists = "Quý 1|Quý 2|Quý 3|Quý 4|Xong";
I18N.vi.gl_tpl_year_d = "Kế hoạch lớn cho cả năm";
I18N.vi.gl_list = "Danh sách";
I18N.vi.gl_list_title = "Tên danh sách";
I18N.vi.gl_list_left = "← Sang trái";
I18N.vi.gl_list_right = "Sang phải →";
I18N.vi.gl_list_delete = "Xóa danh sách";
I18N.vi.gl_list_nonempty = "Không thể xóa danh sách còn thẻ — hãy chuyển hoặc xóa thẻ trước.";
I18N.vi.gl_add_card_ph = "Nhập tiêu đề cho thẻ…";
I18N.vi.gl_add_card_btn = "Thêm thẻ";
I18N.vi.gl_add_list_ph = "+ Thêm danh sách";
I18N.vi.gl_cboard_hint = "Kéo thẻ giữa các danh sách. Vòng tròn để đánh dấu xong. Bấm tên danh sách để đổi tên hoặc di chuyển.";
I18N.vi.gl_board_for_goal = "+ Bảng cho mục tiêu";
I18N.vi.gl_f_board = "Bảng";
I18N.vi.gl_f_list = "Danh sách";
I18N.vi.gl_f_done = "Đã xong";
I18N.vi.gl_no_lists = "Bảng này chưa có danh sách — hãy thêm danh sách trước.";
I18N.vi.gl_sr_none = "Không tìm thấy. Hãy thử từ khác.";
I18N.vi.gl_sr_boards = "Bảng";
I18N.vi.gl_sr_cards = "Thẻ";
I18N.vi.gl_sr_goals = "Mục tiêu";
I18N.vi.gl_undo = "Hoàn tác";
I18N.vi.gl_restored = "Đã khôi phục";
I18N.vi.gl_del_item = "Đã xóa: “{name}”";
I18N.vi.gl_week = "7 ngày qua";
I18N.vi.gl_week_meta = "{m} phút tập trung · xong {d} · đạt {g} mục tiêu";
I18N.vi.gl_week_bar = "{d}: {n} phút tập trung";
I18N.vi.gl_home_title = "Trọng tâm hôm nay";
I18N.vi.gl_home_empty = "Chưa chọn ba việc chính hôm nay.";
I18N.vi.gl_home_open = "Mở Mục tiêu của tôi";
I18N.vi.gl_home_pick = "Chọn ba việc chính";

// Главная страница для гостя (js/home.js)
I18N.vi.lp_nav_tools = "Công cụ";
I18N.vi.lp_nav_services = "Dịch vụ";
I18N.vi.lp_nav_how = "Bắt đầu";
I18N.vi.lp_nav_clients = "Cho khách hàng";
I18N.vi.lp_login = "Đăng nhập";
I18N.vi.lp_start = "Bắt đầu miễn phí";
I18N.vi.lp_about = "ULA Factory là gì?";
I18N.vi.lp_have_acc = "Tôi đã có tài khoản";
I18N.vi.lp_eyebrow = "Nền tảng cho người mua hàng từ Trung Quốc";
I18N.vi.lp_h1_a = "Đơn hàng từ Trung Quốc\u00a0—";
I18N.vi.lp_h1_b = "trong tầm kiểm soát từ nhà máy đến khách hàng";
I18N.vi.lp_lead = "ULA Factory là không gian làm việc của người mua hàng. Đơn hàng, thanh toán, giao hàng và khách hàng ở một nơi\u00a0— khách tự xem hàng của mình đang ở đâu.";
I18N.vi.lp_cta_start = "Tạo không gian miễn phí";
I18N.vi.lp_cta_track = "Theo dõi đơn hàng";
I18N.vi.lp_trust1 = "Đăng ký trong 1 phút";
I18N.vi.lp_trust2 = "Điện thoại và máy tính";
I18N.vi.lp_trust3 = "Chỉ bạn thấy dữ liệu của mình";
I18N.vi.lp_demo_label = "Đơn hàng mẫu";
I18N.vi.lp_demo_item = "Giày thể thao, 40 đôi";
I18N.vi.lp_demo_status = "Đang vận chuyển";
I18N.vi.lp_demo_s1 = "Đã mua";
I18N.vi.lp_demo_s2 = "Kho Trung Quốc";
I18N.vi.lp_demo_s3 = "Biên giới";
I18N.vi.lp_demo_s4 = "Bishkek";
I18N.vi.lp_demo_eta = "Dự kiến giao";
I18N.vi.lp_demo_eta_v = "sau 5–7 ngày";
I18N.vi.lp_demo_left = "Còn phải trả";
I18N.vi.lp_demo_left_v = "12 400 som";
I18N.vi.lp_demo_profit = "Lợi nhuận tháng này";
I18N.vi.lp_demo_profit_v = "+18%";
I18N.vi.lp_buyer_t = "Tôi là người mua hàng ở Trung Quốc";
I18N.vi.lp_buyer_d = "Quản lý đơn hàng, khách hàng và tiền trong một không gian\u00a0— không cần bảng tính hay hàng chục cuộc trò chuyện. Chỉ bạn và nhóm của bạn thấy.";
I18N.vi.lp_buyer_btn = "Tạo không gian";
I18N.vi.lp_client_t = "Tôi là khách hàng\u00a0— đang chờ đơn";
I18N.vi.lp_client_d = "Người mua hàng đã gửi bạn đường link? Dán vào đây để xem trạng thái đơn, thanh toán và hành trình kiện hàng.";
I18N.vi.lp_track_ph = "Dán link từ người mua hàng";
I18N.vi.lp_track_btn = "Mở";
I18N.vi.lp_track_err = "Đây không giống link đơn hàng. Hãy nhờ người mua hàng gửi lại.";
I18N.vi.lp_tools_kicker = "Sau khi đăng ký";
I18N.vi.lp_tools_title = "Mọi thứ để làm việc với khách hàng và đơn hàng";
I18N.vi.lp_p1_t = "Trang khách hàng";
I18N.vi.lp_p1_d = "Mỗi khách hàng có trang riêng: tất cả đơn, công nợ và thanh toán. Gửi một link\u00a0— không còn câu hỏi “hàng tới đâu rồi?”.";
I18N.vi.lp_p1_b1 = "Thẻ khách hàng với lịch sử đơn";
I18N.vi.lp_p1_b2 = "Một link cho mọi đơn của khách";
I18N.vi.lp_p1_b3 = "Khách gửi yêu cầu qua link";
I18N.vi.lp_p2_t = "Theo dõi đơn hàng";
I18N.vi.lp_p2_d = "10 giai đoạn: từ mua tại nhà máy đến nhận hàng ở Bishkek. Khách thấy giai đoạn, thời hạn và mã vận đơn.";
I18N.vi.lp_p2_b1 = "Thanh tiến trình và bản đồ tuyến";
I18N.vi.lp_p2_b2 = "Trạng thái gửi khách qua Telegram";
I18N.vi.lp_p2_b3 = "Hạn thanh toán và giao hàng";
I18N.vi.lp_p3_t = "Quản lý kinh doanh";
I18N.vi.lp_p3_d = "Lợi nhuận, công nợ và chi phí tự động tính. Thấy ai đang nợ, mặt hàng nào bán chạy và bạn kiếm được bao nhiêu.";
I18N.vi.lp_p3_b1 = "Phân tích và báo cáo lợi nhuận";
I18N.vi.lp_p3_b2 = "Công nợ và nhắc nhở một chạm";
I18N.vi.lp_p3_b3 = "Nhóm: vai trò, nhiệm vụ, quyền";
I18N.vi.lp_s_kicker = "Dịch vụ nền tảng";
I18N.vi.lp_s_title = "Mọi thứ người mua hàng cần\u00a0— ở một nơi";
I18N.vi.lp_s_sub = "Chỉ bật những gì doanh nghiệp bạn cần.";
I18N.vi.lp_s1_t = "Tính giá";
I18N.vi.lp_s1_d = "Giá cho khách từ giá hàng, cân nặng và cước cargo\u00a0— kèm phần lời của bạn.";
I18N.vi.lp_s2_t = "Lô hàng và cargo";
I18N.vi.lp_s2_d = "Nhiều đơn trong một chuyến cargo: phí giao tự chia theo cân nặng.";
I18N.vi.lp_s3_t = "Cửa hàng riêng";
I18N.vi.lp_s3_d = "Trang sản phẩm của bạn: khách chọn giỏ hàng và đặt đơn.";
I18N.vi.lp_s4_t = "Đổi som → nhân dân tệ";
I18N.vi.lp_s4_d = "Đổi tiền để trả nhà cung cấp ở Trung Quốc ngay trong không gian làm việc.";
I18N.vi.lp_s5_t = "Bản đồ nhà máy";
I18N.vi.lp_s5_d = "Nhà máy và nhà cung cấp của bạn trên bản đồ Trung Quốc\u00a0— chỉ bạn thấy.";
I18N.vi.lp_s6_t = "Gửi tin WhatsApp";
I18N.vi.lp_s6_d = "Báo khách về trạng thái hoặc công nợ bằng mẫu soạn sẵn.";
I18N.vi.lp_s7_t = "Excel và nhập dữ liệu";
I18N.vi.lp_s7_d = "Nhập đơn từ Excel hoặc ảnh sổ tay, xuất báo cáo .xlsx.";
I18N.vi.lp_s8_t = "Nhóm";
I18N.vi.lp_s8_d = "Quản lý làm việc trong không gian của bạn với quyền và nhiệm vụ riêng.";
I18N.vi.lp_how_kicker = "Bắt đầu";
I18N.vi.lp_how_title = "Ba bước\u00a0— đơn hàng trong tầm kiểm soát";
I18N.vi.lp_how1_t = "Đăng ký";
I18N.vi.lp_how1_d = "Bằng email hoặc Google. Không gian sẵn sàng sau một phút.";
I18N.vi.lp_how2_t = "Thêm đơn và khách hàng";
I18N.vi.lp_how2_d = "Nhập tay, từ Excel hoặc ảnh sổ tay\u00a0— tùy bạn.";
I18N.vi.lp_how3_t = "Gửi link cho khách";
I18N.vi.lp_how3_d = "Khách thấy trạng thái và thanh toán, bạn thấy lợi nhuận và công nợ.";
I18N.vi.lp_final_t = "Bắt đầu quản lý đơn hàng Trung Quốc thật nhẹ nhàng\u00a0— ngay hôm nay";
I18N.vi.lp_final_d = "Đăng ký miễn phí. Giao diện tiếng Nga, tiếng Anh và tiếng Trung.";
// Главная: «Так выглядит кабинет» и вопросы-ответы
I18N.vi.lp_nav_show = "Không gian";
I18N.vi.lp_nav_faq = "Hỏi đáp";
I18N.vi.lp_show_kicker = "Xem trước khi đăng ký";
I18N.vi.lp_show_title = "Không gian làm việc trông như thế này";
I18N.vi.lp_show_sub = "Màn hình thật của chương trình. Tên và số tiền chỉ là ví dụ.";
I18N.vi.lp_show_t1 = "Đơn hàng";
I18N.vi.lp_show_t2 = "Phân tích";
I18N.vi.lp_show_t3 = "Khách hàng thấy gì";
I18N.vi.lp_show_c1 = "Tất cả đơn theo giai đoạn: mới, đang mua, ở kho, đang vận chuyển. Thấy ngay ai nợ bao nhiêu và việc tiếp theo.";
I18N.vi.lp_show_c2 = "Lợi nhuận, doanh thu và công nợ theo mọi khoảng thời gian — không cần Excel hay máy tính. Thấy tháng tốt nhất và khách hàng chính.";
I18N.vi.lp_show_c3 = "Khách mở link của bạn và thấy giai đoạn, tuyến đường và số tiền còn phải trả. Không cần đăng ký hay cài ứng dụng.";
I18N.vi.lp_show_b1 = "10 giai đoạn của đơn hàng";
I18N.vi.lp_show_b2 = "Bản đồ tuyến đến Bishkek";
I18N.vi.lp_show_b3 = "Thông báo trạng thái qua Telegram";
I18N.vi.lp_faq_kicker = "Hỏi đáp";
I18N.vi.lp_faq_title = "Câu hỏi thường gặp";
I18N.vi.lp_faq_sub = "Chưa tìm thấy câu trả lời? Hãy viết cho chúng tôi — sẽ có người trả lời.";
I18N.vi.lp_c_mail = "Gửi email";
I18N.vi.lp_q1 = "Giá bao nhiêu?";
I18N.vi.lp_a1 = "Đăng ký miễn phí, không cần thẻ ngân hàng. Tạo không gian, thêm vài đơn và xem có phù hợp không.";
I18N.vi.lp_q2 = "Ai thấy đơn hàng và khách hàng của tôi?";
I18N.vi.lp_a2 = "Chỉ bạn và những người bạn mời. Người mua hàng khác không thấy không gian của bạn. Kết nối đến trang web được mã hóa.";
I18N.vi.lp_q3 = "Trang web có hoạt động ở Trung Quốc không?";
I18N.vi.lp_a3 = "Có, trang được làm để dùng từ Trung Quốc: không phụ thuộc vào dịch vụ Google bị chặn ở đó. Đăng nhập bằng Google sẽ không hoạt động ở Trung Quốc — hãy dùng email và mật khẩu.";
I18N.vi.lp_q4 = "Có cần cài đặt gì không?";
I18N.vi.lp_a4 = "Không. Không gian mở trong trình duyệt trên điện thoại và máy tính. Trên điện thoại có thể thêm vào màn hình chính và mở như ứng dụng.";
I18N.vi.lp_q5 = "Khách hàng của tôi thấy gì?";
I18N.vi.lp_a5 = "Chỉ đơn của họ qua link: giai đoạn, tuyến đường, thời hạn và số tiền còn phải trả. Khách không thấy giá mua và lợi nhuận của bạn, và không cần đăng ký.";
I18N.vi.lp_q6 = "Làm sao chuyển đơn từ bảng tính và sổ tay?";
I18N.vi.lp_a6 = "Tải lên file Excel hoặc CSV: cột được khớp tự động và bạn kiểm tra trước khi nhập. Ghi chép trong sổ có thể tải lên bằng ảnh.";
I18N.vi.lp_q7 = "Có thể làm việc cùng quản lý không?";
I18N.vi.lp_a7 = "Có. Mời nhân viên, giao vai trò và quyền, giao nhiệm vụ. Họ được làm gì — xóa, xem lợi nhuận, đổi cài đặt — do bạn quyết định.";
I18N.vi.lp_q8 = "Hỗ trợ những ngôn ngữ nào?";
I18N.vi.lp_a8 = "Tiếng Nga, tiếng Anh, tiếng Trung và tiếng Việt. Đổi ngôn ngữ chỉ một chạm — tiện khi đồng nghiệp ở Trung Quốc làm cùng bạn.";

// главная: курс юаня ULA для всех (js/home.js, файл 75)
I18N.vi.lp_rate_h = "Tỷ giá nhân dân tệ hôm nay";
I18N.vi.lp_rate_today = "Tỷ giá ULA · cập nhật hôm nay lúc {t}";
I18N.vi.lp_rate_on = "Tỷ giá ULA · cập nhật {d}";
I18N.vi.lp_rate_down = "rẻ hơn {n} som · trước đây {was}";
I18N.vi.lp_rate_up = "đắt hơn {n} som · trước đây {was}";
I18N.vi.lp_rate_flat = "Tỷ giá không đổi trong {n} ngày qua";
I18N.vi.lp_rate_chart_a = "Biểu đồ tỷ giá: từ {lo} đến {hi} som cho 1 ¥";
I18N.vi.lp_rate_chip_a = "Tỷ giá hôm nay: {n} som cho 1 ¥";
I18N.vi.lp_rate_calc = "Bạn cần bao nhiêu nhân dân tệ?";
I18N.vi.lp_rate_pay = "Cần trả";
I18N.vi.lp_rate_hint = "Nhập số nhân dân tệ — chúng tôi quy ra som";
I18N.vi.lp_rate_at = "theo tỷ giá {r}";
I18N.vi.lp_rate_cta = "Đổi nhân dân tệ";
I18N.vi.lp_rate_note = "Đổi tiền sau khi đăng ký miễn phí. Tỷ giá ULA cập nhật mỗi ngày.";
I18N.vi.lp_rate_note_fx = "Không cần đăng ký: nhập số tiền → thông tin chuyển khoản → ảnh chụp thanh toán. Theo dõi yêu cầu ngay trên trang.";
