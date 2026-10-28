/* Aetherfront: Astral Command — board geometry
 * Every battlefield is a cell graph, not a rectangle of rows and columns.
 * A cell knows where it is drawn, who may deploy on it, and its "rays" —
 * the straight lines that leave it. Movement, the Lancer's two-cell shot and
 * the Strider's slide all read those rays, so a square grid, a wheel or a
 * future hex board run on exactly the same engine code.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  const TAU = Math.PI * 2;
  const cache = {};

  /* ── helpers ─────────────────────────────────────────────────── */

  function arcPath(ri, ro, a0, a1) {
    const p = function (r, a) { return [Math.cos(a) * r, Math.sin(a) * r]; };
    const s = p(ro, a0);
    const e = p(ro, a1);
    const f = p(ri, a1);
    const g = p(ri, a0);
    return 'M' + s[0].toFixed(4) + ' ' + s[1].toFixed(4) +
      ' A' + ro + ' ' + ro + ' 0 0 1 ' + e[0].toFixed(4) + ' ' + e[1].toFixed(4) +
      ' L' + f[0].toFixed(4) + ' ' + f[1].toFixed(4) +
      ' A' + ri + ' ' + ri + ' 0 0 0 ' + g[0].toFixed(4) + ' ' + g[1].toFixed(4) + ' Z';
  }

  function finish(board) {
    board.byId = {};
    board.cellIds = [];
    board.cells.forEach(function (c) {
      board.byId[c.id] = c;
      board.cellIds.push(c.id);
    });
    board.zones = { 1: [], 2: [] };
    board.cells.forEach(function (c) {
      if (c.zone === 1 || c.zone === 2) board.zones[c.zone].push(c.id);
    });
    // neighbours = the first step along every ray
    board.neighbours = {};
    board.cellIds.forEach(function (id) {
      const seen = {};
      const out = [];
      (board.rays[id] || []).forEach(function (line) {
        if (line.length && !seen[line[0]]) { seen[line[0]] = 1; out.push(line[0]); }
      });
      board.neighbours[id] = out;
    });
    return board;
  }

  /* ── square grids (Sarvatobhadra) ────────────────────────────── */

  function squareBoard(opts) {
    const cols = opts.cols;
    const rows = opts.rows;
    const deploy = opts.deployRows;
    const cells = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({
          id: r + ',' + c,
          r: r, c: c,
          x: c + 0.5,
          y: r + 0.5,
          shape: 'rect',
          zone: r >= rows - deploy ? 1 : (r < deploy ? 2 : 0),
          tr: 0.33,
          points: [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]]
        });
      }
    }

    const rays = {};
    const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    cells.forEach(function (cell) {
      const rr = [];
      DIRS.forEach(function (d) {
        const line = [];
        let nr = cell.r + d[1];
        let nc = cell.c + d[0];
        while (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          line.push(nr + ',' + nc);
          nr += d[1];
          nc += d[0];
        }
        if (line.length) rr.push(line);
      });
      rays[cell.id] = rr;
    });

    const labels = [];
    if (opts.coords !== false) {
      for (let c = 0; c < cols; c++) {
        labels.push({ x: c + 0.5, y: -0.12, text: String.fromCharCode(65 + c), anchor: 'middle' });
      }
      for (let r = 0; r < rows; r++) {
        labels.push({ x: -0.14, y: r + 0.5, text: String(r + 1), anchor: 'middle', baseline: 'middle' });
      }
    }

    return finish({
      key: opts.key,
      kind: 'square',
      label: opts.label,
      blurb: opts.blurb,
      cells: cells,
      rays: rays,
      rifts: opts.rifts.slice(),
      homes: { 1: (rows - 1) + ',' + Math.floor(cols / 2), 2: '0,' + Math.floor(cols / 2) },
      bounds: { x: -0.3, y: -0.3, w: cols + 0.6, h: rows + 0.6 },
      labels: labels,
      deployRows: deploy,
      cols: cols,
      rows: rows
    });
  }

  /* ── the wheel (Chakravyuha) ─────────────────────────────────── */

  function wheelBoard() {
    const SECT = 12;      // twelve spokes: six per dynasty, so a fort sits
    const RINGS = 3;      // three cells of rim away from enemy ground
    const R0 = 0.34;      // hub radius
    const STEP = 0.42;    // ring thickness
    const GAP = 0.05;     // radial gap between sectors, radians
    const cells = [];
    const rays = {};

    cells.push({
      id: 'h', hub: true, ring: 0, sector: 0,
      x: 0, y: 0, shape: 'hub', zone: 0, tr: 0.22, r: R0 - 0.05
    });

    for (let ring = 1; ring <= RINGS; ring++) {
      const inner = R0 + (ring - 1) * STEP;
      const outer = inner + STEP;
      const rm = (inner + outer) / 2;
      for (let s = 0; s < SECT; s++) {
        // Suryavansh's six sectors (9–2) are centred on the bottom of the
        // screen, so the player always fights upward, like every other field
        const a0 = (s / SECT) * TAU + Math.PI / 3 + GAP;
        const a1 = ((s + 1) / SECT) * TAU + Math.PI / 3 - GAP;
        const mid = (a0 + a1) / 2;
        // sectors 9,10,11,0,1,2 belong to Suryavansh; 3..8 to Chandravansh
        const zone = (s === 9 || s === 10 || s === 11 || s === 0 || s === 1 || s === 2) ? 1 : 2;
        cells.push({
          id: 'r' + ring + 's' + s,
          ring: ring,
          sector: s,
          x: Math.cos(mid) * rm,
          y: Math.sin(mid) * rm,
          shape: 'sector',
          zone: zone,
          tr: 0.145,
          path: arcPath(inner, outer, a0, a1),
          inner: inner,
          outer: outer
        });
      }
    }

    // rays: around the ring (both ways), and in/out along the spoke
    for (let ring = 1; ring <= RINGS; ring++) {
      for (let s = 0; s < SECT; s++) {
        const id = 'r' + ring + 's' + s;
        // A ring is curved, a spoke is straight. Stepping around the rim is a
        // single cell at a time; the radial rays run the full length of the
        // wheel, so the spokes are the real lanes — and the fort at the rim is
        // three cells of defended ground away from enemy territory.
        const ARC = 1;
        const cw = [];
        const ccw = [];
        for (let k = 1; k <= ARC; k++) {
          cw.push('r' + ring + 's' + ((s + k) % SECT));
          ccw.push('r' + ring + 's' + ((s - k + SECT * 2) % SECT));
        }
        const out = [];
        for (let k = 1; ring + k <= RINGS; k++) out.push('r' + (ring + k) + 's' + s);
        const inward = [];
        for (let k = 1; k <= ring; k++) {
          inward.push(ring - k === 0 ? 'h' : 'r' + (ring - k) + 's' + s);
        }
        rays[id] = [cw, ccw, out, inward];
      }
    }
    const hubRays = [];
    for (let s = 0; s < SECT; s++) {
      const line = [];
      for (let ring = 1; ring <= RINGS; ring++) line.push('r' + ring + 's' + s);
      hubRays.push(line);
    }
    rays.h = hubRays;

    const R = R0 + RINGS * STEP;
    return finish({
      key: 'wheel',
      kind: 'wheel',
      label: 'Chakravyuha',
      blurb: 'the wheel · rings that turn',
      cells: cells,
      rays: rays,
      rifts: [],
      homes: { 1: 'r3s0', 2: 'r3s6' },
      bounds: { x: -R - 0.12, y: -R - 0.12, w: 2 * R + 0.24, h: 2 * R + 0.24 },
      labels: [],
      sectors: SECT,
      rings: RINGS,
      rotateRings: [1, 2],
      rotateEvery: 5
    });
  }

  /* ── catalogue ───────────────────────────────────────────────── */

  const SPECS = {
    small: function () {
      return squareBoard({
        key: 'small', label: 'Small Arena', blurb: '6 × 8 · fast and brutal',
        cols: 6, rows: 8, deployRows: 3,
        rifts: ['3,1', '4,1', '3,4', '4,4']
      });
    },
    large: function () {
      return squareBoard({
        key: 'large', label: 'Large Expanse', blurb: '8 × 10 · room to flank',
        cols: 8, rows: 10, deployRows: 3,
        rifts: (function () {
          const out = [];
          [4, 5].forEach(function (r) { [1, 2, 5, 6].forEach(function (c) { out.push(r + ',' + c); }); });
          return out;
        })()
      });
    },
    wheel: wheelBoard
  };

  const META = {
    small: { key: 'small', label: 'Small Arena', blurb: '6 × 8 · fast and brutal', cells: 48, kind: 'square' },
    large: { key: 'large', label: 'Large Expanse', blurb: '8 × 10 · room to flank', cells: 80, kind: 'square' },
    wheel: { key: 'wheel', label: 'Chakravyuha', blurb: '37 cells · the rings turn every 5 rounds', cells: 37, kind: 'wheel' },
    padma: { key: 'padma', label: 'Padmavyuha', blurb: '37 cells · six exits, the rings turn', cells: 37, kind: 'hex' }
  };


  /* ── Padmavyuha: a hexagon of hexagons ────────────────────────────────
     37 cells — an eye, then rings of 6, 12 and 18. Six exits per cell, so
     there is no corner to camp in. The field is drawn point-down: your fort
     sits on the bottom petal tip, the enemy's on the top one, and each side
     deploys on the 15 outer cells of its own half. Rings 1 and 2 turn. */
  function padmaBoard() {
    const R = 3;
    const cells = [];
    const byId = {};
    const key = function (q, r) { return q + ',' + r; };
    // axial -> pointy-top position, then a quarter turn so a vertex points down
    const place = function (q, r) {
      const x = Math.sqrt(3) * (q + r / 2);
      const y = 1.5 * r;
      return [-y, x];
    };
    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        if (Math.abs(q + r) > R) continue;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        const p = place(q, r);
        const x = p[0];
        const y = p[1];
        let zone = 0;
        if (ring >= 2) {
          if (y > 0.01) zone = 1;
          else if (y < -0.01) zone = 2;
          else zone = x > 0 ? 1 : 2;      // the two cells on the waist: one each
        }
        const pts = [];
        for (let i = 0; i < 6; i++) {
          // flat-top cells after the quarter turn
          const a = Math.PI / 180 * (60 * i);
          pts.push([x + 0.96 * Math.cos(a), y + 0.96 * Math.sin(a)]);
        }
        const cell = {
          id: key(q, r), x: x, y: y, shape: 'poly', zone: zone,
          ring: ring, angle: Math.atan2(y, x), tr: 0.5,
          points: pts, q: q, r: r
        };
        cells.push(cell);
        byId[cell.id] = cell;
      }
    }

    // six rays leave every cell; the ray index is the direction (0..5), which
    // the facing rule relies on, so empty rays are kept as placeholders
    const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    const rays = {};
    cells.forEach(function (cell) {
      const out = [];
      DIRS.forEach(function (d) {
        const line = [];
        let q = cell.q + d[0];
        let r = cell.r + d[1];
        while (byId[key(q, r)]) { line.push(key(q, r)); q += d[0]; r += d[1]; }
        out.push(line);
      });
      rays[cell.id] = out;
    });

    // forts: the petal tips
    let bottom = null;
    let top = null;
    cells.forEach(function (c) {
      if (!bottom || c.y > bottom.y + 1e-6) bottom = c;
      if (!top || c.y < top.y - 1e-6) top = c;
    });

    // the turning rings, in clockwise order on screen
    const rotateRings = [1, 2];
    const rotationOrder = {};
    rotateRings.forEach(function (ring) {
      rotationOrder[ring] = cells.filter(function (c) { return c.ring === ring; })
        .sort(function (a, b) { return a.angle - b.angle; })
        .map(function (c) { return c.id; });
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cells.forEach(function (c) {
      c.points.forEach(function (pt) {
        minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
        minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]);
      });
    });
    const m = 0.25;

    return finish({
      key: 'padma',
      kind: 'hex',
      label: 'Padmavyuha',
      blurb: 'the lotus · six exits, the rings turn',
      cells: cells,
      rays: rays,
      rifts: [],
      homes: { 1: bottom.id, 2: top.id },
      bounds: { x: minX - m, y: minY - m, w: maxX - minX + 2 * m, h: maxY - minY + 2 * m },
      labels: [],
      rotateRings: rotateRings,
      rotateEvery: 5,
      rotationOrder: rotationOrder,
      sides: 6
    });
  }

  function build(key) {
    if (cache[key]) return cache[key];
    if (key === 'padma') { cache[key] = padmaBoard(); return cache[key]; }
    const spec = SPECS[key] || SPECS.small;
    cache[key] = spec();
    return cache[key];
  }

  /* Graph distance from one cell to every other (used by the AI, the belief
   * model and the deployment presets). */
  const distCache = {};
  function distances(boardKey, fromId) {
    const k = boardKey + '|' + fromId;
    if (distCache[k]) return distCache[k];
    const board = build(boardKey);
    const dist = {};
    board.cellIds.forEach(function (id) { dist[id] = Infinity; });
    dist[fromId] = 0;
    const queue = [fromId];
    while (queue.length) {
      const id = queue.shift();
      const d = dist[id];
      (board.neighbours[id] || []).forEach(function (n) {
        if (dist[n] === Infinity) { dist[n] = d + 1; queue.push(n); }
      });
    }
    distCache[k] = dist;
    return dist;
  }

  AC.geometry = {
    META: META,
    padma: padmaBoard,
    build: build,
    distances: distances,
    arcPath: arcPath
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
