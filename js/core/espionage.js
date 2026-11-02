// Special operations: covert actions against districts and rival factions, with success odds and consequences.
(function (ND) {
  const fname = (fid) => ND.FDEF[fid].name;
  const COVERT = ['agent', 'hacker', 'assassin'];
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  // Each op: base chance, cost, OPS, validity check, and what success does. All district-targeted.
  const OPS = {
    spy: { label: 'Spy on District', base: 80, ops: 1, cost: { intel: 6 }, secDiv: 4,
      desc: 'Plant informants: full visibility of the district for 3 turns, and the owner\'s exact treasury.',
      valid(g, fid, d) {
        if (d.owner === fid) return 'You already see your own districts.';
        return ND.World.distToFaction(g, fid, d) <= 3 || ND.Units.list(g, fid).some((u) => dist(g.districts[u.loc], d) <= 2) ? null : 'Too far: must be within 3 districts of your territory or 2 of one of your units.';
      },
      run(g, fid, d) {
        const f = g.factions[fid];
        f.spied[d.id] = g.turn + 3;
        if (d.owner) f.spiedFaction[d.owner] = g.turn + 3;
        return `planted informants in ${d.name}`;
      } },
    opinion: { label: 'Manipulate Public Opinion', base: 65, ops: 1, cost: { credits: 60, intel: 10 }, secDiv: 4,
      desc: 'Fake news, viral smears and staged riots: you gain influence and the controller loses some.',
      valid(g, fid, d) { return ND.Inf.get(d, fid) >= 100 ? 'You already have total influence.' : null; },
      run(g, fid, d) {
        const got = ND.Inf.add(d, fid, 12 + (ND.Tech.has(g, fid, 'digitalManip') ? 6 : 0));
        const lost = d.owner && d.owner !== fid ? ND.Inf.sub(d, d.owner, 6) : 0;
        return `swung public opinion in ${d.name} (+${got}% for you${lost ? `, −${lost}% for ${fname(d.owner)}` : ''})`;
      } },
    disrupt: { label: 'Disrupt Income', base: 50, ops: 1, cost: { intel: 20 }, secDiv: 5, hack: true,
      desc: 'Hack the owner\'s accounts and siphon 15% of its credits (max 150) into yours.',
      valid(g, fid, d) { return !d.owner || d.owner === fid ? 'Target a district held by a rival.' : null; },
      run(g, fid, d) {
        const v = g.factions[d.owner];
        const take = Math.min(150, Math.floor(v.res.credits * 0.15));
        v.res.credits -= take;
        g.factions[fid].res.credits += take;
        return `siphoned ${take} credits from ${fname(d.owner)}`;
      } },
    sabotage: { label: 'Sabotage Factory', base: 50, ops: 1, cost: { credits: 80, intel: 15 }, secDiv: 3, hack: true,
      desc: 'Wreck an industrial, power, research or military district: it produces nothing for its owner for 3 turns and loses 10 security.',
      valid(g, fid, d) {
        if (!d.owner || d.owner === fid) return 'Target a district held by a rival.';
        if (!['industrial', 'power', 'research', 'military'].includes(d.type)) return 'Only industrial, power, research or military districts.';
        return d.disrupted > 0 ? 'Already disrupted.' : null;
      },
      run(g, fid, d) {
        d.disrupted = 3;
        d.security = Math.max(5, d.security - 10);
        return `sabotaged production in ${d.name} (offline 3 turns)`;
      } },
    steal: { label: 'Steal Technology', base: 35, ops: 1, cost: { credits: 100, intel: 40 }, secDiv: 2, hack: true, risky: true,
      desc: 'Raid the owner\'s labs and copy one technology it has that you lack (signature techs cannot be stolen).',
      valid(g, fid, d) {
        if (!d.owner || d.owner === fid) return 'Target a district held by a rival.';
        return ESP.stealable(g, fid, d.owner).length ? null : `${fname(d.owner)} has nothing you can steal.`;
      },
      run(g, fid, d) {
        const id = ND.pick(g, ESP.stealable(g, fid, d.owner));
        ND.Tech.grant(g, fid, id);
        return `stole ${ND.TECHS[id].name} from ${fname(d.owner)}`;
      } },
    plague: { label: 'Plague Release', base: 45, ops: 1, cost: { credits: 120, materials: 30, intel: 25 }, secDiv: 3, risky: true, tech: 'bioWarfare',
      desc: 'Release an engineered pathogen: every unit in the district is wounded for 2–3 turns, population −15%, controller −10% influence.',
      valid(g, fid, d) { return d.owner === fid ? 'Not in your own district.' : null; },
      run(g, fid, d) {
        let n = 0;
        for (const u of ND.Units.at(g, d.id)) { ND.Units.injure(g, u, ND.randInt(g, 2, 3), `by a plague in ${d.name}`); n++; }
        d.pop = Math.max(1, Math.round(d.pop * 0.85));
        if (d.owner) ND.Inf.sub(d, d.owner, 10);
        return `released a plague in ${d.name} (${n} units struck down)`;
      } },
    assassinate: { label: 'Assassinate Leader', base: 15, ops: 2, cost: { credits: 250, intel: 60 }, secDiv: 4, risky: true, deadly: true,
      desc: 'Strike at a rival leader in their HQ. Success leaves the faction leaderless for 3 turns: −2 OPS, no recruiting, research frozen.',
      valid(g, fid, d) {
        if (!d.hq || d.hq === fid) return 'Target a rival headquarters.';
        return g.factions[d.hq].leaderless > 0 ? 'That faction is already leaderless.' : null;
      },
      run(g, fid, d) {
        const v = g.factions[d.hq];
        v.leaderless = 3;
        v.ops = Math.max(0, v.ops - 2);
        return `assassinated ${ND.FDEF[d.hq].leader} of ${fname(d.hq)}`;
      } },
  };

  const ESP = (ND.Espionage = {
    OPS,
    keys: Object.keys(OPS),
    victim(d) { return d.hq || d.owner; },
    stealable(g, fid, target) {
      return g.factions[target].tech.done.filter((id) => !ND.TECHS[id].faction && ND.TECHS[id].branch !== 'ultimate' && !ND.Tech.has(g, fid, id));
    },
    covertNear(g, fid, d) {
      return ND.Units.list(g, fid).filter((u) => !u.injured && COVERT.includes(u.type) && dist(g.districts[u.loc], d) <= 1);
    },
    // Success chance with a breakdown the UI can show.
    chance(g, fid, key, d) {
      const op = OPS[key], parts = [['base', op.base]];
      parts.push(['security', -Math.floor(d.security / op.secDiv)]);
      const near = Math.min(3, ESP.covertNear(g, fid, d).length);
      if (near) parts.push(['operatives nearby', near * 10]);
      if (ND.Tech.has(g, fid, 'ghostAI')) parts.push(['Ghost Protocol AI', 15]);
      if (op.hack && ND.Tech.has(g, fid, 'advHacking')) parts.push(['Advanced Hacking', 10]);
      const v = ESP.victim(d);
      if (v && v !== fid) {
        if (ND.Tech.has(g, v, 'surveillance')) parts.push(['target surveillance', -10]);
        if (ND.FDEF[v].mods.panopticon) parts.push(['Panopticon', -10]);
      }
      if (key === 'assassinate') {
        const guards = ND.Units.at(g, d.id).filter((u) => u.fid === d.hq && !u.injured).length;
        if (guards) parts.push(['bodyguards', -5 * guards]);
      }
      const total = parts.reduce((s, p) => s + p[1], 0);
      return { pct: Math.max(5, Math.min(95, total)), parts };
    },
    check(g, fid, key, d) {
      const op = OPS[key], f = g.factions[fid];
      const cost = op.cost;
      if (g.over || !f.alive) return { ok: false, reason: 'Unavailable.', cost };
      if (op.tech && !ND.Tech.has(g, fid, op.tech)) return { ok: false, reason: `Requires ${ND.TECHS[op.tech].name}.`, cost };
      const v = op.valid(g, fid, d);
      if (v) return { ok: false, reason: v, cost };
      const victim = ESP.victim(d);
      if (key !== 'spy' && victim && ND.Diplo.pact(g, fid, victim)) return { ok: false, reason: `Non-aggression pact with ${fname(victim)}.`, cost };
      if (key !== 'spy' && !ND.Log.canSee(g, fid, d.id)) return { ok: false, reason: 'No eyes on this district — spy on it or move units nearby first.', cost };
      if (f.ops < op.ops) return { ok: false, reason: `Needs ${op.ops} operation point${op.ops > 1 ? 's' : ''}.`, cost };
      for (const r of ND.RES) if ((cost[r] || 0) > f.res[r]) return { ok: false, reason: `Not enough ${ND.RES_LABEL[r]} (need ${cost[r]}).`, cost };
      return { ok: true, cost };
    },
    exec(g, fid, key, d) {
      const c = ESP.check(g, fid, key, d);
      if (!c.ok) return c;
      const op = OPS[key], f = g.factions[fid];
      for (const r of ND.RES) f.res[r] -= c.cost[r] || 0;
      f.ops -= op.ops;
      const { pct } = ESP.chance(g, fid, key, d);
      const v = ESP.victim(d);
      const p = g.player;
      if (ND.rand(g) * 100 < pct) {
        const what = op.run(g, fid, d);
        // Victims learn they were hit, but not by whom (unless they run the Panopticon).
        const vText = v && !ND.FDEF[v].mods.panopticon ? `Unknown operatives ${what.replace(/ from [^(]+$/, '')}.` : `${fname(fid)} ${what}.`;
        if (v && ND.FDEF[v].mods.panopticon) ND.Diplo.incident(g, fid, v, -10); // the Panopticon knows who did it
        ND.Log.add(g, { cat: 'spy', who: fid, d: d.id, public: v === p,
          text: fid === p || v !== p ? `${fname(fid)} ${what}.` : vText });
        return { ok: true, success: true, pct, msg: what };
      }
      // Failure: the target is alerted and the culprit exposed; operatives nearby may pay for it.
      const losses = [];
      if (key !== 'spy') d.security = Math.min(95, d.security + 10);
      if (v && v !== fid) ND.Diplo.incident(g, fid, v, -15); // exposed
      if (op.risky) {
        for (const u of ESP.covertNear(g, fid, d)) {
          if (op.deadly && ND.rand(g) < 0.5) { ND.Units.kill(g, u, `caught and executed after the failed plot in ${d.name}`); losses.push(`${u.name} executed`); break; }
          if (ND.rand(g) < 0.3) { ND.Units.injure(g, u, 2, `escaping a blown operation in ${d.name}`); losses.push(`${u.name} wounded`); }
        }
      }
      ND.Log.add(g, { cat: 'spy', who: fid, d: d.id, public: v === p || fid === p,
        text: `${fname(fid)} was caught attempting ${op.label} in ${d.name} (${pct}% chance)${key !== 'spy' ? '; security there is on alert (+10)' : ''}${losses.length ? ` — ${losses.join(', ')}` : ''}.` });
      return { ok: true, success: false, pct, msg: `${op.label} failed` };
    },
  });
})(window.ND);
