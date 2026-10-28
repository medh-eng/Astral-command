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
      name: 'Suryavansh',
      deva: 'सूर्यवंश',
      short: 'Surya',
      motto: 'The sun holds the line',
      color: '#22d3ee',
      color2: '#38bdf8',
      accent: '#a5f3fc',
      alt: '#fbbf24'
    },
    2: {
      id: 2,
      name: 'Chandravansh',
      deva: 'चंद्रवंश',
      short: 'Chandra',
      motto: 'The moon eats the light',
      color: '#f43f5e',
      color2: '#a855f7',
      accent: '#fecdd3',
      alt: '#c084fc'
    }
  };

  // Complete 12-piece roster. `rank` drives combat; `power` describes the special.
  const UNIT_DEFS = {
    '10': {
      key: '10', rank: 10, count: 1, one: "Strongest piece on the field. Keep it hidden, then commit it.", name: 'Senapati', short: 'Senapati', deva: 'सेनापति', alias: 'Solar Archon',
      badge: '10', movable: true, moveRange: 1, tier: 'command',
      role: 'Supreme Commander',
      power: null,
      desc: 'Moves 1 cell. Beats every unit in melee except a Shataghni, or a Chara that strikes first.',
      tip: 'Keep it behind a screen until the enemy Chara is spent.'
    },
    '9': {
      key: '9', rank: 9, count: 1, one: "Second strongest — beats everything except the commander.", name: 'Maharathi', short: 'Maharathi', deva: 'महारथी', alias: 'Star Paladin',
      badge: '9', movable: true, moveRange: 1, tier: 'command',
      role: 'Heavy Warlord',
      power: null,
      desc: 'Moves 1 cell. Second-highest rank — only the Senapati outranks it, and an attacking Chara can fell it.',
      tip: 'A bodyguard for your core: strong enough to absorb probes.'
    },
    '7': {
      key: '7', rank: 7, count: 1, one: "Fast flanker. Rushes two cells and strikes at the end.", name: 'Ashvarohi', short: 'Ashvarohi', deva: 'अश्वारोही', alias: 'Valkyrie Vanguard',
      badge: '7', movable: true, moveRange: 2, tier: 'elite',
      role: 'Phase Dasher',
      power: { id: 'dash', label: 'Dvi-pada Dash', range: 2 },
      desc: 'Moves up to 2 open cells along a lane and may strike at the end of a 2-cell dash.',
      tip: 'Reaches the second rank of a formation in one tempo.'
    },
    '6': {
      key: '6', rank: 6, count: 1, one: "Shoots two cells away without moving. Your safe probe.", name: 'Dhanurdhar', short: 'Dhanurdhar', deva: 'धनुर्धर', alias: 'Plasma Lancer',
      badge: '6', movable: true, moveRange: 1, tier: 'elite', hasRanged: true,
      role: 'Arc Artillery',
      power: { id: 'barrage', label: 'Shara-varsha', range: 2 },
      desc: 'Moves 1 cell, or fires a volley at exactly 2 cells, arcing over anything in between. Cuts down Rank ≤ 5 without moving.',
      tip: 'The only piece that kills without moving — and it cannot be hurt by the reply.'
    },
    '5': {
      key: '5', rank: 5, count: 1, one: "Reveals an enemy within two cells without a fight.", name: 'Divyadrishti', short: 'Divyadrishti', deva: 'दिव्यदृष्टि', alias: 'Chrono Seer',
      badge: '5', movable: true, moveRange: 1, tier: 'elite', hasScan: true,
      role: 'Psionic Scanner',
      power: { id: 'scan', label: 'Divya-drishti', range: 2 },
      desc: 'Moves 1 cell, or scans: permanently reveals any enemy within 2 cells without fighting.',
      tip: 'Information is tempo. Scan before you commit an attack.'
    },
    '3': {
      key: '3', rank: 3, count: 2, one: "The only piece that can clear a trap. Do not waste it.", name: 'Yantrik', short: 'Yantrik', deva: 'यंत्रिक', alias: 'Warp Sapper',
      badge: '3', movable: true, moveRange: 1, tier: 'line', defusesMines: true,
      role: 'Mine Specialist ×2',
      power: null,
      desc: 'Moves 1 cell. The only unit that can defuse and capture an immovable Shataghni.',
      tip: 'Your trap-clearer is also your best cheap probe.'
    },
    '2': {
      key: '2', rank: 2, count: 2, one: "Slides across open lanes and can strike in the same turn.", name: 'Rath', short: 'Rath', deva: 'रथ', alias: 'Astral Strider',
      badge: '2', movable: true, moveRange: 99, tier: 'line',
      role: 'Long-Range Scout ×2',
      power: null,
      desc: 'Slides any number of open cells along a lane and may attack in the same turn. A 2+ cell run exposes it.',
      tip: 'Crossing the board reveals you — run late, not early.'
    },
    '1': {
      key: '1', rank: 1, count: 1, one: "Kills the commander and the champion — but only if it strikes first.", name: 'Chara', short: 'Chara', deva: 'चर', alias: 'Shadow Wraith',
      badge: 'S', movable: true, moveRange: 1, tier: 'line', assassin: true,
      role: 'Cloaked Assassin',
      power: null,
      desc: 'Moves 1 tile. If it attacks first it slays the Archon (10) or the Paladin (9). Against anything else it loses.',
      tip: 'Hold it for the endgame, then trade it for a commander.'
    },
    'B': {
      key: 'B', rank: 0, count: 1, one: "Immovable trap. Kills anything that hits it, except the engineer.", name: 'Shataghni', short: 'Shataghni', deva: 'शतघ्नी', alias: 'Stasis Mine',
      badge: 'B', movable: false, moveRange: 0, tier: 'trap',
      role: 'Singularity Trap',
      power: null,
      desc: 'Immovable. Destroys any unit that attacks it, and survives — unless that unit is a Yantrik.',
      tip: 'A mine only works once. Hide it where a probe must pass.'
    },
    'F': {
      key: 'F', rank: -1, count: 1, one: "Your fort. Lose it and you lose the match. It never moves.", name: 'Durg', short: 'Durg', deva: 'दुर्ग', alias: 'Nexus Core',
      badge: 'F', movable: false, moveRange: 0, tier: 'trap',
      role: 'Primary Objective',
      power: null,
      desc: 'Immovable. Lose it and the match is over — by melee capture or a volley from range.',
      tip: 'Never leave it where an archer has a clear two-cell lane.'
    }
  };

  // Exactly 12 pieces, in deployment order.
  const ROSTER_ORDER = ['10', '9', '7', '6', '5', '3', '3', '2', '2', '1', 'B', 'F'];

  const RANK_ORDER = ['10', '9', '7', '6', '5', '3', '2', '1', 'B', 'F'];

  // Board geometry. Rifts are impassable, but the Lancer may fire across them.
  const BOARDS = {
    small: { key: 'small', cols: 6, rows: 8, deployRows: 3, label: 'Small Arena', blurb: '6 × 8 · fast and brutal', rifts: ['3,1', '4,1', '3,4', '4,4'] },
    wheel: {
      key: 'wheel', cols: 0, rows: 0, deployRows: 0, cells: 37,
      label: 'Chakravyuha', blurb: 'the wheel · rings turn every 5 turns', rifts: []
    },
    padma: {
      key: 'padma', cols: 0, rows: 0, deployRows: 0, cells: 37,
      label: 'Padmavyuha', blurb: 'the lotus · hexagon, six exits, facing counts', rifts: []
    },
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

  /* Scenarios are asymmetric setups layered on the same rules. */
  const SCENARIOS = {
    duel: {
      key: 'duel',
      label: 'Duel',
      blurb: 'Two equal armies, one wheel or arena',
      boards: ['padma', 'wheel', 'small', 'large'],
      rosters: null,
      turnLimit: 0
    },
    abhimanyu: {
      key: 'abhimanyu',
      label: 'Abhimanyu',
      blurb: 'Eight raiders must break a ten-piece wheel inside twenty-four rounds',
      boards: ['wheel'],
      // a raiding party: no fort, no trap, no commander — just the tools to
      // break a line: a champion, cavalry, an archer, a seer, two chariots,
      // a spy and an engineer
      rosters: { 1: ['9', '7', '6', '5', '2', '2', '1', '3'], 2: ['10', '9', '7', '6', '5', '3', '2', '1', 'B', 'F'] },
      turnLimit: 24
    }
  };

  AC.units = {
    FACTIONS: FACTIONS,
    UNIT_DEFS: UNIT_DEFS,
    ROSTER_ORDER: ROSTER_ORDER,
    RANK_ORDER: RANK_ORDER,
    BOARDS: BOARDS,
    DIFFICULTIES: DIFFICULTIES,
    SCENARIOS: SCENARIOS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
