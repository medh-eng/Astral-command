/* Aetherfront: Astral Command — pure rules engine (v3)
 * Works on a cell graph: `state.board` maps cellId -> unit, and movement is
 * read off each cell's "rays". No DOM, no coordinates, no assumptions about
 * squares — the same code drives the square arenas and the Chakravyuha wheel.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const U = AC.units;
  const G = AC.geometry;
  const VERSION = 3;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── board helpers ───────────────────────────────────────────── */

  function board(state) { return G.build(state.boardKey); }

  function isRift(state, id) { return state.rifts.indexOf(id) !== -1; }

  function unitAt(state, id) {
    if (!id) return null;
    return state.board[id] || null;
  }

  function cellOf(state, id) { return board(state).byId[id] || null; }

  function cellIds(state) { return board(state).cellIds; }

  function forEachUnit(state, fn) {
    const ids = cellIds(state);
    for (let i = 0; i < ids.length; i++) {
      const u = state.board[ids[i]];
      if (u) fn(u, ids[i]);
    }
  }

  function createArmy(owner, keys) {
    const roster = keys || U.ROSTER_ORDER;
    return roster.map(function (key, idx) {
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

  function newState(config) {
    const cfg = Object.assign({
      mode: 'ai', board: 'small', tie: 'attacker', difficulty: 'veteran', scenario: 'duel',
      timer: 0, drawAfter: 100, playerName: 'Commander', opponentName: 'Astral AI'
    }, config || {});
    const scenario = U.SCENARIOS[cfg.scenario] || U.SCENARIOS.duel;
    if (cfg.facing == null) cfg.facing = false;
    if (scenario.boards && scenario.boards.indexOf(cfg.board) === -1) cfg.board = scenario.boards[0];
    const g = G.build(cfg.board);
    const state = {
      version: VERSION,
      config: cfg,
      boardKey: g.key,
      phase: 'deploy1',
      owner: 1,
      turn: 1,
      viewer: 1,
      rifts: g.rifts.slice(),
      board: {},
      homes: { 1: (g.homes && g.homes[1]) || null, 2: (g.homes && g.homes[2]) || null },
      captured: { 1: [], 2: [] },
      log: [],
      replay: [],
      lastMove: null,
      winner: null,
      reason: '',
      scenario: scenario.key,
      rosters: {
        1: (scenario.rosters && scenario.rosters[1]) ? scenario.rosters[1].slice() : U.ROSTER_ORDER.slice(),
        2: (scenario.rosters && scenario.rosters[2]) ? scenario.rosters[2].slice() : U.ROSTER_ORDER.slice()
      },
      turnLimit: scenario.turnLimit || 0,
      rotation: { count: 0, lastTurn: 0, every: g.rotateEvery || 0, rings: (g.rotateRings || []).slice() },
      stats: { actions: 0, attacks: 0, wins: 0, losses: 0, probes: 0, firstBlood: 0, lastCapturePly: 0 },
      startedAt: Date.now()
    };
    state.homes = { 1: g.homes[1], 2: g.homes[2] };
    deployPreset(state, 1, 'citadel');
    deployPreset(state, 2, 'citadel');
    return state;
  }

  /* ── deployment ──────────────────────────────────────────────── */

  function inDeployZone(state, owner, id) {
    const cell = cellOf(state, id);
    return !!cell && cell.zone === owner;
  }

  /* Point every piece at the enemy fort when it is placed. */
  function faceTowardEnemy(state, owner) {
    if (!state.config.facing) return;
    const g = board(state);
    const sides = g.sides || 0;
    if (!sides) return;
    const foeHome = state.homes[owner === 1 ? 2 : 1];
    if (!foeHome) return;
    const dist = G.distances(state.boardKey, foeHome);
    forEachUnit(state, function (u, id) {
      if (u.owner !== owner) return;
      let best = 0;
      let bestD = Infinity;
      (g.rays[id] || []).forEach(function (line, i) {
        const head = line[0];
        if (head && dist[head] < bestD) { bestD = dist[head]; best = i; }
      });
      u.facing = best;
    });
  }

  function armyComplete(state, owner) {
    let n = 0;
    forEachUnit(state, function (u) { if (u.owner === owner) n++; });
    return n === rosterOf(state, owner).length;
  }

  function rosterOf(state, owner) {
    return (state.rosters && state.rosters[owner]) ? state.rosters[owner] : U.ROSTER_ORDER;
  }

  function groupArmy(army) {
    const byKey = {};
    army.forEach(function (u) { (byKey[u.key] = byKey[u.key] || []).push(u); });
    return {
      pull: function (k) {
        const arr = byKey[k];
        return arr && arr.length ? arr.pop() : null;
      },
      left: function () {
        const out = [];
        Object.keys(byKey).forEach(function (k) { byKey[k].forEach(function (u) { out.push(u); }); });
        return out;
      }
    };
  }

  /* Square arenas keep their hand-tuned formations. */
  function squarePresetSlots(style, cols, flip) {
    const M = function (c) { return flip ? cols - 1 - c : c; };
    const mid = Math.floor(cols / 2);
    if (style === 'citadel') {
      return [
        [0, M(1)], [1, M(1)], [0, M(0)], [1, M(2)],
        [1, M(0)], [2, M(2)], [2, M(3)], [2, M(0)],
        [2, M(cols - 1)], [1, M(3)], [1, M(mid + 1)], [2, M(cols - 2)]
      ];
    }
    if (style === 'blitz') {
      return [
        [0, mid], [0, mid - 1], [0, mid + 1], [1, mid],
        [2, M(0)], [2, M(cols - 1)], [2, M(1)], [2, M(cols - 2)],
        [2, M(2)], [1, M(1)], [1, M(cols - 2)], [1, M(2)]
      ];
    }
    if (style === 'lattice') {
      return [
        [0, M(1)], [0, M(cols - 2)], [1, M(2)], [1, M(cols - 3)],
        [0, mid], [2, M(0)], [2, M(cols - 1)], [1, mid],
        [2, M(1)], [2, M(cols - 2)], [2, M(mid - 1)], [2, M(mid + 1)]
      ];
    }
    return [];
  }

  const SQUARE_ORDER = {
    citadel: ['F', 'B', '3', '3', '1', '9', '10', '2', '2', '5', '6', '7'],
    blitz: ['F', 'B', '3', '3', '7', '10', '2', '2', '6', '5', '9', '1'],
    lattice: ['F', 'B', '3', '3', '2', '2', '10', '5', '6', '9', '1', '7']
  };

  function clearZone(state, owner) {
    board(state).zones[owner].forEach(function (id) { state.board[id] = null; });
  }

  function deploySquare(state, owner, style) {
    const g = board(state);
    clearZone(state, owner);
    const army = createArmy(owner, rosterOf(state, owner));
    const grp = groupArmy(army);

    if (style === 'shuffle' || style === 'random') {
      const slots = g.zones[owner].slice();
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = slots[i]; slots[i] = slots[j]; slots[j] = t;
      }
      const core = grp.pull('F');
      state.board[slots[0]] = core;
      const rest = slots.slice(1);
      const mine = grp.pull('B');
      // the mine goes somewhere in the back half of the zone
      const home = state.homes[owner];
      const dist = G.distances(state.boardKey, home);
      rest.sort(function (a, b) { return dist[a] - dist[b]; });
      state.board[rest[0]] = mine;
      const free = rest.slice(1);
      grp.left().forEach(function (u, i) {
        if (free[i]) state.board[free[i]] = u;
      });
      return;
    }

    const flip = Math.random() < 0.5;
    const slots = squarePresetSlots(style, g.cols, flip);
    const order = SQUARE_ORDER[style] || SQUARE_ORDER.citadel;
    const rows = owner === 1
      ? [g.rows - 1, g.rows - 2, g.rows - 3]
      : [0, 1, 2];
    const used = {};
    slots.forEach(function (slot, i) {
      const id = rows[slot[0]] + ',' + Math.max(0, Math.min(g.cols - 1, slot[1]));
      if (state.board[id]) return;          // occupied: never pull a piece we cannot place
      const u = grp.pull(order[i]);
      if (!u) return;
      state.board[id] = u;
      used[u.id] = true;
    });
    const leftovers = grp.left();
    if (leftovers.length) {
      const free = g.zones[owner].filter(function (id) { return !state.board[id]; });
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = free[i]; free[i] = free[j]; free[j] = t;
      }
      leftovers.forEach(function (u, i) { if (free[i]) state.board[free[i]] = u; });
    }
  }

  /* The wheel deploys by distance from home: core and mine sit deep, scouts
   * reach out toward the rim of your own half. */
  function deployWheel(state, owner, style) {
    const g = board(state);
    clearZone(state, owner);
    const army = createArmy(owner, rosterOf(state, owner));
    const grp = groupArmy(army);
    const home = state.homes[owner];
    const dist = G.distances(state.boardKey, home);
    // Deploy from the back of your own half outward: the raiders start on
    // their rim, outside the wheel, and have to break in.
    const zone = g.zones[owner].slice().sort(function (a, b) {
      if (dist[a] !== dist[b]) return dist[a] - dist[b];
      return a < b ? -1 : 1;
    });

    if (style === 'shuffle' || style === 'random') {
      const order = ['F', 'B', '3', '3', '2', '2', '5', '6', '7', '9', '10', '1'];
      order.forEach(function (k, i) {
        const u = grp.pull(k);
        if (u && zone[i]) state.board[zone[i]] = u;
      });
      return;
    }

    const order = style === 'blitz'
      ? ['F', 'B', '3', '3', '7', '10', '2', '2', '6', '5', '9', '1']
      : style === 'lattice'
        ? ['F', 'B', '3', '3', '2', '2', '10', '5', '6', '9', '1', '7']
        : ['F', 'B', '3', '3', '5', '6', '9', '10', '7', '2', '2', '1'];

    if (style === 'blitz') {
      // heavies on the rim, the fort tucked at the back
      const back = zone.slice(0, 4);
      const front = zone.slice(4).reverse();
      order.forEach(function (k) {
        const u = grp.pull(k);
        if (!u) return;
        const cell = back.shift() || front.shift();
        if (cell) state.board[cell] = u;
      });
      return;
    }

    // walk the zone in order, skipping only cells we actually fill, so a
    // smaller roster never leaves holes behind the line
    let cursor = 0;
    order.forEach(function (k) {
      const u = grp.pull(k);
      if (!u) return;
      while (cursor < zone.length && state.board[zone[cursor]]) cursor++;
      if (cursor < zone.length) state.board[zone[cursor]] = u;
    });
  }

  function deployPreset(state, owner, style) {
    if (state.boardKey === 'wheel') deployWheel(state, owner, style);
    else deploySquare(state, owner, style);
  }

  function swapSlots(state, owner, a, b) {
    if (!inDeployZone(state, owner, a) || !inDeployZone(state, owner, b)) return false;
    const ua = state.board[a];
    const ub = state.board[b];
    if (ua && ua.owner !== owner) return false;
    if (ub && ub.owner !== owner) return false;
    state.board[a] = ub || null;
    state.board[b] = ua || null;
    return true;
  }

  /* ── legality ────────────────────────────────────────────────── */

  function violatesTwoSquare(unit, fromId, toId) {
    const h = unit.moveHistory;
    if (!h || h.length < 3) return false;
    const l1 = h[h.length - 1];
    const l2 = h[h.length - 2];
    const l3 = h[h.length - 3];
    return l1.from === toId && l1.to === fromId &&
      l2.from === fromId && l2.to === toId &&
      l3.from === toId && l3.to === fromId;
  }

  function isMovable(unit) {
    const def = unit && U.UNIT_DEFS[unit.key];
    return !!(def && def.movable);
  }

  /* Walk the rays out from a cell. Stops at a rift, at an occupied cell, and
   * at the unit's own range. */
  function rayTargets(state, id, range, unit) {
    const g = board(state);
    const out = [];
    (g.rays[id] || []).forEach(function (line, dir) {
      for (let i = 0; i < line.length && i < range; i++) {
        const to = line[i];
        if (isRift(state, to)) break;
        const occ = state.board[to];
        if (!occ) {
          if (!violatesTwoSquare(unit, id, to)) out.push({ id: to, type: 'move', dir: dir });
        } else {
          if (occ.owner !== unit.owner && !violatesTwoSquare(unit, id, to)) {
            out.push({ id: to, type: 'attack', dir: dir });
          }
          break;
        }
      }
    });
    return out;
  }

  function scanTargets(state, id, unit) {
    const g = board(state);
    const out = [];
    const seen = {};
    seen[id] = 1;
    let frontier = [id];
    for (let step = 0; step < 2; step++) {
      const next = [];
      frontier.forEach(function (from) {
        (g.neighbours[from] || []).forEach(function (n) {
          if (seen[n] || isRift(state, n)) return;
          seen[n] = 1;
          next.push(n);
          const occ = state.board[n];
          if (occ && occ.owner !== unit.owner && !occ.revealed) out.push({ id: n, type: 'scan' });
        });
      });
      frontier = next;
    }
    return out;
  }

  function barrageTargets(state, id, unit) {
    const g = board(state);
    const out = [];
    (g.rays[id] || []).forEach(function (line) {
      const to = line[1]; // exactly two cells away
      if (!to) return;
      if (isRift(state, to)) return;
      const occ = state.board[to];
      if (occ && occ.owner !== unit.owner) out.push({ id: to, type: 'barrage' });
    });
    return out;
  }

  function computeValidTargets(state, id, mode) {
    const unit = unitAt(state, id);
    if (!isMovable(unit)) return [];
    const def = U.UNIT_DEFS[unit.key];
    if (mode === 'special') {
      let out = [];
      if (def.hasScan) out = out.concat(scanTargets(state, id, unit));
      if (def.hasRanged) out = out.concat(barrageTargets(state, id, unit));
      return out;
    }
    return rayTargets(state, id, def.moveRange, unit);
  }

  function canAct(state, id) {
    if (!isMovable(unitAt(state, id))) return false;
    return computeValidTargets(state, id, 'move').length > 0 ||
      computeValidTargets(state, id, 'special').length > 0;
  }

  function hasAnyLegalMoves(state, player) {
    const ids = cellIds(state);
    for (let i = 0; i < ids.length; i++) {
      const u = state.board[ids[i]];
      if (!u || u.owner !== player || !isMovable(u)) continue;
      if (computeValidTargets(state, ids[i], 'move').length) return true;
      if (computeValidTargets(state, ids[i], 'special').length) return true;
    }
    return false;
  }

  function allLegalActions(state, player) {
    const out = [];
    const ids = cellIds(state);
    ids.forEach(function (id) {
      const u = state.board[id];
      if (!u || u.owner !== player || !isMovable(u)) return;
      computeValidTargets(state, id, 'move').forEach(function (t) {
        out.push({ type: t.type, from: id, to: t.id });
      });
      computeValidTargets(state, id, 'special').forEach(function (t) {
        out.push({ type: t.type, from: id, to: t.id });
      });
    });
    return out;
  }

  /* ── log / replay ────────────────────────────────────────────── */

  function log(state, kind, text, at) {
    state.log.push({ turn: state.turn, kind: kind, text: text, at: at || null, t: Date.now() });
    if (state.log.length > 400) state.log.shift();
  }

  function compactBoard(state) {
    const out = { boardKey: state.boardKey, cells: {} };
    forEachUnit(state, function (u, id) {
      out.cells[id] = [u.owner, u.key, u.revealed ? 1 : 0, u.hasMoved ? 1 : 0, u.rank, u.shieldBroken ? 1 : 0];
    });
    return out;
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

  function faction(owner) { return U.FACTIONS[owner] ? U.FACTIONS[owner].name : 'Neutral'; }

  function recordCapture(state, byOwner, dead) {
    dead.revealed = true;
    state.stats.lastCapturePly = state.stats.actions;
    state.captured[byOwner].push({
      key: dead.key, badge: dead.badge, name: dead.name, owner: dead.owner, rank: dead.rank
    });
  }

  /* ── combat ──────────────────────────────────────────────────── */

  /* Facing (hex fields only): each piece faces one of six edges, set by its
   * last move. A strike into the rear — the opposite edge — ignores rank. */
  function isRearStrike(state, action, defender) {
    if (!state.config.facing) return false;
    if (action.dir == null || defender.facing == null) return false;
    const g = board(state);
    const sides = g.sides || (g.rays[action.from] || []).length;
    if (!sides) return false;
    return ((defender.facing + Math.floor(sides / 2)) % sides) === action.dir;
  }

  function resolveMelee(state, attacker, defender, rear) {
    if (defender.key === 'F') {
      return { winner: 'att', core: true, text: attacker.name + ' [' + attacker.badge + '] seized the ' + faction(defender.owner) + ' fort!' };
    }
    if (defender.key === 'B') {
      if (U.UNIT_DEFS[attacker.key].defusesMines) {
        return { winner: 'att', mine: true, text: 'The Yantrik safely dismantled the Shataghni — the lane is open.' };
      }
      return { winner: 'def', mine: true, text: attacker.name + ' [' + attacker.badge + '] struck a Shataghni and was annihilated. The trap holds.' };
    }
    if (rear) {
      return {
        winner: 'att', rear: true,
        text: attacker.name + ' struck the ' + defender.name + ' [' + defender.badge + '] from behind — rank did not count.'
      };
    }
    if (U.UNIT_DEFS[attacker.key].assassin && (defender.key === '10' || defender.key === '9')) {
      return { winner: 'att', assassinate: true, text: 'Assassination — the spy slipped past the guard and slew the ' + defender.name + ' [' + defender.badge + '].' };
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

  /* ── the chakra turns ────────────────────────────────────────── */

  function rotate(state, events) {
    const g = board(state);
    // the lotus field keeps its own ring ordering; the wheel uses ring/sector ids
    if (g.kind === 'hex' && g.rotationOrder) {
      let movedHex = 0;
      Object.keys(g.rotationOrder).forEach(function (ring) {
        const order = g.rotationOrder[ring];
        const held = order.map(function (id) { return state.board[id] || null; });
        order.forEach(function (id) { state.board[id] = null; });
        held.forEach(function (u, i) {
          if (!u) return;
          const to = order[(i + 1) % order.length];
          state.board[to] = u;
          u.revealed = true;
          movedHex++;
        });
      });
      state.rotation.count++;
      state.rotation.lastTurn = state.turn;
      if (movedHex) {
        events.push({ kind: 'rotate', sfx: 'rotate', text: 'The lotus turns — ' + movedHex + ' pieces shift and are exposed.' });
        log(state, 'The lotus turns. The rings shift one cell.', 'rotate');
      }
      return movedHex > 0;
    }
    if (state.boardKey !== 'wheel') return false;
    const rings = state.rotation.rings.length ? state.rotation.rings : [1, 2];
    let moved = 0;
    rings.forEach(function (ring) {
      const held = {};
      for (let s = 0; s < g.sectors; s++) {
        const id = 'r' + ring + 's' + s;
        if (state.board[id]) held[s] = state.board[id];
        state.board[id] = null;
      }
      Object.keys(held).forEach(function (s) {
        const ns = (Number(s) + 1) % g.sectors;
        const u = held[s];
        state.board['r' + ring + 's' + ns] = u;
        u.revealed = true; // riding the wheel exposes you
        moved++;
      });
    });
    state.rotation.count++;
    state.rotation.lastTurn = state.turn;
    if (moved) {
      log(state, 'rotate', 'The chakra turns: the inner two rings shift one spoke clockwise. Anything on them is exposed.');
      if (events) {
        events.push({
          kind: 'rotate', sfx: 'rotate',
          text: 'The chakra turns — rings 1 and 2 shifted one spoke. Everything they carried is now revealed.'
        });
      }
    }
    return moved > 0;
  }

  function turnsUntilRotation(state) {
    if (state.boardKey !== 'wheel') return null;
    const every = state.rotation.every || 5;
    const next = Math.ceil(state.turn / every) * every;
    const gap = next - state.turn;
    return gap === 0 ? every : gap;
  }

  /* ── main action ─────────────────────────────────────────────── */

  function applyAction(state, action) {
    const events = [];
    if (state.phase !== 'battle') return { ok: false, error: 'Not in battle phase', events: events };
    const from = action.from;
    const to = action.to;
    const unit = unitAt(state, from);
    if (!unit) return { ok: false, error: 'No unit there', events: events };
    if (unit.owner !== state.owner) return { ok: false, error: 'Not your unit', events: events };

    const mode = (action.type === 'move' || action.type === 'attack') ? 'move' : 'special';
    const legal = computeValidTargets(state, from, mode);
    const match = legal.filter(function (t) { return t.id === to; })[0];
    if (!match) return { ok: false, error: 'Illegal action', events: events };
    const type = match.type;
    const target = state.board[to] || null;
    const dist = (function () {
      const d = G.distances(state.boardKey, from);
      return d[to] === undefined ? 1 : d[to];
    })();
    state.stats.actions++;
    state.lastMove = { from: from, to: to, type: type };

    /* ── plain move ── */
    if (type === 'move') {
      unit.hasMoved = true;
      unit.moveHistory.push({ from: from, to: to });
      state.board[to] = unit;
      state.board[from] = null;
      if (unit.key === '2' && dist >= 2) {
        unit.revealed = true;
        events.push({ kind: 'reveal', text: 'The chariot ran ' + dist + ' cells — its position is now exposed.' });
      } else if (unit.key === '7' && dist === 2) {
        unit.revealed = true;
        events.push({ kind: 'reveal', text: 'The cavalry dashed two cells.' });
      }
      if (to === 'h') {
        unit.revealed = true;
        events.push({ kind: 'reveal', text: 'Standing on the hub of the chakra exposes a piece to every spoke.' });
      }
      events.push({ kind: 'move', sfx: 'move', from: from, to: to, unit: unit });
      log(state, 'move', faction(unit.owner) + ' advanced a ' + (unit.revealed ? unit.name : 'unit') + '.', to);
      snapshot(state, 'advance');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

    /* ── psionic scan ── */
    if (type === 'scan') {
      unit.revealed = true;
      target.revealed = true;
      events.push({
        kind: 'scan', sfx: 'scan', at: to, unit: unit, target: target,
        text: 'Divya-drishti: ' + target.name + ' [' + target.badge + '] revealed at no cost.'
      });
      log(state, 'scan', 'The Divyadrishti scanned the ' + target.name + ' [' + target.badge + '].', to);
      snapshot(state, 'scan');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

    /* ── arc barrage ── */
    if (type === 'barrage') {
      unit.revealed = true;
      target.revealed = true;
      state.stats.attacks++;
      if (target.key === 'F') {
        state.board[to] = null;
        recordCapture(state, unit.owner, target);
        events.push({
          kind: 'core', sfx: 'core', at: to, unit: unit, target: target, win: true,
          text: 'Shara-varsha punched through the fort from two cells out. The enemy objective is gone.'
        });
        log(state, 'core', faction(unit.owner) + ' shattered the enemy fort with a volley!', to);
        snapshot(state, 'barrage-core');
        endGame(state, unit.owner, faction(unit.owner) + ' broke the enemy fort with a volley on turn ' + state.turn + '.', events);
        return { ok: true, type: type, events: events };
      }
      if (target.key === 'B') {
        events.push({
          kind: 'barrage', sfx: 'mine', at: to, unit: unit, target: target, noKill: true,
          text: 'The volley washed over a Shataghni — its shield absorbed the arrows. Trap revealed, nothing lost.'
        });
        log(state, 'barrage', 'The volley splashed off a Shataghni (no damage).', to);
      } else if (target.rank >= 0 && target.rank <= 5) {
        state.board[to] = null;
        recordCapture(state, unit.owner, target);
        state.stats.wins++;
        events.push({
          kind: 'barrage', sfx: 'laser', at: to, unit: unit, target: target, kill: true,
          text: 'The volley cut down the ' + target.name + ' [' + target.badge + '] at range. The archer never left its cell.'
        });
        log(state, 'barrage', 'The volley cut down the ' + target.name + ' [' + target.badge + '].', to);
      } else {
        events.push({
          kind: 'barrage', sfx: 'clash', at: to, unit: unit, target: target, deflect: true,
          text: 'Heavy Rank ' + target.badge + ' armour turned the volley. Both pieces are now revealed.'
        });
        log(state, 'barrage', 'The volley was turned by the ' + target.name + ' [' + target.badge + '].', to);
      }
      snapshot(state, 'barrage');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

    /* ── melee ── */
    if (state.config.facing && action.dir != null) unit.facing = action.dir;
    unit.hasMoved = true;
    unit.moveHistory.push({ from: from, to: to });
    unit.revealed = true;
    target.revealed = true;
    state.stats.attacks++;

    const rear = isRearStrike(state, action, target);
    const res = resolveMelee(state, unit, target, rear);

    if (res.winner === 'att') {
      state.board[to] = unit;
      state.board[from] = null;
      recordCapture(state, unit.owner, target);
      state.stats.wins++;
    } else if (res.winner === 'def') {
      state.board[from] = null;
      if (res.mine) state.board[to] = target;
      recordCapture(state, target.owner, unit);
      state.stats.losses++;
    } else {
      state.board[to] = null;
      state.board[from] = null;
      recordCapture(state, unit.owner, target);
      recordCapture(state, target.owner, unit);
      state.stats.wins++;
      state.stats.losses++;
    }

    if (state.stats.firstBlood === 0 && (res.winner === 'att' || res.winner === 'both')) {
      state.stats.firstBlood = state.turn;
    }

    events.push({
      kind: 'clash',
      sfx: res.winner === 'att' ? 'clash-win' : res.winner === 'def' ? 'clash-lose' : 'clash-both',
      at: to,
      unit: unit,
      target: target,
      outcome: res.winner,
      core: !!res.core,
      text: res.text
    });
    log(state, 'clash', res.text, to);
    snapshot(state, 'clash');

    if (res.core) {
      endGame(state, unit.owner, faction(unit.owner) + ' captured the enemy fort on turn ' + state.turn + '.', events);
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
    const limit = state.config.drawAfter || 100;
    if (state.stats.actions - state.stats.lastCapturePly >= limit) {
      endGame(state, 0, 'No piece captured in ' + limit + ' orders — the engagement is declared a draw.', events);
      return;
    }
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
    if (next === 1) {
      state.turn++;
      // a scenario can run out of rounds: the defence holds
      if (state.turnLimit && state.turn > state.turnLimit) {
        endGame(state, 2, 'The rounds ran out — the chakra closed and the breach failed.', events);
        return;
      }
      // the wheel turns at the start of every fifth round
      if (state.boardKey === 'wheel' && state.turn % (state.rotation.every || 5) === 0) {
        rotate(state, events);
      }
    }
    events.push({ kind: 'turn', owner: next, turn: state.turn });
  }

  function beginBattle(state) {
    faceTowardEnemy(state, 1);
    faceTowardEnemy(state, 2);
    state.phase = 'battle';
    state.owner = 1;
    state.turn = 1;
    state.viewer = 1;
    log(state, 'info', 'Battle stations. ' + faction(1) + ' opens the engagement.');
    snapshot(state, 'battle-start');
  }

  /* ── intel ───────────────────────────────────────────────────── */

  function unknownPool(state, viewer) {
    const foe = viewer === 1 ? 2 : 1;
    const remaining = {};
    rosterOf(state, foe).forEach(function (k) { remaining[k] = (remaining[k] || 0) + 1; });
    forEachUnit(state, function (u) {
      if (u.owner !== foe) return;
      if (u.revealed) remaining[u.key] = Math.max(0, (remaining[u.key] || 0) - 1);
    });
    (state.captured[viewer] || []).forEach(function (d) {
      remaining[d.key] = Math.max(0, (remaining[d.key] || 0) - 1);
    });
    return remaining;
  }

  function beliefFor(state, viewer, id) {
    const u = state.board[id];
    if (!u || u.owner === viewer || u.revealed) return null;
    const pool = unknownPool(state, viewer);
    const out = {};
    let total = 0;
    Object.keys(pool).forEach(function (k) {
      const n = pool[k];
      if (n <= 0) return;
      if (u.hasMoved && (k === 'F' || k === 'B')) return;
      out[k] = n;
      total += n;
    });
    if (!total) return { '2': 1 };
    Object.keys(out).forEach(function (k) { out[k] = out[k] / total; });
    return out;
  }

  function drawCountdown(state) {
    const limit = state.config.drawAfter || 100;
    return Math.max(0, limit - (state.stats.actions - (state.stats.lastCapturePly || 0)));
  }

  /* ── serialisation ───────────────────────────────────────────── */

  function serialize(state) {
    const copy = clone(state);
    copy.savedAt = Date.now();
    return copy;
  }

  function deserialize(raw) {
    let s = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
    if (!s) throw new Error('Corrupt save');

    // v2 saves stored board as a 2-D array of rows and columns
    if (Array.isArray(s.board)) {
      const map = {};
      s.board.forEach(function (row, r) {
        row.forEach(function (u, c) { if (u) map[r + ',' + c] = u; });
      });
      s.board = map;
      s.boardKey = s.config && s.config.board === 'large' ? 'large' : 'small';
      s.version = VERSION;
      s.homes = { 1: (s.rows - 1) + ',' + Math.floor(s.cols / 2), 2: '0,' + Math.floor(s.cols / 2) };
      s.rotation = { count: 0, lastTurn: 0, every: 0, rings: [] };
      delete s.rows;
      delete s.cols;
      delete s.deployRows;
    }

    if (!s.boardKey) s.boardKey = (s.config && s.config.board) || 'small';
    if (!s.board) s.board = {};
    if (!s.homes) {
      const g = G.build(s.boardKey);
      s.homes = { 1: g.homes[1], 2: g.homes[2] };
    }
    if (!s.rotation) s.rotation = { count: 0, lastTurn: 0, every: 0, rings: [] };
    if (!s.captured) s.captured = { 1: [], 2: [] };
    if (!s.log) s.log = [];
    if (!s.replay) s.replay = [];
    if (!s.stats) s.stats = { actions: 0, attacks: 0, wins: 0, losses: 0, probes: 0, firstBlood: 0, lastCapturePly: 0 };
    if (s.stats.lastCapturePly == null) s.stats.lastCapturePly = 0;
    if (!s.config) s.config = { mode: 'ai', board: 'small', tie: 'attacker', difficulty: 'veteran' };
    if (!s.rifts) s.rifts = G.build(s.boardKey).rifts.slice();
    return s;
  }

  function thumbnailBoard(state) { return compactBoard(state); }

  AC.engine = {
    VERSION: VERSION,
    newState: newState,
    createArmy: createArmy,
    clone: clone,
    board: board,
    cellIds: cellIds,
    cellOf: cellOf,
    isRift: isRift,
    unitAt: unitAt,
    forEachUnit: forEachUnit,
    inDeployZone: inDeployZone,
    deployPreset: deployPreset,
    swapSlots: swapSlots,
    armyComplete: armyComplete,
    rosterOf: rosterOf,
    computeValidTargets: computeValidTargets,
    canAct: canAct,
    isMovable: isMovable,
    hasAnyLegalMoves: hasAnyLegalMoves,
    allLegalActions: allLegalActions,
    applyAction: applyAction,
    beginBattle: beginBattle,
    endGame: endGame,
    rotate: rotate,
    turnsUntilRotation: turnsUntilRotation,
    unknownPool: unknownPool,
    beliefFor: beliefFor,
    drawCountdown: drawCountdown,
    serialize: serialize,
    deserialize: deserialize,
    thumbnailBoard: thumbnailBoard,
    compactBoard: compactBoard,
    faction: faction,
    log: log
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
