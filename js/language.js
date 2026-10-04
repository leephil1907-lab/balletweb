/* Ballet — in-page language selector.
 * This preserves the current URL and applies translations without sending the
 * visitor to ballet.com. The legacy English-only markup is replaced at runtime.
 */
(function () {
  'use strict';

  var LANGS = [
    ['en', 'English'],
    ['es', 'Español'],
    ['fr', 'Français'],
    ['de', 'Deutsch'],
    ['pt', 'Português'],
    ['it', 'Italiano'],
    ['ja', '日本語'],
    ['ko', '한국어'],
    ['zh-CN', '简体中文'],
    ['ar', 'العربية']
  ];
  var LANGUAGE_KEY = 'ballet-language';
  var SCRIPT_ID = 'ballet-google-translate-script';
  var activeLanguage = 'en';

  function readSavedLanguage() {
    try {
      var saved = window.localStorage.getItem(LANGUAGE_KEY);
      if (LANGS.some(function (item) { return item[0] === saved; })) return saved;
    } catch (_) {}

    var match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([^;]+)/);
    if (match && LANGS.some(function (item) { return item[0] === match[1]; })) {
      return match[1];
    }
    return 'en';
  }

  function saveLanguage(language) {
    try { window.localStorage.setItem(LANGUAGE_KEY, language); } catch (_) {}
    if (language === 'en') {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
    } else {
      document.cookie = 'googtrans=/en/' + language + '; path=/; SameSite=Lax';
    }
  }

  function installStyles() {
    if (document.getElementById('ballet-language-style')) return;
    var style = document.createElement('style');
    style.id = 'ballet-language-style';
    style.textContent = [
      '.footer_languagebar_select .ballet-language-select{appearance:none;-webkit-appearance:none;box-sizing:border-box;min-width:116px;max-width:160px;padding:8px 30px 8px 11px;border:1px solid rgba(255,255,255,.28);border-radius:7px;background-color:transparent;background-image:linear-gradient(45deg,transparent 50%,#fff 50%),linear-gradient(135deg,#fff 50%,transparent 50%);background-position:calc(100% - 14px) 50%,calc(100% - 9px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;color:#fff;font:inherit;cursor:pointer}',
      '.footer_languagebar_select .ballet-language-select:focus{outline:2px solid #eebf29;outline-offset:2px}',
      '.footer_languagebar_select .ballet-language-select option{background:#161617;color:#fff}',
      '.goog-te-banner-frame.skiptranslate{display:none!important}',
      'body{top:0!important}',
      '.goog-te-balloon-frame{display:none!important}',
      '.goog-text-highlight{background:transparent!important;box-shadow:none!important}',
      '@media(max-width:768px){.footer_languagebar_select .ballet-language-select{min-width:110px;max-width:145px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyTranslation(language, attempt) {
    activeLanguage = language;
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    if (language === 'en') return;
    var combo = document.querySelector('.goog-te-combo');
    if (combo) {
      if (combo.value !== language) {
        combo.value = language;
        combo.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    if ((attempt || 0) < 20) {
      window.setTimeout(function () { applyTranslation(language, (attempt || 0) + 1); }, 250);
    } else {
      var select = document.getElementById('ballet-language-select');
      if (select) select.value = 'en';
      saveLanguage('en');
      document.documentElement.setAttribute('lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }

  function failTranslation() {
    window.__balletTranslateCallbacks = [];
    var select = document.getElementById('ballet-language-select');
    if (select) select.value = 'en';
    saveLanguage('en');
    applyTranslation('en');
  }

  function loadTranslator(callback) {
    window.__balletTranslateCallbacks = window.__balletTranslateCallbacks || [];
    if (typeof callback === 'function') window.__balletTranslateCallbacks.push(callback);

    if (window.google && window.google.translate && window.google.translate.TranslateElement) {
      if (!window.__balletTranslateReady) {
        createTranslator();
      } else {
        flushCallbacks();
      }
      return;
    }
    if (document.getElementById(SCRIPT_ID)) return;

    var target = document.createElement('div');
    target.id = 'google_translate_element';
    target.hidden = true;
    document.body.appendChild(target);

    window.googleTranslateElementInit = function () {
      createTranslator();
    };

    var script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.onerror = failTranslation;
    window.setTimeout(function () {
      if (!window.__balletTranslateReady) failTranslation();
    }, 15000);
    document.head.appendChild(script);
  }

  function createTranslator() {
    if (!window.google || !window.google.translate || !window.google.translate.TranslateElement) return;
    var target = document.getElementById('google_translate_element');
    if (!target) {
      target = document.createElement('div');
      target.id = 'google_translate_element';
      target.hidden = true;
      document.body.appendChild(target);
    }
    if (!window.__balletTranslateReady) {
      try {
        new window.google.translate.TranslateElement({
          pageLanguage: 'en',
          includedLanguages: LANGS.map(function (item) { return item[0]; }).join(','),
          autoDisplay: false
        }, 'google_translate_element');
        window.__balletTranslateReady = true;
      } catch (_) {
        failTranslation();
        return;
      }
    }
    flushCallbacks();
  }

  function flushCallbacks() {
    var callbacks = window.__balletTranslateCallbacks || [];
    window.__balletTranslateCallbacks = [];
    callbacks.forEach(function (callback) { callback(); });
  }

  function mount() {
    var host = document.querySelector('.footer_languagebar_select');
    if (!host) return;
    installStyles();

    var select = document.createElement('select');
    select.id = 'ballet-language-select';
    select.className = 'ballet-language-select';
    select.setAttribute('aria-label', 'Language');
    select.title = 'Language';
    LANGS.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item[0];
      option.textContent = item[1];
      select.appendChild(option);
    });

    var oldSelect = host.querySelector('.ant-select');
    if (oldSelect) oldSelect.replaceWith(select);
    else host.appendChild(select);

    var saved = readSavedLanguage();
    select.value = saved;
    activeLanguage = saved;

    select.addEventListener('change', function () {
      var language = select.value;
      saveLanguage(language);
      if (language === 'en') {
        applyTranslation('en');
        window.location.reload();
        return;
      }
      loadTranslator(function () { applyTranslation(language); });
    });

    if (saved !== 'en') {
      loadTranslator(function () { applyTranslation(saved); });
    } else {
      document.documentElement.setAttribute('lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
