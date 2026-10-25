/* Aetherfront: Astral Command — Astral AI (v3)
 * Hidden-information bot on a cell graph. It never looks at the opponent's
 * hidden ranks: it reasons over a belief distribution built from the pieces it
 * has not accounted for, plus the public "has this unit ever moved" signal.
 * Positional sense is graph distance to the enemy fort, so the same code plays
 * a square arena and the Chakravyuha wheel.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const E = AC.engine;
  const U = AC.units;
  const G = AC.geometry;

  const VALUE = {
    F: 900, '10': 120, '9': 80, '7': 56, '6': 56, '5': 50,
    '3': 26, '2': 30, '1': 46, B: 16
  };

  /* Pure outcome prediction — mirrors engine.resolveMelee / barrage. */
  function predict(attKey, defKey, tie, isBarrage) {
    const A = U.UNIT_DEFS[attKey];
    const D = U.UNIT_DEFS[defKey];
    if (!A || !D) return { out: 'none' };
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

  function unitsOf(state, owner) {
    const out = [];
    E.forEachUnit(state, function (u, id) {
      if (u.owner === owner) out.push({ u: u, id: id });
    });
    return out;
  }

  function findCore(state, owner) {
    let found = null;
    E.forEachUnit(state, function (u, id) {
      if (!found && u.owner === owner && u.key === 'F') found = id;
    });
    return found;
  }

  function distMap(state, fromId) {
    if (!fromId) return null;
    return G.distances(state.boardKey, fromId);
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

  /* Expected value of attacking a defender, averaged over what it could be. */
  function attackEV(state, viewer, attKey, target, isBarrage) {
    const tie = state.config.tie;
    const own = VALUE[attKey] || 30;
    if (target.revealed) {
      const res = predict(attKey, target.key, tie, isBarrage);
      const tval = VALUE[target.key] || 30;
      if (res.out === 'core') return 900;
      if (res.out === 'att') return tval;
      if (res.out === 'def' || res.out === 'mine') return -own;
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
      else if (res.out === 'def' || res.out === 'mine') ev += p * -own;
      else if (res.out === 'both') ev += p * (tval - own);
    });
    if (!target.hasMoved) ev += 4;
    // information is worth something: a cheap piece poking an unknown one
    // learns a rank even when it dies, which is what keeps games moving
    const own2 = VALUE[attKey] || 30;
    const infoBonus = own2 <= 30 ? 12 : own2 <= 56 ? 5 : 1.5;
    ev += infoBonus;
    return ev;
  }

  function ownCorePressure(state, viewer) {
    const core = findCore(state, viewer);
    if (!core) return 0;
    const d = distMap(state, core);
    let n = 0;
    unitsOf(state, viewer === 1 ? 2 : 1).forEach(function (e) {
      const dd = d[e.id];
      if (dd <= 2) n += dd === 1 ? 2 : 1;
    });
    return n;
  }

  function positional(state, viewer, unit, from, to) {
    const foe = viewer === 1 ? 2 : 1;
    const enemyCore = findCore(state, foe);
    const ownCore = findCore(state, viewer);
    const dEnemy = distMap(state, enemyCore);
    const dOwn = distMap(state, ownCore);
    let s = 0;

    // closing on the enemy fort
    if (dEnemy) {
      const before = dEnemy[from];
      const after = dEnemy[to];
      if (isFinite(before) && isFinite(after)) {
        const gain = before - after;
        if (unit.key === '10' || unit.key === '9') s += gain * 1.1;
        else if (unit.key === 'F' || unit.key === 'B') s += 0;
        else s += gain * 3.2;
      }
    }

    // heavy pieces should not drift far from home
    if ((unit.key === '10' || unit.key === '9') && dOwn) {
      const dHome = dOwn[to];
      if (dHome > 4) s -= (dHome - 4) * 1.6;
    }

    // the hub is powerful but exposes you
    if (to === 'h') s += 2.5;

    // sappers hunt unmoved pieces (mine / fort candidates)
    if (U.UNIT_DEFS[unit.key].defusesMines) {
      let best = 99;
      unitsOf(state, foe).forEach(function (e) {
        if (e.u.hasMoved) return;
        const d = dOwn ? dOwn[e.id] : 99;
        void d;
      });
      const dd = distMap(state, to);
      unitsOf(state, foe).forEach(function (e) {
        if (e.u.hasMoved) return;
        const v = dd[e.id];
        if (v < best) best = v;
      });
      if (best < 99) s += (6 - Math.min(6, best)) * 2.4;
    }

    // the spy stalks revealed commanders
    if (U.UNIT_DEFS[unit.key].assassin) {
      const dd = distMap(state, to);
      let best = 99;
      unitsOf(state, foe).forEach(function (e) {
        if (e.u.revealed && (e.u.key === '10' || e.u.key === '9')) {
          const v = dd[e.id];
          if (v < best) best = v;
        }
      });
      if (best < 99) s += (5 - Math.min(5, best)) * 5;
    }

    // stepping next to unknowns with a valuable piece is a gamble
    if (VALUE[unit.key] >= 50) {
      const b = E.board(state);
      let threats = 0;
      (b.neighbours[to] || []).forEach(function (n) {
        const occ = state.board[n];
        if (occ && occ.owner === foe && !occ.revealed) threats++;
      });
      s -= threats * (VALUE[unit.key] / 22);
    }
    return s;
  }

  function scoreAction(state, viewer, act, difficulty) {
    const unit = state.board[act.from];
    if (!unit) return -1e9;
    const target = state.board[act.to] || null;
    const isBarrage = act.type === 'barrage';

    // when the no-capture clock runs down, a draw is a loss of tempo: the bot
    // starts forcing contact instead of manoeuvring forever
    let urgency = 0;
    if (typeof E.drawCountdown === 'function') {
      const left = E.drawCountdown(state);
      if (left < 30) urgency = (30 - left) * 1.8;
    }

    if (act.type === 'scan') {
      let s = 34 + urgency * 0.3;
      if (target && !target.revealed) s += target.hasMoved ? 4 : 12;
      return s + Math.random() * 6;
    }
    if (isBarrage) {
      let s = attackEV(state, viewer, unit.key, target, true);
      if (target && !target.revealed) s += 10;
      return s + 6 + urgency * 0.5;
    }
    if (act.type === 'attack') {
      let s = attackEV(state, viewer, unit.key, target, false);
      if (target && target.revealed && unit.rank === target.rank && state.config.tie === 'attacker') s += 6;
      return s + urgency;
    }
    let s = positional(state, viewer, unit, act.from, act.to);
    if (difficulty === 'archon' && ownCorePressure(state, viewer) > 0) {
      if (unit.key === '10' || unit.key === '9') s -= 2.5;
    }
    return s + Math.random() * 2;
  }

  function evaluatePosition(state, player) {
    let s = 0;
    E.forEachUnit(state, function (u) {
      const v = VALUE[u.key] || 30;
      s += u.owner === player ? v : -v;
    });
    if (state.phase === 'over') {
      if (state.winner === player) s += 5000;
      else if (state.winner !== 0) s -= 5000;
    }
    return s;
  }

  function bestReplyValue(state, player) {
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

    const top = diff.key === 'recruit' ? Math.min(scored.length, 6) : diff.key === 'veteran' ? 3 : 2;
    let pick = 0;
    if (rand() < diff.noise) pick = Math.floor(rand() * top);
    pick = Math.min(pick, scored.length - 1);

    if (diff.key === 'archon' && scored.length > 1) {
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

  function advise(state, player, limit) {
    const actions = E.allLegalActions(state, player);
    const scored = actions.map(function (a) {
      return { a: a, s: scoreAction(state, player, a, 'veteran') };
    }).sort(function (x, y) { return y.s - x.s; });
    const out = [];
    const seen = {};
    for (let i = 0; i < scored.length && out.length < (limit || 3); i++) {
      const cand = scored[i];
      const unit = state.board[cand.a.from];
      const target = state.board[cand.a.to] || null;
      const key = cand.a.type + ':' + (target ? target.id : cand.a.to);
      if (seen[key]) continue;
      seen[key] = true;
      let note = '';
      if (cand.a.type === 'scan') note = 'Reveal a hidden piece before committing.';
      else if (cand.a.type === 'barrage') {
        note = target && target.revealed ? 'Known target — safe volley.' : 'Free probe at range: the archer cannot be hurt by the reply.';
      } else if (cand.a.type === 'attack') {
        note = target && target.revealed ? 'Known strength — favourable trade.' : 'Unknown defender. Risky if it is a Shataghni or a heavier piece.';
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
    scoreAction: scoreAction,
    findCore: findCore
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
