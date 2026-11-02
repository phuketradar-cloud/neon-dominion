// Combat: automatic multi-round battles between units, district defense bonuses, and battle reports.
(function (ND) {
  const ROUNDS = 3;
  const fname = (fid) => ND.FDEF[fid].name;
  const doc = (fid) => ND.FDEF[fid].mods.combat || {};

  // Defensive bonus a side gets for fighting in a district it controls.
  function districtBonus(d, fid) {
    if (d.owner !== fid) return { total: 0, parts: [] };
    const parts = [['security', Math.floor(d.security / 20)], ['development', d.dev - 1]];
    if (d.hq === fid) parts.push(['headquarters', 2]);
    const live = parts.filter((p) => p[1] > 0);
    return { total: live.reduce((s, p) => s + p[1], 0), parts: live };
  }

  // Battle stats for one unit. ctx: { attacking, defending, bonus, outnumber }
  function fighter(g, u, ctx) {
    const s = ND.Units.stats(u), D = doc(u.fid);
    const has = (id) => ND.Tech.has(g, u.fid, id);
    const guarding = u.task.kind === 'guard';
    let atk = s.atk + (D.atk || 0) + (D.swarm ? Math.max(0, Math.min(D.swarm, ctx.outnumber)) : 0);
    let def = s.def + (D.def || 0);
    let hp = 10 + s.def + u.level * 2 + (u.type === 'heavy' ? 5 : 0) + (D.hp || 0);
    // Research
    if (has('advWeapons')) atk += 1;
    if (has('combatArmor')) def += 1;
    if (has('cyberEnh')) hp += 2;
    if (has('geneticMod')) hp += 3;
    if (u.type === 'mutant' && has('mutantEvo')) { atk += 2; def += 1; }
    if (u.type === 'heavy' && has('exoframes')) atk += 2;
    if (u.type === 'merc' && has('swarmTactics')) atk += 1;
    if (ctx.defending) def += ctx.bonus + (D.defendDef || 0) + (guarding ? 2 : 0) + (guarding && has('drones') ? 3 : 0);
    return { id: u.id, fid: u.fid, name: u.name, type: u.type, level: u.level, atk, def, hp, maxHp: hp, downs: 0,
      hit: (D.hit || 0) + (has('ewar') ? 10 : 0), ambush: ctx.attacking ? D.ambush || 0 : 0 };
  }

  const hitChance = (a, t, round) => Math.max(10, Math.min(92, 55 + (a.atk + (round === 1 ? a.ambush : 0) - t.def) * 5 + a.hit));
  const baseDamage = (a, t, round) => Math.max(1, 2 + Math.floor((a.atk + (round === 1 ? a.ambush : 0)) / 3) - Math.floor(t.def / 4));

  ND.Combat = {
    ROUNDS,
    districtBonus,

    // Cheap analytic odds (used for previews and AI): compares how many rounds each side needs to grind the other down.
    estimate(g, d, attackers, defenders) {
      if (!defenders.length) return 1;
      if (!attackers.length) return 0;
      const bonus = districtBonus(d, defenders[0].fid).total;
      const A = attackers.map((u) => fighter(g, u, { attacking: true, outnumber: attackers.length - defenders.length }));
      const D = defenders.map((u) => fighter(g, u, { defending: true, bonus, outnumber: defenders.length - attackers.length }));
      const avg = (arr, k) => arr.reduce((s, f) => s + f[k], 0) / arr.length;
      const dmg = (X, Y) => {
        const t = { def: avg(Y, 'def') };
        return X.reduce((s, f) => s + (hitChance(f, t, 2) / 100) * (baseDamage(f, t, 2) + 1), 0);
      };
      const hp = (X) => X.reduce((s, f) => s + f.hp, 0);
      const tA = hp(D) / dmg(A, D), tD = hp(A) / dmg(D, A);
      const r = tD / tA; // > 1 means attackers finish first
      return Math.max(0.02, Math.min(0.98, (r * r) / (1 + r * r) - 0.05));
    },

    // Fight a full battle. Applies casualties, XP and influence consequences; returns the stored report.
    fight(g, d, attFid, attUnits, defFid, defUnits, kind) {
      const bonus = districtBonus(d, defFid);
      const A = attUnits.map((u) => fighter(g, u, { attacking: true, outnumber: attUnits.length - defUnits.length }));
      const D = defUnits.map((u) => fighter(g, u, { defending: true, bonus: bonus.total, outnumber: defUnits.length - attUnits.length }));
      const morale = { att: ND.randInt(g, -2, 2), def: ND.randInt(g, -2, 2) };
      A.forEach((f) => { f.atk = Math.max(0, f.atk + morale.att); });
      D.forEach((f) => { f.atk = Math.max(0, f.atk + morale.def); });
      const alive = (X) => X.filter((f) => f.hp > 0);
      const rounds = [];
      for (let r = 1; r <= ROUNDS && alive(A).length && alive(D).length; r++) {
        const lines = [];
        const order = ND.shuffle(g, [...alive(A), ...alive(D)]);
        for (const f of order) {
          if (f.hp <= 0) continue;
          const foes = alive(f.fid === attFid ? D : A);
          if (!foes.length) break;
          const t = ND.pick(g, foes);
          const pct = hitChance(f, t, r);
          if (ND.rand(g) * 100 < pct) {
            const dmg = baseDamage(f, t, r) + ND.randInt(g, 0, 2);
            t.hp = Math.max(0, t.hp - dmg);
            if (t.hp === 0) f.downs++;
            lines.push({ a: f.name, af: f.fid, t: t.name, tf: t.fid, hit: true, dmg, pct, down: t.hp === 0 });
          } else {
            lines.push({ a: f.name, af: f.fid, t: t.name, tf: t.fid, hit: false, pct });
          }
        }
        rounds.push(lines);
      }

      const frac = (X) => X.reduce((s, f) => s + f.hp, 0) / X.reduce((s, f) => s + f.maxHp, 0);
      let winner;
      if (!alive(D).length) winner = 'att';
      else if (!alive(A).length) winner = 'def';
      else winner = frac(A) > frac(D) + 0.1 ? 'att' : 'def'; // ties go to the defender

      // Casualties and experience
      const fates = {};
      for (const f of [...A, ...D]) {
        const u = g.units[f.id];
        const won = (winner === 'att') === (f.fid === attFid);
        if (f.hp <= 0) {
          const regen = ND.Tech.has(g, f.fid, 'regeneration');
          const deathChance = 0.35 * (doc(f.fid).deathMult || 1) * (regen ? 0.5 : 1);
          if (ND.rand(g) < deathChance) { fates[f.id] = 'killed'; ND.Units.kill(g, u, `killed in battle at ${d.name}`); continue; }
          fates[f.id] = 'wounded';
          ND.Units.injure(g, u, ND.randInt(g, 2, 4) - (regen ? 1 : 0), `in battle at ${d.name}`);
        } else if (f.hp <= f.maxHp / 4) {
          fates[f.id] = 'hurt';
          ND.Units.injure(g, u, 1, `in battle at ${d.name}`);
        } else fates[f.id] = 'fit';
        if (g.units[f.id]) ND.Units.gainXp(g, u, (won ? 12 : 5) + f.downs * 4);
      }

      // Territorial consequences
      const downed = (X) => X.filter((f) => f.hp <= 0).length;
      const consequences = [];
      if (winner === 'att') {
        if (d.owner === defFid) {
          const lost = ND.Inf.sub(d, defFid, 6 + 3 * downed(D));
          const got = ND.Inf.add(d, attFid, 4);
          consequences.push(`${fname(defFid)} lost ${lost}% influence in ${d.name}; ${fname(attFid)} gained ${got}%.`);
        }
        if (kind === 'interception') consequences.push(`The intruders broke through; their orders go ahead.`);
      } else {
        for (const u of attUnits) if (g.units[u.id]) u.repelled = true;
        const lost = ND.Inf.sub(d, attFid, 3);
        consequences.push(`${fname(attFid)}'s units were repelled — their orders this turn are cancelled${lost ? ` and ${lost}% influence was lost` : ''}.`);
      }
      for (const u of [...attUnits, ...defUnits]) if (g.units[u.id]) u.fought = true;

      const side = (fid, F, m, b) => ({ fid, morale: m, bonus: b, units: F.map((f) => ({ name: f.name, type: f.type, level: f.level, atk: f.atk, def: f.def, hp: f.hp, maxHp: f.maxHp, downs: f.downs, fate: fates[f.id] })) });
      const report = {
        id: g.nextBattle++, turn: g.turn, d: d.id, kind,
        att: side(attFid, A, morale.att, null),
        def: side(defFid, D, morale.def, bonus),
        rounds, winner: winner === 'att' ? attFid : defFid, consequences,
      };
      g.battles.unshift(report);
      if (g.battles.length > 60) g.battles.pop();
      // Keep full round-by-round logs only for recent battles to keep saves small.
      if (g.battles[20]) delete g.battles[20].rounds;
      ND.Diplo.incident(g, attFid, defFid, -8);
      const loser = report.winner === attFid ? defFid : attFid;
      g.factions[report.winner].battlesWon = (g.factions[report.winner].battlesWon || 0) + 1;
      g.factions[loser].battlesLost = (g.factions[loser].battlesLost || 0) + 1;
      const verb = kind === 'interception' ? 'intercepted' : 'was attacked by';
      const text = kind === 'interception'
        ? `${fname(defFid)} guards ${verb} ${fname(attFid)} units in ${d.name} — ${fname(report.winner)} won (${A.length} vs ${D.length}).`
        : `${fname(defFid)} ${verb} ${fname(attFid)} in ${d.name} — ${fname(report.winner)} won (${A.length} vs ${D.length}).`;
      ND.Log.add(g, { cat: 'battle', who: attFid, d: d.id, battle: report.id, public: attFid === g.player || defFid === g.player, text });
      return report;
    },

    // An attack order with no defenders present: raid the target's hold on the district.
    raid(g, u, d) {
      const t = u.task.target, s = ND.Units.stats(u);
      const lost = ND.Inf.sub(d, t, Math.max(2, Math.floor(s.atk / 3)));
      d.security = Math.max(5, d.security - 2);
      ND.Diplo.incident(g, u.fid, t, -5);
      ND.Units.gainXp(g, u, 6);
      ND.Log.add(g, { cat: 'conflict', who: u.fid, d: d.id, public: t === g.player,
        text: `${u.name} of ${fname(u.fid)} raided ${fname(t)} holdings in ${d.name} (−${lost}% influence).` });
    },

    // Step 6a: all battles of the turn — assaults first, then guards intercepting intruders.
    resolveBattles(g) {
      const healthy = (u) => g.units[u.id] && !u.injured;
      // Assaults: group attackers by district + attacker + target.
      const groups = {};
      for (const u of Object.values(g.units)) {
        if (u.injured || u.task.kind !== 'attack') continue;
        const k = `${u.loc}|${u.fid}|${u.task.target}`;
        (groups[k] = groups[k] || []).push(u);
      }
      for (const k of ND.shuffle(g, Object.keys(groups))) {
        const [did, fid, target] = k.split('|');
        if (ND.Diplo.pact(g, fid, target)) continue;
        const d = g.districts[did];
        const att = groups[k].filter(healthy);
        const def = ND.Units.at(g, d.id).filter((u) => u.fid === target && healthy(u));
        if (att.length && def.length) ND.Combat.fight(g, d, fid, att, target, def, 'assault');
      }
      // Interceptions: guards in their own district engage units running hostile orders there.
      const hostile = ['canvass', 'seize', 'sabotage'];
      for (const d of ND.shuffle(g, g.districts.slice())) {
        if (!d.owner) continue;
        const here = ND.Units.at(g, d.id);
        if (!here.some((u) => u.fid === d.owner && healthy(u) && u.task.kind === 'guard')) continue;
        const intruders = {};
        for (const u of here) {
          if (u.fid === d.owner || !healthy(u) || u.fought || !hostile.includes(u.task.kind)) continue;
          if (ND.Diplo.pact(g, u.fid, d.owner)) continue;
          (intruders[u.fid] = intruders[u.fid] || []).push(u);
        }
        for (const fid of Object.keys(intruders)) {
          const def = ND.Units.at(g, d.id).filter((u) => u.fid === d.owner && healthy(u));
          const att = intruders[fid].filter(healthy);
          if (def.length && att.length) ND.Combat.fight(g, d, fid, att, d.owner, def, 'interception');
        }
      }
    },

    visibleTo(g, b, p) {
      return b.att.fid === p || b.def.fid === p || ND.Log.canSee(g, p, b.d);
    },
  };
})(window.ND);
