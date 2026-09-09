/* =========================================================================
   SUPPORT CHAT — INTEGRATION CONFIG
   -------------------------------------------------------------------------
   Drop your key / ID / script in the block for your provider below and the
   widget switches to that live agent integration automatically.
   Nothing else in the site needs to change.

   Supported:  smartsupp · tawk · crisp · intercom · zendesk · freshchat
               drift · salesiq · chatwoot · livechat · tidio · gorgias
               whatsapp · telegram · custom (any embed script)
               webhook (your own bot / API endpoint)
               demo     (built-in assistant — no key needed)

   If no credentials are filled in, the widget runs in "demo" mode with the
   built-in Ballet support assistant so the chat always works.
   ========================================================================= */

window.BALLET_CHAT_CONFIG = {

  /* Pick one, or leave on 'auto' to use whichever block below has a key. */
  provider: 'auto',   // 'auto' | 'smartsupp' | 'tawk' | 'crisp' | 'intercom' |
                      // 'zendesk' | 'freshchat' | 'drift' | 'salesiq' |
                      // 'chatwoot' | 'livechat' | 'tidio' | 'gorgias' |
                      // 'whatsapp' | 'telegram' | 'custom' | 'webhook' | 'demo'

  /* ---- Smartsupp  --------------------------------------------------- *
   *  ACTIVE — live agent chat is served by Smartsupp.                   *
   *  Dashboard: https://app.smartsupp.com/                              *
   *  If the Smartsupp widget fails to load (blocked, offline, or the    *
   *  domain is not yet allowed in your Smartsupp dashboard), the built-in*
   *  Ballet assistant automatically takes over so chat is never broken. *
   * ------------------------------------------------------------------- */
  smartsupp: {
    key: '0f72515f9fb030435a08be49b1610cf6db90dbed',
    // Optional extras passed straight to Smartsupp's _smartsupp object
    options: {
      // 'name': '',          // pre-fill  e.g. 'Jane Doe'
      // 'email': '',         // pre-fill  e.g. 'jane@example.com'
      // 'variables': { plan: 'pro' }   // custom visitor variables
    },
    // How long (ms) to wait for the Smartsupp widget before falling back
    // to the built-in assistant. 0 = wait forever (never fall back).
    timeoutMs: 8000
  },

  /* ---- Tawk.to ---------------------------------------------------------- */
  tawk: {
    propertyId: '',        // e.g. '6554a1b2c3d4e5f6a7b8c9d0'
    widgetId: ''           // e.g. '1ga1b2c3d'  (or use the whole directChatLink)
  },

  /* ---- Crisp ------------------------------------------------------------ */
  crisp: {
    id: ''                 // e.g. 'a1b2c3d4-1234-5678-90ab-cdef01234567'
  },

  /* ---- Intercom --------------------------------------------------------- */
  intercom: {
    appId: ''              // e.g. 'abc12def'
  },

  /* ---- Zendesk Web Widget ----------------------------------------------- */
  zendesk: {
    key: ''                // e.g. '5ed5ebbf-571a-417e-a057-d5ac0f4e239c'
  },

  /* ---- Freshchat -------------------------------------------------------- */
  freshchat: {
    token: '',             // e.g. 'a1b2c3d4-....'
    host: 'https://wchat.freshchat.com'
  },

  /* ---- Drift ------------------------------------------------------------ */
  drift: {
    id: ''                 // e.g. 'a1b2c3d4e5f6'
  },

  /* ---- Zoho SalesIQ ----------------------------------------------------- */
  salesiq: {
    code: ''               // e.g. 'a1b2c3d4e5'
  },

  /* ---- Chatwoot --------------------------------------------------------- */
  chatwoot: {
    baseUrl: 'https://app.chatwoot.com',
    websiteToken: ''       // e.g. 'a1b2c3d4e5f6a7b8c9d0'
  },

  /* ---- LiveChat --------------------------------------------------------- */
  livechat: {
    licenseId: ''          // e.g. '12345678'
  },

  /* ---- Tidio ------------------------------------------------------------ */
  tidio: {
    publicKey: ''          // e.g. 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d'
  },

  /* ---- Gorgias ---------------------------------------------------------- */
  gorgias: {
    chatUrl: ''            // full https://config.gorgias.chat URL you were given
  },

  /* ---- WhatsApp --------------------------------------------------------- */
  whatsapp: {
    phone: '',             // international format, digits only: 14155550123
    message: 'Hi Ballet Support, I need help with my order.'
  },

  /* ---- Telegram --------------------------------------------------------- */
  telegram: {
    username: ''           // e.g. 'BalletCrypto'
  },

  /* ---- Custom: paste ANY third-party embed script here ------------------ */
  custom: {
    src: '',               // e.g. 'https://cdn.example.com/widget.js'
    attrs: {},             // extra script attributes, e.g. { 'data-id': '123' }
    hideOwnLauncher: true  // hide this widget's launcher so only theirs shows
  },

  /* ---- Webhook: your own bot / helpdesk endpoint ------------------------ */
  webhook: {
    url: '',               // e.g. 'https://api.example.com/chat'
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // payload template — {{message}} is replaced with what the visitor typed
    bodyTemplate: { message: '{{message}}', sessionId: '{{sessionId}}' },
    // where to read the reply from in the JSON response
    replyPath: 'reply',    // supports dot paths e.g. 'data.answer'
    timeoutMs: 15000
  },

  /* ---- Widget chrome (applies to demo / webhook / whatsapp / telegram) -- */
  ui: {
    title: 'Ballet Support',
    subtitle: 'Typically replies in a few minutes',
    greeting: 'Hi there 👋 How can we help you today?',
    launcherLabel: 'Chat with support',
    position: 'bottom-right',      // bottom-right | bottom-left
    accent: '#eebf29',
    autoOpenAfterMs: 0,            // 0 = never auto-open
    quickReplies: [
      'Where is my order?',
      'How do I activate my card?',
      'Is my Ballet product genuine?',
      'What currencies are supported?',
      'Talk to a human'
    ]
  },

  /* Hand-off link used when the visitor asks for a person. */
  humanHandoff: {
    email: 'support@ballet.com',
    url: 'https://support.ballet.com/'
  }
};
