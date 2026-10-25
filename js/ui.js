/* Aetherfront: Astral Command — app shell UI
 * Screens, profiles/login, home, setup, modals, codex, saves, settings.
 * The battle screen itself lives in game.js.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const A = AC.art;
  const S = AC.storage;
  const AU = AC.audio;
  const FX = AC.fx;
  const U = AC.units;

  const app = (AC.app = AC.app || {});
  app.screen = 'boot';
  app.profile = null;
  app.guest = false;
  app.settings = {};
  app.setup = { mode: 'ai', board: 'small', tie: 'attacker', difficulty: 'veteran', timer: 0 };
  app.modals = [];

  /* ── helpers ─────────────────────────────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sfx(name) { AU.play(name); }
  function buzz(p) { AU.buzz(p); }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (!then) return '';
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.round(hrs / 24);
    if (days < 30) return days + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ── screens ─────────────────────────────────────────────────── */
  const SCREENS = ['auth', 'home', 'setup', 'game'];

  function show(name) {
    if (name !== 'game' && AC.game && AC.game.clearOverlays) AC.game.clearOverlays();
    app.screen = name;
    SCREENS.forEach(function (s) {
      const node = document.getElementById('screen-' + s);
      if (!node) return;
      node.hidden = s !== name;
    });
    if (name === 'auth') renderAuth();
    if (name === 'home') renderHome();
    if (name === 'setup') renderSetup();
    if (name === 'game' && AC.game) AC.game.onShow();
    const musicMode = name === 'game' ? 'battle' : name === 'auth' ? 'menu' : 'menu';
    if (app.settings.musicOn !== false) AU.startMusic(musicMode);
  }

  /* ── modal system ────────────────────────────────────────────── */
  function modal(opts) {
    opts = opts || {};
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const box = document.createElement('div');
    box.className = 'modal' + (opts.wide ? ' wide' : '');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', opts.title || 'Dialog');

    const actions = (opts.actions || []).map(function (a, i) {
      return '<button class="btn ' + (a.cls || 'btn-ghost') + '" data-act="' + i + '"' +
        (a.disabled ? ' disabled' : '') + '>' + (a.icon ? A.icon(a.icon) : '') + esc(a.label) + '</button>';
    }).join('');

    box.innerHTML =
      '<div class="modal-head">' +
        '<div>' +
          (opts.kicker ? '<div class="modal-kicker">' + esc(opts.kicker) + '</div>' : '') +
          '<div class="modal-title">' + esc(opts.title || '') + '</div>' +
          (opts.sub ? '<div class="modal-sub">' + opts.sub + '</div>' : '') +
        '</div>' +
        (opts.dismissible === false ? '' : '<button class="icon-btn icon-btn-xs modal-close" data-close="1" aria-label="Close">' + A.icon('close') + '</button>') +
      '</div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (actions ? '<div class="modal-actions">' + actions + '</div>' : '');

    backdrop.appendChild(box);
    document.getElementById('modal-root').appendChild(backdrop);

    const handle = {
      el: box,
      backdrop: backdrop,
      close: function () {
        if (!backdrop.parentNode) return;
        backdrop.remove();
        app.modals = app.modals.filter(function (m) { return m !== handle; });
        if (opts.onClose) opts.onClose();
        const top = app.modals[app.modals.length - 1];
        if (top) top.el.focus();
      },
      setBody: function (html) { box.querySelector('.modal-body').innerHTML = html; }
    };
    app.modals.push(handle);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop && opts.dismissible !== false) handle.close();
    });
    box.addEventListener('click', function (e) {
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) { sfx('ui'); handle.close(); return; }
      const actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        const idx = Number(actBtn.getAttribute('data-act'));
        const action = opts.actions[idx];
        if (!action) return;
        if (action.sfx !== false) sfx(action.sfx || 'ui');
        if (action.close !== false) handle.close();
        if (action.onClick) action.onClick(handle);
      }
    });
    return handle;
  }

  function confirm(opts) {
    return new Promise(function (resolve) {
      const m = modal({
        kicker: opts.kicker,
        title: opts.title,
        sub: opts.message ? '<span>' + opts.message + '</span>' : '',
        actions: [
          { label: opts.cancelLabel || 'Cancel', cls: 'btn-ghost', onClick: function () { resolve(false); } },
          {
            label: opts.confirmLabel || 'Confirm',
            cls: opts.danger ? 'btn-danger' : 'btn-primary',
            onClick: function () { resolve(true); },
            close: true
          }
        ],
        onClose: function () { resolve(false); }
      });
      void m;
    });
  }

  function promptText(opts) {
    return new Promise(function (resolve) {
      let settled = false;
      const m = modal({
        kicker: opts.kicker,
        title: opts.title,
        body: '<div class="field"><label>' + esc(opts.label || 'Name') + '</label>' +
          '<input id="prompt-input" type="text" maxlength="' + (opts.maxlength || 24) + '" value="' + esc(opts.value || '') + '" /></div>',
        actions: [
          { label: 'Cancel', cls: 'btn-ghost', onClick: function () { settled = true; resolve(null); } },
          {
            label: opts.confirmLabel || 'Save',
            cls: 'btn-primary',
            onClick: function () {
              settled = true;
              const v = document.getElementById('prompt-input');
              resolve(v ? v.value.trim() : '');
            }
          }
        ],
        onClose: function () { if (!settled) resolve(null); }
      });
      setTimeout(function () {
        const input = document.getElementById('prompt-input');
        if (input) { input.focus(); input.select(); }
        if (input) input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); m.el.querySelector('[data-act="1"]').click(); }
        });
      }, 60);
    });
  }

  /* ── settings application ────────────────────────────────────── */
  function applySettings() {
    const s = app.settings;
    document.documentElement.classList.toggle('cb', !!s.colorblind);
    document.documentElement.classList.toggle('hc', !!s.highContrast);
    document.documentElement.classList.toggle('reduce-motion', !!s.reducedMotion);
    AU.setSettings({ sfx: s.sfx, music: s.music, muted: s.muted, haptics: s.haptics });
    FX.setReducedMotion(s.reducedMotion);
  }

  function patchSettings(patch) {
    app.settings = S.patchSettings(patch);
    applySettings();
    renderQuickSettings();
    if (AC.game) AC.game.onSettingsChange();
    return app.settings;
  }

  /* ── auth ────────────────────────────────────────────────────── */
  let pinTarget = null;
  let pinBuffer = '';
  let chosenSigil = 'crystal';

  function renderAuth() {
    const profiles = S.listProfiles();
    const list = document.getElementById('auth-profiles');
    const pinPanel = document.getElementById('auth-pin-panel');
    const form = document.getElementById('form-new');
    const sub = document.getElementById('auth-sub');
    const fineprint = document.getElementById('auth-fineprint');

    pinPanel.hidden = true;
    form.hidden = true;
    list.hidden = false;

    if (!S.storageAvailable()) {
      fineprint.textContent = 'This browser blocks local storage, so profiles and saves will only last for this session.';
    } else if (!profiles.length) {
      fineprint.textContent = 'Profiles and saved games stay on this device — no account, no server, nothing uploaded.';
    }

    if (!profiles.length) {
      // first run: skip the empty list and put the form straight in front of them
      list.hidden = true;
      form.hidden = false;
      sub.textContent = 'Commission your first commander to begin.';
      const backBtn = document.getElementById('btn-cancel-new');
      if (backBtn) backBtn.hidden = true;
      const nameInput = document.getElementById('new-name');
      if (nameInput && !nameInput.value) setTimeout(function () { nameInput.focus(); }, 80);
      return;
    }

    sub.textContent = 'Select a profile to continue.';
    const backBtn2 = document.getElementById('btn-cancel-new');
    if (backBtn2) backBtn2.hidden = false;
    list.innerHTML = profiles.map(function (p) {
      const st = p.stats || {};
      return '<button class="profile-row" data-profile="' + p.id + '">' +
        '<span class="avatar">' + A.sigil(p.sigil) + '</span>' +
        '<span style="min-width:0">' +
          '<span class="profile-name">' + esc(p.name) + (p.hasPin ? ' ' + A.icon('lock', 'ico-inline') : '') + '</span>' +
          '<span class="profile-meta">' + (st.wins || 0) + 'W · ' + (st.losses || 0) + 'L · ' + (st.matches || 0) + ' matches' +
            (p.lastPlayed ? ' · ' + timeAgo(p.lastPlayed) : '') + '</span>' +
        '</span>' +
        '<span class="chev">' + A.icon('back') + '</span>' +
      '</button>';
    }).join('');

    $$('[data-profile]', list).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-profile');
        const profile = S.getProfile(id);
        if (!profile) return;
        sfx('ui');
        if (profile.pin) startPin(profile);
        else finishLogin(profile);
      });
    });
  }

  function startPin(profile) {
    pinTarget = profile;
    pinBuffer = '';
    document.getElementById('auth-profiles').hidden = true;
    document.getElementById('form-new').hidden = true;
    const panel = document.getElementById('auth-pin-panel');
    panel.hidden = false;
    document.getElementById('pin-name').textContent = profile.name;
    document.getElementById('pin-sigil').innerHTML = A.sigil(profile.sigil);
    document.getElementById('pin-hint').textContent = 'Enter your access code';
    document.getElementById('pin-hint').classList.remove('bad');
    renderPinDots();
    buildPinPad();
  }

  function renderPinDots() {
    const dots = document.getElementById('pin-dots');
    const n = Math.max(4, pinBuffer.length);
    let html = '';
    for (let i = 0; i < n; i++) html += '<i class="' + (i < pinBuffer.length ? 'on' : '') + '"></i>';
    dots.innerHTML = html;
  }

  function buildPinPad() {
    const pad = document.getElementById('pin-pad');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];
    pad.innerHTML = keys.map(function (k) {
      if (k === 'clear') return '<button type="button" class="pad-wide" data-key="clear">CLR</button>';
      if (k === 'del') return '<button type="button" class="pad-wide" data-key="del">DEL</button>';
      return '<button type="button" data-key="' + k + '">' + k + '</button>';
    }).join('');
    pad.onclick = function (e) {
      const b = e.target.closest('[data-key]');
      if (!b) return;
      const k = b.getAttribute('data-key');
      sfx('keypad');
      buzz(8);
      if (k === 'clear') pinBuffer = '';
      else if (k === 'del') pinBuffer = pinBuffer.slice(0, -1);
      else if (pinBuffer.length < 8) pinBuffer += k;
      renderPinDots();
      if (pinBuffer.length >= 4) tryPin();
    };
  }

  let pinBusy = false;
  function tryPin() {
    if (!pinTarget || pinBusy) return;
    if (pinBuffer.length < 4) return;
    pinBusy = true;
    S.verifyPin(pinTarget.id, pinBuffer).then(function (ok) {
      pinBusy = false;
      if (ok) {
        sfx('unlock');
        finishLogin(pinTarget);
      } else {
        const hint = document.getElementById('pin-hint');
        hint.textContent = 'Code rejected — try again.';
        hint.classList.add('bad');
        pinBuffer = '';
        renderPinDots();
        sfx('error');
        buzz([20, 40, 20]);
      }
    }).catch(function () {
      pinBusy = false;
      sfx('error');
    });
  }

  function finishLogin(profile) {
    app.profile = profile;
    app.guest = false;
    S.setActiveProfile(profile.id);
    S.setSession({ profileId: profile.id });
    AU.unlock();
    if (app.settings.musicOn !== false) AU.startMusic('menu');
    sfx('lock');
    show('home');
  }

  function loginGuest() {
    app.profile = null;
    app.guest = true;
    AU.unlock();
    if (app.settings.musicOn !== false) AU.startMusic('menu');
    show('home');
  }

  function wireAuth() {
    const picker = document.getElementById('sigil-picker');
    picker.innerHTML = Object.keys(A.SIGILS).map(function (s) {
      return '<button type="button" class="sigil-opt' + (s === chosenSigil ? ' on' : '') + '" data-sigil="' + s + '" aria-label="' + s + '">' + A.sigil(s) + '</button>';
    }).join('');
    picker.addEventListener('click', function (e) {
      const b = e.target.closest('[data-sigil]');
      if (!b) return;
      chosenSigil = b.getAttribute('data-sigil');
      $$('.sigil-opt', picker).forEach(function (n) { n.classList.toggle('on', n === b); });
      sfx('ui');
    });

    document.getElementById('btn-new-profile').addEventListener('click', function () {
      sfx('ui');
      document.getElementById('auth-profiles').hidden = true;
      document.getElementById('auth-pin-panel').hidden = true;
      document.getElementById('form-new').hidden = false;
      document.getElementById('auth-sub').textContent = 'Commission a new commander.';
      document.getElementById('new-name').focus();
    });

    document.getElementById('btn-cancel-new').addEventListener('click', function () {
      sfx('ui');
      renderAuth();
    });

    document.getElementById('pin-cancel').addEventListener('click', function () {
      sfx('ui');
      pinTarget = null;
      pinBuffer = '';
      renderAuth();
    });

    document.getElementById('btn-guest').addEventListener('click', function () {
      sfx('ui');
      loginGuest();
    });

    document.getElementById('form-new').addEventListener('submit', function (e) {
      e.preventDefault();
      const name = document.getElementById('new-name').value.trim();
      const pin = document.getElementById('new-pin').value.trim();
      if (!name) return;
      if (pin && (pin.length < 4 || !/^[0-9]+$/.test(pin))) {
        FX.toast('Access code must be 4–8 digits.', 'error');
        sfx('error');
        return;
      }
      S.createProfile({ name: name, sigil: chosenSigil, pin: pin }).then(function (profile) {
        FX.toast('Welcome, ' + profile.name + '.', 'success');
        finishLogin(profile);
      }).catch(function (err) {
        FX.toast(err.message || 'Could not create that profile.', 'error');
        sfx('error');
      });
    });
  }

  /* ── home ────────────────────────────────────────────────────── */
  function renderHome() {
    const p = app.profile;
    const name = p ? p.name : 'Guest';
    document.getElementById('home-name').textContent = name;
    document.getElementById('home-sigil').innerHTML = p ? A.sigil(p.sigil) : A.sigil('chevron');

    const stats = (p && p.stats) || { wins: 0, losses: 0, draws: 0, matches: 0, captures: 0, cores: 0, bestStreak: 0 };
    document.getElementById('home-rank').textContent = rankLabel(stats) + ' · ' + stats.matches + ' match' + (stats.matches === 1 ? '' : 'es');

    const hour = new Date().getHours();
    document.getElementById('home-greeting').textContent =
      hour < 5 ? 'Late watch' : hour < 12 ? 'Morning watch' : hour < 17 ? 'Afternoon watch' : hour < 21 ? 'Evening watch' : 'Night watch';

    document.getElementById('ci-new').innerHTML = A.icon('sword');
    document.getElementById('ci-resume').innerHTML = A.icon('play');
    document.getElementById('ci-saves').innerHTML = A.icon('folder');
    document.getElementById('ci-codex').innerHTML = A.icon('book');
    document.getElementById('btn-home-settings').innerHTML = A.icon('settings');
    document.getElementById('btn-home-codex').innerHTML = A.icon('book');
    document.getElementById('btn-signout').innerHTML = A.icon('user');

    const auto = S.listSaves().filter(function (s) { return s.slot === 'auto'; })[0];
    const saves = S.listSaves().filter(function (s) { return s.slot !== 'auto'; });
    document.getElementById('resume-sub').textContent = auto
      ? describeSave(auto)
      : 'No game in progress';
    document.getElementById('saves-sub').textContent = saves.length + ' of 3 slots used';
    document.getElementById('btn-resume').disabled = !auto;

    const winRate = stats.matches ? Math.round((stats.wins / stats.matches) * 100) : 0;
    document.getElementById('stat-grid').innerHTML =
      statCell(stats.wins, 'Wins') + statCell(stats.losses, 'Losses') +
      statCell(winRate + '%', 'Win rate') + statCell(stats.bestStreak || 0, 'Best streak');
    document.getElementById('winrate-fill').style.width = winRate + '%';
    document.getElementById('winrate-label').textContent = stats.matches
      ? stats.wins + ' wins · ' + stats.draws + ' draws · ' + stats.captures + ' captures · ' + stats.cores + ' cores broken'
      : 'No matches yet — the field is yours to take.';

    const tips = [
      'Immovable pieces are the only ones that never move. Track them — that is your Core and Mine map.',
      'A Strider that runs two or more tiles is revealed. Run it late, when the intel is worth the exposure.',
      'Probe the enemy back row with a Sapper: it is the only piece that can clear a Mine without dying.',
      'The Lancer shoots exactly two tiles and cannot be hurt by the reply. Free information, every other turn.',
      'If your opponent has not moved a piece all game, treat it as a Mine or the Core until proven otherwise.',
      'The Wraith only kills commanders when it attacks first. Never walk a Paladin into an unknown square.'
    ];
    document.getElementById('home-briefing').textContent = tips[Math.floor(Math.random() * tips.length)];

    renderQuickSettings();
    if (AC.game) AC.game.updateResumeState();
  }

  function statCell(v, l) {
    return '<div class="stat-cell"><div class="stat-val">' + v + '</div><div class="stat-lab">' + l + '</div></div>';
  }

  function rankLabel(stats) {
    const m = stats.matches || 0;
    if (!m) return 'Unranked';
    const wr = (stats.wins || 0) / m;
    if (m < 3) return 'Cadet';
    if (wr >= 0.75 && m >= 8) return 'Astral Marshal';
    if (wr >= 0.6) return 'Voidbreaker';
    if (wr >= 0.45) return 'Line Captain';
    if (wr >= 0.3) return 'Field Ensign';
    return 'Recruit';
  }

  function describeSave(save) {
    const m = save.meta || {};
    const mode = m.mode === 'pass' ? 'Pass & play' : 'vs ' + (U.DIFFICULTIES[m.difficulty] || U.DIFFICULTIES.veteran).label;
    const board = (U.BOARDS[m.board] || U.BOARDS.small).label;
    return board + ' · ' + mode + ' · turn ' + (m.turn || 1);
  }

  function renderQuickSettings() {
    const host = document.getElementById('quick-settings');
    if (!host) return;
    const s = app.settings;
    host.innerHTML =
      toggleRow('Sound effects', 'sfxOn', !s.muted) +
      toggleRow('Ambient score', 'musicOn', s.musicOn !== false) +
      toggleRow('Haptics', 'haptics', s.haptics !== false) +
      toggleRow('Colour-blind palette', 'colorblind', !!s.colorblind);
    $$('[data-toggle]', host).forEach(function (row) {
      row.addEventListener('click', function () {
        const key = row.getAttribute('data-toggle');
        sfx('ui');
        if (key === 'sfxOn') patchSettings({ muted: !app.settings.muted });
        else if (key === 'musicOn') {
          const on = !(app.settings.musicOn !== false);
          patchSettings({ musicOn: on });
          if (on) AU.startMusic('menu'); else AU.stopMusic();
        } else if (key === 'haptics') patchSettings({ haptics: !app.settings.haptics });
        else patchSettings({ colorblind: !app.settings.colorblind });
      });
    });
  }

  function toggleRow(label, key, on) {
    return '<div class="toggle-row" data-toggle="' + key + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" tabindex="0">' +
      '<span>' + esc(label) + '</span><span class="switch ' + (on ? 'on' : '') + '"></span></div>';
  }

  function wireHome() {
    document.getElementById('btn-new-match').addEventListener('click', function () { sfx('select'); show('setup'); });
    document.getElementById('btn-resume').addEventListener('click', function () {
      const auto = S.listSaves().filter(function (s) { return s.slot === 'auto'; })[0];
      if (!auto) { FX.toast('No game in progress.', 'warn'); return; }
      sfx('select');
      AC.game.load(auto.state, 'auto');
    });
    document.getElementById('btn-saves').addEventListener('click', function () { sfx('ui'); openSaves('home'); });
    document.getElementById('btn-codex').addEventListener('click', function () { sfx('ui'); openCodex(); });
    document.getElementById('btn-home-codex').addEventListener('click', function () { sfx('ui'); openCodex(); });
    document.getElementById('btn-home-settings').addEventListener('click', function () { sfx('ui'); openSettings(); });
    document.getElementById('btn-signout').addEventListener('click', function () {
      sfx('ui');
      confirm({
        title: 'Sign out?',
        message: 'Your profile and saved games stay on this device. You can sign back in with your access code.',
        confirmLabel: 'Sign out'
      }).then(function (ok) {
        if (!ok) return;
        app.profile = null;
        app.guest = false;
        S.clearSession();
        S.setActiveProfile(null);
        show('auth');
      });
    });
    document.getElementById('btn-reset-stats').addEventListener('click', function () {
      if (!app.profile) { FX.toast('Guest records are not stored.', 'warn'); return; }
      confirm({ title: 'Reset service record?', message: 'Wins, losses and streaks for this commander will be cleared. Saved games are untouched.', confirmLabel: 'Reset', danger: true })
        .then(function (ok) {
          if (!ok) return;
          S.resetStats(app.profile.id);
          app.profile = S.getProfile(app.profile.id);
          renderHome();
          FX.toast('Service record cleared.', 'success');
        });
    });
    document.getElementById('btn-export').addEventListener('click', function () {
      sfx('save');
      const data = S.exportAll();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aetherfront-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      FX.toast('Backup downloaded.', 'success');
    });
    document.getElementById('btn-import').addEventListener('click', function () {
      sfx('ui');
      document.getElementById('file-import').click();
    });
    document.getElementById('file-import').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          S.importAll(String(reader.result));
          app.settings = S.getSettings();
          applySettings();
          app.profile = S.activeProfile();
          renderHome();
          FX.toast('Backup restored.', 'success');
          sfx('save');
        } catch (err) {
          FX.toast(err.message || 'Import failed.', 'error');
          sfx('error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  /* ── setup ───────────────────────────────────────────────────── */
  function renderSetup() {
    const host = document.getElementById('setup-form');
    const s = app.setup;
    const groups = [];

    groups.push({
      label: 'Opponent',
      key: 'mode',
      options: [
        { v: 'ai', title: 'Astral AI', sub: 'Hidden-information bot with three difficulty tiers', icon: 'brain' },
        { v: 'pass', title: 'Pass & play', sub: 'Two commanders, one device, privacy curtain', icon: 'users' }
      ]
    });
    groups.push({
      label: 'Battlefield',
      key: 'board',
      options: Object.keys(U.BOARDS).map(function (k) {
        const b = U.BOARDS[k];
        return { v: k, title: b.label, sub: b.blurb, icon: 'grid' };
      })
    });
    if (s.mode === 'ai') {
      groups.push({
        label: 'AI difficulty',
        key: 'difficulty',
        options: Object.keys(U.DIFFICULTIES).map(function (k) {
          const d = U.DIFFICULTIES[k];
          return { v: k, title: d.label, sub: d.blurb, icon: 'star' };
        })
      });
    }
    groups.push({
      label: 'Equal-rank clashes',
      key: 'tie',
      options: [
        { v: 'attacker', title: 'Attacker advantage', sub: 'Attacker wins the tie but loses one rank (Shield Break)', icon: 'sword' },
        { v: 'mutual', title: 'Mutual destruction', sub: 'Classic rule — both pieces leave the board', icon: 'shield' }
      ]
    });
    groups.push({
      label: 'Turn clock',
      key: 'timer',
      options: [
        { v: 0, title: 'No clock', sub: 'Take your time', icon: 'clock' },
        { v: 60, title: '60 seconds', sub: 'Relaxed pace', icon: 'clock' },
        { v: 30, title: '30 seconds', sub: 'Blitz tempo — auto-move on timeout', icon: 'bolt' }
      ]
    });

    host.innerHTML = groups.map(function (g) {
      return '<div class="opt-group">' +
        '<div class="opt-label">' + esc(g.label) + '</div>' +
        '<div class="opt-row">' + g.options.map(function (o) {
          const on = String(app.setup[g.key]) === String(o.v);
          return '<button class="opt' + (on ? ' on' : '') + '" data-group="' + g.key + '" data-val="' + o.v + '">' +
            '<span class="opt-title">' + A.icon(o.icon) + esc(o.title) + '</span>' +
            '<span class="opt-sub">' + esc(o.sub) + '</span></button>';
        }).join('') + '</div></div>';
    }).join('');

    host.onclick = function (e) {
      const b = e.target.closest('[data-group]');
      if (!b) return;
      const key = b.getAttribute('data-group');
      let val = b.getAttribute('data-val');
      if (key === 'timer') val = Number(val);
      app.setup[key] = val;
      sfx('select');
      renderSetup();
    };

    const mode = app.setup.mode === 'pass' ? 'Pass & play' : 'Astral AI · ' + U.DIFFICULTIES[app.setup.difficulty].label;
    const board = U.BOARDS[app.setup.board];
    const tie = app.setup.tie === 'attacker' ? 'Attacker advantage' : 'Mutual destruction';
    const timer = app.setup.timer ? app.setup.timer + 's per turn' : 'No clock';
    document.getElementById('setup-summary').innerHTML =
      row('Opponent', mode) + row('Board', board.label + ' (' + (board.cells ? board.cells + ' cells' : board.cols + '×' + board.rows) + ')') +
      row('Tie rule', tie) + row('Clock', timer) + row('Army', '12 pieces each');
  }

  function row(k, v) {
    return '<div class="row"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
  }

  function wireSetup() {
    document.getElementById('btn-setup-back').innerHTML = A.icon('back');
    document.getElementById('btn-setup-back').addEventListener('click', function () { sfx('ui'); show('home'); });
    document.getElementById('btn-start-match').addEventListener('click', function () {
      sfx('lock');
      AC.game.start(app.setup);
    });
  }

  /* ── codex ───────────────────────────────────────────────────── */
  function openCodex(tab) {
    let active = tab || 'units';
    const tabs = [
      { k: 'units', label: 'Units' },
      { k: 'rules', label: 'Rules' },
      { k: 'powers', label: 'Powers' },
      { k: 'intel', label: 'Reading intel' }
    ];

    function bodyFor(k) {
      if (k === 'units') {
        return U.RANK_ORDER.map(function (key) {
          const u = U.UNIT_DEFS[key];
          return '<div class="unit-row">' +
            '<div class="unit-emblem">' + A.emblem(key) + '<span class="rank-tag">' + u.badge + '</span></div>' +
            '<div class="unit-body">' +
              '<div class="unit-name">' + esc(u.name) + ' <span class="unit-role">' + esc(u.role) + '</span></div>' +
              '<div class="unit-desc">' + esc(u.desc) + '</div>' +
              '<div class="unit-tip">▸ ' + esc(u.tip) + '</div>' +
            '</div></div>';
        }).join('');
      }
      if (k === 'rules') {
        const rules = [
          ['The objective', 'Capture the enemy Nexus Core — by melee attack or by a Lancer barrage from two tiles away — and the match ends immediately. If a commander has no legal action left, they concede.'],
          ['Movement', 'Every movable piece steps orthogonally. Astral Rifts are impassable terrain: nothing moves into or across them. The Strider slides any distance; the Valkyrie moves up to two; everything else moves one.'],
          ['Combat', 'The attacker resolves the clash. Higher rank wins. The Archon (10) beats everything except a Mine, or a Wraith that strikes first. The Wraith kills the Archon or Paladin only when attacking.'],
          ['Equal ranks', 'Depending on the match setting, either the attacker wins and loses one rank (Shield Break, never below 2), or both pieces are destroyed.'],
          ['Mines and Cores', 'Both are immovable. Any attacker dies to a Mine except the Warp Sapper, which defuses and captures it. The Core can be captured by any attacking piece.'],
          ['Revealing', 'A piece becomes revealed when it fights, when it is scanned, or when a Strider runs two or more tiles (and when a Valkyrie dashes two). Revealed ranks stay visible for the rest of the match.'],
          ['Two-square rule', 'A piece may not shuttle between the same two squares more than three times in a row. The fourth reversal is illegal — this prevents endless stalling.'],
          ['The chakra turns', 'On the Chakravyuha wheel, rings 1 and 2 rotate one spoke clockwise at the start of every fifth round. Whatever they carry moves with them — and is revealed. The hub touches all eight spokes but exposes whoever stands on it.'],
          ['No-capture draw', 'If neither side captures a piece for 60 orders, the engagement is declared a draw. The intel panel shows the countdown.'],
          ['Deployment', 'Each army has 12 pieces placed anywhere in its own three-row zone. Swap any two squares before locking. Presets are starting points, not commitments.']
        ];
        return '<div class="rule-block">' + rules.map(function (r) {
          return '<div class="rule-item"><h4>' + esc(r[0]) + '</h4><p>' + esc(r[1]) + '</p></div>';
        }).join('') + '</div>';
      }
      if (k === 'powers') {
        const powers = [
          ['Psionic Scan — Chrono Seer (5)', 'Reveals any enemy piece within two tiles (Manhattan distance) without fighting. The Seer stays put and is itself revealed. Information is the cheapest currency in this game.'],
          ['Arc Barrage — Plasma Lancer (6)', 'Fires at exactly two tiles orthogonally, arcing over anything in between. Ranks 1–5 are vaporised; ranks 6 and above deflect the bolt (both pieces revealed); a Mine absorbs it; the Core is destroyed and you win. The Lancer never moves and can never be counter-attacked by the shot.'],
          ['Phase Dash — Valkyrie Vanguard (7)', 'Moves up to two tiles in a straight line and may strike on arrival. This is the only piece that can attack from two squares away in melee, which lets it hit a second-rank defender in a single tempo.']
        ];
        return '<div class="rule-block">' + powers.map(function (p) {
          return '<div class="rule-item"><h4>' + esc(p[0]) + '</h4><p>' + esc(p[1]) + '</p></div>';
        }).join('') + '</div>';
      }
      return '<div class="rule-block">' +
        '<div class="rule-item"><h4>What you actually know</h4><p>You see your own ranks, plus every enemy piece that has been revealed. Everything else is inference.</p></div>' +
        '<div class="rule-item"><h4>The strongest single clue</h4><p>Core and Mine never move. So an enemy piece that has moved is <b>not</b> the Core and <b>not</b> a Mine. The Intel panel uses exactly this to build its odds.</p></div>' +
        '<div class="rule-item"><h4>Odds, not guesses</h4><p>Select a target and the intel panel shows the probability of winning the clash, averaged over every rank the enemy could still be hiding. Tap a hidden enemy to see its full distribution.</p></div>' +
        '<div class="rule-item"><h4>Probing</h4><p>Cheap pieces make good probes; commanders make bad ones. A Sapper is the only safe probe against a suspected Mine, and a Lancer barrage is the only probe that cannot be punished.</p></div>' +
      '</div>';
    }

    const m = modal({
      kicker: 'Reference',
      title: 'Codex & rules',
      wide: true,
      body: '<div class="codex-tabs">' + tabs.map(function (t) {
        return '<button class="codex-tab' + (t.k === active ? ' on' : '') + '" data-codex="' + t.k + '">' + t.label + '</button>';
      }).join('') + '</div><div id="codex-body">' + bodyFor(active) + '</div>',
      actions: [{ label: 'Close', cls: 'btn-ghost' }]
    });
    m.el.addEventListener('click', function (e) {
      const b = e.target.closest('[data-codex]');
      if (!b) return;
      active = b.getAttribute('data-codex');
      $$('[data-codex]', m.el).forEach(function (n) { n.classList.toggle('on', n === b); });
      document.getElementById('codex-body').innerHTML = bodyFor(active);
      sfx('ui');
    });
  }

  /* ── settings ────────────────────────────────────────────────── */
  function openSettings() {
    const s = app.settings;
    const body =
      '<div class="settings-grid">' +
        '<div class="slider-row"><label>Sound effects <span id="lbl-sfx">' + Math.round(s.sfx * 100) + '%</span></label>' +
          '<input type="range" min="0" max="100" value="' + Math.round(s.sfx * 100) + '" data-slider="sfx" /></div>' +
        '<div class="slider-row"><label>Ambient score <span id="lbl-music">' + Math.round(s.music * 100) + '%</span></label>' +
          '<input type="range" min="0" max="100" value="' + Math.round(s.music * 100) + '" data-slider="music" /></div>' +
        '<div>' +
          toggleRow('Mute everything', 'muted', !!s.muted) +
          toggleRow('Ambient score on', 'musicOn', s.musicOn !== false) +
          toggleRow('Haptics', 'haptics', s.haptics !== false) +
          toggleRow('Confirm every attack', 'confirmActions', s.confirmActions !== false) +
          toggleRow('Show intel panel', 'showIntel', s.showIntel !== false) +
          toggleRow('Board coordinates', 'coordinates', s.coordinates !== false) +
          toggleRow('Reduced motion', 'reducedMotion', !!s.reducedMotion) +
          toggleRow('Colour-blind palette', 'colorblind', !!s.colorblind) +
          toggleRow('High contrast', 'highContrast', !!s.highContrast) +
        '</div>' +
      '</div>' +
      '<p class="fineprint">Audio is synthesised live in the browser — no sound files, no downloads. Everything here is stored on this device.</p>';

    const m = modal({
      kicker: 'Preferences',
      title: 'Settings',
      body: body,
      actions: [{ label: 'Done', cls: 'btn-primary' }]
    });

    $$('[data-slider]', m.el).forEach(function (input) {
      input.addEventListener('input', function () {
        const key = input.getAttribute('data-slider');
        const v = Number(input.value) / 100;
        const patch = {};
        patch[key] = v;
        patchSettings(patch);
        const lbl = document.getElementById('lbl-' + key);
        if (lbl) lbl.textContent = input.value + '%';
        if (key === 'sfx') sfx('select');
      });
    });

    m.el.addEventListener('click', function (e) {
      const rowEl = e.target.closest('[data-toggle]');
      if (!rowEl) return;
      const key = rowEl.getAttribute('data-toggle');
      const patch = {};
      if (key === 'muted') patch.muted = !app.settings.muted;
      else if (key === 'musicOn') {
        patch.musicOn = !(app.settings.musicOn !== false);
        if (patch.musicOn) AU.startMusic('menu'); else AU.stopMusic();
      } else if (key === 'haptics') patch.haptics = !app.settings.haptics;
      else if (key === 'confirmActions') patch.confirmActions = !(app.settings.confirmActions !== false);
      else if (key === 'showIntel') patch.showIntel = !(app.settings.showIntel !== false);
      else if (key === 'coordinates') patch.coordinates = !(app.settings.coordinates !== false);
      else if (key === 'reducedMotion') patch.reducedMotion = !app.settings.reducedMotion;
      else if (key === 'colorblind') patch.colorblind = !app.settings.colorblind;
      else if (key === 'highContrast') patch.highContrast = !app.settings.highContrast;
      patchSettings(patch);
      rowEl.querySelector('.switch').classList.toggle('on');
      const on = rowEl.querySelector('.switch').classList.contains('on');
      rowEl.setAttribute('aria-checked', on ? 'true' : 'false');
      sfx('ui');
    });
  }

  /* ── saved games ─────────────────────────────────────────────── */
  function openSaves(origin) {
    const saves = S.listSaves();
    const bySlot = {};
    saves.forEach(function (s) { bySlot[s.slot] = s; });

    function card(slot) {
      const s = bySlot[slot];
      const isAuto = slot === 'auto';
      if (!s) {
        return '<div class="save-card empty">' +
          '<div class="save-thumb">' + A.icon('folder') + '</div>' +
          '<div class="save-info"><div class="save-title">' + (isAuto ? 'Autosave' : 'Slot ' + slot) + '</div>' +
          '<div class="save-meta">Empty' + (isAuto ? ' — starts automatically when you deploy' : '') + '</div></div>' +
          (isAuto ? '' : '<div class="save-actions"><button class="btn btn-ghost btn-xs" data-save-slot="' + slot + '">Save here</button></div>') +
        '</div>';
      }
      return '<div class="save-card">' +
        '<div class="save-thumb">' + A.boardPreview(s.state && AC.engine.thumbnailBoard(s.state)) + '</div>' +
        '<div class="save-info">' +
          '<div class="save-title">' + (isAuto ? 'Autosave' : 'Slot ' + slot) + '</div>' +
          '<div class="save-meta">' + esc(s.label || describeSave(s)) + ' · ' + timeAgo(s.updatedAt) + '</div>' +
        '</div>' +
        '<div class="save-actions">' +
          '<button class="btn btn-primary btn-xs" data-load="' + slot + '">Load</button>' +
          (isAuto ? '' : '<button class="btn btn-ghost btn-xs" data-overwrite="' + slot + '">Save</button>') +
          '<button class="btn btn-danger btn-xs" data-del="' + slot + '" aria-label="Delete">' + A.icon('trash') + '</button>' +
        '</div>' +
      '</div>';
    }

    const canSaveNow = AC.game && AC.game.canSave();
    const m = modal({
      kicker: 'Storage',
      title: 'Saved games',
      wide: true,
      body: '<div class="save-list">' + ['auto', '1', '2', '3'].map(card).join('') + '</div>' +
        '<p class="fineprint">Autosave keeps one rolling snapshot of your current match. Slots 1–3 are manual. Saves are device-local; use Export on the command deck to move them.</p>',
      actions: [{ label: 'Close', cls: 'btn-ghost' }]
    });

    m.el.addEventListener('click', function (e) {
      const loadBtn = e.target.closest('[data-load]');
      const delBtn = e.target.closest('[data-del]');
      const saveBtn = e.target.closest('[data-save-slot]');
      const overBtn = e.target.closest('[data-overwrite]');

      if (loadBtn) {
        const slot = loadBtn.getAttribute('data-load');
        const state = S.loadGame(slot);
        if (!state) { FX.toast('That slot is empty.', 'warn'); return; }
        sfx('select');
        m.close();
        AC.game.load(state, slot);
        return;
      }
      if (delBtn) {
        const slot = delBtn.getAttribute('data-del');
        confirm({ title: 'Delete this save?', message: 'The snapshot will be removed from this device.', confirmLabel: 'Delete', danger: true })
          .then(function (ok) {
            if (!ok) return;
            S.deleteSave(slot);
            m.close();
            openSaves(origin);
            renderHome();
            FX.toast('Save deleted.', 'success');
          });
        return;
      }
      if (saveBtn || overBtn) {
        const slot = saveBtn ? saveBtn.getAttribute('data-save-slot') : overBtn.getAttribute('data-overwrite');
        if (!canSaveNow) { FX.toast('Start or load a match first.', 'warn'); return; }
        if (overBtn) {
          confirm({ title: 'Overwrite slot ' + slot + '?', message: 'The existing snapshot will be replaced.', confirmLabel: 'Overwrite', danger: true })
            .then(function (ok) {
              if (!ok) return;
              doSave(slot);
              m.close();
              openSaves(origin);
            });
          return;
        }
        doSave(slot);
        m.close();
        openSaves(origin);
      }
    });
  }

  function doSave(slot) {
    const label = AC.game.saveTo(slot);
    if (label) {
      sfx('save');
      FX.toast('Saved to slot ' + slot + '.', 'success');
      renderHome();
    } else {
      FX.toast('Nothing to save yet.', 'warn');
    }
  }

  /* ── pause menu ──────────────────────────────────────────────── */
  function openPause() {
    if (!AC.game || !AC.game.isActive()) return;
    const m = modal({
      kicker: 'Match menu',
      title: 'Paused',
      sub: 'The battle is exactly where you left it.',
      body: '<div class="save-list">' +
        '<button class="advice-item" data-p="resume"><span class="advice-score">▶</span><span><span class="advice-label">Resume battle</span><span class="advice-note">Back to the board</span></span></button>' +
        '<button class="advice-item" data-p="save"><span class="advice-score">' + A.icon('save') + '</span><span><span class="advice-label">Save game</span><span class="advice-note">Write to a manual slot</span></span></button>' +
        '<button class="advice-item" data-p="intel"><span class="advice-score">' + A.icon('eye') + '</span><span><span class="advice-label">Intel ledger</span><span class="advice-note">What you know about the enemy</span></span></button>' +
        '<button class="advice-item" data-p="codex"><span class="advice-score">' + A.icon('book') + '</span><span><span class="advice-label">Codex & rules</span><span class="advice-note">Ranks, powers and edge cases</span></span></button>' +
        '<button class="advice-item" data-p="settings"><span class="advice-score">' + A.icon('settings') + '</span><span><span class="advice-label">Settings</span><span class="advice-note">Audio, motion, accessibility</span></span></button>' +
        '<button class="advice-item" data-p="resign"><span class="advice-score">' + A.icon('flag') + '</span><span><span class="advice-label">Resign match</span><span class="advice-note">Concede and return to the command deck</span></span></button>' +
      '</div>',
      actions: [{ label: 'Resume', cls: 'btn-primary' }]
    });
    m.el.addEventListener('click', function (e) {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const what = b.getAttribute('data-p');
      if (what === 'resume') { sfx('ui'); m.close(); return; }
      if (what === 'save') { m.close(); openSaves('game'); return; }
      if (what === 'intel') { m.close(); AC.game.openIntel(); return; }
      if (what === 'codex') { m.close(); openCodex(); return; }
      if (what === 'settings') { m.close(); openSettings(); return; }
      if (what === 'resign') {
        m.close();
        confirm({ title: 'Resign the match?', message: 'This counts as a loss in your service record.', confirmLabel: 'Resign', danger: true })
          .then(function (ok) { if (ok) AC.game.resign(); });
      }
    });
  }

  /* ── keyboard ────────────────────────────────────────────────── */
  function wireGlobalKeys() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const top = app.modals[app.modals.length - 1];
        if (top) { top.close(); return; }
        if (app.screen === 'game' && AC.game && AC.game.isActive()) openPause();
        else if (app.screen === 'setup') show('home');
      }
      if (e.key === 'm' && e.target === document.body) {
        patchSettings({ muted: !app.settings.muted });
        FX.toast(app.settings.muted ? 'Audio muted' : 'Audio on', 'info');
      }
    });
  }

  /* ── boot ────────────────────────────────────────────────────── */
  function boot() {
    app.settings = S.getSettings();
    applySettings();
    wireAuth();
    wireHome();
    wireSetup();
    wireGlobalKeys();

    // first interaction unlocks Web Audio (browser policy)
    const unlockOnce = function () {
      AU.unlock();
      if (app.settings.musicOn !== false) AU.startMusic(app.screen === 'game' ? 'battle' : 'menu');
      document.removeEventListener('pointerdown', unlockOnce);
      document.removeEventListener('keydown', unlockOnce);
    };
    document.addEventListener('pointerdown', unlockOnce);
    document.addEventListener('keydown', unlockOnce);

    // restore session within the same tab
    const session = S.getSession();
    let profile = null;
    if (session && session.profileId) profile = S.getProfile(session.profileId);
    if (!profile) profile = S.activeProfile();

    setTimeout(function () {
      const bootEl = document.getElementById('boot');
      if (bootEl) bootEl.classList.add('done');
      if (profile) {
        app.profile = profile;
        show('home');
      } else {
        show('auth');
      }
    }, 720);
  }

  AC.ui = {
    show: show,
    modal: modal,
    confirm: confirm,
    promptText: promptText,
    openCodex: openCodex,
    openSettings: openSettings,
    openSaves: openSaves,
    openPause: openPause,
    renderHome: renderHome,
    renderAuth: renderAuth,
    applySettings: applySettings,
    patchSettings: patchSettings,
    boot: boot,
    esc: esc,
    timeAgo: timeAgo,
    describeSave: describeSave,
    $: $,
    $$: $$
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
