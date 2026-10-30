/* VYUHA — local persistence
 * Profiles, PINs, stats, saved games, formations and settings.
 *
 * Everything lives in this browser (localStorage). There is no server and no
 * account leaves the device. PINs are stretched with PBKDF2-SHA256 where the
 * Web Crypto API is available; otherwise a documented fallback hash is used
 * (still fine for keeping a sibling out of your saved games — it is not
 * network security).
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});
  const DB_KEY = 'aetherfront.db.v2';
  const SESSION_KEY = 'aetherfront.session.v2';
  const ITERATIONS = 120000;

  const DEFAULT_SETTINGS = {
    sfx: 0.7,
    music: 0.35,
    muted: false,
    haptics: true,
    reducedMotion: false,
    colorblind: false,
    highContrast: false,
    coordinates: true,
    confirmActions: true,
    showIntel: true,
    musicOn: true,
    // Chapter III
    narrator: true,
    narratorLang: 'hinglish',
    voice: true,
    cinematics: true,
    batterySaver: null,   // null = decide from the phone (low memory / few cores → on)
    stories: true,
    tutorialDone: false
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function emptyDb() {
    return {
      version: 2,
      profiles: [],
      activeProfileId: null,
      settings: Object.assign({}, DEFAULT_SETTINGS),
      saves: {},
      formations: []
    };
  }

  function hasStorage() {
    try {
      const k = '__af_test__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  let memoryDb = null;

  function loadDb() {
    if (!hasStorage()) {
      if (!memoryDb) memoryDb = emptyDb();
      return memoryDb;
    }
    let raw = null;
    try {
      raw = root.localStorage.getItem(DB_KEY);
    } catch (e) { raw = null; }
    if (!raw) return emptyDb();
    try {
      const db = JSON.parse(raw);
      db.profiles = db.profiles || [];
      db.saves = db.saves || {};
      db.formations = db.formations || [];
      db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
      return db;
    } catch (e) {
      return emptyDb();
    }
  }

  function saveDb(db) {
    if (!hasStorage()) {
      memoryDb = db;
      return true;
    }
    try {
      root.localStorage.setItem(DB_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- hashing ---------- */

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function fallbackHash(pin, salt) {
    // FNV-1a, 4000 rounds. Only used when crypto.subtle is unavailable.
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const input = salt + '|' + pin;
    for (let round = 0; round < 4000; round++) {
      for (let i = 0; i < input.length; i++) {
        h1 ^= input.charCodeAt(i) + round;
        h1 = Math.imul(h1, 0x01000193) >>> 0;
        h2 ^= h1 >>> 7;
        h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
      }
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  function randomSalt() {
    const arr = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(arr);
    else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return bufToHex(arr);
  }

  function hashPin(pin, salt) {
    const subtle = root.crypto && root.crypto.subtle;
    if (!subtle || typeof TextEncoder === 'undefined') {
      return Promise.resolve({ hash: fallbackHash(pin, salt), algo: 'fnv-fallback' });
    }
    const enc = new TextEncoder();
    return subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (key) {
        return subtle.deriveBits({
          name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256'
        }, key, 256);
      })
      .then(function (bits) {
        return { hash: bufToHex(bits), algo: 'pbkdf2-sha256' };
      })
      .catch(function () {
        return { hash: fallbackHash(pin, salt), algo: 'fnv-fallback' };
      });
  }

  /* ---------- profiles ---------- */

  const SIGILS = ['sun', 'comet', 'wing', 'eye', 'dagger', 'crystal', 'gear', 'chevron'];

  function listProfiles() {
    return loadDb().profiles.map(function (p) {
      return {
        id: p.id, name: p.name, sigil: p.sigil, avatar: p.avatar || null, createdAt: p.createdAt,
        stats: p.stats, lastPlayed: p.lastPlayed, hasPin: !!p.pin
      };
    });
  }

  function createProfile(opts) {
    const db = loadDb();
    const name = (opts.name || 'Commander').trim().slice(0, 18) || 'Commander';
    if (db.profiles.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); })) {
      return Promise.reject(new Error('That name is already taken on this device.'));
    }
    const salt = randomSalt();
    const pin = String(opts.pin || '');
    const profile = {
      id: uid('cmd'),
      name: name,
      sigil: opts.sigil || SIGILS[Math.floor(Math.random() * SIGILS.length)],
      createdAt: nowIso(),
      lastPlayed: nowIso(),
      pin: null,
      stats: { wins: 0, losses: 0, draws: 0, matches: 0, captures: 0, cores: 0, bestStreak: 0, streak: 0, plies: 0 },
      preferences: {}
    };
    const done = pin.length >= 4
      ? hashPin(pin, salt).then(function (r) {
        profile.pin = { salt: salt, hash: r.hash, algo: r.algo, iter: r.algo === 'pbkdf2-sha256' ? ITERATIONS : 4000 };
      })
      : Promise.resolve();
    return done.then(function () {
      db.profiles.push(profile);
      db.activeProfileId = profile.id;
      saveDb(db);
      return profile;
    });
  }

  function verifyPin(profileId, pin) {
    const db = loadDb();
    const p = db.profiles.filter(function (x) { return x.id === profileId; })[0];
    if (!p) return Promise.reject(new Error('Profile not found'));
    if (!p.pin) return Promise.resolve(true);
    return hashPin(String(pin), p.pin.salt).then(function (r) {
      return r.hash === p.pin.hash;
    });
  }

  function getProfile(id) {
    const db = loadDb();
    return db.profiles.filter(function (p) { return p.id === id; })[0] || null;
  }

  function setActiveProfile(id) {
    const db = loadDb();
    db.activeProfileId = id;
    const p = db.profiles.filter(function (x) { return x.id === id; })[0];
    if (p) p.lastPlayed = nowIso();
    saveDb(db);
  }

  function activeProfile() {
    const db = loadDb();
    if (!db.activeProfileId) return null;
    return db.profiles.filter(function (p) { return p.id === db.activeProfileId; })[0] || null;
  }

  function deleteProfile(id) {
    const db = loadDb();
    db.profiles = db.profiles.filter(function (p) { return p.id !== id; });
    if (db.activeProfileId === id) db.activeProfileId = db.profiles.length ? db.profiles[0].id : null;
    saveDb(db);
  }

  function renameProfile(id, name) {
    const db = loadDb();
    const p = db.profiles.filter(function (x) { return x.id === id; })[0];
    if (!p) return false;
    p.name = String(name).trim().slice(0, 18) || p.name;
    saveDb(db);
    return true;
  }

  /* Merge a few fields into a profile (avatar, frame, tint, badge, photo).
   * A player's photo is stored here as a small data URL and never leaves
   * this device. */
  function updateProfile(id, patch) {
    const db = loadDb();
    const p = db.profiles.filter(function (x) { return x.id === id; })[0];
    if (!p) return null;
    Object.keys(patch || {}).forEach(function (k) {
      if (k === 'id' || k === 'pin' || k === 'stats') return;
      p[k] = patch[k];
    });
    return saveDb(db) ? p : null;
  }

  function recordResult(profileId, result) {
    const db = loadDb();
    const p = db.profiles.filter(function (x) { return x.id === profileId; })[0];
    if (!p) return null;
    p.stats = p.stats || { wins: 0, losses: 0, draws: 0, matches: 0, captures: 0, cores: 0, bestStreak: 0, streak: 0, plies: 0 };
    const s = p.stats;
    s.matches++;
    if (result.outcome === 'win') { s.wins++; s.streak = (s.streak || 0) + 1; s.bestStreak = Math.max(s.bestStreak || 0, s.streak); }
    else if (result.outcome === 'loss') { s.losses++; s.streak = 0; }
    else { s.draws++; s.streak = 0; }
    s.captures += result.captures || 0;
    s.cores += result.cores || 0;
    s.plies += result.plies || 0;
    // the standing: wins and losses against each opponent
    if (result.difficulty) {
      s.byDiff = s.byDiff || {};
      const d = (s.byDiff[result.difficulty] = s.byDiff[result.difficulty] || { w: 0, l: 0, d: 0 });
      if (result.outcome === 'win') d.w++; else if (result.outcome === 'loss') d.l++; else d.d++;
    }
    p.lastPlayed = nowIso();
    saveDb(db);
    return s;
  }

  function resetStats(profileId) {
    const db = loadDb();
    const p = db.profiles.filter(function (x) { return x.id === profileId; })[0];
    if (!p) return;
    p.stats = { wins: 0, losses: 0, draws: 0, matches: 0, captures: 0, cores: 0, bestStreak: 0, streak: 0, plies: 0 };
    saveDb(db);
  }

  /* ---------- settings ---------- */

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, loadDb().settings || {});
  }

  function patchSettings(patch) {
    const db = loadDb();
    db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {}, patch || {});
    saveDb(db);
    return db.settings;
  }

  /* ---------- saved games ---------- */

  const SLOTS = ['auto', '1', '2', '3'];

  function compactState(state) {
    const copy = JSON.parse(JSON.stringify(state));
    if (copy.replay && copy.replay.length > 60) copy.replay = copy.replay.slice(-60);
    if (copy.log && copy.log.length > 80) copy.log = copy.log.slice(-80);
    return copy;
  }

  function saveGame(slot, state, meta) {
    const db = loadDb();
    const key = String(slot);
    const prev = db.saves[key];
    const entry = {
      id: prev && prev.id ? prev.id : uid('save'),
      slot: key,
      label: (meta && meta.label) || (prev && prev.label) || 'Saved game',
      createdAt: prev ? prev.createdAt : nowIso(),
      updatedAt: nowIso(),
      meta: Object.assign({}, meta || {}),
      state: compactState(state)
    };
    db.saves[key] = entry;
    const ok = saveDb(db);
    return ok ? entry : null;
  }

  function listSaves() {
    const db = loadDb();
    return SLOTS.filter(function (s) { return !!db.saves[s]; }).map(function (s) {
      const e = db.saves[s];
      return {
        slot: e.slot, id: e.id, label: e.label, updatedAt: e.updatedAt,
        createdAt: e.createdAt, meta: e.meta || {}, state: e.state
      };
    });
  }

  function loadGame(slot) {
    const db = loadDb();
    const e = db.saves[String(slot)];
    return e ? e.state : null;
  }

  function deleteSave(slot) {
    const db = loadDb();
    delete db.saves[String(slot)];
    saveDb(db);
  }

  function renameSave(slot, label) {
    const db = loadDb();
    const e = db.saves[String(slot)];
    if (!e) return;
    e.label = String(label).slice(0, 40);
    saveDb(db);
  }

  /* ---------- formations ---------- */

  function listFormations() {
    return loadDb().formations.slice();
  }

  function saveFormation(name, layout, boardKey) {
    const db = loadDb();
    const f = {
      id: uid('form'),
      name: String(name || 'Formation').slice(0, 24),
      board: boardKey || 'small',
      layout: layout,
      createdAt: nowIso()
    };
    db.formations = db.formations.filter(function (x) { return x.name !== f.name || x.board !== f.board; });
    db.formations.push(f);
    if (db.formations.length > 12) db.formations.shift();
    saveDb(db);
    return f;
  }

  function deleteFormation(id) {
    const db = loadDb();
    db.formations = db.formations.filter(function (f) { return f.id !== id; });
    saveDb(db);
  }

  /* ---------- export / import ---------- */

  function exportAll() {
    const db = loadDb();
    return JSON.stringify({
      app: 'aetherfront',
      version: 2,
      exportedAt: nowIso(),
      profiles: db.profiles,
      activeProfileId: db.activeProfileId,
      settings: db.settings,
      saves: db.saves,
      formations: db.formations
    }, null, 2);
  }

  function importAll(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
    if (!data || data.app !== 'aetherfront') throw new Error('That does not look like an Aetherfront backup.');
    const db = loadDb();
    db.profiles = data.profiles || db.profiles;
    db.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    db.saves = data.saves || {};
    db.formations = data.formations || [];
    db.activeProfileId = data.activeProfileId || (db.profiles[0] && db.profiles[0].id) || null;
    saveDb(db);
    return true;
  }

  function clearAll() {
    if (hasStorage()) {
      try { root.localStorage.removeItem(DB_KEY); } catch (e) { /* ignore */ }
    }
    memoryDb = emptyDb();
  }

  /* ---------- session (unlock state, survives reload in this tab) ---------- */

  function setSession(obj) {
    try { root.sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }

  function getSession() {
    try {
      const raw = root.sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function clearSession() {
    try { root.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  AC.storage = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    SIGILS: SIGILS,
    SLOTS: SLOTS,
    storageAvailable: hasStorage,
    listProfiles: listProfiles,
    createProfile: createProfile,
    verifyPin: verifyPin,
    getProfile: getProfile,
    activeProfile: activeProfile,
    setActiveProfile: setActiveProfile,
    deleteProfile: deleteProfile,
    renameProfile: renameProfile,
    updateProfile: updateProfile,
    recordResult: recordResult,
    resetStats: resetStats,
    getSettings: getSettings,
    patchSettings: patchSettings,
    saveGame: saveGame,
    listSaves: listSaves,
    loadGame: loadGame,
    deleteSave: deleteSave,
    renameSave: renameSave,
    listFormations: listFormations,
    saveFormation: saveFormation,
    deleteFormation: deleteFormation,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    setSession: setSession,
    getSession: getSession,
    clearSession: clearSession
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
