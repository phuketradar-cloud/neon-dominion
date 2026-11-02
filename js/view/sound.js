// Connects ND.Audio to the game: music per screen, interface sounds, ambience and end-of-turn event sounds.
// Purely presentational — it wraps view functions (screens, dialogs, toasts) and never touches the rules.
// Sounds that depend on whether an action succeeded are played by ui.js right where the result is known.
(function (ND) {
  const A = ND.Audio, $ = (s) => document.querySelector(s);
  const INTERACTIVE = 'button, .btn, [data-cmd], [data-act], [data-screen], [data-mode], [data-setup], .fs-card, a[href]';
  const TABLIKE = '[data-cmd="rtab"], [data-cmd="utab"], [data-cmd="acttab"], [data-cmd="scr"][data-arg="tab"], [data-cmd="scr"][data-arg="sub"], [data-mode], .ctx-tab, .tab';

  const visible = (sel) => { const el = $(sel); return el && !el.classList.contains('hidden'); };

  // Music and ambience follow whatever the player is looking at.
  const sync = () => {
    const UI = ND.UI, S = ND.Screens, g = UI && UI.g;
    if (visible('#start')) { A.stopAmbient(); A.playMusic(SOUND.picked ? 'select' : 'menu', SOUND.picked ? ND.Main.picked : null); return; }
    if (visible('#setupscr')) { A.stopAmbient(); A.playMusic('select', ND.Main.picked); return; }
    if (!g || !visible('#game')) return;
    A.playAmbient();
    if (S.cur === 'gameover' && g.over) A.playMusic(g.over.result === 'victory' ? 'victory' : 'defeat', g.over.result === 'victory' ? g.player : null);
    else if (S.cur === 'battles') A.playMusic('battle');
    else A.playMusic('city', g.player);
  };

  const SOUND = (ND.Sound = {
    picked: false, // a faction card was chosen on the opening screen
    snap: null,
    sync,

    init() {
      A.initialize();
      // interface clicks and hovers
      document.addEventListener('click', (e) => {
        if (e.target.closest('[data-audio-toggle]')) { A.toggleMute(); return; }
        const el = e.target.closest(INTERACTIVE);
        if (!el || el.disabled || el.matches('[data-screen], [data-cmd="close"], .fs-card')) return; // screens/cards have their own sounds
        A.sfx(el.matches(TABLIKE) ? 'tab' : 'click');
      }, true);
      let hovered = null;
      document.addEventListener('pointerover', (e) => {
        const el = e.target.closest(INTERACTIVE);
        if (el === hovered) return;
        hovered = el;
        if (el && !el.disabled && e.pointerType !== 'touch') A.sfx('hover');
      });
      // faction cards on the opening screen
      document.addEventListener('click', (e) => {
        const card = e.target.closest('#start .fs-card');
        if (!card) return;
        SOUND.picked = true;
        A.sfx('faction', { fid: card.dataset.fid, force: true });
        setTimeout(sync, 0);
      });
      // audio settings controls ([data-audio-vol] sliders, [data-audio-flag] checkboxes)
      document.addEventListener('input', (e) => {
        const k = e.target.dataset && e.target.dataset.audioVol;
        if (k) { A.setPref(k, Number(e.target.value) / 100); const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = e.target.value + '%'; }
      });
      document.addEventListener('change', (e) => {
        const d = e.target.dataset || {};
        if (d.audioVol) SOUND.preview(d.audioVol);
        if (d.audioFlag) { A.setPref(d.audioFlag, e.target.checked); if (!e.target.checked || d.audioFlag === 'muted') return; SOUND.preview(d.audioFlag.replace('On', '')); }
      });

      // full screens: sweep in, sweep out, and the right music
      const S = ND.Screens, open = S.open.bind(S), close = S.close.bind(S);
      S.open = (name, opts) => { const was = S.cur; open(name, opts); if (S.cur === name && was !== name) A.sfx(name === 'gameover' ? 'notify' : 'sweep'); sync(); };
      S.close = () => { const was = S.cur; close(); if (was) { A.sfx('back'); sync(); } };
      // dialogs and toasts
      const UI = ND.UI, modal = UI.modal.bind(UI), closeModal = UI.closeModal.bind(UI), toast = UI.toast.bind(UI), start = UI.start.bind(UI);
      UI.modal = (...a) => { modal(...a); A.sfx('modalOpen'); };
      UI.closeModal = () => { const was = !$('#modal').classList.contains('hidden'); closeModal(); if (was) A.sfx('modalClose'); };
      UI.toast = (msg, kind) => { toast(msg, kind); if (kind === 'err') A.sfx('error'); };
      UI.start = (g) => { start(g); setTimeout(sync, 0); };
      // opening screens
      const M = ND.Main, showStart = M.showStart.bind(M), showSetup = M.showSetup.bind(M);
      M.showStart = () => { showStart(); SOUND.picked = false; A.renderToggles(); sync(); };
      M.showSetup = () => { showSetup(); A.sfx('sweep'); sync(); };
    },

    preview(kind) {
      if (kind === 'ambient') { if (A.amb) A.ambientEvent(); else A.sfx('notify'); }
      else if (kind === 'music') A.sfx('faction', { fid: ND.UI.g ? ND.UI.g.player : ND.Main.picked });
      else A.sfx('notify');
    },

    // ---------- end of turn: sounds for what really happened to the player ----------
    beforeTurn(g) {
      const p = g.player, f = g.factions[p];
      this.snap = {
        owned: new Set(ND.World.owned(g, p).map((d) => d.id)),
        tech: f.tech.done.length,
        units: Object.fromEntries(ND.Units.list(g, p).map((u) => [u.id, u.injured])),
        battle: g.battles[0] ? g.battles[0].id : 0,
        credits: f.res.credits,
      };
      A.sfx('endTurn', { force: true });
    },
    afterTurn(g) {
      const s = this.snap, p = g.player, f = g.factions[p];
      this.snap = null;
      if (!s || g.over) return; // the result screen brings its own music
      const ev = [];
      const owned = ND.World.owned(g, p).map((d) => d.id);
      if (owned.some((id) => !s.owned.has(id))) ev.push('capture');
      if ([...s.owned].some((id) => !owned.includes(id))) ev.push('lost');
      const mine = g.battles.filter((b) => b.id > s.battle && (b.att.fid === p || b.def.fid === p));
      if (mine.length) ev.push(mine.some((b) => b.winner === p) ? 'battleWin' : 'battleLoss');
      if (f.tech.done.length > s.tech) ev.push('techDone');
      const now = Object.fromEntries(ND.Units.list(g, p).map((u) => [u.id, u.injured]));
      if (Object.keys(s.units).some((id) => !(id in now))) ev.push('death');
      else if (Object.keys(now).some((id) => now[id] && !s.units[id])) ev.push('injure');
      if (Object.keys(now).some((id) => s.units[id] && !now[id])) ev.push('recover');
      const dc = f.res.credits - s.credits;
      if (dc > 0) ev.push('income'); else if (dc < 0) ev.push('resDown');
      ev.slice(0, 4).forEach((name, i) => A.sfx(name, { delay: 0.55 + i * 0.4, force: true }));
    },
  });
})(window.ND);
