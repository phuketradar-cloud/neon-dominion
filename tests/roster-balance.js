// Usage: node tests/roster-balance.js .
// Plays the same seeded AI games with and without the fixed roster and compares outcomes. Units' names/rids and log
// text are ignored, so any remaining difference comes from the roster rules (a type running out of characters).
const fs = require('fs'), vm = require('vm'), dir = process.argv[2];
const CORE = ['rng', 'data', 'world', 'economy', 'actions', 'units', 'combat', 'tech', 'espionage', 'diplomacy', 'victory', 'market', 'ai', 'turn'];
const run = (withRoster, seed) => {
  const ctx = { console, Math }; ctx.window = ctx; vm.createContext(ctx);
  for (const f of CORE) vm.runInContext(fs.readFileSync(`${dir}/js/core/${f}.js`, 'utf8'), ctx);
  if (withRoster) vm.runInContext(fs.readFileSync(`${dir}/js/core/roster.js`, 'utf8'), ctx);
  const ND = ctx.ND, pl = ND.FACTIONS[seed % 6].id, g = ND.World.create(seed, pl);
  let exhausted = 0, peakTaken = 0;
  for (let t = 0; t < 80 && !g.over; t++) {
    ND.Diplo.aiTurn(g, pl); ND.Market.aiTrade(g, pl); ND.AI.research(g, pl); ND.AI.manageUnits(g, pl); ND.AI.espionage(g, pl); ND.AI.takeTurn(g, pl); ND.Turn.end(g);
    const free = ND.Units.rosterFree(g);
    if (free) { if (!free.merc.length) exhausted++; peakTaken = Math.max(peakTaken, ND.ROSTER.length - free.merc.length); }
  }
  const strip = (k, v) => (['name', 'rid', 'rosterGone', 'text', 'log', 'battles'].includes(k) ? undefined : v);
  const h = require('crypto').createHash('sha1').update(JSON.stringify(g, strip)).digest('hex').slice(0, 10);
  return { h, turn: g.turn, over: g.over ? g.over.result + ':' + (g.over.winner || '') : 'none', top: ND.Turn.standings(g)[0].fid, exhausted, peakTaken, gone: (g.rosterGone || []).length };
};
let same = 0, diff = 0; const rows = [];
for (let s = 1; s <= 30; s++) {
  const a = run(false, s * 7), b = run(true, s * 7);
  if (a.h === b.h) same++; else diff++;
  rows.push(`seed ${s * 7}: ${a.h === b.h ? 'identical' : 'DIFFERENT'} | top ${a.top}/${b.top} | turn ${a.turn}/${b.turn} | merc taken peak ${b.peakTaken}/42, turns exhausted ${b.exhausted}, killed ${b.gone}`);
}
console.log(rows.join('\n')); console.log(`identical ${same}, different ${diff}`);
