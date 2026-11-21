// ULA FACTORY — словарь: English. Подключает i18n.js (скачивается только выбранный язык).
// Новые фразы добавлять во все четыре словаря: i18n.ru.js, i18n.en.js, i18n.zh.js, i18n.vi.js.
I18N.en = {
  app_title: "ULA Factory — orders from China",

  login_title: "Sign in",
  email: "Email",
  password: "Password",
  login_btn: "Sign in",
  logging_in: "Signing in…",
  logout: "Sign out",
  login_error: "Wrong email or password",
  no_access: "This account has no access to the dashboard",

  config_title: "Fill in config.js",
  config_text: "Open config.js and paste your Supabase project URL and public key.",
  lib_missing: "supabase.js didn't load. Make sure it is in the same folder as index.html.",

  nav_orders: "Orders",

  nav_home: "Home",

  home_place: "Place an order",

  home_new_d: "Product, price, delivery, payment",

  home_link_d: "Clients send requests themselves",

  home_import_d: "Many orders at once",

  home_quote_d: "What to charge the client",

  home_money: "Money from orders",

  home_all_orders: "All orders ({n}) ›",
  nav_menu: "Sections",
  nav_clients: "Clients",
  nav_suppliers: "Suppliers",
  suppliers_search: "Search name, contact, phone or WeChat",
  suppliers_count: "Suppliers: {n}",
  supplier_add: "Add supplier",
  supplier_save: "Save supplier",
  supplier_name: "Company or factory name",
  supplier_contact: "Contact person",
  supplier_phone: "Phone",
  supplier_wechat: "WeChat",
  supplier_city: "City",
  supplier_category: "Product category",
  supplier_address: "Address",
  supplier_notes: "Notes (only you can see these)",
  suppliers_empty_title: "No suppliers yet",
  suppliers_empty_text: "Add a supplier to keep their contact details here.",
  supplier_saved: "Supplier saved",
  supplier_deleted: "Supplier deleted",
  supplier_confirm_delete: "Delete supplier “{name}”?",
  nav_calc: "Rates",
  fx_title: "Currency calculator",
  fx_amount: "Amount",
  fx_from_cur: "From",
  fx_to: "To",
  fx_swap: "Swap",
  fx_use: "Use this rate in new orders",
  fx_used: "Rate {r} will be filled into new orders",
  fx_updated: "Rates as of {d}. Source: open.er-api.com (updated daily). Bank and exchange office rates may differ.",
  fx_table: "1 unit of currency in {c}",
  fx_error: "Couldn't load rates. Check your connection and press ↻.",
  fx_loading: "Loading rates…",
  rq_title: "Place a request",
  rq_to: "Seller: {n}",
  rq_hint: "Send a photo of the product, a link or a description, and enter the quantity. Need several products? Add more cards. We will calculate the price and contact you.",
  rq_link: "Product link",
  rq_link_hint: "Copy the address of the product page. If you have no link, describe the product below.",
  rq_product: "Product name or description",
  rq_product_ph: "For example: Nike sneakers, black, sizes 39–44",
  rq_qty: "Quantity",
  rq_name: "Your name",
  rq_phone: "Phone",
  rq_phone_hint: "With the country code, so we can message you on WhatsApp",
  rq_telegram: "Telegram (optional)",
  rq_comment: "Wishes (optional)",
  rq_comment_ph: "Color, size, deadline, special conditions",
  rq_send: "Send request",
  rq_sending: "Sending…",
  rq_consent: "By sending the request you agree to the processing of your name and phone to contact you about the order.",
  rq_e_link: "Check the link or describe the product in words",
  rq_e_product: "Add a photo, link or description of the product",
  rq_e_qty: "Enter a quantity greater than zero",
  rq_sent_title: "Request received",
  rq_sent_text: "{n} has received your request, will calculate the price and contact you.",
  rq_track: "Track the request",
  rq_track_hint: "Use this link to see the order status and enter the delivery address. Save it.",
  rq_again: "Send another request",
  rq_nf_title: "The link is not active",
  rq_nf_text: "This request link is disabled or outdated. Ask the seller to send a new one.",
  rq_err_title: "Could not open",
  rq_err_load: "Check your connection and refresh the page.",
  rq_err_many: "Too many requests in a short time. Try again later or message the seller directly.",
  rq_err: "Could not send the request. Check your connection and try again.",
  rq_photos: "Product photos",
  rq_photos_hint: "Up to {n} photos: the product, a screenshot, a label — anything that helps find it.",
  rq_photo_add: "Add photo",
  rq_photos_max: "You can attach up to {n} photos",
  rq_by_photo: "Product from photo",
  rq_photo_fail: "Request received, but some photos did not upload. Send them to the seller on WhatsApp.",
  rq_m_buy: "purchase price",
  rq_m_sell: "client price",
  rq_m_supplier: "supplier or link",
  rq_m_weight: "weight",
  rq_fill: "Client request. Complete the order — missing: {f}.",
  rq_fill_btn: "Complete",
  rq_fill_left: "Saved. Still empty: {f}. You can fill it in later.",
  rq_new_title: "🛍 New request No. {n}",
  rq_new_toast: "New request No. {n}. Open it and complete the order.",
  rq_new_many: "New requests: {n}. Open them and complete the orders.",
  rq_item_n: "Product {n}",
  rq_add_item: "Add another product",
  rq_items_max: "One request can hold up to {n} products. Send the rest in a new request.",
  rq_you: "Your contacts",
  rq_send_n: "Send request ({n} products)",
  rq_sent_many: "{n} received your request, will calculate the price for each product and contact you.",
  rq_left: "Not all products were sent: {n} left. Press the button below and send them again a bit later.",
  rq_finish: "Back to unsent products",
  rq_tag: "Request",
  h_requests: "New client requests: {n}",
  cl_price_pending: "The price is still being calculated. We will message you when it is ready.",
  rl_btn: "Request link",
  rl_title: "Request link",
  rl_hint: "Send it to your clients: they paste a product link and quantity, and a new order marked “Request” appears for you right away. Clients do not need to register.",
  rl_active: "The link is active",
  rl_disabled: "The link is disabled. Create it to receive requests.",
  rl_create: "Create link",
  rl_rotate: "Replace link",
  rl_revoke: "Disable link",
  rl_confirm_rotate: "Replace the link? The old one stops working immediately, and clients who saved it will not be able to send a request.",
  rl_confirm_revoke: "Disable the link? Clients will not be able to send requests until you create a new one.",
  rl_created: "Link created",
  rl_created_copied: "Link created and copied",
  rl_revoked: "Link disabled",
  rl_wa_text: "Hello! To order a product, leave a request via this link (paste the product link and quantity) and I will calculate the price:",
  tm_btn: "Team",
  tm_title: "Team: assistants",
  tm_hint: "An assistant signs in with their own password and works in your account: orders, clients, shipments, suppliers. They cannot delete, change settings or see the profit report.",
  tm_invites: "Invitations (not accepted yet)",
  tm_create: "Invite an assistant",
  tm_limits: "An invitation link works for 3 days and for one person only. Up to 5 assistants.",
  tm_role_owner: "Owner",
  tm_role_staff: "Assistant",
  tm_remove: "Remove",
  tm_cancel: "Cancel",
  tm_invite_until: "Valid until {d}",
  tm_wa_text: "Hello! Sign up and sign in via this link — you will work in my ULA Factory account:",
  tm_created: "Invitation created",
  tm_created_copied: "Invitation created, link copied",
  tm_confirm_remove: "Remove this assistant? They will no longer see your orders.",
  tm_removed: "Assistant removed",
  tm_err_own: "Your account already has orders or clients, so you cannot join another account.",
  tm_err_full: "The team already has the maximum number of assistants.",
  tm_err_many: "Too many unused invitations. Cancel the ones you do not need.",
  tm_err_admin: "An administrator cannot be an assistant.",
  tm_err_invalid: "The invitation did not work: it was already used or expired. Ask for a new link.",
  tm_joined: "Done! You are working in the account as an assistant.",
  tm_login_note: "You were invited to a team. Sign in or sign up and you will go straight to the account.",
  rl_limits: "Spam protection: at most 5 requests per hour from one phone and 20 per hour per workspace. If someone posts the link publicly, replace it.",
  nav_shipments: "Shipments",
  sh_hint: "Several orders in one cargo: weight and shipping cost are split between the orders automatically.",
  sh_new: "New shipment",
  sh_empty: "No shipments yet. Create one, add orders — shipping will be split by weight.",
  sh_err_db: "Shipments are not connected in the database yet: run migration_16_shipments.sql in Supabase.",
  sh_no_orders: "No orders in this shipment yet",
  sh_orders: "Orders: {n}",
  sh_weight: "Weight: {w} kg",
  sh_per_kg: "≈ {x} per kg",
  sh_flag_ok: "Shipping split",
  sh_flag_recalc: "Needs recalculation — open and save",
  sh_flag_noweight: "Orders without weight: {n}",
  sh_open: "Open",
  sh_title_new: "New shipment",
  sh_f_name: "Shipment name",
  sh_f_name_ph: "For example: Guangzhou 24.10",
  sh_f_cargo: "Cargo company",
  sh_f_date: "Shipping date",
  sh_f_tariff: "Rate per 1 kg, {c}",
  sh_f_weight: "Shipment weight per cargo scale, kg",
  sh_f_weight_hint: "If empty, the sum of order weights is used",
  sh_f_total: "Amount on the cargo invoice, {c}",
  sh_f_total_hint: "If set, the rate is not used",
  sh_f_notes: "Note",
  sh_sum_empty: "Add orders to the shipment — the calculation appears here.",
  sh_sum_none: "Enter the rate per kg or the cargo invoice amount — shipping will be split between the orders.",
  sh_sum_weights: "Orders weight: {a} kg. Shipment weight: {b} kg.",
  sh_sum_total: "Splitting: {x} (≈ {t} per kg)",
  sh_w_noweight: "Orders without weight: {n}. They get no share — enter the weight in the order.",
  sh_w_allnoweight: "No order has a weight, nothing to split. Enter weights in the orders.",
  sh_w_diff: "Shipment weight differs from the sum of order weights by {d} kg: the difference is spread over the orders proportionally.",
  sh_w_rate: "No saved shipping rate {a}→{b}. Save it in “Price quote” (button “Save rate”). For now orders in {b} keep their previous rate.",
  sh_orders_title: "Orders in the shipment",
  sh_no_weight: "no weight",
  sh_remove: "Remove from shipment",
  sh_add: "Add orders",
  sh_add_search: "Search by number, client or product",
  sh_add_none: "No orders can be added (not in another shipment, not cancelled, not delivered).",
  sh_add_apply: "Add selected ({n})",
  sh_status_title: "Status of the whole shipment",
  sh_status_apply: "Apply to all",
  sh_status_done: "Status changed for orders: {n}",
  sh_notify_title: "Notify the clients",
  sh_notify_btn: "Notify",
  sh_removed_note: "Orders removed from the shipment: {n}. They keep their previous shipping cost: adjust it in the order.",
  sh_save: "Save and split",
  sh_saved: "Shipment saved, shipping split between the orders",
  sh_saved_nocost: "Shipment saved. Enter the rate or the invoice amount — then shipping will be split.",
  sh_saved_noweight: "Shipment saved. Orders have no weight, so shipping was not split.",
  sh_err_name: "Enter the shipment name",
  sh_delete: "Delete shipment",
  sh_delete_confirm: "Delete shipment “{n}”? Orders stay but leave the shipment (their shipping cost is kept).",
  sh_tag: "Shipment",
  sh_tag_short: "Shipment",
  sh_order_note: "This order is in the shipment “{n}”: the shipment splits the shipping. A manual change of the shipping amount will be overwritten at the next recalculation.",
  nav_report: "Report",
  r_hint: "How much you earned: by month, client and product.",
  r_p_month: "This month",
  r_p_3m: "3 mo",
  r_p_12m: "12 mo",
  r_p_all: "All time",
  r_v_months: "By month",
  r_v_clients: "By client",
  r_v_products: "By product",
  r_profit: "Profit",
  r_revenue: "Revenue",
  r_cost: "Cost",
  r_paid: "Paid by clients",
  r_debt: "Still owed",
  r_orders: "Orders: {n}",
  r_qty: "Pcs: {n}",
  r_rev_short: "Revenue {x}",
  r_markup: "Markup {n}%",
  r_share: "{n}% of profit",
  r_empty: "No orders with a client price yet. Enter the client price in an order and your profit will appear here.",
  r_note: "Counts orders with a client price, cancelled ones excluded. Month = order date. Profit = client price − cost; markup = profit / cost. The money for unpaid balances arrives when the client pays.",
  r_unpriced: "No client price (not counted): {n}.",
  r_col_month: "Month",
  r_col_client: "Client",
  r_col_product: "Product",
  r_col_orders: "Orders",
  r_col_qty: "Quantity",
  r_col_revenue: "Revenue",
  r_col_cost: "Cost",
  r_col_profit: "Profit",
  r_col_markup: "Markup, %",
  r_col_paid: "Paid",
  r_col_debt: "Debt",
  r_col_share: "Profit share, %",
  r_col_cur: "Currency",
  nav_debts: "Debts",
  d_hint: "Who owes, how much and for how long. Tap “Remind” — the text is ready.",
  d_total: "Owed to you",
  d_clients: "Clients: {n}",
  d_filter_all: "All",
  d_filter_overdue: "Overdue",
  d_empty: "No debts — all clients have paid",
  d_empty_overdue: "No overdue debts",
  d_overdue: "Overdue: {n} d",
  d_days: "{n} d",
  d_orders: "Orders: {n}",
  d_at_client: "Goods already with the client",
  d_reminded: "Reminded: {when}",
  d_never: "Not reminded yet",
  d_today: "today",
  d_ago: "{n} d ago",
  d_remind: "Remind about payment",
  d_remind_title: "Payment reminder",
  d_note: "Debt is counted for orders with a client price set. Overdue: 7+ days since the order or the last payment. The “Reminded” mark is stored in this browser.",
  d_unpriced: "Not in the list (no client price): {n}.",
  nav_quote: "Price quote",
  q_title: "Price quote for a client",
  q_hint: "A client asks “how much?” — 3 steps and the reply with the price is ready.",
  q_name: "Product name (optional)",
  q_link: "Product link, e.g. 1688 (optional)",
  q_weight_total: "Total weight, kg",
  q_weight_unit: "Weight per piece, kg",
  q_wm_total: "Weight: total",
  q_wm_unit: "Weight: per piece",
  q_margin: "Markup",
  q_round: "Round the price up",
  q_round_0: "Don't round",
  q_round_n: "To {n}",
  q_result: "Result",
  q_need: "Enter quantity, price and rate — the quote will appear here.",
  q_price_client: "Client price",
  q_unit: "Per piece",
  q_rate_market: "The rate field holds the market rate (for reference). Enter your own and press “Save rate”.",
  q_warn_drate: "Enter the shipping rate, otherwise shipping is not counted.",
  q_save_rate: "Save rate",
  q_msg_title: "Reply to the client",
  q_msg_note: "The reply contains only the client price: cost and profit stay hidden.",
  q_order: "Create order from quote",
  q_clear: "Clear",
  client_notify: "Notify client",
  notify_title: "Message to client",
  notify_after_status: "Status: {s}. Notify the client?",
  notify_lang: "Message language",
  notify_to: "To: {p}",
  notify_to_none: "Client phone is missing (needs the country-code format, e.g. +…). WhatsApp will let you pick a contact.",
  notify_wa: "Send via WhatsApp",
  notify_tg: "Send via Telegram",
  notify_tg_user: "Open chat with @{u}",
  notify_tg_copied: "Text copied — paste it into the chat",
  notify_no_link: "The client link is disabled, so it is not in the message. Create a new one in “Client link”.",
  notify_no_price: "The client price is not set, so amounts were left out of the message.",
  notify_auto: "Offer after a status change",
  notify_later: "Not now",
  f_dates: "Dates",
  more_actions: "More actions",
  tg_title: "Telegram notifications",
  tg_step1: "In Telegram open @BotFather → Start → send /newbot → choose a name and a username ending in bot → copy the token.",
  tg_step2: "Supabase → Edge Functions → Secrets → add TELEGRAM_BOT_TOKEN with the token as the value.",
  tg_step3: "Open your new bot in Telegram and press Start.",
  tg_step4: "Press the button below — the bot will send “✅ Notifications connected”.",
  tg_connect: "Connect Telegram",
  tg_on: "✅ Connected: {name}. Bot {bot} will message you about every new request.",
  tg_off_bot: "Bot {bot} found but not connected yet. Press Start in it, then the button below.",
  tg_no_token: "The bot is not added to Supabase yet (step 2).",
  tg_bad_token: "The bot token is wrong. Check the TELEGRAM_BOT_TOKEN secret (step 2).",
  tg_no_start: "The bot can't see your message. Open the bot in Telegram, press Start and try again.",
  tg_connected: "Done! Check Telegram.",
  tg_error: "Couldn't reach the bot. Please try again.",
  support: "Support",
  nav_support: "Support",
  support_title: "Tech support",
  support_hint: "Something not working or have a question? Write here — the administrator will reply in this window.",
  support_placeholder: "Message…",
  sp_attach: "Attach a photo or file",
  sp_file: "File",
  sp_photo: "Screenshot",
  sp_too_many_files: "Up to 6 files at a time",
  sp_bad_type: "This file type can’t be sent. Allowed: photos, video, PDF, Word, Excel, text",
  sp_too_big: "File is larger than 20 MB",
  sp_upload_failed: "Upload failed — tap the message to retry",
  sp_typing: "typing",
  sp_online: "online",
  sp_team: "ULA Factory support · we reply right here",
  sp_today: "Today",
  sp_yesterday: "Yesterday",
  sp_retry: "Not sent — tap to retry",
  support_send: "Send",
  support_note: "Technical details are attached automatically: site section, browser and recent errors. Passwords and client data are not sent.",
  support_empty: "Hello! Tell us what happened — we'll reply in this window. A new reply shows a red number on the 💬 icon.",
  support_none: "No messages yet.",
  support_sent: "Message sent",
  support_new: "New support message",
  support_reply_new: "Support replied — open 💬",
  fx_new_req: "New exchange request",
  push_on: "Turn on notifications",
  push_retry: "Try again",
  push_t_off: "Notifications are off",
  push_d_off: "Turn them on to hear a sound and get alerts about requests and messages, even when the app is closed.",
  push_t_fail: "Notifications did not connect",
  push_d_fail: "Permission is granted, but the phone did not subscribe. Tap again; if it does not help, contact support.",
  push_t_denied: "Notifications are blocked",
  push_d_denied: "You blocked notifications. Allow them in phone settings: Settings → ULA (or the browser) → Notifications → Allow. Then reopen the app.",
  push_t_ios: "On iPhone, notifications work only from the app",
  push_d_ios: "Tap “Share” (square with an arrow) → “Add to Home Screen”. Open ULA from the home screen and turn on notifications here.",
  push_ok_toast: "Notifications are on — a test one is coming",
  push_fail_toast: "Could not connect notifications",
  push_test_body: "Notifications work ✅",
  kyc_new_ping: "New identity check — open “Exchange”",
  kyc_approve: "Approve — give access",
  kyc_ok_done: "Done: buyer verified, exchange for clients is now open",
  kyc_no_done: "Rejected — the buyer will see the reason",
  kyc_t_front: "Document",
  kyc_t_back: "Back side",
  kyc_t_selfie: "Selfie",
  support_too_many: "Too many messages. Please wait a little.",
  support_admin_title: "Buyer requests",
  support_admin_hint: "Buyers' support messages. New ones are on top with a red number. Tap to open the conversation and reply.",
  support_no_threads: "No requests yet.",
  support_tech: "Technical details",
  support_you: "You",
  support_team: "Support",
  support_buyer: "Buyer",
  q_rates_title: "My rates",
  q_rates_hint: "Rates you saved. They are filled into the price quote and new orders. Tap a rate to pick that currency pair.",
  fx_my_label: "My rate: 1 {a} = ? {b}",
  fx_my_save: "Save my rate",
  fx_my_bad: "Enter a rate greater than zero",
  fx_my_deleted: "Rate deleted",
  fx_my_empty: "No rates yet. Pick currencies above, enter a rate and tap “Save my rate”.",
  fx_by_my: "At your rate",
  fx_by_market: "At market rate (your rate is not set)",
  fx_market: "Market rate for reference: {r}. Leave the field empty and tap Save to use it.",

  warehouse_title: "Warehouse in China",
  copy_address: "Copy address",
  copied: "Copied",

  sum_orders: "Total orders",
  sum_total: "Due from clients",
  sum_paid: "Paid",
  sum_debt: "Owed by clients",
  sum_note: "Cancelled orders excluded. Each currency is totalled separately.",
  as_title: "To do today",
  as_admin_title: "Admin assistant",
  ai_title: "AI assistant",
  ai_placeholder: "Ask anything about buyers, orders, profit — or ask for a message to a supplier",
  ai_send: "Ask",
  ai_thinking: "Thinking…",
  ai_note: "Questions are processed by Google Gemini. Client names, phones and addresses are not sent.",
  ai_ex1: "Which buyer earned the most this month?",
  ai_ex2: "How many orders are in transit now?",
  ai_ex3: "Write to the supplier in Chinese: shipment is postponed by 3 days",
  ai_ex4: "Which buyers have the most client debt?",
  ai_err_key: "AI isn't connected yet: a Gemini key is needed in Supabase.",
  ai_err_limit: "Too many questions in a row. Wait a minute.",
  ai_err: "The AI isn't responding right now. Try again in a minute.",
  as_all_good: "All good — nothing to fix",
  as_show: "Show",
  as_open: "Open",
  as_filter: "Showing: {t}",
  h_no_price: "Orders without a client price: {n}. Profit isn't calculated for them.",
  h_no_address: "Client hasn't added a delivery address: {n}. Send them the order link.",
  h_loss: "Order {num} is at a loss: {sum}. Check the client price.",
  h_no_rate: "Orders without an exchange rate: {n}. Totals are wrong.",
  h_stuck: "Order {num} hasn't changed for {days} days. Update the status for the client.",
  h_debt: "Client {name} owes {sum} (order {num} has arrived).",
  h_no_wh: "Your China warehouse address is missing. Add it in Settings.",
  h_profit_month: "Profit this month: {sum}.",
  ha_new: "New buyers in the last 7 days: {n}.",
  ha_idle: "{name} signed up {days} days ago and hasn't created any orders yet.",
  ha_blocked: "Blocked buyers: {n}.",
  ha_total: "Workspaces: {n}, orders across all workspaces: {o}.",

  filter_all: "All",
  filter_new: "New",
  filter_awaiting_payment: "Awaiting payment",
  filter_purchasing: "Purchasing",
  filter_china_warehouse: "In warehouse",
  filter_in_transit: "In transit",
  filter_arrived: "Arrived",
  filter_delivered: "Delivered",
  filter_cancelled: "Cancelled",
  search_placeholder: "Search: number, client, phone, city, product, supplier",
  date_from: "From",
  date_to: "To",
  reset: "Reset",

  new_order: "New order",
  edit_order: "Edit order",
  open: "Open",
  edit: "Edit",
  remove: "Delete",
  change_status: "Change status",
  client_link: "Client link",
  save: "Save order",
  saving: "Saving…",
  cancel: "Cancel",
  close: "Close",
  a11y_back: "Back",
  a11y_prev: "Previous photo",
  a11y_next: "Next photo",
  copy: "Copy",
  add_photos: "Add photos",

  status_new: "New",
  status_awaiting_payment: "Awaiting payment",
  status_purchasing: "Purchasing",
  status_china_warehouse: "At China warehouse",
  status_in_transit: "In transit",
  status_arrived: "Arrived",
  status_delivered: "Delivered",
  status_cancelled: "Cancelled",

  sec_main: "Main",
  sec_client: "Client",
  sec_product: "Product and supplier",
  sec_money: "Price and payment",
  sec_photos: "Product photos",
  sec_comments: "Comments",
  f_order_number: "Order number",
  f_date: "Date",
  f_status: "Status",
  f_client: "Client",
  f_phone: "Client phone",
  f_wechat: "Client WeChat",
  f_product_ru: "Product (Russian)",
  f_product_zh: "Product (Chinese)",
  f_supplier: "Supplier",
  f_link: "1688 / Alibaba link",
  f_supplier_wechat: "Supplier WeChat",
  l_supplier_wechat: "Supplier WeChat",
  f_purchase_currency: "Purchase currency (supplier)",
  f_client_currency: "Client currency",
  f_price_cur: "Unit price, {c}",
  f_rate_cur: "Rate: 1 {a} = ? {b}",
  f_rate_same: "Rate (same currency)",
  f_delivery_cur: "Shipping amount, {c}",
  f_paid_cur: "Paid by client, {c}",
  f_markup: "Markup, %",
  f_markup_hint: "Enter a percentage — the client price is calculated for you",
  f_client_price_cur: "Price for client, {c}",
  f_client_price_hint: "The client sees this. Cost and profit are visible only to you.",
  c_cost: "Cost (goods + shipping)",
  c_client_price: "Price for client",
  c_profit: "Your profit",
  l_cost: "Cost",
  l_client_price: "Amount due",
  l_profit: "Profit",
  sum_profit: "Profit",
  cl_due: "Amount due",
  cl_left: "Left to pay",
  no_price: "No client price",
  k_goods: "Goods",
  k_delivery: "Shipping (cargo)",
  k_payment: "Client payment",
  f_delivery_currency: "Shipping currency",
  f_tariff_cur: "Rate per 1 kg, {c}",
  f_delivery_rate_cur: "Shipping rate: 1 {a} = ? {b}",
  f_delivery_hint: "Calculated automatically: weight × rate. You can enter it manually.",
  s_def_delivery: "Default shipping currency",
  s_def_tariff: "Default rate per 1 kg",
  s_def_purchase: "Default purchase currency",
  s_def_client: "Default client currency",
  s_currency_hint: "Used for every new order. You can change them in each order.",
  f_qty: "Quantity",
  f_price: "Unit price, ¥",
  f_rate: "Rate ¥ → som",
  f_weight: "Weight, kg",
  f_delivery: "Shipping cost, som",
  f_paid: "Paid by client, som",
  f_delivery_info: "Delivery info (client sees it)",
  f_comment_client: "Note for client (client sees it)",
  f_comment_admin: "Internal note (only you)",

  c_title: "Calculation",
  c_goods_cny: "Goods cost",
  c_goods_som: "Goods in client currency",
  c_delivery: "Shipping",
  c_total: "Total",
  c_paid: "Paid",
  c_balance: "Balance due",

  l_qty: "Quantity",
  l_price: "Price",
  l_rate: "Rate",
  l_weight: "Weight",
  l_goods_som: "Goods in client currency",
  l_delivery: "Shipping",
  l_total: "Total",
  l_paid: "Paid",
  l_balance: "Balance due",
  l_supplier: "Supplier",
  l_phone: "Phone",
  l_wechat: "WeChat",
  l_link: "Link",
  l_comment: "Comment",
  l_comment_admin: "Internal note",
  l_comment_client: "Note for client",
  l_delivery_info: "Delivery info",
  l_photos: "Photos",
  l_name: "Full name",
  l_telegram: "Telegram",
  l_city: "City",
  l_address: "Address",
  l_pickup: "Pickup point",
  l_orders: "Orders",
  l_added: "Added",
  pcs: "pcs",
  kg: "kg",
  som: "som",

  cb_title: "Client delivery details",
  cb_empty: "The client hasn't filled in their details yet. Send them the order link.",
  no_delivery_data: "No address",

  clients_search: "Search by name or phone",
  clients_count: "Clients: {n}",
  export_csv: "Export to Excel",
  export_done: "Excel file downloaded",
  x_made: "Exported {d}",
  x_count: "Rows: {n}",
  x_total: "TOTAL",
  bulk_select: "Select",
  bulk_done_btn: "Done",
  bulk_n: "Selected: {n}",
  bulk_all: "All ({n})",
  bulk_none: "Clear all",
  bulk_status: "Status…",
  bulk_cancel: "Cancel",
  bulk_set_for: "New status for orders: {n}",
  bulk_same: "The selected orders already have this status",
  bulk_changed: "Status changed for orders: {n}",
  bulk_q_title: "Notify clients",
  bulk_q_hint: "Status changed. Tap “Notify” for each order — a ready WhatsApp text will open.",
  bulk_q_next: "Notify next (left: {n})",
  bulk_q_all: "Everyone notified",
  bulk_q_again: "Again",
  q_for: "Quote for request № {n} ({name})",
  q_for_cancel: "Detach",
  q_apply: "Apply to request",
  rq_calc: "Calculate price",
  menu_main: "Main",
  menu_money: "Money",
  menu_more: "Tools",
  tk_late_by: "The stated date passed {n} days ago.",
  tk_ask: "Ask your buyer",
  tk_src_dates: "The arrival dates were set by your buyer. This is not carrier data.",
  tk_src_days: "The delivery time in days from dispatch was set by your buyer. This is not carrier data.",
  tk_src_usual: "This is the usual time for this cargo, not carrier data for your parcel.",
  fin_approx: "Profit is approximate: based on the entered prices, rate and delivery. Refunds, fees and exchange-rate differences are not included.",
  fin_approx_short: "≈ excl. refunds and fees",
  im_steps: "Import steps",
  im_s_file: "File",
  im_s_map: "Columns",
  im_s_check: "Check",
  im_s_done: "Done",
  im_next: "Check rows",
  im_back_cols: "Back to columns",
  im_dups_file: "Repeated in the file: {n} — will be loaded once.",
  im_c_ready: "will be loaded",
  im_c_warn: "with notes",
  im_c_skip: "skipped",
  im_c_total: "rows in file",
  im_c_issues: "Notes by row",
  im_c_all_ok: "All rows are fine.",
  im_c_row: "Row {n}",
  im_c_row_photo: "Entry {n}",
  im_c_will_load: "will load",
  im_c_will_skip: "will skip",
  im_c_more: "{n} more rows with notes — all are in the report.",
  im_c_safe: "Nothing changes in your workspace until you press “Load”. If an error occurs, orders will not be loaded partially.",
  im_report: "Download check report (CSV)",
  im_rep_line: "Row",
  im_rep_result: "Result",
  im_rep_notes: "Notes",
  im_rep_ok: "will be loaded",
  im_rep_ok_warn: "will be loaded, please check",
  im_rep_skip: "skipped",
  im_r_no_client: "no client name",
  im_r_dup_cabinet: "this order already exists in the workspace",
  im_r_dup_file: "repeat of row {n}",
  im_r_date: "date not recognised — today's date will be used",
  im_r_status: "status not recognised — the default status will be used",
  im_r_price: "amount is not a number — amount left empty",
  im_r_paid: "payment is not a number — payment set to 0",
  im_r_qty: "quantity not recognised — 1 pc",
  im_r_phone: "phone without country code — saved as is",
  im_r_overpaid: "paid more than the amount — please check",
  im_r_formula: "text looked like an Excel formula — the formula sign was removed",
  im_r_cost: "no yuan rate — cost saved as delivery",
  im_r_unsure: "handwriting unclear — compare with the photo",
  im_failed_none: "Nothing was loaded: an error occurred while saving. Nothing changed in your workspace — you can try again.",
  im_rolled_back: "The import stopped because of an error. Orders already loaded ({n}) were removed automatically — nothing changed in your workspace.",
  cc_open: "Profile",
  cc_title: "Client profile",
  cc_none: "Client not found. Refresh the client list.",
  cc_call: "Call",
  cc_write: "Message the client",
  cc_no_contact: "No phone with country code and no Telegram — you can't message from here.",
  cc_orders: "Orders",
  cc_active: "In progress",
  cc_debt: "Owes",
  cc_overdue: "Overdue",
  cc_paid_total: "Paid for orders: {s}",
  cc_new_order: "New order",
  cc_repeat_last: "Repeat № {n}",
  cc_open_debt: "Open debts",
  cc_wallet: "Balance",
  cc_orders_list: "Orders",
  cc_left: "{s} left",
  cc_more: "{n} more orders — see “Orders”",
  cc_no_orders: "No orders yet.",
  cc_payments: "Payments",
  cc_no_payments: "No payments in history.",
  cc_history: "Status changes",
  cc_no_history: "No status history yet.",
  tpl_title: "Quick start:",
  tpl_1688: "Order from 1688",
  tpl_taobao: "Order from Taobao",
  tpl_repeat: "Repeat order",
  tpl_note_platform: "“{name}” template: purchase in yuan, today's rate, the platform is set as supplier. Paste the product link. You can change everything.",
  tpl_note_repeat: "Repeat of order № {n}. Client, product, supplier, currencies and tariff are copied; rates are today's. Client price, payment, weight, tracking number, photos and notes are not copied — fill them in again.",
  tpl_note_addr: "The delivery address was not copied: it is not confirmed. Check it with the client.",
  gm_f_client: "client phone",
  gm_f_photo: "product photo",
  gm_f_track: "tracking number",
  gm_ring: "{p}% filled in",
  gm_full: "Order fully filled in",
  gm_fill_title: "{p}% filled in",
  gm_fill_n: "{a} of {b}",
  gm_sum: "Fully filled in: {a} of {b}",
  gm_full_toast: "Order fully filled in! 🎉",
  gm_alldone: "All done for today!",
  gm_alldone_toast: "All of today's tasks are closed! 🎉",
  gm_alldone_streak: "Days in a row: {n}. Keep it up!",
  gm_alldone_first: "Day one of your streak. Tomorrow is day two!",
  gm_best: "Record: {n} days in a row",
  gm_streak_ok: "Days in a row: {n}",
  gm_streak_keep: "Days in a row: {n} — close today's tasks to keep the streak",
  gm_week: "Last week",
  gm_w_orders: "new orders",
  gm_w_done: "delivered",
  gm_w_clients: "new clients",
  gm_level: "Your level",
  gm_points: "{n} points",
  gm_lv_novice: "Beginner",
  gm_lv_buyer: "Buyer",
  gm_lv_skilled: "Experienced",
  gm_lv_pro: "Pro",
  gm_lv_master: "ULA Master",
  gm_lv_next: "{n} more points to “{l}”",
  gm_lv_max: "Top level — you are a ULA Master",
  gm_how: "How to earn points",
  gm_how_text: "Delivered order — 10 points, fully filled order — 5, new client — 2, returning client — 10 more. Points come from the workspace orders, so they are the same on every device.",
  gm_rw_frame: "“Buyer” level: frame around your profile photo",
  gm_rw_gold: "“Pro” level: gold button color",
  gm_lvup: "New level!",
  gm_lvup_ok: "Great!",
  gm_badges: "Badges",
  gm_badge_new: "New badge: “{b}”",
  pf_col_gold: "Gold",
  gm_b_first: "First order",
  gm_b_first_how: "Add your first order",
  gm_b_deliv1: "First delivery",
  gm_b_deliv1_how: "Deliver your first order",
  gm_b_deliv10: "10 deliveries",
  gm_b_deliv10_how: "Deliver 10 orders",
  gm_b_deliv50: "50 deliveries",
  gm_b_deliv50_how: "Deliver 50 orders",
  gm_b_repeat: "Returning client",
  gm_b_repeat_how: "A client placed a second order",
  gm_b_clients10: "10 clients",
  gm_b_clients10_how: "Work with 10 clients",
  gm_b_full10: "Neat",
  gm_b_full10_how: "Fully fill in 10 orders",
  gm_b_tracked: "All tracked",
  gm_b_tracked_how: "All shipped orders (5+) have a tracking number",
  gm_b_paid: "No debts",
  gm_b_paid_how: "5+ delivered orders, all paid",
  gm_b_alldone: "All done",
  gm_b_alldone_how: "Close all of today's tasks",
  gm_b_streak7: "Week streak",
  gm_b_streak7_how: "Close all tasks 7 days in a row",
  menu_goods: "Goods & delivery",
  menu_admin: "Management",
  nav_fmap: "Factory map",
  nav_all: "All sections",
  r_back: "← Back to analytics",
  an_detail: "Details: by month, client and product",
  s_menu_sections: "Menu sections",
  s_show_shipments: "Show “Shipments”",
  s_show_suppliers: "Show “Suppliers”",
  ob_title: "Start with 4 steps",
  ob_progress: "{a} of {b}",
  ob_wh: "Add your warehouse address in China",
  ob_rates: "Set your own exchange rates",
  ob_link: "Create a link for client requests",
  ob_order: "Add your first order",
  ob_hide: "Hide this tip",
  tgw_title: "Telegram: client requests",
  tgw_hint: "Connect Telegram and new client requests will arrive in your chat from the bot — no need to check the site.",
  tgw_off: "Telegram is not connected.",
  tgw_on: "Connected: {n}. New requests arrive in this chat.",
  tgw_unavailable: "This is not available yet. Try again later.",
  tgw_start: "Connect Telegram",
  tgw_open: "1. Open Telegram and press Start",
  tgw_check: "2. I pressed Start — check",
  tgw_disable: "Disconnect Telegram",
  tgw_done: "Telegram connected",
  tgw_no_bot: "Could not reach the bot. Contact support.",
  tgw_no_start: "I do not see Start pressed. Open the link, press Start in Telegram and check again.",
  tgw_expired: "Connection time expired. Start again.",
  tgw_confirm_off: "Disconnect Telegram notifications about requests?",
  tgw_off_done: "Telegram disconnected",
  pay_owe: "Owes {s}",
  pay_full: "Paid in full",
  cl_page_hint: "All your clients: contacts, delivery addresses and their orders.",
  sup_page_hint: "Factories and sellers in China you buy from.",
  s_current_password: "Current password",
  s_current_hint: "Only needed if you change your password.",
  e_current_password: "To change your password, enter your current password.",
  e_current_wrong: "The current password is wrong.",
  password_repeat: "Repeat password",
  e_password_match: "Passwords do not match. Enter the same one in both fields.",
  mfa_title: "Sign-in with a code (2FA)",
  mfa_hint: "Extra protection: after your password the site asks for a 6-digit code from an app on your phone. Even if your password is stolen, no one can sign in without your phone.",
  mfa_off: "Sign-in with a code is off.",
  mfa_on: "Sign-in with a code is on.",
  mfa_start: "Turn on sign-in with a code",
  mfa_disable: "Turn off sign-in with a code",
  mfa_step1: "Install Google Authenticator (or Authy, 1Password) on your phone.",
  mfa_step2: "In the app tap “Add” and scan this QR code. If that fails, enter the key manually.",
  mfa_secret: "Key:",
  mfa_step3: "6-digit code from the app",
  mfa_confirm: "Confirm and turn on",
  mfa_cancel: "Cancel",
  mfa_err_code: "Enter the 6 digits from the app.",
  mfa_err_wrong: "Wrong code. Check the time on your phone and try again.",
  mfa_done: "Sign-in with a code is on",
  mfa_off_done: "Sign-in with a code is off",
  mfa_confirm_off: "Turn off sign-in with a code? The account will be less protected.",
  mfa_confirm_off_admin: "Turn off the administrator code sign-in? The account that sees all buyers will be less protected.",
  mfa_login_title: "Enter the code",
  mfa_login_hint: "Open the authenticator app on your phone and enter the 6-digit code for this site.",
  mfa_login_btn: "Sign in",
  mfa_banner: "Turn on sign-in with a code: your account sees all buyers, so protect it first.",
  mfa_banner_btn: "Turn on",
  mfa_off_code: "To turn off, enter the current 6-digit code from the app",
  captcha_err: "The “I am not a robot” check failed. Refresh the page and try again.",
  tour_btn: "Tutorial",
  tour_step: "Step {a} of {b}",
  tour_start: "Show me",
  tour_next: "Next",
  tour_back: "Back",
  tour_skip: "Skip",
  tour_finish: "Start working",
  tour_welcome_t: "Welcome to ULA Factory!",
  tour_welcome: "In a minute I will show you how it works. You can skip and come back later: menu → “Tutorial”.",
  tour_menu_t: "Sections",
  tour_menu: "All sections are here: Orders, Clients, Debts, Analytics, Price quote. Tap to switch between them.",
  tour_wh_t: "Warehouse in China",
  tour_wh: "This is your warehouse address. Tap “Copy address” and send it to the supplier. Enter your own address via “Edit”.",
  tour_link_t: "Link for requests",
  tour_link: "Create a link and send it to a client in a messenger. The client leaves the product link and quantity, and a new order appears for you.",
  tour_new_t: "New order",
  tour_new: "This is how you add an order by hand: client, product, price, weight. Status, debt and profit are calculated automatically.",
  tour_chips_t: "Order statuses",
  tour_chips: "Orders by stage: New, Awaiting payment, In transit and so on. Tap a status to see only those orders.",
  tour_card_t: "Order card",
  tour_card: "You see the amount, what is paid and the debt. “Notify client” prepares a WhatsApp text. The “⋯” button opens the client link, edit and status change.",
  tour_bulk_t: "Select several",
  tour_bulk: "Tick several orders and change the status for all at once. Then the site shows which clients to message.",
  tour_menu2_t: "Money and tools",
  tour_menu2: "Debts: who owes how much and a ready reminder. Analytics: profit and charts. Price quote: quickly answer a client “how much will it be”.",
  tour_fx_t: "Currency exchange",
  tour_fx: "Need to pay a supplier in yuan? Swap som for yuan with verified people. The site holds the money until you confirm receipt, and support helps in a dispute.",
  tour_settings_t: "Settings",
  tour_settings: "Rates and currencies, warehouse, Telegram for requests, sign-in with a code (2FA) and team assistants are here.",
  tour_support_t: "Need help?",
  tour_support: "Something does not work or is unclear? Tap here and write, we reply right in the window.",
  tour_done_t: "Done!",
  tour_done: "Start with the “Start with 4 steps” card on the orders page: warehouse, rates, request link and your first order. You can repeat the tutorial any time: menu → “Tutorial”.",
  refresh_menu: "Refresh data",
  forgot_link: "Forgot password?",
  reset_title: "Password recovery",
  reset_hint: "Enter the email you signed up with. We will send a letter with a link to set a new password.",
  reset_send: "Send letter",
  reset_sent: "If {e} is registered, we sent a letter with a link. Check your inbox and the Spam folder.",
  reset_wait: "A letter was sent recently. Wait a minute and try again.",
  newpass_title: "New password",
  newpass_hint: "Choose a new password and enter it twice. At least 8 characters.",
  newpass_save: "Save and sign in",
  auth_tag: "Buyer workspace: orders from China under control",
  auth_b1: "Orders, payments and delivery in one place",
  auth_b2: "Clients track their order by a link",
  auth_b3: "Profit and debts at a glance",
  auth_err_google: "Google could not finish sign-in. Supabase may have an old or incorrect Google secret. Sign in with email and password for now. To fix it: Google Cloud → APIs & Services → Credentials → your OAuth client → create a new Client secret; then Supabase → Authentication → Sign In / Providers → Google → paste it and click Save. Never send the secret to anyone.",
  auth_err_expired: "The link from the email has expired or was already used. Tap “Forgot password?” and request a new one.",
  auth_err_generic: "Could not sign in. Please try again",
  nav_shop: "Storefront",
  sh2_page_hint: "Your mini shop: add products with a photo and price and send clients one link.",
  sh2_add: "Product",
  sh2_edit: "Edit product",
  sh2_link_title: "Storefront link",
  sh2_link_off: "No link yet. Create it and send it to clients in WhatsApp, Instagram, Telegram.",
  sh2_link_make: "Create storefront link",
  sh2_wa_text: "Hello! My products from China — choose and leave a request:",
  sh2_none: "No products yet. Tap “+ Product” and add a photo, title and price.",
  sh2_hidden: "Hidden",
  sh2_saved: "Product saved",
  sh2_err_db: "This section is not connected yet. Contact support.",
  sh2_photo_pick: "Choose photo",
  sh2_photo_del: "Remove photo",
  sh2_f_title: "Product title",
  sh2_f_price: "Client price per item (optional)",
  sh2_f_desc: "Description: sizes, colours, lead time (optional)",
  sh2_f_active: "Show in storefront",
  sh2_e_title: "Enter the product title",
  sh2_e_price: "Check the price",
  sh2_e_photo: "Choose an image (JPG or PNG)",
  sh2_confirm_del: "Delete “{n}” from the storefront?",
  sh2_title: "Storefront",
  sh2_hint: "Choose a product and leave a request — the seller will contact you.",
  sh2_empty: "No products yet. Check back later.",
  sh2_price_ask: "Price on request",
  sh2_all: "All products",
  sh2_order: "Order",
  sh2_sent_text: "{n} received your order and will contact you soon.",
  sh2_back: "Back to storefront",
  sh2_gone: "This product is no longer available. Go back and choose another one.",
  sh2_nf_title: "Storefront not found",
  sh2_nf_text: "The link is disabled or outdated. Ask the seller for a new one.",
  rq_e_tg: "Check the Telegram username: 5–32 Latin letters, digits or _",
  bc_btn: "Broadcast",
  bc_title: "Message clients",
  bc_hint: "Choose who to message and the text. Each client's button opens WhatsApp with a ready message — you just tap “Send”.",
  bc_who: "Who",
  bc_what: "Text",
  bc_seg_buyers: "Bought before",
  bc_seg_debtors: "Owe money",
  bc_seg_sleeping: "Inactive for a while",
  bc_seg_all: "Everyone",
  bc_tpl_promo: "Promotion",
  bc_tpl_arrivals: "New arrivals",
  bc_tpl_debt: "Payment reminder",
  bc_tpl_custom: "Own text",
  bc_text: "Message",
  bc_text_hint: "{имя} becomes the client's name, {долг} the amount they owe.",
  bc_count: "Clients: {n}, left to message: {left}",
  bc_next: "Message the next one in WhatsApp ({n} left)",
  bc_none: "No matching clients. Choose another group.",
  bc_owes: "owes {s}",
  bc_e_text: "Enter the message text",
  nav_expenses: "Expenses",
  nav_volume: "Volumetric weight",
  trk_title: "Tracking number",
  trk_short: "Track",
  trk_where: "Where is my parcel?",
  trk_hint: "Tap “Where is my parcel?” to see where the cargo is now.",
  f_tracking: "Tracking number",
  f_tracking_hint: "The client will see it on their order page and in the “on the way” message.",
  copied_track: "Tracking number copied",
  vol_title: "Volumetric weight",
  vol_hint: "Enter the box size — the site calculates volume, volumetric weight and density. Carriers charge for the larger one: actual or volumetric weight.",
  vol_box: "Size of one box, cm",
  vol_l: "Length",
  vol_w: "Width",
  vol_h: "Height",
  vol_n: "Boxes",
  vol_kg: "Weight, kg",
  vol_kg_ph: "optional",
  vol_kg_mode: "Weight is",
  vol_kg_total: "total",
  vol_kg_box: "per box",
  vol_how: "How the carrier counts",
  vol_div_6000: "Air ÷6000",
  vol_div_5000: "Express ÷5000",
  vol_div_cargo: "Cargo (density)",
  vol_r_m3: "Volume",
  vol_r_vol: "Volumetric weight",
  vol_r_weight: "Actual weight",
  vol_r_density: "Density",
  vol_r_pay: "Chargeable weight",
  vol_kgm3: "kg/m³",
  vol_by_volume: "charged by volume — the box is light but big",
  vol_by_weight: "charged by actual weight",
  vol_light: "Density below 200 kg/m³ — light cargo. Cargo companies usually charge per cubic metre, not per kg.",
  vol_heavy: "Density 200 kg/m³ or more — cargo companies usually charge per kg.",
  vol_empty: "Enter length, width and height.",
  vol_apply: "Put weight into the order: {n} kg",
  vol_applied: "Weight added",
  vol_by_size: "Calculate by size",
  q_more_extra: "+ Costs in China (to warehouse, commission, packing)",
  q_extra_cur: "Costs in China, total, {c}",
  q_extra_hint: "Everything you pay in China on top of the goods price: supplier delivery to the warehouse, agent commission, packing, bank fees. It is part of your cost and of the client price. It is not shown to the client as a separate line.",
  q_dm_kg: "Cargo charges by weight (kg)",
  q_dm_m3: "Cargo charges by volume (m³)",
  q_lbl_volume: "Total volume, m³",
  f_tariff_m3_cur: "Rate per 1 m³, {c}",
  c_extra: "Costs in China",
  c_cost_unit: "Cost per 1 pc",
  c_profit_unit: "Profit per 1 pc",
  vol_per: "Pieces per box",
  vol_kg_unit: "per piece",
  vol_boxes: "Boxes in total",
  vol_need_qty: "Enter the total number of pieces so the boxes are counted automatically.",
  vol_apply_m3: "Put volume in: {n} m³",
  vol_applied_m3: "Volume added",
  pr_print: "Print / Save as PDF",
  pr_how: "A new tab will open. To get a PDF, choose “Save as PDF” in the print window.",
  inv_none: "Only orders that are not cancelled can go into an invoice",
  inv_btn: "PDF invoice",
  inv_btn_short: "Invoice",
  inv_title: "Invoice",
  inv_title_modal: "Invoice for the client (PDF)",
  inv_sum: "Orders: {n}. Clients: {c} — each client gets their own page.",
  inv_no_price: "{n} order(s) have no price yet — they will show a dash.",
  inv_pay_label: "How to pay (optional)",
  inv_pay_ph: "For example: bank, card or account number, recipient name",
  inv_pay_hint: "The site will remember this text for the next invoices.",
  inv_make: "Make invoice",
  inv_to: "Client",
  inv_c_order: "Order",
  inv_c_product: "Product",
  inv_c_qty: "Qty",
  inv_c_sum: "Amount",
  inv_c_left: "Left",
  inv_total: "Total",
  inv_due: "To pay",
  inv_pay: "How to pay",
  inv_thanks: "Thank you for your order!",
  lb_btn: "QR label",
  lb_btn_short: "Labels",
  lb_title: "Labels with QR code",
  lb_hint: "The label shows order number, client, phone, city, product and weight. The QR code holds the same data — the warehouse scans it with a phone camera.",
  lb_size: "Size",
  lb_size_58x40: "58×40 mm (thermal)",
  lb_size_100x70: "100×70 mm",
  lb_size_a4: "A4 sheet (8 pcs)",
  lb_places: "Packages (boxes) per order",
  lb_places_hint: "If there are 3 boxes, you get 3 labels: “Package 1 of 3”, “2 of 3”, “3 of 3”.",
  lb_sum: "Orders: {o}, labels: {n}",
  lb_make: "Print labels",
  lb_place: "Package {a} of {b}",
  ex_hint: "Rent, salaries, ads and other costs. Only you can see them. Net profit = profit from orders − expenses.",
  ex_add: "Add expense",
  ex_edit: "Edit expense",
  ex_orders_profit: "Profit from orders",
  ex_spent: "Expenses",
  ex_net: "Net profit",
  ex_net_hint: "Profit is counted from {n} priced orders (not cancelled) in this period.",
  ex_by_cat: "Where the money goes",
  ex_list: "All expenses ({n})",
  ex_empty: "No expenses in this period. Tap “Add expense” — for example, warehouse rent or ads.",
  ex_cat_rent: "Rent",
  ex_cat_salary: "Salary",
  ex_cat_ads: "Advertising",
  ex_cat_transport: "Transport and taxi",
  ex_cat_packing: "Packing and warehouse",
  ex_cat_phone: "Phone and internet",
  ex_cat_fees: "Fees and transfers",
  ex_cat_other: "Other",
  ex_f_cat: "What for",
  ex_f_amount: "Amount",
  ex_f_cur: "Currency",
  ex_f_date: "Date",
  ex_f_note: "Note",
  ex_f_note_ph: "For example: warehouse rent, October",
  ex_e_amount: "Enter an amount above zero",
  ex_confirm_del: "Delete this expense?",
  ex_saved: "Expense saved",
  ex_deleted: "Expense deleted",
  an_net: "Expenses {s} → net profit",
  an_net_add: "Add expenses to see your net profit",
  filter_active: "In progress",
  done_hidden: "Delivered and paid: {n} — hidden from the main screen",
  done_all_title: "All orders delivered",
  done_all_text: "No new or active orders. Delivered and paid ones are under “Delivered”.",
  progress_step: "Step {a} of {b}",
  im_menu: "Import from Excel",
  im_btn: "From Excel",
  im_title: "Import old orders",
  im_empty_btn: "Import old orders from Excel",
  ob_import: "Move your old orders from Excel — takes a couple of minutes",
  im_hint: "Move your old orders in a couple of minutes — from an Excel table or a notebook photo.",
  im_drop: "Drop the file here",
  im_pick: "Choose file",
  im_formats: "Excel (.xlsx) or CSV",
  im_tip1: "Any of your tables will do: the first row is headers (Date, Client, Phone, Product, Amount, Paid, Status…). Column order doesn't matter.",
  im_tip2: "Google Sheets: File → Download → Microsoft Excel (.xlsx). Old .xls file: in Excel “Save as” → .xlsx.",
  im_template: "Download a sample table",
  im_e_xls: "This is the old .xls format. Open it in Excel and save as .xlsx (File → Save as → Excel Workbook).",
  im_e_big: "The file is larger than 15 MB. Split it into several parts.",
  im_e_empty: "No order rows were found in the file.",
  im_e_read: "Couldn't read the file. Make sure it's Excel (.xlsx) or CSV and try again.",
  im_file: "File “{f}” — rows: {n}",
  im_cols: "What each column means",
  im_cols_hint: "The site guessed by itself. Check and fix if needed. “Client” is required, the rest is optional.",
  im_more: "More fields ({n})",
  im_more_rows: "…and {n} more",
  im_sum: "Amount",
  im_none: "— none —",
  im_col: "Column {n}",
  im_f_date: "Date",
  im_f_client: "Client",
  im_f_phone: "Phone",
  im_f_product: "Product",
  im_f_qty: "Qty",
  im_f_price: "Amount for client",
  im_f_paid: "Paid",
  im_f_cost: "Cost",
  im_f_weight: "Weight, kg",
  im_f_status: "Status",
  im_f_tracking: "Tracking number",
  im_f_number: "Order number",
  im_f_supplier: "Supplier",
  im_f_currency: "Currency",
  im_f_comment: "Comment",
  im_cur: "Currency of amounts",
  im_status_def: "Status if the row has none",
  im_status_hint: "Old orders are usually already delivered — “Delivered”. Delivered and paid ones won't clutter the main screen.",
  im_preview: "This is how orders will appear",
  im_skip: "Rows to skip: {n} — they have no client name.",
  im_dups: "Already in your account: {n} — won't be added twice.",
  im_cut: "Up to {n} orders per import — upload the rest in a second file.",
  im_need_client: "Choose which column has the client name.",
  im_back: "Another file",
  im_go: "Import orders ({n})",
  im_go_none: "Nothing to import",
  im_progress: "Importing… {a} of {b}",
  im_done: "Done! Orders imported: {n}. They're already in your account.",
  im_partial: "Imported {n} of {b}: the rest failed because of an error. You can undo and try again.",
  im_finish: "Great",
  im_undo: "Undo import",
  im_undo_confirm: "Delete the {n} orders you just imported?",
  im_undone: "Import undone",
  im_no_product: "Unnamed product",
  im_note_ref: "No. in Excel: {n}",
  im_note_cost: "Cost from Excel saved as delivery (no CNY rate)",
  im_tpl_sheet: "Orders",
  im_tpl_title: "Sample for importing orders",
  im_tpl_sub: "Fill in the rows with your orders. Extra columns can be deleted, any order works.",
  im_tpl_note: "Sample note",
  im_photo_title: "Orders written in a notebook?",
  im_photo_text: "Take photos of the pages — AI will copy the orders into a table, and you check them. Up to 5 photos at a time.",
  im_photo_btn: "Notebook photo",
  im_photo_privacy: "Photos are sent to Google Gemini only for recognition and are not stored. Up to 30 photos a day.",
  im_reading: "Reading the handwriting…",
  im_reading_hint: "Usually 10–40 seconds. Don't close the window.",
  im_photo_max: "Up to {n} photos at a time. Send the rest next time.",
  im_photo_file: "Notebook photos: {n}",
  im_photo_found: "Rows copied from photos: {n}",
  im_photo_left: "photos left today: {n}",
  im_photo_check: "Check every row: AI may misread handwriting. Yellow rows are where it isn't sure. Delete extra rows with ×.",
  im_unsure: "check — handwriting unclear",
  im_st_default: "Default status",
  im_e_quota: "Today's photo limit is used up (30 a day). Try tomorrow.",
  im_e_busy: "The AI is busy right now. Wait a minute and try again.",
  im_e_photo_empty: "No orders were found in the photo. Take it closer and in good light.",
  im_e_photo: "Couldn't read the photo. Check the internet and try again.",
  sm_show_all: "Show all sections",
  sm_simple: "Simple mode",
  sm_on: "Simple mode: only Orders, Clients and Debts",
  sm_off: "All sections are shown",
  sm_setting: "Simple mode — only Orders, Clients and Debts in the menu",
  video_btn: "Video: how it works (2 min)",
  tgc_title: "Telegram notifications",
  tgc_text: "Get a message when your order is shipped, when it arrives and is ready for pickup. No calls or checking needed.",
  tgc_btn: "Connect in Telegram",
  tgc_check: "Check connection",
  tgc_checking: "Checking…",
  tgc_hint: "In Telegram press “Start” and come back here — the connection is checked automatically.",
  tgc_on: "Connected — order updates will come to your Telegram",
  tgc_off: "Turn off notifications",
  tgc_off_confirm: "Turn off Telegram notifications for this order?",
  tgc_done: "Done! Notifications are on",
  tgc_off_done: "Notifications are off",
  tgc_e_start: "I don't see “Start” yet. Open the bot, press “Start” and try again.",
  tgc_e: "Something went wrong. Try again in a minute.",
  tgc_sent: "Sent to client's Telegram: {n}",
  tgc_tag_title: "The client is subscribed in Telegram: they get new statuses automatically",
  pwa_btn: "Install on phone",
  pwa_title: "Install on your phone",
  pwa_sub: "An icon on your screen, opens like an app",
  pwa_ios1: "At the bottom of Safari tap “Share” — the square with an up arrow ⬆️.",
  pwa_ios2: "Scroll and choose “Add to Home Screen”.",
  pwa_ios3: "Tap “Add”. The ULA Factory icon appears on your screen.",
  pwa_and1: "Tap the browser menu — three dots ⋮ at the top right.",
  pwa_and2: "Choose “Install app” or “Add to Home screen”.",
  pwa_and3: "Confirm. The ULA Factory icon appears on your screen.",
  pwa_note: "It's the same site: everything is saved, updates arrive automatically.",
  pwa_ok: "Got it",
  pwa_done: "App installed",
  nav_analytics: "Analytics",
  an_hint: "Key numbers and charts: what you sold, earned and who owes you.",
  an_export: "All orders to Excel",
  an_m: "M",
  an_k: "K",
  an_markup: "Markup",
  an_orders: "Orders",
  an_avg: "Average order",
  an_live: "In progress now (orders)",
  an_by_month: "Revenue and profit by month",
  an_by_status: "Orders by status",
  an_more: "More",
  an_top: "Top and debtors",
  an_top_clients: "Clients",
  an_top_products: "Products",
  an_top_debtors: "Debtors",
  an_attention: "Needs attention",
  an_i_up: "Profit grew by {n}% compared with the previous same period.",
  an_i_down: "Profit fell by {n}% compared with the previous same period.",
  an_i_best: "Best month — {m}: profit {s}.",
  an_i_client: "{name} brings the most profit — {n}% of the total.",
  an_i_debt: "{name} owes the most — {s}.",
  an_a_noprice: "No client price: {n}",
  an_a_debts: "Debts older than a week: {n}",
  an_a_stuck: "No movement for over 10 days: {n}",
  an_a_live: "Orders in progress now: {n}",
  an_a_ok: "All good: no overdue debts or forgotten orders.",
  an_days: "{n} d",
  an_goal: "Monthly goal ({c})",
  an_g_of: "of {s}",
  an_g_done: "Goal reached!",
  an_g_left: "{p}% done. Days left this month: {d}.",
  an_g_need: "To make it you need {s} per day on average.",
  an_g_none: "No goal yet. Set how much you want to earn per month and a progress bar will appear here.",
  an_g_set: "Set a goal",
  an_g_change: "Change goal",
  an_g_clear: "Remove",
  an_g_ph: "How much to earn, {c}",
  an_g_bad: "Enter an amount above zero",
  an_a_loss: "Orders at a loss: {n}",
  an_none: "No data yet",
  an_empty: "No orders in this period.",
  an_no_price: "Orders in this period have no client price yet, so profit cannot be calculated.",
  an_c_num: "Order №",
  an_c_date: "Date",
  an_c_status: "Status",
  an_c_product: "Product",
  an_c_qty: "Qty",
  an_c_cur: "Currency",
  export_empty: "No clients to export",
  clients_empty_title: "No clients yet",
  clients_empty_text: "A client appears here once they fill in their details from the order link.",

  empty_title: "No orders yet",
  empty_text: "Click “New order” to add the first one.",
  nothing_found: "Nothing found. Change the search or filter.",
  show_more: "Show more",
  loading: "Loading…",
  confirm_delete: "Delete order {n} with its photos? This can't be undone.",
  deleted: "Order deleted",
  saved: "Order saved",
  status_changed: "Status updated",
  error_generic: "Couldn't reach the server. Check your connection and try again.",
  error_session: "Your session has ended. Sign in again.",
  dup_number: "An order with this number already exists. Change the number.",
  photo_failed: "Photos not uploaded: {n}",
  detail_title: "Order {n}",

  link_title: "Link for the client",
  link_hint: "The client sees only this order and can enter their delivery details.",
  lk_all_title: "One link for all of a client's orders",
  lk_all_hint: "The client sees all their orders, statuses and total balance in one place. Orders are matched by the client's phone (or by name if there is no phone).",
  lk_all_create: "Create shared link",
  lk_all_revoke: "Disable shared link",
  lk_all_confirm_revoke: "Disable this client's shared link? They will no longer be able to open the list of orders with it. Links to single orders stay unchanged.",
  lk_all_created: "Shared link created and copied",
  lk_all_revoked: "Shared link disabled",
  lk_all_wa: "Hello! All your orders, statuses and payments are in one place:",
  cab_title: "Your orders",
  cab_debt: "Total to pay",
  cab_no_debt: "All paid",
  cab_empty: "No orders yet.",
  cab_active: "In progress",
  cab_done: "Completed",
  cab_back: "All orders",
  link_active: "The link is active. Replacing it will immediately disable the old link.",
  link_disabled: "The link is disabled. The client can no longer open this order using the old link.",
  link_create: "Create link",
  link_rotate: "Replace link",
  link_revoke: "Disable link",
  link_confirm_rotate: "Create a new link for order {n}? The old link will stop working immediately.",
  link_confirm_revoke: "Disable the link for order {n}? The client will no longer be able to open it.",
  link_created: "A new link was created. The old link is disabled.",
  link_revoked: "Link disabled",
  link_whatsapp: "Send via WhatsApp",
  link_open: "Open as client",
  wa_text: "Your order {n}. Use this link to see the status, payment and photos and to enter your delivery address:",

  cl_order: "Order {n}",
  cl_product: "Product",
  cl_status: "Order status",
  history_title: "Order history",
  history_empty: "No status changes yet",
  history_last: "Latest update",
  history_payment: "Paid so far: {amount}",
  history_address: "Delivery address added or changed",
  cl_payment: "Cost and payment",
  cl_paid_full: "Paid in full",
  cl_delivery_info: "Delivery",
  cl_comment: "Comment",
  cl_updated: "Updated",
  cl_not_found_title: "Order not found",
  cl_not_found_text: "Check the link. If it doesn't open, ask your manager to send it again.",
  cl_cancelled: "This order has been cancelled",

  cd_title: "Delivery details",
  cd_intro: "Tell us who receives the order and where to deliver it.",
  cd_name: "Full name",
  cd_phone: "Phone",
  cd_phone_hint: "With country code, e.g. +1…, +86…, +971…",
  cd_telegram: "Telegram",
  cd_optional: "optional",
  cd_city: "City",
  cd_method: "How to receive the order",
  cd_m_address: "Delivery to address",
  cd_m_pickup: "Pickup point",
  cd_address: "Address: street, building, apartment",
  cd_pickup: "Pickup point name or address",
  cd_privacy: "Only your manager sees these details. They are used for delivery only.",
  cd_save: "Save details",
  cd_saving: "Saving…",
  cd_saved: "Details saved",
  cd_edit: "Edit",
  cd_cancel: "Cancel",
  cd_locked: "This order is complete, so the details can't be changed. Message your manager if something needs fixing.",

  e_required: "Fill in this field",
  e_name: "Enter your full name, 2 to 120 characters",
  e_phone: "Check the number: 9 to 15 digits, + allowed at the start",
  e_telegram: "Telegram username: 5 to 32 Latin letters, digits or _",
  e_city: "Enter a city, 2 to 80 characters",
  e_address: "Enter an address, 5 to 300 characters",
  e_pickup: "Enter a pickup point, 2 to 200 characters",
  e_form: "Check the highlighted fields",

  // Этап A: байеры, кабинеты, приглашения
  nav_buyers: "Buyers",
  login_hint: "ULA Factory buyer workspace",
  account_blocked: "This account is blocked. Contact the administrator.",
  auto_number: "Assigned automatically",
  req_fields: "Fill in the client and product name.",
  settings: "Settings",
  refresh: "Refresh",
  refreshed: "Updated",
  wh_edit: "Edit",
  wh_add: "Add warehouse address",
  wh_empty: "Your China warehouse address isn't set. Add it to copy it for clients in one tap.",
  s_name: "Workspace name",
  s_prefix: "Order number letters",
  s_prefix_hint: "1 to 5 Latin capital letters. E.g. CN gives numbers like CN-000125.",
  s_address: "Warehouse address in China",
  s_address_hint: "Chinese is best, so sellers and couriers can read it.",
  s_contacts: "Warehouse contacts",
  s_contacts_hint: "One contact per line: name and phone.",
  s_save: "Save",
  s_saved: "Settings saved",
  e_ws_name: "Enter a workspace name",
  e_prefix: "Latin capital letters only, 1 to 5",
  readonly_banner: "You're viewing “{n}”. Nothing can be changed here.",
  back_to_mine: "My workspace",
  b_invite_title: "Invite a buyer",
  b_invite_hint: "The buyer gets a separate workspace. Other buyers can't see their clients or orders.",
  b_invite_note: "Who it's for (optional)",
  b_invite_btn: "Create invite",
  b_invite_ready: "Invite ready. Send the link to the buyer: it works for 14 days and for one person only.",
  b_invites: "Active invites",
  b_invites_empty: "No active invites.",
  b_until: "until {d}",
  b_delete_invite: "Delete",
  b_invite_deleted: "Invite deleted",
  b_workspaces: "Buyer workspaces",
  b_open: "Open",
  b_block: "Block",
  b_unblock: "Unblock",
  b_blocked: "Blocked",
  b_active: "Active",
  b_you: "Your workspace",
  b_counts: "Orders: {o} · Clients: {c}",
  b_confirm_block: "Block “{n}”? The buyer won't be able to sign in. Data is kept.",
  b_wa_text: "Invite to ULA Factory — buyer workspace:",
  join_title: "Buyer sign-up",
  or: "or",
  google_btn: "Continue with Google",
  no_account: "No account?",
  signup_link: "Sign up",
  have_account: "Already have an account?",
  legal_terms: "Terms of Service",
  legal_privacy: "Privacy Policy",
  legal_agree: "By signing up you agree to the terms and privacy policy:",
  s_sec_look: "Appearance",
  s_theme: "Theme",
  theme_auto: "Auto",
  theme_light: "Light",
  theme_dark: "Dark",
  s_language: "Language",
  s_sec_profile: "Profile",
  s_new_password: "New password",
  s_password_hint: "Leave empty to keep it. At least 8 characters.",
  s_sec_workspace: "Workspace",
  s_sec_money: "Currencies and shipping",
  password_changed: "Password changed",
  nav_fx: "Currency exchange",
  fx_hint: "Your rate for clients, requests and the ULA rate for buyers",
  fx_platform_title: "ULA rate for buyers",
  fx_platform_none: "Today's rate isn't set yet",
  fx_rate_line: "1 ¥ = {r} som",
  fx_date: "Rate for {d}",
  fx_old: "Rate from {d}, please confirm before exchanging",
  fx_from: "from ¥ {n}",
  fx_som_short: "som",
  fx_cny: "How many yuan you need",
  fx_pay: "To pay",
  fx_ask_admin: "Send exchange request",
  fx_s1_admin: "Pay the administrator using the details",
  fx_s1: "Pay using the details",
  fx_s2: "Attach the payment receipt",
  fx_s3_admin: "Send the request to the administrator",
  fx_s3: "Your details and sending",
  fx_attach: "Attach receipt",
  fx_replace: "Replace",
  fx_receipt: "Receipt",
  fx_send_rcpt: "Send request with receipt",
  fx_e_receipt: "Pay first and attach the receipt — the request cannot be sent without it",
  fx_qr_label: "Payment QR code",
  fx_qr_add: "Upload QR code",
  fx_qr_scan: "Point your phone camera at the QR code to pay. Tap to enlarge.",
  fx_qr_off: "The QR code cannot be uploaded yet: the database update (file 42) has to be run.",
  fx_send_no_file: "Files in the chat are not accepted yet. Send the request without the receipt? Send the receipt to the administrator separately (WhatsApp or Telegram).",
  fx_no_file_note: "(Receipt not attached — the buyer will send it separately.)",
  fx_ula_eta_label: "How long the buyer waits for yuan after paying",
  fx_eta_need41: "Rate saved, but the waiting time was not: database file 41 has not been run.",
  fx_e_upload_off: "File upload is not enabled yet. The database update (file 40) has to be run.",
  fx_e_rcpt_img: "Attach a photo or screenshot (JPG, PNG, WEBP)",
  fx_e_rcpt_type: "Attach a photo, screenshot or PDF",
  fx_req_chat: "No payment details yet. Ask the administrator in the chat.",
  fx_req_none: "No payment details yet. Ask the buyer.",
  fx_req_copied: "Payment details copied",
  fx_tab_ula: "Exchange via ULA",
  fx_tab_mine: "My exchange for clients",
  fx_ula_title: "ULA rate",
  fx_all_tiers: "All rate tiers",
  fx_step_t: "How it works",
  fx_step1: "Enter how many yuan you need",
  fx_step2: "Tap “Send exchange request” — it goes to the administrator",
  fx_step3: "The administrator replies in Support and tells you how to pay",
  fx_open_chat: "Open support chat",
  fx_admin_msg: "Exchange request: ¥ {cny} = {som} som at rate {r}",
  fx_sent_admin: "Request sent. The reply will come to Support.",
  fx_admin_set: "Rate for buyers (set by you)",
  fx_ed_from: "From, ¥",
  fx_ed_rate: "Rate, som per 1 ¥",
  fx_ed_add: "Add tier",
  fx_ed_hint: "E.g. from ¥1,000 — 12.60; from ¥10,000 — 12.40. The smallest tier is the minimum amount.",
  fx_e_many: "No more than {n} tiers",
  fx_note_label: "Payment details and note",
  fx_note_ph: "E.g. Mbank 0555 123 456 (Azamat K.). Yuan go to the client's Alipay / WeChat.",
  fx_save: "Save rate",
  fx_saved: "Rate saved",
  fx_my_title: "My rate for clients",
  fx_my_hint: "Clients enter how many yuan they need, see the amount in som and your payment details, pay and upload a screenshot. Update the rate every day.",
  fx_on_label: "Show exchange to clients",
  fx_e_rate: "Check the tiers: \"from\" is a number from 0, the rate is above 0",
  fx_link_title: "Exchange link for clients",
  fx_link_hint: "Send it to clients. The rate and calculator are also shown in your shop and order links.",
  fx_copy: "Copy",
  fx_wa_text: "Exchange som → yuan: {url}",
  fx_link_make: "Create link",
  fx_req_title: "Client exchange requests",
  fx_req_empty: "No requests yet",
  fx_active: "Active",
  fx_all: "All",
  fx_st_new: "Awaiting payment",
  fx_st_paid: "Paid",
  fx_st_done: "Done",
  fx_st_cancelled: "Cancelled",
  fx_done_btn: "Done",
  fx_cancel_btn: "Cancel",
  fx_proof_btn: "Payment screenshot",
  fx_readonly: "Only the workspace owner can change the rate",
  fx_pub_title: "Exchange som → yuan",
  fx_pub_btn: "Make a request",
  fx_pub_send: "Next — payment",
  fx_to_pay: "To pay",
  fx_requisites: "Payment details",
  fx_pay_hint: "Transfer the amount using these details and upload a payment screenshot.",
  fx_upload: "Upload payment screenshot",
  fx_uploading: "Uploading…",
  fx_pay_later: "The seller already has your request. If the upload doesn't work, send the screenshot to the seller on WhatsApp.",
  fx_pub_done: "Screenshot received! The seller will check the payment and send the yuan.",
  fx_pub_again: "New request",
  fx_back: "Change",
  fx_comment_ph: "E.g. to Alipay, a convenient time",
  fx_page_hint: "Enter how many yuan you need to see the amount in som.",
  fx_page_none: "Exchange unavailable",
  fx_e_min: "Minimum amount is ¥ {n}",
  fx_e_amount: "Enter how many yuan you need",
  fx_e_off: "Exchange is not available right now",
  fx_locked: "After the identity check you will get here:",
  fx_locked_1: "your rate for clients",
  fx_locked_2: "payment details and QR code",
  fx_locked_3: "the link you send to clients",
  fx_next_title: "Check passed! 3 steps left:",
  fx_next_1: "Set your rate for clients (below)",
  fx_next_2: "Add payment details and QR code and tap “Save”",
  fx_next_3: "Tap “Turn on exchange for clients” and send the link to clients",
  kyc_msg_ok: "✅ Your identity check is passed! Open “Exchange” → “My exchange for clients”: set the rate and payment details, tap “Turn on exchange for clients” and send the link to clients.",
  kyc_msg_no: "❌ Identity check failed. Reason: {r}. Fix it and send the documents again in “Exchange”.",
  fx_off_warn: "Exchange is turned off — clients opening this link will see “not available”. Turn it on:",
  fx_off_warn_kyc: "Exchange is off — clients will see “not available”. First pass the identity check above.",
  fx_turn_on: "Turn on exchange for clients",
  fx_off_copied: "Copied, but exchange is off — the client will see “not available”. Turn it on.",
  fx_e_off_hint: "The seller has not turned on exchange yet. Message them — once they turn it on, the link will work.",
  fx_e_upload: "Couldn't upload the screenshot. Please try again.",
  fx_st_confirmed: "Sending yuan",
  fx_eta_m: "{n} min",
  fx_eta_h: "{n} h",
  fx_eta_d: "{n} d",
  fx_eta_label: "We usually send yuan within",
  fx_eta_q: "How long should the client wait for yuan?",
  fx_eta_usual: "Yuan usually arrive within {n} after payment",
  fx_eta_change: "Change time",
  fx_wait_until: "Expect by {t}",
  fx_left: "≈ {n} left",
  fx_late: "Time is almost up — the seller will send the yuan soon. If it takes too long, message them.",
  fx_confirm_btn: "Payment received",
  fx_confirm_go: "Confirm and notify client",
  fx_confirmed: "The client sees the status and waiting time",
  fx_sent_btn: "Yuan sent",
  fx_msg_label: "Message to client (optional)",
  fx_msg_ph: "E.g. will send to Alipay after 3 pm",
  fx_wa_status: "{name}, your exchange request status: {url}",
  fx_track: "Track request status",
  fx_my_reqs: "My requests",
  fx_req_from: "Request from {d}",
  fx_status_title: "Exchange request status",
  fx_s_new: "Waiting for your payment",
  fx_s_paid: "Screenshot received — checking payment",
  fx_s_confirmed: "Payment confirmed — sending yuan",
  fx_s_done: "Yuan sent",
  fx_s_cancelled: "Request cancelled",
  fx_step_new: "Request received",
  fx_step_paid: "Payment",
  fx_step_confirmed: "Payment confirmed",
  fx_step_done: "Yuan sent",
  fx_paid_wait: "Checking the payment usually takes up to {n}. We'll let you know when the yuan are sent.",
  fx_paid_wait0: "The seller will check the payment and tell you how long to wait.",
  fx_created: "Request from {d}",
  fx_auto: "this page updates itself",
  fx_st_none: "Request not found",
  fx_st_none_hint: "Check the link or message the seller.",
  kyc_title: "Identity check",
  kyc_ok: "Identity verified — you can turn exchange on",
  kyc_pending: "Documents under review (sent {d}). Usually checked within a day.",
  kyc_rejected: "Check failed",
  kyc_revoked: "Verification revoked",
  kyc_why: "To earn clients' trust, exchange can only be turned on after a check. Upload your passport and a selfie holding it once. Only the ULA Factory administrator sees them, clients do not.",
  kyc_name: "Full name as in passport",
  kyc_name_ph: "John Smith",
  kyc_doc: "Passport number",
  kyc_front: "Passport: photo page",
  kyc_back: "Back side",
  kyc_selfie: "Selfie with passport",
  kyc_photo_hint: "Sharp photos, no glare, all letters readable. Selfie: your face and the passport next to it.",
  kyc_consent: "I agree to storage and checking of my passport data for the exchange.",
  kyc_send: "Send for review",
  kyc_e_name: "Enter your full name as in the passport",
  kyc_e_doc: "Check the passport number: Latin letters and digits only",
  kyc_e_files: "Upload the passport photo and a selfie with it",
  kyc_e_consent: "Tick the consent box",
  kyc_admin_msg: "Exchange identity check: {name} sent documents",
  kyc_sent: "Documents sent — wait for review",
  kyc_admin_title: "Exchanger verification",
  kyc_f_pending: "Awaiting review",
  kyc_admin_empty: "No verification requests",
  kyc_st_pending: "Awaiting review",
  kyc_st_approved: "Verified",
  kyc_st_rejected: "Rejected",
  kyc_st_revoked: "Revoked",
  kyc_view: "View photos",
  kyc_reject: "Reject",
  kyc_revoke: "Revoke",
  kyc_reason_q: "Reason (the buyer will see it):",
  kyc_e_reason: "Enter a reason",
  kyc_e_required: "Pass the identity check first (below)",
  kyc_pub_badge: "The seller passed identity verification on ULA Factory",
  fx_who_me: "You",
  fx_who_client: "Client",
  fx_who_buyer: "Seller",
  fx_who_admin: "ULA administrator",
  fx_d_photo: "Photo",
  fx_st_sent: "Waiting for client confirmation",
  fx_st_dispute: "Dispute",
  fx_flag: "This number is on the platform blacklist — be careful",
  fx_wait_client: "Waiting for the client to confirm · closes automatically {t}",
  fx_sent_proof_btn: "Transfer screenshot",
  fx_send_pick: "Choose the yuan transfer screenshot — it is required",
  fx_sent_ok: "Marked as sent. The client will confirm receipt",
  fx_d_btn: "Open a dispute",
  fx_d_btn_notrecv: "Yuan not received — open a dispute",
  fx_d_open_me: "You opened a dispute",
  fx_d_open_client: "The client opened a dispute",
  fx_d_open_buyer: "The seller opened a dispute",
  fx_d_closed: "Dispute closed",
  fx_d_res_client: "Decision: the client is right",
  fx_d_res_buyer: "Decision: the seller is right",
  fx_d_msg_ph: "Message about the dispute",
  fx_d_send: "Send",
  fx_d_attach: "Photo",
  fx_d_hint_buyer: "While the dispute is open the status cannot be changed. Attach a statement or screenshots — the ULA Factory administrator will decide.",
  fx_d_hint_client: "The ULA Factory administrator will check both sides' screenshots and decide. Attach proof: payment screenshot, statement, chat.",
  fx_d_reason_q: "What happened? (the client and administrator will see it)",
  fx_d_reason_ph: "Describe what happened: how much and when you paid, what is wrong",
  fx_d_reason_short: "Please describe in more detail (at least 5 characters)",
  fx_d_from: "If the seller does not respond, you can open a dispute here after {t}",
  fx_d_err: "Something went wrong. Refresh and try again",
  fx_e_dispute: "The status cannot be changed while the dispute is open",
  fx_disputes_title: "Exchange disputes",
  fx_d_open_f: "Open",
  fx_disputes_empty: "No disputes",
  fx_bl_tag: "blacklisted",
  fx_strikes: "Disputes lost by the buyer: {n}",
  fx_res_client_btn: "Client is right",
  fx_res_buyer_btn: "Seller is right",
  fx_res_note_q: "Decision (both sides will see it):",
  fx_res_bl_q: "Add the client's phone to the blacklist? All buyers will see a warning on their new requests.",
  fx_t_created: "Request",
  fx_t_paid: "Payment screenshot",
  fx_t_eta: "Promised by",
  fx_t_sent: "Sent",
  fx_s_sent: "Yuan sent — check and confirm",
  fx_s_dispute: "Dispute open — the platform is reviewing it",
  fx_s_done2: "Deal completed",
  fx_step_sent: "Yuan sent",
  fx_step_recv: "Received",
  fx_sent_proof_cap: "Transfer screenshot from the seller",
  fx_recv_q: "Did the yuan arrive? Rate the seller",
  fx_recv_btn: "Yuan received",
  fx_recv_auto: "If you neither confirm nor open a dispute by {t}, the deal closes automatically",
  fx_protect: "ULA Factory protection: the seller passed identity verification. If something goes wrong, open a dispute here and the platform will review it.",
  pwa_update: "The site has been updated",
  pwa_reload: "Reload",
  board_news_title: "News",
  board_news_ok: "Got it",
  board_rate_title: "ULA rate for today",
  board_news_add: "Publish news",
  board_news_ph: "What do you want to tell buyers?",
  board_news_post: "Publish",
  board_news_posted: "News published",
  board_news_del: "Delete",
  board_news_del_q: "Delete this news?",
  board_news_err: "Something went wrong. Try again",
  rc_title: "Yuan rate",
  rc_sum: "Amount",
  rc_rate: "Som per ¥1",
  rc_days: "{n} days",
  rc_chart_none: "The chart appears once the rate changes",
  rc_min: "min {n}",
  rc_max: "max {n}",
  rc_main: "rate from ¥{n}",
  rc_calc: "How much yuan do you need?",
  rc_go: "Exchange",
  rc_more: "Details: chart and note",
  rc_per: "som per 1 ¥",
  rc_edit: "Change rate",
  rc_warn_old: "Today's rate isn't updated — buyers see the old one",
  rc_warn_none: "The rate isn't set yet — buyers don't see it",
  fx_big_change: "The rate “from ¥{from}” changes from {a} to {b} ({p}%). Is this a typo?",
  fx_notify_label: "Tell buyers: news on the site and in Telegram",
  fx_news_text: "New ULA rate:\n{lines}",
  fx_saved_news: "Rate saved, buyers will get the news",
  board_news_tg: "Also send to Telegram",
  board_news_sent_tg: "Sent to Telegram: {n}",
  ref_promo_t: "Do you sell goods from China yourself?",
  ref_promo_b: "This page was made in ULA Factory: orders, clients and the yuan rate in one place. Try it for free.",
  ref_promo_btn: "Try it for free",
  ref_inv_t: "Invite a buyer friend",
  ref_inv_b: "Send this link to a buyer you know. When they sign up, we will remember that you brought them.",
  ref_inv_copy: "Copy link",
  ref_inv_copied: "Link copied",
  ref_inv_wa: "Send via WhatsApp",
  ref_inv_wa_text: "I manage my China orders in ULA Factory — handy, and a good yuan rate. Try it: {url}",
  sh3_add: "Add to cart",
  sh3_cart: "Cart",
  sh3_checkout: "Checkout ({n})",
  sh3_more: "Add more items",
  sh3_remove: "Remove",
  f_more_show: "Show all fields ▾",
  f_more_hide: "Hide extra fields ▴",
  q_s1: "Product price",
  q_s1_sub: "What the supplier charges",
  q_s2: "Delivery",
  q_s2_sub: "Weight and cargo rate",
  q_s3: "Your markup",
  q_s3_sub: "How much you want to earn",
  q_more_item: "+ Name and link (optional)",
  q_more_rates: "⚙ Currencies and rates",
  bn_more: "More",
  bn_new: "Create",
  pf_title: "Profile",
  pf_role_owner: "Owner",
  pf_role_staff: "Assistant",
  pf_role_admin: "Admin",
  pf_orders: "Orders",
  pf_active: "In progress",
  pf_clients: "Clients",
  pf_ready: "Account setup",
  pf_ready_n: "{a} of {b}",
  pf_c_name: "Name",
  pf_c_phone: "Phone",
  pf_c_logo: "Logo",
  pf_c_wh: "Warehouse address",
  pf_c_tariff: "Delivery rate",
  pf_month: "This month",
  pf_m_new: "Orders: {n}",
  pf_m_done: "Delivered: {n}",
  pf_m_top: "Top client: {name}",
  pf_m_empty: "No orders this month yet",
  pf_look: "Appearance",
  pf_dark: "Dark mode",
  pf_dark_sub: "Easy on the eyes at night",
  pf_color: "Button color",
  pf_col_ula: "Brand red",
  pf_col_blue: "Blue",
  pf_col_violet: "Violet",
  pf_col_green: "Green",
  pf_col_orange: "Orange",
  pf_text: "Text size",
  pf_ts_s: "Small",
  pf_ts_m: "Normal",
  pf_ts_l: "Large",
  pf_ts_xl: "Extra large",
  pf_style: "Style",
  pf_ui_rounded: "Rounded",
  pf_ui_soft: "Soft",
  pf_ui_crisp: "Crisp",
  pf_settings: "Account settings",
  pf_device_note: "Appearance is saved on this device.",
  pf_edit: "Edit profile",
  pf_photo: "My photo",
  pf_photo_hint: "Shown in your profile",
  pf_photo_up: "Upload photo",
  pf_photo_change: "Change photo",
  pf_remove: "Remove",
  pf_name: "Your name",
  pf_company: "Company name",
  pf_logo: "Company logo",
  pf_logo_hint: "Clients see it on the order page and shop",
  pf_logo_up: "Upload logo",
  pf_logo_change: "Change logo",
  pf_save: "Save",
  pf_cancel: "Cancel",
  pf_photo_del: "Remove photo",
  bn_fx: "Exchange",
  bn_support: "Chats",
  join_country: "Country",
  country_pick: "Choose a country",
  country_other: "Other country",
  country_none: "Not set",
  e_country: "Choose your country",
  country_kg: "Kyrgyzstan",
  fs_main_sub: "Number, date and status",
  fs_client_sub: "Who is ordering",
  fs_product_sub: "What we buy and from whom",
  fs_delivery_sub: "Weight and cargo rate",
  fs_price: "Price for the client",
  fs_price_sub: "What the client pays and has already paid",
  fs_photos_sub: "The client will see them on their link",
  fs_notes_sub: "For the client and for yourself",
  fs_sh_main: "Shipment",
  fs_sh_main_sub: "Name, cargo and dispatch date",
  fs_sh_cost_sub: "Total weight and cost of the whole shipment",
  fs_sh_orders_sub: "Which orders travel in this shipment",
  fs_pr_photo_sub: "A good photo brings more orders",
  fs_pr_main: "Name and price",
  fs_pr_main_sub: "What the buyer sees in the shop",
  fs_pr_desc_sub: "Size, colour, material — optional",
  er_title: "Errors on users' devices",
  er_none: "none ✓",
  er_hint: "The site reports automatically when something breaks for a buyer or client. Send the error text to the developer and press “Fixed” once it is fixed.",
  er_hits: "{n} times",
  er_people: "buyers: {n}",
  er_clients: "at clients: {n}",
  er_details: "Details for the developer",
  er_fixed: "Fixed",
  er_clear_all: "Clear the list",
  er_clear_q: "Delete all errors from the list?",
  logo_title: "Logo",
  logo_hint: "Clients will see it instead of \"ULA Factory\" on their order page, shared link and shop. Square or wide png/jpg works best.",
  logo_upload: "Upload logo",
  logo_change: "Change logo",
  logo_remove: "Remove",
  logo_err_type: "Use a png, jpg or webp file",
  logo_err_size: "File is too large",
  onboard_title: "Finish signing up",
  onboard_text: "Fill in your company details. The workspace won't open without them.",
  e_ob_addr: "Enter your China warehouse address where goods will be sent",
  google_failed: "Couldn't sign in with Google. Try again or sign in with email.",
  join_hint: "Create your workspace. Other buyers can't see your clients or orders.",
  join_name: "Your name",
  join_phone: "Phone",
  join_ws: "Workspace or company name",
  join_password: "Password, at least 8 characters",
  join_btn: "Create workspace",
  join_busy: "Creating…",
  join_invalid_title: "Invite not valid",
  join_invalid_text: "The link has expired or was already used. Ask for a new invite.",
  join_done_title: "Check your email",
  join_done_text: "We sent an email to {e}. Open it, confirm your address and sign in.",
  join_exists: "This email is already registered. Sign in or use another one.",
  e_email: "Check the email",
  e_password: "Password must be at least 8 characters",

  // разрешения и устройство (js/device.js)
  perm_title: "Set up ULA",
  perm_sub: "Two permissions and the app works the way it should.",
  perm_push: "Notifications",
  perm_push_d: "New requests, support messages and order updates — instantly, even when the app is closed.",
  perm_geo: "Location",
  perm_geo_d: "Support will see where you are and help faster with delivery and problems. You can turn it off in phone settings.",
  perm_allow: "Allow",
  perm_on: "On",
  perm_denied: "Blocked in settings",
  perm_later: "Not now",
  perm_done: "Done",
  dev_now: "online now",
  dev_min: "{n} min ago",
  dev_hour: "{n} h ago",
  dev_phone: "Phone",
  dev_tablet: "Tablet",
  dev_desktop: "Computer",
  dev_app: "app",
  dev_seen: "Seen",
  dev_first: "first",
  dev_version: "Version",
  dev_push: "Notifications",
  dev_place: "Location",
  dev_map: "Open on map",
  dev_m: "m",
  dev_geo_no: "denied",
  dev_geo_none: "not allowed",
  dev_ip: "IP",
  dev_tz: "Time zone, languages",
  dev_screen: "Screen",
  dev_window: "window {v}",
  dev_dark: "dark theme",
  dev_net: "Network",
  dev_offline: "offline",
  dev_gb: "{n} GB",
  dev_cores: "{n} cores",
  dev_ua: "Browser",

  // режим правки администратора (js/adminedit.js)
  adm_edit_on: "✏️ Enable editing",
  adm_edit_off: "Stop editing",
  adm_log: "Log",
  adm_edit_banner: "Editing mode: workspace “{n}”. You are changing the buyer's data — everything is logged. Until {t}.",
  adm_edit_confirm: "Enable editing of workspace “{n}” for 2 hours?\n\nYou can change orders, clients, shipments and settings as the owner. Every change is logged.",
  adm_edit_started: "Editing enabled for 2 hours",
  adm_edit_stopped: "Editing stopped — view only again",
  adm_edit_expired: "Editing time is over — the workspace is view-only again",
  adm_log_title: "Edit log: “{n}”",
  adm_log_empty: "The administrator has not changed anything here yet",
  adm_someone: "Administrator",
  adm_fields: "fields:",
  adm_op_INSERT: "added",
  adm_op_UPDATE: "changed",
  adm_op_DELETE: "deleted",
  adm_op_edit_on: "enabled editing",
  adm_op_edit_off: "stopped editing",
  adm_t_orders: "order",
  adm_t_clients: "client",
  adm_t_order_photos: "order photo",
  adm_t_shipments: "shipment",
  adm_t_suppliers: "supplier",
  adm_t_shop_products: "shop product",
  adm_t_expenses: "expense",
  adm_t_workspaces: "workspace settings",
  adm_t_exchange_requests: "exchange request",
  adm_t_workspace_members: "team",
  adm_t_team_invites: "team invite",
  adm_t_client_cabinets: "client cabinet",

  // вход по Face ID (js/passkey.js)
  pk_title: "Sign in with Face ID",
  pk_hint: "Sign in without a password — with your face or fingerprint. The key stays on your phone; the password remains as a backup.",
  pk_login_apple: "Sign in with Face ID",
  pk_login_android: "Sign in with fingerprint",
  pk_login_windows: "Sign in with Windows Hello",
  pk_login_other: "Sign in with a passkey",
  pk_add_apple: "Turn on Face ID on this device",
  pk_add_android: "Turn on fingerprint sign-in",
  pk_add_windows: "Turn on Windows Hello",
  pk_add_other: "Add a passkey",
  pk_none: "Not turned on on any device yet.",
  pk_noname: "Passkey",
  pk_created: "added {d}",
  pk_used: "used {d}",
  pk_delete: "Delete",
  pk_delete_confirm: "Delete this passkey? That device will need the password again.",
  pk_deleted: "Passkey deleted",
  pk_added: "Done! You can now sign in with Face ID",
  pk_unsupported: "This browser does not support Face ID sign-in. Open ULA in Safari or Chrome.",
  pk_off: "Coming soon.",
  pk_off_admin: "Turn it on once: Supabase → Authentication → Passkeys → Enable.",
  pk_err_off: "Face ID sign-in is off right now. Use your password.",
  pk_err_login: "Face ID sign-in failed. Use your password.",
  pk_err_add: "Could not turn it on. Please try again.",
  pk_err_exists: "Face ID is already on for this device.",
  pk_app: "Coming soon in the app. For now Face ID works when you open ULA in Safari.",

  // Face ID: блокировка и настройки (js/passkey.js)
  pk_sec: "Sign-in & lock",
  pk_foot_off: "Turn on to sign in without a password and unlock ULA with a glance when you come back — like a banking app.",
  pk_lock_row: "Lock ULA",
  pk_lock_after: "Require",
  pk_after_0: "Immediately",
  pk_after_60: "After 1 min",
  pk_after_300: "After 5 min",
  pk_after_900: "After 15 min",
  pk_other: "Other devices",
  pk_locked: "App is locked",
  pk_with_password: "Sign in with password",
  pk_row_apple: "Sign in with Face ID",
  pk_use_apple: "Use Face ID",
  pk_foot_on_apple: "Sign in and unlock ULA with a glance — no password. Your face is checked by the iPhone itself and never sent anywhere.",
  pk_row_android: "Fingerprint sign-in",
  pk_use_android: "Use fingerprint",
  pk_foot_on_android: "Sign in and unlock ULA with your fingerprint — no password. It is checked by the phone itself and never sent anywhere.",
  pk_row_windows: "Windows Hello",
  pk_use_windows: "Use Windows Hello",
  pk_foot_on_windows: "Sign in and unlock ULA with Windows Hello — no password.",
  pk_row_other: "Passkey sign-in",
  pk_use_other: "Use passkey",
  pk_foot_on_other: "Sign in and unlock ULA without a password.",
  // баланс клиента (js/wallet.js)
  wl_title: "Client balance",
  wl_chip: "Balance",
  wl_btn_add: "Top up",
  wl_btn_out: "Refund to client",
  wl_amount: "Amount",
  wl_currency: "Currency",
  wl_note: "Note (optional)",
  wl_note_ph: "E.g. cash, bank transfer",
  wl_apply: "Pay order debts right away: {s} ({n})",
  wl_save_add: "Add",
  wl_save_out: "Refund",
  wl_empty: "No movements yet. When the client pays in advance, tap “Top up”.",
  wl_history: "Statement",
  wl_k_deposit: "Top-up",
  wl_k_withdraw: "Refund to client",
  wl_k_order: "Payment for order {n}",
  wl_k_return: "Returned to balance · order {n}",
  wl_k_fix: "Correction",
  wl_deleted: "order deleted",
  wl_debt: "Order debts",
  wl_net: "Total with debts",
  wl_pay: "Pay from balance · {s}",
  wl_back: "Return payment to balance",
  wl_back_q: "Return payment of {s} for order {n} to the client's balance?",
  wl_paid_ok: "Paid from balance: {s}",
  wl_add_ok: "Added {s}",
  wl_add_paid: "Added {s}, {p} went to orders ({n})",
  wl_out_ok: "Refunded to client: {s}",
  wl_back_ok: "Returned to balance: {s}",
  wl_undo: "Undo",
  wl_undo_q: "Undo this entry? If it is an order payment, the order becomes unpaid again.",
  wl_undo_ok: "Entry undone",
  wl_no_funds: "Not enough money on the balance",
  wl_bad_amount: "Enter an amount greater than zero",
  wl_prepaid: "Client prepayments",
  wl_balance_line: "Client balance{s}:",
  cab_wallet: "Your balance",
  cab_wallet_hint: "Money you paid in advance. It is used for your orders.",
  cab_wallet_ops: "Balance history",
  bi_title: "Business intelligence", bi_hint: "Administrator overview of the selected workspace.",
  bi_choose_workspace: "Choose a workspace from the list above.", bi_workspace: "Workspace: {name}", bi_workspace_label: "Buyer workspace", bi_select_workspace: "Choose a workspace", bi_no_workspaces: "No workspaces available. Check your administrator sign-in and 2FA verification.",
  bi_period: "Period", bi_7: "7 days", bi_30: "30 days", bi_90: "90 days", bi_365: "1 year", bi_custom: "Custom dates", bi_from: "From", bi_to: "To", bi_show: "Show",
  bi_insufficient: "Insufficient data", bi_empty: "No orders or expenses in this period.", bi_no_orders: "There are no orders in this currency for this period.", bi_bad_dates: "Choose valid dates: the start must be no later than the end.",
  bi_load_error: "Could not load the overview. Try again and share the error code with support.", bi_login_error: "Your session has expired. Sign in again.", bi_access_error: "Administrator access is required. If 2FA is enabled, complete verification.", bi_migration_error: "The overview function was not found. Check that migration 51 has been run in Supabase.", bi_network_error: "No internet connection. Check your network and try again.", bi_render_error: "The data arrived, but the overview could not be displayed. Contact support.",
  bi_scope: "Orders are selected by order date, expenses by expense date. Cancelled orders are excluded; statuses are current.",
  bi_currency_note: "Currencies are shown separately. No conversion or exchange rates are applied.", bi_active: "Active orders", bi_completed: "Delivered orders", bi_delayed: "Delayed orders", bi_status_note: "Among orders in the selected period.", bi_missing_deadline: "Orders do not have a confirmed delivery deadline.",
  bi_order_value: "Order value", bi_order_value_note: "Customer prices for orders; this is not money received.", bi_expenses: "Recorded expenses", bi_recorded_expenses: "Only expenses entered in the Expenses section.", bi_missing_expenses: "No expenses were recorded for this period; this does not mean none occurred.",
  bi_order_profit: "Order profit", bi_profit_note: "Based on entered prices and shipping costs, excluding overheads.", bi_net: "Net profit", bi_net_missing: "Expense completeness and possible double counting cannot be verified.", bi_average: "Average order value", bi_average_profit: "Average profit per order", bi_missing_price: "Enter customer prices for all orders in this currency.", bi_missing_cost: "Enter customer prices, purchase prices and exchange rates for all orders.",
  bi_more_metrics: "What else is needed", bi_suppliers: "Supplier performance", bi_suppliers_missing: "Linked records and delivery and quality data are needed.", bi_retention: "Client retention", bi_retention_missing: "A consistent definition and reliable client identification are needed.", bi_logistics: "Logistics performance", bi_logistics_missing: "Planned and actual delivery dates are needed.",
  cl_links_btn: "Matches",
  cl_links_title: "Client matches",
  cl_links_hint: "The app only suggests here. It never merges anyone by itself: you decide, one pair at a time.",
  cl_links_pairs: "Possibly the same person",
  cl_links_none: "No matches.",
  cl_links_r_same_phone: "Same phone number.",
  cl_links_r_same_last9: "Only the last 9 digits match. Country codes differ or are missing: these may be different people.",
  cl_links_r_same_name: "Same name. There is no phone to compare.",
  cl_links_orders: "orders: {n}",
  cl_links_ops: "operations: {n}",
  cl_links_same: "Same person",
  cl_links_diff: "Different people",
  cl_links_merge_q: "Merge “{a}” and “{b}”? Orders and balance move to one client. Both shared links will be turned off; create a new one afterwards. This cannot be undone.",
  cl_links_merged: "Merged: {o} orders, {w} balance entries. Shared links turned off: {l}.",
  cl_links_dismissed: "Pair hidden: different people.",
  cl_links_wallet: "Prepayment without an owner",
  cl_links_owner_only: "Only the workspace owner decides.",
  cl_links_err_neg: "This would leave the client with a negative balance.",
  cl_links_wallet_hint: "These funds used to sit under a key shared by several people. They are not in anyone's balance but are counted in the reconciliation below. Choose the client for EACH operation separately: the app never chooses for you. Money that paid an order can only go to that order's client.",
  cl_links_pick: "— choose a client —",
  cl_links_new_opt: "New client “{n}”",
  cl_links_assign: "Assign",
  cl_links_assign_q: "Assign the {s} operation ({k}) to client “{n}”? This cannot be undone; the decision is logged.",
  cl_links_assigned: "Done: operation assigned, totals reconcile.",
  cl_links_err_done: "This operation is already assigned. List refreshed.",
  cl_links_err_order: "Money that paid an order can only be assigned to that order's client.",
  cl_links_recon: "Prepayment reconciliation",
  cl_links_recon_line: "{c}: total {t} · with clients {a} · unassigned {u} ({k} operations)",
  cl_links_unres_note: "Unassigned prepayment: {s}. It is not part of client balances.",
  cl_links_open: "Review",
  cl_nocard: "No address",
  cl_show_nocard: "Clients without address ({n})",
  cl_hide_nocard: "Hide clients without address",
  cl_edit: "Edit",
  cl_sum: "Orders: {n}, in progress: {a}",
  cl_edit_title: "Client details",
  cl_edit_save: "Save",
  cl_edit_hint: "The client fills in the address on their own order page.",
  cl_edit_err_name: "Name: 2 to 120 characters.",
  cl_edit_err_phone: "Phone: 9–15 digits, optional leading +.",
  cl_edit_err_tg: "Telegram: 5–32 characters, letters, digits and _.",
  cl_edit_ok: "Client details saved.",
  nq_title: "Client notifications",
  nq_hint: "Order status messages are sent by the server, so you can close the site after changing a status. Here you can see what is waiting, what was sent and what failed.",
  nq_open: "Open log",
  nq_pending: "Waiting: {n}",
  nq_sent: "Sent in 7 days: {n}",
  nq_failed: "Errors: {n}",
  nq_modal_hint: "The last 50 client messages. After an error you can retry: the message returns to the same queue and the action is added to its history.",
  nq_refresh: "Refresh",
  nq_none: "No messages yet.",
  nq_s_pending: "waiting",
  nq_s_processing: "sending",
  nq_s_sent: "sent",
  nq_s_failed: "error",
  nq_s_skipped: "not sent",
  nq_next: "attempt {n} of {m}, next around {t}",
  nq_retry: "Retry",
  nq_retry_q: "Send this message to the client again? If the previous one did arrive, the client will get it twice.",
  nq_retried: "The message is back in the queue.",
  nq_err_state: "This row is no longer in error state. List refreshed.",
  nq_history: "History",
  nq_e_telegram_400: "Telegram rejected the message (chat not found or bad request)",
  nq_e_telegram_401_bot_not_configured: "The bot is not configured on the server",
  nq_e_telegram_404_bot_not_configured: "The bot is not configured on the server",
  nq_e_telegram_429: "Telegram asks to wait",
  nq_e_telegram_500: "Telegram-side failure",
  nq_e_telegram_502: "Telegram-side failure",
  nq_e_telegram_503: "Telegram-side failure",
  nq_e_network_error: "No connection to Telegram",
  nq_e_delivery_unknown: "Unknown whether the message arrived (no response)",
  nq_e_delivery_unknown_retry: "No response, will retry later",
  nq_e_max_attempts: "Attempts exhausted",
  nq_e_subscription_removed: "The client turned notifications off or the order link was replaced",
  nq_e_subscription_changed: "The client's subscription changed after the event",
  nq_e_link_revoked: "The order link is disabled",
  nq_e_client_blocked_bot: "The client blocked the bot",
  nq_e_no_text_for_status: "No text for this status",
  nq_a_created: "created",
  dl_title: "Deadlines",
  dl_tz: "Workspace time: {z}",
  dl_pay_now: "pay by {d}",
  dl_none: "no payment deadline set (never overdue)",
  dl_pay: "Payment deadline",
  dl_eta_from: "Delivery: from",
  dl_eta_to: "Delivery: to",
  dl_save: "Save deadlines",
  dl_pause: "Pause reminders",
  dl_resume: "Resume reminders",
  dl_paused: "Reminders for this order are paused since {d}.",
  dl_paused_ok: "Reminders for this order are paused.",
  dl_resumed_ok: "Reminders resumed.",
  dl_saved: "Deadlines saved.",
  dl_snooze: "Snooze 3 days",
  dl_snoozed: "Task snoozed for 3 days.",
  dl_history: "Deadline history",
  dl_hist_none: "No changes.",
  dl_f_payment_due_at: "payment deadline",
  dl_f_delivery_eta_from: "delivery from",
  dl_f_delivery_eta_to: "delivery to",
  dl_f_reminders_paused_at: "reminders pause",
  dl_err_eta_incomplete: "Enter both delivery dates or clear both.",
  dl_err_eta_order: "The “from” date is after the “to” date.",
  dl_h_payment_overdue: "Order No. {n}: the payment deadline has passed ({d}), {s} still to pay. Contact the client about payment.",
  dl_h_delivery_soon: "Order No. {n}: expected delivery by {d}. Check that everything is on track.",
  dl_h_delivery_overdue: "Order No. {n}: the expected delivery period has passed ({d}). Check with the supplier or carrier. The client is not messaged and the status is not changed.",
  dl_h_missing_no_price: "Order No. {n}: awaiting payment but no client price is set. Set the price.",
  dl_h_missing_no_weight: "Order No. {n}: at the China warehouse but no weight is set. Weigh it and enter the weight for the delivery calculation.",
  dl_h_missing_no_tracking: "Order No. {n}: in transit but has no tracking number. Add one.",
  rm_title: "Payment reminders",
  rm_hint: "Automatically remind the client in Telegram about payment after the deadline. OFF by default. Only for orders with a payment deadline and a connected client Telegram. Delivery delays are never messaged to the client.",
  rm_on: "Currently: on.",
  rm_off: "Currently: off.",
  rm_enable: "Turn on automatic reminders",
  rm_from: "Send from (hour)",
  rm_to: "to (hour)",
  rm_grace: "Pause after deadline (hours)",
  rm_gap: "Gap between reminders (hours)",
  rm_max: "Maximum per order",
  rm_day: "Maximum per day for the workspace",
  rm_tz: "Workspace time zone",
  rm_rules: "Rules: messages only from {f}:00 to {to}:00 {z} time; the first {g} h after the payment deadline; next no more often than every {gap} h; at most {m} per order and {d} per day. They stop after payment, cancellation, a moved deadline, a pause on the order, turning automation off, and when the client's link or subscription is revoked.",
  rm_confirm_on: "Turn on automatic reminders to clients?\n\n{rules}",
  rm_save: "Save rules",
  rm_saved: "Rules saved.",
  rm_err_values: "Check the values (hours 0–24, start before end).",
  rm_err_tz: "Unknown time zone (example: Asia/Bishkek).",
  dj_never: "Server job “{name}” has never run: the schedule is not enabled.",
  dj_stale: "Server job “{name}” has stopped: last run {t}.",
  dj_error: "Server job “{name}” ended with an error (last run {t}).",
  dj_ok: "Server job “{name}” is running (last run {t}).",
  dj_name_deadlines_scan: "deadline control",
  dj_name_fx_autoclose: "exchange auto-close",
  dj_name_order_notify_worker: "notification delivery",
  nq_k_payment_reminder: "payment reminder",
  nq_e_automation_off: "Automatic reminders are off",
  nq_e_paused: "Reminders for the order are paused",
  nq_e_cancelled: "The order is cancelled",
  nq_e_deadline_changed: "The payment deadline changed",
  nq_e_paid: "Already paid",
  nq_e_daily_limit: "Daily reminder limit reached",
  nq_a_claimed: "picked up",
  nq_a_sent: "sent",
  nq_a_retry: "retry",
  nq_a_failed: "error",
  nq_a_skipped: "skipped",
  nq_a_requeued: "retried manually",
  nq_a_deferred: "moved to sending hours",
  nav_today: "Today",
  td_title: "To do today",
  td_empty: "Nothing urgent for today.",
  td_empty_new: "No orders yet. Tap “Create” to add the first one.",
  td_more: "Show {n} more",
  td_r_request: "New request from {name}",
  td_r_no_price: "Awaiting payment, but no client price is set",
  td_r_no_weight: "Goods are at the China warehouse, weight is missing",
  td_r_no_tracking: "Order is in transit, no tracking number",
  td_r_payment_overdue: "Payment deadline passed, {s} left to pay",
  td_r_delivery_overdue: "Delivery deadline passed (expected {d})",
  td_r_delivery_soon: "Delivery deadline is near (expected {d})",
  td_btn_calc: "Calculate price",
  td_btn_price: "Set price",
  td_btn_weight: "Enter weight",
  td_btn_track: "Add tracking",
  td_btn_open: "Open order",
  td_r_nq_failed: "{n} client notifications not sent. Clients don't know the status changed",
  td_btn_nq: "View",
  ca_pay: "Record payment",
  ca_next: "Next: {s}",
  ca_step: "Next step: {s}",
  ca_left: "Left to pay: {s}",
  ca_price_unknown: "Price not set",
  ca_eta: "Delivery: {d}",
  ca_eta_none: "No delivery date set",
  ca_details: "Details",
  mod_shop: "Shop (product showcase)",
  mod_fx: "Currency exchange",
  mod_note: "Turning it off hides the menu item. Data and rules do not change; you can turn it back on any time.",
  mod_old: "Modules and time zone are unavailable for now: the database lacks update 55 or there is no connection. Orders work as before. Simple mode is remembered on this device only.",
  mod_note_open: "Exchange is off, but {n} deals or disputes are not finished. The “Exchange” item stays until they are closed.",
  mod_saved: "Saved",
  tz_title: "Workspace time zone",
  tz_zone: "Time zone (for example Asia/Bishkek)",
  tz_rule: "Payment and delivery deadlines are entered and shown in this zone, and reminder send hours are counted in it. If you change the zone, deadlines already set stay the same moment in time; only the way they are shown changes.",
  tz_confirm: "Yes, the zone is correct",
  tz_change: "Save zone",
  tz_state_ok: "Workspace time zone: {z}. Confirmed on {d}.",
  tz_state_new: "Workspace time zone: {z}. You have not confirmed it yet — check it and press “Yes, the zone is correct”.",
  tz_saved: "Time zone saved",
  tz_err: "No such time zone, or it could not be saved.",
  tz_preview: "Deadlines of {n} active orders stay the same moment. For {d} of them the local day will change.",
  tz_confirm_change: "Change time zone from {a} to {b}?\n\nDeadlines of {n} active orders stay the same moment in time, but for {d} of them the local day will change. You can undo this by changing the zone back.",
  f_unsaved: "You have unsaved changes. Close without saving?",
  f_unsaved_keep: "Keep editing",
  f_unsaved_drop: "Close without saving",
  f_stage_hint: "Weight and tracking number appear when the order reaches the China warehouse. Other fields are under “Show all fields”.",
  f_err_num: "Check the number in “{f}”: digits only.",
  req_client: "Enter the client.",
  req_product: "Enter the product name.",
  cp_search: "Find a client from your list",
  cp_ph: "Name, phone or Telegram",
  cp_clear: "Another",
  cp_chosen: "Client: {name} ({info})",
  cp_noname: "no name",
  cp_nophone: "no phone",
  cp_noaddr: "no address",
  cp_orders: "orders: {n}",
  cp_none: "No such client. Type the name below — the client will be created automatically.",
  cp_last: "last order № {n}",
  cab_nf_title: "This link does not work",
  cab_nf_text: "It is wrong or switched off. Ask your buyer for a new link.",
  cab_retry: "Try again",
  cab_net_err: "Could not load. Check your connection and try again.",
  cab_unpriced: "Price not set yet",
  cab_unpriced_note: "Orders without a price: {n}. They are not included in the amount left to pay.",
  cab_cancelled: "Cancelled",
  cab_eta: "Expected delivery",
  cab_eta_none: "No date given yet",
  cab_next: "Next step",
  ns_unpriced: "The buyer is working out the price. Nothing to pay yet.",
  ns_pay: "Pay the remaining {sum}. Ask your buyer for payment details.",
  ns_addr: "Please give your delivery address.",
  ns_progress: "The buyer is handling your order. Nothing is needed from you.",
  ns_transit: "The parcel is on its way. Follow it by tracking number.",
  ns_transit_notrack: "The parcel is on its way. The buyer has not given a tracking number yet.",
  ns_arrived: "The order has arrived. Arrange pickup with your buyer.",
  ns_done: "The order is complete.",
  ns_cancelled: "The order is cancelled.",
  cab_contact_title: "Contact your buyer",
  cab_contact_btn: "Contact the buyer",
  cab_contact_tg: "Message on Telegram",
  cab_contact_set_tg: "Telegram for clients",
  cab_contact_wa: "WhatsApp",
  cab_contact_call: "Call",
  cab_contact_none: "The buyer has not shared a contact. Reach them the way you placed the order.",
  cab_addr_none: "Address not given",
  cab_addr_ro: "Only the buyer can change the address — message them.",
  cab_addr_btn: "Give address",
  cab_addr_exists: "The address is already set. Only the buyer can change it.",
  cab_pre_have: "Prepayment on balance: {sum}. Only the buyer can apply it to this order.",
  cab_cancel_paid: "Paid in: {sum}. Ask your buyer about this amount.",
  cab_cost: "Order cost",
  cab_tg_on: "Telegram alerts are on for order № {n} only. Other orders are set up separately.",
  cab_tg_off: "Telegram alerts for order № {n} are off. You can turn them on from that order's own link — ask your buyer.",
  tgc_scope: "This subscription covers order № {n} only.",
  cab_updating: "Loading…",
  cab_card_exists_err: "The address is already set — only the buyer can change it.",
  dl_proposed: "The address was sent to the buyer for checking. Until the buyer confirms it, it is only your suggestion.",
  dl_confirmed: "The buyer confirmed this address. Only the buyer can change it.",
  dl_form_note: "This address applies to this order only and goes to the buyer for checking. It becomes confirmed once the buyer checks it.",
  dl_confirmed_err: "The buyer already confirmed the address — only the buyer can change it.",
  dl_staff_title: "Address given by the client",
  dl_staff_proposed: "Client suggestion: not checked. Verify with the client and confirm.",
  dl_staff_confirmed: "You confirmed this address.",
  dl_staff_source_link: "Source: order link",
  dl_staff_source_cab: "Source: the client’s shared link",
  dl_confirm: "Confirm address",
  dl_reject: "Reject",
  dl_done_confirm: "Address confirmed",
  dl_done_reject: "Suggestion rejected",
  cab_contact_set: "Contact for clients",
  cab_contact_set_hint: "Clients see this on their page. Empty means nothing is shown. Your profile phone is never shared.",
  cab_contact_phone: "Phone for clients",
  cab_contact_save: "Save contact",
  cab_contact_saved: "Contact saved",
  cab_contact_bad_phone: "Phone: 9–15 digits, may start with +.",
  cab_contact_bad_tg: "Telegram: 5–32 characters, letters, digits and _.",

  // путь заказа для клиента (js/tracking.js, файл 64)
  tk_path: "Order journey",
  tk_done: "done",
  tk_current: "now",
  tk_todo: "next",
  tk_step_of: "Step {n} of {total}",
  tk_s_accepted: "Request received",
  tk_s_buying: "Buying the item",
  tk_s_bought: "Item purchased",
  tk_s_cn_warehouse: "At the warehouse in China",
  tk_s_packing: "Preparing for shipment",
  tk_s_shipped: "Shipped from China",
  tk_s_arrived_dest: "Arrived in destination country",
  tk_s_local: "Out for local delivery",
  tk_s_ready: "Ready for pickup",
  tk_s_received: "Received",
  tk_d_accepted: "We have received your request and will start soon",
  tk_d_buying: "Your buyer is placing the order with the supplier",
  tk_d_bought: "The item has been bought from the supplier",
  tk_d_cn_warehouse: "The item has arrived at our warehouse in China",
  tk_d_packing: "We are checking, weighing and packing your item",
  tk_d_shipped: "Your parcel has left China and is on its way",
  tk_d_arrived_dest: "The cargo has arrived in the destination country and is being processed",
  tk_d_local: "Your order has been handed to local delivery",
  tk_d_ready: "Your order is ready to collect",
  tk_d_received: "Thank you! Your order has been received",
  tk_late: "Delivery is taking longer than planned. We are checking with the cargo company",
  tk_route: "Route",
  tk_route_local: "Local delivery",
  tk_route_aria: "Route diagram: {a} → {b}",
  tk_from_cn: "China",
  tk_to_door: "Address or pickup point",
  tk_days_label: "In transit",
  tk_days_one: "{n} day",
  tk_days_few: "{n} days",
  tk_days_many: "{n} days",
  tk_days_other: "{n} days",
  tk_usual_label: "Delivery usually takes",
  tk_usual: "{a}–{b} days",
  tk_eta_label: "Estimated arrival",
  tk_shipped_label: "Shipped on",
  tk_approx: "Progress is approximate and depends on the cargo company and customs",
  tk_h_stage: "Client stage updated",
  tk_h_buyer: "Buyer's note",
  tk_b_title: "Order journey for the client",
  tk_b_hint: "The client sees the stage, timing and note on their link. Changing the stage does not send any messages.",
  tk_b_stage: "Stage",
  tk_b_status_change: "The order status will change to “{s}”. If the client follows this order in Telegram, they will get the usual status message.",
  tk_b_ship: "Delivery",
  tk_b_shipped: "Shipped from China on",
  tk_b_min: "From, days",
  tk_b_max: "To, days",
  tk_b_track: "Tracking number",
  tk_b_comment: "Public note for the client",
  tk_b_comment_hint: "The client sees it, and it is saved in the order history. Do not put internal notes here.",
  tk_b_save: "Save order journey",
  tk_b_saved: "Order journey saved",
  tk_b_history: "Stage history",
  tk_e_days: "Days must be between 1 and 180.",
  tk_e_both: "Fill in both “from” and “to”, or leave both empty.",
  tk_e_order: "“From” cannot be more than “to”.",
  tk_e_date: "Check the shipping date: it cannot be in the future.",
  // карта маршрута Китай → Бишкек (js/tracking.js)
  tk_g_wh: "Warehouse in China",
  tk_g_kg: "Kyrgyzstan",
  tk_g_kz: "Kazakhstan",
  tk_c_bishkek: "Bishkek",
  tk_bd_kg: "Border",
  // срок доставки: Настройки и продление (js/tracking.js, файл 65)
  tk_def_title: "Delivery time for clients",
  tk_def_hint: "Clients see this time on every order without its own time. Empty means “10–20 days”.",
  tk_def_save: "Save delivery time",
  tk_def_saved: "Delivery time saved",
  tk_ext_label: "Extend:",
  tk_ext_btn: "+{n} d",
  tk_ext_done: "Delivery time extended: up to {n} days",
  tk_ext_eta: "The time is set by dates in the “Deadlines” block — change the dates there.",
};

