// Turn engine. The player issues commands (step 4) during their turn; end() runs steps 5–9 and then 1–3 of the next turn.
(function (ND) {
  const R = ND.RULES;
  const fn = (fid) => ND.FDEF[fid].name;

  ND.Turn = {
    end(g) {
      if (g.over) return null;
      const p = g.player;

      // 5. Execute faction actions
      for (const fid of g.order) {
        if (fid !== p && g.factions[fid].alive) {
          ND.Diplo.aiTurn(g, fid);
          ND.Market.aiTrade(g, fid);
          ND.AI.research(g, fid);
          ND.AI.manageUnits(g, fid);
          ND.AI.espionage(g, fid);
          ND.AI.takeTurn(g, fid);
        }
      }
      // 6. Resolve conflicts: unit orders, then security crackdowns on outside influence
      ND.Units.resolve(g);
      ND.Turn.resolveConflicts(g);
      // 7. Update district influence and control
      ND.Turn.updateInfluence(g);
      ND.Turn.updateControl(g);
      // 8. Update faction standings, eliminations, victory
      ND.Turn.updateStandings(g);
      ND.Diplo.update(g);
      ND.Victory.check(g);

      const closed = g.current;
      g.history.unshift(closed);
      if (g.history.length > 40) g.history.pop();

      // 9. Begin next turn → 1. collect income, 2. pay maintenance, 3. intelligence report
      g.turn++;
      g.current = { turn: g.turn, entries: [] };
      let ledger = null, unrest = null;
      if (!g.over) {
        for (const fid of g.order) {
          const f = g.factions[fid];
          if (!f.alive) continue;
          const res = ND.Turn.applyEconomy(g, fid);
          if (fid === p) { ledger = res.ledger; unrest = res.shortfall; }
          ND.Tech.progress(g, fid);
          if (f.leaderless > 0) {
            f.leaderless--;
            if (!f.leaderless) ND.Log.add(g, { cat: 'control', who: fid, public: true, text: `${ND.FDEF[fid].name} has a new leader; operations resume.` });
          }
          for (const k in f.spied) if (f.spied[k] < g.turn) delete f.spied[k];
          f.ops = ND.Actions.maxOps(g, fid);
          ND.Units.newTurn(g, fid);
        }
        // Sabotaged districts come back online after their downtime (counted in income collections).
        for (const d of g.districts) if (d.disrupted > 0) d.disrupted--;
      }
      g.lastReport = {
        turn: g.turn,
        ledger, unrest,
        stock: { ...g.factions[p].res },
        events: closed.entries.filter((e) => e.seen && !(e.who === p && e.cat === 'op')),
        battles: g.battles.filter((b) => b.turn === closed.turn && ND.Combat.visibleTo(g, b, p)).map((b) => b.id),
        standings: ND.Turn.standings(g),
      };
      return g.lastReport;
    },

    applyEconomy(g, fid) {
      const f = g.factions[fid];
      const L = ND.Econ.ledger(g, fid);
      for (const r of ND.RES) f.res[r] += L.net[r];
      const shortfall = ND.RES.filter((r) => f.res[r] < 0);
      if (shortfall.length) {
        for (const r of shortfall) f.res[r] = 0;
        let hit = 0;
        for (const d of g.districts) {
          if (d.owner === fid && d.hq !== fid) { ND.Inf.sub(d, fid, R.unrestLoss); hit++; }
        }
        ND.Log.add(g, { cat: 'alert', who: fid, text: `${fn(fid)} could not pay upkeep (${shortfall.map((r) => ND.RES_LABEL[r]).join(', ')}). Unrest: −${R.unrestLoss}% influence in ${hit} districts.` });
        if (shortfall.includes('credits')) ND.Units.desert(g, fid);
      }
      f.lastLedger = L;
      return { ledger: L, shortfall: shortfall.length ? shortfall : null };
    },

    resolveConflicts(g) {
      const p = g.player;
      let pLoss = 0, pDist = 0;
      for (const d of g.districts) {
        const base = d.owner ? Math.floor(d.security / 25) : Math.floor(d.security / 30);
        const guards = d.owner ? Math.floor(ND.Units.guardPower(g, d.id, d.owner) / 8) : 0;
        if (base + guards <= 0) continue;
        for (const fid of Object.keys(d.inf)) {
          if (fid === d.owner) continue;
          const lost = ND.Inf.sub(d, fid, base + guards);
          if (fid === p && lost) { pLoss += lost; pDist++; }
        }
      }
      if (pLoss) ND.Log.add(g, { cat: 'conflict', who: p, public: true, text: `Security crackdowns cost you ${pLoss}% influence across ${pDist} district${pDist > 1 ? 's' : ''}.` });
      for (const d of g.districts) {
        if (ND.Inf.contested(d)) {
          const sides = ND.Inf.ranked(d).filter((e) => e[1] >= 20).map((e) => `${ND.FDEF[e[0]].short} ${e[1]}%`).join(' vs ');
          ND.Log.add(g, { cat: 'conflict', d: d.id, text: `Turf war in ${d.name} [${ND.World.sector(d)}]: ${sides}.` });
        }
      }
    },

    updateInfluence(g) {
      for (const d of g.districts) {
        if (d.owner) {
          const M = ND.FDEF[d.owner].mods;
          const drift = (d.hq === d.owner ? R.driftHQ : R.driftOwned) + (M.drift || 0) + (ND.Tech.has(g, d.owner, 'hiveGenome') ? 2 : 0);
          if (drift > 0) ND.Inf.addNeutral(d, d.owner, drift);
        }
        // Each held facility is a foothold: +1 influence per turn for its holder.
        for (const fc of d.facilities) if (fc.owner) ND.Inf.addNeutral(d, fc.owner, 1);
        if (!d.owner) {
          for (const fid of Object.keys(d.inf)) {
            if (!ND.World.reachable(g, fid, d)) ND.Inf.sub(d, fid, R.lostContactFade);
          }
        }
        if (d.security < d.baseSec) d.security = Math.min(d.baseSec, d.security + R.securityDrift);
        else if (d.security > d.baseSec) d.security = Math.max(d.baseSec, d.security - R.securityDrift);
      }
    },

    updateControl(g) {
      // Decide all changes against the same snapshot, then apply.
      const changes = [];
      for (const d of g.districts) {
        const cand = ND.Inf.captureCandidate(d);
        if (cand && cand !== d.owner) changes.push([d, cand]);
        else if (d.owner && ND.Inf.get(d, d.owner) < R.holdMin && cand !== d.owner) changes.push([d, null]);
      }
      for (const [d, to] of changes) {
        const from = d.owner;
        d.owner = to;
        const involvesPlayer = from === g.player || to === g.player;
        if (to) {
          g.factions[to].captured++;
          if (from) ND.Diplo.incident(g, to, from, -6);
          ND.Log.add(g, { cat: 'control', who: to, d: d.id, public: involvesPlayer,
            text: `${fn(to)} seized ${d.name} [${ND.World.sector(d)}]${from ? ` from ${fn(from)}` : ''}.` });
        } else {
          ND.Log.add(g, { cat: 'control', who: from, d: d.id, public: involvesPlayer,
            text: `${fn(from)} lost its grip on ${d.name} [${ND.World.sector(d)}]; the district is unaligned.` });
        }
        if (from) {
          g.factions[from].lost++;
          if (d.hq === from) ND.Turn.loseHQ(g, from, d, to);
        }
      }
    },

    loseHQ(g, fid, d, captor) {
      const f = g.factions[fid];
      d.hq = null;
      f.hq = null;
      if (captor) {
        const loot = Math.floor(f.res.credits * 0.3);
        f.res.credits -= loot;
        g.factions[captor].res.credits += loot;
        ND.Log.add(g, { cat: 'control', who: captor, d: d.id, public: true, text: `${fn(captor)} sacked the ${fn(fid)} headquarters and looted ${loot} credits.` });
      }
      const candidates = ND.World.owned(g, fid).sort((a, b) => ND.Inf.get(b, fid) - ND.Inf.get(a, fid));
      if (candidates.length) {
        const n = candidates[0];
        n.hq = fid; f.hq = n.id;
        n.security = Math.min(95, n.security + 10);
        ND.Log.add(g, { cat: 'control', who: fid, d: n.id, public: true, text: `${fn(fid)} relocated its headquarters to ${n.name} [${ND.World.sector(n)}].` });
      }
    },

    updateStandings(g) {
      for (const fid of g.order) {
        const f = g.factions[fid];
        if (!f.alive) continue;
        if (ND.World.owned(g, fid).length === 0) {
          f.alive = false;
          f.eliminatedTurn = g.turn;
          f.ops = 0;
          for (const d of g.districts) delete d.inf[fid];
          ND.Units.removeFaction(g, fid);
          ND.Log.add(g, { cat: 'control', who: fid, public: true, text: `${fn(fid)} has been wiped off the map.` });
        }
      }
    },

    standings(g) {
      return g.order.map((fid) => {
        const f = g.factions[fid];
        const districts = ND.World.owned(g, fid).length;
        let influence = 0;
        for (const d of g.districts) influence += ND.Inf.get(d, fid);
        const wealth = f.res.credits + 2 * (f.res.energy + f.res.materials) + 3 * f.res.intel;
        const units = ND.Units.list(g, fid);
        const score = f.alive ? districts * 10 + Math.floor(influence / 10) + Math.floor(wealth / 50) + units.reduce((s, u) => s + 2 + u.level, 0) : 0;
        return { fid, alive: f.alive, districts, influence, units: units.length, score };
      }).sort((a, b) => b.score - a.score);
    },
  };
})(window.ND);
