/* VYUHA — battle screen (v4)
 * Renders any cell graph as SVG, so the square arenas, the Chakravyuha wheel
 * and the Padmavyuha lotus share one renderer, one input path and one set of
 * animations. Chapter III adds the sky, Shakti and astras, formation links,
 * odds on the board, tap-twice strikes, the stage beats and Sanjaya.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const E = AC.engine;
  const AI = AC.ai;
  const U = AC.units;
  const A = AC.art;
  const AU = AC.audio;
  const FX = AC.fx;
  const S = AC.storage;
  const G = AC.geometry;
  const ST = AC.stage;
  const SJ = AC.sanjaya;

  const g = (AC.game = AC.game || {});
  g.state = null;
  g.sel = null;
  g.mode = 'move';
  g.astra = null;
  g.astraFirst = null;
  g.armed = null;
  g.thinking = false;
  g.focus = null;
  g.slot = null;
  g.timerId = null;
  g.timeLeft = 0;
  g.aiTimer = null;
  g.busy = false;
  g.over = false;
  g.hinted = false;
  g.links = null;
  g.said = {};

  const $ = function (s) { return document.querySelector(s); };
  const esc = function (s) { return AC.ui.esc(s); };
  const sfx = function (n) { AU.play(n); };
  const buzz = function (p) { AU.buzz(p); };

  function settings() { return AC.app.settings; }
  function modes() { return AC.modes || null; }
  function modeHook(name, arg) {
    const m = modes();
    if (m && typeof m[name] === 'function') return m[name](g.state, arg);
    return undefined;
  }

  const TIPS = [
    'A piece that has never moved can still be the fort or a trap. Probe with something cheap.',
    'The archer kills from two cells away — keep your fort out of a clear lane.',
    'Select a piece and every target shows your odds. Tap a target twice to strike.',
    'Every fifth round the sky turns. In your hour your blows land at +1.',
    'Two of your pieces touching one enemy make Makara — the jaws. +1 to the strike.',
    'A piece with two friends beside it is Padma — the petals. It defends at +1.',
    'A fort’s gate breaks on the first blow. The second blow takes it.',
    'Shakti grows with every piece you take. Spend it on astras — each once per match.',
    'Brahmastra destroys any one fighting piece within two cells of yours. Choose well.',
    'The hub touches every spoke: fastest crossing on the wheel, worst place to stand.',
    'Losing the Chara early costs you your best answer to the enemy Senapati.',
    'At sunset the stronger army holds the field — count what is left, not what you lost.'
  ];
  let tipTimer = null;
  let tipIndex = 0;
  let lastLineAt = 0;

  function paintStrip(html, kind) {
    const el = document.getElementById('tip-text');
    const bar = document.getElementById('tip-bar');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(function () {
      el.innerHTML = html;
      el.style.opacity = '1';
      if (bar) bar.className = 'tip-bar' + (kind ? ' ' + kind : '');
    }, 160);
  }

  function startTips() {
    if (tipTimer) clearInterval(tipTimer);
    tipIndex = Math.floor(Math.random() * TIPS.length);
    const paint = function () {
      // Sanjaya's latest line stays up for a while before tips return
      if (Date.now() - lastLineAt < 12000) return;
      paintStrip('<span class="tip-ico">◆</span>' + esc(TIPS[tipIndex % TIPS.length]), '');
      tipIndex++;
    };
    paint();
    tipTimer = setInterval(paint, 14000);
  }

  // Sanjaya speaks through the strip under the board
  if (SJ) {
    SJ.onLine(function (text) {
      lastLineAt = Date.now();
      paintStrip('<span class="sanjaya-face">' + A.sanjayaMark() + '</span><span class="sanjaya-text"><b>Sanjaya</b> ' + esc(text) + '</span>', 'sanjaya');
    });
  }
  let sayQueue = [];
  let sayTimer = null;
  function speak(keys) {
    if (!SJ || settings().narrator === false) return;
    keys = keys.filter(Boolean);
    if (!keys.length) return;
    sayQueue = sayQueue.concat(keys).slice(0, 3);
    const pump = function () {
      if (!sayQueue.length) { sayTimer = null; return; }
      const k = sayQueue.shift();
      SJ.say(k, { force: true });
      sayTimer = setTimeout(pump, 2600);
    };
    if (!sayTimer) pump();
  }
  function speakOnce(key) {
    if (g.said[key]) return;
    g.said[key] = true;
    speak([key]);
  }

  /* ── the legend that opens a match ── */
  const LEGEND = {
    duel: {
      title: 'Two houses, one field',
      text: 'Neither army knows the other’s order of battle. Twelve pieces a side, ten hidden ranks, and one fort whose gate must be broken before it falls. The battle opens in the last hour of night — Chandra’s hour.'
    },
    abhimanyu: {
      title: 'The wheel is closed',
      text: 'A single breach, eight companions, and the formation sealing behind you. Break the gate and take the fort before the rounds run out — or be remembered as the one who nearly did.'
    }
  };

  function showStory(done) {
    const st = g.state;
    const sc = U.SCENARIOS[st.scenario] || U.SCENARIOS.duel;
    const legend = LEGEND[st.scenario] || LEGEND.duel;
    if (settings().stories === false || !U.SCENARIOS[st.scenario]) { if (done) done(); return; }
    const art = A.artFor('card:' + st.scenario);
    const m = AC.ui.modal({
      kicker: sc.label + (sc.deva ? ' · ' + sc.deva : ''),
      title: legend.title,
      art: art,
      wide: false,
      body: '<p style="font-size:13px;line-height:1.65;color:var(--dim);margin:0 0 12px">' + esc(legend.text) + '</p>' +
        '<div class="legend-facts">' +
          '<span><b>' + st.rosters[1].length + '</b> your pieces</span>' +
          '<span><b>' + st.rosters[2].length + '</b> theirs</span>' +
          '<span><b>' + (st.turnLimit || '—') + '</b> rounds</span>' +
        '</div>',
      actions: [
        { label: 'Skip stories', cls: 'btn-ghost', onClick: function () {
            AC.ui.patchSettings({ stories: false });
          } },
        { label: 'Take the field', cls: 'btn-primary', onClick: function () { if (done) done(); } }
      ],
      onClose: function () { if (done) done(); }
    });
    return m;
  }

  g.showStory = showStory;

  let bannerTimer = null;
  function banner(title, sub, kind, ms) {
    const el = document.getElementById('turn-banner');
    if (!el) return;
    el.className = 'turn-banner' + (kind ? ' ' + kind : '');
    el.innerHTML = esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    void el.offsetWidth;
    el.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 1250);
  }
  g.banner = banner;

  function spinRings() {
    Array.prototype.forEach.call(document.querySelectorAll('#board .ring-1, #board .ring-2'), function (el) {
      el.classList.remove('chakra-spin');
      void el.getBoundingClientRect();
      el.classList.add('chakra-spin');
    });
  }
  function isPass() { return g.state && g.state.config.mode === 'pass'; }
  function isAi() { return g.state && g.state.config.mode === 'ai'; }
  function board() { return G.build(g.state.boardKey); }
  function viewerOf(st) { return st.viewer === 3 || st.viewer === 0 ? 1 : st.viewer; }

  function oppName(st) {
    st = st || g.state;
    if (!st) return '';
    if (st.config.mode !== 'ai') return 'Commander 2';
    const d = U.DIFFICULTIES[st.config.difficulty] || U.DIFFICULTIES.veteran;
    return d.label;
  }
  g.oppName = oppName;

  /* ══ lifecycle ═════════════════════════════════════════════════ */

  function clearOverlays() {
    Array.prototype.forEach.call(document.querySelectorAll('.curtain'), function (n) { n.remove(); });
    const scrim = document.getElementById('scrim');
    if (scrim) scrim.classList.remove('on');
    ['intel-panel', 'log-panel'].forEach(function (id) {
      const p = document.getElementById(id);
      if (p) p.classList.remove('open');
    });
    if (ST) ST.close(false);
    const coach = document.getElementById('coach');
    if (coach && !(g.state && modeHook('wantsCoach'))) coach.hidden = true;
  }
  g.clearOverlays = clearOverlays;

  function resetSelection() {
    g.sel = null;
    g.mode = 'move';
    g.astra = null;
    g.astraFirst = null;
    g.armed = null;
    g.focus = null;
  }

  function resetMatchFlags() {
    resetSelection();
    g.slot = null;
    g.over = false;
    g.busy = false;
    g.thinking = false;
    g.hinted = false;
    g.links = null;
    g.said = {};
    g.lastShakti = { 1: 0, 2: 0 };
    sayQueue = [];
    if (sayTimer) { clearTimeout(sayTimer); sayTimer = null; }
    lastLineAt = 0;
  }

  g.start = function (config) {
    clearTimers();
    if (AC.modes && AC.modes.clear) AC.modes.clear();
    clearOverlays();
    if (AC.app.configFromSetup && !config.rules) config = AC.app.configFromSetup(config);
    g.state = E.newState(Object.assign({}, config, {
      playerName: AC.app.profile ? AC.app.profile.name : 'Commander'
    }));
    resetMatchFlags();
    AC.ui.show('game');
    render();
    startTips();
    showStory(function () { speak([g.state.scenario === 'abhimanyu' ? 'start_abhimanyu' : 'start_duel']); });
    autosave();
    FX.toast(g.state.turnLimit
      ? 'Abhimanyu — break in and take the fort before round ' + g.state.turnLimit + '.'
      : 'Arrange your formation, then lock it in.', 'info');
  };

  /* Start from a state a mode has already prepared (tutorial, daily). */
  g.startPrepared = function (state, opts) {
    opts = opts || {};
    clearTimers();
    clearOverlays();
    g.state = state;
    resetMatchFlags();
    AC.ui.show('game');
    render();
    startTips();
    if (opts.line) speak([opts.line]);
    if (g.state.phase === 'battle') {
      banner(opts.bannerTitle || 'Battle begins', opts.bannerSub || '', 'gold', 1500);
      if (g.state.owner === 2 && isAi()) scheduleAi();
    }
    if (opts.save !== false) autosave();
  };

  g.load = function (raw, slot) {
    clearTimers();
    clearOverlays();
    try {
      g.state = E.deserialize(raw);
    } catch (err) {
      FX.toast('That save could not be read.', 'error');
      return;
    }
    resetMatchFlags();
    if (AC.modes && AC.modes.resume) AC.modes.resume(g.state);
    g.slot = slot || null;
    g.over = g.state.phase === 'over';
    if (g.state.phase === 'deploy2') g.state.viewer = 2;
    else if (g.state.phase === 'battle') g.state.viewer = isPass() ? g.state.owner : 1;
    else if (g.state.phase === 'deploy1') g.state.viewer = 1;
    g.lastShakti = { 1: g.state.shakti[1], 2: g.state.shakti[2] };
    AC.ui.show('game');
    render();
    startTips();
    FX.toast('Match restored.', 'success');
    if (g.state.phase === 'battle' && isAi() && g.state.owner === 2) scheduleAi();
  };

  g.onShow = function () { render(); };
  g.isActive = function () { return !!g.state; };
  g.canSave = function () { return !!g.state && g.state.phase !== 'over' && !modeHook('noSave'); };
  g.onSettingsChange = function () { render(); };
  g.updateResumeState = function () { /* home reads storage directly */ };

  function saveMeta(st) {
    return {
      mode: st.config.mode,
      board: st.boardKey,
      difficulty: st.config.difficulty,
      tie: st.config.tie,
      timer: st.config.timer,
      turn: st.turn,
      phase: st.phase,
      owner: st.owner,
      scenario: st.scenario
    };
  }

  g.saveTo = function (slot) {
    if (!g.canSave()) return null;
    const st = g.state;
    const label = (U.BOARDS[st.boardKey] || U.BOARDS.small).label + ' · ' +
      (st.config.mode === 'pass' ? 'Pass & play' : 'vs ' + oppName(st)) +
      ' · round ' + st.turn;
    const entry = S.saveGame(slot, st, Object.assign({ label: label }, saveMeta(st)));
    return entry ? label : null;
  };

  function autosave() {
    if (!g.canSave()) return;
    const st = g.state;
    S.saveGame('auto', st, Object.assign({ label: 'Autosave' }, saveMeta(st)));
  }
  g.autosave = autosave;

  function clearTimers() {
    if (g.timerId) { clearInterval(g.timerId); g.timerId = null; }
    if (g.aiTimer) { clearTimeout(g.aiTimer); g.aiTimer = null; }
  }

  /* ══ rendering ═════════════════════════════════════════════════ */

  function render() {
    if (!g.state) return;
    // deployment gets the tabla score, battle gets the war drums
    if (g.state.phase === 'deploy1' || g.state.phase === 'deploy2') AU.startMusic('tabla');
    else if (g.state.phase === 'battle') AU.startMusic('battle');
    renderHud();
    renderStrips();
    renderBoard();
    renderActionBar();
    renderIntel();
    renderLog();
    startClockIfNeeded();
    modeHook('afterRender');
  }

  function skyIcon(hour) { return A.icon(hour === 'day' ? 'sun' : 'moon'); }

  function renderHud() {
    const st = g.state;
    const pill = $('#hud-turn');
    const sub = $('#hud-sub');
    const clock = $('#hud-clock');
    const skyEl = $('#hud-sky');
    $('#btn-game-menu').innerHTML = A.icon('menu');
    $('#btn-hud-intel').innerHTML = A.icon('eye');
    $('#btn-hud-log').innerHTML = A.icon('book');
    $('#btn-hud-settings').innerHTML = A.icon('settings');
    $('#btn-log-close').innerHTML = A.icon('close');

    const hour = E.hourOf(st);
    if (skyEl) {
      if (hour && st.phase === 'battle') {
        const left = E.roundsUntilHourTurns(st);
        const mine = E.hourOwner(st) === viewerOf(st);
        skyEl.hidden = false;
        skyEl.className = 'sky-chip ' + hour + (mine ? ' mine' : '');
        skyEl.innerHTML = skyIcon(hour) + '<span>' + left + '</span>';
        skyEl.title = (hour === 'day' ? 'Dinman — the hour of Surya' : 'Ratri — the hour of Chandra') +
          '. The sky turns in ' + left + ' round' + (left === 1 ? '' : 's') + '.';
      } else {
        skyEl.hidden = true;
      }
    }

    pill.className = 'turn-pill';
    if (st.phase === 'deploy1' || st.phase === 'deploy2') {
      const owner = st.phase === 'deploy1' ? 1 : 2;
      pill.classList.add(owner === 1 ? 'solar' : 'void');
      pill.textContent = 'Vyuha rachna · ' + U.FACTIONS[owner].short;
      sub.textContent = 'Arrange your formation: tap two cells to swap them, then lock it.';
    } else if (st.phase === 'battle') {
      const roundsLeft = st.turnLimit ? Math.max(0, st.turnLimit - st.turn + 1) : 0;
      if (g.thinking) {
        pill.classList.add('void');
        pill.textContent = oppName(st) + ' is thinking';
        sub.textContent = 'Weighing what it has seen of your army.';
      } else {
        const owner = st.owner;
        pill.classList.add(owner === 1 ? 'solar' : 'void');
        const narrow = (window.innerWidth || 900) < 560;
        if (st.turnLimit) {
          pill.textContent = narrow
            ? 'Round ' + st.turn + '/' + st.turnLimit
            : 'Round ' + st.turn + '/' + st.turnLimit + ' · ' + U.FACTIONS[owner].short;
        } else {
          pill.textContent = 'Round ' + st.turn + (narrow ? '' : ' · ' + U.FACTIONS[owner].short);
        }
        const bits = [];
        if (st.turnLimit) bits.push(roundsLeft + ' rounds left');
        if (E.hasRotation(st)) bits.push((board().kind === 'hex' ? 'lotus' : 'chakra') + ' turns in ' + E.turnsUntilRotation(st));
        else if (hour) bits.push('sky turns in ' + E.roundsUntilHourTurns(st));
        const who = isPass()
          ? U.FACTIONS[owner].name + ' to move'
          : (owner === 1 ? 'Your move' : oppName(st) + ' is moving');
        sub.textContent = who + (bits.length ? ' · ' + bits.join(' · ') : '');
      }
    } else {
      pill.classList.add('gold');
      pill.textContent = st.winner === 0 ? 'The field is shared' : (st.winner === 1 ? 'Suryavansh victory' : 'Chandravansh victory');
      sub.textContent = 'Match complete — all ranks revealed.';
    }

    const timerOn = st.config.timer > 0 && st.phase === 'battle' && !g.thinking;
    clock.classList.toggle('hidden', !timerOn);
    if (timerOn) {
      clock.textContent = formatClock(g.timeLeft);
      clock.classList.toggle('warn', g.timeLeft <= 10);
    }
  }

  function formatClock(sec) {
    const s = Math.max(0, Math.round(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function aliveCount(owner) {
    let n = 0;
    E.forEachUnit(g.state, function (u) { if (u.owner === owner) n++; });
    return n;
  }

  /* Five lamps: lit ones are Shakti in hand. */
  function diyas(owner) {
    const st = g.state;
    if (!E.rules(st).astras) return '';
    const n = (st.shakti && st.shakti[owner]) || 0;
    let out = '<span class="diyas" title="Shakti ' + n + ' of 5">';
    for (let i = 0; i < E.SHAKTI_MAX; i++) {
      out += '<span class="diya' + (i < n ? ' lit' : '') + '">' + A.icon('diya') + '</span>';
    }
    return out + '</span>';
  }

  function renderStrips() {
    const st = g.state;
    const topLabel = 'Chandravansh · ' + (st.config.mode === 'ai' ? oppName(st) : 'Commander 2');
    const botLabel = 'Suryavansh · ' + (st.config.mode === 'ai' ? (AC.app.profile ? AC.app.profile.name : 'You') : 'Commander 1');

    $('#strip-top').className = 'player-strip' + (st.phase === 'battle' && st.owner === 2 ? ' active-void' : '');
    $('#strip-bottom').className = 'player-strip' + (st.phase === 'battle' && st.owner === 1 ? ' active-solar' : '') +
      (st.phase === 'deploy1' ? ' active-solar' : '');

    $('#strip-top').innerHTML = A.banner(2) +
      '<span class="strip-name" style="color:var(--void)">' + esc(topLabel) + '</span>' +
      '<span class="strip-count">' + aliveCount(2) + '/' + E.rosterOf(st, 2).length + '</span>' + diyas(2) + captureTray(2);
    $('#strip-bottom').innerHTML = A.banner(1) +
      '<span class="strip-name" style="color:var(--solar)">' + esc(botLabel) + '</span>' +
      '<span class="strip-count">' + aliveCount(1) + '/' + E.rosterOf(st, 1).length + '</span>' + diyas(1) + captureTray(1);
  }

  function captureTray(victimOwner) {
    const byOther = victimOwner === 2 ? 1 : 2;
    const dead = g.state.captured[byOther] || [];
    if (!dead.length) return '<span class="capture-tray"><span class="tray-empty">no losses</span></span>';
    return '<span class="capture-tray">' + dead.map(function (d) {
      const cls = d.owner === 1 ? 'solar' : 'void';
      return '<span class="capture-chip ' + cls + '" title="' + esc(d.name) + '">' + A.emblem(d.key) +
        '<span class="cap-rank">' + esc(d.badge) + '</span></span>';
    }).join('') + '</span>';
  }

  /* ── the board ─────────────────────────────────────────────── */

  function visibleToViewer(u) {
    if (!u) return false;
    const st = g.state;
    return st.viewer === 3 || u.owner === st.viewer || u.revealed;
  }

  function shapeSvg(cell, withTexture) {
    const geo = function (cls) {
      if (cell.shape === 'hub') return '<circle class="' + cls + '" cx="0" cy="0" r="' + cell.r + '"/>';
      if (cell.shape === 'sector') return '<path class="' + cls + '" d="' + cell.path + '"/>';
      return '<polygon class="' + cls + '" points="' + cell.points.map(function (p) {
        return p[0].toFixed(2) + ',' + p[1].toFixed(2);
      }).join(' ') + '"/>';
    };
    return geo('cell-fill') + (withTexture ? geo('cell-tex') : '');
  }

  function statusMarks(u, R) {
    let out = '';
    if (u.stun > 0) {
      out += '<g class="tok-trance"><circle r="' + (R * 1.12) + '"/>' +
        '<path d="M0 ' + (-R * 0.95) + ' A' + (R * 0.95) + ' ' + (R * 0.95) + ' 0 1 1 ' + (-R * 0.6) + ' ' + (R * 0.74) + '"/></g>' +
        (u.stun <= 9 ? '<text class="tok-stun" x="' + (-R * 0.62) + '" y="' + (-R * 0.5) + '" font-size="' + (R * 0.5) + '" text-anchor="middle">' + u.stun + '</text>' : '');
    }
    if (u.key === 'F' && u.breached) {
      out += '<g class="tok-crack"><path d="M' + (-R * 0.2) + ' ' + (-R * 0.9) + ' L' + (R * 0.08) + ' ' + (-R * 0.3) + ' L' + (-R * 0.16) + ' ' + (R * 0.1) +
        ' L' + (R * 0.22) + ' ' + (R * 0.85) + '"/><circle r="' + (R * 1.1) + '"/></g>';
    }
    return out;
  }

  function tokenSvg(u, cell, isSel) {
    const R = cell.tr;
    const cls = u.owner === 1 ? 'solar' : 'void';
    const moved = u.hasMoved ? '<circle class="tok-moved" cx="' + (-R * 0.62) + '" cy="' + (R * 0.62) + '" r="' + (R * 0.14) + '"/>' : '';
    const extra = (u.stun > 0 ? ' entranced' : '') + (u.key === 'F' && u.breached ? ' breached' : '');
    if (!visibleToViewer(u)) {
      const back = A.artFor('faction:' + u.owner);
      const face = back
        ? '<image class="tok-crest" href="' + back + '" x="' + (-R * 0.74) + '" y="' + (-R * 0.74) + '" width="' + (R * 1.48) +
          '" height="' + (R * 1.48) + '" opacity="0.95" preserveAspectRatio="xMidYMid meet"/>' +
          '<text class="tok-rank" x="' + (R * 0.46) + '" y="' + (R * 0.74) + '" font-size="' + (R * 0.52) +
          '" text-anchor="middle">?</text>'
        : '<text class="tok-q" y="' + (R * 0.33) + '" font-size="' + (R * 0.92) + '" text-anchor="middle">?</text>';
      return '<g class="token hidden-unit ' + cls + extra + '" data-uid="' + u.id + '" transform="translate(' + cell.x + ',' + cell.y + ')">' +
        '<circle class="tok-disc" r="' + R + '"/>' + face + moved + statusMarks(u, R) + '</g>';
    }
    const sel = isSel ? '<circle class="sel-ring" r="' + (R * 1.14) + '"/>' : '';
    const eye = (u.revealed && u.owner === g.state.viewer && g.state.phase !== 'over')
      ? '<circle class="tok-eye" cx="' + (R * 0.6) + '" cy="' + (-R * 0.6) + '" r="' + (R * 0.15) + '"/>' : '';
    return '<g class="token ' + cls + extra + (isSel ? ' selected-token' : '') + (u.shieldBroken ? ' shield-broken' : '') +
      '" data-uid="' + u.id + '" transform="translate(' + cell.x + ',' + cell.y + ')">' +
      '<circle class="tok-disc" r="' + R + '"/>' +
      sel +
      A.tokenInner(u.key, R) +
      '<text class="tok-rank" x="' + (R * 0.46) + '" y="' + (R * 0.74) + '" font-size="' + (R * 0.52) + '" text-anchor="middle">' +
      esc(u.badge) + '</text>' +
      moved + eye + statusMarks(u, R) + '</g>';
  }

  function targetMarker(type, R) {
    if (type === 'move') return '<circle class="target-dot" r="' + (R * 0.3) + '"/>';
    const glyph = type === 'attack' ? '×' : type === 'scan' ? '◉' : type === 'astra' ? '✦' : '⌖';
    return '<circle class="target-ring" r="' + (R * 1.0) + '"/>' +
      '<text class="target-glyph" y="' + (R * 0.34) + '" font-size="' + (R * 1.05) + '" text-anchor="middle">' + glyph + '</text>';
  }

  /* A small odds tag above a strike target: the chance this blow succeeds. */
  function oddsTag(cell, odds, armed) {
    if (!odds) return '';
    const good = odds.win + odds.core + odds.breach;
    const pct = Math.round(good * 100);
    const tone = pct >= 60 ? 'good' : pct >= 35 ? 'even' : 'bad';
    const R = cell.tr;
    const w = R * (armed ? 2.6 : 1.7);
    const h = R * 0.62;
    const y = cell.y - R * 1.55;
    const label = armed ? pct + '% · tap again' : pct + '%';
    return '<g class="odds-tag ' + tone + (armed ? ' armed' : '') + '" transform="translate(' + cell.x + ',' + y + ')">' +
      '<rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '"/>' +
      '<text y="' + (h * 0.18) + '" font-size="' + (h * 0.56) + '" text-anchor="middle">' + label + '</text></g>';
  }

  function currentTargets() {
    const st = g.state;
    const out = {};
    if (st.phase !== 'battle' || g.thinking) return out;
    if (g.mode === 'astra' && g.astra) {
      if (g.astra === 'vayavya' && !g.astraFirst) {
        E.astraTargets(st, st.owner, 'vayavya').forEach(function (id) { out[id] = 'pick'; });
      } else {
        E.astraTargets(st, st.owner, g.astra, g.astraFirst).forEach(function (id) { out[id] = 'astra'; });
      }
      return out;
    }
    if (g.sel) {
      E.computeValidTargets(st, g.sel, g.mode).forEach(function (t) { out[t.id] = t.type; });
    }
    return out;
  }

  function renderBoard() {
    const st = g.state;
    const svg = $('#board');
    if (!svg) return;
    const b = board();
    const bounds = b.bounds;
    svg.setAttribute('viewBox', bounds.x + ' ' + bounds.y + ' ' + bounds.w + ' ' + bounds.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // the field takes the colour of the hour
    const shell = $('#board-shell');
    if (shell) {
      const hour = st.phase === 'battle' ? E.hourOf(st) : null;
      shell.classList.toggle('sky-day', hour === 'day');
      shell.classList.toggle('sky-night', hour === 'night');
      shell.classList.toggle('astra-mode', g.mode === 'astra');
      // a painted sky behind the field, when the art exists (docs/prompts/ART.md)
      const skyArt = hour ? A.artFor('sky:' + hour) : null;
      shell.style.backgroundImage = skyArt
        ? 'linear-gradient(180deg, rgba(6,5,10,.45), rgba(6,5,10,.72)), url("' + skyArt + '")'
        : '';
      shell.setAttribute('data-astra', g.mode === 'astra' && g.astra ? g.astra : '');
    }

    const targets = currentTargets();
    const viewer = viewerOf(st);
    const deployOwner = st.phase === 'deploy1' ? 1 : st.phase === 'deploy2' ? 2 : 0;
    const last = st.lastMove;
    let out = '';
    let tags = '';

    const tex = A.artFor('board:' + st.boardKey);
    if (tex) {
      out += '<defs><pattern id="af-tex" patternUnits="userSpaceOnUse" patternContentUnits="objectBoundingBox" ' +
        'x="0" y="0" width="1.15" height="1.15">' +
        '<image href="' + tex + '" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern></defs>';
    }

    // the yantra frame: rings, ticks and kolam dots around the chakra
    if (b.kind === 'wheel' || b.kind === 'hex') {
      const R0 = Math.min(bounds.w, bounds.h) / 2 - (b.kind === 'hex' ? 0.12 : 0.05);
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const n = b.kind === 'hex' ? 6 : 12;
      let y = '<g class="yantra" aria-hidden="true" transform="translate(' + cx.toFixed(3) + ',' + cy.toFixed(3) + ')">';
      [1.02, 1.07, 1.14].forEach(function (f) {
        y += '<circle cx="0" cy="0" r="' + (R0 * f).toFixed(3) + '"/>';
      });
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const long = i % 2 === 0;
        y += '<line x1="' + (Math.cos(a) * R0 * 1.02).toFixed(3) + '" y1="' + (Math.sin(a) * R0 * 1.02).toFixed(3) +
          '" x2="' + (Math.cos(a) * R0 * (long ? 1.07 : 1.045)).toFixed(3) + '" y2="' + (Math.sin(a) * R0 * (long ? 1.07 : 1.045)).toFixed(3) + '"/>';
        if (long) {
          y += '<circle class="dot" cx="' + (Math.cos(a) * R0 * 1.105).toFixed(3) + '" cy="' +
            (Math.sin(a) * R0 * 1.105).toFixed(3) + '" r="' + (R0 * 0.012).toFixed(3) + '"/>';
        }
      }
      y += '</g>';
      out += y;
    }
    const rings = { 1: '', 2: '' };

    b.cells.forEach(function (cell) {
      const id = cell.id;
      const u = st.board[id] || null;
      const rift = E.isRift(st, id);
      const isSel = g.sel === id || g.astraFirst === id;
      const isFocus = g.focus === id;
      const target = targets[id];
      const inZone = deployOwner && cell.zone === deployOwner;
      const isLast = last && (last.from === id || last.to === id);

      let cls = 'cell';
      if (cell.shape === 'hub' || (b.kind === 'hex' && cell.ring === 0)) cls += ' hub';
      if (rift) cls += ' rift';
      if (inZone) cls += ' zone-' + deployOwner;
      if (isSel) cls += ' selected';
      if (isFocus && !isSel) cls += ' hint';
      if (isLast) cls += ' last-move';
      if (target) cls += ' target-' + target;
      if (target === 'astra' || target === 'pick') cls += ' astra-' + g.astra;
      if (g.armed === id) cls += ' armed';

      const label = rift ? 'rift'
        : u ? (visibleToViewer(u) ? u.name + ', rank ' + u.badge : 'unknown enemy piece')
          : 'empty cell';

      let hubArt = '';
      if (cell.shape === 'hub') {
        const icon = A.artFor('app');
        if (icon) {
          hubArt = '<image href="' + icon + '" x="' + (-cell.r * 0.72) + '" y="' + (-cell.r * 0.72) +
            '" width="' + (cell.r * 1.44) + '" height="' + (cell.r * 1.44) + '" opacity="1" preserveAspectRatio="xMidYMid meet"/>';
        }
      }
      const markerType = target === 'pick' ? 'astra' : target;
      const markup = '<g class="' + cls + '" data-id="' + id + '" tabindex="0" role="gridcell" aria-label="' + esc(label) + '">' +
        shapeSvg(cell, !!tex) + hubArt +
        (u ? tokenSvg(u, cell, isSel) : '') +
        (markerType && (markerType !== 'move' || !u) ? '<g transform="translate(' + cell.x + ',' + cell.y + ')">' + targetMarker(markerType, cell.tr) + '</g>' : '') +
        '</g>';
      if (cell.ring === 1 || cell.ring === 2) rings[cell.ring] += markup;
      else out += markup;

      // odds over every strike target
      if (g.sel && u && (target === 'attack' || target === 'barrage') && u.owner !== st.owner) {
        tags += oddsTag(cell, E.strikeOdds(st, viewer, g.sel, id, target === 'barrage'), g.armed === id);
      } else if (g.armed === id && (target === 'astra')) {
        const R = cell.tr;
        tags += '<g class="odds-tag even armed" transform="translate(' + cell.x + ',' + (cell.y - R * 1.55) + ')">' +
          '<rect x="' + (-R * 1.6) + '" y="' + (-R * 0.31) + '" width="' + (R * 3.2) + '" height="' + (R * 0.62) + '" rx="' + (R * 0.31) + '"/>' +
          '<text y="' + (R * 0.11) + '" font-size="' + (R * 0.35) + '" text-anchor="middle">tap again to invoke</text></g>';
      }
    });
    // the inner rings live in their own groups so the wheel can turn
    if (rings[2]) out += '<g class="ring ring-2">' + rings[2] + '</g>';
    if (rings[1]) out += '<g class="ring ring-1">' + rings[1] + '</g>';

    // formation links from the last clash: the jaws, the petals
    if (g.links && Date.now() < g.links.until) {
      const to = b.byId[g.links.to];
      if (to) {
        (g.links.jaws || []).forEach(function (j) {
          const c = b.byId[j];
          if (c) out += '<line class="vyuha-link jaws" x1="' + c.x + '" y1="' + c.y + '" x2="' + to.x + '" y2="' + to.y + '"/>';
        });
        (g.links.petals || []).forEach(function (j) {
          const c = b.byId[j];
          if (c) out += '<line class="vyuha-link petals" x1="' + c.x + '" y1="' + c.y + '" x2="' + to.x + '" y2="' + to.y + '"/>';
        });
      }
    }
    out += tags;

    (b.labels || []).forEach(function (l) {
      if (settings().coordinates === false) return;
      out += '<text class="coord" x="' + l.x + '" y="' + l.y + '" font-size="0.3" text-anchor="' + (l.anchor || 'middle') +
        '" dominant-baseline="' + (l.baseline || 'auto') + '">' + l.text + '</text>';
    });

    // Parse through an HTML <template>: the HTML parser understands SVG
    // foreign content, creates the right namespace, and tolerates the repeated
    // presentation attributes our emblem art uses.
    const tpl = document.createElement('template');
    tpl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + out + '</svg>';
    const parsed = tpl.content.firstElementChild;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (parsed) {
      while (parsed.firstChild) svg.appendChild(parsed.firstChild);
    }
  }

  /* ── action bar ────────────────────────────────────────────── */

  function astraButtons(owner) {
    const st = g.state;
    if (!E.rules(st).astras) return '';
    return '<span class="astra-row">' + E.ASTRA_ORDER.map(function (key) {
      const def = U.ASTRA_DEFS[key];
      const used = st.astrasUsed[owner] && st.astrasUsed[owner][key];
      const ready = E.astraReady(st, owner, key);
      const cls = used ? 'spent' : ready ? 'ready' : 'locked';
      let pips = '';
      for (let i = 0; i < def.cost; i++) pips += '<i></i>';
      return '<button class="astra-btn ' + cls + ' el-' + def.element + '" data-astra="' + key + '"' +
        ' title="' + esc(def.name + ' — ' + def.one + ' Costs ' + def.cost + ' Shakti' + (used ? ' (used)' : '')) + '"' +
        ' aria-label="' + esc(def.name) + '"' + (used ? ' disabled' : '') + '>' +
        A.astraMark(key) + '<span class="astra-cost">' + pips + '</span></button>';
    }).join('') + '</span>';
  }

  function renderActionBar() {
    const st = g.state;
    const bar = $('#action-bar');
    if (!bar) return;

    if (st.phase === 'deploy1' || st.phase === 'deploy2') {
      const owner = st.phase === 'deploy1' ? 1 : 2;
      const formations = S.listFormations().filter(function (f) { return f.board === st.boardKey; });
      bar.innerHTML =
        '<div class="action-info">' +
          '<span class="sel-badge ' + (owner === 1 ? 'solar' : 'void') + '">' + A.icon('grid') + '</span>' +
          '<span class="sel-text"><span class="sel-name">' + U.FACTIONS[owner].name + ' · vyuha rachna</span>' +
          '<span class="sel-desc">Tap two cells in your ground to swap them. Presets are a starting point.</span></span>' +
        '</div>' +
        '<div class="action-buttons">' +
          presetBtn('citadel', 'Durg') + presetBtn('blitz', 'Aakraman') + presetBtn('lattice', 'Jaal') + presetBtn('shuffle', 'Shuffle') +
          (formations.length ? '<button class="mode-btn" data-formation="1">' + A.icon('folder') + 'Saved</button>' : '') +
          '<button class="mode-btn" data-deploy="save">' + A.icon('save') + 'Keep</button>' +
          '<button class="btn btn-primary btn-sm" data-deploy="lock">' + (st.phase === 'deploy1' && isPass() ? 'Lock &amp; pass' : 'Lock formation') + '</button>' +
        '</div>';
      return;
    }

    if (st.phase === 'over') {
      bar.innerHTML =
        '<div class="action-info"><span class="sel-text"><span class="sel-name">Match complete</span>' +
        '<span class="sel-desc">All ranks are revealed. Review the board, or fight again.</span></span></div>' +
        '<div class="action-buttons">' +
          '<button class="mode-btn" data-over="codex">' + A.icon('book') + 'Codex</button>' +
          '<button class="mode-btn" data-over="home">' + A.icon('back') + 'Home</button>' +
          (modeHook('noRematch') ? '' : '<button class="btn btn-primary btn-sm" data-over="rematch">' + A.icon('refresh') + 'Rematch</button>') +
        '</div>';
      return;
    }

    const selUnit = g.sel ? st.board[g.sel] : null;
    const isHumanTurn = !g.thinking && (isPass() || st.owner === 1);
    let info;
    let buttons = '';

    if (isHumanTurn && g.mode === 'astra' && g.astra) {
      const def = U.ASTRA_DEFS[g.astra];
      const hint = g.astra === 'vayavya'
        ? (g.astraFirst ? 'Now tap the second piece to trade places with.' : 'Tap the first of your pieces to move.')
        : (g.armed ? 'Tap the target again to invoke.' : 'Tap a glowing target within two cells of your army.');
      info = '<span class="sel-badge astra el-' + def.element + '">' + A.astraMark(g.astra) + '</span>' +
        '<span class="sel-text"><span class="sel-name">' + esc(def.name) + ' <span class="deva">' + esc(def.deva) + '</span></span>' +
        '<span class="sel-desc">' + esc(hint) + '</span></span>';
      buttons = '<button class="mode-btn" data-act="cancel-astra">' + A.icon('close') + 'Cancel</button>';
      bar.innerHTML = '<div class="action-info">' + info + '</div><div class="action-buttons">' + buttons + '</div>';
      return;
    }

    if (selUnit) {
      const def = U.UNIT_DEFS[selUnit.key];
      const trance = selUnit.stun > 0 ? ' Entranced for ' + selUnit.stun + ' more turn' + (selUnit.stun === 1 ? '' : 's') + '.' : '';
      info = '<span class="sel-badge ' + (selUnit.owner === 1 ? 'solar' : 'void') + '">' + A.emblem(selUnit.key) + '</span>' +
        '<span class="sel-text"><span class="sel-name">' + esc(selUnit.name) + ' · rank ' + esc(selUnit.badge) + '</span>' +
        '<span class="sel-desc">' + esc(g.armed ? 'Tap the target again to strike.' : def.desc + trance) + '</span></span>';
    } else {
      info = '<span class="sel-badge">' + A.icon('sword') + '</span>' +
        '<span class="sel-text"><span class="sel-name">' + (isHumanTurn ? 'Your move' : 'Waiting') + '</span>' +
        '<span class="sel-desc">' + (isHumanTurn
          ? 'Tap a piece, then a glowing cell. Or invoke an astra.'
          : oppName(st) + ' is choosing a move.') + '</span></span>';
    }

    if (isHumanTurn) {
      if (selUnit) {
        buttons += '<button class="mode-btn' + (g.mode === 'move' ? ' on' : '') + '" data-mode="move">' + A.icon('sword') + 'Move / Strike</button>';
        const def = U.UNIT_DEFS[selUnit.key];
        if (def.hasScan) buttons += '<button class="mode-btn special' + (g.mode === 'special' ? ' on' : '') + '" data-mode="special">' + A.icon('eye') + 'Drishti</button>';
        if (def.hasRanged) buttons += '<button class="mode-btn special' + (g.mode === 'special' ? ' on' : '') + '" data-mode="special">' + A.icon('bolt') + 'Volley</button>';
        buttons += '<button class="mode-btn" data-act="deselect" aria-label="Deselect">' + A.icon('close') + '</button>';
      } else {
        buttons += astraButtons(st.owner);
      }
      buttons += '<button class="mode-btn" data-act="advisor">' + A.icon('brain') + 'Advisor</button>';
    }
    bar.innerHTML = '<div class="action-info">' + info + '</div><div class="action-buttons">' + buttons + '</div>';
  }

  function presetBtn(key, label) {
    return '<button class="mode-btn" data-preset="' + key + '">' + label + '</button>';
  }

  /* ── intel ─────────────────────────────────────────────────── */

  function renderIntel() {
    const host = $('#intel-panel');
    if (!host) return;
    const st = g.state;
    if (st.viewer === 0) {
      host.innerHTML = '<div class="intel-head"><span class="intel-title">Intel</span></div>' +
        '<p class="intel-note">Sealed by the privacy curtain.</p>';
      return;
    }
    if (settings().showIntel === false || st.phase === 'over') {
      host.innerHTML = '<div class="intel-head"><span class="intel-title">Intel</span></div>' +
        '<p class="intel-note">' + (st.phase === 'over' ? 'The match is over — every rank is on the board.' : 'Intel panel is hidden in settings.') + '</p>';
      return;
    }

    const viewer = viewerOf(st);
    const foe = viewer === 1 ? 2 : 1;
    const pool = E.unknownPool(st, viewer);
    const unknowns = Object.keys(pool).filter(function (k) { return pool[k] > 0; });

    const known = [];
    const exposed = [];
    E.forEachUnit(st, function (u) {
      if (u.owner === foe && u.revealed) known.push(u);
      if (u.owner === viewer && u.revealed) exposed.push(u);
    });

    let html = '<div class="intel-head"><span class="intel-title">Intel</span>' +
      '<span class="chip chip-' + (viewer === 1 ? 'solar' : 'void') + '">' + U.FACTIONS[foe].short + '</span></div>';

    const odds = oddsBlock();
    if (odds) html += odds;

    // the hour, the formations, the strength
    if (st.phase === 'battle') {
      const hour = E.hourOf(st);
      if (hour) {
        const mine = E.hourOwner(st) === viewer;
        const left = E.roundsUntilHourTurns(st);
        html += '<div class="intel-section"><div class="intel-label">The sky</div>' +
          '<div class="intel-sky ' + hour + '">' + skyIcon(hour) + '<span><b>' + (hour === 'day' ? 'Dinman · दिनमान' : 'Ratri · रात्रि') + '</b>' +
          (mine ? 'Your hour: your strikes land at +1.' : 'Their hour: their strikes land at +1.') +
          ' Turns in ' + left + ' round' + (left === 1 ? '' : 's') + '.</span></div></div>';
      }
      if (E.rules(st).vyuha) {
        html += '<div class="intel-section"><div class="intel-label">Formations</div>' +
          '<p class="intel-note"><b>Makara</b> — strike a piece another of yours already touches: +1.<br><b>Padma</b> — a piece touched by two friends defends at +1.</p></div>';
      }
      if (E.rules(st).astras) {
        html += '<div class="intel-section"><div class="intel-label">Shakti</div>' +
          '<div class="odds-row"><span style="color:var(--solar)">' + U.FACTIONS[1].short + '</span>' +
          '<span class="odds-bar"><span style="width:' + (st.shakti[1] * 20) + '%;background:var(--solar)"></span></span><span class="odds-val">' + st.shakti[1] + '/5</span></div>' +
          '<div class="odds-row"><span style="color:var(--void)">' + U.FACTIONS[2].short + '</span>' +
          '<span class="odds-bar"><span style="width:' + (st.shakti[2] * 20) + '%;background:var(--void)"></span></span><span class="odds-val">' + st.shakti[2] + '/5</span></div>' +
          '<p class="intel-note">One per piece taken, one each time the sky turns.</p></div>';
      }
      const s1 = E.strengthOf(st, viewer);
      const s2 = E.strengthOf(st, foe);
      html += '<div class="intel-section"><div class="intel-label">Strength on the field (bala)</div>' +
        '<p class="intel-note">You <b style="color:var(--txt)">' + s1 + '</b> · They <b style="color:var(--txt)">' + s2 + '</b> — sum of ranks, +5 for a fort whose gate stands. It decides a ceasefire.</p></div>';
    }

    html += '<div class="intel-section"><div class="intel-label">Still hidden (' +
      unknowns.reduce(function (a, k) { return a + pool[k]; }, 0) + ' pieces)</div>' +
      '<div class="intel-chips">' +
      (unknowns.length
        ? unknowns.map(function (k) {
          return '<span class="intel-chip unknown" title="' + esc(U.UNIT_DEFS[k].name) + '">' + A.emblem(k) +
            esc(U.UNIT_DEFS[k].badge) + (pool[k] > 1 ? '×' + pool[k] : '') + '</span>';
        }).join('')
        : '<span class="intel-note">Every enemy piece is accounted for.</span>') +
      '</div></div>';

    if (known.length) {
      html += '<div class="intel-section"><div class="intel-label">Identified on the field</div><div class="intel-chips">' +
        known.map(function (u) {
          return '<span class="intel-chip" title="' + esc(U.UNIT_DEFS[u.key].name) + '">' + A.emblem(u.key) + esc(u.badge) + '</span>';
        }).join('') + '</div></div>';
    }
    if (exposed.length) {
      html += '<div class="intel-section"><div class="intel-label">Your exposed pieces</div><div class="intel-chips">' +
        exposed.map(function (u) {
          return '<span class="intel-chip" title="' + esc(U.UNIT_DEFS[u.key].name) + '">' + A.emblem(u.key) + esc(u.badge) + '</span>';
        }).join('') + '</div><p class="intel-note">These ranks are known to the enemy.</p></div>';
    }

    if (st.phase === 'battle') {
      const left = E.drawCountdown(st);
      const limit = st.config.drawAfter || 100;
      html += '<div class="intel-section"><div class="intel-label">Ceasefire clock</div>' +
        '<div class="odds-row"><span style="color:var(--dim)">Orders left</span>' +
        '<span class="odds-bar"><span style="width:' + Math.round((left / limit) * 100) + '%;background:' +
        (left <= 10 ? 'var(--void)' : 'linear-gradient(90deg,var(--solar),var(--green))') + '"></span></span>' +
        '<span class="odds-val">' + left + '</span></div>' +
        '<p class="intel-note">If no piece falls for ' + limit + ' orders, or the sun sets on round ' + capOf(st) + ', the stronger army holds the field.</p></div>';

      if (E.hasRotation(st)) {
        const until = E.turnsUntilRotation(st);
        html += '<div class="intel-section"><div class="intel-label">The ' + (board().kind === 'hex' ? 'lotus' : 'chakra') + '</div>' +
          '<p class="intel-note">The two inner rings turn one cell every 5 rounds, carrying whatever stands on them — and exposing it. Turns in <b style="color:var(--gold)">' +
          until + '</b>.</p></div>';
      }
    }

    html += '<div class="intel-section">' +
      '<button class="mode-btn" data-act="advisor" style="width:100%;justify-content:center">' + A.icon('brain') + 'Ask the advisor</button>' +
      '<p class="intel-note">Odds are averaged over every rank the enemy could still be hiding, and include the hour and the formations. A piece that has moved can no longer be a fort or a trap.</p>' +
      '</div>';

    host.innerHTML = html;
  }

  function capOf(st) {
    if (st.turnLimit) return st.turnLimit;
    if (st.config.roundCap) return st.config.roundCap;
    return (U.BOARDS[st.boardKey] && U.BOARDS[st.boardKey].roundCap) || 40;
  }

  function oddsBlock() {
    const st = g.state;
    const viewer = viewerOf(st);
    const selUnit = g.sel ? st.board[g.sel] : null;
    const focusId = g.armed || g.focus;
    const focus = focusId ? st.board[focusId] : null;
    if (!focus || focus.owner === viewer) return '';

    if (selUnit && selUnit.owner === viewer && g.mode !== 'astra') {
      const isBarrage = g.mode === 'special' && U.UNIT_DEFS[selUnit.key].hasRanged;
      const o = E.strikeOdds(st, viewer, g.sel, focusId, isBarrage);
      if (!o) return '';
      const rows = [];
      if (o.core > 0.001) rows.push(['Take fort', o.core, 'var(--gold)']);
      if (o.breach > 0.001) rows.push(['Break gate', o.breach, 'var(--gold)']);
      if (o.win > 0.001) rows.push(['You win', o.win, 'var(--green)']);
      if (o.both > 0.001) rows.push(['Both fall', o.both, 'var(--gold)']);
      if (o.lose > 0.001) rows.push(['You lose', o.lose, 'var(--void)']);
      if (o.noop > 0.001) rows.push(['No effect', o.noop, 'var(--dim)']);
      const parts = (o.ctx.attParts || []).map(function (p) { return '+' + p.v + ' ' + p.key; })
        .concat((o.ctx.defParts || []).map(function (p) { return 'them +' + p.v + ' ' + p.key; }));
      return '<div class="intel-section"><div class="intel-label">' + (isBarrage ? 'Volley odds' : 'Strike odds') +
        ' · ' + esc(selUnit.short) + ' → ' + (focus.revealed ? esc(focus.name) : 'unknown') + '</div><div class="intel-odds">' +
        rows.map(function (r) {
          return '<div class="odds-row"><span style="color:' + r[2] + '">' + r[0] + '</span>' +
            '<span class="odds-bar"><span style="width:' + Math.round(r[1] * 100) + '%"></span></span>' +
            '<span class="odds-val">' + Math.round(r[1] * 100) + '%</span></div>';
        }).join('') + '</div>' +
        (parts.length ? '<div class="intel-note">Bonuses: ' + esc(parts.join(' · ')) + '</div>' : '') +
        (focus.revealed ? '' : '<div class="intel-note">It could be: ' + topBeliefs(st, viewer, focusId) + '</div>') +
        '</div>';
    }

    if (!focus.revealed) {
      const dist = E.beliefFor(st, viewer, focusId);
      if (!dist) return '';
      return '<div class="intel-section"><div class="intel-label">Tapped piece — what it could be</div>' +
        '<div class="intel-odds">' + Object.keys(dist).sort(function (a, b) { return dist[b] - dist[a]; })
          .slice(0, 4).map(function (k) {
            return '<div class="odds-row"><span>' + esc(U.UNIT_DEFS[k].short) + '</span>' +
              '<span class="odds-bar"><span style="width:' + Math.round(dist[k] * 100) + '%"></span></span>' +
              '<span class="odds-val">' + Math.round(dist[k] * 100) + '%</span></div>';
          }).join('') + '</div></div>';
    }
    return '';
  }

  function topBeliefs(st, viewer, id) {
    const dist = E.beliefFor(st, viewer, id) || {};
    const ranked = Object.keys(dist).sort(function (a, b) { return dist[b] - dist[a]; }).slice(0, 3);
    if (!ranked.length) return '';
    return ranked.map(function (k) {
      return U.UNIT_DEFS[k].short + ' ' + Math.round(dist[k] * 100) + '%';
    }).join(' · ');
  }

  function renderLog() {
    const host = $('#battle-log');
    if (!host) return;
    const st = g.state;
    if (!st.log.length) {
      host.innerHTML = '<div class="log-entry empty">No actions yet.</div>';
      return;
    }
    host.innerHTML = st.log.slice(-60).reverse().map(function (l) {
      return '<div class="log-entry kind-' + esc(l.kind) + '"><span class="log-turn">R' + l.turn + '</span>' + esc(l.text) + '</div>';
    }).join('');
  }

  /* ══ interaction ═══════════════════════════════════════════════ */

  function onCell(id) {
    const st = g.state;
    if (!st || g.busy) return;
    if (st.phase === 'over') { g.focus = id; renderIntel(); return; }

    if (st.phase === 'deploy1' || st.phase === 'deploy2') {
      const owner = st.phase === 'deploy1' ? 1 : 2;
      if (!E.inDeployZone(st, owner, id)) {
        FX.toast('Deploy inside your own ground.', 'warn');
        sfx('error');
        return;
      }
      const unit = st.board[id];
      if (unit && unit.owner !== owner) return;
      if (!g.sel) {
        g.sel = id;
        sfx('select');
      } else if (g.sel === id) {
        g.sel = null;
        sfx('deselect');
      } else if (E.swapSlots(st, owner, g.sel, id)) {
        sfx('swap');
        buzz(10);
        g.sel = null;
      }
      render();
      return;
    }

    if (g.thinking) return;
    const humanTurn = isPass() || st.owner === 1;
    if (!humanTurn) return;

    /* astra targeting */
    if (g.mode === 'astra' && g.astra) {
      onAstraCell(id);
      return;
    }

    // a highlighted target wins over everything else
    if (g.sel) {
      const hit = E.computeValidTargets(st, g.sel, g.mode).filter(function (t) { return t.id === id; })[0];
      if (hit) {
        commitAction(g.sel, id, hit.type);
        return;
      }
    }

    const unit = st.board[id];
    if (unit && unit.owner !== st.owner) {
      g.focus = id;
      g.armed = null;
      renderIntel();
      render();
      sfx('ui');
      return;
    }

    if (unit && unit.owner === st.owner) {
      g.armed = null;
      if (!E.isMovable(unit)) {
        FX.toast(unit.name + ' never moves — it holds that cell for the whole battle.', 'warn');
        sfx('error');
        g.sel = null;
        render();
        return;
      }
      if (unit.stun > 0) {
        FX.toast('Entranced — this piece cannot act for ' + unit.stun + ' more turn' + (unit.stun === 1 ? '' : 's') + '.', 'warn');
        sfx('error');
      }
      if (g.sel === id) {
        g.sel = null;
        sfx('deselect');
        render();
        return;
      }
      g.sel = id;
      g.mode = 'move';
      sfx('select');
      buzz(8);
      if (!g.hinted) {
        g.hinted = true;
        FX.toast('Gold dot = move. Ring = strike, with your odds above it.', 'info');
      }
      render();
      return;
    }

    g.sel = null;
    g.focus = null;
    g.armed = null;
    render();
  }

  /* Strikes on a hidden piece arm on the first tap and land on the second,
   * so a slip of the thumb never throws away a Senapati. */
  function commitAction(from, to, type) {
    const st = g.state;
    const target = st.board[to];
    const risky = (type === 'attack' || type === 'barrage') && target && settings().confirmActions !== false;
    if (risky && g.armed !== to) {
      g.armed = to;
      g.focus = to;
      sfx('arm');
      buzz(6);
      render();
      return;
    }
    g.armed = null;
    performAction({ from: from, to: to, type: type });
  }

  function enterAstra(key) {
    const st = g.state;
    if (!st || st.phase !== 'battle' || g.thinking) return;
    if (!E.astraReady(st, st.owner, key)) {
      const def = U.ASTRA_DEFS[key];
      const used = st.astrasUsed[st.owner] && st.astrasUsed[st.owner][key];
      FX.toast(used ? def.name + ' has already been used this match.' : def.name + ' needs ' + def.cost + ' Shakti — you have ' + st.shakti[st.owner] + '.', 'warn');
      sfx('error');
      return;
    }
    if (!E.astraTargets(st, st.owner, key).length) {
      FX.toast('No target in reach — astras strike within two cells of your army.', 'warn');
      sfx('error');
      return;
    }
    g.sel = null;
    g.armed = null;
    g.mode = 'astra';
    g.astra = key;
    g.astraFirst = null;
    sfx('select');
    render();
  }

  function cancelAstra() {
    g.mode = 'move';
    g.astra = null;
    g.astraFirst = null;
    g.armed = null;
    sfx('deselect');
    render();
  }

  function onAstraCell(id) {
    const st = g.state;
    const key = g.astra;
    if (key === 'vayavya' && !g.astraFirst) {
      if (E.astraTargets(st, st.owner, key).indexOf(id) === -1) { sfx('error'); return; }
      g.astraFirst = id;
      sfx('select');
      render();
      return;
    }
    const legal = E.astraTargets(st, st.owner, key, g.astraFirst);
    if (legal.indexOf(id) === -1) {
      if (key === 'vayavya' && id === g.astraFirst) { g.astraFirst = null; render(); return; }
      sfx('error');
      return;
    }
    if (g.armed !== id) {
      g.armed = id;
      sfx('arm');
      render();
      return;
    }
    const action = key === 'vayavya'
      ? { type: 'astra', astra: key, from: g.astraFirst, to: id }
      : { type: 'astra', astra: key, to: id };
    g.mode = 'move';
    g.astra = null;
    g.astraFirst = null;
    g.armed = null;
    performAction(action);
  }

  function cellCenter(id) {
    const el = document.querySelector('.cell[data-id="' + id + '"]');
    return FX.centerOf(el);
  }

  /* Which line Sanjaya says for a batch of events, from the point of view of
   * `me` (the human in an AI game; the acting side in pass & play). */
  function narrate(events, me, st) {
    const keys = [];
    events.forEach(function (ev) {
      if (ev.kind === 'clash') {
        const att = ev.unit;
        const def = ev.target;
        if (ev.core) keys.push(att.owner === me ? 'fort_won' : 'fort_lost');
        else if (ev.assassinate) keys.push('assassinate');
        else if (ev.mine) keys.push(ev.outcome === 'def' ? 'trap_hit' : 'trap_defused');
        else if (ev.outcome === 'att' && (ev.attParts || []).some(function (p) { return p.key === 'makara'; })) keys.push('makara');
        else if (ev.outcome === 'def' && (ev.defParts || []).length) keys.push('padma');
        else if (ev.shieldBreak) keys.push('shield_break');
        else if (ev.outcome === 'both') keys.push('both_fell');
        else if (ev.outcome === 'att') keys.push(att.owner === me ? 'win_capture' : 'lose_capture');
        else if (ev.outcome === 'def') keys.push(def.owner === me ? 'win_capture' : 'lose_capture');
      } else if (ev.kind === 'core') {
        keys.push(ev.unit && ev.unit.owner === me ? 'fort_won' : 'fort_lost');
      } else if (ev.kind === 'barrage') {
        keys.push(ev.kill ? 'volley_kill' : 'volley_turned');
      } else if (ev.kind === 'scan') {
        if (Math.random() < 0.5) keys.push('scan');
      } else if (ev.kind === 'breach') {
        keys.push(ev.target.owner === me ? 'breach_own' : 'breach_enemy');
      } else if (ev.kind === 'astra') {
        keys.push('astra_' + ev.astra + (ev.owner === me ? '' : '_enemy'));
      } else if (ev.kind === 'rotate') {
        keys.push(board().kind === 'hex' ? 'rotate_padma' : 'rotate');
      } else if (ev.kind === 'sky') {
        const mine = (ev.hour === 'day' ? 1 : 2) === me;
        keys.push(ev.hour === 'day' ? (mine ? 'dawn' : 'dawn_enemy') : (mine ? 'dusk' : 'dusk_enemy'));
      } else if (ev.kind === 'pass') {
        keys.push('entranced_pass');
      }
    });
    if (st.shakti && st.shakti[me] >= 5 && !g.said.shakti_full && E.rules(st).astras && !(st.astrasUsed[me] || {}).brahma) {
      g.said.shakti_full = true;
      keys.push('shakti_full');
    }
    if (st.phase === 'battle') {
      if (st.turnLimit && st.turnLimit - st.turn === 4) speakOnce('last_rounds');
      else if (!st.turnLimit && capOf(st) - st.turn === 3) speakOnce('sunset_near');
    }
    return keys;
  }

  function updateTension() {
    const st = g.state;
    if (!st || st.phase !== 'battle') { AU.setTension(0); return; }
    let level = 0;
    E.forEachUnit(st, function (u) { if (u.key === 'F' && u.breached) level = Math.max(level, 1); });
    if (st.turnLimit && st.turnLimit - st.turn <= 4) level = 2;
    else if (!st.turnLimit && capOf(st) - st.turn <= 3) level = Math.max(level, 1);
    AU.setTension(level);
    const shell = $('#board-shell');
    if (shell) shell.classList.toggle('tension', level > 0);
  }

  function shaktiChime(st) {
    if (!st.shakti || !g.lastShakti) return;
    [1, 2].forEach(function (o) {
      if (st.shakti[o] > (g.lastShakti[o] || 0) && (o === 1 || isPass())) sfx('shakti');
      g.lastShakti[o] = st.shakti[o];
    });
  }

  function performAction(action) {
    const st = g.state;
    const mover = action.from ? st.board[action.from] : null;
    const actor = st.owner;
    const moverWasAi = isAi() && actor === 2;
    g.busy = true;
    const res = E.applyAction(st, action);
    if (!res.ok) {
      g.busy = false;
      FX.toast(res.error || 'That action is not legal.', 'error');
      sfx('error');
      render();
      return;
    }
    resetSelection();
    stopClock();

    const me = isAi() ? 1 : actor;
    const at = action.to ? cellCenter(action.to) : FX.centerOf($('#board'));
    const beats = [];
    let rotated = false;
    let skyEv = null;

    res.events.forEach(function (ev) {
      if (ev.sfx) sfx(ev.sfx);
      if (ev.kind === 'rotate') {
        rotated = true;
        const c = FX.centerOf($('#board'));
        FX.burst(c.x, c.y, { count: 40, color: '#f2cf8b', speed: 6, size: 3 });
        FX.shake(8);
      }
      if (ev.kind === 'sky') skyEv = ev;
      if (ev.kind === 'clash' || ev.kind === 'barrage' || ev.kind === 'scan' || ev.kind === 'breach' || ev.kind === 'astra' || ev.kind === 'core') {
        beats.push(ev);
      }
      if (ev.kind === 'clash') {
        const win = ev.outcome === 'att';
        const color = win ? '#f2cf8b' : ev.outcome === 'def' ? '#8b8ff0' : '#c8452b';
        FX.burst(at.x, at.y, { count: win ? 26 : 20, color: color, speed: 4 });
        FX.shake(win ? 7 : 5);
        if ((ev.jaws && ev.jaws.length) || (ev.petals && ev.petals.length)) {
          g.links = { jaws: ev.attParts.some(function (p) { return p.key === 'makara'; }) ? ev.jaws : [], petals: ev.petals || [], to: ev.at, until: Date.now() + 2200 };
          setTimeout(function () { if (g.state === st) renderBoard(); }, 2300);
        }
      } else if (ev.kind === 'barrage') {
        FX.burst(at.x, at.y, { count: 22, color: ev.kill ? '#f2cf8b' : '#8b8ff0', speed: 5 });
        FX.shake(4);
      } else if (ev.kind === 'scan') {
        FX.spawn(at.x, at.y, { count: 26, color: '#b9a8ff', speed: 2.4, size: 3 });
      } else if (ev.kind === 'move') {
        FX.spawn(at.x, at.y, { count: 8, color: '#e0a94a', speed: 1.4, size: 1.8, gravity: 0.02 });
      } else if (ev.kind === 'breach') {
        FX.burst(at.x, at.y, { count: 34, color: '#c8452b', speed: 5 });
        FX.shake(10);
      }
    });

    shaktiChime(st);
    render();
    updateTension();
    if (rotated) spinRings();
    if (moverWasAi && !beats.length && mover) {
      FX.toast(oppName(st) + ' moved a ' + (mover.revealed ? mover.name : 'piece') + '.', 'info');
    }
    speak(narrate(res.events, me, st));
    modeHook('onEvents', { events: res.events, actor: actor, action: action });

    const finish = function () {
      g.busy = false;
      autosave();
      render();
      if (skyEv && ST) ST.sky(skyEv.hour, E.hourOwner(st) === viewerOf(st));
      if (st.phase === 'over') { handleGameOver(); return; }
      if (isAi() && st.owner === 2) scheduleAi();
      else if (isPass()) showCurtain(st.owner, 'battle');
      else banner('Your turn', U.FACTIONS[st.owner].deva + ' · round ' + st.turn, st.owner === 1 ? 'solar' : 'void');
      if (E.hasRotation(st) && st.phase === 'battle' && E.turnsUntilRotation(st) === 1 && g.warnedAt !== st.turn) {
        g.warnedAt = st.turn;
        FX.toast('The ' + (board().kind === 'hex' ? 'lotus' : 'chakra') + ' turns next round — the inner rings will shift and expose what they carry.', 'warn');
      }
      startClockIfNeeded();
    };

    playBeats(beats, me, finish);
  }

  /* Play the stage beats one after another, then carry on. */
  function playBeats(list, viewer, done) {
    if (!ST || !list.length || settings().cinematics === false) { done(); return; }
    const ev = list.shift();
    const next = function () { playBeats(list, viewer, done); };
    if (ev.kind === 'clash') ST.clash(ev, viewer, next);
    else if (ev.kind === 'barrage') ST.volley(ev, viewer, next);
    else if (ev.kind === 'scan') ST.scan(ev, viewer, next);
    else if (ev.kind === 'breach') ST.breach(ev, viewer, next);
    else if (ev.kind === 'astra') ST.astra(ev, viewer, next);
    else if (ev.kind === 'core') ST.clash(Object.assign({ outcome: 'att', core: true }, ev), viewer, next);
    else next();
  }

  /* ── AI turn ───────────────────────────────────────────────── */

  function scheduleAi() {
    if (g.aiTimer) clearTimeout(g.aiTimer);
    g.thinking = true;
    render();
    const diff = g.state.config.difficulty || 'veteran';
    const delay = (U.DIFFICULTIES[diff] || U.DIFFICULTIES.veteran).think + Math.random() * 260;
    g.aiTimer = setTimeout(function () {
      g.aiTimer = null;
      const st = g.state;
      if (!st || st.phase !== 'battle' || st.owner !== 2) { g.thinking = false; render(); return; }
      const act = AI.chooseAction(st, 2, diff, modeHook('aiRng'));
      g.thinking = false;
      if (!act) {
        render();
        if (st.phase === 'battle') {
          E.endGame(st, 1, 'Chandravansh has no legal action left.', []);
          handleGameOver();
        }
        return;
      }
      render();
      performAction(act);
    }, delay);
  }

  /* ── turn clock ────────────────────────────────────────────── */

  function startClockIfNeeded() {
    const st = g.state;
    if (!st) return;
    if (!st.config.timer || st.phase !== 'battle' || g.thinking) { stopClock(); return; }
    const humanTurn = isPass() || st.owner === 1;
    if (!humanTurn) { stopClock(); return; }
    if (g.timerId) return;
    if (!g.timeLeft || g.timeLeft <= 0) g.timeLeft = st.config.timer;
    g.timerId = setInterval(function () {
      g.timeLeft -= 1;
      const clock = document.getElementById('hud-clock');
      if (clock) {
        clock.textContent = formatClock(g.timeLeft);
        clock.classList.toggle('warn', g.timeLeft <= 10);
      }
      if (g.timeLeft <= 5 && g.timeLeft > 0) sfx('tick');
      if (g.timeLeft <= 0) { stopClock(); autoMoveOnTimeout(); }
    }, 1000);
  }

  function stopClock() {
    if (g.timerId) { clearInterval(g.timerId); g.timerId = null; }
    g.timeLeft = g.state && g.state.config.timer ? g.state.config.timer : 0;
  }

  function autoMoveOnTimeout() {
    const st = g.state;
    if (!st || st.phase !== 'battle') return;
    const act = AI.chooseAction(st, st.owner, 'veteran');
    if (!act) return;
    FX.toast('Time — the advisor played your best move.', 'warn');
    sfx('warn');
    resetSelection();
    performAction(act);
  }

  /* ── privacy curtain ──────────────────────────────────────── */

  function showCurtain(nextOwner, kind) {
    const st = g.state;
    st.viewer = 0;
    render();
    const isDeploy = kind === 'deploy';
    const title = isDeploy ? 'Pass to ' + U.FACTIONS[nextOwner].name : 'Pass to ' + U.FACTIONS[nextOwner].short + ' — round ' + st.turn;
    const sub = isDeploy
      ? 'The previous commander has locked their formation. Hand the device over before continuing.'
      : 'Hide the screen from your opponent, then hand over the device.';

    const overlay = document.createElement('div');
    overlay.className = 'curtain';
    overlay.innerHTML =
      '<div class="curtain-card">' +
        '<div class="curtain-icon">' + A.icon('lock') + '</div>' +
        '<div class="curtain-count">PARDA · पर्दा</div>' +
        '<div class="curtain-title">' + esc(title) + '</div>' +
        '<div class="curtain-sub">' + esc(sub) + '</div>' +
        '<button class="btn btn-gold" id="curtain-go">I am ' + esc(U.FACTIONS[nextOwner].short) + ' — reveal</button>' +
      '</div>';
    document.body.appendChild(overlay);
    sfx('curtain');
    const reveal = function () {
      overlay.remove();
      st.viewer = nextOwner;
      render();
      startClockIfNeeded();
      sfx('unlock');
      if (kind !== 'deploy') {
        banner('Your turn', U.FACTIONS[nextOwner].deva + ' · round ' + st.turn, nextOwner === 1 ? 'solar' : 'void');
      }
    };
    overlay.querySelector('#curtain-go').addEventListener('click', reveal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) reveal(); });
  }

  /* ── deployment actions ──────────────────────────────────── */

  const PRESET_NAMES = { citadel: 'Durg (guard the fort)', blitz: 'Aakraman (strike first)', lattice: 'Jaal (the net)', shuffle: 'Shuffle' };

  function deployPreset(style) {
    const st = g.state;
    const owner = st.phase === 'deploy1' ? 1 : 2;
    E.deployPreset(st, owner, style);
    g.sel = null;
    sfx('deploy');
    render();
    FX.toast((PRESET_NAMES[style] || style) + ' formation applied.', 'info');
  }

  function lockFormation() {
    const st = g.state;
    if (st.phase === 'deploy1') {
      if (!E.armyComplete(st, 1)) { FX.toast('Your army is not complete.', 'error'); return; }
      sfx('lock');
      if (isPass()) {
        st.phase = 'deploy2';
        autosave();
        showCurtain(2, 'deploy');
      } else {
        E.beginBattle(st);
        sfx('shankh');
        render();
        banner(st.turnLimit ? 'The breach begins' : 'Yuddh aarambh',
          (st.turnLimit ? st.turnLimit + ' rounds to take the fort' : 'break the gate, take the fort'), 'gold', 1600);
        autosave();
        startClockIfNeeded();
      }
      return;
    }
    if (st.phase === 'deploy2') {
      if (!E.armyComplete(st, 2)) { FX.toast('Your army is not complete.', 'error'); return; }
      sfx('lock');
      E.beginBattle(st);
      sfx('shankh');
      render();
      autosave();
      if (isPass()) showCurtain(1, 'battle');
      startClockIfNeeded();
    }
  }

  function keepFormation() {
    const st = g.state;
    const owner = st.phase === 'deploy1' ? 1 : 2;
    const map = {};
    board().zones[owner].forEach(function (id) {
      const u = st.board[id];
      if (u && u.owner === owner) map[id] = u.key;
    });
    AC.ui.promptText({ kicker: 'Formation', title: 'Save this formation', label: 'Formation name', value: 'My vyuha' })
      .then(function (name) {
        if (!name) return;
        S.saveFormation(name, map, st.boardKey);
        FX.toast('Formation saved.', 'success');
        sfx('save');
        render();
      });
  }

  function applySavedFormation() {
    const st = g.state;
    const owner = st.phase === 'deploy1' ? 1 : 2;
    const list = S.listFormations().filter(function (f) { return f.board === st.boardKey; });
    if (!list.length) { FX.toast('No saved formations for this board.', 'warn'); return; }
    const m = AC.ui.modal({
      kicker: 'Formations',
      title: 'Load a formation',
      body: '<div class="save-list">' + list.map(function (f, i) {
        return '<div class="save-card"><div class="save-info"><div class="save-title">' + esc(f.name) + '</div>' +
          '<div class="save-meta">' + (U.BOARDS[f.board] || U.BOARDS.small).label + ' · saved ' + AC.ui.timeAgo(f.createdAt) + '</div></div>' +
          '<div class="save-actions"><button class="btn btn-primary btn-xs" data-use="' + i + '">Use</button>' +
          '<button class="btn btn-danger btn-xs" data-drop="' + i + '">' + A.icon('trash') + '</button></div></div>';
      }).join('') + '</div>',
      actions: [{ label: 'Close', cls: 'btn-ghost' }]
    });
    m.el.addEventListener('click', function (e) {
      const use = e.target.closest('[data-use]');
      const drop = e.target.closest('[data-drop]');
      if (use) {
        const f = list[Number(use.getAttribute('data-use'))];
        if (f) { applyLayout(f.layout, owner); m.close(); }
      } else if (drop) {
        const f = list[Number(drop.getAttribute('data-drop'))];
        if (f) { S.deleteFormation(f.id); m.close(); FX.toast('Formation deleted.', 'success'); render(); }
      }
    });
  }

  function applyLayout(map, owner) {
    const st = g.state;
    const army = [];
    E.forEachUnit(st, function (u) { if (u.owner === owner) army.push(u); });
    board().zones[owner].forEach(function (id) { st.board[id] = null; });

    const byKey = {};
    army.forEach(function (u) { (byKey[u.key] = byKey[u.key] || []).push(u); });
    Object.keys(map || {}).forEach(function (id) {
      if (!E.inDeployZone(st, owner, id)) return;
      const pool = byKey[map[id]];
      if (pool && pool.length) st.board[id] = pool.pop();
    });
    // anything unplaced goes to a free zone cell
    const placed = {};
    E.forEachUnit(st, function (u, id) { placed[u.id] = id; });
    const leftovers = army.filter(function (u) { return !placed[u.id]; });
    const free = board().zones[owner].filter(function (id) { return !st.board[id]; });
    leftovers.forEach(function (u, i) { if (free[i]) st.board[free[i]] = u; });

    sfx('deploy');
    render();
  }

  /* ── advisor ──────────────────────────────────────────────── */

  function openAdvisor() {
    const st = g.state;
    if (!st || st.phase !== 'battle') { FX.toast('The advisor only speaks during battle.', 'warn'); return; }
    if (g.thinking) return;
    if (!(isPass() || st.owner === 1)) return;
    const advice = AI.advise(st, st.owner, 3);
    if (!advice.length) { FX.toast('No legal moves available.', 'warn'); return; }
    const m = AC.ui.modal({
      kicker: 'Mantri · ' + U.FACTIONS[st.owner].short,
      title: 'Three good orders',
      sub: 'Ranked by the same reading of the field the AI uses. Tap one to see it on the board.',
      body: '<div class="advice-list">' + advice.map(function (a, i) {
        return '<button class="advice-item" data-adv="' + i + '">' +
          '<span class="advice-score">' + (i === 0 ? '★' : (i + 1)) + '</span>' +
          '<span><span class="advice-label">' + esc(a.label) + '</span>' +
          '<span class="advice-note">' + esc(a.note) + '</span></span></button>';
      }).join('') + '</div>',
      actions: [{ label: 'Close', cls: 'btn-ghost' }]
    });
    m.el.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-adv]');
      if (!btn) return;
      const a = advice[Number(btn.getAttribute('data-adv'))];
      if (!a) return;
      m.close();
      if (a.action.type === 'astra') {
        enterAstra(a.action.astra);
        if (a.action.astra === 'vayavya' && a.action.from) g.astraFirst = a.action.from;
        g.armed = a.action.to;
        render();
      } else {
        g.sel = a.action.from;
        g.mode = (a.action.type === 'scan' || a.action.type === 'barrage') ? 'special' : 'move';
        render();
      }
      const at = cellCenter(a.action.to);
      FX.spawn(at.x, at.y, { count: 14, color: '#34d399', speed: 2 });
    });
  }

  function openHelp() {
    const st = g.state;
    const turning = st && E.hasRotation(st);
    const cards = [
      ['व्यूह रचना', 'Deploy', 'Twelve pieces in your own ground. Tap one, then another, to swap them. Presets are only a starting point.'],
      ['चाल', 'Move', 'Tap your piece, then a glowing cell. One step, two for the cavalry, a whole lane for the chariot.'],
      ['संघर्ष', 'Strike', 'Tap a ringed enemy to see your odds, tap again to strike. Ranks stay hidden until the blow lands.'],
      ['दुर्ग', 'The fort', 'The first blow breaks its gate and reveals it. The second blow takes it — and the match.'],
      ['पहर', 'The hours', 'Every fifth round the sky turns. Suryavansh strikes at +1 by day, Chandravansh at +1 by night.'],
      ['व्यूह', 'Formations', 'Makara: strike a piece another of yours touches, +1. Padma: a piece with two friends beside it defends at +1.'],
      ['शक्ति', 'Shakti & astras', 'Every piece you take lights a lamp. Spend lamps on four divine weapons — each once per match.'],
      turning ? ['चक्र', 'The turn', 'Every fifth round the inner rings turn one cell, and whatever they carry is exposed.'] : ['सूर्यास्त', 'Sunset', 'If the war runs long, at sunset the stronger army holds the field.']
    ];
    AC.ui.modal({
      kicker: 'Learn in one screen',
      title: 'Eight things to know',
      wide: true,
      body: '<div class="learn-grid">' + cards.map(function (c) {
        return '<div class="learn-card"><span class="deva">' + c[0] + '</span><b>' + esc(c[1]) + '</b><p>' + esc(c[2]) + '</p></div>';
      }).join('') + '</div>',
      actions: [
        { label: 'Full codex', cls: 'btn-ghost', onClick: function () { AC.ui.openCodex(); } },
        { label: 'Got it', cls: 'btn-primary' }
      ]
    });
  }

  g.openHelp = openHelp;

  g.openIntel = function () {
    const panel = document.getElementById('intel-panel');
    if (panel) panel.classList.add('open');
    const scrim = document.getElementById('scrim');
    if (scrim) scrim.classList.add('on');
  };

  /* ── game over ────────────────────────────────────────────── */

  function shareLine(st, outcome) {
    const b = U.BOARDS[st.boardKey] || U.BOARDS.wheel;
    if (outcome === 'win') return 'I broke ' + oppName(st) + '’s army on the ' + b.label + ' in ' + st.turn + ' rounds. Can you?';
    if (outcome === 'loss') return oppName(st) + ' took my fort on the ' + b.label + '. Avenge me.';
    return 'The field was shared on the ' + b.label + ' after ' + st.turn + ' rounds.';
  }

  function handleGameOver() {
    if (g.over) return;
    g.over = true;
    stopClock();
    clearTimers();
    AU.setTension(0);
    const st = g.state;
    st.viewer = 3;
    render();

    const winner = st.winner;
    const isAiGame = isAi();
    let outcome = 'draw';
    if (winner === 1) outcome = 'win';
    else if (winner === 2) outcome = 'loss';

    if (isAiGame && AC.app.profile && !AC.app.guest && !modeHook('noRecord')) {
      S.recordResult(AC.app.profile.id, {
        outcome: outcome,
        captures: (st.captured[1] || []).length,
        cores: (st.captured[1] || []).filter(function (d) { return d.key === 'F'; }).length,
        plies: st.stats.actions
      });
      AC.app.profile = S.getProfile(AC.app.profile.id);
    }
    S.deleteSave('auto');

    const title = winner === 0 ? 'The field is shared' : (winner === 1 ? 'Suryavansh triumphs' : 'Chandravansh conquers');
    const deva = winner === 0 ? 'समान' : ((isAiGame ? outcome === 'win' : true) ? 'विजय' : 'पराजय');
    const cls = winner === 0 ? 'draw' : (isAiGame ? (outcome === 'win' ? 'win' : 'lose') : 'win');
    sfx(winner === 0 ? 'draw' : isAiGame ? (outcome === 'win' ? 'win' : 'lose') : 'win');
    if (winner === 0) AU.sting('defeat');
    else if (!isAiGame || outcome === 'win') { AU.sting('victory'); sfx('shankh'); }
    else AU.sting('defeat');
    if (winner !== 0) FX.shake(9);
    speak([winner === 0 ? 'draw' : (isAiGame ? (outcome === 'win' ? 'victory' : 'defeat') : 'victory')]);

    const extra = modeHook('resultExtras', { outcome: outcome }) || null;
    const astrasUsed = (st.astraLog || []).filter(function (a) { return a.owner === 1; }).length;
    const actions = [
      { label: 'Home', cls: 'btn-ghost', onClick: function () { g.state = null; AC.ui.show('home'); } },
      { label: 'Review board', cls: 'btn-ghost', onClick: function () { render(); } }
    ];
    if (extra && extra.actions) extra.actions.forEach(function (a) { actions.push(a); });
    else {
      if (isAiGame && outcome !== 'draw' && AC.share) {
        actions.push({ label: 'Share', cls: 'btn-ghost', icon: 'share', close: false, onClick: function () { AC.share.text(shareLine(st, outcome)); } });
      }
      actions.push({ label: 'Rematch', cls: 'btn-primary', onClick: function () { g.start(st.config); } });
    }

    AC.ui.modal({
      kicker: 'Yuddh samaapt',
      title: '',
      art: A.artFor(cls === 'win' ? 'ui:victory' : cls === 'lose' ? 'ui:defeat' : 'ui:combat'),
      dismissible: false,
      wide: !!(extra && extra.wide),
      body:
        '<div class="result-hero">' +
          '<div class="result-deva deva ' + cls + '">' + deva + '</div>' +
          '<div class="result-title ' + cls + '">' + esc(title) + '</div>' +
          '<div class="result-reason">' + esc(st.reason || '') + '</div>' +
        '</div>' +
        '<div class="result-stats">' +
          '<div class="result-stat"><b>' + st.turn + '</b><span>rounds</span></div>' +
          '<div class="result-stat"><b>' + (st.captured[1] || []).length + '</b><span>taken</span></div>' +
          '<div class="result-stat"><b>' + (st.captured[2] || []).length + '</b><span>lost</span></div>' +
          '<div class="result-stat"><b>' + astrasUsed + '</b><span>astras</span></div>' +
        '</div>' +
        (extra && extra.html ? extra.html : ''),
      actions: actions
    });
  }

  g.resign = function () {
    if (!g.state || g.state.phase === 'over') return;
    const loser = g.state.owner;
    E.endGame(g.state, loser === 1 ? 2 : 1, U.FACTIONS[loser].name + ' left the field.', []);
    handleGameOver();
  };

  /* ── wiring ───────────────────────────────────────────────── */

  function wire() {
    const svg = document.getElementById('board');
    svg.addEventListener('click', function (e) {
      const cell = e.target.closest('[data-id]');
      if (!cell) return;
      onCell(cell.getAttribute('data-id'));
    });
    svg.addEventListener('pointerover', function (e) {
      const cell = e.target.closest('[data-id]');
      if (!cell || !g.state || g.state.phase !== 'battle') return;
      const id = cell.getAttribute('data-id');
      const u = g.state.board[id];
      const viewer = viewerOf(g.state);
      if (u && u.owner !== viewer && !u.revealed && g.focus !== id) {
        g.focus = id;
        renderIntel();
      }
    });
    svg.addEventListener('keydown', function (e) {
      const cell = e.target.closest('[data-id]');
      if (!cell) return;
      const id = cell.getAttribute('data-id');
      const b = board();
      const c = b.byId[id];
      if (!c) return;
      let nextId = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        let best = null;
        let bestScore = 1e9;
        b.cells.forEach(function (other) {
          if (other.id === id) return;
          const vx = other.x - c.x;
          const vy = other.y - c.y;
          const along = vx * dx + vy * dy;
          if (along <= 0.05) return;
          const off = Math.abs(vx * dy - vy * dx);
          const score = off * 2 + along;
          if (score < bestScore) { bestScore = score; best = other.id; }
        });
        nextId = best;
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onCell(id);
        return;
      } else {
        return;
      }
      e.preventDefault();
      if (nextId) {
        const el = svg.querySelector('[data-id="' + nextId + '"]');
        if (el) el.focus();
      }
    });

    const bar = document.getElementById('action-bar');
    bar.addEventListener('click', function (e) {
      const preset = e.target.closest('[data-preset]');
      if (preset) { deployPreset(preset.getAttribute('data-preset')); return; }
      const deploy = e.target.closest('[data-deploy]');
      if (deploy) {
        const what = deploy.getAttribute('data-deploy');
        if (what === 'lock') lockFormation();
        if (what === 'save') keepFormation();
        return;
      }
      if (e.target.closest('[data-formation]')) { applySavedFormation(); return; }
      const astraBtn = e.target.closest('[data-astra]');
      if (astraBtn) { enterAstra(astraBtn.getAttribute('data-astra')); return; }
      const mode = e.target.closest('[data-mode]');
      if (mode) { g.mode = mode.getAttribute('data-mode'); g.armed = null; sfx('ui'); render(); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        const what = act.getAttribute('data-act');
        if (what === 'deselect') { resetSelection(); sfx('deselect'); render(); }
        if (what === 'cancel-astra') cancelAstra();
        if (what === 'advisor') { sfx('ui'); openAdvisor(); }
        return;
      }
      const over = e.target.closest('[data-over]');
      if (over) {
        const what = over.getAttribute('data-over');
        if (what === 'home') { g.state = null; AC.ui.show('home'); }
        if (what === 'codex') AC.ui.openCodex();
        if (what === 'rematch') g.start(g.state.config);
      }
    });

    document.getElementById('btn-game-menu').addEventListener('click', function () { sfx('ui'); AC.ui.openPause(); });
    document.getElementById('btn-hud-settings').addEventListener('click', function () { sfx('ui'); AC.ui.openSettings(); });
    document.getElementById('btn-hud-intel').addEventListener('click', function () {
      sfx('ui');
      const panel = document.getElementById('intel-panel');
      const scrim = document.getElementById('scrim');
      const open = panel.classList.toggle('open');
      if (scrim) scrim.classList.toggle('on', open);
    });
    document.getElementById('btn-hud-log').addEventListener('click', function () {
      sfx('ui');
      const panel = document.getElementById('log-panel');
      const scrim = document.getElementById('scrim');
      const open = panel.classList.toggle('open');
      if (scrim) scrim.classList.toggle('on', open);
    });
    document.getElementById('btn-log-close').addEventListener('click', function () {
      sfx('ui');
      document.getElementById('log-panel').classList.remove('open');
      document.getElementById('scrim').classList.remove('on');
    });
    document.getElementById('scrim').addEventListener('click', function () {
      document.getElementById('log-panel').classList.remove('open');
      document.getElementById('intel-panel').classList.remove('open');
      document.getElementById('scrim').classList.remove('on');
    });
    const sky = document.getElementById('hud-sky');
    if (sky) sky.addEventListener('click', function () { sfx('ui'); g.openIntel(); });
  }

  g.wire = wire;
  g.render = render;
  g.tile = onCell;
  g.advisor = openAdvisor;
  g.perform = performAction;
  g.enterAstra = enterAstra;
  g.speak = speak;

  AC.game = g;
})(typeof globalThis !== 'undefined' ? globalThis : this);