I18N.en.wa_title = "Messages";

I18N.en.wa_connect_title = "WhatsApp for your customers";
I18N.en.wa_connect_hint = "Connect your number by QR code: messages, orders and notifications in your workspace.";
I18N.en.wa_connect_button = "Connect WhatsApp";

// Раздел «Команда» (файлы 67–68)
I18N.en.nav_team = "Team";
I18N.en.tw_page_hint = "Tasks, people, departments and permissions";
I18N.en.tw_invite_btn = "+ Invite";
I18N.en.tw_access_revoked = "The workspace owner has turned off your access. Your work history is kept. If this is a mistake, contact the owner.";
I18N.en.tw_e_forbidden = "You don't have permission for this";
I18N.en.tw_e_role = "Only the owner can grant this role";
I18N.en.tw_e_dup = "A department with this name already exists";
I18N.en.tw_e_cycle = "Not allowed: this would create a loop in the structure";
I18N.en.tw_e_role_used = "This role is in use. Change it for people and invitations first";
I18N.en.tw_e_system_role = "A built-in role can't be deleted, but you can edit it";
I18N.en.tw_e_self = "You can't deactivate yourself";
I18N.en.tw_e_elsewhere = "This person already works in another workspace";
I18N.en.tw_e_checklist = "Tick all checklist items first";
I18N.en.tw_e_note = "Please give a reason";
I18N.en.tw_e_no_reviewer = "Assign a reviewer first";
I18N.en.tw_e_review_required = "This task has a reviewer: submit it for review";
I18N.en.tw_e_reviewer = "The reviewer must be someone other than the assignee";
I18N.en.tw_e_assignee = "Only an active team member can be the assignee";
I18N.en.tw_e_closed = "The task is closed. Reopen it first";
I18N.en.tw_e_locked = "The checklist can't be changed while the task is in review or closed";
I18N.en.tw_e_not_found = "Task not found, or you don't have access to it";
I18N.en.tw_e_name = "Enter a name";
I18N.en.tw_e_items = "Too many items (50 at most)";
I18N.en.tw_role_manager = "Operations manager";
I18N.en.tw_role_sourcing = "Sourcing";
I18N.en.tw_role_qc = "Quality control";
I18N.en.tw_role_logistics = "Logistics";
I18N.en.tw_role_assistant = "Assistant";
I18N.en.tw_nobody = "not assigned";
I18N.en.tw_no_name = "No name";
I18N.en.tw_former = "Former team member";
I18N.en.tw_you = "you";
I18N.en.tw_reports_to = "Reports to: {n}";
I18N.en.tw_my_rights = "My permissions:";
I18N.en.tw_perm_none = "own tasks only";
I18N.en.tw_perm_team_manage = "Manage the team";
I18N.en.tw_perm_team_manage_d = "Invite people, set department, job title and role, deactivate people, manage departments";
I18N.en.tw_perm_tasks_create = "Assign tasks to others";
I18N.en.tw_perm_tasks_create_d = "Without it, you can only create tasks for yourself";
I18N.en.tw_perm_tasks_view_all = "See all tasks";
I18N.en.tw_perm_tasks_view_all_d = "Otherwise you only see your own tasks, tasks you created and your reports' tasks";
I18N.en.tw_perm_tasks_manage = "Manage any task";
I18N.en.tw_perm_tasks_manage_d = "Edit, reassign and cancel other people's tasks";
I18N.en.tw_perm_tasks_review = "Review tasks";
I18N.en.tw_perm_tasks_review_d = "Approve or return any submitted task (except your own)";
I18N.en.tw_overdue_n = "Overdue tasks: {n}";
I18N.en.tw_v_mine = "For me";
I18N.en.tw_v_review = "To review";
I18N.en.tw_v_created = "Created by me";
I18N.en.tw_v_all = "All tasks";
I18N.en.tw_v_notif = "Notifications";
I18N.en.tw_v_people = "People";
I18N.en.tw_v_depts = "Departments";
I18N.en.tw_v_roles = "Roles";
I18N.en.tw_v_audit = "Log";
I18N.en.tw_edit = "Edit";
I18N.en.tw_deactivate = "Deactivate";
I18N.en.tw_reactivate = "Reactivate";
I18N.en.tw_delete = "Delete";
I18N.en.tw_off_since = "Deactivated since {d}";
I18N.en.tw_invite_link = "Invitation link";
I18N.en.tw_inactive = "Deactivated people";
I18N.en.tw_limit = "Team members: {n} of {max}. Deactivated people don't count.";
I18N.en.tw_no_dept = "No department";
I18N.en.tw_invite_title = "Invite a team member";
I18N.en.tw_invite_hint = "The link works for 3 days and for one person only. They sign in with their own password and get the role and department right away.";
I18N.en.tw_f_name = "Who it's for";
I18N.en.tw_f_name_hint = "A name, so invitations don't get mixed up";
I18N.en.tw_f_role = "Role";
I18N.en.tw_f_dept = "Department";
I18N.en.tw_f_title = "Job title";
I18N.en.tw_invite_create = "Create link";
I18N.en.tw_edit_title = "Team member: {n}";
I18N.en.tw_no_manager = "No manager";
I18N.en.tw_f_manager = "Manager (reports to)";
I18N.en.tw_off_title = "Deactivate: {n}";
I18N.en.tw_off_hint = "Access to the workspace stops immediately. Orders, comments and work history are kept. You can reactivate at any time.";
I18N.en.tw_f_handover = "Hand over unfinished tasks to";
I18N.en.tw_leave_unassigned = "Leave unassigned";
I18N.en.tw_f_handover_hint = "Tasks \"in progress\" become \"new\" for the new assignee. Reviews move to them too.";
I18N.en.tw_f_note = "Reason (visible to managers only)";
I18N.en.tw_off_done = "Team member deactivated. Tasks handed over: {n}";
I18N.en.tw_on_confirm = "Reactivate {n}? Access to the workspace will be restored.";
I18N.en.tw_on_done = "Team member is back on the team";
I18N.en.tw_dept_head = "Head: {n}";
I18N.en.tw_people_n = "people: {n}";
I18N.en.tw_dept_add = "Add department";
I18N.en.tw_dept_edit = "Department";
I18N.en.tw_dept_empty = "No departments yet. Departments show who is responsible for what.";
I18N.en.tw_no_dept_people = "No department: {n}";
I18N.en.tw_f_dept_name = "Name";
I18N.en.tw_f_parent = "Part of department";
I18N.en.tw_f_head = "Department head";
I18N.en.tw_dept_del_confirm = "Delete the \"{n}\" department? People stay, but without a department.";
I18N.en.tw_role_add = "New role";
I18N.en.tw_role_edit = "Role";
I18N.en.tw_roles_hint_owner = "A role is a set of permissions. The database checks them: without a permission, the action simply won't go through.";
I18N.en.tw_roles_hint = "A role is a set of permissions. Only the owner can change roles.";
I18N.en.tw_role_system = "built-in";
I18N.en.tw_roles_orders_note = "Order access is unchanged for now: team members work with the workspace's orders but can't delete them or change settings. Per-order access is the next phase.";
I18N.en.tw_f_role_name = "Role name";
I18N.en.tw_f_perms = "Permissions";
I18N.en.tw_role_del_confirm = "Delete the \"{n}\" role?";
I18N.en.tw_moved_n = "tasks handed over: {n}";
I18N.en.tw_a_invite_create = "{who}: new invitation {x}";
I18N.en.tw_a_invite_revoke = "{who}: invitation cancelled";
I18N.en.tw_a_member_join = "{whom}: accepted the invitation ({x})";
I18N.en.tw_a_member_rejoin = "{whom}: back on the team ({x})";
I18N.en.tw_a_member_update = "{who}: updated {whom}";
I18N.en.tw_a_member_deactivate = "{who}: deactivated {whom}, {x}";
I18N.en.tw_a_member_reactivate = "{who}: reactivated {whom}";
I18N.en.tw_a_member_reassign = "{who}: handed over {whom}'s tasks";
I18N.en.tw_a_department_create = "{who}: new department \"{x}\"";
I18N.en.tw_a_department_update = "{who}: updated department \"{x}\"";
I18N.en.tw_a_department_delete = "{who}: deleted department \"{x}\"";
I18N.en.tw_a_role_create = "{who}: new role \"{x}\"";
I18N.en.tw_a_role_update = "{who}: updated role \"{x}\"";
I18N.en.tw_a_role_delete = "{who}: deleted role \"{x}\"";
I18N.en.tw_audit_empty = "Nothing here yet";
I18N.en.tw_n_assigned = "New task for you: T-{n} \"{x}\" (from {who})";
I18N.en.tw_n_unassigned = "Task T-{n} \"{x}\" was given to someone else ({who})";
I18N.en.tw_n_reviewer = "You review T-{n} \"{x}\" ({who})";
I18N.en.tw_n_submitted = "Submitted for review: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_approved = "Approved: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_rejected = "Returned for rework: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_blocked = "Blocked: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_done = "Done: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_cancelled = "Cancelled: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_reopened = "Reopened: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_comment = "Comment on T-{n} \"{x}\" ({who})";
I18N.en.tw_n_updated = "Updated: T-{n} \"{x}\" ({who})";
I18N.en.tw_n_handover = "Task handed over to you: T-{n} \"{x}\" ({who})";
I18N.en.tw_read_all = "Mark all as read";
I18N.en.tw_notif_empty = "No notifications yet";
I18N.en.tw_task_no = "T-{n}";
I18N.en.tw_st_todo = "New";
I18N.en.tw_st_in_progress = "In progress";
I18N.en.tw_st_blocked = "Blocked";
I18N.en.tw_st_submitted = "In review";
I18N.en.tw_st_done = "Done";
I18N.en.tw_st_cancelled = "Cancelled";
I18N.en.tw_pr_low = "Low";
I18N.en.tw_pr_normal = "Normal";
I18N.en.tw_pr_high = "High";
I18N.en.tw_pr_urgent = "Urgent";
I18N.en.tw_due = "due {d}";
I18N.en.tw_due_over = "overdue: {d}";
I18N.en.tw_unassigned = "Unassigned";
I18N.en.tw_items_n = "{a}/{b}";
I18N.en.tw_comments_n = "comments: {n}";
I18N.en.tw_empty_mine = "No tasks for you.";
I18N.en.tw_empty_review = "Nothing to review.";
I18N.en.tw_empty_created = "You haven't created any tasks yet.";
I18N.en.tw_empty_all = "No tasks yet.";
I18N.en.tw_task_new = "New task";
I18N.en.tw_closed_n = "Closed in the last 30 days: {n}";
I18N.en.tw_act_start = "Start";
I18N.en.tw_act_resume = "Resume";
I18N.en.tw_act_submit = "Submit for review";
I18N.en.tw_act_done = "Mark done";
I18N.en.tw_act_block = "Report a blocker";
I18N.en.tw_act_withdraw = "Withdraw";
I18N.en.tw_act_approve = "Approve";
I18N.en.tw_act_reject = "Return for rework";
I18N.en.tw_act_edit = "Edit";
I18N.en.tw_act_cancel = "Cancel task";
I18N.en.tw_act_restore = "Restore";
I18N.en.tw_act_reopen = "Reopen";
I18N.en.tw_f_assignee = "Assignee";
I18N.en.tw_f_reviewer = "Reviewer";
I18N.en.tw_no_review = "No review";
I18N.en.tw_f_due = "Due";
I18N.en.tw_f_author = "Created by";
I18N.en.tw_checklist = "Checklist";
I18N.en.tw_item_add = "New item";
I18N.en.tw_add = "Add";
I18N.en.tw_items_first = "To submit the task, tick every checklist item.";
I18N.en.tw_confirm = "Confirm";
I18N.en.tw_reason = "Reason (required)";
I18N.en.tw_reason_opt = "Reason (optional)";
I18N.en.tw_comments = "Comments";
I18N.en.tw_no_comments = "No comments yet";
I18N.en.tw_comment_ph = "Write a comment…";
I18N.en.tw_send = "Send";
I18N.en.tw_internal_note = "Tasks and comments are visible to the team only. Customers with a link can't see them.";
I18N.en.tw_history = "History";
I18N.en.tw_ev_created = "{who}: task created";
I18N.en.tw_ev_status = "{who}: {a} → {b}";
I18N.en.tw_ev_approved = "{who}: approved";
I18N.en.tw_ev_rejected = "{who}: returned for rework";
I18N.en.tw_ev_assigned = "{who}: assignee — {n}";
I18N.en.tw_ev_reviewer = "{who}: reviewer — {n}";
I18N.en.tw_ev_handover = "Handover: assignee {a} → {b}";
I18N.en.tw_ev_handover_r = "Handover: reviewer {a} → {b}";
I18N.en.tw_ev_edited = "{who}: task details changed";
I18N.en.tw_ev_item_added = "{who}: added item \"{x}\"";
I18N.en.tw_ev_item_checked = "{who}: ticked \"{x}\"";
I18N.en.tw_ev_item_unchecked = "{who}: unticked \"{x}\"";
I18N.en.tw_ev_item_removed = "{who}: removed item \"{x}\"";
I18N.en.tw_saved_status = "Done";
I18N.en.tw_task_edit = "Task";
I18N.en.tw_task_create = "Create task";
I18N.en.tw_task_created = "Task created";
I18N.en.tw_f_task_title = "What needs doing";
I18N.en.tw_f_desc = "Details";
I18N.en.tw_f_priority = "Priority";
I18N.en.tw_f_items_hint = "One item per line";
I18N.en.tw_only_self = "Your role only lets you create tasks for yourself.";
I18N.en.tw_perm_orders_all = "All workspace orders";
I18N.en.tw_perm_orders_all_d = "See and manage all orders, customers and money. Without it, only assigned orders and only the fields of your duty";
I18N.en.tw_perm_orders_assign = "Assign people to orders";
I18N.en.tw_perm_orders_assign_d = "Order lead and team, milestone templates, delay overview";
I18N.en.tw_roles_orders_note69 = "Without \"All workspace orders\", a team member sees only orders they are assigned to, and only the fields of their duty: customer prices, payments and profit are never shown.";
I18N.en.tw_a_template_save = "{who}: saved template \"{x}\"";
I18N.en.tw_a_template_delete = "{who}: deleted template \"{x}\"";
I18N.en.to_v_orders = "My orders";
I18N.en.to_v_attention = "Need attention";
I18N.en.to_v_templates = "Milestone templates";
I18N.en.to_duty_lead = "Order lead";
I18N.en.to_duty_sourcing = "Sourcing";
I18N.en.to_duty_qc = "Quality control";
I18N.en.to_duty_logistics = "Logistics";
I18N.en.to_duty_support = "Support";
I18N.en.to_duty_none = "No duty";
I18N.en.to_state_on_track = "On track";
I18N.en.to_state_at_risk = "At risk";
I18N.en.to_state_delayed = "Delayed";
I18N.en.to_ms_pending = "Pending";
I18N.en.to_ms_in_progress = "In progress";
I18N.en.to_ms_done = "Done";
I18N.en.to_ms_delayed = "Delayed";
I18N.en.to_ms_skipped = "Skipped";
I18N.en.to_lead_n = "Lead: {n}";
I18N.en.to_no_lead = "No lead";
I18N.en.to_next = "Next: {x} by {d}";
I18N.en.to_delays_n = "Delays: {n}";
I18N.en.to_mine_hint = "Orders where you are on the team. You see only the data you need.";
I18N.en.to_attention_hint = "Orders with an open delay or an overdue milestone.";
I18N.en.to_empty_mine = "You haven't been assigned to any orders yet.";
I18N.en.to_empty_attention = "All orders are on track.";
I18N.en.to_my_duties = "My duty: {x}";
I18N.en.to_f_product = "Product";
I18N.en.to_f_qty = "Quantity";
I18N.en.to_f_date = "Order date";
I18N.en.to_f_eta = "Expected delivery";
I18N.en.to_f_ship_to = "Destination";
I18N.en.to_f_client = "Customer";
I18N.en.to_f_supplier = "Supplier";
I18N.en.to_link = "link";
I18N.en.to_f_price = "Purchase price per unit";
I18N.en.to_f_track = "Tracking number";
I18N.en.to_f_dest = "Delivery to customer";
I18N.en.to_f_order = "Order";
I18N.en.to_edit_fields = "Edit details";
I18N.en.to_scoped_note = "You see the fields of your duty. Customer prices, payments and profit are hidden.";
I18N.en.to_team = "Order team";
I18N.en.to_team_empty = "No one is assigned to this order yet.";
I18N.en.to_assign = "Assign to order";
I18N.en.to_milestones = "Milestones";
I18N.en.to_ms_start = "Start";
I18N.en.to_ms_finish = "Mark done";
I18N.en.to_ms_undo = "Reopen";
I18N.en.to_ms_skip = "Skip";
I18N.en.to_report_delay = "Report a delay";
I18N.en.to_ms_empty = "No milestones yet.";
I18N.en.to_tpl_apply = "Add milestones from template";
I18N.en.to_tpl_replace = "Replace from template";
I18N.en.to_ms_add = "Milestone";
I18N.en.to_delay_open = "Open delay";
I18N.en.to_delay_closed = "Resolved";
I18N.en.to_cat_supplier = "Supplier";
I18N.en.to_cat_quality = "Quality";
I18N.en.to_cat_logistics = "Logistics";
I18N.en.to_cat_customs = "Customs";
I18N.en.to_cat_client = "Customer";
I18N.en.to_cat_other = "Other";
I18N.en.to_new_due = "due {a} → {b}";
I18N.en.to_actions = "Corrective actions:";
I18N.en.to_resolution = "Outcome: {x}";
I18N.en.to_action_add = "Corrective action";
I18N.en.to_resolve = "Close the delay";
I18N.en.to_delays = "Delays";
I18N.en.to_delays_none = "No delays.";
I18N.en.to_internal_note = "Milestones, delays and the team are internal. Customers with a link can't see them.";
I18N.en.to_ev_team_add = "{who}: {n} — {d}";
I18N.en.to_ev_team_remove = "{who}: removed {n} ({d})";
I18N.en.to_ev_handover = "Handover: {a} → {b} ({d})";
I18N.en.to_ev_template = "{who}: milestones from template \"{x}\"";
I18N.en.to_ev_ms_add = "{who}: new milestone \"{x}\"";
I18N.en.to_ev_ms_edit = "{who}: edited milestone \"{x}\"";
I18N.en.to_ev_ms_delete = "{who}: deleted milestone \"{x}\"";
I18N.en.to_ev_ms_status = "{who}: \"{x}\" — {s}";
I18N.en.to_ev_fields = "{who}: changed — {x}";
I18N.en.to_ev_delay = "{who}: delay ({x})";
I18N.en.to_ev_action = "{who}: action \"{x}\"";
I18N.en.to_ev_resolve = "{who}: delay closed";
I18N.en.to_fld_supplier = "Supplier";
I18N.en.to_fld_supplier_link = "Supplier product link";
I18N.en.to_fld_supplier_wechat = "Supplier WeChat";
I18N.en.to_fld_tracking_number = "Tracking number";
I18N.en.to_fields_hint = "Prices, weight and order status are changed by someone with access to all orders.";
I18N.en.to_f_person = "Team member";
I18N.en.to_f_duty = "Duty";
I18N.en.to_assign_hint = "An order has one lead: a new lead replaces the old one. The person gets a notification.";
I18N.en.to_ms_edit = "Milestone";
I18N.en.to_f_ms_title = "Milestone name";
I18N.en.to_ms_delete = "Delete milestone";
I18N.en.to_f_template = "Template";
I18N.en.to_tpl_hint = "Milestone dates are counted from today.";
I18N.en.to_tpl_replace_hint = "Unfinished milestones will be replaced; completed ones stay.";
I18N.en.to_delay_hint = "The milestone becomes \"delayed\"; the lead and the owner are notified. Nothing is sent to the customer.";
I18N.en.to_f_milestone = "Milestone";
I18N.en.to_whole_order = "Whole order";
I18N.en.to_f_category = "Cause";
I18N.en.to_f_reason = "What happened";
I18N.en.to_f_new_due = "New milestone date";
I18N.en.to_f_shift = "Shift the following milestones by the same amount";
I18N.en.to_delay_saved = "Delay recorded, the people responsible were notified";
I18N.en.to_f_action = "What to do";
I18N.en.to_action_hint = "The action becomes a team task linked to the order.";
I18N.en.to_f_resolution = "How it was resolved";
I18N.en.to_resolved = "Delay closed";
I18N.en.to_tpl_new = "New template";
I18N.en.to_tpl_edit = "Template";
I18N.en.to_tpl_page_hint = "A template is a ready list of order milestones with duties and deadlines in days from the start.";
I18N.en.to_day_n = "day {n}";
I18N.en.to_f_days = "Days from start";
I18N.en.to_tpl_steps_hint = "Milestone · duty · days from start";
I18N.en.to_step_add = "Step";
I18N.en.to_e_steps = "A name and at least one step are required";
I18N.en.to_tpl_del_confirm = "Delete the \"{n}\" template? Milestones in orders stay.";
I18N.en.to_detail_title = "Team and milestones";
I18N.en.to_detail_hint = "Who runs the order, milestones, delays";
I18N.en.to_detail_open = "Open";
I18N.en.to_unassign_confirm = "Remove this person from the duty on this order?";
I18N.en.to_ms_del_confirm = "Delete this milestone?";
I18N.en.to_n_assigned = "You were assigned to order {x} ({who})";
I18N.en.to_n_unassigned = "You were removed from order {x} ({who})";
I18N.en.to_n_delay = "Delay on order {x} ({who})";
I18N.en.to_n_resolved = "Delay on order {x} closed ({who})";
I18N.en.to_e_not_found = "Order not found, or you aren't assigned to it";
I18N.en.to_e_ms_exist = "The order already has milestones";
I18N.en.to_e_delay_open = "Close this milestone's delay first";
I18N.en.to_e_closed = "The order is closed";
I18N.en.to_e_category = "Choose a cause";
I18N.en.to_e_delay_closed = "The delay is already closed";
I18N.en.to_e_ms_closed = "The milestone is already done or skipped";
I18N.en.tw_g_tasks = "Tasks";
I18N.en.tw_g_orders = "Orders";
I18N.en.tw_g_ops = "Operations";
I18N.en.tw_g_people = "People";
I18N.en.tw_g_reports = "Reports";
I18N.en.tw_perm_ops_manage = "Run operations";
I18N.en.tw_perm_ops_manage_d = "SOPs and incidents: assign owners, close, edit calendar events";
I18N.en.tw_perm_reports_view = "See team analytics";
I18N.en.tw_perm_reports_view_d = "Everyone's metrics and team totals. Without it, only your own metrics";
I18N.en.tw_a_sop_save = "{who}: saved SOP \"{x}\"";
I18N.en.op_v_dashboard = "Overview";
I18N.en.op_v_incidents = "Incidents";
I18N.en.op_v_calendar = "Calendar";
I18N.en.op_v_sops = "SOPs";
I18N.en.op_v_analytics = "Analytics";
I18N.en.op_dash_hint = "What needs attention right now. Tap a number to open the list.";
I18N.en.op_dash_orders = "Orders";
I18N.en.op_dash_tasks = "Tasks";
I18N.en.op_dash_incidents = "Incidents and SOPs";
I18N.en.op_dash_workload = "Team workload";
I18N.en.op_d_open = "open";
I18N.en.op_d_no_lead = "no lead";
I18N.en.op_d_ms_overdue = "milestones overdue";
I18N.en.op_d_ms_week = "milestones in 7 days";
I18N.en.op_d_delays_by = "Open delays: {n}. Causes:";
I18N.en.op_d_overdue = "overdue";
I18N.en.op_d_done_week = "done in 7 days";
I18N.en.op_d_inc_open = "open incidents";
I18N.en.op_d_sops = "SOPs";
I18N.en.op_d_sops_unread = "unread (person × SOP)";
I18N.en.op_w_open = "tasks";
I18N.en.op_inc_new = "Report an incident";
I18N.en.op_inc_report = "Report";
I18N.en.op_inc_hint = "An incident is a problem to investigate: defects, loss, a breach. The people responsible are notified.";
I18N.en.op_inc_saved = "Incident recorded";
I18N.en.op_inc_no = "I-{n}";
I18N.en.op_inc_show_all = "Show all (6 months)";
I18N.en.op_inc_show_open = "Open only";
I18N.en.op_inc_empty = "No open incidents.";
I18N.en.op_inc_empty_all = "No incidents.";
I18N.en.op_owner_n = "Owner: {n}";
I18N.en.op_no_owner = "No owner";
I18N.en.op_no_order = "No order";
I18N.en.op_actions_open = "open actions: {n}";
I18N.en.op_f_inc_title = "What happened";
I18N.en.op_f_inc_desc = "Details";
I18N.en.op_f_severity = "Severity";
I18N.en.op_f_owner = "Owner";
I18N.en.op_f_reporter = "Reported by";
I18N.en.op_f_root = "Root cause:";
I18N.en.op_f_resolution = "Resolution:";
I18N.en.op_sev_low = "Low";
I18N.en.op_sev_medium = "Medium";
I18N.en.op_sev_high = "High";
I18N.en.op_sev_critical = "Critical";
I18N.en.op_ist_open = "Open";
I18N.en.op_ist_investigating = "Investigating";
I18N.en.op_ist_resolved = "Resolved";
I18N.en.op_ist_closed = "Closed";
I18N.en.op_cat_supplier = "Supplier";
I18N.en.op_cat_quality = "Quality";
I18N.en.op_cat_logistics = "Logistics";
I18N.en.op_cat_customs = "Customs";
I18N.en.op_cat_client = "Customer";
I18N.en.op_cat_finance = "Finance";
I18N.en.op_cat_safety = "Safety";
I18N.en.op_cat_other = "Other";
I18N.en.op_act_investigate = "Start investigating";
I18N.en.op_act_resolve = "Resolve";
I18N.en.op_act_close = "Close";
I18N.en.op_act_reopen = "Reopen";
I18N.en.op_act_owner = "Owner and severity";
I18N.en.op_resolve_hint = "You can resolve once all corrective actions are done. Someone who runs operations closes it.";
I18N.en.op_e_resolution = "Enter the root cause and the resolution";
I18N.en.op_internal_note = "Incidents are visible to the team only. Nothing is sent to the customer.";
I18N.en.op_ev_created = "{who}: incident opened";
I18N.en.op_ev_status = "{who}: {a} → {b}";
I18N.en.op_ev_owner = "{who}: owner — {n}";
I18N.en.op_ev_severity = "{who}: severity — {s}";
I18N.en.op_ev_comment = "{who}: comment";
I18N.en.op_ev_action = "{who}: corrective action";
I18N.en.op_n_incident_new = "New incident I-{n} \"{x}\" ({s}, {who})";
I18N.en.op_n_incident_owner = "You own incident I-{n} \"{x}\" ({who})";
I18N.en.op_n_incident_status = "Incident I-{n} \"{x}\": {s} ({who})";
I18N.en.op_n_sop_published = "New or updated SOP \"{x}\" — please read ({who})";
I18N.en.op_cal_prev = "Earlier";
I18N.en.op_cal_next = "Later";
I18N.en.op_cal_today = "Today";
I18N.en.op_cal_mine = "Mine only";
I18N.en.op_event_new = "Event";
I18N.en.op_event_edit = "Event";
I18N.en.op_event_del_confirm = "Delete this event?";
I18N.en.op_f_event_title = "Title";
I18N.en.op_f_starts = "Starts";
I18N.en.op_f_ends = "Ends";
I18N.en.op_f_note = "Note";
I18N.en.op_k_event = "event";
I18N.en.op_k_task = "task";
I18N.en.op_k_milestone = "milestone";
I18N.en.op_k_incident = "incident";
I18N.en.op_sop_new = "SOP";
I18N.en.op_sop_edit = "SOP";
I18N.en.op_sop_hint = "SOPs describe how we work. Read new and updated ones and mark them as read.";
I18N.en.op_sop_empty = "No SOPs yet.";
I18N.en.op_sop_unread = "Unread";
I18N.en.op_sop_read = "Read";
I18N.en.op_sop_read_v = "Version {n} read";
I18N.en.op_sop_ack = "I have read it";
I18N.en.op_sop_acked_ok = "Marked as read";
I18N.en.op_sop_ver = "Version {n} · {d}";
I18N.en.op_sop_acked = "read by {a} of {b}";
I18N.en.op_sop_who = "Who has read the current version";
I18N.en.op_sop_ack_ok = "read on {d}";
I18N.en.op_sop_ack_old = "only read version {n}";
I18N.en.op_sop_ack_no = "not read";
I18N.en.op_sop_versions = "Earlier versions: {n}";
I18N.en.op_sop_st_draft = "Draft";
I18N.en.op_sop_st_published = "Published";
I18N.en.op_sop_st_archived = "Archived";
I18N.en.op_f_sop_title = "Title";
I18N.en.op_f_sop_cat = "Section";
I18N.en.op_f_sop_body = "SOP text";
I18N.en.op_f_sop_status = "Status";
I18N.en.op_sop_body_hint = "One step per line. Every text change keeps the earlier version, and people mark it as read again.";
I18N.en.op_e_sop = "A title and text are required";
I18N.en.rp_days_7 = "7 days";
I18N.en.rp_days_30 = "30 days";
I18N.en.rp_days_90 = "90 days";
I18N.en.rp_days_365 = "Year";
I18N.en.rp_export = "Download Excel";
I18N.en.rp_exported = "Report downloaded";
I18N.en.rp_hint_all = "Metrics for the period from tasks, order milestones, delays and incidents. Only team work is counted — order amounts are not included.";
I18N.en.rp_hint_me = "Your metrics for the period. Team-wide metrics are visible with the \"See team analytics\" permission.";
I18N.en.rp_team = "Team";
I18N.en.rp_k_done = "tasks done";
I18N.en.rp_k_on_time = "on time";
I18N.en.rp_k_cycle = "time per task";
I18N.en.rp_k_returns = "returned from review";
I18N.en.rp_k_ms_on_time = "milestones on time";
I18N.en.rp_k_delays = "delays";
I18N.en.rp_k_incidents = "incidents";
I18N.en.rp_k_overdue_now = "overdue now";
I18N.en.rp_of_created = "of {n} created";
I18N.en.rp_of_due = "of {n} with a due date";
I18N.en.rp_of_submitted = "of {n} submitted";
I18N.en.rp_of_done = "of {n} done";
I18N.en.rp_h = "h";
I18N.en.rp_resolve_h = "resolved in {n} h on average";
I18N.en.rp_quality = "Quality";
I18N.en.rp_q_qc_done = "QC milestones done";
I18N.en.rp_q_qc_delayed = "QC milestones delayed";
I18N.en.rp_q_delays = "quality delays";
I18N.en.rp_q_incidents = "quality incidents";
I18N.en.rp_delays_by = "Delays by cause";
I18N.en.rp_c_count = "Count";
I18N.en.rp_c_shift = "Date shift, days";
I18N.en.rp_c_resolve = "Closed in, h";
I18N.en.rp_inc_by = "Incidents by category:";
I18N.en.rp_steps = "Most delays happen at:";
I18N.en.rp_weekly = "Tasks done per week";
I18N.en.rp_week_tip = "Week of {d}: {n} done";
I18N.en.rp_table = "Weekly table";
I18N.en.rp_c_week = "Week";
I18N.en.rp_c_created = "Created";
I18N.en.rp_c_done = "Done";
I18N.en.rp_people = "Team member metrics";
I18N.en.rp_me = "My metrics";
I18N.en.rp_c_ms = "Milestones (on time)";
I18N.en.rp_c_reviewed = "Reviewed";
I18N.en.rp_c_open = "Open now";
I18N.en.rp_people_note = "\"On time\" counts done tasks that had a due date. \"Returned\" is how often a submitted task was sent back. Use these to start a conversation, not to punish: look at the causes.";
I18N.en.rp_period = "Period: {a} – {b}";

