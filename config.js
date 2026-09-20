// =====================================================
// CARGO CHINA — настройки
// Единственный файл, который нужно отредактировать.
// =====================================================

window.CARGO_CONFIG = {

  // 1) Адрес проекта Supabase (Project Settings → Data API → Project URL)
  //    Пример: "https://abcdefgh.supabase.co"
  SUPABASE_URL: "ВСТАВЬТЕ_СЮДА_ADDRESS",

  // 2) Публичный ключ (Project Settings → API Keys → Publishable key или anon public)
  //    ВАЖНО: только publishable / anon. Ключ secret / service_role сюда НЕЛЬЗЯ.
  SUPABASE_ANON_KEY: "ВСТАВЬТЕ_СЮДА_КЛЮЧ",

  // 3) Склад в Китае
  WAREHOUSE: {
    address: "浙江省金华市金东区孝顺镇广顺南街与集贤路红绿灯路口左拐P栋一楼B区",
    contacts: [
      { name: "天驰", phone: "18680378056" },
      { name: "天仁", phone: "13249858824" }
    ]
  }
};
