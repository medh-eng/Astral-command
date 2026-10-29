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

    /* Painted art is optional. Each image that lands used to trigger a full
     * re-render, which on a phone meant rebuilding the board a dozen times while
     * the player was tapping — the cause of the board flashing empty. Now the
     * loads are collected and applied once per frame, and only for art the
     * current screen actually draws. */
    if (AC.art && AC.art.probeAll) {
      let pending = false;
      let dirty = false;

      const needsBoard = (slot) => slot.indexOf('unit:') === 0 || slot.indexOf('faction:') === 0 ||
        slot.indexOf('board:') === 0 || slot === 'app';

      const flush = function () {
        pending = false;
        if (!dirty) return;
        dirty = false;
        if (AC.app.screen === 'game' && AC.game && AC.game.render) AC.game.render();
        else if (AC.app.screen === 'home') AC.ui.renderHome();
        else if (AC.app.screen === 'auth') AC.ui.renderAuth();
        else if (AC.app.screen === 'setup') AC.ui.renderSetup();
      };

      AC.art.onArtLoaded(function (slot) {
        const screen = AC.app.screen;
        const relevant =
          screen === 'game' ? needsBoard(slot) || slot.indexOf('banner:') === 0
          : screen === 'home' ? true
          : screen === 'auth' ? slot.indexOf('faction:') === 0 || slot === 'ui:hero'
          : screen === 'setup' ? slot.indexOf('card:') === 0
          : true;
        if (!relevant) return;
        dirty = true;
        if (pending) return;
        pending = true;
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
        else setTimeout(flush, 32);
      });
      AC.art.probeAll();
    }

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
