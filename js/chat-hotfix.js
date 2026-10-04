/* Ballet chat runtime hotfix.
 * The Smartsupp loader owns its own launcher. Keep the local fallback visible
 * until a real Smartsupp widget is actually present; this prevents a blank
 * support corner when the provider is blocked or the Deno preview domain is
 * not whitelisted in Smartsupp.
 */
(function () {
  'use strict';

  function providerVisible() {
    var selectors = [
      '#smartsupp-widget-container',
      '#smartsupp-widget',
      '.smartsupp-widget',
      '#chat-application-iframe',
      '#widgetButtonFrame',
      'iframe[src*="smartsupp"]',
      'iframe[src*="smartsuppchat"]',
      '[id*="smartsupp"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      if (document.querySelector(selectors[i])) return true;
    }
    return false;
  }

  function reconcile() {
    var root = document.querySelector('.bl-chat');
    if (!root) return;
    var realWidget = providerVisible();
    root.style.display = realWidget ? 'none' : '';
    root.setAttribute('data-smartsupp-ready', realWidget ? 'true' : 'false');
  }

  function boot() {
    reconcile();
    window.setInterval(reconcile, 750);
    window.addEventListener('load', reconcile, { once: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
