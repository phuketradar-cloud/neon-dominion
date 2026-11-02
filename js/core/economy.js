// Economy: district yields, skimming from partial influence, upkeep and the per-turn ledger.
(function (ND) {
  const R = ND.RULES;
  const zero = () => ({ credits: 0, energy: 0, materials: 0, intel: 0 });
  ND.DIFFICULTY = {
    easy: { label: 'Easy', aiIncome: 0.8, desc: 'Rival factions earn 20% less income.' },
    normal: { label: 'Normal', aiIncome: 1, desc: 'Everyone plays by the same numbers.' },
    hard: { label: 'Hard', aiIncome: 1.25, desc: 'Rival factions earn 25% more income.' },
  };

  ND.Econ = {
    zero,
    // Raw value of a district's base yields, used for map overlays and AI scoring.
    baseValue(d) {
      const y = ND.TYPES[d.type].yields;
      return (y.credits || 0) + 1.5 * ((y.energy || 0) + (y.materials || 0)) + 2 * (y.intel || 0);
    },
    // What a district produces for `fid` if `fid` controls it.
    yieldFor(g, fid, d) {
      const T = ND.TYPES[d.type], M = ND.FDEF[fid].mods, out = zero();
      if (d.disrupted > 0 && d.hq !== fid) return out; // sabotaged: offline
      const dm = R.devMult[d.dev - 1];
      for (const r of ND.RES) {
        let v = (T.yields[r] || 0) * dm * ((M.yield && M.yield[r]) || 1);
        if (r === 'credits' && M.typeYield && M.typeYield[d.type]) v *= M.typeYield[d.type];
        out[r] = Math.round(v);
      }
      if (d.hq === fid) for (const r of ND.RES) out[r] += R.hqYield[r];
      return out;
    },
    skimFor(d) {
      return Math.floor((ND.TYPES[d.type].yields.credits || 0) * R.devMult[d.dev - 1] * R.skimRate);
    },
    upkeepFor(g, fid, d) {
      if (d.hq === fid) return zero();
      const u = zero();
      u.credits = R.upkeep.credits - (ND.Tech.has(g, fid, 'shellCorps') ? 1 : 0);
      u.energy = R.upkeep.energy + (ND.FDEF[fid].mods.upkeepEnergy || 0);
      return u;
    },
    // Projected income, expenses and net for the coming collection.
    ledger(g, fid) {
      const L = { income: zero(), upkeep: zero(), net: zero(), skim: 0, skimDistricts: 0, districts: 0,
        distUpkeep: zero(), payroll: ND.Units.payroll(g, fid), facIncome: zero(), facilities: 0 };
      for (const d of g.districts) {
        for (const fc of d.facilities) {
          if (fc.owner !== fid) continue;
          L.facilities++;
          const y = ND.FAC_YIELD[d.type] || {};
          for (const r in y) { L.facIncome[r] += y[r]; L.income[r] += y[r]; }
        }
        if (d.owner === fid) {
          L.districts++;
          const y = ND.Econ.yieldFor(g, fid, d), u = ND.Econ.upkeepFor(g, fid, d);
          for (const r of ND.RES) { L.income[r] += y[r]; L.distUpkeep[r] += u[r]; }
        } else if (ND.Inf.get(d, fid) >= R.skimMin) {
          const s = ND.Econ.skimFor(d);
          if (s > 0) { L.skim += s; L.skimDistricts++; L.income.credits += s; }
        }
      }
      for (const r of ND.RES) {
        // Difficulty scales rival income only.
        if (fid !== g.player) L.income[r] = Math.round(L.income[r] * (ND.DIFFICULTY[g.difficulty] || ND.DIFFICULTY.normal).aiIncome);
        L.upkeep[r] = L.distUpkeep[r] + L.payroll[r];
        L.net[r] = L.income[r] - L.upkeep[r];
      }
      return L;
    },
  };
})(window.ND);
