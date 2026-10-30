/* VYUHA — the stage
 * Short cinematic beats that play over the board: the clash of two pieces,
 * a rain of arrows, divine sight, a gate breaking, an astra, the turning sky.
 * Each one runs on its own and calls `done` when it is over; a tap skips it.
 * Nothing here changes the game state — it only shows what the engine did.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const A = AC.art;
  const U = AC.units;
  const FX = AC.fx;

  const esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function reduced() {
    return !!(AC.app && AC.app.settings && AC.app.settings.reducedMotion);
  }

  let current = null;

  function close(fire) {
    if (!current) return;
    const c = current;
    current = null;
    clearTimeout(c.timer);
    c.el.classList.add('stage-out');
    setTimeout(function () { if (c.el.parentNode) c.el.remove(); }, 220);
    if (fire !== false && c.done) c.done();
  }

  /* Mount a beat. `ms` is how long it holds before it leaves on its own. */
  function show(html, cls, ms, done, opts) {
    if (current) close(true);
    opts = opts || {};
    // beats were running 2-2.6 s and held the board hostage; 1.5 s reads as a
    // flourish instead of a takeover
    if (ms) ms = Math.min(ms, 1500);
    const el = document.createElement('div');
    el.className = 'stage ' + (cls || '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="stage-card">' + html + '</div>' +
      (opts.passive ? '' : '<div class="stage-skip">tap to continue</div>');
    document.body.appendChild(el);
    const hold = reduced() ? Math.min(ms, 1100) : ms;
    current = { el: el, done: done, timer: setTimeout(function () { close(true); }, hold) };
    if (!opts.passive) el.addEventListener('click', function () { close(true); });
    else el.style.pointerEvents = 'none';
    void el.offsetWidth;
    el.classList.add('stage-in');
    return el;
  }

  const BONUS = {
    surya: { deva: 'सूर्य', icon: 'sun', label: 'Surya' },
    chandra: { deva: 'चंद्र', icon: 'moon', label: 'Chandra' },
    makara: { deva: 'मकर', icon: 'sword', label: 'Makara' },
    padma: { deva: 'पद्म', icon: 'shield', label: 'Padma' }
  };

  function chips(parts) {
    if (!parts || !parts.length) return '';
    return '<div class="st-bonus">' + parts.map(function (p) {
      const b = BONUS[p.key] || { deva: p.key, icon: 'star', label: p.key };
      return '<span class="st-chip st-chip-' + p.key + '">' + A.icon(b.icon) + '+' + p.v +
        ' <span class="deva">' + b.deva + '</span></span>';
    }).join('') + '</div>';
  }

  function piece(u, side, opts) {
    opts = opts || {};
    const cls = u.owner === 1 ? 'solar' : 'void';
    const def = U.UNIT_DEFS[u.key] || {};
    const rankShown = opts.value != null && opts.value !== u.rank && u.key !== 'F' && u.key !== 'B'
      ? esc(def.badge || u.badge) + '<i>→' + opts.value + '</i>'
      : esc(u.key === 'F' || u.key === 'B' ? (u.key === 'F' ? '⚑' : '✷') : u.badge);
    return '<div class="st-piece st-' + side + ' ' + cls + (opts.dead ? ' st-dead' : '') + '">' +
      '<div class="st-disc">' + A.emblem(u.key) + '</div>' +
      '<div class="st-name">' + esc(u.name) + (def.deva ? ' <span class="deva">' + esc(def.deva) + '</span>' : '') + '</div>' +
      '<div class="st-rank">' + rankShown + '</div>' +
      chips(opts.parts) +
      '</div>';
  }

  /* The verdict is told from the point of view of whoever is watching. */
  function verdict(kind) {
    const V = {
      win: ['विजय', 'Victory'],
      lose: ['पराजय', 'Repelled'],
      both: ['वीरगति', 'Both fall'],
      fort: ['दुर्ग विजय', 'The fort is taken'],
      fortLost: ['दुर्ग पतन', 'The fort has fallen'],
      breach: ['द्वार भेद', 'The gate is broken'],
      trap: ['शतघ्नी', 'The trap holds'],
      defuse: ['जाल मुक्त', 'Trap dismantled'],
      chara: ['चर का वार', 'The spy strikes first'],
      seen: ['दिव्यदृष्टि', 'Revealed'],
      arrows: ['शरवर्षा', 'Rain of arrows'],
      turned: ['कवच', 'The armour held']
    };
    const v = V[kind] || V.win;
    return '<div class="st-verdict st-v-' + kind + '"><span class="deva">' + v[0] + '</span><b>' + v[1] + '</b></div>';
  }

  function clash(ev, viewer, done) {
    const att = ev.unit;
    const def = ev.target;
    let kind;
    let attDead = false;
    let defDead = false;
    if (ev.core) { kind = att.owner === viewer ? 'fort' : 'fortLost'; defDead = true; }
    else if (ev.mine && ev.outcome === 'def') { kind = 'trap'; attDead = true; }
    else if (ev.mine) { kind = 'defuse'; defDead = true; }
    else if (ev.assassinate) { kind = 'chara'; defDead = true; }
    else if (ev.outcome === 'att') { kind = att.owner === viewer ? 'win' : 'lose'; defDead = true; }
    else if (ev.outcome === 'def') { kind = def.owner === viewer ? 'win' : 'lose'; attDead = true; }
    else { kind = 'both'; attDead = true; defDead = true; }
    const html =
      '<div class="st-kicker"><span class="deva">द्वंद्व</span> · Clash</div>' +
      '<div class="st-arena">' +
        piece(att, 'left', { dead: attDead, parts: ev.attParts, value: ev.a }) +
        '<div class="st-spark" aria-hidden="true"></div>' +
        piece(def, 'right', { dead: defDead, parts: ev.defParts, value: ev.d }) +
      '</div>' +
      verdict(kind) +
      '<div class="st-line">' + esc(ev.text) + '</div>';
    show(html, 'stage-clash stage-' + kind, ev.core ? 2600 : 1900, done);
    if (navigator && navigator.vibrate && AC.app && AC.app.settings && AC.app.settings.haptics !== false) {
      try { navigator.vibrate(kind === 'win' || kind === 'fort' ? [14, 40, 14] : 26); } catch (e) { /* ignore */ }
    }
  }

  function volley(ev, viewer, done) {
    const kind = ev.kill ? 'arrows' : ev.noKill ? 'trap' : 'turned';
    const html =
      '<div class="st-kicker"><span class="deva">शरवर्षा</span> · Volley at two cells</div>' +
      '<div class="st-arena">' +
        piece(ev.unit, 'left', {}) +
        '<div class="st-arrows" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
        piece(ev.target, 'right', { dead: !!ev.kill }) +
      '</div>' +
      verdict(kind) +
      '<div class="st-line">' + esc(ev.text) + '</div>';
    show(html, 'stage-volley', 1600, done);
  }

  function scan(ev, viewer, done) {
    const html =
      '<div class="st-kicker"><span class="deva">दिव्यदृष्टि</span> · Divine sight</div>' +
      '<div class="st-arena st-solo">' +
        '<div class="st-eye" aria-hidden="true">' + A.sanjayaMark() + '</div>' +
        piece(ev.target, 'right', {}) +
      '</div>' +
      verdict('seen') +
      '<div class="st-line">' + esc(ev.text) + '</div>';
    show(html, 'stage-scan', 1400, done);
  }

  function breach(ev, viewer, done) {
    const mine = ev.target.owner === viewer;
    const html =
      '<div class="st-kicker"><span class="deva">दुर्ग</span> · The fort</div>' +
      (A.artFor('ui:breach') ? '<img class="st-astra-anim st-breach-art" src="' + A.artFor('ui:breach') + '" alt="" aria-hidden="true">' : '') +
      '<div class="st-gate" aria-hidden="true">' + A.icon('gate') + '<span class="st-crack"></span></div>' +
      verdict('breach') +
      '<div class="st-line">' + (mine ? 'Our gate is broken. One more blow and the fort falls — defend it.' : 'Their gate is broken. One more blow takes the fort.') + '</div>';
    show(html, 'stage-breach' + (mine ? ' stage-lose' : ' stage-win'), 1900, done);
  }

  function astra(ev, viewer, done) {
    const def = (U.ASTRA_DEFS || {})[ev.astra] || { name: ev.astra, deva: '' };
    const ours = ev.owner === viewer;
    const anim = A.artFor('astra:' + ev.astra + '-anim');
    const html =
      (anim ? '<img class="st-astra-anim" src="' + anim + '" alt="" aria-hidden="true">' : '') +
      '<div class="st-astra-mark">' + A.astraMark(ev.astra) + '</div>' +
      '<div class="st-astra-name"><span class="deva">' + esc(def.deva) + '</span><b>' + esc(def.name) + '</b></div>' +
      '<div class="st-astra-by">' + (ours ? 'invoked by your army' : 'invoked by the enemy') + '</div>' +
      '<div class="st-line">' + esc(ev.text) + '</div>';
    show(html, 'stage-astra stage-astra-' + ev.astra + (ours ? ' ours' : ' theirs'), ev.astra === 'brahma' ? 2600 : 2000, done);
    const c = FX.centerOf(document.getElementById('board'));
    const colors = { vayavya: '#cfe8ff', sammohana: '#c4b5fd', agneya: '#ff8a3d', brahma: '#fff3c4' };
    if (FX && FX.burst) {
      FX.burst(c.x, c.y, { count: ev.astra === 'brahma' ? 80 : 46, color: colors[ev.astra] || '#f2cf8b', speed: ev.astra === 'brahma' ? 9 : 6, size: 3 });
      if (ev.astra === 'brahma' || ev.astra === 'agneya') FX.shake(ev.astra === 'brahma' ? 14 : 8);
    }
  }

  /* The sky turning is a passive beat: it never blocks the game. */
  function sky(hour, viewerHour) {
    const day = hour === 'day';
    const html =
      '<div class="st-sky-mark">' + A.icon(day ? 'sun' : 'moon') + '</div>' +
      '<div class="st-astra-name"><span class="deva">' + (day ? 'दिनमान' : 'रात्रि') + '</span><b>' + (day ? 'Dawn — the hour of Surya' : 'Night — the hour of Chandra') + '</b></div>' +
      '<div class="st-astra-by">' + (viewerHour ? 'Your army strikes at +1 until the sky turns again.' : 'The enemy strikes at +1 until the sky turns again.') + '</div>';
    show(html, 'stage-sky stage-' + (day ? 'day' : 'night'), 1700, null, { passive: true });
  }

  AC.stage = {
    clash: clash,
    volley: volley,
    scan: scan,
    breach: breach,
    astra: astra,
    sky: sky,
    close: close,
    busy: function () { return !!current; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
