/* Aetherfront: Astral Command — Astral AI
 * Hidden-information bot. It never looks at the opponent's hidden ranks:
 * it reasons over a belief distribution built from the pieces it has not
 * accounted for, plus the public "has this unit ever moved" signal.
 *
 * Also used by the in-game Advisor, so the hint the player gets is exactly
 * the reasoning the bot would use.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const E = AC.engine;
  const U = AC.units;

  const VALUE = {
    F: 900, '10': 120, '9': 80, '7': 56, '6': 56, '5': 50,
    '3': 26, '2': 30, '1': 46, B: 16
  };

  /* Pure outcome prediction — mirrors engine.resolveMelee / barrage without
   * touching state. Keeps the bot honest about the ruleset. */
  function predict(attKey, defKey, tie, isBarrage) {
    const A = U.UNIT_DEFS[attKey];
    const D = U.UNIT_DEFS[defKey];
    if (!A || !D) return { out: 'none', p: 0 };
    if (isBarrage) {
      if (defKey === 'F') return { out: 'core' };
      if (defKey === 'B') return { out: 'noop' };
      if (D.rank >= 0 && D.rank <= 5) return { out: 'att' };
      return { out: 'noop' };
    }
    if (defKey === 'F') return { out: 'core' };
    if (defKey === 'B') return { out: A.defusesMines ? 'att' : 'mine' };
    if (A.assassin && (defKey === '10' || defKey === '9')) return { out: 'att' };
    if (A.rank > D.rank) return { out: 'att' };
    if (A.rank < D.rank) return { out: 'def' };
    return { out: tie === 'attacker' ? 'att' : 'both' };
  }

  function boardUnits(state, owner) {
    const out = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const u = state.board[r][c];
        if (u && u.owner === owner) out.push({ u: u, r: r, c: c });
      }
    }
    return out;
  }

  function findCore(state, owner) {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const u = state.board[r][c];
        if (u && u.owner === owner && u.key === 'F') return { r: r, c: c };
      }
    }
    return null;
  }

  /* Expected value of attacking an unknown defender. */
  function attackEV(state, viewer, attKey, target, isBarrage) {
    const A = U.UNIT_DEFS[attKey];
    const tie = state.config.tie;
    const own = VALUE[attKey] || 30;
    if (target.revealed) {
      const res = predict(attKey, target.key, tie, isBarrage);
      const tval = VALUE[target.key] || 30;
      if (res.out === 'core') return 900;
      if (res.out === 'att') return tval - (target.key === 'B' && isBarrage ? 0 : 0);
      if (res.out === 'def') return -own;
      if (res.out === 'mine') return -own;
      if (res.out === 'both') return tval - own;
      return 0;
    }
    const dist = beliefDist(state, viewer, target);
    let ev = 0;
    Object.keys(dist).forEach(function (k) {
      const p = dist[k];
      const res = predict(attKey, k, tie, isBarrage);
      const tval = VALUE[k] || 30;
      if (res.out === 'core') ev += p * 900;
      else if (res.out === 'att') ev += p * tval;
      else if (res.out === 'def') ev += p * -own;
      else if (res.out === 'mine') ev += p * -own;
      else if (res.out === 'both') ev += p * (tval - own);
    });
    // Unknown-but-unmoved pieces in the enemy backfield are the core/mine
    // candidates; probing them is worth a little extra initiative.
    if (!target.hasMoved) ev += 4;
    return ev;
  }

  function beliefDist(state, viewer, target) {
    const pool = E.unknownPool(state, viewer);
    const out = {};
    let total = 0;
    Object.keys(pool).forEach(function (k) {
      const n = pool[k];
      if (n <= 0) return;
      if (target.hasMoved && (k === 'F' || k === 'B')) return;
      out[k] = n;
      total += n;
    });
    if (!total) return { '2': 1 };
    Object.keys(out).forEach(function (k) { out[k] = out[k] / total; });
    return out;
  }

  function ownCorePressure(state, viewer) {
    // how many unknown/known enemy units sit within 2 tiles of our core
    const core = findCore(state, viewer);
    if (!core) return 0;
    let n = 0;
    boardUnits(state, viewer === 1 ? 2 : 1).forEach(function (e) {
      const d = Math.abs(e.r - core.r) + Math.abs(e.c - core.c);
      if (d <= 2) n += d === 1 ? 2 : 1;
    });
    return n;
  }

  function positional(state, viewer, unit, from, to) {
    const foe = viewer === 1 ? 2 : 1;
    const forward = viewer === 1 ? -1 : 1; // direction toward the enemy backfield
    let s = 0;
    const adv = (to.r - from.r) * forward;
    const homeRows = state.deployRows;

    // general advance, but heavy pieces are worth more alive than advanced
    if (unit.key === '10' || unit.key === '9') s += adv * 1.2;
    else if (unit.key === 'F' || unit.key === 'B') s += 0;
    else s += adv * 3.4;

    // centrality: rifts pinch the lanes, the middle is safer
    const midC = (state.cols - 1) / 2;
    s -= Math.abs(to.c - midC) * 0.35;

    // don't wander back into your own back rows once out
    const inHome = viewer === 1 ? to.r >= state.rows - homeRows : to.r < homeRows;
    if (inHome && unit.key !== 'F' && unit.key !== 'B') s -= 2.5;

    // sappers hunt unmoved backfield pieces (mine/core candidates)
    if (U.UNIT_DEFS[unit.key].defusesMines) {
      let best = 99;
      boardUnits(state, foe).forEach(function (e) {
        if (!e.u.hasMoved) best = Math.min(best, Math.abs(e.r - to.r) + Math.abs(e.c - to.c));
      });
      if (best < 99) s += (6 - Math.min(6, best)) * 2.6;
    }

    // wraith stalks revealed commanders
    if (U.UNIT_DEFS[unit.key].assassin) {
      let best = 99;
      boardUnits(state, foe).forEach(function (e) {
        if (e.u.revealed && (e.u.key === '10' || e.u.key === '9')) {
          best = Math.min(best, Math.abs(e.r - to.r) + Math.abs(e.c - to.c));
        }
      });
      if (best < 99) s += (5 - Math.min(5, best)) * 5;
    }

    // a lone piece stepping next to unknowns is a gamble; punish carelessly
    // feeding high-value units forward
    if (VALUE[unit.key] >= 50) {
      let threats = 0;
      boardUnits(state, foe).forEach(function (e) {
        const d = Math.abs(e.r - to.r) + Math.abs(e.c - to.c);
        if (d === 1 && !e.u.revealed) threats++;
      });
      s -= threats * (VALUE[unit.key] / 22);
    }
    return s;
  }

  function coreSafety(state, viewer, unit, to) {
    const core = findCore(state, viewer);
    if (!core) return 0;
    let s = 0;
    // keep something between the enemy and the core
    if (unit.key !== 'F' && unit.key !== 'B') {
      const dFromCore = Math.abs(to.r - core.r) + Math.abs(to.c - core.c);
      if (dFromCore <= 2) s += 3; // screen stays home
    }
    // core square itself: never voluntarily vacated (immovable anyway)
    return s;
  }

  function scoreAction(state, viewer, act, difficulty) {
    const unit = state.board[act.from.r][act.from.c];
    if (!unit) return -1e9;
    const target = state.board[act.to.r][act.to.c];
    const isBarrage = act.type === 'barrage';
    const isScan = act.type === 'scan';
    let s = 0;

    if (isScan) {
      s = 34;
      if (target && !target.revealed) {
        // scanning a piece that has never moved is more informative
        s += target.hasMoved ? 4 : 12;
      }
      return s + Math.random() * 6;
    }

    if (isBarrage) {
      s = attackEV(state, viewer, unit.key, target, true);
      if (target && !target.revealed) s += 10; // free probe, no risk
      s += 6; // tempo: shooting costs nothing but the turn
      return s;
    }

    if (act.type === 'attack') {
      s = attackEV(state, viewer, unit.key, target, false);
      // attacker advantage tie is worth taking
      if (target && target.revealed && unit.rank === target.rank && state.config.tie === 'attacker') s += 6;
      return s;
    }

    // plain move
    s = positional(state, viewer, unit, act.from, act.to) + coreSafety(state, viewer, unit, act.to);
    // with pressure on our core, screen pieces should not wander
    if (difficulty === 'archon' && ownCorePressure(state, viewer) > 0) {
      if (unit.key === '10' || unit.key === '9') s -= 2.5;
    }
    // prefer moves that keep options open: standing still is not an action
    s += Math.random() * 2;
    return s;
  }

  function evaluatePosition(state, player) {
    let s = 0;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const u = state.board[r][c];
        if (!u) continue;
        const v = VALUE[u.key] || 30;
        s += u.owner === player ? v : -v;
      }
    }
    if (state.phase === 'over') {
      if (state.winner === player) s += 5000;
      else if (state.winner === 0) s += 0;
      else s -= 5000;
    }
    return s;
  }

  function bestReplyValue(state, player) {
    // `state` is now the opponent's turn; how good is their best greedy reply?
    const foe = player === 1 ? 2 : 1;
    const actions = E.allLegalActions(state, foe);
    if (!actions.length) return -5000;
    let best = -1e9;
    for (let i = 0; i < actions.length; i++) {
      const v = scoreAction(state, foe, actions[i], 'veteran');
      if (v > best) best = v;
    }
    return best;
  }

  function chooseAction(state, player, difficultyKey, rng) {
    const diff = U.DIFFICULTIES[difficultyKey] || U.DIFFICULTIES.veteran;
    const rand = rng || Math.random;
    const actions = E.allLegalActions(state, player);
    if (!actions.length) return null;

    const scored = actions.map(function (a) {
      return { a: a, s: scoreAction(state, player, a, diff.key) };
    });
    scored.sort(function (x, y) { return y.s - x.s; });

    // difficulty noise: recruit sometimes plays a merely-ok move
    const top = diff.key === 'recruit' ? Math.min(scored.length, 6) : diff.key === 'veteran' ? 3 : 2;
    let pick = 0;
    if (rand() < diff.noise) pick = Math.floor(rand() * top);
    pick = Math.min(pick, scored.length - 1);

    if (diff.key === 'archon' && scored.length > 1) {
      // 1-ply lookahead: prefer moves that survive the opponent's best answer
      const shortlist = scored.slice(0, Math.min(10, scored.length));
      let best = null;
      let bestVal = -1e12;
      shortlist.forEach(function (cand) {
        const sim = E.clone(state);
        const res = E.applyAction(sim, cand.a);
        if (!res.ok) return;
        let val;
        if (sim.phase === 'over') {
          val = sim.winner === player ? 100000 : sim.winner === 0 ? 0 : -100000;
        } else {
          const reply = bestReplyValue(sim, player);
          val = evaluatePosition(sim, player) - reply * 0.55 + cand.s * 0.35;
        }
        if (val > bestVal) { bestVal = val; best = cand.a; }
      });
      if (best) return best;
    }

    return scored[pick].a;
  }

  /* For the Advisor panel: top 3 candidate actions with plain-language notes */
  function advise(state, player, limit) {
    const actions = E.allLegalActions(state, player);
    const scored = actions.map(function (a) {
      return { a: a, s: scoreAction(state, player, a, 'veteran') };
    }).sort(function (x, y) { return y.s - x.s; });
    const out = [];
    const seen = {};
    for (let i = 0; i < scored.length && out.length < (limit || 3); i++) {
      const cand = scored[i];
      const unit = state.board[cand.a.from.r][cand.a.from.c];
      const target = state.board[cand.a.to.r][cand.a.to.c];
      const key = cand.a.type + ':' + (target ? target.id : cand.a.to.r + ',' + cand.a.to.c);
      if (seen[key]) continue;
      seen[key] = true;
      let note = '';
      if (cand.a.type === 'scan') note = 'Reveal a hidden piece before committing.';
      else if (cand.a.type === 'barrage') {
        note = target && target.revealed
          ? 'Known target — safe shot.'
          : 'Free probe at range: the Lancer cannot be hurt by the reply.';
      } else if (cand.a.type === 'attack') {
        note = target && target.revealed
          ? 'Known strength — favourable trade.'
          : 'Unknown defender. Risky if it is a Mine or a heavier piece.';
      } else {
        note = 'Reposition to improve the next tempo.';
      }
      out.push({
        action: cand.a,
        score: Math.round(cand.s),
        label: unit.name + ' → ' + (target ? (target.revealed ? target.name : 'unknown piece') : 'open ground'),
        note: note
      });
    }
    return out;
  }

  AC.ai = {
    VALUE: VALUE,
    predict: predict,
    chooseAction: chooseAction,
    advise: advise,
    attackEV: attackEV,
    beliefDist: beliefDist,
    scoreAction: scoreAction
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
