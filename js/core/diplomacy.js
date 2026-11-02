// Diplomacy: relations between factions and non-aggression pacts.
// A pact forbids attacks, covert operations and influence operations against the partner's districts, units and facilities.
(function (ND) {
  const PACT_TURNS = 12;
  const fname = (fid) => ND.FDEF[fid].name;
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const D = (ND.Diplo = {
    PACT_TURNS,
    TURN_CAP: 6,
    ensure(g) {
      if (!g.relations) g.relations = {};
      if (!g.pacts) g.pacts = {};
      if (!g.proposals) g.proposals = [];
      if (!g.diploCooldown) g.diploCooldown = {};
    },
    rel(g, a, b) { return g.relations[key(a, b)] || 0; },
    setRel(g, a, b, v) { g.relations[key(a, b)] = Math.max(-100, Math.min(100, Math.round(v))); },
    pact(g, a, b) { return a !== b && (g.pacts[key(a, b)] || 0) >= g.turn; },
    pactUntil(g, a, b) { return g.pacts[key(a, b)] || 0; },
    stance(g, a, b) {
      if (D.pact(g, a, b)) return 'pact';
      const r = D.rel(g, a, b);
      return r <= -30 ? 'hostile' : r >= 30 ? 'friendly' : 'neutral';
    },

    // Something one faction did to another. Only incidents the victim can attribute should be reported here.
    incident(g, actor, victim, delta) {
      if (!actor || !victim || actor === victim) return;
      // A single turn of fighting can cost at most 6 relations per pair, so wars don't lock relations at −100 forever.
      if (!g.relDelta) g.relDelta = {};
      const k = key(actor, victim), used = g.relDelta[k] || 0;
      const d = delta < 0 ? Math.max(delta, -D.TURN_CAP - used) : delta;
      if (delta < 0) g.relDelta[k] = used + d;
      D.setRel(g, actor, victim, D.rel(g, actor, victim) + d);
    },

    // How much `fid` wants peace with `other` (AI evaluation, also used to answer the player's proposals).
    desire(g, fid, other) {
      const P = ND.FDEF[fid].ai;
      const st = ND.Turn.standings(g);
      const me = st.find((s) => s.fid === fid), them = st.find((s) => s.fid === other);
      let w = D.rel(g, fid, other);
      if (them.score > me.score * 1.2) w += 20;             // fear a stronger neighbour
      if (them.score < me.score * 0.6) w -= 20;             // prey, not partner
      const enemies = g.order.filter((x) => x !== fid && x !== other && g.factions[x].alive && D.rel(g, fid, x) <= -30).length;
      w += enemies * 10;                                     // too many wars already
      const border = g.districts.some((d) => d.owner === fid && ND.World.neighbors(g, d).some((n) => n.owner === other));
      if (border) w += 5;
      w -= (P.aggression - 1) * 40;
      return w;
    },

    sign(g, a, b) {
      g.pacts[key(a, b)] = g.turn + PACT_TURNS;
      D.setRel(g, a, b, Math.max(D.rel(g, a, b), 0) + 10);
      g.proposals = g.proposals.filter((pr) => !(key(pr.from, pr.to) === key(a, b)));
      // Standing orders that the pact now forbids are cancelled.
      for (const u of Object.values(g.units)) {
        if ((u.fid === a || u.fid === b) && !ND.Units.taskValid(g, u, u.task).ok) u.task = { kind: 'rest' };
      }
      ND.Log.add(g, { cat: 'diplo', who: a, public: true, text: `${fname(a)} and ${fname(b)} signed a non-aggression pact (until turn ${g.turn + PACT_TURNS}).` });
    },

    // Breaking a pact early is treachery: the partner is furious and everyone else notices.
    breakPact(g, a, b) {
      if (!D.pact(g, a, b)) return { ok: false, reason: 'No pact to break.' };
      delete g.pacts[key(a, b)];
      D.setRel(g, a, b, D.rel(g, a, b) - 50);
      for (const x of g.order) if (x !== a && x !== b) D.setRel(g, a, x, D.rel(g, a, x) - 10);
      ND.Log.add(g, { cat: 'diplo', who: a, public: true, text: `${fname(a)} broke its pact with ${fname(b)}! Every faction now trusts ${fname(a)} less.` });
      return { ok: true };
    },

    canPropose(g, from, to) {
      if (from === to || !g.factions[to].alive) return { ok: false, reason: 'Not possible.' };
      if (D.pact(g, from, to)) return { ok: false, reason: `Pact in force until turn ${D.pactUntil(g, from, to)}.` };
      const cd = g.diploCooldown[key(from, to)] || 0;
      if (cd > g.turn) return { ok: false, reason: `They refused recently; try again on turn ${cd}.` };
      return { ok: true };
    },

    // The player asks an AI faction for a pact; the AI answers immediately.
    propose(g, from, to) {
      const c = D.canPropose(g, from, to);
      if (!c.ok) return c;
      if (D.desire(g, to, from) > 15) { D.sign(g, from, to); return { ok: true, accepted: true }; }
      g.diploCooldown[key(from, to)] = g.turn + 4;
      D.setRel(g, from, to, D.rel(g, from, to) - 2);
      return { ok: true, accepted: false };
    },
    // The player answers an AI's proposal.
    answer(g, from, accept) {
      const pr = g.proposals.find((x) => x.from === from && x.to === g.player);
      if (!pr) return { ok: false, reason: 'That offer has expired.' };
      if (accept) D.sign(g, from, g.player);
      else {
        g.proposals = g.proposals.filter((x) => x !== pr);
        D.setRel(g, from, g.player, D.rel(g, from, g.player) - 5);
        g.diploCooldown[key(from, g.player)] = g.turn + 4;
      }
      return { ok: true };
    },

    // AI step: propose pacts, accept others' proposals, and occasionally betray a weak partner.
    aiTurn(g, fid) {
      const P = ND.FDEF[fid].ai;
      for (const other of g.order) {
        if (other === fid || !g.factions[other].alive) continue;
        if (D.pact(g, fid, other)) {
          const mine = ND.World.owned(g, fid).length, theirs = ND.World.owned(g, other).length;
          if (P.aggression >= 1.1 && theirs < mine * 0.5 && ND.rand(g) < 0.08) D.breakPact(g, fid, other);
          continue;
        }
        if (!D.canPropose(g, fid, other).ok || D.desire(g, fid, other) <= 20 || ND.rand(g) > 0.1) continue;
        if (other === g.player) {
          if (!g.proposals.some((x) => x.from === fid)) {
            g.proposals.push({ from: fid, to: other, turn: g.turn + 1 });
            ND.Log.add(g, { cat: 'diplo', who: fid, public: true, text: `${fname(fid)} offers you a non-aggression pact (answer in Diplomacy or the briefing this turn).` });
          }
        } else if (D.desire(g, other, fid) > 15) D.sign(g, fid, other);
        else g.diploCooldown[key(fid, other)] = g.turn + 4;
      }
    },

    // Step 8: relations heal slowly, pacts warm them, expired pacts and stale offers are cleaned up.
    update(g) {
      for (const k of Object.keys(g.relations)) {
        const [a, b] = k.split('|');
        let r = g.relations[k];
        if (D.pact(g, a, b)) r = Math.min(50, r + 1);
        else if (r < 0) r = Math.min(0, r + 3);
        else if (r > 0) r -= 1;
        g.relations[k] = r;
      }
      for (const k of Object.keys(g.pacts)) {
        if (g.pacts[k] < g.turn) {
          const [a, b] = k.split('|');
          delete g.pacts[k];
          ND.Log.add(g, { cat: 'diplo', who: a, public: a === g.player || b === g.player, text: `The pact between ${fname(a)} and ${fname(b)} has expired.` });
        }
      }
      g.proposals = g.proposals.filter((pr) => pr.turn > g.turn);
      g.relDelta = {};
    },
  });
})(window.ND);
