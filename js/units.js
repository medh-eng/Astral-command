/* VYUHA — the balance file
 * Armies, boards, opponents, scenarios and the four astras. Everything a
 * designer would want to tune lives here as data.
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
      hour: 'day',
      color: '#e0a94a',
      color2: '#f2cf8b',
      accent: '#fde9c0',
      alt: '#fbbf24'
    },
    2: {
      id: 2,
      name: 'Chandravansh',
      deva: 'चंद्रवंश',
      short: 'Chandra',
      motto: 'The moon eats the light',
      hour: 'night',
      color: '#8b8ff0',
      color2: '#b9a8ff',
      accent: '#d7dbff',
      alt: '#c084fc'
    }
  };

  // Complete 12-piece roster. `rank` drives combat; `power` describes the special.
  const UNIT_DEFS = {
    '10': {
      key: '10', rank: 10, count: 1, one: 'Strongest piece on the field. Keep it hidden, then commit it.', name: 'Senapati', short: 'Senapati', deva: 'सेनापति', alias: 'Solar Archon',
      badge: '10', movable: true, moveRange: 1, tier: 'command',
      role: 'Commander of the army',
      power: null,
      desc: 'Moves 1 cell. Beats every piece in a straight fight — but a Chara that strikes first can kill it, and so can a pincer in the enemy’s hour.',
      tip: 'Keep it behind a screen until the enemy Chara is spent.'
    },
    '9': {
      key: '9', rank: 9, count: 1, one: 'Second strongest — beats everything except the Senapati.', name: 'Maharathi', short: 'Maharathi', deva: 'महारथी', alias: 'Star Paladin',
      badge: '9', movable: true, moveRange: 1, tier: 'command',
      role: 'Great chariot-warrior',
      power: null,
      desc: 'Moves 1 cell. Only the Senapati outranks it, and an attacking Chara can fell it. In its own hour, with a pincer, it can topple the Senapati.',
      tip: 'A bodyguard for your fort: strong enough to absorb probes.'
    },
    '7': {
      key: '7', rank: 7, count: 1, one: 'Fast flanker. Rushes two cells and strikes at the end.', name: 'Ashvarohi', short: 'Ashvarohi', deva: 'अश्वारोही', alias: 'Valkyrie Vanguard',
      badge: '7', movable: true, moveRange: 2, tier: 'elite',
      role: 'Cavalry',
      power: { id: 'dash', label: 'Dvi-pada Dash', range: 2 },
      desc: 'Moves up to 2 open cells along a lane and may strike at the end of the dash. A 2-cell dash reveals it.',
      tip: 'Reaches the second line of a formation in one tempo.'
    },
    '6': {
      key: '6', rank: 6, count: 1, one: 'Shoots two cells away without moving. Your safe probe.', name: 'Dhanurdhar', short: 'Dhanurdhar', deva: 'धनुर्धर', alias: 'Plasma Lancer',
      badge: '6', movable: true, moveRange: 1, tier: 'elite', hasRanged: true,
      role: 'Archer',
      power: { id: 'barrage', label: 'Shara-varsha', deva: 'शरवर्षा', range: 2 },
      desc: 'Moves 1 cell, or looses a rain of arrows at exactly 2 cells, over anything in between. Cuts down rank 5 or less without moving.',
      tip: 'The only piece that kills without moving — and it cannot be hurt by the reply.'
    },
    '5': {
      key: '5', rank: 5, count: 1, one: 'Reveals an enemy within two cells without a fight.', name: 'Divyadrishti', short: 'Divyadrishti', deva: 'दिव्यदृष्टि', alias: 'Chrono Seer',
      badge: '5', movable: true, moveRange: 1, tier: 'elite', hasScan: true,
      role: 'Seer',
      power: { id: 'scan', label: 'Divya-drishti', deva: 'दिव्यदृष्टि', range: 2 },
      desc: 'Moves 1 cell, or looks: permanently reveals any enemy within 2 cells without fighting.',
      tip: 'Information is tempo. Look before you strike.'
    },
    '3': {
      key: '3', rank: 3, count: 2, one: 'The only piece that can clear a trap. Do not waste it.', name: 'Yantrik', short: 'Yantrik', deva: 'यंत्रिक', alias: 'Warp Sapper',
      badge: '3', movable: true, moveRange: 1, tier: 'line', defusesMines: true,
      role: 'Engineer ×2',
      power: null,
      desc: 'Moves 1 cell. The only piece that can dismantle a Shataghni trap and take its cell.',
      tip: 'Your trap-clearer is also your best cheap probe.'
    },
    '2': {
      key: '2', rank: 2, count: 2, one: 'Slides across open lanes and can strike in the same turn.', name: 'Rath', short: 'Rath', deva: 'रथ', alias: 'Astral Strider',
      badge: '2', movable: true, moveRange: 99, tier: 'line',
      role: 'Chariot ×2',
      power: null,
      desc: 'Slides any number of open cells along a lane and may attack in the same turn. A run of 2 or more cells reveals it.',
      tip: 'Crossing the field reveals you — run late, not early.'
    },
    '1': {
      key: '1', rank: 1, count: 1, one: 'Kills the Senapati and the Maharathi — but only if it strikes first.', name: 'Chara', short: 'Chara', deva: 'चर', alias: 'Shadow Wraith',
      badge: 'S', movable: true, moveRange: 1, tier: 'line', assassin: true,
      role: 'Spy',
      power: null,
      desc: 'Moves 1 cell. If it attacks first it slays the Senapati (10) or the Maharathi (9), whatever the hour. Against anything else it loses.',
      tip: 'Hold it for the endgame, then trade it for a commander.'
    },
    'B': {
      key: 'B', rank: 0, count: 1, one: 'Immovable trap. Kills anything that hits it, except the engineer.', name: 'Shataghni', short: 'Shataghni', deva: 'शतघ्नी', alias: 'Stasis Mine',
      badge: 'B', movable: false, moveRange: 0, tier: 'trap',
      role: 'Hundred-killer trap',
      power: null,
      desc: 'Immovable. Destroys any piece that attacks it, and survives — unless that piece is a Yantrik. Fire (Agneyastra) also burns it.',
      tip: 'A trap only works once. Hide it where a probe must pass.'
    },
    'F': {
      key: 'F', rank: -1, count: 1, one: 'Your fort. Its gate breaks on the first blow; the second blow takes it.', name: 'Durg', short: 'Durg', deva: 'दुर्ग', alias: 'Nexus Core',
      badge: 'F', movable: false, moveRange: 0, tier: 'trap',
      role: 'The fort',
      power: null,
      desc: 'Immovable. The first successful blow breaks its gate and reveals it; the second takes it and ends the match. A volley counts as a blow.',
      tip: 'Never leave it where an archer has a clear two-cell lane.'
    }
  };

  // Exactly 12 pieces, in deployment order.
  const ROSTER_ORDER = ['10', '9', '7', '6', '5', '3', '3', '2', '2', '1', 'B', 'F'];

  const RANK_ORDER = ['10', '9', '7', '6', '5', '3', '2', '1', 'B', 'F'];

  /* The four astras — divine weapons, invoked, never depicted as gods. Each
   * can be used once per match and costs Shakti, which grows by one for every
   * piece you take and by one for both sides each time the sky turns. */
  const ASTRA_DEFS = {
    vayavya: {
      key: 'vayavya', cost: 1, name: 'Vayavyastra', deva: 'वायव्यास्त्र', element: 'wind',
      one: 'Swap any two of your own pieces.',
      desc: 'A wind sweeps the field and two of your pieces change places — even the fort. Both stay hidden.'
    },
    sammohana: {
      key: 'sammohana', cost: 2, name: 'Sammohanastra', deva: 'सम्मोहनास्त्र', element: 'trance',
      one: 'Entrance an enemy piece for two turns.',
      desc: 'Pick an enemy piece within two cells of any of yours. It cannot move or act on its owner’s next two turns. It still defends.'
    },
    agneya: {
      key: 'agneya', cost: 3, name: 'Agneyastra', deva: 'आग्नेयास्त्र', element: 'fire',
      one: 'Burn a piece of rank 4 or less.',
      desc: 'Pick an enemy piece within two cells of any of yours. It is revealed; rank 4 or less (and any Shataghni) burns. A fort’s gate burns open.'
    },
    brahma: {
      key: 'brahma', cost: 5, name: 'Brahmastra', deva: 'ब्रह्मास्त्र', element: 'light',
      one: 'Destroy any one enemy piece.',
      desc: 'Pick an enemy fighting piece within two cells of any of yours. Nothing withstands it, and everything around it is revealed. The fort and the trap are beyond it.'
    }
  };

  /* The two hours. Every fifth round the sky turns; the side whose hour it
   * is strikes at +1. */
  const HOURS = {
    day: { key: 'day', name: 'Dinman', deva: 'दिनमान', owner: 1, one: 'The hour of Surya — Suryavansh strikes at +1.' },
    night: { key: 'night', name: 'Ratri', deva: 'रात्रि', owner: 2, one: 'The hour of Chandra — Chandravansh strikes at +1.' }
  };

  /* The two formations every piece can make. */
  const FORMATIONS = {
    makara: { key: 'makara', name: 'Makara', deva: 'मकर', one: 'Jaws: strike a piece that another of yours already touches — +1.' },
    padma: { key: 'padma', name: 'Padma', deva: 'पद्म', one: 'Petals: a piece touched by two of its friends defends at +1.' }
  };

  // Board geometry. Rifts are impassable, but the archer may shoot across them.
  const BOARDS = {
    wheel: {
      key: 'wheel', cols: 0, rows: 0, deployRows: 0, cells: 37, roundCap: 40,
      label: 'Chakravyuha', deva: 'चक्रव्यूह', blurb: 'the wheel · the rings turn every 5 rounds', rifts: []
    },
    padma: {
      key: 'padma', cols: 0, rows: 0, deployRows: 0, cells: 37, roundCap: 40,
      label: 'Padmavyuha', deva: 'पद्मव्यूह', blurb: 'the lotus · six exits, the rings turn', rifts: []
    },
    small: { key: 'small', cols: 6, rows: 8, deployRows: 3, roundCap: 40, label: 'Sarvatobhadra', deva: 'सर्वतोभद्र', blurb: '6 × 8 · the classic square', rifts: ['3,1', '4,1', '3,4', '4,4'] },
    large: {
      key: 'large', cols: 8, rows: 10, deployRows: 3, roundCap: 50, label: 'Kurukshetra', deva: 'कुरुक्षेत्र', blurb: '8 × 10 · the long war', rifts: (function () {
        const out = [];
        [4, 5].forEach(function (r) { [1, 2, 5, 6].forEach(function (c) { out.push(r + ',' + c); }); });
        return out;
      })()
    }
  };

  /* Three opponents. The keys stay as they were so old saves still load. */
  const DIFFICULTIES = {
    recruit: { key: 'recruit', label: 'Sainik', deva: 'सैनिक', blurb: 'A young soldier. Brave, greedy, forgets your threats.', think: 420, noise: 0.55, depth: 0 },
    veteran: { key: 'veteran', label: 'Dronacharya', deva: 'द्रोणाचार्य', blurb: 'The teacher. Reads your formation, punishes loose pieces.', think: 620, noise: 0.22, depth: 1 },
    archon: { key: 'archon', label: 'Shakuni', deva: 'शकुनि', blurb: 'The schemer. Sees your best reply — and waits for your mistake.', think: 780, noise: 0.06, depth: 2 }
  };

  /* Scenarios are asymmetric setups layered on the same rules. */
  const SCENARIOS = {
    duel: {
      key: 'duel',
      label: 'Yuddh',
      deva: 'युद्ध',
      blurb: 'Two equal armies of twelve. Break the enemy fort.',
      boards: ['wheel', 'padma', 'small', 'large'],
      rosters: null,
      turnLimit: 0,
      // the battle opens in the last hour of night, which balances the first move
      startNight: true
    },
    abhimanyu: {
      key: 'abhimanyu',
      label: 'Abhimanyu',
      deva: 'अभिमन्यु',
      blurb: 'Eight raiders must break into a closed wheel of ten before round 28.',
      boards: ['wheel'],
      // a raiding party: no fort, no trap, no commander — just the tools to
      // break a line: a champion, cavalry, an archer, a seer, two chariots,
      // a spy and an engineer. They enter by day, with Shakti for two.
      rosters: { 1: ['9', '7', '6', '5', '2', '2', '1', '3'], 2: ['10', '9', '7', '6', '5', '3', '2', '1', 'B', 'F'] },
      turnLimit: 28,
      startNight: false,
      startShakti: { 1: 2, 2: 0 }
    }
  };

  AC.units = {
    FACTIONS: FACTIONS,
    UNIT_DEFS: UNIT_DEFS,
    ROSTER_ORDER: ROSTER_ORDER,
    RANK_ORDER: RANK_ORDER,
    ASTRA_DEFS: ASTRA_DEFS,
    HOURS: HOURS,
    FORMATIONS: FORMATIONS,
    BOARDS: BOARDS,
    DIFFICULTIES: DIFFICULTIES,
    SCENARIOS: SCENARIOS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
