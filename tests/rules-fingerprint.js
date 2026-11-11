// Usage: node tests/rules-fingerprint.js . | diff - tests/rules-fingerprint.baseline.txt   (no output = rules unchanged)
// Deterministic fingerprint of the rules: same seeds must give the same results before and after the UI redesign.
const fs=require('fs'),vm=require('vm');const dir=process.argv[2];global.window=global;
for(const f of ['rng','data','world','economy','actions','units','combat','tech','espionage','diplomacy','victory','market','ai','turn']) vm.runInThisContext(fs.readFileSync(dir+'/js/core/'+f+'.js','utf8'));
const out=[];
for(const seed of [11,22,33]){ const pl=ND.FACTIONS[seed%6].id; const g=ND.World.create(seed,pl);
  for(let t=0;t<60&&!g.over;t++){ ND.Diplo.aiTurn(g,pl); ND.Market.aiTrade(g,pl); ND.AI.research(g,pl); ND.AI.manageUnits(g,pl); ND.AI.espionage(g,pl); ND.AI.takeTurn(g,pl); ND.Turn.end(g); }
  const h=require('crypto').createHash('sha1').update(JSON.stringify(g)).digest('hex').slice(0,12);
  out.push(seed+':T'+g.turn+':'+ND.Turn.standings(g).map(s=>s.fid.slice(0,3)+s.districts).join(',')+':'+h); }
console.log(out.join('\n'));
