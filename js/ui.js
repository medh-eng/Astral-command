/* VYUHA — app shell UI
 * Screens, profiles, home, setup, modals, codex, saves, settings.
 * The battle screen lives in game.js; the tutorial and the daily puzzle in modes.js.
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
  app.setup = { mode: 'ai', board: 'wheel', tie: 'attacker', difficulty: 'veteran', timer: 0, scenario: 'duel', ruleset: 'vyuha' };
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
    const musicMode = name === 'setup' ? 'tabla' : 'menu';
    if (app.settings.musicOn !== false && name !== 'game') AU.startMusic(musicMode);
  }

  /* ── modal system ────────────────────────────────────────────── */
  function modal(opts) {
    opts = opts || {};
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const box = document.createElement('div');
    box.className = 'modal' + (opts.wide ? ' wide' : '') + (opts.art ? ' art-modal' : '');
    if (opts.art) box.style.setProperty('--modal-art', 'url("' + opts.art + '")');
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
        // the button acts first (it may read an input or answer a promise),
        // then the dialog closes — closing first answered every confirm "Cancel"
        if (action.onClick) action.onClick(handle);
        if (action.close !== false) handle.close();
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
        // the dialog closes before a button's own handler runs, so a plain close
        // must wait a tick — otherwise it answers "Cancel" before "Concede" can
        onClose: function () { setTimeout(function () { resolve(false); }, 0); }
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
  /* Battery saver: the player's choice, or — until they choose — on for phones
   * with little memory or few cores, which are the ones that run hot. */
  function liteOn(s) {
    if (s.batterySaver === true || s.batterySaver === false) return s.batterySaver;
    const nav = (typeof navigator !== "undefined" && navigator) || {};
    return (nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || false;
  }
  app.liteOn = function () { return liteOn(app.settings); };

  function applySettings() {
    const s = app.settings;
    document.documentElement.classList.toggle('cb', !!s.colorblind);
    document.documentElement.classList.toggle('hc', !!s.highContrast);
    document.documentElement.classList.toggle('reduce-motion', !!s.reducedMotion);
    document.documentElement.classList.toggle('lite', liteOn(s));
    AU.setSettings({ sfx: s.sfx, music: s.music, muted: s.muted, haptics: s.haptics });
    FX.setReducedMotion(s.reducedMotion);
    if (AC.sanjaya) {
      AC.sanjaya.setLang(s.narratorLang || 'hinglish');
      AC.sanjaya.setVoice(s.voice !== false && s.narrator !== false);
    }
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
    const heroArt = AC.art && AC.art.artFor ? AC.art.artFor('ui:hero') : null;
    const bg = document.querySelector('.auth-bg');
    if (bg && heroArt) bg.style.backgroundImage = 'url("' + heroArt + '")';
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
  const HOME_LINES = [
    'Pieces that never move are either the fort or a trap, Maharaj. Probe them with something cheap.',
    'In your hour, every strike lands at +1. Count the rounds before you commit.',
    'Two of yours touching one of theirs is Makara — the jaws. Close them.',
    'A piece with two friends beside it is Padma. Strike it from where the petals are thin.',
    'The Chara kills the Senapati only when it strikes first. Keep yours hidden until then.',
    'Agneyastra burns traps too. Clear the lane to their fort with fire.',
    'Brahmastra fells any one fighting piece. Save it for the one that matters.',
    'The archer kills from two cells and never pays for it. Keep your fort out of its lane.',
    'The wheel turns every fifth round and shows everything it carries. Do not ride it by accident.',
    'At sunset the stronger army holds the field. Sometimes the best move is not to lose a piece.'
  ];

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return 'Shubh ratri';
    if (hour < 12) return 'Suprabhat';
    if (hour < 17) return 'Pranam';
    if (hour < 21) return 'Shubh sandhya';
    return 'Shubh ratri';
  }

  function quickSetup() {
    const last = app.settings.lastSetup;
    return Object.assign({ mode: 'ai', board: 'wheel', tie: 'attacker', difficulty: 'veteran', timer: 0, scenario: 'duel', ruleset: 'vyuha' },
      last && last.mode === 'ai' ? last : {});
  }

  function renderHome() {
    if (AC.art && AC.art.artFor) AC.art.artFor('ui:home');   // lazy: only on this screen
    const p = app.profile;
    const name = p ? p.name : 'Guest';
    document.getElementById('home-name').textContent = name;
    document.getElementById('home-sigil').innerHTML = A.avatar ? A.avatar(p, { size: 40, title: titleFor((p && p.stats && p.stats.wins) || 0)[1], streak: (p && p.stats && p.stats.streak) || 0 }) : A.sigil('chevron');

    const stats = (p && p.stats) || { wins: 0, losses: 0, draws: 0, matches: 0, captures: 0, cores: 0, bestStreak: 0 };
    document.getElementById('home-rank').textContent = rankLabel(stats) + ' · ' + stats.matches + ' battle' + (stats.matches === 1 ? '' : 's');
    document.getElementById('home-greeting').textContent = greeting() + ', ' + name;

    document.getElementById('ci-quick').innerHTML = A.icon('sword') + ' Yuddh karo';
    const q = quickSetup();
    const qb = U.BOARDS[q.board] || U.BOARDS.wheel;
    const qd = U.DIFFICULTIES[q.difficulty] || U.DIFFICULTIES.veteran;
    document.getElementById('quick-sub').textContent = 'Quick battle · ' + qb.label + ' vs ' + qd.label;

    document.getElementById('ci-daily').innerHTML = A.icon('calendar');
    document.getElementById('ci-tutorial').innerHTML = A.icon('help');
    document.getElementById('ci-new').innerHTML = A.icon('grid');
    document.getElementById('ci-resume').innerHTML = A.icon('play');
    document.getElementById('ci-saves').innerHTML = A.icon('folder');
    document.getElementById('ci-rules').innerHTML = A.icon('book');
    document.getElementById('btn-home-settings').innerHTML = A.icon('settings');
    document.getElementById('btn-home-rules').innerHTML = A.icon('book');
    document.getElementById('btn-signout').innerHTML = A.icon('user');

    // the daily card
    if (AC.modes && AC.modes.dailyStatus) {
      const d = AC.modes.dailyStatus();
      document.getElementById('daily-title').innerHTML = 'Daily Chakravyuha <span class="daily-num">#' + d.info.n + '</span>';
      document.getElementById('daily-sub').textContent = d.today
        ? (d.today.win ? 'Broken in on round ' + d.today.rounds + ' — share it, or practise' : 'The wheel held today — practise, or try tomorrow')
        : d.info.mod.name + ' · same wheel for everyone today';
      document.getElementById('daily-badge').innerHTML = d.streak ? A.icon('diya') + d.streak : (d.today ? A.icon('check') : 'NEW');
      document.getElementById('btn-daily').classList.toggle('done', !!d.today);
    }
    const tutDone = !!app.settings.tutorialDone;
    document.getElementById('btn-tutorial').classList.toggle('card-pulse', !tutDone);
    document.getElementById('tutorial-sub').textContent = tutDone ? 'Replay the two-minute lesson' : 'Start here · learn the field in two minutes';

    const auto = S.listSaves().filter(function (s) { return s.slot === 'auto'; })[0];
    const saves = S.listSaves().filter(function (s) { return s.slot !== 'auto'; });
    document.getElementById('resume-sub').textContent = auto
      ? describeSave(auto)
      : 'No battle in progress';
    document.getElementById('saves-sub').textContent = saves.length + ' of 3 slots used';
    document.getElementById('btn-resume').disabled = !auto;


    const sj = document.getElementById('home-sanjaya');
    if (sj) sj.innerHTML = A.sanjayaMark();
    document.getElementById('home-briefing').textContent = HOME_LINES[Math.floor(Math.random() * HOME_LINES.length)];

    // the spokes of the home chakra are drawn once
    const spokes = document.querySelector('.hc-spokes');
    if (spokes && !spokes.childNodes.length) {
      let svg = '';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r0 = i % 2 ? 26 : 13;
        svg += '<line x1="' + (Math.cos(a) * r0).toFixed(2) + '" y1="' + (Math.sin(a) * r0).toFixed(2) +
          '" x2="' + (Math.cos(a) * 40).toFixed(2) + '" y2="' + (Math.sin(a) * 40).toFixed(2) + '"/>';
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
        svg += '<circle class="hc-dot" cx="' + (Math.cos(a) * 44).toFixed(2) + '" cy="' + (Math.sin(a) * 44).toFixed(2) + '" r="1.1"/>';
      }
      const tpl = document.createElement('template');
      tpl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + svg + '</svg>';
      Array.prototype.slice.call(tpl.content.firstElementChild.childNodes).forEach(function (n) { spokes.appendChild(n); });
    }

    if (AC.game) AC.game.updateResumeState();
  }

  function statCell(v, l) {
    return '<div class="stat-cell"><div class="stat-val">' + v + '</div><div class="stat-lab">' + l + '</div></div>';
  }

  /* Titles follow the epic's grades of warrior: rathi, atirathi, maharathi,
   * atimaharathi — earned by wins, not by win rate, so they only go up. */
  const TITLES = [
    [0, 'Shishya', 'शिष्य'],
    [1, 'Sainik', 'सैनिक'],
    [5, 'Rathi', 'रथी'],
    [15, 'Atirathi', 'अतिरथी'],
    [35, 'Maharathi', 'महारथी'],
    [75, 'Atimaharathi', 'अतिमहारथी']
  ];
  function titleFor(wins) {
    let t = TITLES[0];
    TITLES.forEach(function (x) { if (wins >= x[0]) t = x; });
    return t;
  }
  function rankLabel(stats) {
    const t = titleFor(stats.wins || 0);
    return t[1] + ' ' + t[2];
  }
  function nextTitle(stats) {
    const w = stats.wins || 0;
    const next = TITLES.filter(function (x) { return x[0] > w; })[0];
    return next ? next[1] + ' at ' + next[0] + (next[0] === 1 ? ' win' : ' wins') : 'none — you are an Atimaharathi';
  }

  function describeSave(save) {
    const m = save.meta || {};
    const mode = m.mode === 'pass' ? 'Pass & play' : 'vs ' + (U.DIFFICULTIES[m.difficulty] || U.DIFFICULTIES.veteran).label;
    const board = (U.BOARDS[m.board] || U.BOARDS.small).label;
    const what = m.scenario === 'daily' ? 'Daily · ' : m.scenario === 'abhimanyu' ? 'Abhimanyu · ' : '';
    return what + board + ' · ' + mode + ' · round ' + (m.turn || 1);
  }

  function renderQuickSettings() {
    const host = document.getElementById('quick-settings');
    if (!host) return;
    const s = app.settings;
    host.innerHTML =
      toggleRow('Sound effects', 'sfxOn', !s.muted) +
      toggleRow('Music', 'musicOn', s.musicOn !== false) +
      toggleRow('Sanjaya narrates', 'narrator', s.narrator !== false) +
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
        else if (key === 'narrator') patchSettings({ narrator: app.settings.narrator === false });
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
    document.getElementById('btn-quick').addEventListener('click', function () {
      sfx('lock');
      if (AC.modes) AC.modes.clear();
      app.setup = quickSetup();
      AC.game.start(app.setup);
    });
    document.getElementById('btn-daily').addEventListener('click', function () {
      sfx('select');
      if (AC.modes) AC.modes.startDaily();
    });
    document.getElementById('home-name').addEventListener('click', function () { sfx('ui'); openProfile(); });
    document.getElementById('home-sigil').addEventListener('click', function () { sfx('ui'); openProfile(); });
    document.getElementById('btn-tutorial').addEventListener('click', function () {
      sfx('select');
      if (AC.modes) AC.modes.startTutorial();
    });
    document.getElementById('btn-resume').addEventListener('click', function () {
      const auto = S.listSaves().filter(function (s) { return s.slot === 'auto'; })[0];
      if (!auto) { FX.toast('No battle in progress.', 'warn'); return; }
      sfx('select');
      AC.game.load(auto.state, 'auto');
    });
    document.getElementById('btn-saves').addEventListener('click', function () { sfx('ui'); openSaves('home'); });
    document.getElementById('btn-rules').addEventListener('click', function () { sfx('ui'); openCodex(); });
    document.getElementById('btn-home-rules').addEventListener('click', function () { sfx('ui'); openCodex(); });
    document.getElementById('btn-home-settings').addEventListener('click', function () { sfx('ui'); openSettings(); });
    document.getElementById('btn-signout').addEventListener('click', function () { sfx('ui'); openProfile(); });
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
        { v: 'ai', title: 'Against the AI', sub: 'Sainik, Dronacharya or Shakuni', icon: 'brain' },
        { v: 'pass', title: 'Pass & play', sub: 'Two players, one device, a curtain between turns', icon: 'users' }
      ]
    });
    const scen = U.SCENARIOS[app.setupScenario()] || U.SCENARIOS.duel;
    groups.push({
      label: 'Scenario',
      key: 'scenario',
      options: Object.keys(U.SCENARIOS).map(function (k) {
        const sc = U.SCENARIOS[k];
        return { v: k, title: sc.label, deva: sc.deva, sub: sc.blurb, icon: k === 'duel' ? 'sword' : 'bolt' };
      })
    });
    groups.push({
      label: 'Battlefield',
      key: 'board',
      options: (scen.boards || Object.keys(U.BOARDS)).map(function (k) {
        const b = U.BOARDS[k];
        return { v: k, title: b.label, deva: b.deva, sub: b.blurb, icon: 'grid' };
      })
    });
    if (s.mode === 'ai') {
      groups.push({
        label: 'Opponent',
        key: 'difficulty',
        options: Object.keys(U.DIFFICULTIES).map(function (k) {
          const d = U.DIFFICULTIES[k];
          return { v: k, title: d.label, deva: d.deva, sub: d.blurb, icon: 'star' };
        })
      });
    }
    groups.push({
      label: 'Rules',
      key: 'ruleset',
      options: [
        { v: 'vyuha', title: 'VYUHA', deva: 'व्यूह', sub: 'Gates, hours, formations and astras', icon: 'sun' },
        { v: 'classic', title: 'Classic', sub: 'Bare ranks only — one blow takes the fort', icon: 'shield' }
      ]
    });
    groups.push({
      label: 'Equal strength',
      key: 'tie',
      options: [
        { v: 'attacker', title: 'Attacker wins', sub: 'The attacker takes it but its shield cracks (−1 rank)', icon: 'sword' },
        { v: 'mutual', title: 'Both fall', sub: 'Classic rule — both pieces leave the field', icon: 'shield' }
      ]
    });
    groups.push({
      label: 'Turn clock',
      key: 'timer',
      options: [
        { v: 0, title: 'No clock', sub: 'Take your time', icon: 'clock' },
        { v: 60, title: '60 seconds', sub: 'Relaxed pace', icon: 'clock' },
        { v: 30, title: '30 seconds', sub: 'Blitz — the advisor moves when time runs out', icon: 'bolt' }
      ]
    });

    host.innerHTML = groups.map(function (g, gi) {
      const label = g.key === 'difficulty' ? 'Who you face' : g.label;
      if (g.key === 'scenario') {
        return '<div class="opt-group">' +
          '<div class="opt-label">' + esc(label) + '</div>' +
          '<div class="mode-cards">' + g.options.map(function (o) {
            const on = String(app.setup.scenario) === String(o.v);
            const art = AC.art.artFor('card:' + o.v);
            return '<button class="mode-card' + (on ? ' on' : '') + '" data-group="scenario" data-val="' + o.v + '"' +
              (art ? ' style="background-image:url(\'' + art + '\')"' : '') + '>' +
              '<span class="mode-card-body">' +
                '<span class="mode-card-title">' + esc(o.title) + (o.deva ? ' <span class="deva">' + esc(o.deva) + '</span>' : '') + '</span>' +
                '<span class="mode-card-sub">' + esc(o.sub) + '</span>' +
              '</span>' +
              (on ? '<span class="mode-card-tick">' + A.icon('check') + '</span>' : '') +
            '</button>';
          }).join('') + '</div></div>';
      }
      void gi;
      return '<div class="opt-group">' +
        '<div class="opt-label">' + esc(label) + '</div>' +
        '<div class="opt-row">' + g.options.map(function (o) {
          const on = String(app.setup[g.key] == null ? (g.key === 'ruleset' ? 'vyuha' : '') : app.setup[g.key]) === String(o.v);
          return '<button class="opt' + (on ? ' on' : '') + '" data-group="' + g.key + '" data-val="' + o.v + '">' +
            '<span class="opt-title">' + A.icon(o.icon) + esc(o.title) + (o.deva ? ' <span class="deva">' + esc(o.deva) + '</span>' : '') + '</span>' +
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
      if (key === 'scenario') {
        const sc = U.SCENARIOS[val];
        if (sc && sc.boards && sc.boards.indexOf(app.setup.board) === -1) app.setup.board = sc.boards[0];
      }
      sfx('select');
      renderSetup();
    };

    const mode = app.setup.mode === 'pass' ? 'Pass & play' : 'vs ' + U.DIFFICULTIES[app.setup.difficulty].label;
    const scenario = U.SCENARIOS[app.setup.scenario] || U.SCENARIOS.duel;
    const board = U.BOARDS[app.setup.board];
    const tie = app.setup.tie === 'attacker' ? 'Attacker wins' : 'Both fall';
    const timer = app.setup.timer ? app.setup.timer + 's per turn' : 'No clock';
    document.getElementById('setup-summary').innerHTML =
      row('Scenario', scenario.label) + row('Opponent', mode) +
      row('Field', board.label + ' (' + (board.cells ? board.cells + ' cells' : board.cols + '×' + board.rows) + ')') +
      row('Rules', app.setup.ruleset === 'classic' ? 'Classic' : 'VYUHA') +
      row('Equal strength', tie) + row('Clock', timer) +
      row('Army', scenario.rosters
        ? scenario.rosters[1].length + ' raiders vs ' + scenario.rosters[2].length + ' defenders'
        : '12 pieces each') +
      (scenario.turnLimit ? row('Take the fort by', 'round ' + scenario.turnLimit) : '');
  }

  app.setupScenario = function () { return app.setup.scenario || 'duel'; };

  /* The setup screen speaks in rulesets; the engine speaks in rule layers. */
  function configFromSetup(setup) {
    const cfg = Object.assign({}, setup);
    if (setup.ruleset === 'classic') cfg.rules = { gates: false, hours: false, vyuha: false, astras: false };
    return cfg;
  }
  app.configFromSetup = configFromSetup;

  function row(k, v) {
    return '<div class="row"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
  }

  function wireSetup() {
    document.getElementById('btn-setup-back').innerHTML = A.icon('back');
    document.getElementById('btn-setup-back').addEventListener('click', function () { sfx('ui'); show('home'); });
    const howTo = document.getElementById('btn-how-to');
    if (howTo) {
      howTo.addEventListener('click', function () {
        sfx('ui');
        if (AC.game && AC.game.openHelp) AC.game.openHelp();
      });
    }
    document.getElementById('btn-start-match').addEventListener('click', function () {
      sfx('lock');
      if (AC.modes) AC.modes.clear();
      patchSettings({ lastSetup: Object.assign({}, app.setup) });
      AC.game.start(configFromSetup(app.setup));
    });
  }

  /* ── codex ───────────────────────────────────────────────────── */
  function openCodex(tab) {
    let active = tab || 'units';
    const tabs = [
      { k: 'units', label: 'Pieces' },
      { k: 'rules', label: 'Rules' },
      { k: 'astras', label: 'Astras' },
      { k: 'sky', label: 'Hours & formations' },
      { k: 'intel', label: 'Reading the field' }
    ];

    function block(rows) {
      return '<div class="rule-block">' + rows.map(function (r) {
        return '<div class="rule-item"><h4>' + r[0] + '</h4><p>' + r[1] + '</p></div>';
      }).join('') + '</div>';
    }

    function bodyFor(k) {
      if (k === 'units') {
        return U.RANK_ORDER.map(function (key) {
          const u = U.UNIT_DEFS[key];
          return '<div class="unit-row">' +
            '<div class="unit-emblem">' + A.emblem(key) + '<span class="rank-tag">' + u.badge + '</span></div>' +
            '<div class="unit-body">' +
              '<div class="unit-name">' + esc(u.name) +
                (u.deva ? ' <span class="deva" style="font-size:15px;color:var(--parch);opacity:.9">' + esc(u.deva) + '</span>' : '') +
                ' <span class="unit-role">' + esc(u.role) + '</span></div>' +
              (u.one ? '<div class="unit-one">' + esc(u.one) + '</div>' : '') +
              '<div class="unit-desc">' + esc(u.desc) + '</div>' +
              '<div class="unit-tip">▸ ' + esc(u.tip) + '</div>' +
            '</div></div>';
        }).join('');
      }
      if (k === 'rules') {
        return block([
          ['The objective', 'Break the gate of the enemy Durg (fort), then take it. The first successful blow — or a volley — breaks the gate and reveals the fort; the second takes it and ends the battle. Leave the enemy with no legal move and they concede.'],
          ['Movement', 'Pieces move along a cell’s lanes. Rifts on the square fields cannot be crossed, but arrows fly over them. The Rath slides any distance, the Ashvarohi up to two, everyone else one.'],
          ['Combat', 'The attacker resolves the clash. Higher strength wins: rank, plus +1 in your hour, plus +1 for a Makara pincer — against rank plus +1 for a Padma guard. Bonuses never add more than +2.'],
          ['Equal strength', 'Depending on the setting, either the attacker wins and its shield cracks (one rank lower, never below 2), or both pieces fall.'],
          ['Traps and forts', 'Both never move — so an unmoved piece may be either. Any piece that strikes a Shataghni dies, unless it is a Yantrik. Fire (Agneyastra) burns traps too.'],
          ['The Chara', 'The spy kills the Senapati or the Maharathi when it strikes first, whatever the hour and whatever guards them. Against anything else it loses.'],
          ['Revealing', 'A piece is revealed when it fights, when it is seen by the Divyadrishti, when a Rath runs two or more cells or the Ashvarohi dashes two, when the rings carry it, and by fire or Brahmastra.'],
          ['The turning field', 'On the Chakravyuha and the Padmavyuha, the two inner rings turn one cell clockwise every fifth round, carrying whatever stands on them — and revealing it.'],
          ['Sunset and ceasefire', 'If no piece falls for 100 orders, or the sun sets on the field’s last round, the stronger army holds the field: the sum of fighting ranks, +5 for a fort whose gate still stands.'],
          ['Abhimanyu', 'Eight raiders with no fort of their own must break into a closed wheel of ten and take its fort before round 28. They enter by day, with Shakti for two.'],
          ['Two-cell rule', 'A piece may not shuttle between the same two cells more than three times in a row.']
        ]);
      }
      if (k === 'astras') {
        return '<p class="intel-note" style="margin-bottom:10px">Shakti grows by one for every piece you take, and by one for both armies each time the sky turns (five lamps at most). Each astra can be invoked once per battle and uses your whole turn. Astras strike within two cells of any of your pieces.</p>' +
          E_ASTRAS().map(function (a) {
            return '<div class="unit-row astra-row-codex">' +
              '<div class="unit-emblem el-' + a.element + '">' + A.astraMark(a.key) + '<span class="rank-tag">' + a.cost + '</span></div>' +
              '<div class="unit-body"><div class="unit-name">' + esc(a.name) + ' <span class="deva" style="font-size:15px;opacity:.9">' + esc(a.deva) + '</span>' +
              ' <span class="unit-role">' + a.cost + ' Shakti</span></div>' +
              '<div class="unit-one">' + esc(a.one) + '</div><div class="unit-desc">' + esc(a.desc) + '</div></div></div>';
          }).join('') +
          '<p class="intel-note" style="margin-top:10px">The astras are invoked, never shown: no deity is ever a piece on this board.</p>';
      }
      if (k === 'sky') {
        return block([
          ['दिनमान · Dinman — the hour of Surya', 'By day, every Suryavansh strike lands at +1.'],
          ['रात्रि · Ratri — the hour of Chandra', 'By night, every Chandravansh strike lands at +1. A duel opens in the last hour of night, which balances the first move.'],
          ['When the sky turns', 'Every fifth round, at the same moment the rings turn. Both armies gain one Shakti. The HUD shows the hour and how many rounds remain.'],
          ['मकर · Makara — the jaws', 'Strike an enemy that another of your fighting pieces already touches: +1 to your strike. Two jaws are enough; more do not add.'],
          ['पद्म · Padma — the lotus', 'A piece touched by two or more of its own fighting pieces defends at +1. Strike where the petals are thin.'],
          ['How far it goes', 'Hour and Makara stack; a Maharathi (9) in its hour, in a pincer, strikes as 11 — enough to topple a Senapati. No side ever gains more than +2.']
        ]);
      }
      return block([
        ['What you actually know', 'You see your own ranks, plus every enemy piece that has been revealed. Everything else is inference.'],
        ['The strongest clue', 'Forts and traps never move. So an enemy piece that has moved is <b>not</b> the fort and <b>not</b> a trap. Every odds figure in the game uses exactly this.'],
        ['Odds on the board', 'Select a piece and every target shows the chance your blow succeeds, averaged over every rank the enemy could still be hiding — with the hour and the formations included. Tap once to see it, twice to strike.'],
        ['Probing', 'Cheap pieces make good probes; commanders make bad ones. A Yantrik is the only safe probe of a suspected trap, and a volley is the only probe that cannot be punished.'],
        ['The opponent', 'The AI plays by the same information you have. It never looks at your hidden ranks or your fort — it guesses, exactly as you do.']
      ]);
    }

    const m = modal({
      kicker: 'Granth · ग्रंथ',
      title: 'Rules',
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

  function E_ASTRAS() {
    return ['vayavya', 'sammohana', 'agneya', 'brahma'].map(function (k) { return U.ASTRA_DEFS[k]; });
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
        '<div class="slider-row"><label>Sanjaya speaks in</label>' +
          '<div class="seg" data-seg="narratorLang">' +
            [['hinglish', 'Hinglish'], ['hi', 'हिन्दी'], ['en', 'English']].map(function (o) {
              return '<button class="seg-btn' + ((s.narratorLang || 'hinglish') === o[0] ? ' on' : '') + '" data-segval="' + o[0] + '">' + o[1] + '</button>';
            }).join('') +
          '</div></div>' +
        '<div>' +
          toggleRow('Mute everything', 'muted', !!s.muted) +
          toggleRow('Music on', 'musicOn', s.musicOn !== false) +
          toggleRow('Sanjaya narrates', 'narrator', s.narrator !== false) +
          toggleRow('Sanjaya’s voice (when recorded)', 'voice', s.voice !== false) +
          toggleRow('Battle cinematics', 'cinematics', s.cinematics !== false) +
          toggleRow('Haptics', 'haptics', s.haptics !== false) +
          toggleRow('Tap twice to strike', 'confirmActions', s.confirmActions !== false) +
          toggleRow('Show intel panel', 'showIntel', s.showIntel !== false) +
          toggleRow('Board coordinates', 'coordinates', s.coordinates !== false) +
          toggleRow('Battery saver (cooler phone)', 'batterySaver', liteOn(s)) +
          toggleRow('Reduced motion', 'reducedMotion', !!s.reducedMotion) +
          toggleRow('Colour-blind palette', 'colorblind', !!s.colorblind) +
          toggleRow('High contrast', 'highContrast', !!s.highContrast) +
        '</div>' +
      '</div>' +
      '<div class="hub-h">Your data</div>' +
      '<div class="data-actions">' +
        '<button class="btn btn-ghost btn-sm" data-data="export">' + A.icon('download') + 'Export backup</button>' +
        '<button class="btn btn-ghost btn-sm" data-data="import">Import backup</button>' +
        '<button class="btn btn-ghost btn-sm btn-danger-ghost" data-data="reset">Reset record</button>' +
      '</div>' +
      '<p class="fineprint">Every setting, profile and save stays on this device. A backup moves them to another.</p>';

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
      const dataBtn = e.target.closest('[data-data]');
      if (dataBtn) {
        const what = dataBtn.getAttribute('data-data');
        if (what === 'export') exportBackup();
        else if (what === 'import') { sfx('ui'); document.getElementById('file-import').click(); }
        else resetRecord();
        return;
      }
      const segBtn = e.target.closest('[data-segval]');
      if (segBtn) {
        const seg = segBtn.closest('[data-seg]');
        const p = {};
        p[seg.getAttribute('data-seg')] = segBtn.getAttribute('data-segval');
        patchSettings(p);
        $$('.seg-btn', seg).forEach(function (n) { n.classList.toggle('on', n === segBtn); });
        sfx('ui');
        if (AC.sanjaya) AC.sanjaya.say('start_duel', { force: true });
        return;
      }
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
      else if (key === 'narrator') patch.narrator = app.settings.narrator === false;
      else if (key === 'voice') patch.voice = app.settings.voice === false;
      else if (key === 'cinematics') patch.cinematics = app.settings.cinematics === false;
      else if (key === 'showIntel') patch.showIntel = !(app.settings.showIntel !== false);
      else if (key === 'coordinates') patch.coordinates = !(app.settings.coordinates !== false);
      else if (key === 'reducedMotion') patch.reducedMotion = !app.settings.reducedMotion;
      else if (key === 'batterySaver') patch.batterySaver = !liteOn(app.settings);
      else if (key === 'colorblind') patch.colorblind = !app.settings.colorblind;
      else if (key === 'highContrast') patch.highContrast = !app.settings.highContrast;
      patchSettings(patch);
      rowEl.querySelector('.switch').classList.toggle('on');
      const on = rowEl.querySelector('.switch').classList.contains('on');
      rowEl.setAttribute('aria-checked', on ? 'true' : 'false');
      sfx('ui');
    });
  }

  /* ── data actions (live in Settings) ─────────────────────────── */
  function exportBackup() {
    sfx('save');
    const data = S.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vyuha-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    FX.toast('Backup downloaded.', 'success');
  }

  function resetRecord() {
    if (!app.profile) { FX.toast('Guest records are not stored.', 'warn'); return; }
    confirm({ title: 'Reset your record?', message: 'Wins, losses, streaks and your title will be cleared. Saved games are untouched.', confirmLabel: 'Reset', danger: true })
      .then(function (ok) {
        if (!ok) return;
        S.resetStats(app.profile.id);
        app.profile = S.getProfile(app.profile.id);
        renderHome();
        FX.toast('Record cleared.', 'success');
      });
  }

  /* ── the profile hub ─────────────────────────────────────────────
   * Name, record, standing against each opponent, avatar (ten portraits or
   * the player's own photo) and its frame, tint and badge. */
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Choose a photo.')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const cx = c.getContext('2d');
        cx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That photo could not be read.')); };
      img.src = url;
    });
  }

  function openProfile() {
    let p = app.profile;
    if (!p) { show('auth'); return; }
    const m = modal({ kicker: 'Yoddha', title: 'Your profile', body: '<div id="hub"></div>', actions: [{ label: 'Done', cls: 'btn-primary' }] });
    const host = m.el.querySelector('#hub');

    function save(patch) {
      const av = Object.assign({}, p.avatar || {}, patch);
      if (!S.updateProfile(p.id, { avatar: av })) { FX.toast('Not enough room on this device for that.', 'error'); return; }
      app.profile = p = S.getProfile(p.id);
      paint();
      renderHome();
    }

    function paint() {
      const st = p.stats || { wins: 0, losses: 0, draws: 0, matches: 0, captures: 0, cores: 0, bestStreak: 0, streak: 0 };
      const av = p.avatar || {};
      const t = titleFor(st.wins || 0);
      const winRate = st.matches ? Math.round((st.wins / st.matches) * 100) : 0;
      const daily = AC.modes && AC.modes.dailyStatus ? AC.modes.dailyStatus() : null;
      const by = st.byDiff || {};
      const opp = ['recruit', 'veteran', 'archon'];
      let best = -1;
      opp.forEach(function (k, i) { if (by[k] && by[k].w) best = i; });
      const standing = opp.map(function (k, i) {
        const d = U.DIFFICULTIES[k] || { label: k };
        const r = by[k] || { w: 0, l: 0, d: 0 };
        return '<div class="stand-row' + (r.w ? ' beaten' : '') + '"><span>' + esc(d.label) + (i === best ? ' <span class="stand-mark">· your level</span>' : '') +
          '</span><span class="stand-wl">' + r.w + ' won · ' + r.l + ' lost</span></div>';
      }).join('');
      const nextOpp = best < 2 ? (U.DIFFICULTIES[opp[best + 1]] || {}).label : null;

      host.innerHTML =
        '<div class="hub-top">' + A.avatar(p, { size: 76, title: t[1], streak: st.streak || 0 }) +
          '<div><div class="hub-name">' + esc(p.name) + ' <button class="link-btn" data-hub="rename">change name</button></div>' +
          '<div class="hub-title">' + t[1] + ' ' + t[2] + '</div>' +
          '<div class="hub-next">Next title: ' + esc(nextTitle(st)) + '</div></div>' +
        '</div>' +
        '<div class="hub-h">Record</div>' +
        '<div class="hub-grid">' +
          statCell(st.wins || 0, 'Wins') + statCell(st.losses || 0, 'Losses') +
          statCell(winRate + '%', 'Win rate') + statCell(st.streak || 0, 'Streak') +
          statCell(st.bestStreak || 0, 'Best run') + statCell(st.captures || 0, 'Taken') +
          statCell(st.cores || 0, 'Forts') + statCell(daily ? (daily.streak || 0) : 0, 'Daily streak') +
        '</div>' +
        '<div class="hub-h">Level of play</div>' +
        '<div class="hub-standing">' + standing + '</div>' +
        (nextOpp ? '<p class="fineprint">' + (best < 0 ? 'Win a battle against ' + esc(nextOpp) + ' to set your level.' : 'Beat ' + esc(nextOpp) + ' to rise.') + '</p>' : '<p class="fineprint">You have beaten Shakuni. Few can say so.</p>') +
        '<div class="hub-h">Avatar</div>' +
        '<div class="av-picker">' + A.AVATARS.map(function (a) {
          const on = !av.photo && av.pick === a.key;
          return '<button class="av-pick' + (on ? ' on' : '') + '" data-pick="' + a.key + '" aria-label="' + esc(a.name) + '">' +
            A.avatar({ avatar: { pick: a.key, frame: av.frame, tint: av.tint } }) + '<span>' + esc(a.name) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="hub-h">Your own photo</div>' +
        '<div class="hub-photo">' +
          '<button class="btn btn-ghost btn-sm" data-hub="photo">' + (av.photo ? 'Change photo' : 'Use a photo') + '</button>' +
          (av.photo ? '<button class="btn btn-ghost btn-sm" data-hub="nophoto">Remove photo</button>' : '') +
        '</div>' +
        '<p class="fineprint">Your photo stays on this device. It is never uploaded or shared.</p>' +
        '<div class="hub-h">Customise</div>' +
        seg('Frame', 'frame', A.AVATAR_FRAMES, av.frame || 'brass') +
        seg('Tint', 'tint', A.AVATAR_TINTS, av.tint || 'none') +
        seg('Badge', 'badge', A.AVATAR_BADGES, av.badge || 'none') +
        '<div class="hub-foot"><button class="link-btn" data-hub="switch">Switch player</button></div>';
    }
    function seg(label, key, list, cur) {
      return '<div class="hub-seg"><span class="seg-label">' + label + '</span><div class="seg">' + list.map(function (o) {
        return '<button class="seg-btn' + (o[0] === cur ? ' on' : '') + '" data-av="' + key + '" data-val="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div></div>';
    }

    host.addEventListener('click', function (e) {
      const pick = e.target.closest('[data-pick]');
      if (pick) { sfx('select'); save({ pick: pick.getAttribute('data-pick'), photo: null }); return; }
      const avb = e.target.closest('[data-av]');
      if (avb) { sfx('ui'); const patch = {}; patch[avb.getAttribute('data-av')] = avb.getAttribute('data-val'); save(patch); return; }
      const h = e.target.closest('[data-hub]');
      if (!h) return;
      const what = h.getAttribute('data-hub');
      if (what === 'rename') {
        promptText({ kicker: 'Your name', title: 'What should Sanjaya call you?', label: 'Name', value: p.name, maxlength: 18 })
          .then(function (name) {
            if (!name) return;
            S.renameProfile(p.id, name);
            app.profile = p = S.getProfile(p.id);
            paint();
            renderHome();
          });
      } else if (what === 'photo') {
        const input = document.getElementById('file-photo');
        input.onchange = function () {
          const file = input.files && input.files[0];
          input.value = '';
          if (!file) return;
          shrinkPhoto(file).then(function (data) {
            save({ photo: data });
            if (p.avatar && p.avatar.photo) FX.toast('Photo set. It stays on this device.', 'success');
          }).catch(function (err) { FX.toast(err.message, 'error'); });
        };
        input.click();
      } else if (what === 'nophoto') {
        save({ photo: null });
      } else if (what === 'switch') {
        confirm({
          title: 'Switch player?',
          message: 'Your profile and saved games stay on this device. You can come back to it any time.',
          confirmLabel: 'Switch'
        }).then(function (ok) {
          if (!ok) return;
          m.close();
          app.profile = null;
          app.guest = false;
          S.clearSession();
          S.setActiveProfile(null);
          show('auth');
        });
      }
    });
    paint();
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
        '<p class="fineprint">Autosave keeps one rolling snapshot of your current battle. Slots 1–3 are manual. Saves stay on this device; use Export on the home screen to move them.</p>',
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
        '<button class="advice-item" data-p="intel"><span class="advice-score">' + A.icon('eye') + '</span><span><span class="advice-label">Intel</span><span class="advice-note">What you know about the enemy, the hour, Shakti</span></span></button>' +
        '<button class="advice-item" data-p="help"><span class="advice-score">' + A.icon('help') + '</span><span><span class="advice-label">How to play</span><span class="advice-note">Eight things to know, in one screen</span></span></button>' +
        '<button class="advice-item" data-p="codex"><span class="advice-score">' + A.icon('book') + '</span><span><span class="advice-label">Rules</span><span class="advice-note">Pieces, astras, hours and formations</span></span></button>' +
        '<button class="advice-item" data-p="settings"><span class="advice-score">' + A.icon('settings') + '</span><span><span class="advice-label">Settings</span><span class="advice-note">Audio, motion, accessibility</span></span></button>' +
        '<button class="advice-item" data-p="resign"><span class="advice-score">' + A.icon('flag') + '</span><span><span class="advice-label">Leave the field</span><span class="advice-note">Concede the battle and go home</span></span></button>' +
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
      if (what === 'help') { m.close(); if (AC.game.openHelp) AC.game.openHelp(); return; }
      if (what === 'settings') { m.close(); openSettings(); return; }
      if (what === 'resign') {
        m.close();
        confirm({ title: 'Leave the field?', message: 'This counts as a loss in your record.', confirmLabel: 'Concede', danger: true })
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
    // a stale script or a failed load must never freeze the loading screen
    root.addEventListener('error', function () {
      const el = document.getElementById('boot');
      if (el && !el.classList.contains('done')) el.classList.add('done');
    });
    /* If anything below throws — or a stale script from an old cache breaks the
     * run — the player must never be left staring at the loading mark. */
    const watchdog = setTimeout(function () {
      const el = document.getElementById('boot');
      if (el && !el.classList.contains('done')) {
        el.classList.add('done');
        if (AC.fx && AC.fx.toast) AC.fx.toast('Something failed to load — pull down to reload.', 'error');
      }
    }, 6000);
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

    const deepLink = function () {
      const h = (root.location && root.location.hash) || '';
      if (!AC.modes) return;
      if (/^#daily/.test(h)) AC.modes.startDaily();
      else if (/^#learn/.test(h)) AC.modes.startTutorial();
    };

    setTimeout(function () {
      clearTimeout(watchdog);
      const bootEl = document.getElementById('boot');
      if (bootEl) {
        bootEl.classList.add('done');
        // gone for good: a hidden splash kept its spinner animating all game
        setTimeout(function () { bootEl.hidden = true; }, 450);
      }
      if (profile) {
        app.profile = profile;
        show('home');
        deepLink();
      } else if (!S.listProfiles().length) {
        // no login wall: a first-time player is a yoddha straight away and can
        // rename or lock the profile later
        S.createProfile({ name: 'Yoddha', sigil: 'sun', pin: '' }).then(function (p) {
          app.profile = p;
          app.guest = false;
          S.setActiveProfile(p.id);
          S.setSession({ profileId: p.id });
          show('home');
          deepLink();
        }).catch(function () { show('auth'); });
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
    renderSetup: renderSetup,
    applySettings: applySettings,
    patchSettings: patchSettings,
    boot: boot,
    openProfile: openProfile,
    esc: esc,
    timeAgo: timeAgo,
    describeSave: describeSave,
    $: $,
    $$: $$
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
