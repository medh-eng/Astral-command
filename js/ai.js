/* VYUHA — the opponent (v4)
 * Hidden-information bot on a cell graph. It never looks at the opponent's
 * hidden ranks: it reasons over a belief distribution built from the pieces it
 * has not accounted for, plus the public "has this unit ever moved" signal.
 * Positional sense is graph distance to the enemy fort, so the same code plays
 * the square arenas, the Chakravyuha wheel and the Padmavyuha lotus.
 *
 * Chapter III: it reads the hour and the formations (the same visible bonuses
 * the odds panel shows), it knows a fort has a gate, and it invokes astras.
 * Three temperaments: Sainik (learning), Dronacharya (the teacher), Shakuni
 * (looks one reply ahead and plays on your mistakes).
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
  const BREACH_VALUE = 260;

  /* Back-compatible outcome table: predict(attKey, defKey, tie, isBarrage, extra). */
  function predict(attKey, defKey, tie, isBarrage, extra) {
    return E.predict(attKey, defKey, Object.assign({ tie: tie, barrage: !!isBarrage }, extra || {}));
  }

  function unitsOf(state, owner) {
    const out = [];
    E.forEachUnit(state, function (u, id) {
      if (u.owner === owner) out.push({ u: u, id: id });
    });
    return out;
  }

  function findCore(state, owner) {
    return E.findUnit(state, function (u) { return u.owner === owner && u.key === 'F'; });
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

  function outcomeValue(res, k, own, target) {
    const tval = VALUE[k] || 30;
    if (res.out === 'core') return 900;
    if (res.out === 'breach') return BREACH_VALUE;
    if (res.out === 'att') return tval;
    if (res.out === 'def' || res.out === 'mine') return -own;
    if (res.out === 'both') return tval - own;
    if (res.out === 'noop' && target && !target.revealed) return 4;
    return 0;
  }

  /* Expected value of a strike, averaged over what the defender could be,
   * including the visible bonuses of the hour and the formations. */
  function attackEV(state, viewer, attKey, target, isBarrage, from, to) {
    const own = VALUE[attKey] || 30;
    const r = E.rules(state);
    const att = from ? state.board[from] : null;
    const ctx = (!isBarrage && from && to) ? E.combatContext(state, from, to) : { att: 0, def: 0 };
    const opts = function (k) {
      return {
        tie: state.config.tie, barrage: !!isBarrage, gates: r.gates,
        breached: !!(target && target.key === 'F' && target.breached),
        att: ctx.att, def: (k === 'F' || k === 'B') ? 0 : ctx.def,
        attRank: att ? att.rank : undefined
      };
    };
    if (target.revealed) {
      return outcomeValue(E.predict(attKey, target.key, opts(target.key)), target.key, own, target);
    }
    const dist = beliefDist(state, viewer, target);
    let ev = 0;
    Object.keys(dist).forEach(function (k) {
      ev += dist[k] * outcomeValue(E.predict(attKey, k, opts(k)), k, own, target);
    });
    if (!target.hasMoved) ev += 4;
    // information is worth something: a cheap piece poking an unknown one
    // learns a rank even when it dies, which is what keeps games moving
    const infoBonus = own <= 30 ? 12 : own <= 56 ? 5 : 1.5;
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

  /* Where the enemy fort probably is, from public information only: the
   * revealed fort if there is one, otherwise the deepest enemy piece that has
   * never moved. The opponent never peeks at hidden ranks. */
  function fortGuess(state, viewer) {
    const foe = viewer === 1 ? 2 : 1;
    const known = E.findUnit(state, function (u) { return u.owner === foe && u.key === 'F' && u.revealed; });
    if (known) return known;
    const depth = E.depthMap(state, foe);
    let best = null;
    let bestScore = -1;
    E.forEachUnit(state, function (u, id) {
      if (u.owner !== foe || u.hasMoved || u.revealed) return;
      const sc = (depth[id] || 0) * 10 + 1;
      if (sc > bestScore) { bestScore = sc; best = id; }
    });
    return best || state.homes[foe];
  }

  function positional(state, viewer, unit, from, to) {
    const foe = viewer === 1 ? 2 : 1;
    const guess = fortGuess(state, viewer);
    const guessUnit = guess ? state.board[guess] : null;
    const enemyBreached = !!(guessUnit && guessUnit.key === 'F' && guessUnit.revealed && guessUnit.breached);
    const ownCore = findCore(state, viewer);
    const dEnemy = distMap(state, guess);
    const dOwn = distMap(state, ownCore);
    let s = 0;

    // closing on the enemy fort (or the best guess at it); a broken gate
    // draws everyone in, and a stalling clock pushes harder
    const push = 1 + Math.min(2, urgencyOf(state) / 25);
    if (dEnemy) {
      const before = dEnemy[from];
      const after = dEnemy[to];
      if (isFinite(before) && isFinite(after)) {
        const gain = before - after;
        let w = (unit.key === '10' || unit.key === '9') ? 1.1 : (unit.key === 'F' || unit.key === 'B') ? 0 : 3.2;
        if (enemyBreached && w) w = 9;
        s += gain * w * push;
      }
    }

    // set up the jaws: step beside an enemy that one of ours already touches
    if (E.rules(state).vyuha && unit.key !== 'F' && unit.key !== 'B') {
      const b = E.board(state);
      (b.neighbours[to] || []).forEach(function (n) {
        const occ = state.board[n];
        if (!occ || occ.owner !== foe) return;
        const ours = (b.neighbours[n] || []).filter(function (m) {
          const x = state.board[m];
          return m !== from && x && x.owner === viewer && x.key !== 'F' && x.key !== 'B';
        });
        if (ours.length) s += 2.2;
      });
    }

    // heavy pieces should not drift far from home
    if ((unit.key === '10' || unit.key === '9') && dOwn) {
      const dHome = dOwn[to];
      if (dHome > 4) s -= (dHome - 4) * 1.6;
    }

    // a broken gate calls everyone home
    const fortCell = ownCore ? state.board[ownCore] : null;
    if (fortCell && fortCell.breached && dOwn && unit.key !== 'F' && unit.key !== 'B') {
      s += (dOwn[from] - dOwn[to]) * 6;
    }

    // the hub is powerful but exposes you
    if (to === 'h') s += 2.5;

    // engineers hunt unmoved pieces (trap / fort candidates)
    if (U.UNIT_DEFS[unit.key].defusesMines) {
      let best = 99;
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

    // stepping next to unknowns with a valuable piece is a gamble — more so
    // in the enemy's hour
    if (VALUE[unit.key] >= 50) {
      const b = E.board(state);
      let threats = 0;
      (b.neighbours[to] || []).forEach(function (n) {
        const occ = state.board[n];
        if (occ && occ.owner === foe && !occ.revealed) threats++;
      });
      const hourly = E.hourOwner(state) === foe ? 1.35 : 1;
      s -= threats * (VALUE[unit.key] / 22) * hourly;
    }

    return s;
  }

  function urgencyOf(state) {
    if (state.turnLimit) {
      const rounds = state.turnLimit - state.turn + 1;
      return rounds <= 12 ? (12 - rounds) * 2.4 : 0;
    }
    const left = E.drawCountdown(state);
    return left < 30 ? (30 - left) * 1.8 : 0;
  }

  function scoreAction(state, viewer, act, difficulty) {
    if (act.type === 'astra') return scoreAstra(state, viewer, act);
    const unit = state.board[act.from];
    if (!unit) return -1e9;
    const target = state.board[act.to] || null;
    const isBarrage = act.type === 'barrage';
    const urgency = urgencyOf(state);

    // defend a broken gate before anything else
    let defence = 0;
    const ownCore = findCore(state, viewer);
    if (ownCore && state.board[ownCore].breached && target && (act.type === 'attack' || isBarrage)) {
      const d = distMap(state, ownCore);
      if (d[act.to] <= 2) defence = 220;
    }

    if (act.type === 'scan') {
      let s = 34 + urgency * 0.3;
      if (target && !target.revealed) s += target.hasMoved ? 4 : 12;
      return s + Math.random() * 6;
    }
    if (isBarrage) {
      let s = attackEV(state, viewer, unit.key, target, true, act.from, act.to);
      if (target && !target.revealed) s += 10;
      return s + 6 + urgency * 0.5 + defence;
    }
    if (act.type === 'attack') {
      let s = attackEV(state, viewer, unit.key, target, false, act.from, act.to);
      if (target && target.revealed && unit.rank === target.rank && state.config.tie === 'attacker') s += 6;
      return s + urgency + defence;
    }
    let s = positional(state, viewer, unit, act.from, act.to);
    if (difficulty === 'archon' && ownCorePressure(state, viewer) > 0) {
      if (unit.key === '10' || unit.key === '9') s -= 2.5;
    }
    return s + Math.random() * 2;
  }

  /* ── astras ── */

  function strongestEnemyValue(state, viewer) {
    const foe = viewer === 1 ? 2 : 1;
    const pool = E.unknownPool(state, viewer);
    let best = 0;
    Object.keys(pool).forEach(function (k) {
      if (pool[k] > 0 && k !== 'F' && k !== 'B') best = Math.max(best, VALUE[k] || 0);
    });
    E.forEachUnit(state, function (u) {
      if (u.owner === foe && u.revealed && u.key !== 'F' && u.key !== 'B') best = Math.max(best, VALUE[u.key] || 0);
    });
    return best;
  }

  function scoreAstra(state, viewer, act) {
    const target = act.to ? state.board[act.to] : null;
    const cost = E.ASTRAS[act.astra].cost;
    const spend = cost * 7;                       // Shakti is worth saving
    if (act.astra === 'brahma' && target) {
      if (target.revealed) return (VALUE[target.key] || 30) * 1.05 - 20;
      const dist = beliefDist(state, viewer, target);
      let ev = 0;
      Object.keys(dist).forEach(function (k) {
        if (k !== 'F' && k !== 'B') ev += dist[k] * (VALUE[k] || 30);
      });
      return ev - 30;
    }
    if (act.astra === 'agneya' && target) {
      if (target.revealed) {
        if (target.key === 'F') return target.breached ? -50 : BREACH_VALUE - spend;
        if (target.key === 'B' || target.rank <= 4) return (VALUE[target.key] || 20) + 8 - spend;
        return -40;
      }
      const dist = beliefDist(state, viewer, target);
      let ev = 0;
      Object.keys(dist).forEach(function (k) {
        const p = dist[k];
        if (k === 'F') ev += p * BREACH_VALUE;
        else if (k === 'B' || U.UNIT_DEFS[k].rank <= 4) ev += p * (VALUE[k] || 20);
        else ev += p * 6;
      });
      return ev + 10 - spend;
    }
    if (act.astra === 'sammohana' && target) {
      const ownCore = findCore(state, viewer);
      let threat = 0;
      if (ownCore) {
        const d = distMap(state, ownCore);
        if (d[act.to] <= 2) threat = state.board[ownCore].breached ? 260 : 60;
      }
      const v = target.revealed ? (VALUE[target.key] || 30) : 40;
      return v * 0.4 + threat - spend - 6;
    }
    if (act.astra === 'vayavya') {
      // only worth it to carry a besieged fort out of reach
      const ownCore = findCore(state, viewer);
      if (!ownCore || act.from !== ownCore || !state.board[ownCore].breached) return -999;
      const foe = viewer === 1 ? 2 : 1;
      let nearest = 99;
      unitsOf(state, foe).forEach(function (e) {
        const d = distMap(state, e.id);
        if (d[act.to] < nearest) nearest = d[act.to];
      });
      return 120 + nearest * 40;
    }
    return -999;
  }

  /* Astra candidates without the full wind pair explosion: the wind is only
   * ever considered for the fort. */
  function astraCandidates(state, player) {
    if (!E.rules(state).astras) return [];
    const out = [];
    E.ASTRA_ORDER.forEach(function (key) {
      if (!E.astraReady(state, player, key)) return;
      if (key === 'vayavya') {
        const core = findCore(state, player);
        if (!core || !state.board[core].breached) return;
        E.astraTargets(state, player, key, core).forEach(function (id) {
          const u = state.board[id];
          if (u && u.key !== 'B') out.push({ type: 'astra', astra: key, from: core, to: id });
        });
        return;
      }
      E.astraTargets(state, player, key).forEach(function (id) {
        out.push({ type: 'astra', astra: key, to: id });
      });
    });
    return out;
  }

  function evaluatePosition(state, player) {
    let s = 0;
    E.forEachUnit(state, function (u) {
      let v = VALUE[u.key] || 30;
      if (u.key === 'F' && u.breached) v -= BREACH_VALUE;
      s += u.owner === player ? v : -v;
    });
    if (state.shakti) s += ((state.shakti[player] || 0) - (state.shakti[player === 1 ? 2 : 1] || 0)) * 6;
    if (state.phase === 'over') {
      if (state.winner === player) s += 5000;
      else if (state.winner !== 0) s -= 5000;
    }
    return s;
  }

  function bestReplyValue(state, player) {
    const foe = player === 1 ? 2 : 1;
    const actions = E.allLegalActions(state, foe).concat(astraCandidates(state, foe));
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
    const actions = E.allLegalActions(state, player).concat(astraCandidates(state, player));
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
      const impatience = urgencyOf(state) * 3;
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
          // Shakuni grows impatient when the no-capture clock runs down
          if (impatience && (cand.a.type === 'attack' || cand.a.type === 'barrage' || cand.a.type === 'astra')) val += impatience;
        }
        if (val > bestVal) { bestVal = val; best = cand.a; }
      });
      if (best) return best;
    }
    return scored[pick].a;
  }

  const ASTRA_NOTE = {
    vayavya: 'Carry your fort out of the enemy’s reach on the wind.',
    sammohana: 'Entrance the piece that threatens you for two turns.',
    agneya: 'Burn a piece of rank 4 or less — traps included.',
    brahma: 'Destroy the strongest enemy piece on the field.'
  };

  function advise(state, player, limit) {
    const actions = E.allLegalActions(state, player).concat(astraCandidates(state, player));
    const scored = actions.map(function (a) {
      return { a: a, s: scoreAction(state, player, a, 'veteran') };
    }).sort(function (x, y) { return y.s - x.s; });
    const out = [];
    const seen = {};
    for (let i = 0; i < scored.length && out.length < (limit || 3); i++) {
      const cand = scored[i];
      const unit = cand.a.from ? state.board[cand.a.from] : null;
      const target = state.board[cand.a.to] || null;
      const key = cand.a.type + ':' + (cand.a.astra || '') + ':' + (target ? target.id : cand.a.to);
      if (seen[key]) continue;
      seen[key] = true;
      let note = '';
      let label = '';
      if (cand.a.type === 'astra') {
        const name = (U.ASTRA_DEFS && U.ASTRA_DEFS[cand.a.astra]) ? U.ASTRA_DEFS[cand.a.astra].name : cand.a.astra;
        label = name + ' → ' + (target ? (target.owner === player || target.revealed ? target.name : 'hidden piece') : 'the field');
        note = ASTRA_NOTE[cand.a.astra] || '';
      } else {
        if (cand.a.type === 'scan') note = 'Reveal a hidden piece before committing.';
        else if (cand.a.type === 'barrage') {
          note = target && target.revealed ? 'Known target — safe volley.' : 'Free probe at range: the archer cannot be hurt by the reply.';
        } else if (cand.a.type === 'attack') {
          note = target && target.revealed ? 'Known strength — favourable trade.' : 'Unknown defender. Risky if it is a Shataghni or a heavier piece.';
          const ctx = E.combatContext(state, cand.a.from, cand.a.to);
          if (ctx.att) note += ' You strike at +' + ctx.att + '.';
        } else {
          note = 'Reposition to improve the next tempo.';
        }
        label = unit.name + ' → ' + (target ? (target.revealed ? target.name : 'unknown piece') : 'open ground');
      }
      out.push({ action: cand.a, score: Math.round(cand.s), label: label, note: note });
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
    astraCandidates: astraCandidates,
    findCore: findCore,
    fortGuess: fortGuess
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
