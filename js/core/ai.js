// Rival faction AI: scores every legal command with the faction's personality weights and executes the best ones.
(function (ND) {
  const RESERVE = 25;

  ND.AI = {
    takeTurn(g, fid) {
      let guard = 20;
      while (g.factions[fid].ops > 0 && guard-- > 0) {
        const best = ND.AI.bestMove(g, fid);
        if (!best) break;
        ND.Actions.exec(g, fid, best.key, best.d);
      }
    },
    bestMove(g, fid) {
      const f = g.factions[fid];
      const L = ND.Econ.ledger(g, fid);
      let best = null;
      for (const d of g.districts) {
        for (const key of ND.Actions.keys) {
          const c = ND.Actions.check(g, fid, key, d);
          if (!c.ok) continue;
          if (key !== 'consolidate' && f.res.credits - (c.cost.credits || 0) < RESERVE) continue;
          const s = ND.AI.score(g, fid, key, d, L) * (0.85 + ND.rand(g) * 0.3);
          if (s > 0 && (!best || s > best.s)) best = { key, d, s };
        }
      }
      return best;
    },
    score(g, fid, key, d, L) {
      const P = ND.FDEF[fid].ai, f = g.factions[fid];
      let val = ND.Econ.baseValue(d) * (P.prefer.includes(d.type) ? 1.5 : 1);
      // Starving for energy: power plants become urgent.
      if (d.type === 'power' && (L.net.energy < 0 || f.res.energy < 20)) val *= 2.2;
      const my = ND.Inf.get(d, fid), threat = ND.Inf.maxRival(d, fid);
      switch (key) {
        case 'campaign': {
          let s = val * P.expand * (1 + my / 40);
          // Rich factions turn on their neighbours once the easy ground is gone.
          const wealth = f.res.credits > 400 ? 1.6 : 1;
          if (d.owner) s *= P.aggression * wealth * (d.hq ? 0.5 : 0.75);
          if (ND.Inf.captureCandidate(d) === fid) s *= 0.3; // already winning it
          return s / (1 + d.security / 40);
        }
        case 'consolidate':
          if (my >= 85 && threat < 15) return 0;
          return (val * 0.4 + threat * 0.9 + Math.max(0, 70 - my) * 0.4) * P.consolidate * (d.hq ? 2 : 1);
        case 'bribe':
          if (d.security < 35) return 0;
          return (d.security / 12) * val * 0.25 * P.bribe * (my > 0 ? 1.3 : 1);
        case 'fortify':
          if (threat < 10 && !(d.hq && d.security < 75)) return 0;
          return (threat * 0.6 + (d.hq ? 12 : 0)) * P.fortify;
        case 'develop':
          if (f.res.credits < 180) return 0;
          return val * 0.7 * P.develop * (d.hq ? 1.3 : 1);
      }
      return 0;
    },

    // ---------- research ----------
    RESEARCH_BIAS: {
      syndicate: { military: 0.8, bio: 0.9, info: 1.4 }, legion: { military: 1.8, bio: 0.8, info: 0.7 },
      cult: { military: 0.7, bio: 0.7, info: 1.9 }, mutants: { military: 0.7, bio: 1.9, info: 0.7 },
      shadow: { military: 0.8, bio: 0.8, info: 1.6 }, reapers: { military: 1.4, bio: 1.1, info: 0.8 },
    },
    research(g, fid) {
      const f = g.factions[fid];
      if (f.tech.current) return;
      const bias = ND.AI.RESEARCH_BIAS[fid];
      let best = null;
      for (const id of ND.Tech.listFor(fid)) {
        if (!ND.Tech.canStart(g, fid, id).ok) continue;
        const t = ND.TECHS[id];
        if (f.res.credits - (t.cost.credits || 0) < 30) continue;
        const w = t.branch === 'faction' ? 2.5 : t.branch === 'ultimate' ? (g.victory.tech.on ? 10 : 0.5) : bias[t.branch];
        const s = (100 / t.rp) * w * (0.85 + ND.rand(g) * 0.3);
        if (!best || s > best.s) best = { id, s };
      }
      if (best) ND.Tech.start(g, fid, best.id);
    },

    // ---------- espionage: at most one covert operation per turn ----------
    espionage(g, fid) {
      const f = g.factions[fid], P = ND.FDEF[fid].ai, E = ND.Espionage;
      if (f.ops < 2 || f.res.intel < 25) return;
      let best = null;
      for (const d of g.districts) {
        if (d.owner === fid || !ND.Log.canSee(g, fid, d.id)) continue;
        for (const key of E.keys) {
          if (key === 'spy') continue;
          const c = E.check(g, fid, key, d);
          if (!c.ok || f.res.credits - (c.cost.credits || 0) < 120) continue;
          const pct = E.chance(g, fid, key, d).pct / 100;
          const v = d.owner ? g.factions[d.owner] : null;
          let s = 0;
          if (key === 'disrupt') s = Math.min(150, v.res.credits * 0.15) / 6;
          else if (key === 'opinion') s = ND.Inf.get(d, fid) >= 20 ? ND.Econ.baseValue(d) * 0.8 : 0;
          else if (key === 'sabotage') s = ND.Econ.baseValue(d) * 1.2 * P.aggression;
          else if (key === 'steal') s = 30;
          else if (key === 'plague') s = ND.Units.at(g, d.id).filter((u) => u.fid !== fid).length * 8 * P.aggression;
          else if (key === 'assassinate') s = pct >= 0.3 ? 45 * P.aggression : 0;
          s *= pct * P.bribe;
          if (s > 12 && (!best || s > best.s)) best = { key, d, s };
        }
      }
      if (best) E.exec(g, fid, best.key, best.d);
    },

    // ---------- personnel ----------
    manageUnits(g, fid) {
      ND.AI.recruit(g, fid);
      ND.AI.equip(g, fid);
      ND.AI.orders(g, fid);
    },
    recruit(g, fid) {
      const U = ND.Units, f = g.factions[fid], P = ND.FDEF[fid].ai;
      if (U.list(g, fid).length >= U.cap(g, fid) || f.res.credits < 100) return;
      const L = ND.Econ.ledger(g, fid);
      let best = null;
      f.market.forEach((c, i) => {
        const chk = U.canRecruit(g, fid, i);
        if (!chk.ok) return;
        const up = ND.UNIT_TYPES[c.type].upkeep;
        if (L.net.credits - (up.credits || 0) < 0 || L.net.energy - (up.energy || 0) < -1) return;
        if (f.res.credits - (chk.cost.credits || 0) < 40) return;
        const b = c.base;
        const s = (b.inf * 1.6 * P.expand + (b.atk + b.def) * 0.5 * P.aggression + b.def * 0.5 * P.fortify + b.int * 0.4 * P.bribe)
          / ((chk.cost.credits || 1) / 100) * (0.85 + ND.rand(g) * 0.3);
        if (!best || s > best.s) best = { i, s };
      });
      if (best) U.recruit(g, fid, best.i);
    },
    equip(g, fid) {
      const U = ND.Units, f = g.factions[fid];
      if (f.res.credits < 220) return;
      for (const u of U.list(g, fid)) {
        const slot = u.equip.findIndex((e) => !e);
        if (slot < 0) continue;
        const type = ND.UNIT_TYPES[u.type].slots[slot];
        let best = null;
        for (const [k, it] of Object.entries(ND.ITEMS)) {
          if (it.slot !== type || (it.cost.credits || 0) > f.res.credits - 150 || !U.canBuy(g, fid, k).ok) continue;
          const v = Object.values(it.bonus).reduce((a, b) => a + b, 0) + (it.special ? 1 : 0);
          if (!best || v > best.v) best = { k, v };
        }
        if (best) { U.buy(g, fid, best.k); U.equip(g, u, slot, best.k); return; }
      }
    },
    orders(g, fid) {
      const U = ND.Units, f = g.factions[fid], P = ND.FDEF[fid].ai;
      const claimed = {};
      const units = U.list(g, fid).filter((u) => !u.injured).sort((a, b) => U.stats(b).inf - U.stats(a).inf);
      for (const u of units) {
        let best = null;
        const dests = u.moved ? [u.loc] : [...U.reach(g, u)];
        for (const did of dests) {
          const d = g.districts[did];
          const crowd = Math.pow(0.55, claimed[did] || 0);
          for (const t of U.tasks(g, u, d)) {
            if (!t.ok) continue;
            const s = ND.AI.taskScore(g, u, d, t, P, f) * crowd * (did === u.loc ? 1.1 : 1) * (0.9 + ND.rand(g) * 0.2);
            if (s > 0 && (!best || s > best.s)) best = { d, t, s };
          }
        }
        if (!best) { u.task = { kind: 'rest' }; continue; }
        if (best.d.id !== u.loc) U.move(g, u, best.d.id);
        U.setTask(g, u, best.t);
        claimed[best.d.id] = (claimed[best.d.id] || 0) + 1;
      }
    },
    taskScore(g, u, d, t, P, f) {
      const U = ND.Units, fid = u.fid, s = U.stats(u);
      const my = ND.Inf.get(d, fid), threat = ND.Inf.maxRival(d, fid);
      const rivalsHere = U.at(g, d.id).filter((x) => x.fid !== fid).length;
      const val = ND.Econ.baseValue(d) * (P.prefer.includes(d.type) ? 1.5 : 1);
      switch (t.kind) {
        case 'canvass': {
          let gain = U.canvassGain(g, u, d) * (1 - U.crackdownRisk(g, u, d) / 100);
          // Enemy guards here will intercept: weigh the gain by the odds of surviving the fight.
          if (d.owner && d.owner !== fid) {
            const guards = U.at(g, d.id).filter((x) => x.fid === d.owner && !x.injured);
            if (guards.some((x) => x.task.kind === 'guard')) gain *= ND.Combat.estimate(g, d, [u], guards);
          }
          if (d.owner === fid) return (threat >= 15 || my < 60) ? gain * (threat + 10) / 25 * P.consolidate : 0;
          const near = ND.Inf.captureCandidate(d) === fid ? 0.4 : 1 + my / 50;
          return gain * val / 10 * P.expand * near * (d.owner ? P.aggression * 0.8 : 1);
        }
        case 'guard':
          return (threat * 0.4 + rivalsHere * 6 + (d.hq === fid ? 8 : 0)) * P.fortify * (s.def + s.atk / 2) / 8;
        case 'seize': return (U.opChance(g, u, d, t.fac, 'seize') / 100) * 22 * (d.facilities[t.fac].owner ? P.aggression : 1);
        case 'sabotage': return (U.opChance(g, u, d, t.fac, 'sabotage') / 100) * 16 * P.aggression;
        case 'intel': return s.int * (f.res.intel < 30 ? 1.6 : 0.6);
        case 'attack': {
          const foes = U.at(g, d.id).filter((x) => x.fid === t.target && !x.injured).length;
          if (!foes) return d.owner === t.target ? val * 0.35 * P.aggression : 0; // raid
          if (t.p < 60) return 0;
          return (foes * 7 + (d.owner === t.target ? 8 : 0) + (d.owner === fid ? 10 : 0)) * P.aggression * (t.p / 100);
        }
        case 'train': return f.res.credits > 450 ? 5 : 0;
        case 'rest': return 0.5;
      }
      return 0;
    },
  };
})(window.ND);
