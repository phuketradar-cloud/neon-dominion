// Usage (browser console): s=document.createElement("script");s.src="tests/i18n-harvest.js";document.body.append(s)
// Visits every screen, tab and panel (like viewport-sweep.js) and collects the English text the player can see,
// numbers replaced by {n}. With Thai on, it lists only what is still untranslated. Result: window.__harvest
// = { lang, strings: [..], log: [..] }. Never touches saves (autosave off).
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const I = ND.I18N, seen = new Set(), U = ND.UI, S = ND.Screens;
  const keep = (t) => {
    t = (t || '').trim();
    if (!t || !/[A-Za-z]{2}/.test(t)) return;
    if (I.lang === 'th' && /[฀-๿]/.test(t)) return; // already Thai
    seen.add(t.replace(/-?\d+(?:[.,]\d+)*%?/g, '{n}'));
  };
  const grab = () => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) { const p = n.parentElement; if (p && p.closest('.hidden, script, style')) continue; keep(n.nodeValue); }
      else if (!n.closest('.hidden')) for (const a of ['title', 'placeholder', 'aria-label']) if (n.hasAttribute(a)) keep(n.getAttribute(a));
    }
  };
  const step = async () => { await wait(60); grab(); };
  try {
    ND.Title.show('press'); await step(); ND.Title.show('menu'); await step();
    for (const p of ['load', 'settings', 'credits']) { ND.Title.panel = p; ND.Title.render(); await step(); }
    ND.Title.panel = null;
    for (const fid of ND.FACTIONS.map((f) => f.id)) { ND.Main.picked = fid; ND.Main.showStart(); await step(); }
    ND.Main.setup = null; ND.Main.showSetup(); await step(); ND.Main.setup.adv = true; ND.Main.renderSetup(); await step();
    const g = ND.World.create(777, 'cult'); g.settings.autosave = false;
    for (let i = 0; i < 30; i++) { ND.Diplo.aiTurn(g, g.player); ND.AI.research(g, g.player); ND.AI.manageUnits(g, g.player); ND.AI.espionage(g, g.player); ND.AI.takeTurn(g, g.player); ND.Turn.end(g); }
    U.start(g); await wait(300); S.close();
    for (const d of g.districts.filter((x, i) => i % 7 === 0)) {
      U.select(d.id);
      for (const t of ['overview', 'units', 'facilities', 'influence']) { U.cmd('rtab', t); await step(); }
      U.cmd('acttab', 'covert'); await step(); U.cmd('acttab', 'district'); await step();
    }
    for (const u of ND.Units.list(g, g.player)) for (const t of ['orders', 'targets', 'gear', 'profile']) { U.cmd('unit', u.id); U.cmd('utab', t); await step(); }
    for (const fid of g.order) { U.cmd('panel', 'faction', fid); await step(); }
    U.cmd('panel', 'district');
    const TABS = { report: ['summary', 'events', 'battles', 'offers'], units: ['all', 'idle', 'assigned', 'injured'], armory: ['weapons', 'armor', 'cyber', 'special'],
      intel: ['threats', 'enemy', 'districts', 'espionage', 'economy'], settings: ['saves', 'gameplay', 'audio', 'session'],
      help: ['goal', 'influence', 'ops', 'units', 'combat', 'research', 'covert', 'diplomacy', 'economy', 'turn', 'controls'] };
    for (const s of ['report', 'units', 'recruit', 'armory', 'research', 'battles', 'diplomacy', 'factions', 'intel', 'victory', 'help', 'settings', 'treasury']) {
      U.openScreen(s);
      for (const t of TABS[s] || [null]) { if (t) S.set('tab', t); await step(); for (let p = 1; p < 3; p++) { S.set('page', p); await step(); } S.set('page', 0); }
    }
    for (const it of Object.keys(ND.ITEMS)) { S.open('armory', { sel: it }); await step(); }
    for (const tk of Object.keys(ND.TECHS)) { S.open('research', { sel: tk }); await step(); }
    for (const fid of g.order) { S.open('factions', { sel: fid }); await step(); }
    for (const b of g.battles.slice(0, 8)) for (const sub of ['overview', 'r1', 'r2']) { S.open('battles', { sel: b.id, sub }); await step(); }
    for (let i = 0; i < g.factions[g.player].market.length; i++) { S.open('recruit', { sel: i }); await step(); }
    g.over = { result: 'victory', type: 'Territorial Supremacy', turn: g.turn, text: 'Test result screen.' }; S.open('gameover'); await step();
    g.over.result = 'defeat'; g.over.winner = g.order.find((x) => x !== g.player); S.open('gameover'); await step();
    g.over = null; S.close();
    // every sentence the rules wrote into the game state (log entries, battle consequences, results)
    const texts = new Set();
    const dig = (o) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && /^(text|msg)$/.test(k)) texts.add(v); else if (k === 'consequences' && Array.isArray(v)) v.forEach((x) => texts.add(x)); else dig(v); } };
    dig(g);
    window.__harvest = { lang: I.lang, strings: [...seen].sort(), log: [...texts].slice(0, 800) };
  } catch (e) { window.__harvest = { error: e.message + ' ' + e.stack, strings: [...seen] }; }
})();
