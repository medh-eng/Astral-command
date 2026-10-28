/* VYUHA — modes
 * Pehla Yuddh (the two-minute first battle), the Daily Chakravyuha (one
 * seeded wheel for everyone, every day, with a share card), and sharing.
 * The battle screen calls into whichever mode owns the current match through
 * a few small hooks (onEvents, afterRender, resultExtras, aiRng, …).
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const E = AC.engine;
  const U = AC.units;
  const A = AC.art;
  const FX = AC.fx;

  const PUBLIC_URL = 'https://medh-eng.github.io/Astral-command/';
  const DAILY_EPOCH = Date.UTC(2026, 9, 28);      // Daily #1 = 28 Oct 2026 (IST)
  const DAILY_KEY = 'vyuha.daily.v1';
  const esc = function (s) { return AC.ui.esc(s); };

  /* ── small utilities ─────────────────────────────────────────── */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* The calendar day in India, whatever the device clock's zone. */
  function istDay(d) {
    const t = (d || new Date()).getTime() + 5.5 * 3600 * 1000;
    const x = new Date(t);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), key: x.toISOString().slice(0, 10), utc: Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()), dow: x.getUTCDay() };
  }

  function publicUrl() {
    try {
      if (root.location && /^https?:/.test(root.location.protocol)) return root.location.origin + root.location.pathname;
    } catch (e) { /* ignore */ }
    return PUBLIC_URL;
  }

  /* ── sharing ─────────────────────────────────────────────────── */

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        resolve();
      } catch (e) { reject(e); }
    });
  }

  /* A share sheet that works everywhere: WhatsApp first (that is where
   * Indian group chats live), then copy, then the phone's own share menu. */
  function shareText(text, opts) {
    opts = opts || {};
    const url = opts.url || publicUrl() + (opts.hash || '');
    const full = text + '\n' + url;
    const m = AC.ui.modal({
      kicker: opts.kicker || 'Share',
      title: opts.title || 'Send it to the group',
      body: '<pre class="share-preview">' + esc(full) + '</pre>',
      actions: [
        { label: 'WhatsApp', cls: 'btn-primary', icon: 'whatsapp', close: false, onClick: function () {
            const w = root.open('https://wa.me/?text=' + encodeURIComponent(full), '_blank');
            if (!w) FX.toast('Your browser blocked the window — use Copy instead.', 'warn');
          } },
        { label: 'Copy', cls: 'btn-ghost', close: false, onClick: function () {
            copy(full).then(function () { FX.toast('Copied — paste it anywhere.', 'success'); })
              .catch(function () { FX.toast('Could not copy on this browser.', 'error'); });
          } }
      ].concat(navigator.share ? [{ label: 'More…', cls: 'btn-ghost', close: false, onClick: function () {
        navigator.share({ text: full }).catch(function () { /* cancelled */ });
      } }] : []).concat([{ label: 'Close', cls: 'btn-ghost' }])
    });
    return m;
  }

  AC.share = { text: shareText, copy: copy, url: publicUrl };

  /* ── shared helpers for prepared matches ─────────────────────── */

  function place(state, id, owner, key, extra) {
    const def = U.UNIT_DEFS[key];
    const u = {
      id: 'P' + owner + '_' + key + '_' + id.replace(/[^0-9a-z]/gi, ''), owner: owner, key: key,
      rank: def.rank, badge: def.badge, name: def.name, short: def.short,
      revealed: false, hasMoved: false, shieldBroken: false, moveHistory: []
    };
    Object.assign(u, extra || {});
    state.board[id] = u;
    return u;
  }

  let active = null;     // the mode that owns the current match, if any

  function currentMode(state) {
    if (!active || !state || state !== active.state) return null;
    return active;
  }

  /* ══ Pehla Yuddh — the first battle ═════════════════════════════ */

  const LESSON = [
    { key: 'move', deva: 'चाल', title: 'Move', text: 'Tap your Rath (2) on the left, then tap a glowing cell up the open lane.', hint: '5,0',
      test: function (ev, actor) { return actor === 1 && ev.kind === 'move'; } },
    { key: 'look', deva: 'दिव्यदृष्टि', title: 'Look before you strike', text: 'Tap the Divyadrishti (5), press Drishti, then tap a hidden enemy. It is revealed without a fight.', hint: '5,2',
      test: function (ev, actor) { return actor === 1 && ev.kind === 'scan'; } },
    { key: 'volley', deva: 'शरवर्षा', title: 'Rain of arrows', text: 'Tap the Dhanurdhar (6), press Volley, then tap the enemy exactly two cells ahead.', hint: '5,3',
      test: function (ev, actor) { return actor === 1 && ev.kind === 'barrage'; } },
    { key: 'strike', deva: 'संघर्ष', title: 'Strike', text: 'Your Maharathi (9) beats almost anything. Tap it, tap the enemy beside it to see your odds, then tap again to strike.', hint: '4,2',
      test: function (ev, actor) { return actor === 1 && ev.kind === 'clash' && ev.outcome === 'att' && !ev.mine; } },
    { key: 'trap', deva: 'शतघ्नी', title: 'The trap', text: 'Pieces that never move may be a trap or the fort. Only a Yantrik (3) clears a trap. Walk yours up the right and strike the still piece.', hint: '3,5',
      test: function (ev, actor) { return actor === 1 && ev.kind === 'clash' && ev.mine && ev.outcome === 'att'; } },
    { key: 'gate', deva: 'दुर्ग', title: 'Take the fort', text: 'The last still piece is their fort. In a real battle its gate breaks on the first blow — here, one blow takes it.', hint: null,
      test: function (ev, actor) { return actor === 1 && ev.kind === 'clash' && ev.core; } }
  ];

  function buildTutorial() {
    const st = E.newState({
      mode: 'ai', board: 'small', scenario: 'duel', difficulty: 'recruit', tie: 'attacker',
      rules: { gates: false, hours: false, vyuha: false, astras: false }
    });
    st.scenario = 'shiksha';
    st.board = {};
    st.rosters = { 1: ['9', '6', '5', '3', '2', 'F'], 2: ['3', '1', '2', 'B', 'F'] };
    place(st, '5,0', 1, '2');
    place(st, '5,2', 1, '5');
    place(st, '5,3', 1, '6');
    place(st, '4,2', 1, '9');
    place(st, '3,5', 1, '3');
    place(st, '7,2', 1, 'F');
    // Guru Drona holds the enemy still for the lesson
    place(st, '3,2', 2, '3', { stun: 999 });
    place(st, '3,3', 2, '1', { stun: 999 });
    place(st, '1,3', 2, '2', { stun: 999 });
    place(st, '1,4', 2, 'B');
    place(st, '0,4', 2, 'F');
    E.beginBattle(st);
    return st;
  }

  function startTutorial() {
    const st = buildTutorial();
    active = {
      kind: 'tutorial', state: st, step: 0,
      noSave: true, noRecord: true, noRematch: true
    };
    AC.game.startPrepared(st, { line: 'start_tutorial', bannerTitle: 'Pehla Yuddh', bannerSub: 'पहला युद्ध · your first battle', save: false });
    renderCoach();
  }

  function renderCoach() {
    const el = document.getElementById('coach');
    if (!el) return;
    const m = active && active.kind === 'tutorial' ? active : null;
    if (!m || !AC.game.state || AC.game.state !== m.state) { el.hidden = true; return; }
    const step = LESSON[Math.min(m.step, LESSON.length - 1)];
    const done = m.step >= LESSON.length;
    el.hidden = false;
    el.innerHTML =
      '<div class="coach-steps">' + LESSON.map(function (s, i) {
        return '<i class="' + (i < m.step ? 'done' : i === m.step ? 'on' : '') + '"></i>';
      }).join('') + '</div>' +
      '<div class="coach-body"><span class="coach-deva deva">' + esc(step.deva) + '</span>' +
      '<b>' + (done ? 'Lesson complete' : (m.step + 1) + ' / ' + LESSON.length + ' · ' + esc(step.title)) + '</b>' +
      '<span>' + esc(done ? 'You know enough to fight. The rest you learn on the field.' : step.text) + '</span></div>';
  }

  function coachHint() {
    const m = active && active.kind === 'tutorial' ? active : null;
    if (!m || m.step >= LESSON.length) return;
    const step = LESSON[m.step];
    let hint = step.hint;
    // the Yantrik walks: follow it
    if (step.key === 'trap' || step.key === 'gate') {
      hint = E.findUnit(m.state, function (u) { return u.owner === 1 && u.key === '3'; });
    }
    if (step.key === 'strike' && !m.state.board['4,2']) hint = null;
    document.querySelectorAll('#board .coach-hint').forEach(function (n) { n.classList.remove('coach-hint'); });
    if (!hint) return;
    const cell = document.querySelector('#board .cell[data-id="' + hint + '"]');
    if (cell) cell.classList.add('coach-hint');
  }

  /* ══ Daily Chakravyuha ══════════════════════════════════════════ */

  const MODIFIERS = [
    { key: 'nightfall', deva: 'रात्रि', name: 'Chandra rises first', one: 'The defence holds the first hour.' },
    { key: 'shakti', deva: 'शक्ति', name: 'Shakti in hand', one: 'Your raiders begin with three lamps lit.' },
    { key: 'twin', deva: 'शतघ्नी', name: 'Twin traps', one: 'The defence has two Shataghni and one Rath fewer.' },
    { key: 'restless', deva: 'चक्र', name: 'The wheel is restless', one: 'The rings turn every 4 rounds instead of 5.' },
    { key: 'open', deva: 'द्वार', name: 'The gate is open', one: 'The fort’s gate is already broken — but the defence holds three Shakti.' }
  ];

  function dailyInfo(date) {
    const day = istDay(date);
    const n = Math.floor((day.utc - DAILY_EPOCH) / 86400000) + 1;
    const rng = mulberry32(hashStr('vyuha-daily-' + day.key));
    const mod = MODIFIERS[Math.floor(rng() * MODIFIERS.length)];
    const boardKey = day.dow === 0 ? 'padma' : 'wheel';
    return { n: n, day: day, seed: hashStr('vyuha-daily-' + day.key), mod: mod, boardKey: boardKey };
  }

  function loadDaily() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(DAILY_KEY);
      const d = raw ? JSON.parse(raw) : null;
      return d && d.results ? d : { results: {}, streak: 0, best: 0, lastWin: null };
    } catch (e) { return { results: {}, streak: 0, best: 0, lastWin: null }; }
  }
  function saveDaily(d) {
    try { if (root.localStorage) root.localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }

  function buildDaily(info) {
    const rng = mulberry32(info.seed);
    const mod = info.mod.key;
    const defenders = mod === 'twin'
      ? ['10', '9', '7', '6', '5', '3', '1', 'B', 'B', 'F']
      : ['10', '9', '7', '6', '5', '3', '2', '1', 'B', 'F'];
    const st = E.newState({
      mode: 'ai', board: info.boardKey, scenario: 'abhimanyu', difficulty: 'veteran', tie: 'attacker',
      startNight: mod === 'nightfall', rotateEvery: mod === 'restless' ? 4 : 0, enemyPreset: 'citadel'
    });
    st.scenario = 'daily';
    st.turnLimit = 24;
    st.limitWinner = 2;
    st.sky.startNight = mod === 'nightfall';
    st.rosters = { 1: ['9', '7', '6', '5', '2', '2', '1', '3'], 2: defenders };
    if (mod === 'restless') st.rotation.every = 4;
    E.deployPreset(st, 1, 'shuffle', rng);
    E.deployPreset(st, 2, 'shuffle', rng);
    st.shakti = { 1: mod === 'shakti' ? 3 : 2, 2: mod === 'open' ? 3 : 0 };
    if (mod === 'open') {
      const f = E.findUnit(st, function (u) { return u.owner === 2 && u.key === 'F'; });
      if (f) { st.board[f].breached = true; st.board[f].revealed = true; }
    }
    st.daily = { n: info.n, key: info.day.key, mod: mod };
    E.beginBattle(st);
    return st;
  }

  function startDaily() {
    const info = dailyInfo();
    const st = buildDaily(info);
    const record = loadDaily();
    const official = !record.results[info.day.key];
    active = {
      kind: 'daily', state: st, info: info, official: official,
      rng: mulberry32(info.seed ^ 0x9e3779b9),
      noRematch: true, noRecord: true
    };
    AC.game.startPrepared(st, {
      line: 'start_daily',
      bannerTitle: 'Daily Chakravyuha #' + info.n,
      bannerSub: info.mod.name + (official ? '' : ' · practice'),
      save: true
    });
    AC.ui.modal({
      kicker: 'Daily Chakravyuha #' + info.n + (official ? '' : ' · practice run'),
      title: 'Abhimanyu got in. Can you get out?',
      art: A.artFor('card:daily') || A.artFor('card:abhimanyu'),
      body: '<p class="daily-lede">Everyone in India faces this same wheel today. Eight raiders, ten defenders, ' +
        st.turnLimit + ' rounds. Break the gate, then take the fort.</p>' +
        '<div class="daily-mod"><span class="deva">' + esc(info.mod.deva) + '</span><b>' + esc(info.mod.name) + '</b><span>' + esc(info.mod.one) + '</span></div>' +
        (official ? '' : '<p class="intel-note">You have already fought today’s official battle. This one is for practice — your shared result stays the first one.</p>'),
      actions: [{ label: 'Take the field', cls: 'btn-primary' }]
    });
  }

  /* One square per round, from the raiders' side. */
  function dailyGrid(st) {
    const byRound = {};
    (st.captured[1] || []).forEach(function (c) { (byRound[c.turn] = byRound[c.turn] || {}).take = true; });
    (st.captured[2] || []).forEach(function (c) { (byRound[c.turn] = byRound[c.turn] || {}).lost = true; });
    (st.log || []).forEach(function (l) {
      if (l.kind === 'breach') (byRound[l.turn] = byRound[l.turn] || {}).gate = true;
      if (l.kind === 'astra') (byRound[l.turn] = byRound[l.turn] || {}).astra = true;
    });
    const rows = [];
    let row = '';
    for (let r = 1; r <= st.turn && r <= st.turnLimit; r++) {
      const x = byRound[r] || {};
      let sq = '⬛';
      if (r === st.turn && st.winner === 1) sq = '🏯';
      else if (x.gate) sq = '🚪';
      else if (x.astra) sq = '🔥';
      else if (x.take && x.lost) sq = '🟧';
      else if (x.take) sq = '🟨';
      else if (x.lost) sq = '🟥';
      row += sq;
      if (row.length >= 16) { rows.push(row); row = ''; }
    }
    if (row) rows.push(row);
    return rows.join('\n');
  }

  function dailyShareText(res) {
    const head = 'VYUHA · Daily Chakravyuha #' + res.n + ' · ' + res.label;
    const line1 = res.win
      ? '🛞 Broke in on round ' + res.rounds + ' of ' + res.limit
      : '🛞 The wheel closed on me (' + res.rounds + ' rounds)';
    const line2 = '⚔️ ' + res.taken + ' taken · 🩸 ' + res.lost + ' lost' + (res.astras ? ' · 🔥 ' + res.astras + ' astra' + (res.astras === 1 ? '' : 's') : '');
    return head + '\n' + line1 + '\n' + line2 + '\n' + res.grid + '\nAbhimanyu got in. Can you get out?';
  }

  function finishDaily(m) {
    const st = m.state;
    const win = st.winner === 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const res = {
      n: m.info.n,
      label: m.info.day.d + ' ' + months[m.info.day.m],
      win: win,
      rounds: Math.min(st.turn, st.turnLimit),
      limit: st.turnLimit,
      taken: (st.captured[1] || []).length,
      lost: (st.captured[2] || []).length,
      astras: (st.astraLog || []).filter(function (a) { return a.owner === 1; }).length,
      grid: dailyGrid(st)
    };
    const d = loadDaily();
    if (m.official) {
      d.results[m.info.day.key] = res;
      const prev = istDay(new Date(Date.now() - 86400000)).key;
      if (win) {
        d.streak = d.lastWin === prev ? (d.streak || 0) + 1 : 1;
        d.lastWin = m.info.day.key;
        d.best = Math.max(d.best || 0, d.streak);
      } else {
        d.streak = 0;
      }
      saveDaily(d);
    }
    m.result = d.results[m.info.day.key] || res;
    m.streak = d.streak || 0;
  }

  function dailyStatus() {
    const info = dailyInfo();
    const d = loadDaily();
    const today = d.results[info.day.key] || null;
    let streak = d.streak || 0;
    // a streak survives until a day is missed
    const prev = istDay(new Date(Date.now() - 86400000)).key;
    if (!today && d.lastWin !== prev) streak = 0;
    return { info: info, today: today, streak: streak, best: d.best || 0 };
  }

  /* ══ hooks the battle screen calls ══════════════════════════════ */

  const hooks = {
    wantsCoach: function (state) { const m = currentMode(state); return !!(m && m.kind === 'tutorial'); },
    noSave: function (state) { const m = currentMode(state); return !!(m && m.noSave); },
    noRecord: function (state) { const m = currentMode(state); return !!(m && m.noRecord); },
    noRematch: function (state) { const m = currentMode(state); return !!(m && m.noRematch); },
    aiRng: function (state) { const m = currentMode(state); return m && m.rng ? m.rng : undefined; },
    afterRender: function (state) {
      const m = currentMode(state);
      const coach = document.getElementById('coach');
      if (!m || m.kind !== 'tutorial') { if (coach) coach.hidden = true; return; }
      renderCoach();
      coachHint();
    },
    onEvents: function (state, arg) {
      const m = currentMode(state);
      if (!m) return;
      if (m.kind === 'tutorial') {
        arg.events.forEach(function (ev) {
          if (m.step < LESSON.length && LESSON[m.step].test(ev, arg.actor)) {
            m.step++;
            AC.audio.play('unlock');
            const next = LESSON[m.step];
            if (next) FX.toast('Good. Next: ' + next.title + '.', 'success');
          }
        });
        renderCoach();
      }
      if (m.kind === 'daily' && state.phase === 'over') finishDaily(m);
    },
    resultExtras: function (state) {
      const m = currentMode(state);
      if (!m) return null;
      if (m.kind === 'tutorial') {
        try { AC.ui.patchSettings({ tutorialDone: true }); } catch (e) { /* ignore */ }
        return {
          html: '<p class="daily-lede">You moved, looked, loosed arrows, struck, cleared a trap and took a fort. In a real battle the enemy fights back, the sky turns, and you have astras. Begin against Sainik on the Chakravyuha.</p>',
          actions: [{ label: 'Fight Sainik', cls: 'btn-primary', onClick: function () {
            active = null;
            AC.app.setup = Object.assign({}, AC.app.setup, { mode: 'ai', board: 'wheel', scenario: 'duel', difficulty: 'recruit' });
            AC.game.start(AC.app.setup);
          } }]
        };
      }
      if (m.kind === 'daily') {
        if (!m.result) finishDaily(m);
        const r = m.result;
        const text = dailyShareText(r);
        return {
          html: '<div class="daily-result">' +
            '<div class="daily-head">Daily Chakravyuha #' + r.n + (m.official ? '' : ' · practice (your official result is below)') + '</div>' +
            '<pre class="share-preview">' + esc(text) + '</pre>' +
            '<div class="daily-streak">' + A.icon('diya') + '<b>' + m.streak + '</b> day streak · come back tomorrow for #' + (r.n + 1) + '</div></div>',
          actions: [{ label: 'Share result', cls: 'btn-primary', icon: 'whatsapp', close: false, onClick: function () {
            shareText(text, { hash: '#daily', kicker: 'Daily Chakravyuha #' + r.n, title: 'Challenge your group' });
          } }]
        };
      }
      return null;
    }
  };

  /* A daily match restored from the autosave keeps its daily identity. */
  function resume(state) {
    active = null;
    if (!state || state.scenario !== 'daily' || !state.daily) return;
    const info = dailyInfo(new Date(state.daily.key + 'T12:00:00+05:30'));
    const record = loadDaily();
    active = {
      kind: 'daily', state: state, info: info, official: !record.results[info.day.key],
      rng: mulberry32(info.seed ^ 0x9e3779b9), noRematch: true, noRecord: true
    };
  }

  AC.modes = Object.assign(hooks, {
    resume: resume,
    startTutorial: startTutorial,
    startDaily: startDaily,
    dailyInfo: dailyInfo,
    dailyStatus: dailyStatus,
    dailyShareText: dailyShareText,
    buildDaily: buildDaily,
    buildTutorial: buildTutorial,
    LESSON: LESSON,
    MODIFIERS: MODIFIERS,
    clear: function () { active = null; }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
