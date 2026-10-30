// =====================================================
// ULA FACTORY — настройки
// Единственный файл, который нужно отредактировать.
// =====================================================

window.CARGO_CONFIG = {

  // 1) Адрес проекта Supabase (Project Settings → Data API → Project URL)
  //    Пример: "https://abcdefgh.supabase.co"
  SUPABASE_URL: "https://gjybwrvllxlafkxybstg.supabase.co",

  // 2) Публичный ключ (Project Settings → API Keys → Publishable key или anon public)
  //    ВАЖНО: только publishable / anon. Ключ secret / service_role сюда НЕЛЬЗЯ.
  SUPABASE_ANON_KEY: "sb_publishable_ze8a3eCRCuT4ZNe3ARuSOg_Ui-PHgO4",

  // 3) Капча Cloudflare Turnstile при входе и регистрации (необязательно).
  //    Сюда вписывается только ПУБЛИЧНЫЙ ключ сайта (Site key). Секретный ключ (Secret key) сюда нельзя —
  //    он вставляется в Supabase → Authentication → Attack Protection. Пусто = капчи нет.
  TURNSTILE_SITE_KEY: "",

  // 4) Видео-инструкция для новых байеров (YouTube, Instagram, Telegram и т.п.), необязательно.
  //    Появится в меню как «Видео: как работать». Пусто = пункта нет.
  VIDEO_URL: "",


  // Адрес склада в Китае теперь меняется прямо в кабинете:
  // блок «Склад в Китае» → кнопка «Изменить». Здесь его больше не нужно.
};
