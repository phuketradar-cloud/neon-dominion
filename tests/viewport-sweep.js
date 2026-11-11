// Usage (browser console): s=document.createElement("script");s.src="tests/viewport-sweep.js";document.body.append(s)
// Runs tests/viewport-check.js on every screen, tab and side-panel state of a mid-game position.
// Results land in window.__sweep = { size, failures: {state: [problems]}, checked }. Never touches saves.
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!window.ndViewportCheck) { const s = document.createElement('script'); s.src = 'tests/viewport-check.js?' + Date.now(); document.body.append(s); await wait(300); }
  const out = { size: `${innerWidth}x${innerHeight}`, failures: {}, checked: 0 };
  const check = async (name) => { await wait(60); const r = ndViewportCheck(); out.checked++; if (!r.ok) out.failures[name] = r.problems.slice(0, 6); };
  const U = ND.UI, S = ND.Screens;
  try {
    // title splash, main menu and its panels
    ND.Title.show('press'); await check('title/press');
    ND.Title.show('menu'); await check('title/menu');
    for (const p of ['load', 'settings', 'credits']) { ND.Title.panel = p; ND.Title.render(); await check('title/' + p); }
    ND.Title.panel = null;
    // opening screens
    ND.Main.showStart(); await check('start');
    ND.Main.setup = null; ND.Main.showSetup(); await check('setup');
    ND.Main.setup.adv = true; ND.Main.renderSetup(); await check('setup+advanced');
    // a busy mid-game position
    const g = ND.World.create(777, 'cult'); g.settings.autosave = false;
    for (let i = 0; i < 25; i++) { ND.Diplo.aiTurn(g, g.player); ND.AI.research(g, g.player); ND.AI.manageUnits(g, g.player); ND.AI.espionage(g, g.player); ND.AI.takeTurn(g, g.player); ND.Turn.end(g); }
    U.start(g); await wait(300); S.close();
    const u = ND.Units.list(g, g.player)[0];
    U.select(u ? u.loc : g.factions[g.player].hq);
    for (const t of ['overview', 'units', 'facilities', 'influence']) { U.cmd('rtab', t); await check('city/district/' + t); }
    U.cmd('acttab', 'covert'); await check('city/covert'); U.cmd('acttab', 'district');
    if (u) for (const t of ['orders', 'targets', 'gear']) { U.cmd('unit', u.id); U.cmd('utab', t); await check('city/unit/' + t); }
    U.cmd('panel', 'faction', g.player); await check('city/faction');
    U.cmd('panel', 'district');
    // every screen and every tab
    const TABS = { report: ['summary', 'events', 'battles', 'offers'], units: ['all', 'idle', 'assigned', 'injured'], armory: ['weapons', 'armor', 'cyber', 'special'],
      intel: ['threats', 'enemy', 'districts', 'espionage', 'economy'], settings: ['saves', 'gameplay', 'audio', 'session'],
      help: ['goal', 'influence', 'ops', 'units', 'combat', 'research', 'covert', 'diplomacy', 'economy', 'turn', 'controls'] };
    for (const s of ['report', 'units', 'recruit', 'armory', 'research', 'battles', 'diplomacy', 'factions', 'intel', 'victory', 'help', 'settings', 'treasury']) {
      U.openScreen(s);
      for (const t of TABS[s] || [null]) { if (t) S.set('tab', t); await check(s + (t ? '/' + t : '')); }
    }
    S.open('battles', { sub: 'r1' }); await check('battles/round1');
    for (const fid of g.order) { S.open('factions', { sel: fid }); }
    await check('factions/profile');
    // game over presentation
    g.over = { result: 'victory', type: 'Territorial Supremacy', turn: g.turn, text: 'Test result screen.' };
    S.open('gameover'); await check('gameover/victory');
    g.over.result = 'defeat'; g.over.winner = g.order.find((x) => x !== g.player); S.open('gameover'); await check('gameover/defeat');
    g.over = null; S.close();
  } catch (e) { out.failures.error = [e.message]; }
  window.__sweep = out;
})();
