// Seeded RNG (mulberry32). State lives on the game object so saves are reproducible.
window.ND = window.ND || {};
(function (ND) {
  ND.rand = function (g) {
    const a = (g.rng + 0x6D2B79F5) | 0;
    g.rng = a >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ND.randInt = (g, lo, hi) => lo + Math.floor(ND.rand(g) * (hi - lo + 1));
  ND.pick = (g, arr) => arr[Math.floor(ND.rand(g) * arr.length)];
  ND.shuffle = (g, arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(ND.rand(g) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  ND.weighted = (g, pairs) => {
    const tot = pairs.reduce((s, p) => s + p[1], 0);
    let r = ND.rand(g) * tot;
    for (const [k, w] of pairs) if ((r -= w) < 0) return k;
    return pairs[pairs.length - 1][0];
  };
  ND.hashStr = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
})(window.ND);
