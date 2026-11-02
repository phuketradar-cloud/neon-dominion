// District commands. Player and AI both go through check()/exec(), so the rules are identical for everyone.
(function (ND) {
  const R = ND.RULES;
  const mods = (fid) => ND.FDEF[fid].mods;

  function campaignBase(g, fid, d) {
    const M = mods(fid);
    let base = 12 + (M.campaignGain || 0) - Math.floor(d.security / 10) + (ND.Tech.has(g, fid, 'digitalManip') ? 4 : 0);
    if (d.owner && d.owner !== fid) {
      base += M.rivalCampaign || 0;
      if (ND.Inf.get(d, d.owner) >= 70) base -= 4; // entrenched owner
      base -= Math.floor(ND.Units.hostileGuard(g, d, fid) / 3); // owner's units on guard
    }
    return Math.max(3, base);
  }

  const defs = {
    campaign: {
      label: 'Influence Campaign', hotkey: '1',
      desc: 'Street teams, propaganda and payoffs. Gain is reduced by district security and by the owner\'s guards. Taken from unaligned citizens first, then from the strongest rival.',
      valid(g, fid, d) {
        if (d.owner === fid) return 'You already control this district — use Consolidate.';
        if (!ND.World.reachable(g, fid, d)) return 'Target must border a district you control.';
        if (d.owner && ND.Diplo.pact(g, fid, d.owner)) return `Non-aggression pact with ${ND.FDEF[d.owner].name}.`;
        if (ND.Inf.get(d, fid) >= 100) return 'Influence already at maximum.';
        return null;
      },
      cost(g, fid, d) {
        const c = { credits: Math.round((20 + Math.floor(d.security / 2)) * (mods(fid).campaignCost || 1)) };
        if (d.security >= 50) c.intel = 3;
        return c;
      },
      preview(g, fid, d) { const b = campaignBase(g, fid, d); return `+${b}–${b + 10}% influence`; },
      run(g, fid, d) {
        const got = ND.Inf.add(d, fid, campaignBase(g, fid, d) + ND.randInt(g, 0, 10));
        return `ran an influence campaign in ${d.name} (+${got}%)`;
      },
    },
    consolidate: {
      label: 'Consolidate', hotkey: '2',
      desc: 'Patrols, protection rackets and handouts in a district you control. Pushes rival influence out.',
      valid(g, fid, d) {
        if (d.owner !== fid) return 'Only possible in districts you control.';
        if (ND.Inf.get(d, fid) >= 100) return 'Already at 100% influence.';
        return null;
      },
      cost(g, fid, d) { return { credits: 15 + d.dev * 5 }; },
      preview() { return '+10–15% influence'; },
      run(g, fid, d) {
        const got = ND.Inf.add(d, fid, 10 + ND.randInt(g, 0, 5));
        return `consolidated its hold on ${d.name} (+${got}%)`;
      },
    },
    bribe: {
      label: 'Bribe Officials', hotkey: '3',
      desc: 'Pay off precinct captains and inspectors to lower security. Security slowly recovers toward its base level.',
      valid(g, fid, d) {
        if (d.owner === fid) return 'No need to bribe your own district.';
        if (!ND.World.reachable(g, fid, d)) return 'Target must border a district you control.';
        if (d.owner && ND.Diplo.pact(g, fid, d.owner)) return `Non-aggression pact with ${ND.FDEF[d.owner].name}.`;
        if (d.security <= 5) return 'Security is already minimal.';
        return null;
      },
      cost(g, fid) { return { credits: Math.round(45 * (mods(fid).bribeCost || 1)), intel: 4 }; },
      preview(g, fid) { return `−${mods(fid).bribeAmt || 12} security`; },
      run(g, fid, d) {
        const before = d.security;
        d.security = Math.max(5, d.security - (mods(fid).bribeAmt || 12));
        return `bribed officials in ${d.name} (security ${before}→${d.security})`;
      },
    },
    fortify: {
      label: 'Fortify', hotkey: '4',
      desc: 'Barricades, turrets and checkpoints. Raises security now and permanently raises base security by 5. High security makes rival campaigns weaker and triggers crackdowns on outsiders.',
      valid(g, fid, d) {
        if (d.owner !== fid) return 'Only possible in districts you control.';
        if (d.security >= 95) return 'Security already at maximum.';
        return null;
      },
      cost(g, fid) { const m = mods(fid).fortifyCost || 1; return { materials: Math.round(30 * m), energy: Math.round(12 * m) }; },
      preview(g, fid) { return `+${mods(fid).fortifyAmt || 15} security`; },
      run(g, fid, d) {
        d.security = Math.min(95, d.security + (mods(fid).fortifyAmt || 15));
        d.baseSec = Math.min(90, d.baseSec + 5);
        return `fortified ${d.name} (security ${d.security})`;
      },
    },
    develop: {
      label: 'Develop District', hotkey: '5',
      desc: 'Invest in infrastructure. Level 2 yields ×1.5, level 3 yields ×2.',
      valid(g, fid, d) {
        if (d.owner !== fid) return 'Only possible in districts you control.';
        if (d.dev >= 3) return 'Already fully developed.';
        return null;
      },
      cost(g, fid, d) {
        const m = mods(fid).developCost || 1;
        return { credits: Math.round(80 * d.dev * m), materials: Math.round(25 * d.dev * m) };
      },
      preview(g, fid, d) { return d.dev < 3 ? `Level ${d.dev}→${d.dev + 1}` : 'Max level'; },
      run(g, fid, d) { d.dev++; return `developed ${d.name} to level ${d.dev}`; },
    },
  };

  ND.Actions = {
    defs,
    keys: Object.keys(defs),
    maxOps(g, fid) {
      let n = Math.min(R.maxOps, R.baseOps + Math.floor(ND.World.owned(g, fid).length / R.opsPerDistricts));
      if (ND.Tech.has(g, fid, 'aiIntel')) n++;
      if (g.factions[fid].leaderless > 0) n -= 2;
      return Math.max(1, n);
    },
    check(g, fid, key, d) {
      const def = defs[key], f = g.factions[fid];
      const cost = def.cost(g, fid, d);
      if (g.over) return { ok: false, reason: 'The game is over.', cost };
      if (!f.alive) return { ok: false, reason: 'Faction eliminated.', cost };
      const v = def.valid(g, fid, d);
      if (v) return { ok: false, reason: v, cost };
      if (f.ops < 1) return { ok: false, reason: 'No operation points left this turn.', cost };
      for (const r of ND.RES) {
        if ((cost[r] || 0) > f.res[r]) return { ok: false, reason: `Not enough ${ND.RES_LABEL[r]} (need ${cost[r]}, have ${f.res[r]}).`, cost };
      }
      return { ok: true, cost };
    },
    exec(g, fid, key, d) {
      const c = ND.Actions.check(g, fid, key, d);
      if (!c.ok) return c;
      const f = g.factions[fid];
      for (const r of ND.RES) f.res[r] -= c.cost[r] || 0;
      f.ops--;
      const what = defs[key].run(g, fid, d);
      ND.Log.add(g, { cat: 'op', who: fid, d: d.id, text: `${ND.FDEF[fid].name} ${what}.` });
      return { ok: true, msg: what };
    },
  };
})(window.ND);
