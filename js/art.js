/* Aetherfront: Astral Command — vector art
 * Hand-built SVG emblems for the ten unit classes, plus faction sigils and a
 * small UI icon set. Everything is inline SVG: crisp at any size, tintable by
 * the faction colour, and zero image requests.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  const S = 'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"';

  const EMBLEMS = {
    // Solar Archon — crown over a rising sun
    '10':
      '<circle cx="16" cy="11" r="3.2" ' + S + '/>' +
      '<path d="M3.5 25.5 L6 13.5 L11 18.5 L16 12 L21 18.5 L26 13.5 L28.5 25.5 Z" ' + S + ' fill="currentColor" fill-opacity="0.16"/>' +
      '<path d="M9 29 H23" ' + S + '/>',
    // Star Paladin — shield with a four-point star
    '9':
      '<path d="M16 3.5 L27 8 V17.5 C27 24 22.5 28.5 16 30.5 C9.5 28.5 5 24 5 17.5 V8 Z" ' + S + ' fill="currentColor" fill-opacity="0.14"/>' +
      '<path d="M16 9.5 L18.1 15 L24 16 L18.1 17.4 L16 23 L13.9 17.4 L8 16 L13.9 15 Z" fill="currentColor" fill-opacity="0.85"/>',
    // Valkyrie Vanguard — swept wings around a dive chevron
    '7':
      '<path d="M4 10 C8 15 10.5 19 12 25" ' + S + '/>' +
      '<path d="M28 10 C24 15 21.5 19 20 25" ' + S + '/>' +
      '<path d="M7 8 C10 13 12 17 13.5 21" ' + S + ' stroke-opacity="0.55"/>' +
      '<path d="M25 8 C22 13 20 17 18.5 21" ' + S + ' stroke-opacity="0.55"/>' +
      '<path d="M16 11 L20 19 L16 23.5 L12 19 Z" fill="currentColor" fill-opacity="0.9"/>',
    // Plasma Lancer — comet with a burning trail
    '6':
      '<circle cx="21" cy="11" r="4.2" ' + S + ' fill="currentColor" fill-opacity="0.25"/>' +
      '<path d="M18 14.5 L8 26" ' + S + '/>' +
      '<path d="M15 12 L6 20" ' + S + ' stroke-opacity="0.7"/>' +
      '<path d="M20 16 L12 28" ' + S + ' stroke-opacity="0.7"/>' +
      '<circle cx="21" cy="11" r="1.4" fill="currentColor"/>',
    // Chrono Seer — an eye inside an orbital ring
    '5':
      '<path d="M2.5 16 C7 9 12 6.5 16 6.5 C20 6.5 25 9 29.5 16 C25 23 20 25.5 16 25.5 C12 25.5 7 23 2.5 16 Z" ' + S + ' fill="currentColor" fill-opacity="0.1"/>' +
      '<circle cx="16" cy="16" r="4" ' + S + '/>' +
      '<circle cx="16" cy="16" r="1.5" fill="currentColor"/>' +
      '<ellipse cx="16" cy="16" rx="14" ry="5" ' + S + ' stroke-opacity="0.45" transform="rotate(-18 16 16)"/>',
    // Warp Sapper — cog with a wrench core
    '3':
      '<path d="M16 3.5 L18.4 6.6 L22.3 6 L23.6 9.7 L27.3 11.3 L26.4 15.2 L28.8 18.4 L26.4 21.6 L27.3 25.5 L23.6 27.1 L22.3 30.8 L18.4 30.2 L16 33.3" ' + S + ' stroke-opacity="0" />' +
      '<path d="M16 4 L19.2 6.4 L23.1 5.7 L24.4 9.4 L28.1 11 L27.2 14.9 L29.5 18.1 L27.2 21.3 L28.1 25.2 L24.4 26.8 L23.1 30.5 L19.2 29.8 L16 32.2 L12.8 29.8 L8.9 30.5 L7.6 26.8 L3.9 25.2 L4.8 21.3 L2.5 18.1 L4.8 14.9 L3.9 11 L7.6 9.4 L8.9 5.7 L12.8 6.4 Z" ' + S + ' fill="currentColor" fill-opacity="0.12" transform="translate(0,-2.1) scale(1)"/>' +
      '<circle cx="16" cy="16" r="4.6" ' + S + '/>' +
      '<path d="M13.4 16 H18.6" ' + S + '/>',
    // Astral Strider — twin pursuit chevrons
    '2':
      '<path d="M6 24 L16 15 L26 24" ' + S + ' stroke-width="2.2"/>' +
      '<path d="M6 16 L16 7 L26 16" ' + S + ' stroke-width="2.2" stroke-opacity="0.55"/>' +
      '<circle cx="16" cy="26" r="1.6" fill="currentColor"/>',
    // Shadow Wraith — a dagger across a void
    '1':
      '<path d="M16 3.5 L19.5 17 L16 20 L12.5 17 Z" fill="currentColor" fill-opacity="0.8"/>' +
      '<path d="M9 20.5 H23" ' + S + ' stroke-width="2"/>' +
      '<path d="M16 20.5 V28.5" ' + S + ' stroke-width="2"/>' +
      '<circle cx="16" cy="29.5" r="1.5" fill="currentColor"/>',
    // Stasis Mine — a spiked singularity
    'B':
      '<circle cx="16" cy="16" r="7" ' + S + ' fill="currentColor" fill-opacity="0.16"/>' +
      '<circle cx="16" cy="16" r="2.4" fill="currentColor"/>' +
      '<path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M7 7 L9.8 9.8 M22.2 22.2 L25 25 M25 7 L22.2 9.8 M9.8 22.2 L7 25" ' + S + '/>',
    // Nexus Core — a cut crystal
    'F':
      '<path d="M16 2.5 L26 9.5 L23.5 24 L16 30 L8.5 24 L6 9.5 Z" ' + S + ' fill="currentColor" fill-opacity="0.18"/>' +
      '<path d="M16 2.5 V30 M6 9.5 L16 14 L26 9.5 M16 14 L8.5 24 M16 14 L23.5 24" ' + S + ' stroke-opacity="0.6"/>'
  };

  function emblem(key, cls) {
    const body = EMBLEMS[key] || EMBLEMS['2'];
    return '<svg class="emblem ' + (cls || '') + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* ---------- faction sigils (used for avatars) ---------- */

  const SIGILS = {
    sun: '<circle cx="16" cy="16" r="6" ' + S + '/><path d="M16 2 V6 M16 26 V30 M2 16 H6 M26 16 H30 M6.2 6.2 L9 9 M23 23 L25.8 25.8 M25.8 6.2 L23 9 M9 23 L6.2 25.8" ' + S + '/>',
    comet: '<circle cx="20" cy="12" r="5" ' + S + ' fill="currentColor" fill-opacity="0.2"/><path d="M16 16 L4 28 M14 12 L4 20 M20 17 L10 28" ' + S + '/>',
    wing: '<path d="M4 22 C10 20 14 15 16 8 C18 15 22 20 28 22" ' + S + '/><path d="M8 27 C12 25 14 22 16 18 C18 22 20 25 24 27" ' + S + ' stroke-opacity="0.6"/>',
    eye: '<path d="M2.5 16 C8 9.5 12 7.5 16 7.5 C20 7.5 24 9.5 29.5 16 C24 22.5 20 24.5 16 24.5 C12 24.5 8 22.5 2.5 16 Z" ' + S + '/><circle cx="16" cy="16" r="3.6" fill="currentColor" fill-opacity="0.7"/>',
    dagger: '<path d="M16 3 L19 15 L16 18 L13 15 Z" fill="currentColor" fill-opacity="0.75"/><path d="M9.5 18.5 H22.5 M16 18.5 V28" ' + S + '/>',
    crystal: '<path d="M16 3 L26 10 L23 25 L16 30 L9 25 L6 10 Z" ' + S + '/><path d="M16 3 V30 M6 10 L16 14 L26 10" ' + S + ' stroke-opacity="0.6"/>',
    gear: '<circle cx="16" cy="16" r="6" ' + S + '/><circle cx="16" cy="16" r="2" fill="currentColor"/><path d="M16 3 V8 M16 24 V29 M3 16 H8 M24 16 H29 M6.8 6.8 L10.4 10.4 M21.6 21.6 L25.2 25.2 M25.2 6.8 L21.6 10.4 M10.4 21.6 L6.8 25.2" ' + S + '/>',
    chevron: '<path d="M6 22 L16 12 L26 22" ' + S + ' stroke-width="2.4"/><path d="M6 14 L16 4 L26 14" ' + S + ' stroke-width="2.4" stroke-opacity="0.5"/>'
  };

  function sigil(name, cls) {
    const body = SIGILS[name] || SIGILS.crystal;
    return '<svg class="sigil ' + (cls || '') + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* ---------- UI icons (24px grid) ---------- */

  const ICONS = {
    settings: '<circle cx="12" cy="12" r="3.2" ' + S + '/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" ' + S + '/>',
    sound: '<path d="M11 5 L6 9 H3 v6 h3 l5 4 z" ' + S + '/><path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" ' + S + '/>',
    mute: '<path d="M11 5 L6 9 H3 v6 h3 l5 4 z" ' + S + '/><path d="M16 9 L22 15 M22 9 L16 15" ' + S + '/>',
    music: '<path d="M9 18V5l11-2v13" ' + S + '/><circle cx="6.5" cy="18" r="2.6" ' + S + '/><circle cx="17.5" cy="16" r="2.6" ' + S + '/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" ' + S + '/><path d="M17 21v-8H7v8M7 3v5h8" ' + S + '/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" ' + S + '/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z" ' + S + '/><path d="M20 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6z" ' + S + '/>',
    back: '<path d="M15 5 L8 12 L15 19" ' + S + '/>',
    close: '<path d="M6 6 L18 18 M18 6 L6 18" ' + S + '/>',
    clock: '<circle cx="12" cy="12" r="9" ' + S + '/><path d="M12 7v5l3.5 2" ' + S + '/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V16a3 3 0 0 0 4 2.8V20a3 3 0 0 0 5 2.2V4.8A3 3 0 0 0 9 4z" ' + S + '/><path d="M15 4.8A3 3 0 0 1 19 7a3 3 0 0 1 1 5.8V16a3 3 0 0 1-4 2.8" ' + S + '/>',
    shield: '<path d="M12 3 L20 6v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z" ' + S + '/>',
    flag: '<path d="M5 21V4h9l-1.5 3H19v8h-6.5L11 18H5" ' + S + '/>',
    sword: '<path d="M14.5 3.5 L20.5 9.5 L10 20 H4 v-6 z" ' + S + '/><path d="M4 20 L8 16" ' + S + '/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" ' + S + '/><circle cx="12" cy="12" r="3" ' + S + '/>',
    play: '<path d="M7 4 L20 12 L7 20 Z" fill="currentColor"/>',
    pause: '<path d="M8 4v16M16 4v16" ' + S + ' stroke-width="3"/>',
    user: '<circle cx="12" cy="8" r="4" ' + S + '/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" ' + S + '/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2" ' + S + '/><path d="M8 10V7a4 4 0 0 1 8 0v3" ' + S + '/>',
    plus: '<path d="M12 5v14M5 12h14" ' + S + '/>',
    check: '<path d="M4 13 L9 18 L20 6" ' + S + '/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" ' + S + '/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16" ' + S + '/>',
    upload: '<path d="M12 17V5M7 9l5-5 5 5M4 20h16" ' + S + '/>',
    star: '<path d="M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.3L12 17.4 6.4 20.3l1.2-6.3L3 9.7l6.2-.8z" ' + S + '/>',
    info: '<circle cx="12" cy="12" r="9" ' + S + '/><path d="M12 11v6M12 8h.01" ' + S + '/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" ' + S + '/>',
    chevronDown: '<path d="M6 9l6 6 6-6" ' + S + '/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16" ' + S + '/>',
    users: '<circle cx="9" cy="8" r="3.2" ' + S + '/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" ' + S + '/><path d="M16 5.5a3.2 3.2 0 0 1 0 6M17 14.8c2.4.6 4 2.5 4 5.2" ' + S + '/>',
    bolt: '<path d="M13 2 L5 13h6l-1 9 8-11h-6z" ' + S + '/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5" ' + S + '/><rect x="14" y="3" width="7" height="7" rx="1.5" ' + S + '/><rect x="3" y="14" width="7" height="7" rx="1.5" ' + S + '/><rect x="14" y="14" width="7" height="7" rx="1.5" ' + S + '/>',
    help: '<circle cx="12" cy="12" r="9" ' + S + '/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1 1-1.1 1.9M12 17h.01" ' + S + '/>'
  };

  function icon(name, cls) {
    const body = ICONS[name] || ICONS.info;
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* Tiny board preview used by the save-slot cards. */
  function boardPreview(compact, opts) {
    if (!compact || !compact.length) return '';
    const rows = compact.length;
    const cols = compact[0].length;
    const cell = 6;
    let out = '<svg class="board-preview" viewBox="0 0 ' + (cols * cell) + ' ' + (rows * cell) + '" preserveAspectRatio="xMidYMid meet">';
    out += '<rect x="0" y="0" width="' + cols * cell + '" height="' + rows * cell + '" fill="rgba(8,12,24,.85)"/>';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = compact[r][c];
        if (!v) continue;
        const owner = v[0];
        const revealed = v[2];
        const fill = owner === 1 ? '#22d3ee' : '#f43f5e';
        out += '<rect x="' + (c * cell + 0.6) + '" y="' + (r * cell + 0.6) + '" width="' + (cell - 1.2) + '" height="' + (cell - 1.2) +
          '" rx="1.2" fill="' + fill + '" fill-opacity="' + (revealed ? 0.95 : 0.55) + '"/>';
      }
    }
    out += '</svg>';
    return out;
  }

  AC.art = { emblem: emblem, sigil: sigil, icon: icon, SIGILS: SIGILS, EMBLEMS: EMBLEMS, boardPreview: boardPreview };
})(typeof globalThis !== 'undefined' ? globalThis : this);
