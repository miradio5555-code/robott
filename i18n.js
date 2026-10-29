// =====================================================
// ULA FACTORY — переводы: русский / English / 中文 / Tiếng Việt
//
// Сами фразы — в отдельных словарях: i18n.ru.js, i18n.en.js, i18n.zh.js, i18n.vi.js.
// Телефон скачивает только выбранный язык (так сайт открывается быстрее),
// другой язык подгружается в момент переключения.
// Новые фразы добавлять во все четыре словаря.
// =====================================================

var I18N = {};
// vi (Tiếng Việt) выбирается только в «Настройки → Язык»
var LANGS = ["ru", "en", "zh", "vi"];

var currentLang = (function () {
  try {
    var saved = localStorage.getItem("cc_lang");
    if (LANGS.indexOf(saved) !== -1) return saved;
  } catch (e) { /* ignore */ }
  return "ru";
})();

function getLang() {
  return currentLang;
}

// t("key") — вернуть перевод. t("key", {n: 5}) — подставить {n}.
// Если перевода нет — берётся русский вариант.
function t(key, vars) {
  var dict = I18N[currentLang] || I18N.ru || {};
  var text = dict[key];
  // чего нет в выбранном языке — по-английски или по-русски, если этот словарь уже скачан
  if (text === undefined && I18N.en) text = I18N.en[key];
  if (text === undefined && I18N.ru) text = I18N.ru[key];
  if (text === undefined) return key;
  if (vars) {
    Object.keys(vars).forEach(function (k) {
      text = text.split("{" + k + "}").join(vars[k]);
    });
  }
  return text;
}

// Словарь выбранного языка — сразу при открытии страницы, до app.js (версия ?v= та же, что у i18n.js)
var I18N_VER = (function () {
  var m = /[?&]v=([0-9A-Za-z]+)/.exec((document.currentScript && document.currentScript.src) || "");
  return m ? m[1] : "";
})();
function i18nSrc(lang) {
  return "i18n." + lang + ".js" + (I18N_VER ? "?v=" + I18N_VER : "");
}
document.write('<script src="' + i18nSrc(currentLang) + '"><\/script>');

// Другой язык скачивается при переключении; done() — когда он готов.
// Нет интернета — язык остаётся прежним.
function setLang(lang, done) {
  if (LANGS.indexOf(lang) === -1) return;
  function apply() {
    currentLang = lang;
    try { localStorage.setItem("cc_lang", lang); } catch (e) { /* ignore */ }
    applyI18n();
    if (done) done();
  }
  if (I18N[lang]) return apply();
  var s = document.createElement("script");
  s.src = i18nSrc(lang);
  s.onload = function () { if (I18N[lang]) apply(); else applyI18n(); };
  s.onerror = function () { s.remove(); applyI18n(); };
  document.head.appendChild(s);
}

// Переводит все элементы с data-i18n и data-i18n-placeholder
function applyI18n() {
  document.documentElement.lang = { ru: "ru", en: "en", zh: "zh-CN", vi: "vi" }[currentLang];
  document.title = t("app_title");
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-title")));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-lang]").forEach(function (el) {
    el.classList.toggle("active", el.getAttribute("data-lang") === currentLang);
    el.setAttribute("aria-pressed", el.getAttribute("data-lang") === currentLang ? "true" : "false");
  });
}
