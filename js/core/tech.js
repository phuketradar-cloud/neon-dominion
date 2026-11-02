// Technology tree: three research branches plus one signature technology per faction.
// Every effect listed here is applied by the rule module named in its `hook` comment.
(function (ND) {
  ND.BRANCHES = { military: 'Military', bio: 'Biological', info: 'Information', faction: 'Signature', ultimate: 'Ultimate' };

  ND.TECHS = {
    // MILITARY
    advWeapons: { branch: 'military', name: 'Advanced Weapons', rp: 8, cost: { credits: 60, materials: 60 }, req: [],
      effect: '+1 ATK for all your units in battle.' }, // combat
    combatArmor: { branch: 'military', name: 'Combat Armor', rp: 8, cost: { credits: 60, materials: 70 }, req: [],
      effect: '+1 DEF for all your units in battle.' }, // combat
    cyberEnh: { branch: 'military', name: 'Cybernetic Enhancement', rp: 12, cost: { credits: 90, materials: 80, intel: 30 }, req: ['combatArmor'],
      effect: '+2 HP for all units in battle; Cybernetic Soldiers no longer need a facility to recruit.' }, // combat, units
    heavyWeapons: { branch: 'military', name: 'Heavy Weapons', rp: 14, cost: { credits: 110, materials: 140 }, req: ['advWeapons'],
      effect: 'Unlocks the Rail Cannon (+7 ATK) in the armory; Heavy Assault Units no longer need a facility to recruit.' }, // units
    drones: { branch: 'military', name: 'Autonomous Drones', rp: 18, cost: { credits: 140, materials: 120, energy: 80, intel: 40 }, req: ['cyberEnh', 'heavyWeapons'],
      effect: 'Drone patrols: guard strength +50% and +3 DEF for guarding units in battle.' }, // units, combat
    // BIOLOGICAL
    geneticMod: { branch: 'bio', name: 'Genetic Modification', rp: 8, cost: { credits: 60, materials: 30, intel: 30 }, req: [],
      effect: '+3 HP for all units in battle; injuries heal 1 turn faster.' }, // combat, units
    mutantEvo: { branch: 'bio', name: 'Mutant Evolution', rp: 12, cost: { credits: 90, materials: 60, intel: 40 }, req: ['geneticMod'],
      effect: 'Mutant Enforcers get +2 ATK and +1 DEF in battle and no longer need a facility to recruit.' }, // combat, units
    regeneration: { branch: 'bio', name: 'Regeneration', rp: 14, cost: { credits: 100, energy: 40, intel: 50 }, req: ['geneticMod'],
      effect: 'Fallen units die half as often; wounds last 1 turn less.' }, // combat
    bioWarfare: { branch: 'bio', name: 'Biological Warfare', rp: 18, cost: { credits: 140, materials: 80, intel: 70 }, req: ['mutantEvo', 'regeneration'],
      effect: 'Unlocks the Plague Release special operation.' }, // espionage
    // INFORMATION
    advHacking: { branch: 'info', name: 'Advanced Hacking', rp: 8, cost: { credits: 50, energy: 30, intel: 40 }, req: [],
      effect: 'Hackers gather double intel; +10% success on Disrupt Income, Sabotage Factory, Steal Technology and facility sabotage.' }, // units, espionage
    surveillance: { branch: 'info', name: 'Surveillance Networks', rp: 10, cost: { credits: 80, energy: 60, intel: 50 }, req: ['advHacking'],
      effect: 'You see everything within 2 districts of your territory; rival operations against you −10% success.' }, // world, espionage
    ewar: { branch: 'info', name: 'Electronic Warfare', rp: 12, cost: { credits: 90, energy: 70, intel: 50 }, req: ['advHacking'],
      effect: '+10% hit chance in battle; enemy guards weaken your canvassing 25% less.' }, // combat, units
    aiIntel: { branch: 'info', name: 'AI Intelligence', rp: 16, cost: { credits: 120, energy: 90, intel: 80 }, req: ['surveillance'],
      effect: '+1 operation point every turn; +1 research point per turn.' }, // actions, tech
    digitalManip: { branch: 'info', name: 'Digital Manipulation', rp: 16, cost: { credits: 120, energy: 40, intel: 100 }, req: ['ewar', 'surveillance'],
      effect: 'Influence campaigns +4; Manipulate Public Opinion gains +6 more.' }, // actions, espionage
    // SIGNATURE (one per faction)
    shellCorps: { branch: 'faction', faction: 'syndicate', name: 'Shell Corporations', rp: 12, cost: { credits: 100, intel: 60 }, req: [],
      effect: 'District upkeep costs 1 credit less per district.' }, // economy
    exoframes: { branch: 'faction', faction: 'legion', name: 'Siege Exoframes', rp: 12, cost: { credits: 100, materials: 100 }, req: [],
      effect: 'Heavy Assault Units cost 30% less and get +2 ATK in battle.' }, // units, combat
    ghostAI: { branch: 'faction', faction: 'cult', name: 'Ghost Protocol AI', rp: 12, cost: { credits: 100, energy: 40, intel: 60 }, req: [],
      effect: '+15% success on all special operations.' }, // espionage
    hiveGenome: { branch: 'faction', faction: 'mutants', name: 'Hive Genome', rp: 12, cost: { credits: 100, materials: 60, intel: 40 }, req: [],
      effect: '+2 more influence regrowth per turn in every controlled district.' }, // turn
    phantomCloak: { branch: 'faction', faction: 'shadow', name: 'Phantom Cloaking', rp: 12, cost: { credits: 100, energy: 40, intel: 60 }, req: [],
      effect: 'Every unit counts as wearing a Stealth Cloak (+15% seize/sabotage, never injured by crackdowns).' }, // units
    swarmTactics: { branch: 'faction', faction: 'reapers', name: 'Swarm Tactics', rp: 12, cost: { credits: 100, materials: 80 }, req: [],
      effect: 'Two extra recruits in the market each turn; Mercenaries get +1 ATK in battle.' }, // units, combat
  };
  // ULTIMATE: requires every branch technology; completing it wins Technological Supremacy (victory).
  ND.TECHS.singularity = { branch: 'ultimate', name: 'Singularity Protocol', rp: 50, cost: { credits: 800, energy: 300, materials: 300, intel: 300 },
    req: Object.keys(ND.TECHS).filter((id) => ['military', 'bio', 'info'].includes(ND.TECHS[id].branch)),
    effect: 'Wakes the city\'s machine mind and bends it to your will. Wins Technological Supremacy when that victory is enabled.' };

  const T = (ND.Tech = {
    ensure(g) {
      for (const fid of g.order) {
        const f = g.factions[fid];
        if (!f.tech) f.tech = { done: [], current: null };
        if (f.leaderless == null) f.leaderless = 0;
        if (!f.spied) f.spied = {};
        if (!f.spiedFaction) f.spiedFaction = {};
      }
      for (const d of g.districts) if (d.disrupted == null) d.disrupted = 0;
    },
    has(g, fid, id) { return !!g.factions[fid] && !!g.factions[fid].tech && g.factions[fid].tech.done.includes(id); },
    // Techs visible to a faction: the three branches plus its own signature tech.
    listFor(fid) { return Object.keys(ND.TECHS).filter((id) => !ND.TECHS[id].faction || ND.TECHS[id].faction === fid); },
    branchIds() { return Object.keys(ND.TECHS).filter((id) => ['military', 'bio', 'info'].includes(ND.TECHS[id].branch)); },
    rpPerTurn(g, fid) {
      if (g.factions[fid].leaderless > 0) return 0;
      let rp = 2;
      for (const d of g.districts) {
        if (d.type !== 'research') continue;
        if (d.owner === fid) rp++;
        rp += d.facilities.filter((fc) => fc.owner === fid).length * 0.5;
      }
      if (T.has(g, fid, 'aiIntel')) rp++;
      return Math.floor(rp);
    },
    status(g, fid, id) {
      const f = g.factions[fid], t = ND.TECHS[id];
      if (f.tech.done.includes(id)) return 'done';
      if (f.tech.current && f.tech.current.id === id) return 'active';
      if (t.req.every((r) => f.tech.done.includes(r))) return 'available';
      return 'locked';
    },
    canStart(g, fid, id) {
      const f = g.factions[fid], t = ND.TECHS[id];
      if (!t || (t.faction && t.faction !== fid)) return { ok: false, reason: 'Not available to your faction.' };
      const st = T.status(g, fid, id);
      if (st === 'done') return { ok: false, reason: 'Already researched.' };
      if (st === 'active') return { ok: false, reason: 'Already in progress.' };
      if (st === 'locked') return { ok: false, reason: `Requires ${t.req.filter((r) => !f.tech.done.includes(r)).map((r) => ND.TECHS[r].name).join(' and ')}.` };
      if (f.tech.current) return { ok: false, reason: 'Another project is in progress (cancel it first).' };
      if (f.leaderless > 0) return { ok: false, reason: 'Leaderless — research is frozen.' };
      for (const r of ND.RES) if ((t.cost[r] || 0) > f.res[r]) return { ok: false, reason: `Not enough ${ND.RES_LABEL[r]} (need ${t.cost[r]}).` };
      return { ok: true };
    },
    start(g, fid, id) {
      const c = T.canStart(g, fid, id);
      if (!c.ok) return c;
      const f = g.factions[fid];
      for (const r of ND.RES) f.res[r] -= ND.TECHS[id].cost[r] || 0;
      f.tech.current = { id, progress: 0 };
      return { ok: true };
    },
    // Cancelling refunds half of the up-front cost.
    cancel(g, fid) {
      const f = g.factions[fid];
      if (!f.tech.current) return { ok: false, reason: 'Nothing to cancel.' };
      const t = ND.TECHS[f.tech.current.id];
      for (const r of ND.RES) f.res[r] += Math.floor((t.cost[r] || 0) / 2);
      f.tech.current = null;
      return { ok: true };
    },
    grant(g, fid, id) {
      const f = g.factions[fid];
      if (!f.tech.done.includes(id)) f.tech.done.push(id);
      if (f.tech.current && f.tech.current.id === id) f.tech.current = null;
    },
    // Step 9: research advances.
    progress(g, fid) {
      const f = g.factions[fid];
      if (!f.tech.current) return;
      f.tech.current.progress += T.rpPerTurn(g, fid);
      const t = ND.TECHS[f.tech.current.id];
      if (f.tech.current.progress >= t.rp) {
        const id = f.tech.current.id;
        T.grant(g, fid, id);
        ND.Log.add(g, { cat: 'tech', who: fid, text: `${ND.FDEF[fid].name} completed research: ${t.name}.` });
      }
    },
  });
})(window.ND);
