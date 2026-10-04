/* BalletWeb — Smartsupp live support launcher
 * The visitor talks directly to the Ballet support team through Smartsupp.
 * No local/demo chatbot is used here. Messages sent in the Smartsupp widget
 * appear in the Smartsupp dashboard and agent replies return to the visitor.
 */
(function () {
  'use strict';

  var cfg = window.BALLET_CHAT_CONFIG || {};
  var ss = cfg.smartsupp || {};
  var key = ss.key;
  if (!key) return;

  window._smartsupp = window._smartsupp || {};
  window._smartsupp.key = key;
  Object.keys(ss.options || {}).forEach(function (name) {
    window._smartsupp[name] = ss.options[name];
  });
  window._smartsupp.orientation = 'right';
  window._smartsupp.color = '#eebf29';

  function loadSmartsupp() {
    if (window.__balletSmartsuppLoaded) return;
    window.__balletSmartsuppLoaded = true;
    window.smartsupp || (function (d) {
      var s, c, o = window.smartsupp = function () { o._.push(arguments); };
      o._ = [];
      s = d.getElementsByTagName('script')[0];
      c = d.createElement('script');
      c.type = 'text/javascript';
      c.charset = 'utf-8';
      c.async = true;
      c.src = 'https://www.smartsuppchat.com/loader.js?';
      s.parentNode.insertBefore(c, s);
    })(document);
  }

  function identify() {
    if (!window.smartsupp) return;
    var o = ss.options || {};
    if (o.name) window.smartsupp('name', o.name);
    if (o.email) window.smartsupp('email', o.email);
    if (o.phone) window.smartsupp('phone', o.phone);
    if (o.variables) window.smartsupp('variables', o.variables);
  }

  function openChat() {
    loadSmartsupp();
    try {
      window.smartsupp('chat:show');
      window.smartsupp('chat:open');
      identify();
    } catch (e) {
      window.setTimeout(function () {
        try { window.smartsupp('chat:open'); identify(); } catch (_) {}
      }, 500);
    }
  }

  function buildLauncher() {
    if (document.getElementById('ballet-live-support')) return;
    var style = document.createElement('style');
    style.textContent = '#ballet-live-support{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;border:0;border-radius:50%;background:#eebf29;color:#101113;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.28);transition:transform .2s ease,box-shadow .2s ease}#ballet-live-support:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 16px 36px rgba(0,0,0,.34)}#ballet-live-support svg{width:27px;height:27px}@media(max-width:600px){#ballet-live-support{right:16px;bottom:16px;width:56px;height:56px}}';
    document.head.appendChild(style);

    var button = document.createElement('button');
    button.id = 'ballet-live-support';
    button.type = 'button';
    button.setAttribute('aria-label', 'Chat live with Ballet support');
    button.title = 'Chat live with Ballet support';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.7-.8L4 20l1.2-3.4A7.3 7.3 0 0 1 4 11.5 7.7 7.7 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z"/><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"/></svg>';
    button.addEventListener('click', openChat);
    document.body.appendChild(button);
  }

  function boot() {
    loadSmartsupp();
    buildLauncher();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
