// Line-icon set (24×24, stroke = currentColor) so every screen uses the same visual language.
(function (ND) {
  const P = {
    // resources & status
    credits: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8m0 8v1.5"/>',
    energy: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    materials: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    intel: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
    turn: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ops: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    units: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6"/>',
    research: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/>',
    // navigation
    briefing: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7M9 8h3"/>',
    recruit: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c0-3.6 2.9-6 6.5-6 1.6 0 3 .5 4.1 1.3M18 13v7m-3.5-3.5h7"/>',
    armory: '<path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    battles: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 14.5 3 21m3-3-3-3M14.5 6.5 18 3h3v3l-3.5 3.5"/>',
    diplomacy: '<path d="m11 17 2 2a1.4 1.4 0 0 0 2-2"/><path d="m14 14 2.5 2.5a1.4 1.4 0 0 0 2-2l-3.9-3.9a2.8 2.8 0 0 0-4 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a5.4 5.4 0 0 1 6.4-.9l.5.3a2 2 0 0 0 1.4.2L21 5"/><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1.4 1.4 0 0 0 2-2M3 4h8"/>',
    factions: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    intelnav: '<circle cx="12" cy="12" r="9"/><path d="M12 12 18 6M12 3v3m0 12v3M3 12h3m12 0h3"/><circle cx="12" cy="12" r="4"/>',
    victory: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    manual: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3M9 8h7M9 12h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    end: '<path d="M5 4v16M9 5l11 7-11 7z"/>',
    // district operations
    campaign: '<path d="M3 10v4h3l7 5V5L6 10zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
    consolidate: '<path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6z"/><path d="M12 8v8m-4-4h8"/>',
    bribe: '<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10.5v4m12-4v4"/>',
    fortify: '<path d="M4 21V9h3V6h3v3h4V6h3v3h3v12z"/><path d="M10 21v-5h4v5"/>',
    develop: '<path d="M4 21V11l5-3v13M9 21V5l6-2v18M15 21V9l5 2v10M3 21h18"/>',
    // covert operations
    spy: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    opinion: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    disrupt: '<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11M12 7v1.5m0 7V17"/>',
    sabotage: '<circle cx="11" cy="14" r="7"/><path d="m15.5 9.5 2-2M19 3l-1.5 3M21 6l-3 1.5M21 3l-1 1"/>',
    steal: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 3 3m-6 0 2 2"/>',
    plague: '<circle cx="12" cy="12" r="2"/><path d="M12 10V5a3 3 0 0 0-3 3M10.3 13 6 15.5a3 3 0 0 0 4 1.2M13.7 13l4.3 2.5a3 3 0 0 1-4 1.2"/><circle cx="12" cy="12" r="9"/>',
    assassinate: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
    // unit orders
    rest: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    canvass: '<path d="M3 10v4h3l7 5V5L6 10zM16 8.5a5 5 0 0 1 0 7"/>',
    guard: '<path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6z"/>',
    gather: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>',
    train: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 20 4m-3 0h3v3"/>',
    hq: '<path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/>',
    seize: '<path d="M4 21V5l8-2v18M12 21V9l8 2v10M3 21h18M7 8h2m-2 4h2m-2 4h2m6-3h2m-2 4h2"/>',
    attack: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
    move: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    // misc
    population: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
    security: '<path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6z"/><path d="M12 8v5"/><circle cx="12" cy="16" r=".6"/>',
    dev: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    economy: '<path d="M4 20V10m5 10V4m5 16v-8m5 8V7"/>',
    facility: '<path d="M3 21V9l6 4V9l6 4V5h6v16z"/>',
    influence: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3v.5"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 9v5m0 3v.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    crown: '<path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/>',
  };
  ND.ICON_PATHS = P;
  ND.icon = (name, cls = '') =>
    P[name] ? `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>` : '';
  // Decorate static markup: <button data-icon="name">.
  ND.applyIcons = (root = document) => {
    root.querySelectorAll('[data-icon]:not([data-icon-done])').forEach((el) => {
      el.insertAdjacentHTML('afterbegin', ND.icon(el.dataset.icon));
      el.setAttribute('data-icon-done', '');
    });
  };
})(window.ND);
