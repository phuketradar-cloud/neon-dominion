// Black market exchange: trade energy, materials and intel against credits in lots of 50.
// Controlled Black Market districts improve the rates.
(function (ND) {
  const LOT = 50;
  const BASE = { energy: 0.5, materials: 0.5, intel: 0.8 }; // credits paid per unit sold

  const M = (ND.Market = {
    LOT,
    goods: Object.keys(BASE),
    bonus(g, fid) {
      return Math.min(0.25, 0.05 * g.districts.filter((d) => d.owner === fid && d.type === 'blackmarket').length);
    },
    sellPrice(g, fid, r) { return Math.round(LOT * BASE[r] * (1 + M.bonus(g, fid))); },
    buyPrice(g, fid, r) { return Math.round(LOT * BASE[r] * 2.2 * (1 - M.bonus(g, fid) / 2)); },
    sell(g, fid, r) {
      const f = g.factions[fid];
      if (f.res[r] < LOT) return { ok: false, reason: `You need ${LOT} ${ND.RES_LABEL[r]} to sell.` };
      const p = M.sellPrice(g, fid, r);
      f.res[r] -= LOT;
      f.res.credits += p;
      return { ok: true, msg: `Sold ${LOT} ${ND.RES_LABEL[r]} for ${p} credits.` };
    },
    buy(g, fid, r) {
      const f = g.factions[fid], p = M.buyPrice(g, fid, r);
      if (f.res.credits < p) return { ok: false, reason: `You need ${p} credits.` };
      f.res.credits -= p;
      f.res[r] += LOT;
      return { ok: true, msg: `Bought ${LOT} ${ND.RES_LABEL[r]} for ${p} credits.` };
    },
    // AI: sell whatever it is hoarding beyond a working reserve.
    aiTrade(g, fid) {
      const f = g.factions[fid];
      for (const r of M.goods) {
        let guard = 20;
        while (f.res[r] - LOT >= 200 && guard--) M.sell(g, fid, r);
      }
    },
  });
})(window.ND);
