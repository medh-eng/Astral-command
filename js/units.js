/* Aetherfront: Astral Command — roster definition
 * Classic script (no modules) so the game also runs from file://
 * Attaches to global AC.units
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  const FACTIONS = {
    1: {
      id: 1,
      name: 'Solaris Order',
      short: 'Solaris',
      motto: 'Light holds the line',
      color: '#22d3ee',
      color2: '#38bdf8',
      accent: '#a5f3fc',
      alt: '#fbbf24'
    },
    2: {
      id: 2,
      name: 'Void Cabal',
      short: 'Void',
      motto: 'Silence eats the stars',
      color: '#f43f5e',
      color2: '#a855f7',
      accent: '#fecdd3',
      alt: '#c084fc'
    }
  };

  // Complete 12-piece roster. `rank` drives combat; `power` describes the special.
  const UNIT_DEFS = {
    '10': {
      key: '10', rank: 10, count: 1, name: 'Solar Archon', short: 'Archon',
      badge: '10', movable: true, moveRange: 1, tier: 'command',
      role: 'Supreme Commander',
      power: null,
      desc: 'Moves 1 tile. Beats every unit in melee except a Stasis Mine, or a Shadow Wraith that strikes first.',
      tip: 'Keep it behind a screen until the enemy Wraith is spent.'
    },
    '9': {
      key: '9', rank: 9, count: 1, name: 'Star Paladin', short: 'Paladin',
      badge: '9', movable: true, moveRange: 1, tier: 'command',
      role: 'Heavy Warlord',
      power: null,
      desc: 'Moves 1 tile. Second-highest rank — only the Archon outranks it, and an attacking Wraith can fell it.',
      tip: 'A bodyguard for your core: strong enough to absorb probes.'
    },
    '7': {
      key: '7', rank: 7, count: 1, name: 'Valkyrie Vanguard', short: 'Valkyrie',
      badge: '7', movable: true, moveRange: 2, tier: 'elite',
      role: 'Phase Dasher',
      power: { id: 'dash', label: 'Phase Dash', range: 2 },
      desc: 'Moves up to 2 open tiles in a straight line and may strike at the end of a 2-tile dash.',
      tip: 'Reaches the second rank of a formation in one tempo.'
    },
    '6': {
      key: '6', rank: 6, count: 1, name: 'Plasma Lancer', short: 'Lancer',
      badge: '6', movable: true, moveRange: 1, tier: 'elite', hasRanged: true,
      role: 'Arc Artillery',
      power: { id: 'barrage', label: 'Arc Barrage', range: 2 },
      desc: 'Moves 1 tile, or fires an Arc Barrage at exactly 2 tiles, arcing over any unit or rift in between. Vaporises Rank ≤ 5 without moving.',
      tip: 'The only unit that kills without moving — and it cannot be hurt by the reply.'
    },
    '5': {
      key: '5', rank: 5, count: 1, name: 'Chrono Seer', short: 'Seer',
      badge: '5', movable: true, moveRange: 1, tier: 'elite', hasScan: true,
      role: 'Psionic Scanner',
      power: { id: 'scan', label: 'Psionic Scan', range: 2 },
      desc: 'Moves 1 tile, or scans: permanently reveals any enemy within 2 tiles (Manhattan) without fighting.',
      tip: 'Information is tempo. Scan before you commit an attack.'
    },
    '3': {
      key: '3', rank: 3, count: 2, name: 'Warp Sapper', short: 'Sapper',
      badge: '3', movable: true, moveRange: 1, tier: 'line', defusesMines: true,
      role: 'Mine Specialist ×2',
      power: null,
      desc: 'Moves 1 tile. The only unit that can defuse and capture an immovable Stasis Mine.',
      tip: 'Your mine-clearer is also your best cheap probe.'
    },
    '2': {
      key: '2', rank: 2, count: 2, name: 'Astral Strider', short: 'Strider',
      badge: '2', movable: true, moveRange: 99, tier: 'line',
      role: 'Long-Range Scout ×2',
      power: null,
      desc: 'Slides any number of open tiles in a straight line and may attack in the same turn. A 2+ tile run exposes it.',
      tip: 'Crossing the board reveals you — run late, not early.'
    },
    '1': {
      key: '1', rank: 1, count: 1, name: 'Shadow Wraith', short: 'Wraith',
      badge: 'S', movable: true, moveRange: 1, tier: 'line', assassin: true,
      role: 'Cloaked Assassin',
      power: null,
      desc: 'Moves 1 tile. If it attacks first it slays the Archon (10) or the Paladin (9). Against anything else it loses.',
      tip: 'Hold it for the endgame, then trade it for a commander.'
    },
    'B': {
      key: 'B', rank: 0, count: 1, name: 'Stasis Mine', short: 'Mine',
      badge: 'B', movable: false, moveRange: 0, tier: 'trap',
      role: 'Singularity Trap',
      power: null,
      desc: 'Immovable. Destroys any unit that attacks it, and survives — unless that unit is a Warp Sapper.',
      tip: 'A mine only works once. Hide it where a probe must pass.'
    },
    'F': {
      key: 'F', rank: -1, count: 1, name: 'Nexus Core', short: 'Nexus',
      badge: 'F', movable: false, moveRange: 0, tier: 'trap',
      role: 'Primary Objective',
      power: null,
      desc: 'Immovable. Lose it and the match is over — by melee capture or a Lancer shot from range.',
      tip: 'Never leave it where a Lancer has a clear 2-tile line.'
    }
  };

  // Exactly 12 pieces, in deployment order.
  const ROSTER_ORDER = ['10', '9', '7', '6', '5', '3', '3', '2', '2', '1', 'B', 'F'];

  const RANK_ORDER = ['10', '9', '7', '6', '5', '3', '2', '1', 'B', 'F'];

  // Board geometry. Rifts are impassable, but the Lancer may fire across them.
  const BOARDS = {
    small: { key: 'small', cols: 6, rows: 8, deployRows: 3, label: 'Small Arena', blurb: '6 × 8 · fast and brutal', rifts: ['3,1', '4,1', '3,4', '4,4'] },
    large: {
      key: 'large', cols: 8, rows: 10, deployRows: 3, label: 'Large Expanse', blurb: '8 × 10 · room to flank', rifts: (function () {
        const out = [];
        [4, 5].forEach(function (r) { [1, 2, 5, 6].forEach(function (c) { out.push(r + ',' + c); }); });
        return out;
      })()
    }
  };

  const DIFFICULTIES = {
    recruit: { key: 'recruit', label: 'Recruit', blurb: 'Greedy probes, forgets your threats', think: 420, noise: 0.55, depth: 0 },
    veteran: { key: 'veteran', label: 'Veteran', blurb: 'Reads your formation, punishes loose pieces', think: 620, noise: 0.22, depth: 1 },
    archon: { key: 'archon', label: 'Archon', blurb: 'Full belief model, sees your best reply', think: 780, noise: 0.06, depth: 2 }
  };

  AC.units = {
    FACTIONS: FACTIONS,
    UNIT_DEFS: UNIT_DEFS,
    ROSTER_ORDER: ROSTER_ORDER,
    RANK_ORDER: RANK_ORDER,
    BOARDS: BOARDS,
    DIFFICULTIES: DIFFICULTIES
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
