/* BalletWeb — live support configuration.
 * The website uses Smartsupp for real human support. Visitors message the
 * support team in the Smartsupp chat; agents reply from the Smartsupp app.
 */
window.BALLET_CHAT_CONFIG = {
  provider: 'smartsupp',
  smartsupp: {
    key: '0f72515f9fb030435a08be49b1610cf6db90dbed',
    options: {},
    timeoutMs: 0
  },
  ui: {
    title: 'Ballet Support',
    subtitle: 'Live support via Smartsupp',
    launcherLabel: 'Chat live with Ballet support',
    position: 'bottom-right',
    accent: '#eebf29'
  }
};
