/* Aetherfront: Astral Command — visual effects
 * A single fixed canvas for particles, floating combat numbers, and a CSS
 * screen-shake hook. Animation loop only runs while something is alive.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let particles = [];
  let floats = [];
  let running = false;
  let reduced = false;
  let last = 0;

  function init(el) {
    canvas = el;
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    root.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = Math.floor(root.innerWidth * dpr);
    canvas.height = Math.floor(root.innerHeight * dpr);
    canvas.style.width = root.innerWidth + 'px';
    canvas.style.height = root.innerHeight + 'px';
  }

  function setReducedMotion(v) {
    reduced = !!v;
  }

  function spawn(x, y, opts) {
    const n = reduced ? Math.min(6, opts.count || 6) : (opts.count || 18);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 2) * (0.35 + Math.random());
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.lift || 0.4),
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        size: (opts.size || 2.4) * (0.5 + Math.random()),
        color: opts.color || '#22d3ee',
        glow: opts.glow !== false,
        gravity: opts.gravity == null ? 0.045 : opts.gravity
      });
    }
    start();
  }

  function burst(x, y, opts) {
    opts = opts || {};
    spawn(x, y, Object.assign({ count: 22, speed: 3.4, size: 2.8, color: '#fbbf24' }, opts));
    if (!reduced) spawn(x, y, Object.assign({ count: 10, speed: 1.6, size: 5.2, color: opts.color || '#22d3ee', glow: true }, opts));
  }

  function float(text, x, y, color) {
    floats.push({ text: text, x: x, y: y, life: 1, color: color || '#f1f5f9', vy: -0.55 });
    start();
  }

  function start() {
    if (running || !ctx) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!ctx) { running = false; return; }
    const dt = Math.min(3, (now - last) / 16.67);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);

    particles = particles.filter(function (p) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= p.decay * dt;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, p.size * p.life), 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    floats = floats.filter(function (f) {
      f.y += f.vy * dt;
      f.vy *= 0.985;
      f.life -= 0.014 * dt;
      if (f.life <= 0) return false;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.shadowBlur = 8;
      ctx.shadowColor = f.color;
      ctx.fillStyle = f.color;
      ctx.font = '700 ' + (root.innerWidth < 520 ? 14 : 18) + 'px Orbitron, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      return true;
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (particles.length || floats.length) {
      requestAnimationFrame(tick);
    } else {
      running = false;
      ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
    }
  }

  /* Centre of an element in viewport coordinates */
  function centerOf(el) {
    if (!el) return { x: root.innerWidth / 2, y: root.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function shake(intensity) {
    if (reduced) return;
    const rootEl = document.getElementById('app');
    if (!rootEl) return;
    const amp = intensity || 6;
    rootEl.style.setProperty('--shake-amp', amp + 'px');
    rootEl.classList.remove('shaking');
    // force reflow so the animation restarts
    void rootEl.offsetWidth;
    rootEl.classList.add('shaking');
    setTimeout(function () { rootEl.classList.remove('shaking'); }, 420);
  }

  function toast(message, kind) {
    const host = document.getElementById('toast-root');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'info');
    t.textContent = message;
    host.appendChild(t);
    setTimeout(function () { t.classList.add('toast-out'); }, 2600);
    setTimeout(function () { t.remove(); }, 3100);
  }

  AC.fx = {
    init: init,
    burst: burst,
    spawn: spawn,
    float: float,
    shake: shake,
    toast: toast,
    centerOf: centerOf,
    setReducedMotion: setReducedMotion
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
