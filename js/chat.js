/* =========================================================================
   Ballet Support — live chat widget
   -------------------------------------------------------------------------
   One drop-in widget, many back ends. It reads window.BALLET_CHAT_CONFIG
   (see chat-config.js) and:

     * if credentials exist for a hosted provider  -> loads that provider's
       real script and hands the conversation over to it;
     * if a webhook URL is set                     -> posts each visitor
       message to your endpoint and renders the JSON reply;
     * otherwise                                   -> runs the built-in
       Ballet assistant so the chat always works.

   Everything is namespaced under window.BalletChat and does not touch any
   other part of the page.

   Hosted providers supported:  smartsupp · tawk · crisp · intercom · zendesk
                                freshchat · drift · salesiq · chatwoot
                                livechat · tidio · gorgias · custom

   A hosted provider that fails to render (blocked, offline, or the current
   domain is not whitelisted in its dashboard) automatically falls back to the
   built-in assistant, so the chat is never dead.
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

        // init() calls this AFTER build() publishes its own API, so the public
        // open/close/toggle drive Smartsupp while the built-in assistant stays
        // wired underneath as the fallback.
        delegator = function () {
          var api = window.BalletChat || {};
          var ownOpen = api.open, ownClose = api.close, ownToggle = api.toggle;
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
          // Push the visitor's first message into the Smartsupp transcript.
          api.send = function (text) {
            if (smartsuppReady()) {
              try { window.smartsupp('message', text); api.open(); return; } catch (e) {}
            }
            var input = document.querySelector('.bl-input');
            if (input) {
              input.value = text;
              var form = document.querySelector('.bl-form');
              if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
            }
          };
          window.BalletChat = api;

          undelegate = function () {
            api.mode = 'smartsupp:fallback';
            api.delegated = false;
            api.open = ownOpen;
            api.close = ownClose;
            api.toggle = ownToggle;
          };
        };

        // If Smartsupp never renders, reveal our own launcher and hand the
        // conversation back to the built-in assistant.
        if (timeout !== 0) {
          var t = timeout || 8000;
          var started = Date.now();
          (function poll() {
            if (smartsuppReady()) return;
            if (Date.now() - started > t) {
              var el = document.querySelector('.bl-chat');
              if (el) el.style.display = '';
              if (undelegate) undelegate();
              return;
            }
            setTimeout(poll, 250);
          })();
        }
        return false; // Smartsupp supplies its own launcher
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
    if (explicit !== 'auto') return explicit;
    for (var k in PROVIDERS) if (PROVIDERS[k].has()) return k;
    if (CFG.webhook && CFG.webhook.url) return 'webhook';
    if (CFG.whatsapp && CFG.whatsapp.phone) return 'whatsapp';
    if (CFG.telegram && CFG.telegram.username) return 'telegram';
    return 'demo';
  }

  /* -------------------------------------------------- built-in assistant */
  var KB = [
    { q: /(ship|track|order|delivery|deliver|arriv|where is)/i,
      a: 'You can track any order from the shipping confirmation email we sent at dispatch. ' +
         'US orders typically arrive in 3–7 business days, international in 7–21 days. ' +
         'If you ordered more than 48 hours ago and have no tracking email, reply with your order number and we will chase it up.\n\n' +
         '— Ballet ships from the US; duties or taxes may apply outside the US.' },
    { q: /(activat|set ?up|scan|how do i start|first time|quick start)/i,
      a: 'Activating takes about a minute:\n\n' +
         '1. Download Ballet Crypto (iOS / Android).\n' +
         '2. Tap "Add Card" and scan the QR code under the scratch-off panel on the back.\n' +
         '3. Send crypto to the address shown — that is it. No firmware, no password, no seed phrase.\n\n' +
         'Full walkthrough: https://www.ballet.com/quick-start/' },
    { q: /(genuine|authentic|fake|counterfeit|verif|legit)/i,
      a: 'Only buy from authorised channels and always verify on receipt. Peel the scratch-off panel and check the ' +
         'code on our verification page — a genuine code is only ever accepted once.\n\n' +
         'Verify here: https://www.ballet.com/verify/\n' +
         'More detail: https://support.ballet.com/hc/en-us/articles/39172800302489-Is-my-Ballet-product-genuine' },
    { q: /(private key|seed|2fkg|key secur)/i,
      a: 'Ballet never stores your private key. The full key is generated only on your device, only when you ' +
         'transfer funds out for the first time, and it is never transmitted to us. This is our Two-Factor ' +
         'Key Generation (2FKG) design.\n\nRead more: https://www.ballet.com/2FKG/' },
    { q: /(currenc|coin|token|support(ed)? asset|bitcoin|ethereum|xrp|nft)/i,
      a: 'REAL Series cold storage cards support 1,000+ cryptocurrencies and NFTs. Ballet Cold Storage Coins are ' +
         'single-currency (Bitcoin or XRP).\n\nFull list: https://www.ballet.com/supported-coins/' },
    { q: /(gift|give|present|birthday|wedding|occasion)/i,
      a: 'Load it, wrap it, give it. A Ballet card needs no account, no password and no seed phrase, so the ' +
         'recipient simply scans and holds it. Crypto Gift Cards are our party favourite: ' +
         'https://store.ballet.com/products/custom-bitcoin-gift-card' },
    { q: /(price|cost|how much|\$|buy|purchase|order now|shop)/i,
      a: 'Current pricing: 24K Gold-Plated Card from $299, Stainless Steel Card from $49, Cold Storage Coin from $29, ' +
         'Crypto Gift Cards from $49. Every order is covered by a 30-day money-back guarantee and free US shipping.\n\n' +
         'Shop: https://store.ballet.com/' },
    { q: /(refund|return|money back|guarantee|cancel)/i,
      a: 'We offer a 30-day money-back guarantee on unused cards. Start a return and we will issue a refund to your ' +
         'original payment method within 5–10 business days of receiving the item.\n\n' +
         'Policy: https://www.ballet.com/money-back-guarantee/' },
    { q: /(human|agent|person|representative|talk to some)/i,
      a: 'Of course — you can reach a real person at support@ballet.com or open a ticket at ' +
         'https://support.ballet.com/. If you tell me what it is about I can collect the details first so the ' +
         'agent picks it up with full context.' },
    { q: /(wallet|card) (is )?(lost|stolen|damaged|broken|wet)/i,
      a: 'A Ballet card is a bearer asset, so whoever holds it controls the funds. Move your crypto out immediately ' +
         'if you still have the card, or if it is lost sweep the funds to a new wallet the moment you regain access.\n\n' +
         'The card body itself is waterproof and shock-resistant, but we cannot recover funds from a card you no ' +
         'longer possess — email support@ballet.com and we will advise on your specific case.' },
    { q: /(app|download|ios|android|google play|app store)/i,
      a: 'Ballet Crypto is free on both stores:\niOS — https://apps.apple.com/us/app/id1474912942\n' +
         'Android — https://play.google.com/store/apps/details?id=com.balletcrypto' },
    { q: /(business|reseller|co-?brand|collab|affiliate|bulk)/i,
      a: 'We run co-branded cards, crypto gift cards, collaborations, a reseller programme, crypto business cards ' +
         'and an affiliate programme. Tell me which one fits and your expected volume and I will route you to the ' +
         'right team.\n\nAffiliates: https://affiliate.ballet.com/' },
    { q: /(hello|hi|hey|good (morning|evening|afternoon)|thanks|thank you)/i,
      a: 'Happy to help! What can I do for you — order help, activation, verifying a product, or something else?' }
  ];

  function demoReply(text) {
    var t = String(text || '');
    for (var i = 0; i < KB.length; i++) {
      if (KB[i].q.test(t)) return KB[i].a;
    }
    return 'Thanks for the message — I have passed that to the support team. In the meantime these usually help:\n\n' +
           '• Track or change an order — reply with your order number\n' +
           '• Activate a card — https://www.ballet.com/quick-start/\n' +
           '• Verify a card — https://www.ballet.com/verify/\n\n' +
           'For anything else, email support@ballet.com or open a ticket at https://support.ballet.com/ and a ' +
           'human will pick it up. Average first reply is a few minutes during business hours.';
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
        return reply || demoReply(text);
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

    var providerLabel = mode === 'demo' ? 'Ballet Assistant' : UI.title;

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
            '<div class="bl-chat-status"><span class="bl-chat-dot"></span>' + esc(UI.subtitle) + '</div>' +
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
        work = Promise.resolve(demoReply(text));
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

  /* ------------------------------------------------------------------ run */
  function init() {
    var mode = resolveProvider();

    // Hosted third-party provider: load it, then mount our own widget.
    if (PROVIDERS[mode]) {
      var hideOurs = PROVIDERS[mode].load();
      build(mode);
      if (hideOurs === false) {
        // The provider renders its own launcher — we still mount ours but keep
        // it out of the way so the site always has a fallback entry point.
        var el = document.querySelector('.bl-chat');
        if (el) el.style.display = 'none';
      }
      // build() publishes its own API object; let the provider wrap it.
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