// «Мои цели» (js/goals.js, файл 72)
I18N.en.nav_goals = "My goals";
I18N.en.gl_page_hint = "Goals for 5 years, a year, a month and a week, a task board and today's focus. Only you can see them.";
I18N.en.gl_v_today = "Today";
I18N.en.gl_v_goals = "Goals";
I18N.en.gl_v_calendar = "Calendar";
I18N.en.gl_missing = "This section will work after the database update (file 72). Orders and other data are not affected.";
I18N.en.gl_focus = "Today's focus";
I18N.en.gl_focus_hint = "Three main things that move your goals forward. Everything else can wait.";
I18N.en.gl_focus_done = "{n} of {m} done";
I18N.en.gl_pick_slot = "+ Pick a main task";
I18N.en.gl_no_goal = "not linked to a goal";
I18N.en.gl_in_focus_min = "{n} min in focus";
I18N.en.gl_timer = "Focus timer";
I18N.en.gl_t_running = "running";
I18N.en.gl_t_paused = "paused";
I18N.en.gl_t_ready = "ready";
I18N.en.gl_t_on = "Working on:";
I18N.en.gl_t_hint = "Tap ▶ next to a focus task to count the time towards it";
I18N.en.gl_min = "{n} min";
I18N.en.gl_t_start = "Start";
I18N.en.gl_t_pause = "Pause";
I18N.en.gl_t_resume = "Resume";
I18N.en.gl_t_finish = "Finish and count";
I18N.en.gl_t_done = "Session finished: {n} min in focus";
I18N.en.gl_t_credited = "{n} min counted";
I18N.en.gl_t_short = "Less than a minute — not counted";
I18N.en.gl_s_min = "minutes in focus today";
I18N.en.gl_s_done = "done today";
I18N.en.gl_s_streak = "days in a row";
I18N.en.gl_quick = "Quick note";
I18N.en.gl_quick_hint = "goes to Inbox";
I18N.en.gl_quick_ph = "What needs to be done?";
I18N.en.gl_quick_btn = "Add";
I18N.en.gl_quick_ok = "Added to Inbox";
I18N.en.gl_l_overdue = "Overdue";
I18N.en.gl_l_today = "Due today";
I18N.en.gl_l_doing = "In progress";
I18N.en.gl_e_overdue = "Nothing is overdue.";
I18N.en.gl_e_today = "Nothing is due today.";
I18N.en.gl_e_doing = "Nothing in progress.";
I18N.en.gl_more = "and {n} more";
I18N.en.gl_more_focus = "Also in focus: {list}";
I18N.en.gl_to_focus = "Add to today's focus";
I18N.en.gl_focused = "Added to today's focus";
I18N.en.gl_unfocus = "Remove from focus";
I18N.en.gl_timer_task = "Start the timer for this task";
I18N.en.gl_mark_done = "Mark as done";
I18N.en.gl_c_inbox = "Inbox";
I18N.en.gl_c_plan = "Planned";
I18N.en.gl_c_doing = "In progress";
I18N.en.gl_c_done = "Done";
I18N.en.gl_h_inbox = "ideas and anything that came to mind";
I18N.en.gl_h_plan = "decided to do";
I18N.en.gl_h_doing = "already started";
I18N.en.gl_all_goals = "All goals";
I18N.en.gl_new_task = "+ Task";
I18N.en.gl_add_card = "+ Add a card";
I18N.en.gl_hidden = "{n} more hidden";
I18N.en.gl_board_hint = "Drag cards between columns. On a phone, open a card and choose a column.";
I18N.en.gl_late = "overdue";
I18N.en.gl_today_chip = "today";
I18N.en.gl_tomorrow = "tomorrow";
I18N.en.gl_hz_5y = "5 years";
I18N.en.gl_hz_year = "Year";
I18N.en.gl_hz_month = "Month";
I18N.en.gl_hz_week = "Week";
I18N.en.gl_add_5y = "5-year goal";
I18N.en.gl_add_year = "Goal for the year";
I18N.en.gl_add_month = "Goal for the month";
I18N.en.gl_add_week = "Goal for the week";
I18N.en.gl_hint_5y = "Who you want to become and what to build. For example: “My own company with a team of 20”.";
I18N.en.gl_hint_year = "A big step towards the 5-year goal. For example: “Pass HSK 5”.";
I18N.en.gl_hint_month = "What should be done by the end of the month.";
I18N.en.gl_hint_week = "A concrete result for this week.";
I18N.en.gl_active = "Active: {n}";
I18N.en.gl_leads_to = "leads to: {name}";
I18N.en.gl_steps = "{d} of {t} steps · {p}%";
I18N.en.gl_no_steps = "No steps yet — add a task or a smaller goal";
I18N.en.gl_why_strategy = "Why and strategy";
I18N.en.gl_why = "Why it matters to me";
I18N.en.gl_strategy = "Strategy";
I18N.en.gl_edit = "Edit";
I18N.en.gl_add_step = "+ Step";
I18N.en.gl_achieved = "Achieved";
I18N.en.gl_reopen = "Reopen";
I18N.en.gl_until = "until {d}";
I18N.en.gl_days_left = "{n} d";
I18N.en.gl_overdue_goal = "deadline passed";
I18N.en.gl_areas = "Business|Finance|Health|Family|Study|Personal";
I18N.en.gl_cal_task = "task due";
I18N.en.gl_cal_late = "overdue";
I18N.en.gl_cal_goal = "goal deadline";
I18N.en.gl_cal_focus = "focus time";
I18N.en.gl_day_empty = "Nothing is due on this day.";
I18N.en.gl_day_add = "+ Task for this day";
I18N.en.gl_day_focus = "In focus: {n} min";
I18N.en.gl_rem_title = "Daily reminder";
I18N.en.gl_rem_hint = "Your phone's calendar will remind you every morning: “Choose today's focus”. Download the event and tap “Add”.";
I18N.en.gl_rem_time = "Time";
I18N.en.gl_rem_btn = "Add to calendar";
I18N.en.gl_rem_ok = "Open the downloaded file to add the event to your calendar.";
I18N.en.gl_rem_summary = "Choose today's focus";
I18N.en.gl_rem_desc = "Open ULA Factory → My goals and choose the three main tasks.";
I18N.en.gl_ics_btn = "To calendar";
I18N.en.gl_task = "Task";
I18N.en.gl_task_new = "New task";
I18N.en.gl_f_title = "What to do";
I18N.en.gl_f_col = "Column";
I18N.en.gl_f_due = "Due date";
I18N.en.gl_f_goal = "Goal it leads to";
I18N.en.gl_f_nogoal = "No goal";
I18N.en.gl_f_focus = "In today's focus";
I18N.en.gl_f_notes = "Notes";
I18N.en.gl_f_check = "Checklist";
I18N.en.gl_f_check_ph = "New item";
I18N.en.gl_f_total = "Total in focus: {n} min";
I18N.en.gl_need_title = "Write what needs to be done.";
I18N.en.gl_add = "Add";
I18N.en.gl_delete = "Delete";
I18N.en.gl_delete_sure = "Delete for sure?";
I18N.en.gl_cancel = "Cancel";
I18N.en.gl_save = "Save";
I18N.en.gl_close = "Close";
I18N.en.gl_goal = "Goal";
I18N.en.gl_goal_new = "New goal";
I18N.en.gl_g_title = "Goal";
I18N.en.gl_g_ph = "For example: pass HSK 5";
I18N.en.gl_g_hz = "Horizon";
I18N.en.gl_g_area = "Area";
I18N.en.gl_g_noarea = "No area";
I18N.en.gl_g_parent = "Leads to goal";
I18N.en.gl_g_top = "This is the biggest goal";
I18N.en.gl_g_none = "None";
I18N.en.gl_g_why_ph = "What will change when the goal is reached";
I18N.en.gl_g_strategy = "Strategy: how I will get there";
I18N.en.gl_g_strategy_ph = "Main steps, resources, obstacles and how to get around them";
I18N.en.gl_g_need = "Write the goal.";
I18N.en.gl_pick_title = "Main task for today";
I18N.en.gl_pick_hint = "Choose the task that moves your goal the most.";
I18N.en.gl_pick_new = "Or type a new task";
I18N.en.gl_pick_g1 = "Due today or earlier";
I18N.en.gl_pick_none = "No open tasks — type a new one above.";
I18N.en.gl_e_focus_full = "There are already three focus tasks. Remove one to add another.";
I18N.en.gl_e_parent = "The bigger goal must have a longer horizon.";
I18N.en.gl_e_limit = "Record limit reached. Delete old completed tasks.";
I18N.en.gl_e_save = "Not saved. Check your connection and try again.";
// «Мои цели» — доски, поиск, шаблоны, неделя, фокус на Главной (js/goals.js, файл 72)
I18N.en.gl_v_boards = "Boards";
I18N.en.gl_main_board = "My tasks";
I18N.en.gl_b_search_ph = "Find a board, card or goal";
I18N.en.gl_b_starred = "Starred";
I18N.en.gl_b_recent = "Recently viewed";
I18N.en.gl_b_mine = "My boards";
I18N.en.gl_b_new = "Create board";
I18N.en.gl_b_templates = "Templates";
I18N.en.gl_b_tpl_hint = "A ready board with lists — just add your cards.";
I18N.en.gl_b_count = "{n} open · {d} done";
I18N.en.gl_b_archive = "Archived boards ({n})";
I18N.en.gl_b_restore = "Restore";
I18N.en.gl_b_delete = "Delete forever";
I18N.en.gl_b_delete_sure = "Delete with all its cards?";
I18N.en.gl_b_archive_btn = "Archive";
I18N.en.gl_b_archived = "Board archived. You can restore it at the bottom of Boards.";
I18N.en.gl_b_in_archive = "This board is archived.";
I18N.en.gl_star = "Star board";
I18N.en.gl_unstar = "Unstar board";
I18N.en.gl_back = "← Boards";
I18N.en.gl_board_settings = "Settings";
I18N.en.gl_board = "Board";
I18N.en.gl_board_new = "New board";
I18N.en.gl_b_create = "Create";
I18N.en.gl_b_title = "Board name";
I18N.en.gl_b_title_ph = "For example: Pass HSK 5";
I18N.en.gl_b_need = "Enter a name.";
I18N.en.gl_b_color = "Colour";
I18N.en.gl_b_goal = "Board goal";
I18N.en.gl_b_tpl = "Template";
I18N.en.gl_b_tpl_empty = "Blank: To do · Doing · Done";
I18N.en.gl_tpl_empty_lists = "To do|Doing|Done";
I18N.en.gl_tpl_goal = "Goal plan";
I18N.en.gl_tpl_goal_lists = "Goal and strategy|This month|Next month|Later|Done";
I18N.en.gl_tpl_goal_d = "A goal, monthly steps and what's done";
I18N.en.gl_tpl_kanban = "Kanban";
I18N.en.gl_tpl_kanban_lists = "Ideas|To do|Doing|Done";
I18N.en.gl_tpl_kanban_d = "Classic: from idea to done";
I18N.en.gl_tpl_day = "Daily tasks";
I18N.en.gl_tpl_day_lists = "Morning|Afternoon|Evening|Done";
I18N.en.gl_tpl_day_d = "Your day by time of day";
I18N.en.gl_tpl_study = "Study";
I18N.en.gl_tpl_study_lists = "Topics|Learning now|Review|Passed";
I18N.en.gl_tpl_study_d = "Topics, review and what's passed";
I18N.en.gl_tpl_kaizen = "Kaizen";
I18N.en.gl_tpl_kaizen_lists = "Problem|Improvement idea|Trying|Adopted";
I18N.en.gl_tpl_kaizen_d = "Small improvements every day";
I18N.en.gl_tpl_year = "Year by quarter";
I18N.en.gl_tpl_year_lists = "Q1|Q2|Q3|Q4|Done";
I18N.en.gl_tpl_year_d = "A big plan for the year";
I18N.en.gl_list = "List";
I18N.en.gl_list_title = "List name";
I18N.en.gl_list_left = "← Move left";
I18N.en.gl_list_right = "Move right →";
I18N.en.gl_list_delete = "Delete list";
I18N.en.gl_list_nonempty = "A list with cards can't be deleted — move or delete the cards first.";
I18N.en.gl_add_card_ph = "Enter a title for this card…";
I18N.en.gl_add_card_btn = "Add card";
I18N.en.gl_add_list_ph = "+ Add a list";
I18N.en.gl_cboard_hint = "Drag cards between lists. The circle marks a card done. Tap a list name to rename or move it.";
I18N.en.gl_board_for_goal = "+ Board for this goal";
I18N.en.gl_f_board = "Board";
I18N.en.gl_f_list = "List";
I18N.en.gl_f_done = "Done";
I18N.en.gl_no_lists = "This board has no lists — add a list first.";
I18N.en.gl_sr_none = "Nothing found. Try another word.";
I18N.en.gl_sr_boards = "Boards";
I18N.en.gl_sr_cards = "Cards";
I18N.en.gl_sr_goals = "Goals";
I18N.en.gl_undo = "Undo";
I18N.en.gl_restored = "Restored";
I18N.en.gl_del_item = "Deleted: “{name}”";
I18N.en.gl_week = "Last 7 days";
I18N.en.gl_week_meta = "{m} min focused · {d} done · {g} goals reached";
I18N.en.gl_week_bar = "{d}: {n} min focused";
I18N.en.gl_home_title = "Today's focus";
I18N.en.gl_home_empty = "Your three main tasks for today aren't chosen yet.";
I18N.en.gl_home_open = "Open My goals";
I18N.en.gl_home_pick = "Choose three main tasks";

