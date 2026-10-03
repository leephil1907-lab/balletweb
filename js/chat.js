/* =========================================================================
   Ballet Support — live chat widget
   -------------------------------------------------------------------------
   The widget reads window.BALLET_CHAT_CONFIG (see chat-config.js). Live
   Smartsupp conversations use Smartsupp's native chat UI so messages and
   replies stay in the support inbox. If Smartsupp is unavailable, this site
   shows a simple contact fallback; it never invents a local bot reply.

   Other configured providers and explicit webhook mode remain available for
   deployments that choose them. No local FAQ bot is bundled. Everything is
   namespaced under window.BalletChat and does not touch other page features.

   Hosted providers supported:  smartsupp · tawk · crisp · intercom · zendesk
                                freshchat · drift · salesiq · chatwoot
                                livechat · tidio · gorgias · custom
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.BALLET_CHAT_CONFIG || {};
  var UI = Object.assign({
    title: 'Ballet Support',
    subtitle: 'Typically replies in a few minutes',
    greeting: 'Hi there 👋 How can we help you today?',
    launcherLabel: 'Chat with support',
    position: 'bottom-right',
    accent: '#eebf29',
    autoOpenAfterMs: 0,
    quickReplies: []
  }, CFG.ui || {});

  var STORE_KEY = 'ballet_chat_session_v1';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- utils */
  function $(s, c) { return (c || document).querySelector(s); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function linkify(s) {
    return esc(s).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>';
    });
  }
  function uid() {
    return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }
  function loadScript(src, attrs, cb) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    Object.keys(attrs || {}).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error('failed to load ' + src)); };
    document.head.appendChild(s);
  }
  function getPath(obj, path) {
    return String(path || '').split('.').reduce(function (acc, k) {
      return acc == null ? acc : acc[k];
    }, obj);
  }

  var session = (function () {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { id: uid(), history: [] };
  })();

  function persist() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(session)); } catch (e) {}
    // keep only the last 60 messages
    if (session.history.length > 60) session.history = session.history.slice(-60);
  }

  function clearStoredChatHistory() {
    session = { id: uid(), history: [] };
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  /* --------------------------------------------------------------- styling */
  var CSS = [
    '.bl-chat{--bl-accent:' + UI.accent + ';position:fixed;bottom:20px;z-index:2147483000;',
    UI.position === 'bottom-left' ? 'left:20px' : 'right:20px',
    ';font-family:Inter,"Noto Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.bl-chat *{box-sizing:border-box;margin:0;padding:0}',
    '.bl-chat-launcher{width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;',
    'background:var(--bl-accent);color:#0d1526;display:flex;align-items:center;justify-content:center;',
    'box-shadow:0 10px 28px rgba(0,0,0,.35);transition:transform .28s cubic-bezier(.23,1,.32,1),box-shadow .28s;',
    'position:relative;}',
    '.bl-chat-launcher:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 16px 34px rgba(0,0,0,.42)}',
    '.bl-chat-launcher svg{width:26px;height:26px;transition:opacity .2s,transform .28s}',
    '.bl-chat-launcher .bl-ico-close{display:none}',
    '.bl-chat.open .bl-chat-launcher .bl-ico-chat{display:none}',
    '.bl-chat.open .bl-chat-launcher .bl-ico-close{display:block}',
    '.bl-chat-badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;border-radius:10px;',
    'background:#e5484d;color:#fff;font-size:11px;font-weight:700;line-height:20px;text-align:center;',
    'padding:0 5px;box-shadow:0 0 0 2px #161617;display:none}',
    '.bl-chat-badge.show{display:block}',
    '.bl-chat-panel{position:absolute;bottom:78px;',
    UI.position === 'bottom-left' ? 'left:0' : 'right:0',
    ';width:min(376px,calc(100vw - 32px));height:min(600px,calc(100vh - 120px));',
    'background:#161617;border:1px solid rgba(255,255,255,.1);border-radius:18px;overflow:hidden;',
    'box-shadow:0 24px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;',
    'opacity:0;visibility:hidden;transform:translateY(14px) scale(.97);transform-origin:bottom ',
    UI.position === 'bottom-left' ? 'left' : 'right',
    ';transition:opacity .26s ease,transform .3s cubic-bezier(.23,1,.32,1),visibility .26s;}',
    '.bl-chat.open .bl-chat-panel{opacity:1;visibility:visible;transform:translateY(0) scale(1)}',
    '.bl-chat-head{background:linear-gradient(135deg,#1f469a,#111f3e);padding:16px 18px;display:flex;',
    'align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);position:relative;flex:0 0 auto}',
    '.bl-chat-avatar{width:40px;height:40px;border-radius:50%;background:var(--bl-accent);color:#0d1526;',
    'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex:0 0 auto;',
    'font-family:Montserrat,sans-serif;letter-spacing:.5px}',
    '.bl-chat-head-meta{min-width:0;flex:1 1}',
    '.bl-chat-title{color:#fff;font-size:15px;font-weight:700;line-height:1.25;font-family:Montserrat,sans-serif}',
    '.bl-chat-status{color:rgba(255,255,255,.62);font-size:12px;line-height:1.4;margin-top:2px;',
    'display:flex;align-items:center;gap:6px}',
    '.bl-chat-dot{width:7px;height:7px;border-radius:50%;background:#3ddc84;flex:0 0 auto;',
    'box-shadow:0 0 0 0 rgba(61,220,132,.6);animation:bl-pulse 2s infinite}',
    '@keyframes bl-pulse{0%{box-shadow:0 0 0 0 rgba(61,220,132,.55)}70%{box-shadow:0 0 0 9px rgba(61,220,132,0)}100%{box-shadow:0 0 0 0 rgba(61,220,132,0)}}',
    '.bl-chat-close{background:none;border:0;color:rgba(255,255,255,.7);cursor:pointer;padding:6px;',
    'display:flex;border-radius:8px;flex:0 0 auto}',
    '.bl-chat-close:hover{background:rgba(255,255,255,.1);color:#fff}',
    '.bl-chat-body{flex:1 1 auto;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;',
    'background:#1b1b1c;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.25) transparent}',
    '.bl-chat-body::-webkit-scrollbar{width:6px}',
    '.bl-chat-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:3px}',
    '.bl-msg{max-width:84%;padding:11px 14px;font-size:14px;line-height:1.55;border-radius:16px;',
    'word-wrap:break-word;animation:bl-msg-in .32s cubic-bezier(.23,1,.32,1) both}',
    '@keyframes bl-msg-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '.bl-msg-bot{align-self:flex-start;background:#2a2a2c;color:#e8e8e8;border-bottom-left-radius:5px}',
    '.bl-msg-user{align-self:flex-end;background:var(--bl-accent);color:#0d1526;',
    'border-bottom-right-radius:5px;font-weight:500}',
    '.bl-msg a{color:var(--bl-accent);text-decoration:underline}',
    '.bl-msg-user a{color:#0d1526}',
    '.bl-msg-time{display:block;font-size:10px;opacity:.55;margin-top:5px}',
    '.bl-typing{align-self:flex-start;background:#2a2a2c;border-radius:16px;padding:13px 15px;',
    'display:flex;gap:5px;align-items:center}',
    '.bl-typing i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.6);',
    'animation:bl-bounce 1.3s infinite both;display:block}',
    '.bl-typing i:nth-child(2){animation-delay:.16s}.bl-typing i:nth-child(3){animation-delay:.32s}',
    '@keyframes bl-bounce{0%,80%,100%{transform:translateY(0);opacity:.45}40%{transform:translateY(-6px);opacity:1}}',
    '.bl-quick{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 12px;background:#1b1b1c;flex:0 0 auto}',
    '.bl-quick button{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);',
    'color:#e8e8e8;border-radius:100px;padding:8px 13px;font-size:12.5px;cursor:pointer;',
    'font-family:inherit;transition:all .2s}',
    '.bl-quick button:hover{background:var(--bl-accent);color:#0d1526;border-color:var(--bl-accent);',
    'transform:translateY(-1px)}',
    '.bl-form{border-top:1px solid rgba(255,255,255,.1);background:#161617;padding:12px;',
    'display:flex;gap:9px;align-items:flex-end;flex:0 0 auto}',
    '.bl-input{flex:1 1;background:#242425;border:1px solid rgba(255,255,255,.12);border-radius:22px;',
    'color:#fff;padding:11px 15px;font-size:14px;font-family:inherit;resize:none;outline:none;',
    'max-height:110px;line-height:1.45;transition:border-color .2s}',
    '.bl-input:focus{border-color:var(--bl-accent)}',
    '.bl-input::placeholder{color:rgba(255,255,255,.4)}',
    '.bl-send{width:42px;height:42px;border-radius:50%;border:0;background:var(--bl-accent);',
    'color:#0d1526;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:0 0 auto;',
    'transition:transform .2s,opacity .2s}',
    '.bl-send:hover{transform:scale(1.07)}.bl-send:disabled{opacity:.4;cursor:not-allowed}',
    '.bl-foot{text-align:center;font-size:10.5px;color:rgba(255,255,255,.35);padding:0 12px 9px;background:#161617}',
    '.bl-foot a{color:rgba(255,255,255,.5)}',
    '.bl-chat-live .bl-chat-panel{height:auto;min-height:190px;max-height:calc(100vh - 120px)}',
    '.bl-chat-live .bl-chat-body{min-height:82px;align-items:center;justify-content:center;text-align:center}',
    '.bl-chat-offline{max-width:270px;color:#e8e8e8;font-size:14px;line-height:1.55;text-align:center}',
    '.bl-chat-offline a{display:inline-block;margin-top:10px;color:var(--bl-accent);font-weight:650;text-decoration:underline}',
    '@media (max-width:480px){.bl-chat-panel{width:calc(100vw - 32px);height:min(70vh,520px)}',
    '.bl-chat{bottom:16px}}'
  ].join('');

  /* ------------------------------------------------- provider integration */
  var PROVIDERS = {
    tawk: {
      has: function () { return !!(CFG.tawk && CFG.tawk.propertyId && CFG.tawk.widgetId); },
      load: function () {
        var t = CFG.tawk;
        window.Tawk_API = window.Tawk_API || {};
        window.Tawk_LoadStart = new Date();
        loadScript('https://embed.tawk.to/' + t.propertyId + '/' + t.widgetId, {}, function () {});
        return true;
      }
    },
    crisp: {
      has: function () { return !!(CFG.crisp && CFG.crisp.id); },
      load: function () {
        window.$crisp = []; window.CRISP_WEBSITE_ID = CFG.crisp.id;
        loadScript('https://client.crisp.chat/l.js', {}, function () {});
        return true;
      }
    },
    intercom: {
      has: function () { return !!(CFG.intercom && CFG.intercom.appId); },
      load: function () {
        window.intercomSettings = { app_id: CFG.intercom.appId };
        loadScript('https://widget.intercom.io/widget/' + CFG.intercom.appId, {}, function () {});
        return true;
      }
    },
    zendesk: {
      has: function () { return !!(CFG.zendesk && CFG.zendesk.key); },
      load: function () {
        window.zESettings = { webWidget: { color: { theme: UI.accent } } };
        loadScript('https://static.zdassets.com/ekr/snippet.js?key=' + CFG.zendesk.key, { id: 'ze-snippet' }, function () {});
        return true;
      }
    },
    freshchat: {
      has: function () { return !!(CFG.freshchat && CFG.freshchat.token); },
      load: function () {
        var f = CFG.freshchat;
        window.fcSettings = { token: f.token, host: f.host || 'https://wchat.freshchat.com' };
        loadScript('https://snippets.freshchat.com/js/fcwidget.js', {}, function () {});
        return true;
      }
    },
    drift: {
      has: function () { return !!(CFG.drift && CFG.drift.id); },
      load: function () {
        window.driftt = window.driftt || [];
        loadScript('https://js.driftt.com/include/' + Date.now() + '/' + CFG.drift.id + '.js', {}, function () {});
        return true;
      }
    },
    salesiq: {
      has: function () { return !!(CFG.salesiq && CFG.salesiq.code); },
      load: function () {
        window.$zoho = window.$zoho || {}; window.$zoho.salesiq = window.$zoho.salesiq || { ready: function () {} };
        loadScript('https://salesiq.zoho.com/widget?widgetcode=' + CFG.salesiq.code, {}, function () {});
        return true;
      }
    },
    chatwoot: {
      has: function () { return !!(CFG.chatwoot && CFG.chatwoot.websiteToken); },
      load: function () {
        var c = CFG.chatwoot;
        window.chatwootSettings = { position: UI.position === 'bottom-left' ? 'left' : 'right' };
        (function (d, t) {
          var BASE_URL = c.baseUrl || 'https://app.chatwoot.com';
          var g = d.createElement(t), s = d.getElementsByTagName(t)[0];
          g.src = BASE_URL + '/packs/js/sdk.js'; g.async = true; g.defer = true;
          g.onload = function () { window.chatwootSDK.run({ websiteToken: c.websiteToken, baseUrl: BASE_URL }); };
          s.parentNode.insertBefore(g, s);
        })(document, 'script');
        return true;
      }
    },
    livechat: {
      has: function () { return !!(CFG.livechat && CFG.livechat.licenseId); },
      load: function () {
        window.__lc = window.__lc || {}; window.__lc.license = CFG.livechat.licenseId;
        loadScript('https://cdn.livechatinc.com/tracking.js', {}, function () {});
        return true;
      }
    },
    tidio: {
      has: function () { return !!(CFG.tidio && CFG.tidio.publicKey); },
      load: function () {
        loadScript('//code.tidio.co/' + CFG.tidio.publicKey + '.js', {}, function () {});
        return true;
      }
    },
    gorgias: {
      has: function () { return !!(CFG.gorgias && CFG.gorgias.chatUrl); },
      load: function () {
        loadScript(CFG.gorgias.chatUrl, {}, function () {});
        return true;
      }
    },
    custom: {
      has: function () { return !!(CFG.custom && CFG.custom.src); },
      load: function () {
        loadScript(CFG.custom.src, CFG.custom.attrs || {}, function () {});
        return CFG.custom.hideOwnLauncher !== false;
      }
    },

    /* ------------------------------------------------------------ Smartsupp */
    smartsupp: {
      has: function () { return !!(CFG.smartsupp && CFG.smartsupp.key); },
      load: function () {
        var key = CFG.smartsupp.key;
        var opts = CFG.smartsupp.options || {};
        var timeout = CFG.smartsupp.timeoutMs;

        // Smartsupp reads `window._smartsupp` before its loader runs.
        window._smartsupp = window._smartsupp || {};
        window._smartsupp.key = key;
        Object.keys(opts).forEach(function (k) { window._smartsupp[k] = opts[k]; });

        // Official Smartsupp loader snippet.
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

        // init() calls this after the small site-side launcher is mounted.
        // The actual transcript and composer belong to Smartsupp, never to a
        // local canned-response widget.
        delegator = function () {
          var api = window.BalletChat || {};
          if (api.delegated) return;
          var ownOpen = api.open, ownClose = api.close, ownToggle = api.toggle, ownSend = api.send;
          var ssOpen = false;

          api.mode = 'smartsupp';
          api.provider = 'smartsupp';
          api.delegated = true;
          api.open = function () {
            if (smartsuppReady()) {
              try { window.smartsupp('chat:open'); ssOpen = true; return; } catch (e) {}
            }
            if (ownOpen) ownOpen();
          };
          api.close = function () {
            if (smartsuppReady()) {
              try { window.smartsupp('chat:close'); ssOpen = false; return; } catch (e) {}
            }
            if (ownClose) ownClose();
          };
          api.toggle = function () {
            if (smartsuppReady()) { ssOpen ? api.close() : api.open(); return; }
            if (ownToggle) ownToggle();
          };
          // Send through Smartsupp's documented chat:send method so the
          // visitor message enters the support inbox (never a local transcript).
          api.send = function (text) {
            var message = String(text || '').trim();
            if (!message) return;
            if (smartsuppReady()) {
              try {
                api.open();
                window.smartsupp('chat:send', message);
                return;
              } catch (e) {}
            }
            if (ownSend) ownSend(message);
          };
          window.BalletChat = api;

          undelegate = function () {
            api.mode = 'smartsupp:fallback';
            api.delegated = false;
            api.open = ownOpen;
            api.close = ownClose;
            api.toggle = ownToggle;
            api.send = ownSend;
          };
        };

        // Keep the site-side launcher available until the native widget exists.
        // After a timeout, retain the contact fallback and continue checking so
        // a slow-but-valid provider can still take over without a reload.
        var t = timeout === 0 ? Infinity : (Number(timeout) || 8000);
        var started = Date.now();
        var fallbackShown = false;
        function poll() {
          var el = document.querySelector('.bl-chat');
          if (smartsuppReady()) {
            if (delegator && !(window.BalletChat && window.BalletChat.delegated)) delegator();
            if (el) {
              var wasOpen = el.classList.contains('open');
              el.style.display = 'none';
              if (wasOpen && window.BalletChat && window.BalletChat.open) window.BalletChat.open();
            }
            return;
          }
          if (!fallbackShown && Date.now() - started >= t) {
            fallbackShown = true;
            if (el) el.style.display = '';
            if (undelegate) undelegate();
          }
          setTimeout(poll, fallbackShown ? 1200 : 250);
        }
        // Let init() finish building the launcher/API before the first check.
        setTimeout(poll, 0);
        return true; // keep our launcher visible until Smartsupp is confirmed ready
      }
    }
  };

  /* Set by a hosted provider that owns the chat UI; applied after build(). */
  var delegator = null;
  var undelegate = null;

  /* True once Smartsupp has injected its widget into the page. Checks every
     container shape Smartsupp has shipped, so a version bump cannot silently
     trigger the fallback. */
  function smartsuppReady() {
    try {
      if (!window.smartsupp) return false;
      var SEL = [
        '#smartsupp-widget-container',
        '#smartsupp-widget',
        '.smartsupp-widget',
        '#chat-application-iframe',
        '#widgetButtonFrame',
        'iframe[src*="smartsupp"]',
        '[class*="smartsupp"]'
      ];
      for (var i = 0; i < SEL.length; i++) {
        if (document.querySelector(SEL[i])) return true;
      }
      // Any top-level container Smartsupp appended.
      var kids = document.body ? document.body.children : [];
      for (var j = 0; j < kids.length; j++) {
        var id = kids[j].id || '';
        if (id.indexOf('smartsupp') === 0 || id.indexOf('chat-application') === 0) return true;
      }
    } catch (e) {}
    return false;
  }

  function resolveProvider() {
    var explicit = (CFG.provider || 'auto').toLowerCase();
    if (explicit !== 'auto') return explicit === 'demo' ? 'smartsupp' : explicit;
    for (var k in PROVIDERS) if (PROVIDERS[k].has()) return k;
    if (CFG.webhook && CFG.webhook.url) return 'webhook';
    if (CFG.whatsapp && CFG.whatsapp.phone) return 'whatsapp';
    if (CFG.telegram && CFG.telegram.username) return 'telegram';
    return 'smartsupp';
  }

  /* -------------------------------------------------------------- webhook */
  function webhookReply(text) {
    var w = CFG.webhook;
    var body = w.bodyTemplate
      ? JSON.parse(JSON.stringify(w.bodyTemplate).replace(/\{\{message\}\}/g, JSON.stringify(text).slice(1, -1))
          .replace(/\{\{sessionId\}\}/g, session.id))
      : { message: text, sessionId: session.id };

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, w.timeoutMs || 15000);

    return fetch(w.url, {
      method: w.method || 'POST',
      headers: w.headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        var reply = getPath(data, w.replyPath || 'reply') || getPath(data, 'message') || getPath(data, 'answer');
        return reply || 'Support did not return a reply. Please contact support@ballet.com.';
      })
      .catch(function () {
        clearTimeout(timer);
        return 'Sorry — I could not reach the support service just now. Please try again in a moment, or email ' +
               'support@ballet.com and we will get straight back to you.';
      });
  }

  /* ------------------------------------------------------------ the widget */
  function build(mode) {
    var root = document.createElement('div');
    root.className = 'bl-chat';
    root.setAttribute('data-mode', mode);

    var providerLabel = UI.title;
    var providerSubtitle = UI.subtitle;

    root.innerHTML =
      '<button class="bl-chat-launcher" type="button" aria-label="' + esc(UI.launcherLabel) + '" aria-expanded="false">' +
        '<span class="bl-chat-badge">1</span>' +
        '<svg class="bl-ico-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
             'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 ' +
          '8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
        '</svg>' +
        '<svg class="bl-ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
             'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
      '<div class="bl-chat-panel" role="dialog" aria-label="' + esc(providerLabel) + '" aria-modal="false">' +
        '<div class="bl-chat-head">' +
          '<div class="bl-chat-avatar">BC</div>' +
          '<div class="bl-chat-head-meta">' +
            '<div class="bl-chat-title">' + esc(providerLabel) + '</div>' +
            '<div class="bl-chat-status"><span class="bl-chat-dot"></span>' + esc(providerSubtitle) + '</div>' +
          '</div>' +
          '<button class="bl-chat-close" type="button" aria-label="Minimise chat">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" ' +
                 'stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="bl-chat-body" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="bl-quick"></div>' +
        '<form class="bl-form" autocomplete="off">' +
          '<textarea class="bl-input" rows="1" placeholder="Type your message…" aria-label="Message"></textarea>' +
          '<button class="bl-send" type="submit" aria-label="Send message">' +
            '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" ' +
                 'stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/>' +
            '<path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>' +
          '</button>' +
        '</form>' +
        '<div class="bl-foot">Powered by Ballet · <a href="https://www.ballet.com/privacy/" target="_blank" ' +
             'rel="noopener noreferrer">Privacy</a></div>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.appendChild(root);

    var launcher = $('.bl-chat-launcher', root);
    var panel = $('.bl-chat-panel', root);
    var body = $('.bl-chat-body', root);
    var quick = $('.bl-quick', root);
    var form = $('.bl-form', root);
    var input = $('.bl-input', root);
    var send = $('.bl-send', root);
    var badge = $('.bl-chat-badge', root);
    var isOpen = false;
    var busy = false;

    /* ---- rendering ---- */
    function timeLabel(ts) {
      var d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function addMsg(role, text, ts) {
      var el = document.createElement('div');
      el.className = 'bl-msg ' + (role === 'user' ? 'bl-msg-user' : 'bl-msg-bot');
      el.innerHTML = linkify(text) + '<span class="bl-msg-time">' + esc(timeLabel(ts || Date.now())) + '</span>';
      body.appendChild(el);
      scrollToEnd();
      return el;
    }
    function scrollToEnd() {
      body.scrollTop = body.scrollHeight;
    }
    function showTyping() {
      var t = document.createElement('div');
      t.className = 'bl-typing';
      t.innerHTML = '<i></i><i></i><i></i>';
      body.appendChild(t);
      scrollToEnd();
      return t;
    }

    /* ---- quick replies ---- */
    function renderQuick(list) {
      quick.innerHTML = '';
      (list || []).forEach(function (label) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', function () {
          input.value = label;
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        });
        quick.appendChild(b);
      });
      quick.style.display = (list && list.length) ? 'flex' : 'none';
    }

    /* ---- history restore ---- */
    (session.history || []).forEach(function (m) { addMsg(m.role, m.text, m.ts); });
    if (!session.history || !session.history.length) {
      addMsg('bot', UI.greeting, Date.now());
      session.history = [{ role: 'bot', text: UI.greeting, ts: Date.now() }];
      persist();
    }
    renderQuick(UI.quickReplies);

    /* ---- open / close ---- */
    function open() {
      isOpen = true;
      root.classList.add('open');
      launcher.setAttribute('aria-expanded', 'true');
      badge.classList.remove('show');
      setTimeout(function () { input.focus(); }, REDUCED ? 0 : 260);
      scrollToEnd();
    }
    function close() {
      isOpen = false;
      root.classList.remove('open');
      launcher.setAttribute('aria-expanded', 'false');
    }
    launcher.addEventListener('click', function () { isOpen ? close() : open(); });
    $('.bl-chat-close', root).addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    /* ---- input ---- */
    function autoGrow() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    }
    input.addEventListener('input', function () { autoGrow(); send.disabled = !input.value.trim(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    /* ---- send ---- */
    function respond(text) {
      busy = true;
      send.disabled = true;
      var typing = showTyping();

      var delay = REDUCED ? 0 : Math.min(1600, 420 + text.length * 9);
      var work;

      if (mode === 'webhook') {
        work = webhookReply(text);
      } else if (mode === 'whatsapp') {
        work = Promise.resolve(
          'Tap the button below to continue this conversation with our team on WhatsApp — ' +
          'include a photo of your card (scratch panel covered) if it is a product issue.\n\n' +
          'https://wa.me/' + CFG.whatsapp.phone + '?text=' +
          encodeURIComponent(CFG.whatsapp.message || '')
        );
      } else if (mode === 'telegram') {
        work = Promise.resolve(
          'You can reach the team directly on Telegram: https://t.me/' + CFG.telegram.username
        );
      } else {
        work = Promise.reject(new Error('No reply provider configured'));
      }

      return new Promise(function (resolve) { setTimeout(function () { resolve(work); }, delay); })
        .then(function (reply) {
          if (typing.parentNode) typing.parentNode.removeChild(typing);
          addMsg('bot', reply, Date.now());
          session.history.push({ role: 'bot', text: reply, ts: Date.now() });
          persist();
          if (!isOpen) badge.classList.add('show');
        })
        .catch(function () {
          if (typing.parentNode) typing.parentNode.removeChild(typing);
          addMsg('bot', 'Sorry, something went wrong on our side. Please try again or email support@ballet.com.', Date.now());
        })
        .then(function () {
          busy = false;
          send.disabled = !input.value.trim();
          send.focus && null;
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var text = (input.value || '').trim();
      if (!text) return;
      addMsg('user', text, Date.now());
      session.history.push({ role: 'user', text: text, ts: Date.now() });
      persist();
      input.value = '';
      autoGrow();
      renderQuick([]);
      respond(text);
    });

    send.disabled = true;

    if (UI.autoOpenAfterMs && UI.autoOpenAfterMs > 0) {
      setTimeout(function () { if (!isOpen) open(); }, UI.autoOpenAfterMs);
    }

    window.BalletChat = {
      open: open,
      close: close,
      toggle: function () { isOpen ? close() : open(); },
      send: function (t) { input.value = t; form.dispatchEvent(new Event('submit', { cancelable: true })); },
      mode: mode,
      sessionId: session.id
    };
  }

  /* ------------------------- Smartsupp launcher / unavailable-state UI */
  function buildSmartsuppShell() {
    var root = document.createElement('div');
    root.className = 'bl-chat bl-chat-live';
    root.setAttribute('data-mode', 'smartsupp');
    root.innerHTML =
      '<button class="bl-chat-launcher" type="button" aria-label="' + esc(UI.launcherLabel) + '" ' +
          'aria-expanded="false" aria-controls="ballet-smartsupp-panel">' +
        '<svg class="bl-ico-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
             'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 ' +
          '8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
        '</svg>' +
        '<svg class="bl-ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
             'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
      '<div class="bl-chat-panel" id="ballet-smartsupp-panel" role="dialog" aria-label="' + esc(UI.title) + '" ' +
          'aria-modal="false" aria-hidden="true">' +
        '<div class="bl-chat-head">' +
          '<div class="bl-chat-avatar" aria-hidden="true">BC</div>' +
          '<div class="bl-chat-head-meta"><div class="bl-chat-title">' + esc(UI.title) + '</div>' +
            '<div class="bl-chat-status">Support</div></div>' +
          '<button class="bl-chat-close" type="button" aria-label="Close chat">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" ' +
                 'stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="bl-chat-body"><div class="bl-chat-offline" role="status" aria-live="polite">' +
          'Live chat is temporarily unavailable.<br><a href="mailto:support@ballet.com">Email support</a>' +
        '</div></div>' +
        '<div class="bl-foot"><a href="https://www.ballet.com/privacy/" target="_blank" ' +
          'rel="noopener noreferrer">Privacy</a></div>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.appendChild(root);

    var launcher = $('.bl-chat-launcher', root);
    var panel = $('.bl-chat-panel', root);
    var closeButton = $('.bl-chat-close', root);
    var isOpen = false;

    function setOpen(open) {
      isOpen = open;
      root.classList.toggle('open', open);
      launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    function open() {
      if (smartsuppReady()) {
        if (isOpen) setOpen(false);
        try { window.smartsupp('chat:open'); return; } catch (e) {}
      }
      setOpen(true);
      setTimeout(function () { closeButton.focus(); }, REDUCED ? 0 : 100);
    }
    function close() {
      if (smartsuppReady()) {
        try { window.smartsupp('chat:close'); } catch (e) {}
      }
      if (isOpen) setOpen(false);
      launcher.focus();
    }
    function toggle() {
      if (smartsuppReady()) { open(); return; }
      if (isOpen) close(); else open();
    }

    launcher.addEventListener('click', toggle);
    closeButton.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    window.BalletChat = {
      open: open,
      close: close,
      toggle: toggle,
      // Programmatic sends go through Smartsupp; nothing is stored locally.
      send: function (text) {
        var message = String(text || '').trim();
        if (!message) return;
        if (smartsuppReady()) {
          try {
            window.smartsupp('chat:open');
            window.smartsupp('chat:send', message);
            return;
          } catch (e) {}
        }
        open();
      },
      mode: 'smartsupp',
      provider: 'smartsupp',
      delegated: false,
      sessionId: null
    };
  }

  /* ------------------------------------------------------------------ run */
  function init() {
    var mode = resolveProvider();

    // Smartsupp owns the conversation UI. Clear any old site-side transcript
    // and mount only a native-widget launcher plus a no-bot contact fallback.
    if (mode === 'smartsupp') {
      clearStoredChatHistory();
      if (PROVIDERS.smartsupp && PROVIDERS.smartsupp.has()) PROVIDERS.smartsupp.load();
      buildSmartsuppShell();
      if (delegator) delegator();
      return;
    }

    // Other hosted providers retain their configured integration behavior.
    if (PROVIDERS[mode]) {
      var hideOurs = PROVIDERS[mode].load();
      build(mode);
      if (hideOurs === false) {
        var el = document.querySelector('.bl-chat');
        if (el) el.style.display = 'none';
      }
      if (delegator) delegator();
      window.BalletChat.mode = window.BalletChat.mode || mode;
      return;
    }

    build(mode);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
