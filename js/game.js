/* Aetherfront: Astral Command — battle screen (v3)
 * Renders any cell graph as SVG, so the square arenas and the Chakravyuha
 * wheel share one renderer, one input path and one set of animations.
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

  const g = (AC.game = AC.game || {});
  g.state = null;
  g.sel = null;
  g.mode = 'move';
  g.thinking = false;
  g.focus = null;
  g.slot = null;
  g.timerId = null;
  g.timeLeft = 0;
  g.aiTimer = null;
  g.busy = false;
  g.over = false;
  g.hinted = false;

  const $ = function (s) { return document.querySelector(s); };
  const esc = function (s) { return AC.ui.esc(s); };
  const sfx = function (n) { AU.play(n); };
  const buzz = function (p) { AU.buzz(p); };

  function settings() { return AC.app.settings; }

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

  /* ══ lifecycle ═════════════════════════════════════════════════ */

  function clearOverlays() {
    Array.prototype.forEach.call(document.querySelectorAll('.curtain'), function (n) { n.remove(); });
    const scrim = document.getElementById('scrim');
    if (scrim) scrim.classList.remove('on');
    ['intel-panel', 'log-panel'].forEach(function (id) {
      const p = document.getElementById(id);
      if (p) p.classList.remove('open');
    });
  }
  g.clearOverlays = clearOverlays;

  g.start = function (config) {
    clearTimers();
    clearOverlays();
    g.state = E.newState(Object.assign({}, config, {
      playerName: AC.app.profile ? AC.app.profile.name : 'Commander'
    }));
    g.sel = null;
    g.mode = 'move';
    g.focus = null;
    g.slot = null;
    g.over = false;
    g.busy = false;
    g.thinking = false;
    g.hinted = false;
    AC.ui.show('game');
    render();
    autosave();
    const st0 = g.state;
    FX.toast(st0.turnLimit
      ? 'Abhimanyu — break the fort before round ' + st0.turnLimit + '. Eight raiders, no fort of your own.'
      : (st0.boardKey === 'wheel'
        ? 'Deploy on your half of the wheel. Every fifth round the inner rings turn.'
        : 'Army deployed. Arrange your formation, then lock it in.'), 'info');
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
    g.sel = null;
    g.mode = 'move';
    g.focus = null;
    g.slot = slot || null;
    g.hinted = false;
    g.over = g.state.phase === 'over';
    g.busy = false;
    g.thinking = false;
    if (g.state.phase === 'deploy2') g.state.viewer = 2;
    else if (g.state.phase === 'battle') g.state.viewer = isPass() ? g.state.owner : 1;
    else if (g.state.phase === 'deploy1') g.state.viewer = 1;
    AC.ui.show('game');
    render();
    FX.toast('Match restored.', 'success');
    if (g.state.phase === 'battle' && isAi() && g.state.owner === 2) scheduleAi();
  };

  g.onShow = function () { render(); };
  g.isActive = function () { return !!g.state; };
  g.canSave = function () { return !!g.state && g.state.phase !== 'over'; };
  g.onSettingsChange = function () { render(); };
  g.updateResumeState = function () { /* home reads storage directly */ };

  g.saveTo = function (slot) {
    if (!g.canSave()) return null;
    const st = g.state;
    const label = (U.BOARDS[st.boardKey] || U.BOARDS.small).label + ' · ' +
      (st.config.mode === 'pass' ? 'Pass & play' : 'vs ' + U.DIFFICULTIES[st.config.difficulty].label) +
      ' · turn ' + st.turn;
    const entry = S.saveGame(slot, st, {
      label: label,
      mode: st.config.mode,
      board: st.boardKey,
      difficulty: st.config.difficulty,
      tie: st.config.tie,
      timer: st.config.timer,
      turn: st.turn,
      phase: st.phase,
      owner: st.owner
    });
    return entry ? label : null;
  };

  function autosave() {
    if (!g.canSave()) return;
    const st = g.state;
    S.saveGame('auto', st, {
      label: 'Autosave',
      mode: st.config.mode,
      board: st.boardKey,
      difficulty: st.config.difficulty,
      tie: st.config.tie,
      timer: st.config.timer,
      turn: st.turn,
      phase: st.phase,
      owner: st.owner
    });
  }

  function clearTimers() {
    if (g.timerId) { clearInterval(g.timerId); g.timerId = null; }
    if (g.aiTimer) { clearTimeout(g.aiTimer); g.aiTimer = null; }
  }

  /* ══ rendering ═════════════════════════════════════════════════ */

  function render() {
    if (!g.state) return;
    renderHud();
    renderStrips();
    renderBoard();
    renderActionBar();
    renderIntel();
    renderLog();
    startClockIfNeeded();
  }

  function renderHud() {
    const st = g.state;
    const pill = $('#hud-turn');
    const sub = $('#hud-sub');
    const clock = $('#hud-clock');
    $('#btn-game-menu').innerHTML = A.icon('menu');
    $('#btn-hud-intel').innerHTML = A.icon('eye');
    $('#btn-hud-log').innerHTML = A.icon('book');
    $('#btn-hud-settings').innerHTML = A.icon('settings');
    $('#btn-log-close').innerHTML = A.icon('close');

    pill.className = 'turn-pill';
    if (st.phase === 'deploy1' || st.phase === 'deploy2') {
      const owner = st.phase === 'deploy1' ? 1 : 2;
      pill.classList.add(owner === 1 ? 'solar' : 'void');
      pill.textContent = 'Deployment · ' + U.FACTIONS[owner].short;
      sub.textContent = 'Swap any two cells in your deployment zone, then lock the formation.';
    } else if (st.phase === 'battle') {
      const roundsLeft = st.turnLimit ? Math.max(0, st.turnLimit - st.turn + 1) : 0;
      if (g.thinking) {
        pill.classList.add('void');
        pill.textContent = 'Astral AI is calculating';
        sub.textContent = 'Weighing beliefs, probes and your last move.';
      } else {
        const owner = st.owner;
        pill.classList.add(owner === 1 ? 'solar' : 'void');
        pill.textContent = (st.turnLimit ? 'Breach · round ' + st.turn + '/' + st.turnLimit : 'Turn ' + st.turn) +
          ' · ' + U.FACTIONS[owner].short;
        let extra = '';
        if (st.boardKey === 'wheel') {
          const until = E.turnsUntilRotation(st);
          extra = ' · chakra turns in ' + until;
        }
        if (st.turnLimit) extra = ' · ' + roundsLeft + ' rounds left' + extra;
        sub.textContent = (isPass()
          ? (owner === 1 ? 'Suryavansh' : 'Chandravansh') + ' to move — tap a unit.'
          : (owner === 1 ? 'Your move — tap a unit to command it.' : 'Chandravansh is moving.')) + extra;
      }
    } else {
      pill.classList.add('gold');
      pill.textContent = st.winner === 0 ? 'Stalemate' : (st.winner === 1 ? 'Suryavansh victory' : 'Chandravansh victory');
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

  function renderStrips() {
    const st = g.state;
    const topLabel = st.config.mode === 'ai' ? 'Chandravansh · Astral AI' : 'Chandravansh · Commander 2';
    const botLabel = st.config.mode === 'ai'
      ? 'Suryavansh · ' + (AC.app.profile ? AC.app.profile.name : 'You')
      : 'Suryavansh · Commander 1';

    $('#strip-top').className = 'player-strip' + (st.phase === 'battle' && st.owner === 2 ? ' active-void' : '');
    $('#strip-bottom').className = 'player-strip' + (st.phase === 'battle' && st.owner === 1 ? ' active-solar' : '') +
      (st.phase === 'deploy1' ? ' active-solar' : '');

    $('#strip-top').innerHTML = A.crest(2) +
      '<span class="strip-name" style="color:var(--void)">' + esc(topLabel) + '</span>' +
      '<span class="strip-count">' + aliveCount(2) + '/' + E.rosterOf(st, 2).length + '</span>' + captureTray(2);
    $('#strip-bottom').innerHTML = A.crest(1) +
      '<span class="strip-name" style="color:var(--solar)">' + esc(botLabel) + '</span>' +
      '<span class="strip-count">' + aliveCount(1) + '/' + E.rosterOf(st, 1).length + '</span>' + captureTray(1);
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

  function tokenSvg(u, cell, isSel) {
    const R = cell.tr;
    const cls = u.owner === 1 ? 'solar' : 'void';
    const moved = u.hasMoved ? '<circle class="tok-moved" cx="' + (-R * 0.62) + '" cy="' + (R * 0.62) + '" r="' + (R * 0.14) + '"/>' : '';
    if (!visibleToViewer(u)) {
      const back = A.artFor('faction:' + u.owner);
      const face = back
        ? '<image class="tok-crest" href="' + back + '" x="' + (-R * 0.74) + '" y="' + (-R * 0.74) + '" width="' + (R * 1.48) +
          '" height="' + (R * 1.48) + '" opacity="0.95" preserveAspectRatio="xMidYMid meet"/>' +
          '<text class="tok-rank" x="' + (R * 0.46) + '" y="' + (R * 0.74) + '" font-size="' + (R * 0.52) +
          '" text-anchor="middle">?</text>'
        : '<text class="tok-q" y="' + (R * 0.33) + '" font-size="' + (R * 0.92) + '" text-anchor="middle">?</text>';
      return '<g class="token hidden-unit ' + cls + '" data-uid="' + u.id + '" transform="translate(' + cell.x + ',' + cell.y + ')">' +
        '<circle class="tok-disc" r="' + R + '"/>' + face + moved + '</g>';
    }
    const sel = isSel ? '<circle class="sel-ring" r="' + (R * 1.14) + '"/>' : '';
    const eye = (u.revealed && u.owner === g.state.viewer && g.state.phase !== 'over')
      ? '<circle class="tok-eye" cx="' + (R * 0.6) + '" cy="' + (-R * 0.6) + '" r="' + (R * 0.15) + '"/>' : '';
    return '<g class="token ' + cls + (isSel ? ' selected-token' : '') + (u.shieldBroken ? ' shield-broken' : '') +
      '" data-uid="' + u.id + '" transform="translate(' + cell.x + ',' + cell.y + ')">' +
      '<circle class="tok-disc" r="' + R + '"/>' +
      sel +
      A.tokenInner(u.key, R) +
      '<text class="tok-rank" x="' + (R * 0.46) + '" y="' + (R * 0.74) + '" font-size="' + (R * 0.52) + '" text-anchor="middle">' +
      esc(u.badge) + '</text>' +
      moved + eye + '</g>';
  }

  function targetMarker(type, R) {
    if (type === 'move') return '<circle class="target-dot" r="' + (R * 0.3) + '"/>';
    const glyph = type === 'attack' ? '×' : type === 'scan' ? '◉' : '⌖';
    return '<circle class="target-ring" r="' + (R * 1.0) + '"/>' +
      '<text class="target-glyph" y="' + (R * 0.34) + '" font-size="' + (R * 1.05) + '" text-anchor="middle">' + glyph + '</text>';
  }

  function renderBoard() {
    const st = g.state;
    const svg = $('#board');
    if (!svg) return;
    const b = board();
    const bounds = b.bounds;
    svg.setAttribute('viewBox', bounds.x + ' ' + bounds.y + ' ' + bounds.w + ' ' + bounds.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const targets = {};
    if (g.sel && st.phase === 'battle' && !g.thinking) {
      E.computeValidTargets(st, g.sel, g.mode).forEach(function (t) { targets[t.id] = t.type; });
    }

    const deployOwner = st.phase === 'deploy1' ? 1 : st.phase === 'deploy2' ? 2 : 0;
    const last = st.lastMove;
    let out = '';

    // the painted stone surface is applied per cell, so the board reads as
    // inlaid tiles rather than a second, competing mandala underneath
    const tex = A.artFor('board:' + st.boardKey);
    if (tex) {
      out += '<defs><pattern id="af-tex" patternUnits="userSpaceOnUse" patternContentUnits="objectBoundingBox" ' +
        'x="0" y="0" width="1.15" height="1.15">' +
        '<image href="' + tex + '" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern></defs>';
    }

    // the yantra frame: rings, ticks and kolam dots around the chakra
    if (b.kind === 'wheel') {
      const R0 = (bounds.w / 2) - 0.05;
      let y = '<g class="yantra" aria-hidden="true">';
      [1.02, 1.07, 1.14].forEach(function (f) {
        y += '<circle cx="0" cy="0" r="' + (R0 * f).toFixed(3) + '"/>';
      });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        y += '<line x1="' + (Math.cos(a) * R0 * 1.02).toFixed(3) + '" y1="' + (Math.sin(a) * R0 * 1.02).toFixed(3) +
          '" x2="' + (Math.cos(a) * R0 * 1.07).toFixed(3) + '" y2="' + (Math.sin(a) * R0 * 1.07).toFixed(3) + '"/>';
        y += '<circle class="dot" cx="' + (Math.cos(a) * R0 * 1.105).toFixed(3) + '" cy="' +
          (Math.sin(a) * R0 * 1.105).toFixed(3) + '" r="0.018"/>';
      }
      y += '</g>';
      out += y;
    }
    const rings = { 1: '', 2: '' };

    b.cells.forEach(function (cell) {
      const id = cell.id;
      const u = st.board[id] || null;
      const rift = E.isRift(st, id);
      const isSel = g.sel === id;
      const isFocus = g.focus === id;
      const target = targets[id];
      const inZone = deployOwner && cell.zone === deployOwner;
      const isLast = last && (last.from === id || last.to === id);

      let cls = 'cell';
      if (cell.shape === 'hub') cls += ' hub';
      if (rift) cls += ' rift';
      if (inZone) cls += ' zone-' + deployOwner;
      if (isSel) cls += ' selected';
      if (isFocus && !isSel) cls += ' hint';
      if (isLast) cls += ' last-move';
      if (target) cls += ' target-' + target;

      const label = rift ? 'rift'
        : u ? (visibleToViewer(u) ? u.name + ', rank ' + u.badge : 'unknown enemy piece')
          : 'empty cell';

      let hubArt = '';
      if (cell.shape === 'hub') {
        const icon = A.artFor('app');
        if (icon) {
          hubArt = '<image href="' + icon + '" x="' + (-cell.r * 0.72) + '" y="' + (-cell.r * 0.72) +
            '" width="' + (cell.r * 1.44) + '" height="' + (cell.r * 1.44) + '" opacity="0.9" preserveAspectRatio="xMidYMid meet"/>';
        }
      }
      const markup = '<g class="' + cls + '" data-id="' + id + '" tabindex="0" role="gridcell" aria-label="' + esc(label) + '">' +
        shapeSvg(cell, !!tex) + hubArt +
        (u ? tokenSvg(u, cell, isSel)
          : (target ? '<g transform="translate(' + cell.x + ',' + cell.y + ')">' + targetMarker(target, cell.tr) + '</g>' : '')) +
        '</g>';
      if (cell.ring === 1 || cell.ring === 2) rings[cell.ring] += markup;
      else out += markup;
    });
    // the inner rings live in their own groups so the wheel can turn
    if (rings[2]) out += '<g class="ring ring-2">' + rings[2] + '</g>';
    if (rings[1]) out += '<g class="ring ring-1">' + rings[1] + '</g>';

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
          '<span class="sel-text"><span class="sel-name">' + U.FACTIONS[owner].name + ' deployment</span>' +
          '<span class="sel-desc">Tap two cells in your zone to swap them. Presets are a starting point.</span></span>' +
        '</div>' +
        '<div class="action-buttons">' +
          presetBtn('citadel', 'Citadel') + presetBtn('blitz', 'Blitz') + presetBtn('lattice', 'Lattice') + presetBtn('shuffle', 'Shuffle') +
          (formations.length ? '<button class="mode-btn" data-formation="1">' + A.icon('folder') + 'Saved</button>' : '') +
          '<button class="mode-btn" data-deploy="save">' + A.icon('save') + 'Keep</button>' +
          '<button class="btn btn-primary btn-sm" data-deploy="lock">' + (st.phase === 'deploy1' && isPass() ? 'Lock &amp; pass' : 'Lock formation') + '</button>' +
        '</div>';
      return;
    }

    if (st.phase === 'over') {
      bar.innerHTML =
        '<div class="action-info"><span class="sel-text"><span class="sel-name">Match complete</span>' +
        '<span class="sel-desc">All ranks are revealed. Review the board, or start a new engagement.</span></span></div>' +
        '<div class="action-buttons">' +
          '<button class="mode-btn" data-over="codex">' + A.icon('book') + 'Codex</button>' +
          '<button class="mode-btn" data-over="home">' + A.icon('back') + 'Command deck</button>' +
          '<button class="btn btn-primary btn-sm" data-over="rematch">' + A.icon('refresh') + 'Rematch</button>' +
        '</div>';
      return;
    }

    const selUnit = g.sel ? st.board[g.sel] : null;
    const isHumanTurn = !g.thinking && (isPass() || st.owner === 1);
    let info;
    if (selUnit) {
      const def = U.UNIT_DEFS[selUnit.key];
      info = '<span class="sel-badge ' + (selUnit.owner === 1 ? 'solar' : 'void') + '">' + A.emblem(selUnit.key) + '</span>' +
        '<span class="sel-text"><span class="sel-name">' + esc(selUnit.name) + ' · rank ' + esc(selUnit.badge) + '</span>' +
        '<span class="sel-desc">' + esc(def.desc) + '</span></span>';
    } else {
      info = '<span class="sel-badge">' + A.icon('sword') + '</span>' +
        '<span class="sel-text"><span class="sel-name">' + (isHumanTurn ? 'Select a unit' : 'Waiting') + '</span>' +
        '<span class="sel-desc">' + (isHumanTurn
          ? 'Tap one of your pieces, then tap a highlighted cell to move or strike.'
          : 'The Chandravansh is choosing its move.') + '</span></span>';
    }

    let buttons = '';
    if (isHumanTurn) {
      if (selUnit) {
        buttons += '<button class="mode-btn' + (g.mode === 'move' ? ' on' : '') + '" data-mode="move">' + A.icon('sword') + 'Move / Strike</button>';
        const def = U.UNIT_DEFS[selUnit.key];
        if (def.hasScan) buttons += '<button class="mode-btn special' + (g.mode === 'special' ? ' on' : '') + '" data-mode="special">' + A.icon('eye') + 'Scan</button>';
        if (def.hasRanged) buttons += '<button class="mode-btn special' + (g.mode === 'special' ? ' on' : '') + '" data-mode="special">' + A.icon('bolt') + 'Volley</button>';
        buttons += '<button class="mode-btn" data-act="deselect">' + A.icon('close') + '</button>';
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
      host.innerHTML = '<div class="intel-head"><span class="intel-title">Intel ledger</span></div>' +
        '<p class="intel-note">Sealed by the privacy curtain.</p>';
      return;
    }
    if (settings().showIntel === false || st.phase === 'over') {
      host.innerHTML = '<div class="intel-head"><span class="intel-title">Intel ledger</span></div>' +
        '<p class="intel-note">Intel panel is hidden in settings.</p>';
      return;
    }

    const viewer = st.viewer === 3 ? 1 : st.viewer;
    const foe = viewer === 1 ? 2 : 1;
    const pool = E.unknownPool(st, viewer);
    const unknowns = Object.keys(pool).filter(function (k) { return pool[k] > 0; });

    const known = [];
    const exposed = [];
    E.forEachUnit(st, function (u) {
      if (u.owner === foe && u.revealed) known.push(u);
      if (u.owner === viewer && u.revealed) exposed.push(u);
    });

    let html = '<div class="intel-head"><span class="intel-title">Intel ledger</span>' +
      '<span class="chip chip-' + (viewer === 1 ? 'solar' : 'void') + '">' + U.FACTIONS[foe].short + '</span></div>';

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

    const odds = oddsBlock();
    if (odds) html += odds;

    if (st.phase === 'battle') {
      const left = E.drawCountdown(st);
      const limit = st.config.drawAfter || 100;
      html += '<div class="intel-section"><div class="intel-label">No-capture clock</div>' +
        '<div class="odds-row"><span style="color:var(--dim)">Draw in</span>' +
        '<span class="odds-bar"><span style="width:' + Math.round((left / limit) * 100) + '%;background:' +
        (left <= 10 ? 'var(--void)' : 'linear-gradient(90deg,var(--solar),var(--green))') + '"></span></span>' +
        '<span class="odds-val">' + left + '</span></div></div>';

      if (st.boardKey === 'wheel') {
        const until = E.turnsUntilRotation(st);
        html += '<div class="intel-section"><div class="intel-label">The chakra</div>' +
          '<p class="intel-note">Rings 1 and 2 turn one spoke every 5 rounds, carrying whatever stands on them — and exposing it. Turns until the wheel moves: <b style="color:var(--gold)">' +
          until + '</b>.</p></div>';
      }
    }

    html += '<div class="intel-section">' +
      '<button class="mode-btn" data-act="advisor" style="width:100%;justify-content:center">' + A.icon('brain') + 'Ask the advisor</button>' +
      '<p class="intel-note">Odds are averaged over every rank the enemy could still be hiding. A piece that has moved can no longer be a fort or a trap.</p>' +
      '</div>';

    host.innerHTML = html;
  }

  function oddsBlock() {
    const st = g.state;
    const viewer = st.viewer === 3 ? 1 : st.viewer;
    const selUnit = g.sel ? st.board[g.sel] : null;
    const focus = g.focus ? st.board[g.focus] : null;
    if (!focus || focus.owner === viewer) return '';

    if (selUnit && selUnit.owner === viewer) {
      const isBarrage = g.mode === 'special' && U.UNIT_DEFS[selUnit.key].hasRanged;
      const dist = focus.revealed
        ? (function () { const o = {}; o[focus.key] = 1; return o; })()
        : E.beliefFor(st, viewer, g.focus);
      if (!dist) return '';
      let win = 0, lose = 0, both = 0, core = 0;
      Object.keys(dist).forEach(function (k) {
        const p = dist[k];
        const res = AI.predict(selUnit.key, k, st.config.tie, isBarrage);
        if (res.out === 'core') core += p;
        else if (res.out === 'att') win += p;
        else if (res.out === 'def' || res.out === 'mine') lose += p;
        else if (res.out === 'both') both += p;
      });
      const rows = [];
      if (core > 0.001) rows.push(['Objective', core, 'var(--gold)']);
      if (win > 0.001) rows.push(['You win', win, 'var(--green)']);
      if (both > 0.001) rows.push(['Both fall', both, 'var(--gold)']);
      if (lose > 0.001) rows.push(['You lose', lose, 'var(--void)']);
      return '<div class="intel-section"><div class="intel-label">' + (isBarrage ? 'Volley odds' : 'Clash odds') +
        ' · ' + esc(selUnit.short) + ' → unknown</div><div class="intel-odds">' +
        rows.map(function (r) {
          return '<div class="odds-row"><span style="color:' + r[2] + '">' + r[0] + '</span>' +
            '<span class="odds-bar"><span style="width:' + Math.round(r[1] * 100) + '%"></span></span>' +
            '<span class="odds-val">' + Math.round(r[1] * 100) + '%</span></div>';
        }).join('') + '</div>' +
        (focus.revealed ? '' : '<div class="intel-note">Identity odds: ' + topBeliefs(st, viewer, g.focus) + '</div>') +
        '</div>';
    }

    if (!focus.revealed) {
      const dist = E.beliefFor(st, viewer, g.focus);
      if (!dist) return '';
      return '<div class="intel-section"><div class="intel-label">Tapped piece — identity odds</div>' +
        '<div class="intel-note">' + topBeliefs(st, viewer, g.focus) + '</div>' +
        '<div class="intel-odds">' + Object.keys(dist).sort(function (a, b) { return dist[b] - dist[a]; })
          .slice(0, 4).map(function (k) {
            return '<div class="odds-row"><span>' + esc(U.UNIT_DEFS[k].badge) + '</span>' +
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
      return '<div class="log-entry kind-' + esc(l.kind) + '"><span class="log-turn">T' + l.turn + '</span>' + esc(l.text) + '</div>';
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
        FX.toast('Deploy inside your own zone.', 'warn');
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
      renderIntel();
      sfx('ui');
      return;
    }

    if (unit && unit.owner === st.owner) {
      if (!E.isMovable(unit)) {
        FX.toast(unit.name + ' is immovable — it can never leave that cell.', 'warn');
        sfx('error');
        g.sel = null;
        render();
        return;
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
        FX.toast('Cyan dot = move. Red ring = attack. Tap the cell to commit.', 'info');
      }
      render();
      return;
    }

    g.sel = null;
    g.focus = null;
    render();
  }

  function commitAction(from, to, type) {
    const st = g.state;
    const target = st.board[to];
    const risky = type === 'attack' && target && !target.revealed && settings().confirmActions !== false;
    if (risky) { showOddsConfirm(from, to, type); return; }
    performAction({ from: from, to: to, type: type });
  }

  function showOddsConfirm(from, to, type) {
    const st = g.state;
    const attacker = st.board[from];
    const target = st.board[to];
    const viewer = st.viewer === 3 ? 1 : st.viewer;
    const dist = E.beliefFor(st, viewer, to) || { '2': 1 };
    let win = 0, lose = 0, both = 0, core = 0;
    Object.keys(dist).forEach(function (k) {
      const p = dist[k];
      const res = AI.predict(attacker.key, k, st.config.tie, false);
      if (res.out === 'core') core += p;
      else if (res.out === 'att') win += p;
      else if (res.out === 'def' || res.out === 'mine') lose += p;
      else if (res.out === 'both') both += p;
    });
    const row = function (label, p, color) {
      return '<div class="odds-row"><span style="color:' + color + '">' + label + '</span>' +
        '<span class="odds-bar"><span style="width:' + Math.round(p * 100) + '%"></span></span>' +
        '<span class="odds-val">' + Math.round(p * 100) + '%</span></div>';
    };
    AC.ui.modal({
      kicker: 'Commit attack',
      title: 'Strike an unknown piece?',
      sub: 'You are attacking blind. These odds are averaged over every rank this piece could still be.',
      body:
        '<div class="combat-arena">' +
          '<div class="combat-card ' + (attacker.owner === 1 ? 'solar' : 'void') + '">' +
            '<div class="combat-emblem">' + A.emblem(attacker.key) + '</div>' +
            '<div class="combat-faction">' + U.FACTIONS[attacker.owner].short + '</div>' +
            '<div class="combat-name">' + esc(attacker.name) + '</div>' +
            '<div class="combat-rank">rank ' + esc(attacker.badge) + '</div></div>' +
          '<div class="combat-vs">VS</div>' +
          '<div class="combat-card void">' +
            '<div class="combat-emblem">' + A.emblem('F') + '</div>' +
            '<div class="combat-faction">unknown</div>' +
            '<div class="combat-name">Hidden piece</div>' +
            '<div class="combat-rank">rank ?</div></div>' +
        '</div>' +
        '<div class="intel-odds">' +
          (core > 0.001 ? row('Objective', core, 'var(--gold)') : '') +
          row('You win', win, 'var(--green)') +
          (both > 0.001 ? row('Both fall', both, 'var(--gold)') : '') +
          row('You lose', lose, 'var(--void)') +
        '</div>',
      actions: [
        { label: 'Hold back', cls: 'btn-ghost', onClick: function () { g.sel = null; render(); } },
        { label: 'Attack', cls: 'btn-primary', onClick: function () { performAction({ from: from, to: to, type: type }); } }
      ],
      onClose: function () { g.sel = null; render(); }
    });
  }

  function cellCenter(id) {
    const el = document.querySelector('.cell[data-id="' + id + '"]');
    return FX.centerOf(el);
  }

  function performAction(action) {
    const st = g.state;
    const mover = st.board[action.from];
    const moverWasAi = isAi() && mover && mover.owner === 2;
    g.busy = true;
    const res = E.applyAction(st, action);
    if (!res.ok) {
      g.busy = false;
      FX.toast('That action is not legal.', 'error');
      sfx('error');
      render();
      return;
    }
    g.sel = null;
    g.focus = null;
    stopClock();

    const at = cellCenter(action.to);
    let dramatic = null;
    let rotated = false;

    res.events.forEach(function (ev) {
      if (ev.sfx) sfx(ev.sfx);
      if (ev.kind === 'rotate') {
        rotated = true;
        FX.burst(FX.centerOf($('#board')).x, FX.centerOf($('#board')).y, { count: 40, color: '#f2cf8b', speed: 6, size: 3 });
        FX.shake(8);
        FX.float('THE CHAKRA TURNS', FX.centerOf($('#board')).x, FX.centerOf($('#board')).y - 40, '#f2cf8b');
      }
      if (ev.kind === 'clash' || ev.kind === 'barrage' || ev.kind === 'scan' || ev.kind === 'core') {
        dramatic = ev;
      }
      if (ev.kind === 'clash') {
        const win = ev.outcome === 'att';
        const color = win ? '#fbbf24' : ev.outcome === 'def' ? '#f43f5e' : '#a855f7';
        FX.burst(at.x, at.y, { count: win ? 26 : 20, color: color, speed: 4 });
        FX.shake(win ? 7 : 5);
        FX.float(win ? 'CAPTURE' : ev.outcome === 'def' ? 'REPELLED' : 'CLASH', at.x, at.y - 16, color);
        buzz(win ? [12, 30, 12] : 22);
      } else if (ev.kind === 'barrage') {
        FX.burst(at.x, at.y, { count: 22, color: ev.kill ? '#fbbf24' : '#a855f7', speed: 5 });
        FX.shake(4);
        if (ev.kill) FX.float('CUT DOWN', at.x, at.y - 16, '#fbbf24');
      } else if (ev.kind === 'scan') {
        FX.spawn(at.x, at.y, { count: 26, color: '#a855f7', speed: 2.4, size: 3 });
        FX.float('REVEALED', at.x, at.y - 16, '#c4b5fd');
      } else if (ev.kind === 'move') {
        FX.spawn(at.x, at.y, { count: 8, color: '#22d3ee', speed: 1.4, size: 1.8, gravity: 0.02 });
      }
    });

    render();
    if (rotated) {
      spinRings();
      FX.toast('The inner rings turned — everything they carried is exposed.', 'warn');
    }
    if (moverWasAi && !dramatic) {
      FX.toast('Chandravansh moved a ' + (mover.revealed ? mover.name : 'piece') + '.', 'info');
    }

    const finish = function () {
      g.busy = false;
      autosave();
      render();
      if (st.phase === 'over') { handleGameOver(); return; }
      if (isAi() && st.owner === 2) scheduleAi();
      else if (isPass()) showCurtain(st.owner, 'battle');
      else banner('Your turn', U.FACTIONS[st.owner].deva + ' · turn ' + st.turn, st.owner === 1 ? 'solar' : 'void');
      if (st.boardKey === 'wheel' && st.phase === 'battle' && E.turnsUntilRotation(st) === 1 && g.warnedAt !== st.turn) {
        g.warnedAt = st.turn;
        FX.toast('The chakra turns next round — the inner rings will shift and expose what they carry.', 'warn');
      }
      startClockIfNeeded();
    };

    if (dramatic) showCombatModal(dramatic, finish);
    else finish();
  }

  /* ── combat modal ──────────────────────────────────────────── */

  function showCombatModal(ev, done) {
    const st = g.state;
    const viewer = st.viewer === 3 ? 1 : st.viewer;
    const att = ev.unit;
    const def = ev.target;

    const card = function (u, dead) {
      const show = u.owner === viewer || u.revealed || st.phase === 'over' || u.owner !== viewer;
      return '<div class="combat-card ' + (u.owner === 1 ? 'solar' : 'void') + (dead ? ' dead' : '') + '">' +
        '<div class="combat-emblem">' + A.emblem(show ? u.key : 'F') + '</div>' +
        '<div class="combat-faction">' + U.FACTIONS[u.owner].short + '</div>' +
        '<div class="combat-name">' + (show ? esc(u.name) : 'Hidden piece') + '</div>' +
        '<div class="combat-rank">rank ' + (show ? esc(u.badge) : '?') + '</div></div>';
    };

    let title = 'Astral clash';
    let kicker = 'Combat resolved';
    let outcomeCls = '';
    let attDead = false;
    let defDead = false;

    if (ev.kind === 'clash') {
      if (ev.core) { title = 'The fort is taken'; outcomeCls = 'win'; defDead = true; }
      else if (ev.outcome === 'att') { title = 'Attacker prevails'; outcomeCls = 'win'; defDead = true; }
      else if (ev.outcome === 'def') { title = 'Defender holds'; outcomeCls = 'lose'; attDead = true; }
      else { title = 'Mutual destruction'; outcomeCls = 'both'; attDead = true; defDead = true; }
    } else if (ev.kind === 'barrage') {
      kicker = 'Shara-varsha · two cells';
      if (ev.kill) { title = 'Target cut down'; outcomeCls = 'win'; defDead = true; }
      else if (ev.deflect) { title = 'Volley turned'; outcomeCls = 'lose'; }
      else { title = 'The trap absorbed it'; outcomeCls = 'both'; }
    } else if (ev.kind === 'scan') {
      kicker = 'Divya-drishti';
      title = 'Identity revealed';
      outcomeCls = 'win';
    }

    let fired = false;
    const fire = function () { if (!fired) { fired = true; if (done) done(); } };

    AC.ui.modal({
      kicker: kicker,
      title: title,
      art: A.artFor('ui:combat'),
      body: '<div class="combat-arena">' + card(att, attDead) + '<div class="combat-vs">' +
        (ev.kind === 'scan' ? '◎' : 'VS') + '</div>' + card(def, defDead) + '</div>' +
        '<div class="combat-outcome ' + outcomeCls + '">' + esc(ev.text) + '</div>',
      dismissible: false,
      actions: [{ label: 'Continue', cls: 'btn-primary', onClick: fire }],
      onClose: fire
    });
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
      const act = AI.chooseAction(st, 2, diff);
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
    performAction(act);
  }

  /* ── privacy curtain ──────────────────────────────────────── */

  function showCurtain(nextOwner, kind) {
    const st = g.state;
    st.viewer = 0;
    render();
    const isDeploy = kind === 'deploy';
    const title = isDeploy ? 'Pass to ' + U.FACTIONS[nextOwner].name : 'Pass to ' + U.FACTIONS[nextOwner].short + ' — turn ' + st.turn;
    const sub = isDeploy
      ? 'The previous commander has locked their formation. Hand the device over before continuing.'
      : 'Hide the screen from your opponent, then hand over the device.';

    const overlay = document.createElement('div');
    overlay.className = 'curtain';
    overlay.innerHTML =
      '<div class="curtain-card">' +
        '<div class="curtain-icon">' + A.icon('lock') + '</div>' +
        '<div class="curtain-count">PRIVACY CURTAIN</div>' +
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
        banner('Your turn', U.FACTIONS[nextOwner].deva + ' · turn ' + st.turn, nextOwner === 1 ? 'solar' : 'void');
      }
    };
    overlay.querySelector('#curtain-go').addEventListener('click', reveal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) reveal(); });
  }

  /* ── deployment actions ──────────────────────────────────── */

  function deployPreset(style) {
    const st = g.state;
    const owner = st.phase === 'deploy1' ? 1 : 2;
    E.deployPreset(st, owner, style);
    g.sel = null;
    sfx('deploy');
    render();
    FX.toast(style.charAt(0).toUpperCase() + style.slice(1) + ' formation applied.', 'info');
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
        FX.toast('Formation locked. Battle stations.', 'success');
        render();
        banner(st.turnLimit ? 'The breach begins' : 'Battle begins',
          U.FACTIONS[1].deva + ' moves first · ' + (st.turnLimit ? st.turnLimit + ' rounds to break the fort' : 'take the fort'), 'gold');
        autosave();
        startClockIfNeeded();
      }
      return;
    }
    if (st.phase === 'deploy2') {
      if (!E.armyComplete(st, 2)) { FX.toast('Your army is not complete.', 'error'); return; }
      sfx('lock');
      E.beginBattle(st);
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
    AC.ui.promptText({ kicker: 'Formation', title: 'Save this formation', label: 'Formation name', value: 'My formation' })
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
      kicker: 'Advisor · ' + U.FACTIONS[st.owner].short,
      title: 'Recommended orders',
      sub: 'Ranked by the same belief model the AI uses. Tap one to see it on the board.',
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
      g.sel = a.action.from;
      g.mode = (a.action.type === 'scan' || a.action.type === 'barrage') ? 'special' : 'move';
      m.close();
      render();
      const at = cellCenter(a.action.to);
      FX.spawn(at.x, at.y, { count: 14, color: '#34d399', speed: 2 });
    });
  }

  function openHelp() {
    const st = g.state;
    const wheel = st && st.boardKey === 'wheel';
    const steps = [
      ['Deploy', 'Twelve pieces anywhere in your zone. Tap two cells to swap them. Citadel, Blitz, Lattice and Shuffle are starting points, not commitments.'],
      ['Command', 'Tap one of your pieces, then tap a highlighted cell. A dot means move; a ring means attack, scan or volley. Ranks are hidden until a piece fights.'],
      ['Probe', 'A piece that has never moved can still be the fort or a trap. Probe with cheap pieces and the archer’s volley — the intel panel shows the real odds before you commit.'],
      st && st.turnLimit
        ? ['Break the fort in time', 'You have eight raiders and no fort of your own. Take the defender’s fort before round ' + st.turnLimit + ' — by melee or by an archer’s volley down a clear spoke. Lose every raider and the breach fails.']
        : (wheel
          ? ['Mind the wheel', 'Arcs are one cell at a time, spokes are long lanes. Every fifth round the inner two rings turn one spoke and expose whatever they carry. The hub reaches every spoke and exposes whoever holds it.']
          : ['Break the fort', 'Take the enemy fort, or leave them with no legal action. Sixty orders without a capture is a draw — the countdown is in the intel panel.'])
    ];
    AC.ui.modal({
      kicker: 'How to play',
      title: 'Four things to know',
      wide: true,
      body: '<div class="howto">' + steps.map(function (s2, i) {
        return '<div class="howto-step"><span class="howto-num">' + (i + 1) + '</span>' +
          '<span><span class="howto-title">' + esc(s2[0]) + '</span>' +
          '<span class="howto-body">' + esc(s2[1]) + '</span></span></div>';
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

  function handleGameOver() {
    if (g.over) return;
    g.over = true;
    stopClock();
    clearTimers();
    const st = g.state;
    st.viewer = 3;
    render();

    const winner = st.winner;
    const isAiGame = isAi();
    let outcome = 'draw';
    if (winner === 1) outcome = 'win';
    else if (winner === 2) outcome = 'loss';

    if (isAiGame && AC.app.profile && !AC.app.guest) {
      S.recordResult(AC.app.profile.id, {
        outcome: outcome,
        captures: (st.captured[1] || []).length,
        cores: (st.captured[1] || []).filter(function (d) { return d.key === 'F'; }).length,
        plies: st.stats.actions
      });
      AC.app.profile = S.getProfile(AC.app.profile.id);
    }
    S.deleteSave('auto');

    const title = winner === 0 ? 'Stalemate' : (winner === 1 ? 'Suryavansh triumphs' : 'Chandravansh conquers');
    const cls = winner === 0 ? 'draw' : winner === 1 ? 'win' : 'lose';
    sfx(winner === 0 ? 'draw' : isAiGame ? (outcome === 'win' ? 'win' : 'lose') : 'win');
    if (winner !== 0) FX.shake(9);

    AC.ui.modal({
      kicker: 'Engagement complete',
      title: '',
      art: A.artFor(winner === 1 ? 'ui:victory' : winner === 2 ? 'ui:defeat' : 'ui:combat'),
      dismissible: false,
      body:
        '<div class="result-hero">' +
          '<div class="result-title ' + cls + '">' + esc(title) + '</div>' +
          '<div class="result-reason">' + esc(st.reason || '') + '</div>' +
        '</div>' +
        '<div class="result-stats">' +
          '<div class="result-stat"><b>' + st.turn + '</b><span>turns</span></div>' +
          '<div class="result-stat"><b>' + st.stats.actions + '</b><span>orders</span></div>' +
          '<div class="result-stat"><b>' + (st.captured[1] || []).length + '</b><span>captures</span></div>' +
        '</div>',
      actions: [
        { label: 'Command deck', cls: 'btn-ghost', onClick: function () { g.state = null; AC.ui.show('home'); } },
        { label: 'Review board', cls: 'btn-ghost', onClick: function () { render(); } },
        { label: 'Rematch', cls: 'btn-primary', onClick: function () { g.start(st.config); } }
      ]
    });
  }

  g.resign = function () {
    if (!g.state || g.state.phase === 'over') return;
    const loser = g.state.owner;
    E.endGame(g.state, loser === 1 ? 2 : 1, U.FACTIONS[loser].name + ' resigned the engagement.', []);
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
      const viewer = g.state.viewer === 3 ? 1 : g.state.viewer;
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
      const mode = e.target.closest('[data-mode]');
      if (mode) { g.mode = mode.getAttribute('data-mode'); sfx('ui'); render(); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        const what = act.getAttribute('data-act');
        if (what === 'deselect') { g.sel = null; g.mode = 'move'; sfx('deselect'); render(); }
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
  }

  g.wire = wire;
  g.render = render;
  g.tile = onCell;
  g.advisor = openAdvisor;
  g.autosave = autosave;

  AC.game = g;
})(typeof globalThis !== 'undefined' ? globalThis : this);
