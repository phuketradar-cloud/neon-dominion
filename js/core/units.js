// Personnel: unit types, equipment, recruitment market, movement, standing orders and their resolution.
(function (ND) {
  ND.UNIT_TYPES = {
    merc: { label: 'Human Mercenary', short: 'MERC', atk: 4, def: 3, inf: 2, int: 1, cost: { credits: 70 }, upkeep: { credits: 5 },
      slots: ['weapon', 'armor', 'gear'], req: null, accent: 'none', weight: 22,
      special: 'Professional — earns 50% more experience.', desc: 'Cheap, flexible street muscle for hire.' },
    cyber: { label: 'Cybernetic Soldier', short: 'CYB', atk: 6, def: 6, inf: 1, int: 2, cost: { credits: 140, materials: 20 }, upkeep: { credits: 6, energy: 1 },
      slots: ['weapon', 'armor', 'gear'], req: ['research', 'hospital'], accent: 'visor', weight: 12,
      special: 'Reinforced Chassis — never injured by police crackdowns.', desc: 'Chrome-laced veterans. Tough all-rounders.' },
    mutant: { label: 'Mutant Enforcer', short: 'MUT', atk: 7, def: 5, inf: 2, int: 0, cost: { credits: 110 }, upkeep: { credits: 5 },
      slots: ['weapon', 'armor'], req: ['hospital', 'research'], accent: 'growth', weight: 12,
      special: 'Regeneration — injuries heal twice as fast.', desc: 'Vat-grown brutes. Terrifying, hard to put down.' },
    hacker: { label: 'Hacker', short: 'HAX', atk: 1, def: 1, inf: 3, int: 7, cost: { credits: 90 }, upkeep: { credits: 5, energy: 1 },
      slots: ['gear', 'gear', 'armor'], req: null, accent: 'visor', weight: 14,
      special: 'Backdoor — Gather Intel also lowers a rival or unaligned district\'s security by 3.', desc: 'Netrunners who own the city\'s cameras and feeds.' },
    assassin: { label: 'Assassin', short: 'ASN', atk: 8, def: 2, inf: 0, int: 4, cost: { credits: 150 }, upkeep: { credits: 7 },
      slots: ['weapon', 'gear', 'gear'], req: null, accent: 'hood', weight: 9,
      special: 'Wetwork — +20% success when seizing or sabotaging facilities.', desc: 'Silent killers for the jobs nobody admits to.' },
    engineer: { label: 'Engineer', short: 'ENG', atk: 1, def: 3, inf: 1, int: 4, cost: { credits: 80, materials: 10 }, upkeep: { credits: 4 },
      slots: ['gear', 'gear', 'armor'], req: ['industrial', 'power', 'military'], accent: 'helmet', weight: 12,
      special: 'Field Works — while guarding, raises the district\'s base security by 1 per turn (max 85).', desc: 'Builders of barricades, turrets and bunkers.' },
    heavy: { label: 'Heavy Assault Unit', short: 'HVY', atk: 9, def: 8, inf: 0, int: 0, cost: { credits: 220, materials: 40 }, upkeep: { credits: 9, energy: 2 },
      slots: ['weapon', 'weapon', 'armor'], req: ['military', 'industrial'], accent: 'helmet', weight: 7,
      special: 'Intimidation — guard strength is doubled.', desc: 'Power-armored walking tanks.' },
    agent: { label: 'Intelligence Agent', short: 'AGT', atk: 2, def: 2, inf: 4, int: 5, cost: { credits: 115 }, upkeep: { credits: 6 },
      slots: ['weapon', 'gear', 'gear'], req: null, accent: 'shades', weight: 12,
      special: 'Smooth Operator — canvassing gains +30% influence.', desc: 'Fixers and handlers who turn neighborhoods.' },
  };

  // Faction signature units: 25% cheaper, three times as common in the market, no facility requirement.
  ND.SIGNATURE = { syndicate: 'agent', legion: 'heavy', cult: 'hacker', mutants: 'mutant', shadow: 'assassin', reapers: 'merc' };

  ND.ITEMS = {
    pistol: { label: 'Street Pistol', slot: 'weapon', bonus: { atk: 1 }, cost: { credits: 20 } },
    smg: { label: 'Smart SMG', slot: 'weapon', bonus: { atk: 2 }, cost: { credits: 45 } },
    rifle: { label: 'Assault Rifle', slot: 'weapon', bonus: { atk: 3 }, cost: { credits: 80, materials: 10 } },
    plasma: { label: 'Plasma Rifle', slot: 'weapon', bonus: { atk: 5 }, cost: { credits: 160, materials: 25, energy: 10 } },
    rail: { label: 'Rail Cannon', slot: 'weapon', bonus: { atk: 7 }, cost: { credits: 220, materials: 40, energy: 15 }, tech: 'heavyWeapons', note: 'Requires Heavy Weapons research.' },
    vest: { label: 'Kevlar Vest', slot: 'armor', bonus: { def: 1 }, cost: { credits: 25 } },
    plate: { label: 'Ballistic Plate', slot: 'armor', bonus: { def: 3 }, cost: { credits: 70, materials: 15 } },
    exo: { label: 'Exo-Armor', slot: 'armor', bonus: { def: 5, atk: 1 }, cost: { credits: 150, materials: 40 } },
    comms: { label: 'Comms Rig', slot: 'gear', bonus: { inf: 2 }, cost: { credits: 60 } },
    deck: { label: 'Cyberdeck', slot: 'gear', bonus: { int: 3 }, cost: { credits: 90, materials: 5 } },
    medkit: { label: 'Trauma Kit', slot: 'gear', bonus: { def: 1 }, special: 'heal', cost: { credits: 40 }, note: 'Injuries heal 1 turn faster.' },
    cloak: { label: 'Stealth Cloak', slot: 'gear', bonus: { int: 1 }, special: 'stealth', cost: { credits: 120, materials: 10 }, note: '+15% seize/sabotage success; never injured by crackdowns.' },
  };

  // What a facility yields to whoever holds it, by district type.
  ND.FAC_YIELD = {
    residential: { credits: 3 }, industrial: { materials: 2 }, research: { intel: 2 }, blackmarket: { credits: 4 },
    casino: { credits: 4 }, hospital: { credits: 2 }, police: { intel: 1, credits: 1 }, power: { energy: 3 },
    military: { materials: 2 }, corporate: { credits: 4 },
  };

  ND.TASKS = {
    rest: 'Rest', canvass: 'Canvass', guard: 'Guard', intel: 'Gather Intel', seize: 'Seize facility',
    sabotage: 'Sabotage facility', train: 'Train', hq: 'Establish HQ', attack: 'Attack',
  };

  const STATS = ['atk', 'def', 'inf', 'int'];
  ND.STAT_LABEL = { atk: 'ATK', def: 'DEF', inf: 'INF', int: 'INT' };
  const XP_LEVELS = [0, 40, 110, 220, 380];
  const FIRST = ['Jax', 'Mira', 'Kade', 'Vex', 'Nova', 'Rook', 'Sable', 'Dex', 'Yuki', 'Ozzy', 'Lena', 'Tariq', 'Ivo', 'Rhea', 'Cass', 'Bram',
    'Zia', 'Hollis', 'Nix', 'Petra', 'Juno', 'Silas', 'Kenji', 'Ash', 'Moss', 'Imani', 'Dag', 'Wren'];
  const CALL = ['Razor', 'Static', 'Ghost', 'Halo', 'Rust', 'Viper', 'Byte', 'Hammer', 'Wisp', 'Sparks', 'Cinder', 'Patch', 'Echo', 'Mantis',
    'Brick', 'Zero', 'Saint', 'Jinx', 'Torch', 'Lynx', 'Glitch', 'Tusk'];
  const LAST = ['Moreno', 'Kwan', 'Volkov', 'Ade', 'Reyes', 'Strand', 'Okafor', 'Tanaka', 'Duval', 'Price', 'Mbeki', 'Novak', 'Ruiz', 'Hale',
    'Ferro', 'Ishida', 'Grau', 'Sato'];
  const SKINS = ['#e0c0a0', '#c79b78', '#a77d62', '#8d6a4f', '#6b4a3a', '#d6c2b0'];
  const HAIRS = ['#1a1410', '#3a2a1a', '#0c0c14', '#7a6a5a', '#b04a2a', '#d8d0c0', '#2b3a4a'];

  const fname = (fid) => ND.FDEF[fid].name;
  const label = (u) => `${u.name} (${ND.UNIT_TYPES[u.type].label})`;

  const U = (ND.Units = {
    XP_LEVELS,
    ensure(g) {
      if (!g.units) { g.units = {}; g.nextUnit = 1; }
      if (!g.battles) { g.battles = []; g.nextBattle = 1; }
      for (const fid of g.order) {
        const f = g.factions[fid];
        if (!f.inventory) f.inventory = {};
        if (!f.market) f.market = [];
      }
    },
    list(g, fid) { return Object.values(g.units).filter((u) => u.fid === fid); },
    at(g, did) { return Object.values(g.units).filter((u) => u.loc === did); },
    cap(g, fid) { return Math.min(20, 3 + Math.floor(ND.World.owned(g, fid).length / 2)); },
    levelFor(xp) { let l = 1; XP_LEVELS.forEach((t, i) => { if (xp >= t) l = i + 1; }); return l; },
    nextLevelXp(u) { return u.level < XP_LEVELS.length ? XP_LEVELS[u.level] : null; },

    // Effective stats: rolled base + level bonus + equipment.
    stats(u) {
      const s = {};
      for (const k of STATS) s[k] = u.base[k] + (u.level - 1);
      for (const it of u.equip) if (it) for (const k in ND.ITEMS[it].bonus) s[k] += ND.ITEMS[it].bonus[k];
      return s;
    },
    has(u, special) { return u.equip.some((it) => it && ND.ITEMS[it].special === special); },
    // Stealth from a cloak, or for every unit of a faction with Phantom Cloaking.
    stealthy(g, u) { return U.has(u, 'stealth') || ND.Tech.has(g, u.fid, 'phantomCloak'); },
    upkeep(u) { return ND.UNIT_TYPES[u.type].upkeep; },
    payroll(g, fid) {
      const t = ND.Econ.zero();
      for (const u of U.list(g, fid)) for (const r in U.upkeep(u)) t[r] += U.upkeep(u)[r];
      return t;
    },

    // ---------- recruitment ----------
    // Fixed characters (ND.ROSTER) still free to appear, by unit type. Types without roster entries are absent and
    // keep generated recruits. Taken = on any faction's roster, in any market, or killed earlier this game.
    rosterFree(g) {
      if (!ND.ROSTER || !ND.ROSTER.length) return null;
      const taken = new Set(g.rosterGone || []);
      for (const u of Object.values(g.units)) if (u.rid) taken.add(u.rid);
      for (const fid of g.order) for (const c of g.factions[fid].market || []) if (c.rid) taken.add(c.rid);
      const free = {};
      for (const r of ND.ROSTER) { free[r.type] = free[r.type] || []; if (!taken.has(r.id)) free[r.type].push(r); }
      return free;
    },
    makeCandidate(g, fid) {
      const sig = ND.SIGNATURE[fid], free = U.rosterFree(g);
      const type = ND.weighted(g, Object.keys(ND.UNIT_TYPES).map((k) => [k, free && free[k] && !free[k].length ? 0 : ND.UNIT_TYPES[k].weight * (k === sig ? 3 : 1)]));
      const T = ND.UNIT_TYPES[type];
      const base = {};
      for (const k of STATS) base[k] = Math.max(0, T[k] + ND.randInt(g, -1, 1));
      const c = {
        type, base,
        name: `${ND.pick(g, FIRST)} "${ND.pick(g, CALL)}" ${ND.pick(g, LAST)}`,
        skin: type === 'mutant' ? '#8fae6a' : ND.pick(g, SKINS),
        hair: ND.pick(g, HAIRS),
      };
      // Picking the character draws nothing from the RNG, so the rest of the game's random sequence is unchanged.
      const pool = free && free[type];
      if (pool && pool.length) { const r = pool[ND.hashStr(c.name) % pool.length]; c.name = r.name; c.rid = r.id; }
      return c;
    },
    refreshMarket(g, fid) {
      const f = g.factions[fid];
      f.market = [];
      const n = 4 + (ND.Tech.has(g, fid, 'swarmTactics') ? 2 : 0);
      for (let i = 0; i < n; i++) f.market.push(U.makeCandidate(g, fid));
    },
    recruitCost(fid, type, g) {
      const c = { ...ND.UNIT_TYPES[type].cost };
      let m = ND.SIGNATURE[fid] === type ? 0.75 : 1;
      if (g && type === 'heavy' && ND.Tech.has(g, fid, 'exoframes')) m *= 0.7;
      if (m !== 1) for (const r in c) c[r] = Math.round(c[r] * m);
      return c;
    },
    // Techs that remove a unit type's facility requirement.
    REQ_TECH: { cyber: 'cyberEnh', heavy: 'heavyWeapons', mutant: 'mutantEvo' },
    reqMet(g, fid, type) {
      const req = ND.UNIT_TYPES[type].req;
      if (!req || ND.SIGNATURE[fid] === type) return true;
      if (U.REQ_TECH[type] && ND.Tech.has(g, fid, U.REQ_TECH[type])) return true;
      return g.districts.some((d) => d.owner === fid && req.includes(d.type));
    },
    canRecruit(g, fid, idx) {
      const f = g.factions[fid], c = f.market[idx];
      if (!c) return { ok: false, reason: 'No such candidate.' };
      const cost = U.recruitCost(fid, c.type, g);
      if (g.over || !f.alive) return { ok: false, reason: 'Unavailable.', cost };
      if (f.leaderless > 0) return { ok: false, reason: 'Leaderless — nobody will sign up until a new leader takes over.', cost };
      if (U.list(g, fid).length >= U.cap(g, fid)) return { ok: false, reason: `Roster full (${U.cap(g, fid)}). Control more districts to raise the cap.`, cost };
      if (!U.reqMet(g, fid, c.type)) {
        return { ok: false, reason: `Requires control of a ${ND.UNIT_TYPES[c.type].req.map((t) => ND.TYPES[t].label).join(' or ')}.`, cost };
      }
      if (f.hq == null) return { ok: false, reason: 'You need a headquarters to recruit.', cost };
      for (const r of ND.RES) if ((cost[r] || 0) > f.res[r]) return { ok: false, reason: `Not enough ${ND.RES_LABEL[r]} (need ${cost[r]}).`, cost };
      return { ok: true, cost };
    },
    recruit(g, fid, idx) {
      const chk = U.canRecruit(g, fid, idx);
      if (!chk.ok) return chk;
      const f = g.factions[fid], c = f.market.splice(idx, 1)[0];
      for (const r of ND.RES) f.res[r] -= chk.cost[r] || 0;
      const T = ND.UNIT_TYPES[c.type];
      const u = {
        id: g.nextUnit++, fid, type: c.type, name: c.name, rid: c.rid, base: c.base, skin: c.skin, hair: c.hair,
        level: 1, xp: 0, loc: f.hq, task: { kind: 'rest' }, injured: 0, moved: false,
        equip: T.slots.map(() => null), joined: g.turn,
      };
      g.units[u.id] = u;
      ND.Log.add(g, { cat: 'unit', who: fid, d: u.loc, text: `${fname(fid)} recruited ${label(u)}.` });
      return { ok: true, unit: u };
    },
    dismiss(g, u) {
      const f = g.factions[u.fid];
      for (const it of u.equip) if (it) f.inventory[it] = (f.inventory[it] || 0) + 1;
      delete g.units[u.id];
      ND.Log.add(g, { cat: 'unit', who: u.fid, d: u.loc, text: `${fname(u.fid)} dismissed ${label(u)}; equipment returned to the armory.` });
    },
    kill(g, u, how) {
      delete g.units[u.id];
      if (u.rid) (g.rosterGone = g.rosterGone || []).push(u.rid); // a fixed character never returns once dead
      ND.Log.add(g, { cat: 'unit', who: u.fid, d: u.loc, public: u.fid === g.player, text: `${label(u)} of ${fname(u.fid)} was ${how}.` });
    },
    injure(g, u, turns, how) {
      u.injured = Math.max(u.injured, turns);
      u.task = { kind: 'rest' };
      ND.Log.add(g, { cat: 'unit', who: u.fid, d: u.loc, text: `${label(u)} of ${fname(u.fid)} was injured ${how} (out ${turns} turns).` });
    },
    gainXp(g, u, n) {
      if (u.type === 'merc') n = Math.round(n * 1.5);
      u.xp += n;
      const lv = U.levelFor(u.xp);
      if (lv > u.level) {
        u.level = lv;
        ND.Log.add(g, { cat: 'unit', who: u.fid, d: u.loc, text: `${label(u)} reached level ${lv} (+1 to all stats).` });
      }
    },

    // ---------- equipment ----------
    canBuy(g, fid, key) {
      const f = g.factions[fid], it = ND.ITEMS[key], cost = it.cost;
      if (it.tech && !ND.Tech.has(g, fid, it.tech)) return { ok: false, reason: `Requires ${ND.TECHS[it.tech].name}.`, cost };
      for (const r of ND.RES) if ((cost[r] || 0) > f.res[r]) return { ok: false, reason: `Not enough ${ND.RES_LABEL[r]}.`, cost };
      return { ok: true, cost };
    },
    buy(g, fid, key) {
      const chk = U.canBuy(g, fid, key);
      if (!chk.ok) return chk;
      const f = g.factions[fid];
      for (const r of ND.RES) f.res[r] -= chk.cost[r] || 0;
      f.inventory[key] = (f.inventory[key] || 0) + 1;
      return { ok: true };
    },
    equip(g, u, slot, key) {
      const f = g.factions[u.fid], T = ND.UNIT_TYPES[u.type];
      if (!key) return U.unequip(g, u, slot);
      if (ND.ITEMS[key].slot !== T.slots[slot]) return { ok: false, reason: 'Wrong slot type.' };
      if (!(f.inventory[key] > 0)) return { ok: false, reason: 'Not in the armory.' };
      U.unequip(g, u, slot);
      f.inventory[key]--;
      u.equip[slot] = key;
      return { ok: true };
    },
    unequip(g, u, slot) {
      const f = g.factions[u.fid], it = u.equip[slot];
      if (it) { f.inventory[it] = (f.inventory[it] || 0) + 1; u.equip[slot] = null; }
      return { ok: true };
    },

    // ---------- movement ----------
    // One move per turn: to any neighbour, or anywhere through your connected controlled territory (and one step beyond it).
    reach(g, u) {
      const fid = u.fid, start = g.districts[u.loc];
      const out = new Set([start.id]);
      const seen = new Set();
      const queue = [start, ...ND.World.neighbors(g, start)].filter((d) => d.owner === fid);
      ND.World.neighbors(g, start).forEach((n) => out.add(n.id));
      while (queue.length) {
        const d = queue.shift();
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.add(d.id);
        for (const n of ND.World.neighbors(g, d)) {
          out.add(n.id);
          if (n.owner === fid && !seen.has(n.id)) queue.push(n);
        }
      }
      return out;
    },
    canMove(g, u, did) {
      if (u.injured) return 'Injured units cannot move.';
      if (u.moved) return 'Already moved this turn.';
      if (did === u.loc) return 'Already there.';
      if (!U.reach(g, u).has(did)) return 'Out of range: one step beyond your connected territory.';
      return null;
    },
    move(g, u, did) {
      const why = U.canMove(g, u, did);
      if (why) return { ok: false, reason: why };
      u.loc = did;
      u.moved = true;
      if (!U.taskValid(g, u, u.task, g.districts[did]).ok) u.task = { kind: 'rest' };
      return { ok: true };
    },

    // ---------- standing orders ----------
    hostileGuard(g, d, fid) {
      return d.owner && d.owner !== fid ? U.guardPower(g, d.id, d.owner) : 0;
    },
    guardPower(g, did, fid) {
      let p = 0;
      for (const u of U.at(g, did)) {
        if (u.fid !== fid || u.injured || u.task.kind !== 'guard') continue;
        const s = U.stats(u);
        p += (s.def + s.atk / 2) * (u.type === 'heavy' ? 2 : 1);
      }
      if (ND.Tech.has(g, fid, 'drones')) p *= 1.5;
      return Math.round(p);
    },
    canvassGain(g, u, d) {
      const s = U.stats(u);
      const guard = U.hostileGuard(g, d, u.fid) * (ND.Tech.has(g, u.fid, 'ewar') ? 0.75 : 1);
      let gain = Math.round(s.inf * 1.6) + 1 - Math.floor(d.security / 15) - Math.floor(guard / 3);
      if (u.type === 'agent') gain = Math.round(gain * 1.3);
      return Math.max(1, gain);
    },
    opChance(g, u, d, fac, kind) {
      const s = U.stats(u);
      const facOwner = d.facilities[fac].owner;
      const guard = facOwner && facOwner !== u.fid ? U.guardPower(g, d.id, facOwner) : 0;
      let c = 25 + (kind === 'seize' ? (s.atk + s.inf) * 4 + ND.Inf.get(d, u.fid) / 2 : (s.atk + s.int) * 4) - d.security / 2 - guard * 2;
      if (u.type === 'assassin') c += 20;
      if (U.stealthy(g, u)) c += 15;
      if (kind === 'sabotage' && ND.Tech.has(g, u.fid, 'advHacking')) c += 10;
      return Math.round(Math.max(5, Math.min(90, c)));
    },
    intelYield(g, u) {
      const n = Math.floor(U.stats(u).int / 2) + 1;
      return u.type === 'hacker' && ND.Tech.has(g, u.fid, 'advHacking') ? n * 2 : n;
    },
    crackdownRisk(g, u, d) {
      if (u.type === 'cyber' || U.stealthy(g, u)) return 0;
      return Math.max(0, Math.round((d.security - U.stats(u).def * 5) / 3));
    },
    trainCost(u) { return 30 * u.level; },

    taskValid(g, u, t, d) {
      d = d || g.districts[u.loc];
      const f = g.factions[u.fid], fac = d.facilities[t.fac];
      if (u.injured && t.kind !== 'rest') return { ok: false, reason: 'Injured — must rest.' };
      // Non-aggression pacts forbid hostile orders against the partner.
      const peace = (x) => x && x !== u.fid && ND.Diplo.pact(g, u.fid, x);
      const pactMsg = (x) => ({ ok: false, reason: `Non-aggression pact with ${ND.FDEF[x].name}.` });
      if (['canvass', 'seize', 'sabotage'].includes(t.kind) && peace(d.owner)) return pactMsg(d.owner);
      if (['seize', 'sabotage'].includes(t.kind) && fac && peace(fac.owner)) return pactMsg(fac.owner);
      if (t.kind === 'attack' && peace(t.target)) return pactMsg(t.target);
      switch (t.kind) {
        case 'rest': return { ok: true };
        case 'canvass': return ND.Inf.get(d, u.fid) >= 100 ? { ok: false, reason: 'Influence already 100%.' } : { ok: true };
        case 'guard': return d.owner === u.fid ? { ok: true } : { ok: false, reason: 'Only in districts you control.' };
        case 'intel': return { ok: true };
        case 'train': return u.level >= XP_LEVELS.length ? { ok: false, reason: 'Max level.' } : { ok: true };
        case 'hq':
          if (d.owner !== u.fid) return { ok: false, reason: 'Only in districts you control.' };
          if (d.hq === u.fid) return { ok: false, reason: 'Already your HQ.' };
          return f.res.credits >= 150 ? { ok: true } : { ok: false, reason: 'Needs 150 CR.' };
        case 'seize':
          if (!fac) return { ok: false, reason: 'No such facility.' };
          if (fac.owner === u.fid) return { ok: false, reason: 'Already yours.' };
          return ND.Inf.get(d, u.fid) >= 25 ? { ok: true } : { ok: false, reason: 'Needs 25% influence here.' };
        case 'sabotage':
          if (!fac) return { ok: false, reason: 'No such facility.' };
          return fac.owner && fac.owner !== u.fid ? { ok: true } : { ok: false, reason: 'Only rival-held facilities.' };
        case 'attack': {
          const tf = g.factions[t.target];
          if (!tf || !tf.alive || t.target === u.fid) return { ok: false, reason: 'No such enemy.' };
          const foes = U.at(g, d.id).some((x) => x.fid === t.target);
          return foes || d.owner === t.target ? { ok: true } : { ok: false, reason: 'Enemy not present here.' };
        }
      }
      return { ok: false, reason: 'Unknown order.' };
    },
    // All orders for a unit at district d, with a short forecast.
    tasks(g, u, d) {
      d = d || g.districts[u.loc];
      const s = U.stats(u);
      const list = [
        { kind: 'rest', info: u.injured ? `heals (${u.injured} turns left)` : 'idle' },
        { kind: 'canvass', info: `+${U.canvassGain(g, u, d)}% influence${U.crackdownRisk(g, u, d) ? `, ${U.crackdownRisk(g, u, d)}% injury risk` : ''}` },
        { kind: 'guard', info: `guard ${Math.round((s.def + s.atk / 2) * (u.type === 'heavy' ? 2 : 1))}` },
        { kind: 'intel', info: `+${U.intelYield(g, u)} ID${u.type === 'hacker' && d.owner !== u.fid ? ', −3 security' : ''}` },
        { kind: 'train', info: `+30 XP for ${U.trainCost(u)} CR` },
      ];
      d.facilities.forEach((fc, i) => {
        if (fc.owner !== u.fid) list.push({ kind: 'seize', fac: i, info: `${fc.name}: ${U.opChance(g, u, d, i, 'seize')}%` });
        if (fc.owner && fc.owner !== u.fid) list.push({ kind: 'sabotage', fac: i, info: `${fc.name}: ${U.opChance(g, u, d, i, 'sabotage')}%` });
      });
      // Attack orders: fight a rival's units here, or raid its hold on the district if none are present.
      const rivals = new Set(U.at(g, d.id).filter((x) => x.fid !== u.fid).map((x) => x.fid));
      if (d.owner && d.owner !== u.fid) rivals.add(d.owner);
      for (const r of rivals) {
        const foes = U.at(g, d.id).filter((x) => x.fid === r && !x.injured);
        if (foes.length) {
          const mates = U.at(g, d.id).filter((x) => x.fid === u.fid && x.id !== u.id && !x.injured && x.task.kind === 'attack' && x.task.target === r);
          const p = Math.round(ND.Combat.estimate(g, d, [u, ...mates], foes) * 100);
          const n = foes.length;
          list.push({ kind: 'attack', target: r, p, info: `${ND.FDEF[r].short} — ${n} unit${n > 1 ? 's' : ''}, ~${p}% win${mates.length ? ` with ${mates.length} ally` : ''}` });
        } else if (d.owner === r) {
          list.push({ kind: 'attack', target: r, p: 100, info: `raid ${ND.FDEF[r].short} hold (no defenders)` });
        }
      }
      list.push({ kind: 'hq', info: '150 CR' });
      return list.map((t) => ({ ...t, ...U.taskValid(g, u, t, d) }));
    },
    setTask(g, u, t) {
      const v = U.taskValid(g, u, t);
      if (!v.ok) return v;
      u.task = t.fac != null ? { kind: t.kind, fac: t.fac } : t.target ? { kind: t.kind, target: t.target } : { kind: t.kind };
      return { ok: true };
    },
    taskLabel(g, u) {
      const t = u.task, d = g.districts[u.loc];
      if (t.kind === 'attack') return `Attack: ${ND.FDEF[t.target].name}`;
      return t.fac != null && d.facilities[t.fac] ? `${ND.TASKS[t.kind]}: ${d.facilities[t.fac].name}` : ND.TASKS[t.kind];
    },

    // Step 6: every unit carries out its order.
    resolve(g) {
      for (const u of Object.values(g.units)) { u.repelled = false; u.fought = false; }
      ND.Combat.resolveBattles(g);
      const ids = ND.shuffle(g, Object.keys(g.units));
      for (const id of ids) {
        const u = g.units[id];
        if (!u) continue;
        const d = g.districts[u.loc];
        if (!U.taskValid(g, u, u.task, d).ok) { u.task = { kind: 'rest' }; continue; }
        if (u.repelled) continue;
        if (u.task.kind === 'attack') {
          const defenders = U.at(g, d.id).some((x) => x.fid === u.task.target && !x.injured);
          if (!u.fought && !defenders && d.owner === u.task.target) ND.Combat.raid(g, u, d);
          continue;
        }
        U.perform(g, u, d);
      }
    },
    perform(g, u, d) {
      const f = g.factions[u.fid], s = U.stats(u), t = u.task;
      const tag = `${label(u)} of ${fname(u.fid)}`;
      switch (t.kind) {
        case 'canvass': {
          const got = ND.Inf.add(d, u.fid, U.canvassGain(g, u, d));
          U.gainXp(g, u, 5);
          ND.Log.add(g, { cat: 'unit', who: u.fid, d: d.id, text: `${tag} canvassed ${d.name} (+${got}%).` });
          if (ND.rand(g) * 100 < U.crackdownRisk(g, u, d)) U.injure(g, u, 2, `in a police sweep of ${d.name}`);
          break;
        }
        case 'guard':
          U.gainXp(g, u, ND.Inf.maxRival(d, u.fid) > 0 ? 6 : 3);
          if (u.type === 'engineer' && d.baseSec < 85) d.baseSec++;
          break;
        case 'intel': {
          const n = U.intelYield(g, u);
          f.res.intel += n;
          if (u.type === 'hacker' && d.owner !== u.fid) d.security = Math.max(5, d.security - 3);
          U.gainXp(g, u, 5);
          break;
        }
        case 'train': {
          const c = U.trainCost(u);
          if (f.res.credits >= c) { f.res.credits -= c; U.gainXp(g, u, 30); }
          break;
        }
        case 'hq': {
          f.res.credits -= 150;
          if (f.hq != null) g.districts[f.hq].hq = null;
          d.hq = u.fid; f.hq = d.id;
          d.security = Math.min(95, d.security + 10);
          ND.Log.add(g, { cat: 'control', who: u.fid, d: d.id, public: true, text: `${fname(u.fid)} established its headquarters in ${d.name} [${ND.World.sector(d)}].` });
          u.task = { kind: 'guard' };
          break;
        }
        case 'seize':
        case 'sabotage': {
          const fac = d.facilities[t.fac], prev = fac.owner;
          const chance = U.opChance(g, u, d, t.fac, t.kind);
          const involves = u.fid === g.player || prev === g.player;
          if (ND.rand(g) * 100 < chance) {
            if (t.kind === 'seize') {
              fac.owner = u.fid;
              U.gainXp(g, u, 25);
              ND.Log.add(g, { cat: 'control', who: u.fid, d: d.id, public: involves, text: `${tag} seized the ${fac.name} in ${d.name}${prev ? ` from ${fname(prev)}` : ''}.` });
            } else {
              fac.owner = null;
              d.security = Math.max(5, d.security - 5);
              ND.Inf.sub(d, prev, 5);
              U.gainXp(g, u, 30);
              ND.Log.add(g, { cat: 'conflict', who: u.fid, d: d.id, public: involves, text: `${tag} sabotaged the ${fname(prev)} ${fac.name} in ${d.name}.` });
            }
          } else {
            U.gainXp(g, u, 8);
            ND.Log.add(g, { cat: 'conflict', who: u.fid, d: d.id, public: involves, text: `${tag} failed to ${t.kind} the ${fac.name} in ${d.name} (${chance}% chance).` });
            const deathRisk = t.kind === 'sabotage' ? 0.15 : prev ? 0.1 : 0;
            if (ND.rand(g) < deathRisk) { U.kill(g, u, `killed during a failed ${t.kind} in ${d.name}`); return; }
            if (ND.rand(g) < (t.kind === 'sabotage' ? 0.5 : 0.4)) U.injure(g, u, ND.randInt(g, 2, 3), `during a failed ${t.kind} in ${d.name}`);
          }
          if (g.units[u.id] && !u.injured) u.task = { kind: d.owner === u.fid ? 'guard' : 'canvass' };
          break;
        }
      }
    },

    // Step 9: heal, reset movement, refresh the hiring market.
    newTurn(g, fid) {
      const hospital = g.districts.some((d) => d.type === 'hospital' && d.facilities.some((fc) => fc.owner === fid));
      for (const u of U.list(g, fid)) {
        u.moved = false;
        if (u.injured) {
          u.injured = Math.max(0, u.injured - 1 - (u.type === 'mutant' ? 1 : 0) - (U.has(u, 'heal') ? 1 : 0) - (hospital ? 1 : 0) - (ND.Tech.has(g, fid, 'geneticMod') ? 1 : 0));
          if (!u.injured) ND.Log.add(g, { cat: 'unit', who: fid, d: u.loc, text: `${label(u)} has recovered.` });
        }
      }
      U.refreshMarket(g, fid);
    },

    // Unpaid payroll: the most expensive unit walks out with its gear.
    desert(g, fid) {
      const us = U.list(g, fid).sort((a, b) => (U.upkeep(b).credits || 0) - (U.upkeep(a).credits || 0));
      if (us.length) U.kill(g, us[0], 'unpaid and deserted');
    },
    removeFaction(g, fid) {
      for (const u of U.list(g, fid)) delete g.units[u.id];
      for (const d of g.districts) for (const fc of d.facilities) if (fc.owner === fid) fc.owner = null;
    },
    visibleTo(g, u, p) { return u.fid === p || ND.Log.canSee(g, p, u.loc); },
  });
})(window.ND);
