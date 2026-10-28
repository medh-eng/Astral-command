/* VYUHA: Astral Command — audio
 * Every sound is synthesised at runtime with the Web Audio API, so the game
 * ships with no audio files and still has a full score + SFX suite.
 * Two layers: a short-lived SFX bus, and a procedural ambient score.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuf = null;
  let ready = false;

  const settings = {
    sfx: 0.7,
    music: 0.35,
    muted: false,
    haptics: true
  };

  function supported() {
    return !!(root.AudioContext || root.webkitAudioContext);
  }

  function init() {
    if (ctx || !supported()) return ctx;
    const Ctor = root.AudioContext || root.webkitAudioContext;
    try {
      ctx = new Ctor();
    } catch (e) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : 1;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = settings.sfx;
    // a touch of air on the whole SFX bus
    const air = ctx.createBiquadFilter();
    air.type = 'highpass';
    air.frequency.value = 60;
    sfxBus.connect(air);
    air.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0; // faded in by the score
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 2400;
    musicBus.connect(warm);
    warm.connect(master);

    // 1 second of white noise, reused by every percussive sound
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    ready = true;
    return ctx;
  }

  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    loadSfx();
    return ctx;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function applyVolumes() {
    if (!ctx) return;
    master.gain.setTargetAtTime(settings.muted ? 0 : 1, now(), 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx, now(), 0.05);
    if (!musicPlaying) musicBus.gain.setTargetAtTime(0, now(), 0.05);
    else musicBus.gain.setTargetAtTime(settings.music * 0.5, now(), 0.08);
    if (musicState.el) musicState.el.volume = Math.max(0.02, settings.music * 0.55);
  }

  function setSettings(s) {
    Object.assign(settings, s || {});
    applyVolumes();
  }

  function getSettings() {
    return Object.assign({}, settings);
  }

  /* ---------- primitives ---------- */

  function tone(opts) {
    if (!ctx) return;
    const t0 = (opts.at || now()) + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const dest = opts.bus === 'music' ? musicBus : sfxBus;
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) {
      const glide = opts.glide || opts.dur || 0.2;
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + glide);
    }
    if (opts.detune) osc.detune.value = opts.detune;
    const peak = Math.max(0.0001, opts.gain == null ? 0.2 : opts.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.25));
    let node = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.cutoff || 1200;
      f.Q.value = opts.q || 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + (opts.dur || 0.25) + 0.05);
  }

  function noise(opts) {
    if (!ctx || !noiseBuf) return;
    const t0 = (opts.at || now()) + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 900, t0);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t0 + (opts.dur || 0.2));
    f.Q.value = opts.q || 1.2;
    const g = ctx.createGain();
    const peak = opts.gain == null ? 0.12 : opts.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.2));
    src.connect(f);
    f.connect(g);
    g.connect(opts.bus === 'music' ? musicBus : sfxBus);
    src.start(t0);
    src.stop(t0 + (opts.dur || 0.2) + 0.05);
  }

  /* ---------- SFX ---------- */

  const SFX = {
    hover: function () { tone({ freq: 1180, to: 1320, dur: 0.05, type: 'sine', gain: 0.03 }); },
    select: function () {
      tone({ freq: 620, to: 880, dur: 0.09, type: 'triangle', gain: 0.12 });
      tone({ freq: 1240, dur: 0.05, type: 'sine', gain: 0.05, delay: 0.02 });
    },
    deselect: function () { tone({ freq: 520, to: 300, dur: 0.09, type: 'triangle', gain: 0.08 }); },
    ui: function () { tone({ freq: 440, to: 560, dur: 0.07, type: 'sine', gain: 0.09 }); },
    error: function () {
      tone({ freq: 200, to: 130, dur: 0.16, type: 'square', gain: 0.09 });
      tone({ freq: 150, to: 90, dur: 0.18, type: 'sawtooth', gain: 0.05, delay: 0.05 });
    },
    deploy: function () {
      tone({ freq: 320, to: 520, dur: 0.12, type: 'triangle', gain: 0.1 });
      noise({ freq: 1400, to: 400, dur: 0.1, gain: 0.05 });
    },
    swap: function () {
      tone({ freq: 420, to: 300, dur: 0.1, type: 'triangle', gain: 0.09 });
      tone({ freq: 640, to: 900, dur: 0.1, type: 'sine', gain: 0.06, delay: 0.04 });
    },
    lock: function () {
      [330, 440, 554, 660].forEach(function (f, i) {
        tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.09, delay: i * 0.06 });
      });
      noise({ freq: 2400, to: 600, dur: 0.3, gain: 0.04 });
    },
    move: function () {
      tone({ freq: 300, to: 470, dur: 0.13, type: 'triangle', gain: 0.11 });
      noise({ freq: 900, to: 300, dur: 0.1, gain: 0.04 });
    },
    step: function () { tone({ freq: 240, to: 320, dur: 0.07, type: 'sine', gain: 0.07 }); },
    scan: function () {
      tone({ freq: 520, to: 1560, dur: 0.32, type: 'sine', gain: 0.1 });
      tone({ freq: 780, to: 2340, dur: 0.3, type: 'sine', gain: 0.05, delay: 0.05 });
      noise({ freq: 3000, to: 1200, dur: 0.25, gain: 0.03, q: 4 });
    },
    laser: function () {
      tone({ freq: 1400, to: 140, dur: 0.28, type: 'sawtooth', gain: 0.13, filter: 'lowpass', cutoff: 3200 });
      noise({ freq: 4200, to: 600, dur: 0.24, gain: 0.08, q: 0.8 });
    },
    'clash-win': function () {
      noise({ freq: 1800, to: 200, dur: 0.22, gain: 0.14, filter: 'bandpass', q: 0.9 });
      tone({ freq: 180, to: 90, dur: 0.3, type: 'square', gain: 0.12, filter: 'lowpass', cutoff: 900 });
      tone({ freq: 660, to: 990, dur: 0.18, type: 'triangle', gain: 0.07, delay: 0.04 });
    },
    'clash-lose': function () {
      noise({ freq: 900, to: 120, dur: 0.3, gain: 0.13, q: 0.7 });
      tone({ freq: 220, to: 70, dur: 0.42, type: 'sawtooth', gain: 0.11, filter: 'lowpass', cutoff: 700 });
    },
    'clash-both': function () {
      noise({ freq: 2400, to: 120, dur: 0.34, gain: 0.16, q: 0.6 });
      tone({ freq: 300, to: 60, dur: 0.4, type: 'square', gain: 0.12, filter: 'lowpass', cutoff: 800 });
      tone({ freq: 900, to: 120, dur: 0.3, type: 'sawtooth', gain: 0.06 });
    },
    mine: function () {
      noise({ freq: 260, to: 60, dur: 0.55, gain: 0.2, filter: 'lowpass', q: 1.6 });
      tone({ freq: 90, to: 40, dur: 0.6, type: 'sine', gain: 0.22 });
      tone({ freq: 1200, to: 200, dur: 0.2, type: 'sawtooth', gain: 0.05 });
    },
    capture: function () {
      [520, 660, 780].forEach(function (f, i) {
        tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.08, delay: i * 0.05 });
      });
    },
    core: function () {
      noise({ freq: 3200, to: 100, dur: 0.9, gain: 0.16, filter: 'lowpass' });
      [440, 554, 659, 880, 1108].forEach(function (f, i) {
        tone({ freq: f, dur: 0.6, type: 'triangle', gain: 0.1, delay: i * 0.07 });
      });
      tone({ freq: 55, dur: 1.1, type: 'sine', gain: 0.2 });
    },
    win: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone({ freq: f, dur: 0.55, type: 'triangle', gain: 0.12, delay: i * 0.11 });
        tone({ freq: f * 2, dur: 0.4, type: 'sine', gain: 0.04, delay: i * 0.11 });
      });
      noise({ freq: 4000, to: 800, dur: 0.7, gain: 0.05 });
    },
    lose: function () {
      [392, 349.23, 293.66, 220].forEach(function (f, i) {
        tone({ freq: f, dur: 0.6, type: 'sine', gain: 0.11, delay: i * 0.14 });
      });
      tone({ freq: 110, dur: 1.2, type: 'sine', gain: 0.12, delay: 0.1 });
    },
    draw: function () {
      [440, 440, 415.3].forEach(function (f, i) {
        tone({ freq: f, dur: 0.5, type: 'sine', gain: 0.09, delay: i * 0.16 });
      });
    },
    curtain: function () {
      noise({ freq: 400, to: 2600, dur: 0.45, gain: 0.07, filter: 'bandpass', q: 0.7 });
      tone({ freq: 220, to: 330, dur: 0.4, type: 'sine', gain: 0.07 });
    },
    unlock: function () {
      [660, 880, 1320].forEach(function (f, i) {
        tone({ freq: f, dur: 0.24, type: 'triangle', gain: 0.09, delay: i * 0.06 });
      });
    },
    keypad: function () { tone({ freq: 900, to: 1100, dur: 0.05, type: 'square', gain: 0.05 }); },
    tick: function () { tone({ freq: 1500, dur: 0.03, type: 'square', gain: 0.04 }); },
    rotate: function () {
      // stone grinding on stone, with a rising shimmer as the wheel settles
      noise({ freq: 220, to: 90, dur: 1.1, gain: 0.14, filter: 'lowpass', q: 0.8 });
      [110, 165, 220, 330].forEach(function (f, i) {
        tone({ freq: f, dur: 0.9, type: 'sine', gain: 0.05, delay: i * 0.09 });
      });
      tone({ freq: 440, to: 660, dur: 0.7, type: 'triangle', gain: 0.05, delay: 0.35 });
    },
    save: function () {
      tone({ freq: 880, dur: 0.12, type: 'sine', gain: 0.08 });
      tone({ freq: 1174, dur: 0.16, type: 'sine', gain: 0.07, delay: 0.08 });
    },
    warn: function () {
      tone({ freq: 660, dur: 0.1, type: 'square', gain: 0.06 });
      tone({ freq: 660, dur: 0.1, type: 'square', gain: 0.06, delay: 0.16 });
    }
  };

  function play(name) {
    if (!ready || settings.muted) return;
    const key = SFX_SAMPLE[name];
    if (key && buffers[key]) {
      const jitter = 0.94 + Math.random() * 0.12;
      if (playBuffer(key, { rate: jitter, gain: 0.9 })) return;
    }
    const fn = SFX[name];
    if (!fn) return;
    try { fn(); } catch (e) { /* audio must never break the game */ }
  }

  /* ---------- haptics ---------- */

  function buzz(pattern) {
    if (!settings.haptics) return;
    if (navigator && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- recorded audio ----------
     Real tracks and one-shots, with the synthesiser kept as the fallback so
     the game still has a score if a file is missing or blocked. */
  const SAMPLE_PATHS = {
    music: {
      menu: 'assets/audio/music/menu.mp3',
      tabla: 'assets/audio/music/tabla.mp3',
      battle: 'assets/audio/music/battle.mp3',
      victory: 'assets/audio/music/victory.mp3',
      defeat: 'assets/audio/music/defeat.mp3'
    },
    sfx: {
      clash: 'assets/audio/sfx/clash.mp3',
      volley: 'assets/audio/sfx/volley.mp3',
      chakra: 'assets/audio/sfx/chakra_turn.mp3',
      place: 'assets/audio/sfx/piece_place.mp3'
    }
  };

  // game event -> recorded one-shot
  const SFX_SAMPLE = {
    'clash-win': 'clash', 'clash-lose': 'clash', 'clash-both': 'clash',
    mine: 'clash', barrage: 'volley', laser: 'volley',
    rotate: 'chakra', deploy: 'place', swap: 'place', lock: 'place', step: 'place'
  };

  const buffers = {};
  const sfxEls = {};
  const musicEls = {};
  let musicState = { mode: null, el: null };
  let sfxLoading = false;

  function loadSfx() {
    if (sfxLoading) return;
    sfxLoading = true;
    Object.keys(SAMPLE_PATHS.sfx).forEach(function (key) {
      const url = SAMPLE_PATHS.sfx[key];
      // Preferred: decode into a buffer for lowest latency and free polyphony.
      // Fallback (file://, no fetch): a preloaded <audio> element per sound.
      const fallback = function () {
        if (typeof Audio === 'undefined' || sfxEls[key]) return;
        const el = new Audio(url);
        el.preload = 'auto';
        sfxEls[key] = el;
      };
      if (!ctx || typeof fetch !== 'function') { fallback(); return; }
      fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .then(function (buf) {
          if (!buf) return null;
          return new Promise(function (res) {
            ctx.decodeAudioData(buf, res, function () { res(null); });
          });
        })
        .then(function (decoded) { if (decoded) buffers[key] = decoded; else fallback(); })
        .catch(fallback);
    });
  }

  function playBuffer(key, opts) {
    const buf = buffers[key];
    if (!buf || !ctx) {
      const el = sfxEls[key];
      if (!el) return false;
      try {
        const copy = el.cloneNode();
        copy.volume = Math.min(1, Math.max(0.05, (opts && opts.gain != null ? opts.gain : 1) * 0.95));
        copy.playbackRate = opts && opts.rate ? opts.rate : 1;
        const p = copy.play();
        if (p && p.catch) p.catch(function () { /* ignore */ });
        return true;
      } catch (e) {
        return false;
      }
    }
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = opts && opts.rate ? opts.rate : 1;
    g.gain.value = opts && opts.gain != null ? opts.gain : 1;
    src.connect(g);
    g.connect(sfxBus);
    src.start();
    return true;
  }

  function getMusicEl(mode) {
    if (musicEls[mode]) return musicEls[mode];
    if (typeof Audio === 'undefined') return null;
    const el = new Audio();
    el.src = SAMPLE_PATHS.music[mode];
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    musicEls[mode] = el;
    return el;
  }

  function fade(el, target, ms) {
    return new Promise(function (resolve) {
      if (!el) { resolve(); return; }
      const from = el.volume;
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const tick = function () {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const k = Math.min(1, (now - t0) / ms);
        el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      tick();
    });
  }

  /* ---------- procedural score ---------- */

  const SCALES = {
    menu: [0, 3, 5, 7, 10, 12, 15, 17],       // minor pentatonic-ish
    battle: [0, 2, 3, 5, 7, 8, 10, 12],       // aeolian
    end: [0, 4, 7, 11, 12, 14]
  };
  const ROOTS = { menu: 110, battle: 98, end: 130.81 };

  let musicPlaying = false;
  let musicMode = 'menu';
  let schedulerId = null;
  let nextBeat = 0;
  let beat = 0;

  function noteFreq(root, semis) {
    return root * Math.pow(2, semis / 12);
  }

  function scheduleBar(mode, at) {
    const scale = SCALES[mode] || SCALES.menu;
    const root = ROOTS[mode] || 110;
    const bar = beat % 8;

    // pad: two slow chords per phrase
    if (bar % 4 === 0) {
      const chordRoot = bar === 0 ? 0 : 5;
      [0, 3, 7].forEach(function (interval, i) {
        tone({
          bus: 'music', freq: noteFreq(root * 2, chordRoot + interval),
          dur: 2.4, type: 'sine', gain: 0.055, attack: 0.5, at: at, detune: i * 4
        });
      });
      tone({ bus: 'music', freq: noteFreq(root, chordRoot), dur: 2.6, type: 'triangle', gain: 0.05, attack: 0.6, at: at });
    }

    // pulse
    if (mode === 'battle') {
      if (bar % 2 === 0) {
        tone({ bus: 'music', freq: root / 2, to: root / 2.2, dur: 0.5, type: 'sine', gain: 0.14, at: at });
      }
      noise({ bus: 'music', freq: 6000, dur: 0.06, gain: 0.02, filter: 'highpass', at: at + 0.25 });
      // sparse arpeggio
      if (bar % 2 === 1) {
        const s = scale[(bar * 3 + beat) % scale.length];
        tone({ bus: 'music', freq: noteFreq(root * 4, s), dur: 0.35, type: 'triangle', gain: 0.035, at: at + 0.12 });
        tone({ bus: 'music', freq: noteFreq(root * 4, s + 7), dur: 0.3, type: 'sine', gain: 0.022, at: at + 0.36 });
      }
    } else if (mode === 'end') {
      if (bar % 4 === 2) {
        const s = scale[(beat + 2) % scale.length];
        tone({ bus: 'music', freq: noteFreq(root * 4, s), dur: 1.6, type: 'sine', gain: 0.05, at: at + 0.1 });
      }
    } else {
      // menu: drifting bell
      if (bar % 4 === 1) {
        const s = scale[(beat * 2) % scale.length];
        tone({ bus: 'music', freq: noteFreq(root * 4, s), dur: 1.8, type: 'sine', gain: 0.04, at: at });
        tone({ bus: 'music', freq: noteFreq(root * 6, s + 7), dur: 1.2, type: 'sine', gain: 0.015, at: at + 0.2 });
      }
    }
  }

  function startSynthMusic(mode) {
    init();
    if (!ctx) return;
    mode = mode || 'menu';
    if (musicPlaying && musicMode === mode) return;
    musicMode = mode;
    if (musicPlaying) {
      // already running: just switch the pattern
      applyVolumes();
      return;
    }
    musicPlaying = true;
    beat = 0;
    nextBeat = now() + 0.1;
    musicBus.gain.cancelScheduledValues(now());
    musicBus.gain.setValueAtTime(0.0001, now());
    musicBus.gain.exponentialRampToValueAtTime(Math.max(0.0002, settings.music * 0.5), now() + 2.2);
    schedulerId = setInterval(function () {
      if (!ctx || !musicPlaying) return;
      const tempo = musicMode === 'battle' ? 0.5 : 0.75;
      while (nextBeat < now() + 0.9) {
        scheduleBar(musicMode, nextBeat);
        nextBeat += tempo;
        beat++;
      }
    }, 200);
  }

  function stopSynthMusic() {
    if (!ctx) return;
    musicPlaying = false;
    if (schedulerId) { clearInterval(schedulerId); schedulerId = null; }
    musicBus.gain.cancelScheduledValues(now());
    musicBus.gain.setTargetAtTime(0.0001, now(), 0.3);
  }

  function fadeTo(mode) {
    if (!musicPlaying) { startMusic(mode); return; }
    musicMode = mode;
  }

  function startMusic(mode) {
    mode = mode || 'menu';
    init();
    if (settings.muted || settings.musicOn === false) return;
    if (musicState.mode === mode) return;
    const el = getMusicEl(mode);
    if (!el) { startSynthMusic(mode); return; }

    const old = musicState.el;
    musicState = { mode: mode, el: el };
    stopSynthMusic();
    try { el.currentTime = 0; } catch (e) { /* not loaded yet */ }
    el.volume = 0;
    let attempt = null;
    try { attempt = el.play(); } catch (e) { attempt = null; }
    if (attempt && attempt.catch) {
      attempt.catch(function () { musicState = { mode: null, el: null }; startSynthMusic(mode); });
    }
    fade(el, Math.max(0.02, settings.music * 0.55), 900);
    if (old && old !== el) fade(old, 0, 500).then(function () { try { old.pause(); } catch (e) { /* ignore */ } });
  }

  /* A one-off cue (victory / defeat) that ducks the score while it plays. */
  function sting(kind) {
    if (settings.muted || settings.musicOn === false) return;
    init();
    const el = getMusicEl(kind);
    if (!el) return;
    const current = musicState.el;
    musicState = { mode: null, el: null };
    if (current) fade(current, 0, 350).then(function () { try { current.pause(); } catch (e) { /* ignore */ } });
    const once = musicEls[kind];
    if (once) once.loop = false;
    try { el.currentTime = 0; } catch (e) { /* ignore */ }
    el.volume = Math.max(0.05, settings.music * 0.7);
    let attempt = null;
    try { attempt = el.play(); } catch (e) { attempt = null; }
    if (attempt && attempt.catch) attempt.catch(function () { /* stay silent */ });
  }

  function stopMusic() {
    stopSynthMusic();
    const el = musicState.el;
    musicState = { mode: null, el: null };
    if (el) fade(el, 0, 400).then(function () { try { el.pause(); } catch (e) { /* ignore */ } });
  }

  AC.audio = {
    supported: supported,
    init: init,
    unlock: unlock,
    play: play,
    buzz: buzz,
    startMusic: startMusic,
    sting: sting,
    stopMusic: stopMusic,
    fadeTo: fadeTo,
    setSettings: setSettings,
    getSettings: getSettings,
    state: function () {
      const el = musicState.el;
      return {
        ready: ready,
        mode: musicState.mode || (musicPlaying ? musicMode : null),
        sample: !!el,
        playing: el ? !el.paused : musicPlaying,
        time: el ? Math.round(el.currentTime * 10) / 10 : 0,
        volume: el ? Math.round(el.volume * 100) / 100 : 0,
        sfxLoaded: Object.keys(buffers).length + Object.keys(sfxEls).length
      };
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
