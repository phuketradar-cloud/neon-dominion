// Victory conditions. Each can be switched on/off and tuned when starting a game; any faction can win any of them.
(function (ND) {
  ND.VICTORY_DEFAULTS = {
    territorial: { on: true, share: 50 },          // control this % of districts
    domination: { on: true },                      // eliminate every rival
    economic: { on: true, target: 15000 },          // hold this many credits
    tech: { on: true },                            // complete the Singularity Protocol
    political: { on: true, districts: 60, min: 20 }, // hold >= min% influence in this many districts
  };

  ND.VICTORY_INFO = {
    territorial: { name: 'Territorial Supremacy', desc: (v) => `Control ${v.share}% of the city's districts.` },
    domination: { name: 'Total Domination', desc: () => 'Eliminate every rival faction.' },
    economic: { name: 'Economic Supremacy', desc: (v) => `Have ${v.target} credits in the treasury when a turn ends.` },
    tech: { name: 'Technological Supremacy', desc: () => 'Complete the Singularity Protocol (needs every branch technology).' },
    political: { name: 'Political Supremacy', desc: (v) => `Hold at least ${v.min}% influence in ${v.districts} districts.` },
  };

  const V = (ND.Victory = {
    ensure(g) {
      if (!g.victory) g.victory = JSON.parse(JSON.stringify(ND.VICTORY_DEFAULTS));
      for (const k in ND.VICTORY_DEFAULTS) if (!g.victory[k]) g.victory[k] = { ...ND.VICTORY_DEFAULTS[k], on: false };
    },

    // Progress toward each enabled condition, as { value, need, pct }.
    progress(g, fid) {
      const v = g.victory, f = g.factions[fid], out = {};
      if (v.territorial.on) {
        const need = Math.ceil(g.districts.length * v.territorial.share / 100);
        const value = ND.World.owned(g, fid).length;
        out.territorial = { value, need, pct: value / need };
      }
      if (v.domination.on) {
        const rivals = g.order.filter((x) => x !== fid);
        const dead = rivals.filter((x) => !g.factions[x].alive).length;
        out.domination = { value: dead, need: rivals.length, pct: dead / rivals.length };
      }
      if (v.economic.on) out.economic = { value: f.res.credits, need: v.economic.target, pct: f.res.credits / v.economic.target };
      if (v.tech.on) {
        const ids = ND.Tech.branchIds();
        const done = ids.filter((id) => ND.Tech.has(g, fid, id)).length + (ND.Tech.has(g, fid, 'singularity') ? 1 : 0);
        out.tech = { value: done, need: ids.length + 1, pct: done / (ids.length + 1) };
      }
      if (v.political.on) {
        const value = g.districts.filter((d) => ND.Inf.get(d, fid) >= v.political.min).length;
        out.political = { value, need: v.political.districts, pct: value / v.political.districts };
      }
      return out;
    },

    // Called after standings update. Player victory, or defeat if a rival wins first.
    check(g) {
      const p = g.player;
      if (!g.factions[p].alive) {
        g.over = { result: 'defeat', type: 'Eliminated', turn: g.turn, text: 'Your last district has fallen. Your empire is finished.' };
        return;
      }
      // The player is checked first, so a simultaneous win goes to the player.
      for (const fid of [p, ...g.order.filter((x) => x !== p)]) {
        if (!g.factions[fid].alive) continue;
        const pr = V.progress(g, fid);
        const won = Object.keys(pr).find((k) => pr[k].value >= pr[k].need);
        if (!won) continue;
        const info = ND.VICTORY_INFO[won];
        const detail = `${info.desc(g.victory[won])} (${pr[won].value}/${pr[won].need})`;
        g.over = fid === p
          ? { result: 'victory', type: info.name, turn: g.turn, text: `You achieved ${info.name}: ${detail}` }
          : { result: 'defeat', type: `${ND.FDEF[fid].name}: ${info.name}`, turn: g.turn, winner: fid, text: `${ND.FDEF[fid].name} achieved ${info.name}: ${detail}` };
        return;
      }
    },
  });
})(window.ND);