// Главная страница для гостя (js/home.js)
I18N.en.lp_nav_tools = "Tools";
I18N.en.lp_nav_services = "Services";
I18N.en.lp_nav_how = "Get started";
I18N.en.lp_nav_clients = "For clients";
I18N.en.lp_login = "Log in";
I18N.en.lp_start = "Start free";
I18N.en.lp_about = "What is ULA Factory?";
I18N.en.lp_have_acc = "I have an account";
I18N.en.lp_eyebrow = "A platform for buyers sourcing from China";
I18N.en.lp_h1_a = "Orders from China\u00a0—";
I18N.en.lp_h1_b = "under control from factory to client";
I18N.en.lp_lead = "ULA Factory is a workspace for buyers. Orders, payments, delivery and clients in one place\u00a0— and your clients see where their goods are on their own.";
I18N.en.lp_cta_start = "Create a free workspace";
I18N.en.lp_cta_track = "Track an order";
I18N.en.lp_trust1 = "Sign up in 1 minute";
I18N.en.lp_trust2 = "Phone and computer";
I18N.en.lp_trust3 = "Only you see your data";
I18N.en.lp_demo_label = "Sample order";
I18N.en.lp_demo_item = "Sneakers, 40 pairs";
I18N.en.lp_demo_status = "In transit";
I18N.en.lp_demo_s1 = "Purchased";
I18N.en.lp_demo_s2 = "China warehouse";
I18N.en.lp_demo_s3 = "Border";
I18N.en.lp_demo_s4 = "Bishkek";
I18N.en.lp_demo_eta = "Expected delivery";
I18N.en.lp_demo_eta_v = "in 5–7 days";
I18N.en.lp_demo_left = "Left to pay";
I18N.en.lp_demo_left_v = "12,400 KGS";
I18N.en.lp_demo_profit = "Profit this month";
I18N.en.lp_demo_profit_v = "+18%";
I18N.en.lp_buyer_t = "I'm a buyer\u00a0— I source from China";
I18N.en.lp_buyer_d = "Keep orders, clients and money in one workspace\u00a0— no spreadsheets, no dozens of chats. Only you and your team see it.";
I18N.en.lp_buyer_btn = "Create a workspace";
I18N.en.lp_client_t = "I'm a client\u00a0— waiting for an order";
I18N.en.lp_client_d = "Did your buyer send you a link? Paste it here to see the order status, payment and the parcel's route.";
I18N.en.lp_track_ph = "Paste the link from your buyer";
I18N.en.lp_track_btn = "Open";
I18N.en.lp_track_err = "This doesn't look like an order link. Ask your buyer to send it again.";
I18N.en.lp_tools_kicker = "After you sign up";
I18N.en.lp_tools_title = "Everything to work with clients and orders";
I18N.en.lp_p1_t = "Client accounts";
I18N.en.lp_p1_d = "Each client gets their own page: all orders, debt and payments. Send one link\u00a0— and no more “any news?” messages.";
I18N.en.lp_p1_b1 = "Client card with order history";
I18N.en.lp_p1_b2 = "One link for all of a client's orders";
I18N.en.lp_p1_b3 = "Client requests via a link";
I18N.en.lp_p2_t = "Order tracking";
I18N.en.lp_p2_d = "10 stages: from purchase at the factory to pickup in Bishkek. The client sees the stage, timing and tracking number.";
I18N.en.lp_p2_b1 = "Stage timeline and route map";
I18N.en.lp_p2_b2 = "Status updates to clients in Telegram";
I18N.en.lp_p2_b3 = "Payment and delivery deadlines";
I18N.en.lp_p3_t = "Business management";
I18N.en.lp_p3_d = "Profit, debts and expenses are calculated automatically. See who owes you, what sells best and how much you earned.";
I18N.en.lp_p3_b1 = "Analytics and profit report";
I18N.en.lp_p3_b2 = "Debts and one-click reminders";
I18N.en.lp_p3_b3 = "Team: roles, tasks, permissions";
I18N.en.lp_s_kicker = "Platform services";
I18N.en.lp_s_title = "Everything a buyer needs\u00a0— in one place";
I18N.en.lp_s_sub = "Turn on only what your business needs.";
I18N.en.lp_s1_t = "Price calculator";
I18N.en.lp_s1_d = "Client price from item cost, weight and cargo rate\u00a0— with your markup.";
I18N.en.lp_s2_t = "Batches and cargo";
I18N.en.lp_s2_d = "Several orders in one cargo shipment: delivery is split by weight automatically.";
I18N.en.lp_s3_t = "Your own storefront";
I18N.en.lp_s3_d = "A page with your products: clients fill a cart and place an order.";
I18N.en.lp_s4_t = "KGS → CNY exchange";
I18N.en.lp_s4_d = "Exchange to pay suppliers in China right from your workspace.";
I18N.en.lp_s5_t = "Factory map";
I18N.en.lp_s5_d = "Your factories and suppliers on a map of China\u00a0— visible only to you.";
I18N.en.lp_s6_t = "WhatsApp messages";
I18N.en.lp_s6_d = "Tell clients about a status or a debt with ready-made text.";
I18N.en.lp_s7_t = "Excel and import";
I18N.en.lp_s7_d = "Import orders from Excel or a notebook photo, export reports to .xlsx.";
I18N.en.lp_s8_t = "Team";
I18N.en.lp_s8_d = "Managers work in your workspace with their own permissions and tasks.";
I18N.en.lp_how_kicker = "Get started";
I18N.en.lp_how_title = "Three steps\u00a0— and your orders are under control";
I18N.en.lp_how1_t = "Sign up";
I18N.en.lp_how1_d = "With email or Google. Your workspace is ready in a minute.";
I18N.en.lp_how2_t = "Add orders and clients";
I18N.en.lp_how2_d = "Manually, from Excel or a notebook photo\u00a0— whatever suits you.";
I18N.en.lp_how3_t = "Send the client a link";
I18N.en.lp_how3_d = "The client sees status and payment; you see profit and debts.";
I18N.en.lp_final_t = "Start managing your China orders with peace of mind\u00a0— today";
I18N.en.lp_final_d = "Sign-up is free. Interface in Russian, English and Chinese.";
// Главная: «Так выглядит кабинет» и вопросы-ответы
I18N.en.lp_nav_show = "Workspace";
I18N.en.lp_nav_faq = "FAQ";
I18N.en.lp_show_kicker = "Take a look before signing up";
I18N.en.lp_show_title = "This is what your workspace looks like";
I18N.en.lp_show_sub = "Real screens of the app. Names and amounts are just an example.";
I18N.en.lp_show_t1 = "Orders";
I18N.en.lp_show_t2 = "Analytics";
I18N.en.lp_show_t3 = "What the client sees";
I18N.en.lp_show_c1 = "All orders by stage: new, purchasing, in the warehouse, in transit. You instantly see who owes what and what to do next.";
I18N.en.lp_show_c2 = "Profit, revenue and debts for any period — no Excel or calculator. See your best month and top clients.";
I18N.en.lp_show_c3 = "Your client opens your link and sees the stage, the route and how much is left to pay. No sign-up, no apps.";
I18N.en.lp_show_b1 = "10 order stages";
I18N.en.lp_show_b2 = "Route map to Bishkek";
I18N.en.lp_show_b3 = "Status updates in Telegram";
I18N.en.lp_faq_kicker = "FAQ";
I18N.en.lp_faq_title = "Frequently asked questions";
I18N.en.lp_faq_sub = "Didn't find an answer? Write to us — a real person will reply.";
I18N.en.lp_c_mail = "Send an email";
I18N.en.lp_q1 = "How much does it cost?";
I18N.en.lp_a1 = "Sign-up is free and no bank card is needed. Create a workspace, add a couple of orders and see if it suits you.";
I18N.en.lp_q2 = "Who can see my orders and clients?";
I18N.en.lp_a2 = "Only you and the team members you invite. Other buyers can't see your workspace. The connection to the site is encrypted.";
I18N.en.lp_q3 = "Does the site work in China?";
I18N.en.lp_a3 = "Yes, it's built to work from China: it doesn't depend on Google services, which are blocked there. Google sign-in won't work in China — use email and password.";
I18N.en.lp_q4 = "Do I need to install anything?";
I18N.en.lp_a4 = "No. The workspace opens in a browser on your phone and computer. On a phone you can add it to the home screen and open it like an app.";
I18N.en.lp_q5 = "What does my client see?";
I18N.en.lp_a5 = "Only their own order via the link: stage, route, timing and how much is left to pay. The client never sees your purchase price or profit, and doesn't need to sign up.";
I18N.en.lp_q6 = "How do I move orders from spreadsheets and notebooks?";
I18N.en.lp_a6 = "Upload an Excel or CSV file: columns are matched automatically and you review everything before import. Notebook records can be uploaded as a photo.";
I18N.en.lp_q7 = "Can I work together with managers?";
I18N.en.lp_a7 = "Yes. Invite team members, give them roles and permissions, assign tasks. You decide what they can do — delete, see profit, change settings.";
I18N.en.lp_q8 = "Which languages does it support?";
I18N.en.lp_a8 = "Russian, English, Chinese and Vietnamese. Switch the language in one click — handy if colleagues in China work with you.";

// главная: курс юаня ULA для всех (js/home.js, файл 75)
I18N.en.lp_rate_h = "Yuan rate today";
I18N.en.lp_rate_today = "ULA rate · updated today at {t}";
I18N.en.lp_rate_on = "ULA rate · updated {d}";
I18N.en.lp_rate_down = "{n} som cheaper · was {was}";
I18N.en.lp_rate_up = "{n} som dearer · was {was}";
I18N.en.lp_rate_flat = "No change in the last {n} days";
I18N.en.lp_rate_chart_a = "Rate chart: from {lo} to {hi} som per 1 ¥";
I18N.en.lp_rate_chip_a = "Yuan rate today: {n} som per 1 ¥";
I18N.en.lp_rate_calc = "How many yuan do you need?";
I18N.en.lp_rate_pay = "You pay";
I18N.en.lp_rate_hint = "Enter an amount in yuan — we’ll show it in som";
I18N.en.lp_rate_at = "at {r}";
I18N.en.lp_rate_cta = "Exchange yuan";
I18N.en.lp_rate_note = "Exchange is available after free sign-up. The ULA rate is updated every day.";
I18N.en.lp_rate_note_fx = "No sign-up needed: amount → payment details → payment screenshot. Track your request on the site.";
