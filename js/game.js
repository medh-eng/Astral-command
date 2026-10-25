/* Aetherfront: Astral Command — battle screen
 * Board rendering, tap/click/drag deployment, ability bar, intel ledger,
 * turn clock, AI turn loop, privacy curtain, combat and result modals.
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
  g.lastRects = {};

  const $ = function (s) { return document.querySelector(s); };
  const esc = function (s) { return AC.ui.esc(s); };
  const sfx = function (n) { AU.play(n); };
  const buzz = function (p) { AU.buzz(p); };

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

  function state() { return g.state; }
  function settings() { return AC.app.settings; }
  function isPass() { return g.state && g.state.config.mode === 'pass'; }
  function isAi() { return g.state && g.state.config.mode === 'ai'; }

  /* ══ lifecycle ═════════════════════════════════════════════════ */

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
    FX.toast('Army deployed. Arrange your formation, then lock it in.', 'info');
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

  g.onShow = function () {
    render();
    requestAnimationFrame(layoutBoard);
  };

  g.isActive = function () { return !!g.state; };
  g.canSave = function () { return !!g.state && g.state.phase !== 'over'; };
  g.onSettingsChange = function () { render(); };

  g.updateResumeState = function () { /* home reads storage directly */ };

  g.saveTo = function (slot) {
    if (!g.canSave()) return null;
    const st = g.state;
    const label = (U.BOARDS[st.config.board] || U.BOARDS.small).label + ' · ' +
      (st.config.mode === 'pass' ? 'Pass & play' : 'vs ' + U.DIFFICULTIES[st.config.difficulty].label) +
      ' · turn ' + st.turn;
    const entry = S.saveGame(slot, st, {
      label: label,
      mode: st.config.mode,
      board: st.config.board,
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
      board: st.config.board,
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
    layoutBoard();
    startClockIfNeeded();
  }

  function factionName(owner) { return U.FACTIONS[owner].name; }

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
      sub.textContent = 'Swap any two squares in your back three rows, then lock the formation.';
    } else if (st.phase === 'battle') {
      if (g.thinking) {
        pill.classList.add('void');
        pill.textContent = 'Astral AI is calculating';
        sub.textContent = 'Weighing beliefs, probes and your last move.';
      } else {
        const owner = st.owner;
        pill.classList.add(owner === 1 ? 'solar' : 'void');
        pill.textContent = 'Turn ' + st.turn + ' · ' + U.FACTIONS[owner].short;
        sub.textContent = isPass()
          ? (owner === 1 ? 'Solaris to move' : 'Void to move') + ' — tap a unit to command it.'
          : (owner === 1 ? 'Your move — tap a unit to command it.' : 'Void Cabal is moving.');
      }
    } else {
      pill.classList.add('gold');
      pill.textContent = st.winner === 0 ? 'Stalemate' : (st.winner === 1 ? 'Solaris victory' : 'Void victory');
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
    for (let r = 0; r < g.state.rows; r++) {
      for (let c = 0; c < g.state.cols; c++) {
        const u = g.state.board[r][c];
        if (u && u.owner === owner) n++;
      }
    }
    return n;
  }

  function renderStrips() {
    const st = g.state;
    const topOwner = 2;
    const botOwner = 1;
    const topLabel = st.config.mode === 'ai' ? 'Void Cabal · Astral AI' : 'Void Cabal · Commander 2';
    const botLabel = st.config.mode === 'ai'
      ? 'Solaris Order · ' + (AC.app.profile ? AC.app.profile.name : 'You')
      : 'Solaris Order · Commander 1';

    $('#strip-top').className = 'player-strip' + (st.phase === 'battle' && st.owner === topOwner ? ' active-void' : '');
    $('#strip-bottom').className = 'player-strip' + (st.phase === 'battle' && st.owner === botOwner ? ' active-solar' : '') +
      (st.phase === 'deploy1' ? ' active-solar' : '');

    $('#strip-top').innerHTML =
      '<span class="strip-name" style="color:var(--void)">' + esc(topLabel) + '</span>' +
      '<span class="strip-count">' + aliveCount(2) + '/12</span>' +
      captureTray(2);
    $('#strip-bottom').innerHTML =
      '<span class="strip-name" style="color:var(--solar)">' + esc(botLabel) + '</span>' +
      '<span class="strip-count">' + aliveCount(1) + '/12</span>' +
      captureTray(1);
  }

  function captureTray(victimOwner) {
    // pieces this side has lost (captured by the other side)
    const byOther = victimOwner === 2 ? 1 : 2;
    const dead = g.state.captured[byOther] || [];
    if (!dead.length) return '<span class="capture-tray"><span class="tray-empty">no losses</span></span>';
    return '<span class="capture-tray">' + dead.map(function (d) {
      const cls = d.owner === 1 ? 'solar' : 'void';
      return '<span class="capture-chip ' + cls + '" title="' + esc(d.name) + '">' + A.emblem(d.key) +
        '<span class="cap-rank">' + esc(d.badge) + '</span></span>';
    }).join('') + '</span>';
  }

  /* ── board ─────────────────────────────────────────────────── */

  function visibleToViewer(u) {
    if (!u) return false;
    const st = g.state;
    return st.viewer === 3 || u.owner === st.viewer || u.revealed;
  }

  function tokenHTML(u, isSel) {
    const st = g.state;
    const canSee = visibleToViewer(u);
    const cls = u.owner === 1 ? 'solar' : 'void';
    if (!canSee) {
      return '<div class="token hidden-unit ' + cls + '" data-uid="' + u.id + '" aria-hidden="true">' +
        '<span class="unknown-mark">?</span>' +
        (u.hasMoved ? '<span class="moved-dot"></span>' : '') +
        '</div>';
    }
    const eye = (u.revealed && u.owner === st.viewer && st.phase !== 'over')
      ? '<span class="reveal-eye" title="Revealed to the enemy">◉</span>' : '';
    return '<div class="token ' + cls + (isSel ? ' selected-token' : '') + (u.shieldBroken ? ' shield-broken' : '') +
      '" data-uid="' + u.id + '">' +
      '<span class="token-owner"></span>' +
      A.emblem(u.key) +
      '<span class="token-rank">' + esc(u.badge) + '</span>' +
      (u.hasMoved ? '<span class="moved-dot" title="This piece has moved"></span>' : '') +
      eye +
      '</div>';
  }

  function captureRects() {
    const map = {};
    Array.prototype.forEach.call(document.querySelectorAll('.token[data-uid]'), function (el) {
      map[el.getAttribute('data-uid')] = el.getBoundingClientRect();
    });
    return map;
  }

  function renderBoard() {
    const st = g.state;
    const board = $('#board');
    if (!board) return;
    const before = g.lastRects;

    board.style.setProperty('--cols', st.cols);
    board.style.setProperty('--rows', st.rows);
    board.style.gridTemplateColumns = 'repeat(' + st.cols + ', 1fr)';
    board.style.gridTemplateRows = 'repeat(' + st.rows + ', 1fr)';

    const targets = {};
    if (g.sel && st.phase === 'battle' && !g.thinking) {
      E.computeValidTargets(st, g.sel.r, g.sel.c, g.mode).forEach(function (t) {
        targets[t.r + ',' + t.c] = t.type;
      });
    }

    const deployOwner = st.phase === 'deploy1' ? 1 : st.phase === 'deploy2' ? 2 : 0;
    let html = '';

    for (let r = 0; r < st.rows; r++) {
      for (let c = 0; c < st.cols; c++) {
        const u = st.board[r][c];
        const rift = E.isRift(st, r, c);
        const isSel = g.sel && g.sel.r === r && g.sel.c === c;
        const isFocus = g.focus && g.focus.r === r && g.focus.c === c;
        const target = targets[r + ',' + c];
        const inZone = deployOwner && E.inDeployZone(st, deployOwner, r);
        const isLast = st.lastMove && ((st.lastMove.from.r === r && st.lastMove.from.c === c) || (st.lastMove.to.r === r && st.lastMove.to.c === c));

        let cls = 'tile';
        if (rift) cls += ' rift';
        if (inZone) cls += deployOwner === 1 ? ' zone-p1' : ' zone-p2';
        if (isSel) cls += ' selected';
        if (isFocus && !isSel) cls += ' hint';
        if (isLast) cls += ' last-move';
        if (target) cls += ' target-' + target;

        let inner = '';
        if (rift) {
          inner = '';
        } else if (u) {
          inner = tokenHTML(u, isSel);
        } else if (target === 'move') {
          inner = '<span class="target-dot"></span>';
        }
        if (target === 'attack') inner += '<span class="target-ring" style="color:var(--void)"></span><span class="target-glyph">×</span>';
        if (target === 'scan') inner += '<span class="target-ring" style="color:#a855f7"></span><span class="target-glyph">◉</span>';
        if (target === 'barrage') inner += '<span class="target-ring" style="color:var(--gold)"></span><span class="target-glyph">⌖</span>';

        const label = rift
          ? 'Astral rift, impassable'
          : u
            ? (visibleToViewer(u) ? u.name + ', rank ' + u.badge : 'Unknown enemy piece')
            : 'Empty square, row ' + (r + 1) + ' column ' + (c + 1);

        html += '<button class="' + cls + '" data-r="' + r + '" data-c="' + c + '" role="gridcell" aria-label="' + esc(label) + '">' + inner + '</button>';
      }
    }
    board.innerHTML = html;

    // coordinate rails
    const coords = settings().coordinates !== false;
    const cTop = $('#coords-top');
    const cLeft = $('#coords-left');
    cTop.innerHTML = coords ? Array.from({ length: st.cols }, function (_, i) {
      return '<span>' + String.fromCharCode(65 + i) + '</span>';
    }).join('') : '';
    cLeft.innerHTML = coords ? Array.from({ length: st.rows }, function (_, i) {
      return '<span>' + (i + 1) + '</span>';
    }).join('') : '';
    cTop.style.gridTemplateColumns = 'repeat(' + st.cols + ', 1fr)';
    cLeft.style.gridTemplateRows = 'repeat(' + st.rows + ', 1fr)';
    cTop.hidden = !coords;
    cLeft.hidden = !coords;

    // FLIP animation for moved pieces
    if (!settings().reducedMotion) {
      Array.prototype.forEach.call(board.querySelectorAll('.token[data-uid]'), function (el) {
        const id = el.getAttribute('data-uid');
        const prev = before[id];
        if (!prev) return;
        const now = el.getBoundingClientRect();
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        if (typeof el.animate === 'function') {
          el.animate([
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.96)' },
            { transform: 'translate(0,0) scale(1)' }
          ], { duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      });
    }
    g.lastRects = captureRects();
  }

  function layoutBoard() {
    const st = g.state;
    if (!st) return;
    const shell = $('#board-shell');
    const board = $('#board');
    if (!shell || !board) return;
    const gap = st.cols > 7 ? 2.5 : 3;
    const rect = shell.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const availW = rect.width - 4;
    const availH = rect.height - 4;
    const k = Math.min(
      (availW - gap * (st.cols - 1)) / st.cols,
      (availH - gap * (st.rows - 1)) / st.rows
    );
    if (!isFinite(k) || k <= 0) return;
    const w = k * st.cols + gap * (st.cols - 1);
    const h = k * st.rows + gap * (st.rows - 1);
    board.style.width = Math.floor(w) + 'px';
    board.style.height = Math.floor(h) + 'px';
    board.style.gap = gap + 'px';
    board.style.fontSize = Math.max(9, Math.floor(k * 0.42)) + 'px';
    g.tileSize = k;

    // align the coordinate rails to the actual board box
    const br = board.getBoundingClientRect();
    const sr = shell.getBoundingClientRect();
    const offX = br.left - sr.left;
    const offY = br.top - sr.top;
    const cTop = $('#coords-top');
    const cLeft = $('#coords-left');
    if (cTop) {
      cTop.style.left = offX + 'px';
      cTop.style.top = Math.max(0, offY - 13) + 'px';
      cTop.style.width = br.width + 'px';
      cTop.style.height = '12px';
    }
    if (cLeft) {
      cLeft.style.left = Math.max(0, offX - 13) + 'px';
      cLeft.style.top = offY + 'px';
      cLeft.style.height = br.height + 'px';
      cLeft.style.width = '12px';
    }
  }

  /* ── action bar ────────────────────────────────────────────── */

  function renderActionBar() {
    const st = g.state;
    const bar = $('#action-bar');
    if (!bar) return;

    if (st.phase === 'deploy1' || st.phase === 'deploy2') {
      const owner = st.phase === 'deploy1' ? 1 : 2;
      const formations = S.listFormations().filter(function (f) { return f.board === st.config.board; });
      bar.innerHTML =
        '<div class="action-info">' +
          '<span class="sel-badge ' + (owner === 1 ? 'solar' : 'void') + '">' + A.icon('grid') + '</span>' +
          '<span class="sel-text"><span class="sel-name">' + U.FACTIONS[owner].name + ' deployment</span>' +
          '<span class="sel-desc">Tap two squares in your zone to swap them. Presets are a starting point.</span></span>' +
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

    // battle
    const selUnit = g.sel ? st.board[g.sel.r][g.sel.c] : null;
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
          ? 'Tap one of your pieces, then tap a highlighted square to move or strike.'
          : 'The Void Cabal is choosing its move.') + '</span></span>';
    }

    let buttons = '';
    if (isHumanTurn) {
      if (selUnit) {
        buttons += '<button class="mode-btn' + (g.mode === 'move' ? ' on' : '') + '" data-mode="move">' + A.icon('sword') + 'Move / Strike</button>';
        const def = U.UNIT_DEFS[selUnit.key];
        if (def.hasScan) buttons += '<button class="mode-btn special' + (g.mode === 'special' ? ' on' : '') + '" data-mode="special">' + A.icon('eye') + 'Scan</button>';
        if (def.hasRanged) buttons += '<button class="mode-btn special' + (g.mode === 'special' ? ' on' : '') + '" data-mode="special">' + A.icon('bolt') + 'Barrage</button>';
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
    if (settings().showIntel === false || st.phase === 'over') {
      host.innerHTML = '<div class="intel-head"><span class="intel-title">Intel ledger</span></div>' +
        '<p class="intel-note">Intel panel is hidden in settings.</p>';
      return;
    }
    if (st.viewer === 0) {
      host.innerHTML = '<div class="intel-head"><span class="intel-title">Intel ledger</span></div>' +
        '<p class="intel-note">Sealed by the privacy curtain.</p>';
      return;
    }
    const viewer = st.viewer === 3 ? 1 : st.viewer;
    const foe = viewer === 1 ? 2 : 1;
    const pool = E.unknownPool(st, viewer);
    const unknowns = Object.keys(pool).filter(function (k) { return pool[k] > 0; });

    const knownOnBoard = [];
    const spent = [];
    for (let r = 0; r < st.rows; r++) {
      for (let c = 0; c < st.cols; c++) {
        const u = st.board[r][c];
        if (!u || u.owner !== foe) continue;
        if (u.revealed) knownOnBoard.push(u);
      }
    }
    (st.captured[viewer] || []).forEach(function (d) { spent.push(d); });

    let html = '<div class="intel-head"><span class="intel-title">Intel ledger</span>' +
      '<span class="chip chip-' + (viewer === 1 ? 'solar' : 'void') + '">' + U.FACTIONS[foe].short + '</span></div>';

    html += '<div class="intel-section"><div class="intel-label">Still hidden (' + unknowns.reduce(function (a, k) { return a + pool[k]; }, 0) + ' pieces)</div>' +
      '<div class="intel-chips">' +
      (unknowns.length
        ? unknowns.map(function (k) {
          return '<span class="intel-chip unknown" title="' + esc(U.UNIT_DEFS[k].name) + '">' + A.emblem(k) + esc(U.UNIT_DEFS[k].badge) + (pool[k] > 1 ? '×' + pool[k] : '') + '</span>';
        }).join('')
        : '<span class="intel-note">Every enemy piece is accounted for.</span>') +
      '</div></div>';

    if (knownOnBoard.length) {
      html += '<div class="intel-section"><div class="intel-label">Identified on the field</div><div class="intel-chips">' +
        knownOnBoard.map(function (u) {
          return '<span class="intel-chip" title="' + esc(U.UNIT_DEFS[u.key].name) + '">' + A.emblem(u.key) + esc(U.UNIT_DEFS[u.key].badge) + '</span>';
        }).join('') + '</div></div>';
    }
    if (spent.length) {
      html += '<div class="intel-section"><div class="intel-label">Destroyed</div><div class="intel-chips">' +
        spent.map(function (d) {
          return '<span class="intel-chip spent">' + A.emblem(d.key) + esc(d.badge) + '</span>';
        }).join('') + '</div></div>';
    }

    // odds block
    const odds = oddsBlock();
    if (odds) html += odds;

    // what the enemy can see of you
    const exposed = [];
    for (let r = 0; r < st.rows; r++) {
      for (let c = 0; c < st.cols; c++) {
        const u = st.board[r][c];
        if (u && u.owner === viewer && u.revealed) exposed.push(u);
      }
    }
    if (exposed.length) {
      html += '<div class="intel-section"><div class="intel-label">Your exposed pieces</div><div class="intel-chips">' +
        exposed.map(function (u) {
          return '<span class="intel-chip" title="' + esc(U.UNIT_DEFS[u.key].name) + '">' + A.emblem(u.key) + esc(u.badge) + '</span>';
        }).join('') + '</div>' +
        '<p class="intel-note">These ranks are known to the enemy.</p></div>';
    }

    if (st.phase === 'battle') {
      const left = E.drawCountdown(st);
      html += '<div class="intel-section"><div class="intel-label">No-capture clock</div>' +
        '<div class="odds-row"><span style="color:var(--dim)">Draw in</span>' +
        '<span class="odds-bar"><span style="width:' + Math.round((left / (st.config.drawAfter || 60)) * 100) + '%;background:' +
        (left <= 10 ? 'var(--void)' : 'linear-gradient(90deg,var(--solar),var(--green))') + '"></span></span>' +
        '<span class="odds-val">' + left + '</span></div>' +
        '<p class="intel-note">If neither side captures for the full count, the match is a draw.</p></div>';
    }

    html += '<div class="intel-section">' +
      '<button class="mode-btn" data-act="advisor" style="width:100%;justify-content:center">' + A.icon('brain') + 'Ask the advisor</button>' +
      '<p class="intel-note">Odds are averaged over every rank the enemy could still be hiding. A piece that has moved can no longer be a Core or a Mine.</p>' +
      '</div>';

    host.innerHTML = html;
  }

  function oddsBlock() {
    const st = g.state;
    const viewer = st.viewer === 3 ? 1 : st.viewer;
    const selUnit = g.sel ? st.board[g.sel.r][g.sel.c] : null;
    const focus = g.focus ? st.board[g.focus.r][g.focus.c] : null;

    if (!focus || focus.owner === viewer) return '';
    if (selUnit && selUnit.owner === viewer) {
      const isBarrage = g.mode === 'special' && U.UNIT_DEFS[selUnit.key].hasRanged;
      const dist = focus.revealed
        ? (function () { const o = {}; o[focus.key] = 1; return o; })()
        : E.beliefFor(st, viewer, g.focus.r, g.focus.c);
      if (!dist) return '';
      let win = 0;
      let lose = 0;
      let both = 0;
      let core = 0;
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
      const title = isBarrage ? 'Barrage odds' : 'Clash odds';
      return '<div class="intel-section"><div class="intel-label">' + title + ' · ' + esc(selUnit.short) + ' → unknown</div>' +
        '<div class="intel-odds">' + rows.map(function (r) {
          return '<div class="odds-row"><span style="color:' + r[2] + '">' + r[0] + '</span>' +
            '<span class="odds-bar"><span style="width:' + Math.round(r[1] * 100) + '%"></span></span>' +
            '<span class="odds-val">' + Math.round(r[1] * 100) + '%</span></div>';
        }).join('') + '</div>' +
        (focus.revealed ? '' : '<div class="intel-note">Identity odds: ' + topBeliefs(st, viewer, focus) + '</div>') +
        '</div>';
    }

    if (!focus.revealed) {
      const dist = E.beliefFor(st, viewer, g.focus.r, g.focus.c);
      if (!dist) return '';
      return '<div class="intel-section"><div class="intel-label">Tapped piece — identity odds</div>' +
        '<div class="intel-note">' + topBeliefs(st, viewer, focus) + '</div>' +
        '<div class="intel-odds">' + Object.keys(dist).sort(function (a, b) { return dist[b] - dist[a]; }).slice(0, 4).map(function (k) {
          return '<div class="odds-row"><span>' + esc(U.UNIT_DEFS[k].badge) + '</span>' +
            '<span class="odds-bar"><span style="width:' + Math.round(dist[k] * 100) + '%"></span></span>' +
            '<span class="odds-val">' + Math.round(dist[k] * 100) + '%</span></div>';
        }).join('') + '</div></div>';
    }
    return '';
  }

  function topBeliefs(st, viewer, unit) {
    let pos = null;
    for (let r = 0; r < st.rows && !pos; r++) {
      for (let c = 0; c < st.cols; c++) {
        if (st.board[r][c] === unit) { pos = { r: r, c: c }; break; }
      }
    }
    if (!pos) return '';
    const dist = E.beliefFor(st, viewer, pos.r, pos.c) || {};
    const ranked = Object.keys(dist).sort(function (a, b) { return dist[b] - dist[a]; }).slice(0, 3);
    if (!ranked.length) return '';
    return ranked.map(function (k) {
      return U.UNIT_DEFS[k].short + ' ' + Math.round(dist[k] * 100) + '%';
    }).join(' · ');
  }

  /* ── log ───────────────────────────────────────────────────── */

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

  function onTile(r, c) {
    const st = g.state;
    if (!st || g.busy) return;
    if (st.phase === 'over') { g.focus = { r: r, c: c }; renderIntel(); return; }

    if (st.phase === 'deploy1' || st.phase === 'deploy2') {
      const owner = st.phase === 'deploy1' ? 1 : 2;
      if (!E.inDeployZone(st, owner, r)) {
        FX.toast('Deploy inside your own three rows.', 'warn');
        sfx('error');
        return;
      }
      const unit = st.board[r][c];
      if (unit && unit.owner !== owner) return;
      if (!g.sel) {
        g.sel = { r: r, c: c };
        sfx('select');
      } else if (g.sel.r === r && g.sel.c === c) {
        g.sel = null;
        sfx('deselect');
      } else {
        const a = g.sel;
        if (E.swapSlots(st, owner, a, { r: r, c: c })) {
          sfx('swap');
          buzz(10);
          g.sel = null;
        }
      }
      render();
      return;
    }

    // battle
    if (g.thinking) return;
    const humanTurn = isPass() || st.owner === 1;
    const unit = st.board[r][c];

    if (!humanTurn) return;

    // clicking a highlighted target? (must come before the inspect branch,
    // because an attack target is itself an enemy piece)
    if (g.sel) {
      const targets = E.computeValidTargets(st, g.sel.r, g.sel.c, g.mode);
      const hit = targets.filter(function (t) { return t.r === r && t.c === c; })[0];
      if (hit) {
        commitAction(g.sel, { r: r, c: c }, hit.type);
        return;
      }
    }

    // tapping an enemy that is out of reach: inspect it, don't clear selection
    if (unit && unit.owner !== st.owner) {
      g.focus = { r: r, c: c };
      renderIntel();
      sfx('ui');
      return;
    }

    if (unit && unit.owner === st.owner) {
      if (!E.isMovable(unit)) {
        FX.toast(unit.name + ' is immovable — it can never leave that square.', 'warn');
        sfx('error');
        g.sel = null;
        render();
        return;
      }
      if (g.sel && g.sel.r === r && g.sel.c === c) {
        g.sel = null;
        sfx('deselect');
        render();
        return;
      }
      g.sel = { r: r, c: c };
      g.mode = 'move';
      sfx('select');
      buzz(8);
      if (!g.hinted) {
        g.hinted = true;
        FX.toast('Cyan dot = move. Red ring = attack. Tap the square to commit.', 'info');
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
    const attacker = st.board[from.r][from.c];
    const target = st.board[to.r][to.c];

    // Confirm unknown attacks so nobody loses a commander to a stray tap.
    const risky = type === 'attack' && target && !target.revealed && settings().confirmActions !== false;
    if (risky) {
      showOddsConfirm(from, to, type);
      return;
    }
    performAction({ from: from, to: to, type: type });
  }

  function showOddsConfirm(from, to, type) {
    const st = g.state;
    const attacker = st.board[from.r][from.c];
    const target = st.board[to.r][to.c];
    const viewer = st.viewer === 3 ? 1 : st.viewer;
    const dist = E.beliefFor(st, viewer, to.r, to.c) || { '2': 1 };
    let win = 0;
    let lose = 0;
    let both = 0;
    let core = 0;
    Object.keys(dist).forEach(function (k) {
      const p = dist[k];
      const res = AI.predict(attacker.key, k, st.config.tie, false);
      if (res.out === 'core') core += p;
      else if (res.out === 'att') win += p;
      else if (res.out === 'def' || res.out === 'mine') lose += p;
      else if (res.out === 'both') both += p;
    });

    const row = function (label, p, cls) {
      return '<div class="odds-row"><span style="color:' + cls + '">' + label + '</span>' +
        '<span class="odds-bar"><span style="width:' + Math.round(p * 100) + '%"></span></span>' +
        '<span class="odds-val">' + Math.round(p * 100) + '%</span></div>';
    };

    const m = AC.ui.modal({
      kicker: 'Commit attack',
      title: 'Strike an unknown piece?',
      sub: 'You are attacking blind. These odds are averaged over every rank this piece could still be.',
      body:
        '<div class="combat-arena">' +
          '<div class="combat-card ' + (attacker.owner === 1 ? 'solar' : 'void') + '">' +
            '<div class="combat-emblem">' + A.emblem(attacker.key) + '</div>' +
            '<div class="combat-faction">' + U.FACTIONS[attacker.owner].short + '</div>' +
            '<div class="combat-name">' + esc(attacker.name) + '</div>' +
            '<div class="combat-rank">rank ' + esc(attacker.badge) + '</div>' +
          '</div>' +
          '<div class="combat-vs">VS</div>' +
          '<div class="combat-card void">' +
            '<div class="combat-emblem">' + A.emblem('F') + '</div>' +
            '<div class="combat-faction">unknown</div>' +
            '<div class="combat-name">Hidden piece</div>' +
            '<div class="combat-rank">rank ?</div>' +
          '</div>' +
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
    void m;
  }

  function performAction(action) {
    const st = g.state;
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

    const toTile = document.querySelector('.tile[data-r="' + action.to.r + '"][data-c="' + action.to.c + '"]');
    const at = FX.centerOf(toTile);

    let dramatic = null;
    res.events.forEach(function (ev) {
      if (ev.sfx) sfx(ev.sfx);
      if (ev.kind === 'clash' || ev.kind === 'barrage' || ev.kind === 'scan' || ev.kind === 'core') {
        dramatic = ev;
      } else if (ev.kind === 'end' && !dramatic) {
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
        if (ev.kill) FX.float('VAPORISED', at.x, at.y - 16, '#fbbf24');
      } else if (ev.kind === 'scan') {
        FX.spawn(at.x, at.y, { count: 26, color: '#a855f7', speed: 2.4, size: 3 });
        FX.float('SCANNED', at.x, at.y - 16, '#c4b5fd');
      } else if (ev.kind === 'move') {
        FX.spawn(at.x, at.y, { count: 8, color: '#22d3ee', speed: 1.4, size: 1.8, gravity: 0.02 });
      }
    });

    render();

    const finish = function () {
      g.busy = false;
      autosave();
      render();
      if (st.phase === 'over') {
        handleGameOver();
        return;
      }
      if (isAi() && st.owner === 2) {
        scheduleAi();
      } else if (isPass()) {
        showCurtain(st.owner, 'battle');
      }
      startClockIfNeeded();
    };

    if (dramatic && dramatic.kind !== 'end') {
      showCombatModal(dramatic, finish);
    } else if (dramatic && dramatic.kind === 'end') {
      showCombatModal(dramatic, finish);
    } else {
      finish();
    }
  }

  /* ── combat modal ──────────────────────────────────────────── */

  function showCombatModal(ev, done) {
    if (ev.kind === 'end') { if (done) done(); return; }
    const st = g.state;
    const att = ev.unit;
    const def = ev.target;
    const viewer = st.viewer === 3 ? 1 : st.viewer;

    const card = function (u, dead, unknown) {
      if (unknown) {
        return '<div class="combat-card ' + (u.owner === 1 ? 'solar' : 'void') + (dead ? ' dead' : '') + '">' +
          '<div class="combat-emblem">' + A.emblem('F') + '</div>' +
          '<div class="combat-faction">' + U.FACTIONS[u.owner].short + '</div>' +
          '<div class="combat-name">Hidden piece</div>' +
          '<div class="combat-rank">rank ?</div></div>';
      }
      const show = u.owner === viewer || u.revealed || st.phase === 'over' || u.owner === (viewer === 1 ? 2 : 1);
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
      if (ev.outcome === 'att') { title = ev.core ? 'Nexus Core captured' : 'Attacker prevails'; outcomeCls = 'win'; defDead = true; }
      else if (ev.outcome === 'def') { title = 'Defender holds'; outcomeCls = 'lose'; attDead = true; }
      else { title = 'Mutual destruction'; outcomeCls = 'both'; attDead = true; defDead = true; }
      if (ev.core) { title = 'Nexus Core captured'; outcomeCls = 'win'; defDead = true; }
    } else if (ev.kind === 'barrage') {
      kicker = 'Arc Barrage · 2 tiles';
      if (ev.kill) { title = 'Target vaporised'; outcomeCls = 'win'; defDead = true; }
      else if (ev.deflect) { title = 'Bolt deflected'; outcomeCls = 'lose'; }
      else { title = 'Singularity shield absorbed the bolt'; outcomeCls = 'both'; }
    } else if (ev.kind === 'scan') {
      kicker = 'Psionic Scan';
      title = 'Identity revealed';
      outcomeCls = 'win';
    }

    const unknownDef = ev.kind !== 'scan' && def && !def.revealed && st.phase !== 'over' && def.owner !== viewer;
    const body =
      '<div class="combat-arena">' +
        card(att, attDead, false) +
        '<div class="combat-vs">' + (ev.kind === 'scan' ? '◎' : 'VS') + '</div>' +
        card(def, defDead, unknownDef && false) +
      '</div>' +
      '<div class="combat-outcome ' + outcomeCls + '">' + esc(ev.text) + '</div>';

    let fired = false;
    const fire = function () {
      if (fired) return;
      fired = true;
      if (done) done();
    };

    AC.ui.modal({
      kicker: kicker,
      title: title,
      body: body,
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
          E.endGame(st, 1, 'Void Cabal has no legal action left.', []);
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
    if (!st.config.timer || st.phase !== 'battle' || g.thinking) {
      stopClock();
      return;
    }
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
      if (g.timeLeft <= 0) {
        stopClock();
        autoMoveOnTimeout();
      }
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
    const title = isDeploy
      ? 'Pass to ' + U.FACTIONS[nextOwner].name
      : 'Pass to ' + U.FACTIONS[nextOwner].short + ' — turn ' + st.turn;
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
    };
    overlay.querySelector('#curtain-go').addEventListener('click', reveal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) reveal();
    });
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
    const layout = [];
    for (let r = 0; r < st.rows; r++) {
      const row = [];
      for (let c = 0; c < st.cols; c++) {
        const u = st.board[r][c];
        row.push(u && u.owner === owner ? u.key : null);
      }
      layout.push(row);
    }
    AC.ui.promptText({ kicker: 'Formation', title: 'Save this formation', label: 'Formation name', value: 'My formation' })
      .then(function (name) {
        if (!name) return;
        S.saveFormation(name, layout, st.config.board);
        FX.toast('Formation saved.', 'success');
        sfx('save');
        render();
      });
  }

  function applySavedFormation() {
    const st = g.state;
    const owner = st.phase === 'deploy1' ? 1 : 2;
    const list = S.listFormations().filter(function (f) { return f.board === st.config.board; });
    if (!list.length) { FX.toast('No saved formations for this board.', 'warn'); return; }
    const m = AC.ui.modal({
      kicker: 'Formations',
      title: 'Load a formation',
      body: '<div class="save-list">' + list.map(function (f, i) {
        return '<div class="save-card"><div class="save-info"><div class="save-title">' + esc(f.name) + '</div>' +
          '<div class="save-meta">' + U.BOARDS[f.board].label + ' · saved ' + AC.ui.timeAgo(f.createdAt) + '</div></div>' +
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
        if (f) {
          applyLayout(f.layout, owner);
          m.close();
        }
      } else if (drop) {
        const f = list[Number(drop.getAttribute('data-drop'))];
        if (f) { S.deleteFormation(f.id); m.close(); FX.toast('Formation deleted.', 'success'); render(); }
      }
    });
  }

  function applyLayout(layout, owner) {
    const st = g.state;
    const army = [];
    for (let r = 0; r < st.rows; r++) {
      for (let c = 0; c < st.cols; c++) {
        const u = st.board[r][c];
        if (u && u.owner === owner) army.push(u);
      }
    }
    // clear zone
    for (let r = 0; r < st.rows; r++) {
      if (!E.inDeployZone(st, owner, r)) continue;
      for (let c = 0; c < st.cols; c++) st.board[r][c] = null;
    }
    const byKey = {};
    army.forEach(function (u) { (byKey[u.key] = byKey[u.key] || []).push(u); });
    for (let r = 0; r < st.rows; r++) {
      for (let c = 0; c < st.cols; c++) {
        const k = layout[r] && layout[r][c];
        if (!k || !E.inDeployZone(st, owner, r)) continue;
        const pool = byKey[k];
        if (pool && pool.length) st.board[r][c] = pool.pop();
      }
    }
    // anything left goes to any free square
    const leftovers = army.filter(function (u) { return !st.board.some(function (row) { return row.indexOf(u) !== -1; }); });
    for (let r = 0; r < st.rows && leftovers.length; r++) {
      if (!E.inDeployZone(st, owner, r)) continue;
      for (let c = 0; c < st.cols && leftovers.length; c++) {
        if (!st.board[r][c]) st.board[r][c] = leftovers.shift();
      }
    }
    sfx('deploy');
    render();
  }

  /* ── advisor ──────────────────────────────────────────────── */

  function openAdvisor() {
    const st = g.state;
    if (!st || st.phase !== 'battle') { FX.toast('The advisor only speaks during battle.', 'warn'); return; }
    if (g.thinking) return;
    const humanTurn = isPass() || st.owner === 1;
    if (!humanTurn) return;
    const advice = AI.advise(st, st.owner, 3);
    if (!advice.length) { FX.toast('No legal moves available.', 'warn'); return; }
    const m = AC.ui.modal({
      kicker: 'Advisor · ' + (st.owner === 1 ? 'Solaris' : 'Void'),
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
      const b = e.target.closest('[data-adv]');
      if (!b) return;
      const a = advice[Number(b.getAttribute('data-adv'))];
      if (!a) return;
      g.sel = { r: a.action.from.r, c: a.action.from.c };
      g.mode = a.action.type === 'scan' || a.action.type === 'barrage' ? 'special' : 'move';
      m.close();
      render();
      const tile = document.querySelector('.tile[data-r="' + a.action.to.r + '"][data-c="' + a.action.to.c + '"]');
      if (tile) {
        const at = FX.centerOf(tile);
        FX.spawn(at.x, at.y, { count: 14, color: '#34d399', speed: 2 });
      }
    });
  }

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
    const meIsP1 = true;
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

    const title = winner === 0 ? 'Stalemate' : (winner === 1 ? 'Solaris Order triumphs' : 'Void Cabal conquers');
    const cls = winner === 0 ? 'draw' : winner === 1 ? 'win' : 'lose';
    const myOutcome = isAiGame
      ? (outcome === 'win' ? 'Victory — the Void Cabal line is broken.' : outcome === 'loss' ? 'Defeat — your Nexus Core is lost.' : 'Draw — the field is exhausted.')
      : title + '.';

    sfx(winner === 0 ? 'draw' : isAiGame ? (outcome === 'win' ? 'win' : 'lose') : 'win');
    if (winner !== 0) FX.shake(9);

    const m = AC.ui.modal({
      kicker: 'Engagement complete',
      title: '',
      dismissible: false,
      body:
        '<div class="result-hero">' +
          '<div class="result-title ' + cls + '">' + esc(title) + '</div>' +
          '<div class="result-reason">' + esc(st.reason || myOutcome) + '</div>' +
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
    void m;
  }

  g.resign = function () {
    if (!g.state || g.state.phase === 'over') return;
    const loser = g.state.owner;
    E.endGame(g.state, loser === 1 ? 2 : 1, U.FACTIONS[loser].name + ' resigned the engagement.', []);
    handleGameOver();
  };

  /* ── wiring ───────────────────────────────────────────────── */

  function wire() {
    const board = document.getElementById('board');
    board.addEventListener('click', function (e) {
      const tile = e.target.closest('.tile');
      if (!tile) return;
      onTile(Number(tile.getAttribute('data-r')), Number(tile.getAttribute('data-c')));
    });
    board.addEventListener('pointerover', function (e) {
      const tile = e.target.closest('.tile');
      if (!tile || !g.state || g.state.phase !== 'battle') return;
      const r = Number(tile.getAttribute('data-r'));
      const c = Number(tile.getAttribute('data-c'));
      const u = g.state.board[r][c];
      const viewer = g.state.viewer === 3 ? 1 : g.state.viewer;
      if (u && u.owner !== viewer && !u.revealed) {
        if (!g.focus || g.focus.r !== r || g.focus.c !== c) {
          g.focus = { r: r, c: c };
          renderIntel();
        }
      }
    });

    board.addEventListener('keydown', function (e) {
      const tile = e.target.closest('.tile');
      if (!tile) return;
      const r = Number(tile.getAttribute('data-r'));
      const c = Number(tile.getAttribute('data-c'));
      let nr = r;
      let nc = c;
      if (e.key === 'ArrowUp') nr = Math.max(0, r - 1);
      else if (e.key === 'ArrowDown') nr = Math.min(g.state.rows - 1, r + 1);
      else if (e.key === 'ArrowLeft') nc = Math.max(0, c - 1);
      else if (e.key === 'ArrowRight') nc = Math.min(g.state.cols - 1, c + 1);
      else return;
      e.preventDefault();
      const next = document.querySelector('.tile[data-r="' + nr + '"][data-c="' + nc + '"]');
      if (next) next.focus();
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
      if (mode) {
        g.mode = mode.getAttribute('data-mode');
        sfx('ui');
        render();
        return;
      }
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

    let resizeRaf = null;
    window.addEventListener('resize', function () {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(function () {
        layoutBoard();
        g.lastRects = captureRects();
      });
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(layoutBoard, 250);
    });
  }

  g.wire = wire;
  g.render = render;
  g.tile = onTile;
  g.advisor = openAdvisor;
  g.autosave = autosave;

  AC.game = g;
})(typeof globalThis !== 'undefined' ? globalThis : this);
