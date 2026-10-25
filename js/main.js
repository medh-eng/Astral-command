/* Aetherfront: Astral Command — boot
 * Wires the battle screen, the effects canvas, service worker and the app UI.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    AC.fx.init(document.getElementById('fx'));
    if (AC.game && AC.game.wire) AC.game.wire();

    // Aetherfront icon on the two bar buttons that are icon-only in markup
    const brandIcon = AC.art.icon('bolt');
    void brandIcon;

    AC.ui.boot();

    // Offline support (GitHub Pages friendly). Silently skipped on file://
    if (navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function' &&
        location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode is optional */ });
      });
    }

    // Prevent iOS double-tap zoom on the board while keeping pinch-zoom elsewhere
    document.addEventListener('gesturestart', function (e) {
      if (e.target.closest && e.target.closest('.board')) e.preventDefault();
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
