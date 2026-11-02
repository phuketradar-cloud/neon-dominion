// Usage: load the game in a browser, then in the console: s=document.createElement("script");s.src="tests/ui-smoke.js";document.body.append(s) — results land in window.__smoke
// Browser smoke test: exercises every player-facing control through the real DOM. Never writes the user's saves
// (autosave off; slot 3 used only if empty and removed afterwards).
(async () => {
  const errs = []; window.addEventListener('error', (e) => errs.push(e.message + ' @' + e.lineno));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const click = (s) => { const el = $(s); if (!el) throw new Error('missing ' + s); el.click(); };
  const checks = {};
  const U = ND.UI;
  const g = ND.World.create(4242, 'syndicate'); g.settings.autosave = false; U.start(g); await wait(300); U.closeModal();
  const p = g.player, f = g.factions[p];
  f.res.credits = 3000; f.res.materials = 600; f.res.energy = 600; f.res.intel = 400;
  const hq = g.districts[f.hq], nb = ND.World.neighbors(g, hq).find((n) => !n.owner);
  // district ops through buttons
  U.select(nb.id); await wait(50);
  const before = ND.Inf.get(nb, p); click('[data-act="campaign"]'); checks.campaign = ND.Inf.get(nb, p) > before;
  U.select(f.hq); click('[data-act="fortify"]'); click('[data-act="develop"]'); checks.fortifyDevelop = hq.dev === 2;
  // covert tab
  U.select(nb.id); click('[data-cmd="acttab"][data-arg="covert"]'); checks.covertCards = document.querySelectorAll('[data-cmd="covert"]').length === 7;
  click('[data-cmd="acttab"][data-arg="district"]');
  // market
  const cr = f.res.credits; click('[data-cmd="sell"][data-arg="materials"]'); checks.market = f.res.credits > cr;
  // recruit, buy, equip, move, order
  click('#topbar [data-screen="recruit"]'); await wait(50);
  const rb = $('#modal [data-cmd="recruit"]:not([disabled])'); if (rb) rb.click();
  checks.recruit = ND.Units.list(g, p).length === 1;
  click('#topbar [data-screen="armory"]'); click('#modal [data-cmd="buy"][data-arg="pistol"]'); checks.buy = f.inventory.pistol === 1;
  const u = ND.Units.list(g, p)[0];
  if (u) {
    U.cmd('unit', u.id); const es = $(`.equip-sel[data-unit="${u.id}"]`);
    const slot = ND.UNIT_TYPES[u.type].slots.indexOf('weapon');
    if (slot >= 0) { const s = $(`.equip-sel[data-unit="${u.id}"][data-slot="${slot}"]`); s.value = 'pistol'; s.dispatchEvent(new Event('change', { bubbles: true })); checks.equip = u.equip[slot] === 'pistol'; } else checks.equip = 'n/a';
    U.closeModal(); U.select(f.hq); await wait(50);
    click(`#right [data-cmd="move"][data-arg="${u.id}"]`); U.select(nb.id); checks.move = u.loc === nb.id;
    const ob = $(`#right [data-cmd="order"][data-arg="${u.id}"][data-arg2="canvass"]`); if (ob) ob.click(); checks.order = u.task.kind === 'canvass';
  }
  // research
  click('#rdpill'); const rbtn = $('#modal [data-cmd="research"]:not([disabled])'); if (rbtn) rbtn.click(); checks.research = !!f.tech.current;
  click('#modal [data-cmd="research-cancel"]'); checks.researchCancel = !f.tech.current;
  // diplomacy
  click('#topbar [data-screen="diplomacy"]'); const pb = $('#modal [data-cmd="propose"]:not([disabled])'); if (pb) pb.click(); checks.diplomacy = !!pb;
  // every screen
  for (const s of ['report', 'units', 'recruit', 'armory', 'battles', 'diplomacy', 'factions', 'intel', 'victory', 'help', 'settings', 'research']) { click(`[data-screen="${s}"]`); await wait(20); }
  U.closeModal();
  // overlays
  for (const b of document.querySelectorAll('[data-mode]')) { b.click(); } checks.overlays = document.querySelectorAll('[data-mode]').length;
  click('[data-mode="owner"]');
  // keyboard
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); checks.keyboard = true;
  // end turns
  // End Turn is asynchronous (it shows an activity overlay first), so wait for the turn counter to move.
  for (let i = 0; i < 6 && !g.over; i++) {
    const t = g.turn; click('#btn-end');
    for (let k = 0; k < 50 && g.turn === t; k++) await wait(20);
    await wait(30); U.closeModal();
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
  checks.topbarRows = new Set([...document.querySelectorAll('#topbar nav .btn')].map((b) => b.offsetTop)).size;
  window.__smoke = { checks, errs };
})();
