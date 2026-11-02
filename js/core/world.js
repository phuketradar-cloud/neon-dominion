// World model: influence math, map queries, map generation and the event log.
(function (ND) {
  const R = ND.RULES;

  // Influence is an integer share per faction; the remainder (100 - sum) is neutral/unaligned.
  ND.Inf = {
    total(d) { let s = 0; for (const k in d.inf) s += d.inf[k]; return s; },
    neutral(d) { return 100 - ND.Inf.total(d); },
    get(d, f) { return d.inf[f] || 0; },
    clean(d) { for (const k in d.inf) if (d.inf[k] <= 0) delete d.inf[k]; },
    // Gain only from the unaligned share.
    addNeutral(d, f, amt) {
      const take = Math.max(0, Math.min(amt, ND.Inf.neutral(d)));
      if (take > 0) d.inf[f] = (d.inf[f] || 0) + take;
      return take;
    },
    // Gain from the unaligned share first, then pry it away from the strongest rival.
    add(d, f, amt) {
      let got = ND.Inf.addNeutral(d, f, amt);
      let need = amt - got;
      while (need > 0) {
        let big = null;
        for (const k in d.inf) if (k !== f && d.inf[k] > 0 && (!big || d.inf[k] > d.inf[big])) big = k;
        if (!big) break;
        d.inf[big]--; d.inf[f] = (d.inf[f] || 0) + 1; need--; got++;
      }
      ND.Inf.clean(d);
      return got;
    },
    sub(d, f, amt) {
      const v = d.inf[f] || 0, t = Math.min(v, amt);
      d.inf[f] = v - t;
      ND.Inf.clean(d);
      return t;
    },
    ranked(d) { return Object.keys(d.inf).map((f) => [f, d.inf[f]]).sort((a, b) => b[1] - a[1]); },
    leader(d) { const r = ND.Inf.ranked(d); return r.length ? r[0][0] : null; },
    contested(d) { return ND.Inf.ranked(d).filter((e) => e[1] >= 20).length >= 2; },
    // Faction that meets the capture rule (>= captureMin and >= captureMargin ahead), if any.
    captureCandidate(d) {
      const r = ND.Inf.ranked(d);
      if (!r.length) return null;
      const second = r[1] ? r[1][1] : 0;
      return r[0][1] >= R.captureMin && r[0][1] - second >= R.captureMargin ? r[0][0] : null;
    },
    maxRival(d, f) { let m = 0; for (const k in d.inf) if (k !== f && d.inf[k] > m) m = d.inf[k]; return m; },
  };

  const HQ_POS = [[1, 2], [5, 1], [8, 3], [1, 7], [4, 8], [8, 7]];

  ND.World = {
    at(g, x, y) { return x >= 0 && x < R.gridW && y >= 0 && y < R.gridH ? g.districts[y * R.gridW + x] : null; },
    neighbors(g, d) {
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ND.World.at(g, d.x + dx, d.y + dy)).filter(Boolean);
    },
    owned(g, fid) { return g.districts.filter((d) => d.owner === fid); },
    reachable(g, fid, d) { return d.owner === fid || ND.World.neighbors(g, d).some((n) => n.owner === fid); },
    sector(d) { return String.fromCharCode(65 + d.x) + (d.y + 1); },
    // Grid distance from d to the nearest district controlled by fid (Infinity if none).
    distToFaction(g, fid, d) {
      let best = Infinity;
      for (const o of g.districts) if (o.owner === fid) best = Math.min(best, Math.abs(o.x - d.x) + Math.abs(o.y - d.y));
      return best;
    },

    // opts: { victory: {...overrides of ND.VICTORY_DEFAULTS}, difficulty: 'easy'|'normal'|'hard' }
    create(seed, playerId, opts = {}) {
      const g = {
        version: 1, seed, rng: seed >>> 0, turn: 1, player: playerId,
        factions: {}, order: [], districts: [], history: [], current: { turn: 1, entries: [] },
        lastReport: null, over: null, settings: { autosave: true },
        difficulty: opts.difficulty || 'normal',
        victory: opts.victory ? JSON.parse(JSON.stringify(opts.victory)) : null,
      };
      const used = new Set();
      const typeKeys = Object.keys(ND.TYPES);
      for (let y = 0; y < R.gridH; y++) {
        for (let x = 0; x < R.gridW; x++) {
          let name;
          do { name = ND.pick(g, ND.NAME_A) + ' ' + ND.pick(g, ND.NAME_B); } while (used.has(name));
          used.add(name);
          const type = ND.weighted(g, typeKeys.map((k) => [k, ND.TYPES[k].weight]));
          const T = ND.TYPES[type];
          const sec = ND.randInt(g, T.sec[0], T.sec[1]);
          g.districts.push({
            id: y * R.gridW + x, x, y, name, type,
            pop: ND.randInt(g, T.pop[0], T.pop[1]),
            security: sec, baseSec: sec, dev: 1, owner: null, inf: {},
            facilities: ND.shuffle(g, T.fac.slice()).slice(0, ND.randInt(g, 1, 3)).map((name) => ({ name, owner: null })),
            hq: null,
          });
        }
      }
      const positions = ND.shuffle(g, HQ_POS.slice());
      ND.FACTIONS.forEach((F, i) => {
        g.order.push(F.id);
        g.factions[F.id] = { id: F.id, alive: true, res: { ...R.startRes }, ops: 0, hq: null, captured: 0, lost: 0, eliminatedTurn: null, lastLedger: null };
        const [x, y] = positions[i];
        const d = ND.World.at(g, x, y);
        Object.assign(d, { type: 'corporate', name: F.hqName,
          facilities: [{ name: 'Faction Headquarters', owner: F.id }, { name: 'Command Bunker', owner: F.id }],
          security: 70, baseSec: 70, owner: F.id, inf: { [F.id]: 100 }, hq: F.id });
        g.factions[F.id].hq = d.id;
        ND.World.neighbors(g, d).forEach((n) => { if (!n.owner) ND.Inf.add(n, F.id, 20); });
      });
      g.order.forEach((fid) => { g.factions[fid].ops = ND.Actions.maxOps(g, fid); });
      ND.World.migrate(g);
      return g;
    },

    // Bring a state object up to the current version (also used for older saves).
    migrate(g) {
      if (g.version < 2) {
        for (const d of g.districts) {
          d.facilities = d.facilities.map((fc) => (typeof fc === 'string' ? { name: fc, owner: d.hq || null } : fc));
        }
      }
      if (!g.units) {
        ND.Units.ensure(g);
        g.order.forEach((fid) => { if (g.factions[fid].alive) ND.Units.refreshMarket(g, fid); });
      }
      ND.Units.ensure(g); // adds battle history to Phase 2 saves
      ND.Tech.ensure(g); // research, espionage state (Phase 4)
      ND.Victory.ensure(g); // victory settings (Phase 5); older saves get all conditions on
      ND.Diplo.ensure(g);
      if (!g.difficulty) g.difficulty = 'normal';
      g.version = 5;
      return g;
    },
  };

  // Event log. Each entry records whether the player could observe it when it happened.
  ND.Log = {
    add(g, e) {
      const p = g.player;
      e.seen = e.who === p || !!e.public || ND.Log.canSee(g, p, e.d);
      g.current.entries.push(e);
    },
    canSee(g, p, did) {
      if (did == null || !g.factions[p].alive) return false;
      if (ND.FDEF[p].mods.panopticon) return true;
      const d = g.districts[did];
      if (d.owner === p || ND.Inf.get(d, p) > 0 || ND.World.neighbors(g, d).some((n) => n.owner === p)) return true;
      const f = g.factions[p];
      if (f.spied && f.spied[did] >= g.turn) return true;
      if (ND.Tech && ND.Tech.has(g, p, 'surveillance') && ND.World.distToFaction(g, p, d) <= 2) return true;
      // Your units are eyes on the street: they see their own district and its neighbours.
      const near = new Set([did, ...ND.World.neighbors(g, d).map((n) => n.id)]);
      return !!g.units && Object.values(g.units).some((u) => u.fid === p && near.has(u.loc));
    },
  };
})(window.ND);
