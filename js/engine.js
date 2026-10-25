/* Aetherfront: Astral Command — pure rules engine
 * No DOM access. Everything here is deterministic given a state + action,
 * so it can be unit-tested and simulated headlessly.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const U = AC.units;
  const VERSION = 2;

  function geometry(boardKey) {
    const b = U.BOARDS[boardKey] || U.BOARDS.small;
    return { cols: b.cols, rows: b.rows, deployRows: b.deployRows, rifts: b.rifts.slice(), boardKey: b.key };
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function isRift(state, r, c) {
    return state.rifts.indexOf(r + ',' + c) !== -1;
  }

  function inBounds(state, r, c) {
    return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
  }

  function unitAt(state, r, c) {
    if (!inBounds(state, r, c)) return null;
    return state.board[r][c];
  }

  function createArmy(owner) {
    return U.ROSTER_ORDER.map(function (key, idx) {
      const def = U.UNIT_DEFS[key];
      return {
        id: 'P' + owner + '_' + key + '_' + idx,
        owner: owner,
        key: key,
        rank: def.rank,
        badge: def.badge,
        name: def.name,
        short: def.short,
        revealed: false,
        hasMoved: false,
        shieldBroken: false,
        moveHistory: []
      };
    });
  }

  function emptyBoard(rows, cols) {
    const b = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push(null);
      b.push(row);
    }
    return b;
  }

  function newState(config) {
    const cfg = Object.assign(
      { mode: 'ai', board: 'small', tie: 'attacker', difficulty: 'veteran', timer: 0, playerName: 'Commander', opponentName: 'Astral AI' },
      config || {}
    );
    const g = geometry(cfg.board);
    const state = {
      version: VERSION,
      config: cfg,
      phase: 'deploy1',
      owner: 1,
      turn: 1,
      viewer: 1,
      cols: g.cols,
      rows: g.rows,
      deployRows: g.deployRows,
      rifts: g.rifts,
      board: emptyBoard(g.rows, g.cols),
      captured: { 1: [], 2: [] },
      log: [],
      replay: [],
      lastMove: null,
      winner: null,
      reason: '',
      stats: { actions: 0, attacks: 0, wins: 0, losses: 0, probes: 0, firstBlood: 0 },
      startedAt: Date.now(),
      preset1: 'citadel',
      preset2: 'citadel'
    };
    deployPreset(state, 1, 'citadel');
    deployPreset(state, 2, 'citadel');
    return state;
  }

  /* ---------- deployment ---------- */

  function zoneRows(state, owner) {
    if (owner === 1) {
      return [state.rows - 1, state.rows - 2, state.rows - 3];
    }
    return [0, 1, 2];
  }

  function inDeployZone(state, owner, r) {
    if (owner === 1) return r >= state.rows - state.deployRows && r < state.rows;
    return r >= 0 && r < state.deployRows;
  }

  function clampCol(cols, c) {
    return Math.max(0, Math.min(cols - 1, c));
  }

  /* Ordered slots for a preset. Each entry is [rowOffset(0=back), col].
   * Cols are expressed for the "left" orientation and mirrored by `flip`. */
  function presetSlots(style, cols, flip) {
    const M = function (c) { return flip ? cols - 1 - c : c; };
    const mid = Math.floor(cols / 2);
    let slots;
    if (style === 'citadel') {
      slots = [
        [0, M(1)], [1, M(1)], [0, M(0)], [1, M(2)],
        [1, M(0)], [2, M(2)], [2, M(3)], [2, M(0)],
        [2, M(cols - 1)], [1, M(3)], [1, M(mid + 1)], [2, M(cols - 2)]
      ];
    } else if (style === 'blitz') {
      slots = [
        [0, mid], [0, mid - 1], [0, mid + 1], [1, mid],
        [2, M(0)], [2, M(cols - 1)], [2, M(1)], [2, M(cols - 2)],
        [2, M(2)], [1, M(1)], [1, M(cols - 2)], [1, M(2)]
      ];
    } else if (style === 'lattice') {
      slots = [
        [0, M(1)], [0, M(cols - 2)], [1, M(2)], [1, M(cols - 3)],
        [0, mid], [2, M(0)], [2, M(cols - 1)], [1, mid],
        [2, M(1)], [2, M(cols - 2)], [2, M(mid - 1)], [2, M(mid + 1)]
      ];
    } else {
      slots = [];
    }
    return slots;
  }

  // Which roster piece goes to which preset slot (same order as presetSlots)
  const PRESET_ORDER = {
    citadel: ['F', 'B', '3', '3', '1', '9', '10', '2', '2', '5', '6', '7'],
    blitz: ['F', 'B', '3', '3', '7', '10', '2', '2', '6', '5', '9', '1'],
    lattice: ['F', 'B', '3', '3', '2', '2', '10', '5', '6', '9', '1', '7']
  };

  function deployPreset(state, owner, style) {
    // clear zone
    for (let r = 0; r < state.rows; r++) {
      if (!inDeployZone(state, owner, r)) continue;
      for (let c = 0; c < state.cols; c++) state.board[r][c] = null;
    }
    const army = createArmy(owner);
    const byKey = {};
    army.forEach(function (u) { (byKey[u.key] = byKey[u.key] || []).push(u); });
    const pull = function (k) {
      const arr = byKey[k];
      return arr && arr.length ? arr.pop() : null;
    };
    const rows = zoneRows(state, owner);

    if (style === 'shuffle' || style === 'random') {
      const slots = [];
      for (let i = 0; i < state.deployRows; i++) {
        for (let c = 0; c < state.cols; c++) slots.push({ r: rows[i], c: c });
      }
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = slots[i]; slots[i] = slots[j]; slots[j] = t;
      }
      // Core always ends up in the back row so a shuffle never self-destructs
      const back = slots.filter(function (s) { return s.r === rows[0]; });
      const core = pull('F');
      const coreSlot = back[Math.floor(Math.random() * back.length)];
      state.board[coreSlot.r][coreSlot.c] = core;
      const rest = slots.filter(function (s) { return !(s.r === coreSlot.r && s.c === coreSlot.c); });
      const others = army.filter(function (u) { return u !== core; });
      // Mine stays in the back two rows
      const mine = others.filter(function (u) { return u.key === 'B'; })[0];
      const mineIdx = rest.findIndex(function (s) { return s.r === rows[0] || s.r === rows[1]; });
      if (mine && mineIdx !== -1) {
        state.board[rest[mineIdx].r][rest[mineIdx].c] = mine;
        rest.splice(mineIdx, 1);
      }
      const pool = others.filter(function (u) { return u !== mine; });
      pool.forEach(function (u, i) {
        const s = rest[i];
        if (s) state.board[s.r][s.c] = u;
      });
      return;
    }

    const flip = Math.random() < 0.5;
    const slots = presetSlots(style, state.cols, flip);
    const order = PRESET_ORDER[style] || PRESET_ORDER.citadel;
    const used = {};
    const placed = [];
    slots.forEach(function (slot, i) {
      const key = order[i];
      const u = pull(key);
      if (!u) return;
      const r = rows[slot[0]];
      const c = clampCol(state.cols, slot[1]);
      if (state.board[r][c]) return; // collision — leave for the filler pass
      state.board[r][c] = u;
      used[u.id] = true;
      placed.push(r + ',' + c);
    });
    // filler: any piece not placed goes to any free zone square
    const leftovers = army.filter(function (u) { return !used[u.id]; });
    if (leftovers.length) {
      const free = [];
      for (let i = 0; i < state.deployRows; i++) {
        for (let c = 0; c < state.cols; c++) {
          if (!state.board[rows[i]][c]) free.push({ r: rows[i], c: c });
        }
      }
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = free[i]; free[i] = free[j]; free[j] = t;
      }
      leftovers.forEach(function (u, i) {
        if (free[i]) state.board[free[i].r][free[i].c] = u;
      });
    }
  }

  function swapSlots(state, owner, a, b) {
    if (!inDeployZone(state, owner, a.r) || !inDeployZone(state, owner, b.r)) return false;
    const ua = state.board[a.r][a.c];
    const ub = state.board[b.r][b.c];
    if (ua && ua.owner !== owner) return false;
    if (ub && ub.owner !== owner) return false;
    state.board[a.r][a.c] = ub;
    state.board[b.r][b.c] = ua;
    return true;
  }

  function armyComplete(state, owner) {
    let n = 0;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const u = state.board[r][c];
        if (u && u.owner === owner) n++;
      }
    }
    return n === 12;
  }

  /* ---------- legality ---------- */

  function violatesTwoSquare(unit, fromR, fromC, toR, toC) {
    const h = unit.moveHistory;
    if (!h || h.length < 3) return false;
    const a = fromR + ',' + fromC;
    const b = toR + ',' + toC;
    const l1 = h[h.length - 1];
    const l2 = h[h.length - 2];
    const l3 = h[h.length - 3];
    return l1.from === b && l1.to === a && l2.from === a && l2.to === b && l3.from === b && l3.to === a;
  }

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function isMovable(unit) {
    const def = unit && U.UNIT_DEFS[unit.key];
    return !!(def && def.movable);
  }

  function computeValidTargets(state, r, c, mode) {
    const unit = unitAt(state, r, c);
    if (!isMovable(unit)) return [];
    const def = U.UNIT_DEFS[unit.key];
    const targets = [];

    if (mode === 'special') {
      if (def.hasScan) {
        for (let tr = 0; tr < state.rows; tr++) {
          for (let tc = 0; tc < state.cols; tc++) {
            const d = Math.abs(tr - r) + Math.abs(tc - c);
            const occ = state.board[tr][tc];
            if (d >= 1 && d <= 2 && occ && occ.owner !== unit.owner && !occ.revealed) {
              targets.push({ r: tr, c: tc, type: 'scan' });
            }
          }
        }
      }
      if (def.hasRanged) {
        DIRS.forEach(function (d) {
          const tr = r + d[0] * 2;
          const tc = c + d[1] * 2;
          if (!inBounds(state, tr, tc) || isRift(state, tr, tc)) return;
          const occ = state.board[tr][tc];
          if (occ && occ.owner !== unit.owner) targets.push({ r: tr, c: tc, type: 'barrage' });
        });
      }
      return targets;
    }

    const maxSteps = def.moveRange;
    DIRS.forEach(function (d) {
      for (let step = 1; step <= maxSteps; step++) {
        const tr = r + d[0] * step;
        const tc = c + d[1] * step;
        if (!inBounds(state, tr, tc)) break;
        if (isRift(state, tr, tc)) break;
        const occ = state.board[tr][tc];
        if (!occ) {
          if (!violatesTwoSquare(unit, r, c, tr, tc)) targets.push({ r: tr, c: tc, type: 'move' });
        } else {
          if (occ.owner !== unit.owner && !violatesTwoSquare(unit, r, c, tr, tc)) {
            targets.push({ r: tr, c: tc, type: 'attack' });
          }
          break;
        }
      }
    });
    return targets;
  }

  function canAct(state, r, c) {
    const u = unitAt(state, r, c);
    if (!isMovable(u)) return false;
    return computeValidTargets(state, r, c, 'move').length > 0 || computeValidTargets(state, r, c, 'special').length > 0;
  }

  function hasAnyLegalMoves(state, player) {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const u = state.board[r][c];
        if (!u || u.owner !== player || !isMovable(u)) continue;
        if (computeValidTargets(state, r, c, 'move').length) return true;
        if (computeValidTargets(state, r, c, 'special').length) return true;
      }
    }
    return false;
  }

  function allLegalActions(state, player) {
    const out = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const u = state.board[r][c];
        if (!u || u.owner !== player || !isMovable(u)) continue;
        computeValidTargets(state, r, c, 'move').forEach(function (t) {
          out.push({ type: t.type, from: { r: r, c: c }, to: { r: t.r, c: t.c } });
        });
        computeValidTargets(state, r, c, 'special').forEach(function (t) {
          out.push({ type: t.type, from: { r: r, c: c }, to: { r: t.r, c: t.c } });
        });
      }
    }
    return out;
  }

  /* ---------- state log helpers ---------- */

  function log(state, kind, text, at) {
    state.log.push({ turn: state.turn, kind: kind, text: text, at: at || null, t: Date.now() });
    if (state.log.length > 400) state.log.shift();
  }

  function compactBoard(state) {
    return state.board.map(function (row) {
      return row.map(function (u) {
        return u ? [u.owner, u.key, u.revealed ? 1 : 0, u.hasMoved ? 1 : 0, u.rank, u.shieldBroken ? 1 : 0] : 0;
      });
    });
  }

  function snapshot(state, label) {
    state.replay.push({
      ply: state.replay.length + 1,
      turn: state.turn,
      owner: state.owner,
      label: label,
      board: compactBoard(state)
    });
    if (state.replay.length > 500) state.replay.shift();
  }

  function faction(owner) {
    return U.FACTIONS[owner] ? U.FACTIONS[owner].name : 'Neutral';
  }

  function removeUnit(state, r, c) {
    const u = state.board[r][c];
    state.board[r][c] = null;
    return u;
  }

  function recordCapture(state, byOwner, dead) {
    dead.revealed = true;
    state.captured[byOwner].push({
      key: dead.key, badge: dead.badge, name: dead.name, owner: dead.owner, rank: dead.rank
    });
  }

  /* ---------- combat ---------- */

  function resolveMelee(state, attacker, defender) {
    // returns { winner:'att'|'def'|'both', text, kind }
    if (defender.key === 'F') {
      return { winner: 'att', core: true, text: attacker.name + ' [' + attacker.badge + '] seized the ' + faction(defender.owner) + ' Nexus Core!' };
    }
    if (defender.key === 'B') {
      const sapper = U.UNIT_DEFS[attacker.key].defusesMines;
      if (sapper) {
        return { winner: 'att', mine: true, text: 'Warp Sapper [3] safely dismantled the Stasis Mine — the lane is open.' };
      }
      return { winner: 'def', mine: true, text: attacker.name + ' [' + attacker.badge + '] struck a Stasis Mine and was annihilated. The mine holds.' };
    }
    if (U.UNIT_DEFS[attacker.key].assassin && (defender.key === '10' || defender.key === '9')) {
      return { winner: 'att', assassinate: true, text: 'Assassination — the Shadow Wraith slipped past the guard and slew the ' + defender.name + ' [' + defender.badge + '].' };
    }
    if (attacker.rank > defender.rank) {
      return { winner: 'att', text: attacker.name + ' [' + attacker.badge + '] overpowered the ' + defender.name + ' [' + defender.badge + '].' };
    }
    if (attacker.rank < defender.rank) {
      return { winner: 'def', text: 'The defending ' + defender.name + ' [' + defender.badge + '] repelled the ' + attacker.name + ' [' + attacker.badge + '].' };
    }
    if (state.config.tie === 'attacker') {
      const before = attacker.rank;
      attacker.rank = Math.max(2, attacker.rank - 1);
      attacker.badge = String(attacker.rank);
      attacker.shieldBroken = true;
      return {
        winner: 'att', shieldBreak: true,
        text: 'Attacker advantage: ' + attacker.name + ' won the Rank ' + before + ' clash — shields cracked, now Rank ' + attacker.rank + '.'
      };
    }
    return { winner: 'both', text: 'Mutual destruction — both Rank ' + attacker.rank + ' units were destroyed.' };
  }

  /* ---------- main action ---------- */

  function applyAction(state, action) {
    const events = [];
    if (state.phase !== 'battle') return { ok: false, error: 'Not in battle phase', events: events };
    const from = action.from;
    const to = action.to;
    const unit = unitAt(state, from.r, from.c);
    if (!unit) return { ok: false, error: 'No unit there', events: events };
    if (unit.owner !== state.owner) return { ok: false, error: 'Not your unit', events: events };
    const legal = computeValidTargets(state, from.r, from.c, action.type === 'move' || action.type === 'attack' ? 'move' : 'special');
    const match = legal.filter(function (t) { return t.r === to.r && t.c === to.c; })[0];
    if (!match) return { ok: false, error: 'Illegal action', events: events };
    const type = match.type; // authoritative
    const target = state.board[to.r][to.c];
    const dist = Math.abs(to.r - from.r) + Math.abs(to.c - from.c);
    state.stats.actions++;

    state.lastMove = { from: from, to: to, type: type };

    /* --- plain move --- */
    if (type === 'move') {
      unit.hasMoved = true;
      unit.moveHistory.push({ from: from.r + ',' + from.c, to: to.r + ',' + to.c });
      state.board[to.r][to.c] = unit;
      state.board[from.r][from.c] = null;
      if (unit.key === '2' && dist >= 2) {
        unit.revealed = true;
        events.push({ kind: 'reveal', text: 'Astral Strider ran ' + dist + ' tiles — its position is now exposed.' });
      } else if (unit.key === '7' && dist === 2) {
        unit.revealed = true;
        events.push({ kind: 'reveal', text: 'Valkyrie Vanguard phase-dashed 2 tiles.' });
      }
      events.push({ kind: 'move', sfx: 'move', from: from, to: to, unit: unit });
      log(state, 'move', faction(unit.owner) + ' advanced a ' + (unit.revealed ? unit.name : 'unit') + '.', to);
      snapshot(state, 'advance');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

    /* --- psionic scan --- */
    if (type === 'scan') {
      unit.revealed = true;
      target.revealed = true;
      events.push({
        kind: 'scan', sfx: 'scan', at: to, unit: unit, target: target,
        text: 'Psionic Scan: ' + target.name + ' [' + target.badge + '] revealed at no cost.'
      });
      log(state, 'scan', 'Chrono Seer scanned the ' + target.name + ' [' + target.badge + '].', to);
      snapshot(state, 'scan');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

    /* --- arc barrage --- */
    if (type === 'barrage') {
      unit.revealed = true;
      target.revealed = true;
      state.stats.attacks++;
      if (target.key === 'F') {
        removeUnit(state, to.r, to.c);
        recordCapture(state, unit.owner, target);
        events.push({
          kind: 'core', sfx: 'core', at: to, unit: unit, target: target, win: true,
          text: 'Arc Barrage punched through the Nexus Core from 2 tiles out. The enemy objective is gone.'
        });
        log(state, 'core', faction(unit.owner) + ' shattered the enemy Nexus Core with an Arc Barrage!', to);
        snapshot(state, 'barrage-core');
        endGame(state, unit.owner, faction(unit.owner) + ' broke the enemy Nexus Core with an Arc Barrage on turn ' + state.turn + '.', events);
        return { ok: true, type: type, events: events };
      }
      if (target.key === 'B') {
        events.push({
          kind: 'barrage', sfx: 'mine', at: to, unit: unit, target: target, noKill: true,
          text: 'The bolt washed over a Stasis Mine — singularity shielding absorbed it. Mine revealed, nothing lost.'
        });
        log(state, 'barrage', 'Arc Barrage splashed off a Stasis Mine (no damage).', to);
      } else if (target.rank >= 0 && target.rank <= 5) {
        removeUnit(state, to.r, to.c);
        recordCapture(state, unit.owner, target);
        state.stats.wins++;
        events.push({
          kind: 'barrage', sfx: 'laser', at: to, unit: unit, target: target, kill: true,
          text: 'Arc Barrage vaporised the ' + target.name + ' [' + target.badge + '] at range. The Lancer never left its square.'
        });
        log(state, 'barrage', 'Arc Barrage vaporised the ' + target.name + ' [' + target.badge + '].', to);
      } else {
        events.push({
          kind: 'barrage', sfx: 'clash', at: to, unit: unit, target: target, deflect: true,
          text: 'Heavy Rank ' + target.badge + ' shielding deflected the bolt. Both units are now revealed.'
        });
        log(state, 'barrage', 'Arc Barrage was deflected by the ' + target.name + ' [' + target.badge + '].', to);
      }
      snapshot(state, 'barrage');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

    /* --- melee attack --- */
    unit.hasMoved = true;
    unit.moveHistory.push({ from: from.r + ',' + from.c, to: to.r + ',' + to.c });
    unit.revealed = true;
    target.revealed = true;
    state.stats.attacks++;

    const res = resolveMelee(state, unit, target);

    if (res.winner === 'att') {
      state.board[to.r][to.c] = unit;
      state.board[from.r][from.c] = null;
      recordCapture(state, unit.owner, target);
      state.stats.wins++;
    } else if (res.winner === 'def') {
      state.board[from.r][from.c] = null;
      if (res.mine) {
        // mine survives, stays put; attacker removed from board
        state.board[to.r][to.c] = target;
      } else {
        recordCapture(state, target.owner, unit);
      }
      if (res.mine) recordCapture(state, target.owner, unit);
      state.stats.losses++;
    } else {
      state.board[to.r][to.c] = null;
      state.board[from.r][from.c] = null;
      recordCapture(state, unit.owner, target);
      recordCapture(state, target.owner, unit);
      state.stats.wins++;
      state.stats.losses++;
    }

    if (state.stats.firstBlood === 0 && (res.winner === 'att' || res.winner === 'both')) {
      state.stats.firstBlood = state.turn;
    }

    const ev = {
      kind: 'clash',
      sfx: res.winner === 'att' ? 'clash-win' : res.winner === 'def' ? 'clash-lose' : 'clash-both',
      at: to,
      unit: unit,
      target: target,
      outcome: res.winner,
      core: !!res.core,
      text: res.text
    };
    events.push(ev);
    log(state, 'clash', res.text, to);
    snapshot(state, 'clash');

    if (res.core) {
      endGame(state, unit.owner, faction(unit.owner) + ' captured the enemy Nexus Core on turn ' + state.turn + '.', events);
      return { ok: true, type: type, events: events };
    }
    finishTurn(state, events);
    return { ok: true, type: type, events: events };
  }

  function endGame(state, winner, reason, events) {
    state.phase = 'over';
    state.winner = winner;
    state.reason = reason;
    state.viewer = 3;
    log(state, 'end', reason);
    snapshot(state, 'end');
    if (events) events.push({ kind: 'end', sfx: winner === 0 ? 'draw' : 'win', winner: winner, text: reason });
  }

  function finishTurn(state, events) {
    if (state.phase === 'over') return;
    const next = state.owner === 1 ? 2 : 1;
    const nextHas = hasAnyLegalMoves(state, next);
    const curHas = hasAnyLegalMoves(state, state.owner);
    if (!nextHas && !curHas) {
      endGame(state, 0, 'Stalemate — neither commander has a legal action left.', events);
      return;
    }
    if (!nextHas) {
      endGame(state, state.owner, faction(next) + ' has no legal action left — the field is conceded.', events);
      return;
    }
    state.owner = next;
    if (next === 1) state.turn++;
    events.push({ kind: 'turn', owner: next, turn: state.turn });
  }

  function beginBattle(state) {
    state.phase = 'battle';
    state.owner = 1;
    state.turn = 1;
    state.viewer = 1;
    log(state, 'info', 'Battle stations. ' + faction(1) + ' opens the engagement.');
    snapshot(state, 'battle-start');
  }

  /* ---------- intel helpers (used by AI and by the UI intel panel) ---------- */

  // Which enemy roster keys are still unaccounted for (not visible/revealed, not captured)
  function unknownPool(state, viewer) {
    const foe = viewer === 1 ? 2 : 1;
    const remaining = {};
    U.ROSTER_ORDER.forEach(function (k) { remaining[k] = (remaining[k] || 0) + 1; });
    // captured by the viewer's opponent (i.e. our own losses) are irrelevant
    // remove pieces of the foe that we can see on the board (revealed or otherwise visible)
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const u = state.board[r][c];
        if (!u || u.owner !== foe) continue;
        if (u.revealed) remaining[u.key] = Math.max(0, (remaining[u.key] || 0) - 1);
      }
    }
    // remove foe pieces captured by the viewer
    (state.captured[viewer] || []).forEach(function (d) {
      remaining[d.key] = Math.max(0, (remaining[d.key] || 0) - 1);
    });
    return remaining;
  }

  /* Probability distribution over what an unknown enemy unit could be.
   * Immovable pieces (Nexus, Mine) can only be candidates while the unit has
   * never moved; that single constraint is what makes probing worthwhile. */
  function beliefFor(state, viewer, r, c) {
    const u = state.board[r][c];
    const pool = unknownPool(state, viewer);
    if (!u || u.owner === viewer || u.revealed) return null;
    const out = {};
    let total = 0;
    Object.keys(pool).forEach(function (k) {
      const n = pool[k];
      if (n <= 0) return;
      if (u.hasMoved && (k === 'F' || k === 'B')) return;
      out[k] = n;
      total += n;
    });
    if (!total) {
      // fall back: everything already seen — treat as generic line unit
      return { '2': 1 };
    }
    Object.keys(out).forEach(function (k) { out[k] = out[k] / total; });
    return out;
  }

  /* ---------- serialisation ---------- */

  function serialize(state) {
    const copy = clone(state);
    copy.savedAt = Date.now();
    return copy;
  }

  function deserialize(raw) {
    let s = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
    if (!s || !s.board) throw new Error('Corrupt save');
    // migrate older saves defensively
    if (!s.captured) s.captured = { 1: [], 2: [] };
    if (!s.log) s.log = [];
    if (!s.replay) s.replay = [];
    if (!s.stats) s.stats = { actions: 0, attacks: 0, wins: 0, losses: 0, probes: 0, firstBlood: 0 };
    if (!s.config) s.config = { mode: 'ai', board: 'small', tie: 'attacker', difficulty: 'veteran' };
    return s;
  }

  function thumbnailBoard(state) {
    return compactBoard(state);
  }

  AC.engine = {
    VERSION: VERSION,
    geometry: geometry,
    newState: newState,
    createArmy: createArmy,
    clone: clone,
    isRift: isRift,
    inBounds: inBounds,
    unitAt: unitAt,
    inDeployZone: inDeployZone,
    zoneRows: zoneRows,
    deployPreset: deployPreset,
    swapSlots: swapSlots,
    armyComplete: armyComplete,
    computeValidTargets: computeValidTargets,
    canAct: canAct,
    isMovable: isMovable,
    hasAnyLegalMoves: hasAnyLegalMoves,
    allLegalActions: allLegalActions,
    applyAction: applyAction,
    beginBattle: beginBattle,
    endGame: endGame,
    unknownPool: unknownPool,
    beliefFor: beliefFor,
    serialize: serialize,
    deserialize: deserialize,
    thumbnailBoard: thumbnailBoard,
    faction: faction,
    log: log
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
