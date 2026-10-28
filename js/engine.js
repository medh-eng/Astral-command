/* VYUHA — pure rules engine (v4, Chapter III "Shakti")
 * Works on a cell graph: `state.board` maps cellId -> unit, and movement is
 * read off each cell's "rays". No DOM, no coordinates, no assumptions about
 * squares — the same code drives the square arenas, the Chakravyuha wheel
 * and the Padmavyuha lotus.
 *
 * Chapter III adds four rule layers, each switchable per match in
 * `state.rules` so scenarios and old saves can opt out:
 *   gates  — the fort has a gate: the first blow breaches it, the second takes it
 *   hours  — Surya and Chandra: every fifth round day and night swap, and the
 *            side whose hour it is strikes at +1
 *   vyuha  — formations: Makara (a pincer) gives the attacker +1, Padma (a
 *            guarded piece) gives the defender +1
 *   astras — a Shakti meter (0–5) fed by captures, losses and the turning sky
 *            pays for four once-per-match divine weapons
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const U = AC.units;
  const G = AC.geometry;
  const VERSION = 4;

  const HOUR_EVERY = 5;
  const SHAKTI_MAX = 5;
  const MAX_BONUS = 2;
  const DEFAULT_RULES = { gates: true, hours: true, vyuha: true, astras: true };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function other(p) { return p === 1 ? 2 : 1; }

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

  function findUnit(state, pred) {
    const ids = cellIds(state);
    for (let i = 0; i < ids.length; i++) {
      const u = state.board[ids[i]];
      if (u && pred(u, ids[i])) return ids[i];
    }
    return null;
  }

  function rules(state) {
    return state.rules || DEFAULT_RULES;
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
      timer: 0, drawAfter: 100, playerName: 'Commander', opponentName: 'Shakuni'
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
      homes: { 1: g.homes[1], 2: g.homes[2] },
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
      turnLimit: cfg.turnLimit || scenario.turnLimit || 0,
      limitWinner: scenario.limitWinner || 2,
      rotation: { count: 0, lastTurn: 0, every: cfg.rotateEvery || g.rotateEvery || 0, rings: (g.rotateRings || []).slice() },
      rules: Object.assign({}, DEFAULT_RULES, scenario.rules || {}, cfg.rules || {}),
      sky: { startNight: !!(cfg.startNight || scenario.startNight) },
      shakti: { 1: 0, 2: 0 },
      astrasUsed: { 1: {}, 2: {} },
      astraLog: [],
      stats: { actions: 0, attacks: 0, wins: 0, losses: 0, probes: 0, firstBlood: 0, lastCapturePly: 0 },
      startedAt: Date.now()
    };
    const startShakti = cfg.startShakti || scenario.startShakti;
    if (startShakti) {
      state.shakti[1] = Math.min(SHAKTI_MAX, startShakti[1] || 0);
      state.shakti[2] = Math.min(SHAKTI_MAX, startShakti[2] || 0);
    }
    deployPreset(state, 1, 'citadel');
    // the opponent never shows the same formation twice in a row
    deployPreset(state, 2, cfg.enemyPreset || PRESETS[Math.floor(Math.random() * PRESETS.length)]);
    return state;
  }

  /* ── deployment ──────────────────────────────────────────────── */

  function inDeployZone(state, owner, id) {
    const cell = cellOf(state, id);
    return !!cell && cell.zone === owner;
  }

  /* Point every piece at the enemy fort when it is placed (facing rule). */
  function faceTowardEnemy(state, owner) {
    if (!state.config.facing) return;
    const g = board(state);
    const sides = g.sides || 0;
    if (!sides) return;
    const foeHome = state.homes[other(owner)];
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

  function deploySquare(state, owner, style, rng) {
    const g = board(state);
    const r = rng || Math.random;
    clearZone(state, owner);
    const army = createArmy(owner, rosterOf(state, owner));
    const grp = groupArmy(army);
    const flip = r() < 0.5;
    const slots = squarePresetSlots(style, g.cols, flip);
    const order = SQUARE_ORDER[style] || SQUARE_ORDER.citadel;
    const rows = owner === 1
      ? [g.rows - 1, g.rows - 2, g.rows - 3]
      : [0, 1, 2];
    slots.forEach(function (slot, i) {
      const id = rows[slot[0]] + ',' + Math.max(0, Math.min(g.cols - 1, slot[1]));
      if (state.board[id]) return;          // occupied: never pull a piece we cannot place
      const u = grp.pull(order[i]);
      if (!u) return;
      state.board[id] = u;
    });
    const leftovers = grp.left();
    if (leftovers.length) {
      const free = shuffled(g.zones[owner].filter(function (id) { return !state.board[id]; }), r);
      leftovers.forEach(function (u, i) { if (free[i]) state.board[free[i]] = u; });
    }
  }

  /* The wheel and the lotus deploy by distance from home: fort and trap sit
   * deep, scouts reach out toward the rim of your own ground. */
  function deployRadial(state, owner, style) {
    const g = board(state);
    clearZone(state, owner);
    const army = createArmy(owner, rosterOf(state, owner));
    const grp = groupArmy(army);
    const home = state.homes[owner];
    const dist = G.distances(state.boardKey, home);
    const zone = g.zones[owner].slice().sort(function (a, b) {
      if (dist[a] !== dist[b]) return dist[a] - dist[b];
      return a < b ? -1 : 1;
    });

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

  /* How deep a cell sits inside its owner's ground: steps to the nearest
   * cell that is not that owner's. On a square arena it is simply the row
   * depth; on the wheel and the lotus it follows the arcs. */
  function depthMap(state, owner) {
    const g = board(state);
    const depth = {};
    const queue = [];
    g.cellIds.forEach(function (id) {
      const c = g.byId[id];
      if (c.zone !== owner) { depth[id] = 0; queue.push(id); }
    });
    while (queue.length) {
      const id = queue.shift();
      (g.neighbours[id] || []).forEach(function (n) {
        if (depth[n] === undefined) { depth[n] = depth[id] + 1; queue.push(n); }
      });
    }
    return depth;
  }

  function shuffled(list, rng) {
    const a = list.slice();
    const r = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* A random formation that is still a sensible one: the fort always sits in
   * the deepest line of your ground and the trap within one line of it, so a
   * shuffle can never hand the enemy a first-move win. */
  function deployRandom(state, owner, rng) {
    clearZone(state, owner);
    const army = createArmy(owner, rosterOf(state, owner));
    const grp = groupArmy(army);
    const depth = depthMap(state, owner);
    const zone = shuffled(board(state).zones[owner], rng);
    let max = 0;
    zone.forEach(function (id) { if (depth[id] > max) max = depth[id]; });
    const deepest = zone.filter(function (id) { return depth[id] === max; });
    const used = {};
    const fort = grp.pull('F');
    if (fort && deepest.length) { state.board[deepest[0]] = fort; used[deepest[0]] = 1; }
    const trap = grp.pull('B');
    if (trap) {
      const deep = zone.filter(function (id) { return !used[id] && depth[id] >= max - 1; });
      const cell = deep[0] || zone.filter(function (id) { return !used[id]; })[0];
      if (cell) { state.board[cell] = trap; used[cell] = 1; }
    }
    const free = zone.filter(function (id) { return !used[id]; });
    shuffled(grp.left(), rng).forEach(function (u, i) { if (free[i]) state.board[free[i]] = u; });
  }

  const PRESETS = ['citadel', 'blitz', 'lattice', 'shuffle'];

  function deployPreset(state, owner, style, rng) {
    if (style === 'shuffle' || style === 'random') { deployRandom(state, owner, rng); return; }
    if (board(state).kind === 'square') deploySquare(state, owner, style, rng);
    else deployRadial(state, owner, style);
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

  function isEntranced(unit) { return !!(unit && unit.stun > 0); }

  /* Walk the rays out from a cell. Stops at a rift, at an occupied cell, and
   * at the unit's own range. */
  function rayTargets(state, id, range, unit) {
    const g = board(state);
    const out = [];
    const def = U.UNIT_DEFS[unit.key] || {};
    // how far away a piece may land a melee blow (the chariot strikes at the
    // end of any run; most pieces only at arm's length)
    const strike = def.strikeRange || range;
    (g.rays[id] || []).forEach(function (line, dir) {
      for (let i = 0; i < line.length && i < range; i++) {
        const to = line[i];
        if (isRift(state, to)) break;
        const occ = state.board[to];
        if (!occ) {
          if (!violatesTwoSquare(unit, id, to)) out.push({ id: to, type: 'move', dir: dir });
        } else {
          if (occ.owner !== unit.owner && i < strike && !violatesTwoSquare(unit, id, to)) {
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

  function computeValidTargets(state, id, mode, ignoreTrance) {
    const unit = unitAt(state, id);
    if (!isMovable(unit)) return [];
    if (!ignoreTrance && isEntranced(unit)) return [];
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

  function hasAnyLegalMoves(state, player, ignoreTrance) {
    const ids = cellIds(state);
    for (let i = 0; i < ids.length; i++) {
      const u = state.board[ids[i]];
      if (!u || u.owner !== player || !isMovable(u)) continue;
      if (computeValidTargets(state, ids[i], 'move', ignoreTrance).length) return true;
      if (computeValidTargets(state, ids[i], 'special', ignoreTrance).length) return true;
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
        out.push({ type: t.type, from: id, to: t.id, dir: t.dir });
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

  function gainShakti(state, owner, n) {
    if (!rules(state).astras || !state.shakti) return;
    state.shakti[owner] = Math.min(SHAKTI_MAX, (state.shakti[owner] || 0) + (n || 1));
  }

  /* Shakti grows by one for every piece you take (and by one for both sides
   * each time the sky turns). */
  function recordCapture(state, byOwner, dead) {
    dead.revealed = true;
    state.stats.lastCapturePly = state.stats.actions;
    state.captured[byOwner].push({
      key: dead.key, badge: dead.badge, name: dead.name, owner: dead.owner, rank: dead.rank, turn: state.turn
    });
    gainShakti(state, byOwner, 1);
  }

  /* ── the hours: Surya and Chandra ────────────────────────────── */

  function hourOf(state) {
    if (!rules(state).hours) return null;
    const flips = Math.floor(state.turn / HOUR_EVERY) + (state.sky && state.sky.startNight ? 1 : 0);
    return flips % 2 === 0 ? 'day' : 'night';
  }

  function hourOwner(state) {
    const h = hourOf(state);
    return h === 'day' ? 1 : h === 'night' ? 2 : 0;
  }

  function roundsUntilHourTurns(state) {
    if (!rules(state).hours) return null;
    const next = (Math.floor(state.turn / HOUR_EVERY) + 1) * HOUR_EVERY;
    return next - state.turn;
  }

  /* ── formations and strength ─────────────────────────────────── */

  function isRanked(u) { return !!u && u.key !== 'F' && u.key !== 'B'; }

  /* Ranked pieces of `owner` standing next to a cell, ignoring `skip`. */
  function alliesAround(state, cellId, owner, skip) {
    const out = [];
    (board(state).neighbours[cellId] || []).forEach(function (n) {
      if (n === skip) return;
      const u = state.board[n];
      if (u && u.owner === owner && isRanked(u)) out.push(n);
    });
    return out;
  }

  /* Everything that shifts a clash away from bare rank, visible to both
   * players because it depends only on where pieces stand and the hour. */
  function combatContext(state, from, to) {
    const att = state.board[from];
    const def = state.board[to];
    const ctx = { att: 0, def: 0, attParts: [], defParts: [], jaws: [], petals: [] };
    if (!att || !def) return ctx;
    const r = rules(state);
    if (r.hours && hourOwner(state) === att.owner) {
      ctx.attParts.push({ key: hourOf(state) === 'day' ? 'surya' : 'chandra', v: 1 });
    }
    if (r.vyuha) {
      const jaws = alliesAround(state, to, att.owner, from);
      if (jaws.length) { ctx.attParts.push({ key: 'makara', v: 1 }); ctx.jaws = jaws; }
      if (isRanked(def)) {
        const petals = alliesAround(state, to, def.owner, null);
        if (petals.length >= 2) { ctx.defParts.push({ key: 'padma', v: 1 }); ctx.petals = petals; }
      }
    }
    ctx.attParts.forEach(function (p) { ctx.att += p.v; });
    ctx.defParts.forEach(function (p) { ctx.def += p.v; });
    ctx.att = Math.min(MAX_BONUS, ctx.att);
    ctx.def = Math.min(MAX_BONUS, ctx.def);
    return ctx;
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

  function resolveMelee(state, attacker, defender, ctx) {
    ctx = ctx || { att: 0, def: 0 };
    if (defender.key === 'F') {
      if (rules(state).gates && !defender.breached) {
        return { winner: 'none', breach: true, text: attacker.name + ' [' + attacker.badge + '] broke the gate of the ' + faction(defender.owner) + ' fort. One more blow takes it.' };
      }
      return { winner: 'att', core: true, text: attacker.name + ' [' + attacker.badge + '] seized the ' + faction(defender.owner) + ' fort!' };
    }
    if (defender.key === 'B') {
      if (U.UNIT_DEFS[attacker.key].defusesMines) {
        return { winner: 'att', mine: true, text: 'The Yantrik safely dismantled the Shataghni — the lane is open.' };
      }
      return { winner: 'def', mine: true, text: attacker.name + ' [' + attacker.badge + '] struck a Shataghni and was annihilated. The trap holds.' };
    }
    if (ctx.rear) {
      return {
        winner: 'att', rear: true,
        text: attacker.name + ' struck the ' + defender.name + ' [' + defender.badge + '] from behind — rank did not count.'
      };
    }
    if (U.UNIT_DEFS[attacker.key].assassin && (defender.key === '10' || defender.key === '9')) {
      return { winner: 'att', assassinate: true, text: 'Assassination — the spy slipped past the guard and slew the ' + defender.name + ' [' + defender.badge + '].' };
    }
    const a = attacker.rank + (ctx.att || 0);
    const d = defender.rank + (ctx.def || 0);
    const shown = function (u, v) { return v !== u.rank ? u.badge + '→' + v : u.badge; };
    if (a > d) {
      return { winner: 'att', a: a, d: d, text: attacker.name + ' [' + shown(attacker, a) + '] overpowered the ' + defender.name + ' [' + shown(defender, d) + '].' };
    }
    if (a < d) {
      return { winner: 'def', a: a, d: d, text: 'The defending ' + defender.name + ' [' + shown(defender, d) + '] repelled the ' + attacker.name + ' [' + shown(attacker, a) + '].' };
    }
    if (state.config.tie === 'attacker') {
      const before = attacker.rank;
      attacker.rank = Math.max(2, attacker.rank - 1);
      attacker.badge = String(attacker.rank);
      attacker.shieldBroken = true;
      return {
        winner: 'att', shieldBreak: true, a: a, d: d,
        text: 'Equal strength ' + a + ' — the attacking ' + attacker.name + ' won, but its shield cracked (rank ' + before + ' → ' + attacker.rank + ').'
      };
    }
    return { winner: 'both', a: a, d: d, text: 'Equal strength ' + a + ' — both pieces fell.' };
  }

  /* What a blow would do, with nothing hidden: the same table the AI and the
   * odds panel read. `ctx` carries the visible bonuses; `breached` tells
   * whether the fort's gate is already down. */
  function predict(attKey, defKey, opts) {
    opts = opts || {};
    const A = U.UNIT_DEFS[attKey];
    const D = U.UNIT_DEFS[defKey];
    if (!A || !D) return { out: 'none' };
    const gates = opts.gates;
    if (opts.barrage) {
      if (defKey === 'F') return { out: gates && !opts.breached ? 'breach' : 'core' };
      if (defKey === 'B') return { out: 'noop' };
      if (D.rank >= 0 && D.rank <= 5) return { out: 'att' };
      return { out: 'noop' };
    }
    if (defKey === 'F') return { out: gates && !opts.breached ? 'breach' : 'core' };
    if (defKey === 'B') return { out: A.defusesMines ? 'att' : 'mine' };
    if (A.assassin && (defKey === '10' || defKey === '9')) return { out: 'att' };
    const a = (opts.attRank != null ? opts.attRank : A.rank) + (opts.att || 0);
    const d = D.rank + (opts.def || 0);
    if (a > d) return { out: 'att' };
    if (a < d) return { out: 'def' };
    return { out: opts.tie === 'attacker' ? 'att' : 'both' };
  }

  /* ── the chakra turns ────────────────────────────────────────── */

  function hasRotation(state) {
    const g = board(state);
    return !!(g.rotateEvery && (g.kind === 'wheel' || g.rotationOrder));
  }

  /* The inner rings turn one cell clockwise, carrying whatever stands on
   * them — and exposing it. The wheel and the lotus share this; each board
   * lists its rings in clockwise order. */
  function rotate(state, events) {
    if (!hasRotation(state)) return false;
    const g = board(state);
    const ringList = state.rotation.rings.length ? state.rotation.rings : (g.rotateRings || [1, 2]);
    let moved = 0;
    ringList.forEach(function (ring) {
      let order = g.rotationOrder && g.rotationOrder[ring];
      if (!order) {
        order = [];
        for (let s = 0; s < g.sectors; s++) order.push('r' + ring + 's' + s);
      }
      const held = order.map(function (id) { return state.board[id] || null; });
      order.forEach(function (id) { state.board[id] = null; });
      held.forEach(function (u, i) {
        if (!u) return;
        state.board[order[(i + 1) % order.length]] = u;
        u.revealed = true; // riding the wheel exposes you
        moved++;
      });
    });
    state.rotation.count++;
    state.rotation.lastTurn = state.turn;
    if (moved) {
      const name = g.kind === 'hex' ? 'lotus' : 'chakra';
      log(state, 'rotate', 'The ' + name + ' turns: the inner two rings shift one cell clockwise. Anything on them is exposed.');
      if (events) {
        events.push({
          kind: 'rotate', sfx: 'rotate',
          text: 'The ' + name + ' turns — the inner rings shifted one cell. Everything they carried is now revealed.'
        });
      }
    }
    return moved > 0;
  }

  function turnsUntilRotation(state) {
    if (!hasRotation(state)) return null;
    const every = state.rotation.every || board(state).rotateEvery || 5;
    const next = Math.ceil(state.turn / every) * every;
    const gap = next - state.turn;
    return gap === 0 ? every : gap;
  }

  /* ── astras ──────────────────────────────────────────────────── */

  const ASTRAS = {
    vayavya: { key: 'vayavya', cost: 1, picks: 2 },
    sammohana: { key: 'sammohana', cost: 2, picks: 1 },
    agneya: { key: 'agneya', cost: 3, picks: 1 },
    brahma: { key: 'brahma', cost: 5, picks: 0 }
  };
  const ASTRA_ORDER = ['vayavya', 'sammohana', 'agneya', 'brahma'];
  const TRANCE_TURNS = 2;
  const FIRE_BURNS_UP_TO = 4;

  /* Cells within two steps of any of `owner`'s pieces — the reach of an astra. */
  function reachOf(state, owner) {
    const g = board(state);
    const seen = {};
    let frontier = [];
    forEachUnit(state, function (u, id) {
      if (u.owner === owner) { seen[id] = 0; frontier.push(id); }
    });
    for (let step = 1; step <= 2; step++) {
      const next = [];
      frontier.forEach(function (from) {
        (g.neighbours[from] || []).forEach(function (n) {
          if (seen[n] !== undefined || isRift(state, n)) return;
          seen[n] = step;
          next.push(n);
        });
      });
      frontier = next;
    }
    return seen;
  }

  function strongestEnemy(state, owner) {
    let best = null;
    let bestRank = -9;
    forEachUnit(state, function (u, id) {
      if (u.owner === owner || !isRanked(u)) return;
      if (u.rank > bestRank || (u.rank === bestRank && best && u.id < state.board[best].id)) {
        bestRank = u.rank;
        best = id;
      }
    });
    return best;
  }

  function astraReady(state, owner, key) {
    const a = ASTRAS[key];
    if (!a || !rules(state).astras || state.phase !== 'battle') return false;
    if (state.astrasUsed && state.astrasUsed[owner] && state.astrasUsed[owner][key]) return false;
    return (state.shakti && state.shakti[owner] || 0) >= a.cost;
  }

  /* Legal targets for an astra. For the wind, `first` is the piece already
   * picked; without it the list is the pieces that can be picked first. */
  function astraTargets(state, owner, key, first) {
    if (!astraReady(state, owner, key)) return [];
    const out = [];
    if (key === 'vayavya') {
      forEachUnit(state, function (u, id) {
        if (u.owner === owner && id !== first) out.push(id);
      });
      return out;
    }
    const reach = reachOf(state, owner);
    forEachUnit(state, function (u, id) {
      if (u.owner === owner || reach[id] === undefined) return;
      if (key === 'brahma' && !isRanked(u)) return;
      if (key === 'sammohana' && (!isMovable(u) || isEntranced(u))) return;
      if (key === 'agneya' && u.key === 'F' && (u.breached || !rules(state).gates) && u.revealed) return;
      out.push(id);
    });
    return out;
  }

  function astraActions(state, owner) {
    const out = [];
    ASTRA_ORDER.forEach(function (key) {
      if (!astraReady(state, owner, key)) return;
      if (key === 'vayavya') {
        const own = astraTargets(state, owner, key);
        for (let i = 0; i < own.length; i++) {
          for (let j = i + 1; j < own.length; j++) {
            out.push({ type: 'astra', astra: key, from: own[i], to: own[j] });
          }
        }
        return;
      }
      astraTargets(state, owner, key).forEach(function (id) {
        out.push({ type: 'astra', astra: key, to: id });
      });
    });
    return out;
  }

  function applyAstra(state, action) {
    const events = [];
    const owner = state.owner;
    const key = action.astra;
    const a = ASTRAS[key];
    if (!a) return { ok: false, error: 'Unknown astra', events: events };
    if (!astraReady(state, owner, key)) return { ok: false, error: 'That astra is not ready', events: events };
    const legal = astraTargets(state, owner, key, key === 'vayavya' ? action.from : null);
    if (key === 'vayavya') {
      const ok = state.board[action.from] && state.board[action.from].owner === owner && legal.indexOf(action.to) !== -1;
      if (!ok) return { ok: false, error: 'Pick two of your own pieces', events: events };
    } else if (legal.indexOf(action.to) === -1) {
      return { ok: false, error: 'Out of reach', events: events };
    }

    state.shakti[owner] -= a.cost;
    state.astrasUsed[owner][key] = true;
    state.astraLog.push({ owner: owner, astra: key, turn: state.turn });
    state.stats.actions++;
    const ev = { kind: 'astra', astra: key, owner: owner, sfx: 'astra-' + key };

    if (key === 'vayavya') {
      const ua = state.board[action.from];
      const ub = state.board[action.to];
      state.board[action.from] = ub;
      state.board[action.to] = ua;
      ev.from = action.from;
      ev.to = action.to;
      ev.at = action.to;
      ev.text = 'Vayavyastra: a wind swept the field and two ' + faction(owner) + ' pieces changed places.';
      state.lastMove = { from: action.from, to: action.to, type: 'astra' };
    } else if (key === 'sammohana') {
      const t = state.board[action.to];
      t.stun = TRANCE_TURNS;
      ev.at = action.to;
      ev.target = t;
      ev.text = 'Sammohanastra: an enemy piece is entranced and cannot act for two turns.';
      state.lastMove = { from: action.to, to: action.to, type: 'astra' };
    } else if (key === 'agneya') {
      const t = state.board[action.to];
      t.revealed = true;
      ev.at = action.to;
      ev.target = t;
      if (t.key === 'F') {
        if (rules(state).gates && !t.breached) {
          t.breached = true;
          ev.breach = true;
          ev.text = 'Agneyastra: the fort gate burns. One more blow takes it.';
        } else {
          ev.text = 'Agneyastra: the fort is laid bare.';
        }
      } else if (t.rank <= FIRE_BURNS_UP_TO) {
        state.board[action.to] = null;
        recordCapture(state, owner, t);
        state.stats.wins++;
        ev.kill = true;
        ev.text = 'Agneyastra: the ' + t.name + ' [' + t.badge + '] burned where it stood.';
      } else {
        ev.text = 'Agneyastra: the ' + t.name + ' [' + t.badge + '] walked through the fire, revealed but unbroken.';
      }
      state.lastMove = { from: action.to, to: action.to, type: 'astra' };
    } else if (key === 'brahma') {
      // nothing withstands it: the target falls whatever its rank, and the
      // blast lays bare every piece around it, friend or foe
      const id = action.to;
      const t = state.board[id];
      const g = board(state);
      state.board[id] = null;
      recordCapture(state, owner, t);
      state.stats.wins++;
      const bared = [];
      (g.neighbours[id] || []).forEach(function (n) {
        const u = state.board[n];
        if (u && !u.revealed) { u.revealed = true; bared.push(n); }
      });
      ev.at = id;
      ev.target = t;
      ev.kill = true;
      ev.bared = bared;
      ev.text = 'Brahmastra: the ' + t.name + ' [' + t.badge + '] is gone, and everything around it stands revealed.';
      state.lastMove = { from: id, to: id, type: 'astra' };
    }
    events.push(ev);
    log(state, 'astra', ev.text, ev.at || null);
    snapshot(state, 'astra');
    finishTurn(state, events);
    return { ok: true, type: 'astra', events: events };
  }

  /* ── main action ─────────────────────────────────────────────── */

  function breachFort(state, fort, events, at, by) {
    fort.breached = true;
    fort.revealed = true;
    state.stats.lastCapturePly = state.stats.actions;
    gainShakti(state, fort.owner, 2);      // a besieged house finds its strength
    log(state, 'breach', 'The ' + faction(fort.owner) + ' fort gate is broken.', at);
    events.push({ kind: 'breach', sfx: 'breach', at: at, unit: by, target: fort, text: 'The gate of the ' + faction(fort.owner) + ' fort is broken. One more blow takes it.' });
  }

  function applyAction(state, action) {
    const events = [];
    if (state.phase !== 'battle') return { ok: false, error: 'Not in battle phase', events: events };
    if (action.type === 'astra') return applyAstra(state, action);
    if (action.type === 'pass') return { ok: false, error: 'Passing is automatic', events: events };
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
    const dir = match.dir;
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
      if (state.config.facing && dir != null) unit.facing = dir;
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

    /* ── divine sight ── */
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

    /* ── rain of arrows ── */
    if (type === 'barrage') {
      unit.revealed = true;
      target.revealed = true;
      state.stats.attacks++;
      if (target.key === 'F') {
        if (rules(state).gates && !target.breached) {
          breachFort(state, target, events, to, unit);
          events[events.length - 1].volley = true;
          snapshot(state, 'barrage-breach');
          finishTurn(state, events);
          return { ok: true, type: type, events: events };
        }
        state.board[to] = null;
        recordCapture(state, unit.owner, target);
        events.push({
          kind: 'core', sfx: 'core', at: to, unit: unit, target: target, win: true,
          text: 'Shara-varsha punched through the fort from two cells out. The enemy objective is gone.'
        });
        log(state, 'core', faction(unit.owner) + ' took the enemy fort with a volley!', to);
        snapshot(state, 'barrage-core');
        endGame(state, unit.owner, faction(unit.owner) + ' took the enemy fort with a volley on turn ' + state.turn + '.', events);
        return { ok: true, type: type, events: events };
      }
      if (target.key === 'B') {
        events.push({
          kind: 'barrage', sfx: 'mine', at: to, unit: unit, target: target, noKill: true,
          text: 'The volley washed over a Shataghni — its iron shrugged off the arrows. Trap revealed, nothing lost.'
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
          text: 'Heavy rank ' + target.badge + ' armour turned the volley. Both pieces are now revealed.'
        });
        log(state, 'barrage', 'The volley was turned by the ' + target.name + ' [' + target.badge + '].', to);
      }
      snapshot(state, 'barrage');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

    /* ── melee ── */
    if (state.config.facing && dir != null) unit.facing = dir;
    const ctx = combatContext(state, from, to);
    ctx.rear = isRearStrike(state, { from: from, to: to, dir: dir }, target);
    unit.hasMoved = true;
    unit.moveHistory.push({ from: from, to: to });
    unit.revealed = true;
    target.revealed = true;
    state.stats.attacks++;

    const res = resolveMelee(state, unit, target, ctx);

    if (res.breach) {
      unit.moveHistory.pop();             // the blow landed but the piece stayed put
      breachFort(state, target, events, to, unit);
      snapshot(state, 'breach');
      finishTurn(state, events);
      return { ok: true, type: type, events: events };
    }

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
      sfx: res.core ? 'core' : res.winner === 'att' ? 'clash-win' : res.winner === 'def' ? 'clash-lose' : 'clash-both',
      at: to,
      from: from,
      unit: unit,
      target: target,
      outcome: res.winner,
      core: !!res.core,
      mine: !!res.mine,
      assassinate: !!res.assassinate,
      shieldBreak: !!res.shieldBreak,
      a: res.a,
      d: res.d,
      attParts: ctx.attParts,
      defParts: ctx.defParts,
      jaws: ctx.jaws,
      petals: ctx.petals,
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

  /* A side's trances wear off by one at the end of each of its turns. */
  function tickTrance(state, owner) {
    forEachUnit(state, function (u) {
      if (u.owner === owner && u.stun > 0) u.stun--;
    });
  }

  /* Hand the move to `next`, rolling the round over when Suryavansh is up
   * again: the scenario clock, the turning rings and the turning sky. */
  function beginTurnOf(state, next, events) {
    state.owner = next;
    if (next !== 1) return;
    state.turn++;
    const cap = state.config.roundCap != null ? state.config.roundCap : (U.BOARDS[state.boardKey] && U.BOARDS[state.boardKey].roundCap) || 0;
    if (!state.turnLimit && cap && state.turn > cap) {
      ceasefire(state, 'Sunset on round ' + cap + ' — the war cannot go on.', events);
      return;
    }
    if (state.turnLimit && state.turn > state.turnLimit) {
      const w = state.limitWinner || 2;
      endGame(state, w, w === 2
        ? 'The rounds ran out — the chakra closed and the breach failed.'
        : 'The rounds ran out — the line held and ' + faction(w) + ' wins.', events);
      return;
    }
    if (hasRotation(state) && state.turn % (state.rotation.every || 5) === 0) rotate(state, events);
    if (rules(state).hours && state.turn % HOUR_EVERY === 0) {
      const h = hourOf(state);
      gainShakti(state, 1, 1);
      gainShakti(state, 2, 1);
      log(state, 'sky', h === 'day' ? 'Dawn: the hour of Surya. Suryavansh strikes at +1.' : 'Dusk: the hour of Chandra. Chandravansh strikes at +1.');
      if (events) events.push({ kind: 'sky', sfx: h === 'day' ? 'dawn' : 'dusk', hour: h, text: h === 'day' ? 'Dawn — the hour of Surya.' : 'Night falls — the hour of Chandra.' });
    }
  }

  /* Bala — the strength left on the field: the ranks of every fighting piece,
   * plus five for a fort whose gate still stands. It decides a ceasefire. */
  function strengthOf(state, owner) {
    let s = 0;
    forEachUnit(state, function (u) {
      if (u.owner !== owner) return;
      if (isRanked(u)) s += Math.max(1, u.rank);
      else if (u.key === 'F' && !u.breached) s += 5;
    });
    return s;
  }

  function ceasefire(state, why, events) {
    const a = strengthOf(state, 1);
    const b = strengthOf(state, 2);
    if (a === b) {
      endGame(state, 0, why + ' Both armies are equal in strength (' + a + ') — the field is shared.', events);
    } else {
      const w = a > b ? 1 : 2;
      endGame(state, w, why + ' ' + faction(w) + ' holds the field, stronger ' + Math.max(a, b) + ' to ' + Math.min(a, b) + '.', events);
    }
    state.ceasefire = true;
  }

  function finishTurn(state, events) {
    if (state.phase === 'over') return;
    const limit = state.config.drawAfter || 100;
    if (state.stats.actions - state.stats.lastCapturePly >= limit) {
      ceasefire(state, 'No piece fell in ' + limit + ' orders — a ceasefire is called.', events);
      return;
    }
    tickTrance(state, state.owner);
    for (let guard = 0; guard < 4; guard++) {
      const next = other(state.owner);
      beginTurnOf(state, next, events);
      if (state.phase === 'over') return;
      if (hasAnyLegalMoves(state, next)) {
        if (events) events.push({ kind: 'turn', owner: next, turn: state.turn });
        return;
      }
      if (hasAnyLegalMoves(state, next, true)) {
        // every piece that could act is entranced: the turn passes
        log(state, 'pass', faction(next) + ' stands entranced and loses the turn.');
        if (events) events.push({ kind: 'pass', owner: next, text: faction(next) + ' is entranced and loses the turn.' });
        tickTrance(state, next);
        continue;
      }
      if (!hasAnyLegalMoves(state, other(next), true)) {
        endGame(state, 0, 'Stalemate — neither commander has a legal action left.', events);
      } else {
        endGame(state, other(next), faction(next) + ' has no legal action left — the field is conceded.', events);
      }
      return;
    }
    endGame(state, 0, 'Stalemate — both armies stand entranced.', events);
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
    const foe = other(viewer);
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

  /* Odds of a strike from `from` on `to`, as the attacker sees them. */
  function strikeOdds(state, viewer, from, to, isBarrage) {
    const att = state.board[from];
    const def = state.board[to];
    if (!att || !def) return null;
    const dist = def.revealed ? (function () { const o = {}; o[def.key] = 1; return o; })() : beliefFor(state, viewer, to);
    if (!dist) return null;
    const ctx = isBarrage ? { att: 0, def: 0 } : combatContext(state, from, to);
    const out = { win: 0, lose: 0, both: 0, core: 0, breach: 0, noop: 0, ctx: ctx };
    Object.keys(dist).forEach(function (k) {
      const res = predict(att.key, k, {
        barrage: isBarrage, tie: state.config.tie, gates: rules(state).gates,
        breached: def.key === 'F' && def.breached, att: ctx.att, def: k === 'F' || k === 'B' ? 0 : ctx.def,
        attRank: att.rank
      });
      const p = dist[k];
      if (res.out === 'core') out.core += p;
      else if (res.out === 'breach') out.breach += p;
      else if (res.out === 'att') out.win += p;
      else if (res.out === 'def' || res.out === 'mine') out.lose += p;
      else if (res.out === 'both') out.both += p;
      else out.noop += p;
    });
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
    const s = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
    if (!s) throw new Error('Corrupt save');

    // v2 saves stored board as a 2-D array of rows and columns
    if (Array.isArray(s.board)) {
      const map = {};
      s.board.forEach(function (row, r) {
        row.forEach(function (u, c) { if (u) map[r + ',' + c] = u; });
      });
      s.board = map;
      s.boardKey = s.config && s.config.board === 'large' ? 'large' : 'small';
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
    // a match saved before Chapter III keeps the rules it was started under
    if (!s.rules) s.rules = { gates: false, hours: false, vyuha: false, astras: false };
    if (!s.shakti) s.shakti = { 1: 0, 2: 0 };
    if (!s.astrasUsed) s.astrasUsed = { 1: {}, 2: {} };
    if (!s.astraLog) s.astraLog = [];
    if (!s.sky) s.sky = { startNight: false };
    if (!s.limitWinner) s.limitWinner = 2;
    s.version = VERSION;
    return s;
  }

  function thumbnailBoard(state) { return compactBoard(state); }

  AC.engine = {
    VERSION: VERSION,
    HOUR_EVERY: HOUR_EVERY,
    SHAKTI_MAX: SHAKTI_MAX,
    ASTRAS: ASTRAS,
    ASTRA_ORDER: ASTRA_ORDER,
    PRESETS: PRESETS,
    newState: newState,
    createArmy: createArmy,
    clone: clone,
    board: board,
    cellIds: cellIds,
    cellOf: cellOf,
    isRift: isRift,
    unitAt: unitAt,
    findUnit: findUnit,
    forEachUnit: forEachUnit,
    inDeployZone: inDeployZone,
    deployPreset: deployPreset,
    depthMap: depthMap,
    swapSlots: swapSlots,
    armyComplete: armyComplete,
    rosterOf: rosterOf,
    computeValidTargets: computeValidTargets,
    canAct: canAct,
    isMovable: isMovable,
    isEntranced: isEntranced,
    hasAnyLegalMoves: hasAnyLegalMoves,
    allLegalActions: allLegalActions,
    applyAction: applyAction,
    beginBattle: beginBattle,
    endGame: endGame,
    rotate: rotate,
    hasRotation: hasRotation,
    turnsUntilRotation: turnsUntilRotation,
    hourOf: hourOf,
    hourOwner: hourOwner,
    roundsUntilHourTurns: roundsUntilHourTurns,
    combatContext: combatContext,
    predict: predict,
    strikeOdds: strikeOdds,
    rules: rules,
    astraReady: astraReady,
    astraTargets: astraTargets,
    astraActions: astraActions,
    reachOf: reachOf,
    strongestEnemy: strongestEnemy,
    unknownPool: unknownPool,
    beliefFor: beliefFor,
    drawCountdown: drawCountdown,
    strengthOf: strengthOf,
    serialize: serialize,
    deserialize: deserialize,
    thumbnailBoard: thumbnailBoard,
    compactBoard: compactBoard,
    faction: faction,
    log: log
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
