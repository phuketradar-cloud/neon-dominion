// Save/load to localStorage. The whole game state is plain JSON (including RNG state).
(function (ND) {
  const PREFIX = 'neon-dominion:v1:';
  ND.Save = {
    slots: ['auto', '1', '2', '3'],
    save(g, slot) {
      try {
        localStorage.setItem(PREFIX + slot, JSON.stringify(g));
        localStorage.setItem(PREFIX + slot + ':meta', JSON.stringify({ turn: g.turn, faction: g.player, date: Date.now(), over: !!g.over }));
        return true;
      } catch (e) { return false; }
    },
    load(slot) {
      try {
        const s = localStorage.getItem(PREFIX + slot);
        if (!s) return null;
        const g = JSON.parse(s);
        return g && g.version >= 1 && g.version <= 5 && Array.isArray(g.districts) ? ND.World.migrate(g) : null;
      } catch (e) { return null; }
    },
    meta(slot) {
      try { return JSON.parse(localStorage.getItem(PREFIX + slot + ':meta') || 'null'); } catch (e) { return null; }
    },
    remove(slot) {
      try { localStorage.removeItem(PREFIX + slot); localStorage.removeItem(PREFIX + slot + ':meta'); } catch (e) { /* ignore */ }
    },
  };
})(window.ND);
