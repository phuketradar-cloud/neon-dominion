// Usage: load the game in a browser, then in the console: s=document.createElement("script");s.src="tests/ui-smoke.js";document.body.append(s) — results land in window.__smoke
// Browser smoke test (V3 screens): exercises every player-facing control through the real DOM. Never writes the
// user's saves (autosave off; slot 3 used only if empty and removed afterwards).
(async () => {
  const errs = []; window.addEventListener('error', (e) => errs.push(e.message + ' @' + e.lineno));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const click = (s) => { const el = $(s); if (!el) throw new Error('missing ' + s); el.click(); };
  const checks = {};
  try {
    const U = ND.UI, S = ND.Screens;
    // faction selection → setup → start (without touching the autosave: we start the game ourselves)
    // title menu → New Game → faction screen → back to the menu
    ND.Title.show('menu'); await wait(50);
    click('#title [data-title="new"]'); await wait(50);
    checks.titleNewGame = !$('#start').classList.contains('hidden') && $('#title').classList.contains('hidden');
    click('#btn-menu'); await wait(50);
    checks.titleBack = !$('#title').classList.contains('hidden');
    click('#title [data-title="credits"]'); checks.titlePanel = !!$('#title .ti-credits');
    ND.Main.showStart(); await wait(50);
    click('#start .fs-card[data-fid="legion"]'); checks.pickFaction = ND.Main.picked === 'legion';
    click('#btn-next'); await wait(50); checks.setupScreen = !$('#setupscr').classList.contains('hidden');
    click('#setupscr [data-setup="diff"][data-v="hard"]'); checks.setupDifficulty = ND.Main.setup.difficulty === 'hard';
    click('#setupscr [data-setup="adv"]'); checks.setupAdvanced = !!$('#setupscr .adv-panel');
    click('#setupscr [data-setup="back"]');
    const g = ND.World.create(4242, 'syndicate'); g.settings.autosave = false; U.start(g); await wait(300); S.close();
    const p = g.player, f = g.factions[p];
    f.res.credits = 3000; f.res.materials = 600; f.res.energy = 600; f.res.intel = 400;
    const hq = g.districts[f.hq], nb = ND.World.neighbors(g, hq).find((n) => !n.owner);
    // district ops
    U.select(nb.id); await wait(50);
    const before = ND.Inf.get(nb, p); click('[data-act="campaign"]'); checks.campaign = ND.Inf.get(nb, p) > before;
    U.select(f.hq); click('[data-act="fortify"]'); click('[data-act="develop"]'); checks.fortifyDevelop = hq.dev === 2;
    // right panel tabs
    for (const t of ['units', 'facilities', 'influence', 'overview']) click(`#right [data-cmd="rtab"][data-arg="${t}"]`);
    checks.districtTabs = true;
    // covert tab
    U.select(nb.id); click('[data-cmd="acttab"][data-arg="covert"]'); checks.covertCards = document.querySelectorAll('[data-cmd="covert"]').length === 7;
    click('[data-cmd="acttab"][data-arg="district"]');
    // treasury & market
    click('#left .treasury-mini'); checks.treasuryScreen = S.cur === 'treasury';
    const cr = f.res.credits; click('#screen [data-cmd="sell"][data-arg="materials"]'); checks.market = f.res.credits > cr;
    // recruit
    click('#screen-nav [data-screen="recruit"]'); await wait(50);
    const rb = $('#screen [data-cmd="recruit"]:not([disabled])'); if (rb) rb.click();
    checks.recruit = ND.Units.list(g, p).length === 1;
    // armory: buy and equip-to
    click('#screen-nav [data-screen="armory"]'); await wait(50);
    click('#screen [data-cmd="buy"]'); checks.buy = f.inventory.pistol === 1;
    const u = ND.Units.list(g, p)[0];
    const eqb = $(`#screen [data-cmd="equipto"][data-arg="${u.id}"]`);
    if (eqb) { eqb.click(); checks.equip = u.equip.includes('pistol'); } else checks.equip = 'no weapon slot';
    // units screen: select + gear tab
    click('#screen-nav [data-screen="units"]'); await wait(50);
    click(`#screen .u-card[data-arg="${u.id}"]`); checks.unitsScreen = !!$('#screen .unit-detail');
    click('#screen [data-cmd="utab"][data-arg="gear"]'); checks.gearTab = !!$('#screen .equip-sel');
    S.close();
    // move + order from the city
    U.select(f.hq); await wait(50);
    click(`#right [data-cmd="move"][data-arg="${u.id}"]`); U.select(nb.id); checks.move = u.loc === nb.id;
    click(`#right [data-cmd="utab"][data-arg="orders"]`);
    const ob = $(`#right [data-cmd="order"][data-arg="${u.id}"][data-arg2="canvass"]`); if (ob) ob.click(); checks.order = u.task.kind === 'canvass';
    click('#right [data-cmd="panel"][data-arg="district"]');
    // faction panel from rankings
    click('#left .rk-row'); checks.factionPanel = U.panel.kind === 'faction';
    click('#right [data-cmd="panel"][data-arg="district"]');
    // research
    click('#rdpill'); await wait(50);
    const rbtn = $('#screen [data-cmd="research"]:not([disabled])'); if (rbtn) rbtn.click(); checks.research = !!f.tech.current;
    click('#screen [data-cmd="research-cancel"]'); checks.researchCancel = !f.tech.current;
    // diplomacy
    click('#screen-nav [data-screen="diplomacy"]'); await wait(50);
    const pb = $('#screen [data-cmd="propose"]:not([disabled])'); if (pb) pb.click(); checks.diplomacy = !!pb;
    // every screen + tabs
    for (const s of ['report', 'units', 'recruit', 'armory', 'battles', 'diplomacy', 'factions', 'intel', 'victory', 'help', 'settings', 'research', 'treasury']) {
      U.openScreen(s); await wait(20);
      for (const tb of [...document.querySelectorAll('#screen [data-cmd="scr"][data-arg="tab"]')].slice(0, 6)) { tb.click(); await wait(10); }
    }
    S.close();
    checks.screens = 13;
    // overlays
    for (const b of document.querySelectorAll('#map-tools [data-mode]')) b.click();
    checks.overlays = document.querySelectorAll('#map-tools [data-mode]').length;
    click('#map-tools [data-mode="owner"]');
    // keyboard
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); checks.keyboard = true;
    // end turns (asynchronous)
    for (let i = 0; i < 6 && !g.over; i++) {
      const t = g.turn; click('#btn-end');
      for (let k = 0; k < 50 && g.turn === t; k++) await wait(20);
      await wait(30); S.close();
    }
    checks.turns = g.turn;
    // save/load
    if (!localStorage.getItem('neon-dominion:v1:3')) {
      const snap = JSON.stringify(g); ND.Save.save(g, '3'); U.cmd('load', '3'); await wait(200);
      checks.saveLoad = JSON.stringify(U.g) === snap; ND.Save.remove('3'); U.g.settings.autosave = false;
    }
    // tutorial start/exit
    ND.Tutorial.startGame(); await wait(400); checks.tutorial = !!$('#tut-card') && !$('#tut-card').classList.contains('hidden');
    $('#tut-card [data-tut="exit"]').click();
  } catch (e) { errs.push('smoke: ' + e.message); }
  window.__smoke = { checks, errs };
})();
