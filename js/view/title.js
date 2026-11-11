// Title screen: "press any key" splash, then the main menu (Continue, New Game, Load, Tutorial, Settings, Credits).
// The first key press / click also unlocks audio (browser rule), so the opening music starts with the menu.
(function (ND) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERSION = 'v1.0';
  const CREDITS = [
    ['Game', 'Neon Dominion — a turn-based cyberpunk strategy game'],
    ['Concept & art direction', 'phuketradar-cloud'],
    ['Illustrations', 'Faction leaders, recruits and title art created for Neon Dominion'],
    ['Music', 'Opening and gameplay themes; battle, victory and defeat themes synthesised in real time'],
    ['Sound', 'Interface effects and city ambience synthesised with the Web Audio API'],
    ['Code', 'HTML5 · CSS · JavaScript, no external libraries — built with Claude (Anthropic)'],
  ];
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  const saveLine = (m) => `Turn ${m.turn} · ${esc(ND.FDEF[m.faction].name)} · ${ago(m.date)}${m.over ? ' · finished' : ''}`;

  const T = (ND.Title = {
    stage: 'press', // press | menu
    panel: null, // null | load | settings | credits
    focus: 0,

    show(stage) {
      this.stage = stage || (ND.Audio && ND.Audio.ctx ? 'menu' : 'press'); // returning players skip the splash
      this.panel = null;
      ['#start', '#setupscr', '#game'].forEach((s) => $(s).classList.add('hidden'));
      $('#title').classList.remove('hidden');
      this.render();
    },
    hide() { $('#title').classList.add('hidden'); },
    isOpen() { return !$('#title').classList.contains('hidden'); },

    items() {
      const auto = ND.Save.meta('auto'), anySave = ND.Save.slots.some((s) => ND.Save.meta(s));
      return [
        { k: 'continue', label: 'Continue', sub: auto ? saveLine(auto) : 'No saved game yet', off: !auto },
        { k: 'new', label: 'New Game', sub: 'Choose your faction and take the city' },
        { k: 'load', label: 'Load Game', sub: anySave ? 'Autosave and slots 1–3' : 'No saves yet', off: !anySave },
        { k: 'tutorial', label: 'Tutorial · บทเรียน', sub: 'Interactive lessons in Thai — a separate practice game' },
        { k: 'settings', label: 'Settings', sub: 'Music, effects and ambience' },
        { k: 'credits', label: 'Credits', sub: 'Who made Neon Dominion' },
      ];
    },

    render() {
      const el = $('#title');
      el.className = `app-screen stage-${this.stage}${this.panel ? ' has-panel' : ''}`;
      const logo = `<h1 class="ti-logo" aria-label="Neon Dominion"><span class="ti-neon" data-text="NEON">NEON</span><span class="ti-dom" data-text="DOMINION">DOMINION</span></h1>`;
      let body;
      if (this.stage === 'press') {
        body = `<div class="ti-center">${logo}<p class="ti-tag">Six factions. One city. No mercy.</p>
          <button class="ti-press" data-title="enter">Press any key to start</button></div>`;
      } else {
        const its = this.items();
        this.focus = Math.min(this.focus, its.length - 1);
        if (its[this.focus].off) this.focus = its.findIndex((x) => !x.off);
        body = `<div class="ti-side">${logo}<p class="ti-tag">Six factions. One city. No mercy.</p>
          <nav class="ti-menu" aria-label="Main menu">${its.map((x, i) => `
            <button class="ti-item ${i === this.focus ? 'on' : ''} ${this.panel === x.k ? 'open' : ''}" data-title="${x.k}" data-i="${i}" ${x.off ? 'disabled' : ''}>
              <span class="ti-l">${esc(x.label)}</span><span class="ti-s">${x.sub}</span></button>`).join('')}</nav></div>
          ${this.panel ? `<section class="ti-panel">${this.panelHtml()}</section>` : ''}`;
      }
      el.innerHTML = `<div class="ti-bg" aria-hidden="true"></div><div class="ti-rain" aria-hidden="true"></div><div class="ti-shade" aria-hidden="true"></div>
        <div class="ti-body">${body}</div>
        <footer class="ti-foot"><span>${VERSION}</span></footer>`;
    },

    panelHtml() {
      const head = (t) => `<header class="ti-ph"><h2>${t}</h2><button class="btn sm" data-title="close">Close</button></header>`;
      if (this.panel === 'load') {
        return head('Load game') + `<div class="ti-slots">${ND.Save.slots.map((s) => {
          const m = ND.Save.meta(s);
          return `<div class="ti-slot ${m ? '' : 'empty'}"><b>${s === 'auto' ? 'Autosave' : 'Slot ' + s}</b>
            <span class="dim">${m ? saveLine(m) : 'Empty'}</span>
            <button class="btn ${m ? 'primary' : ''} sm" data-title-load="${s}" ${m ? '' : 'disabled'}>Load</button></div>`;
        }).join('')}</div>`;
      }
      if (this.panel === 'settings') return head('Settings') + ND.Sound.settingsHtml();
      return head('Credits') + `<dl class="ti-credits">${CREDITS.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`;
    },

    run(k) {
      const S = ND.Save;
      if (k === 'enter') { this.stage = 'menu'; this.render(); ND.Sound.sync(); return; }
      if (k === 'close') { this.panel = null; this.render(); return; }
      if (k === 'continue') { const g = S.load('auto'); if (g) { this.hide(); ND.UI.start(g); } return; }
      if (k === 'new') { this.hide(); ND.Main.showStart(); return; }
      if (k === 'tutorial') { this.hide(); ND.Tutorial.startGame(); return; }
      if (['load', 'settings', 'credits'].includes(k)) { this.panel = this.panel === k ? null : k; this.focus = this.items().findIndex((x) => x.k === k); this.render(); }
    },

    init() {
      document.addEventListener('click', (e) => {
        if (!this.isOpen()) return;
        const ld = e.target.closest('[data-title-load]');
        if (ld) { const g = ND.Save.load(ld.dataset.titleLoad); if (g) { this.hide(); ND.UI.start(g); } return; }
        const b = e.target.closest('[data-title]');
        if (b && !b.disabled) { this.run(b.dataset.title); return; }
        if (this.stage === 'press') this.run('enter');
      });
      document.addEventListener('keydown', (e) => {
        if (!this.isOpen() || e.target.matches('input, select, textarea')) return;
        if (this.stage === 'press') { if (!['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) { e.preventDefault(); this.run('enter'); } return; }
        const its = this.items(), step = (d) => { let i = this.focus; do { i = (i + d + its.length) % its.length; } while (its[i].off && i !== this.focus); this.focus = i; this.render(); };
        if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
        else if (e.key === 'Enter' || e.key === ' ') { if (document.activeElement && document.activeElement.matches('.ti-item, button')) return; e.preventDefault(); this.run(its[this.focus].k); }
        else if (e.key === 'Escape') { if (this.panel) this.run('close'); else { this.stage = 'press'; this.render(); } }
      });
      document.addEventListener('mouseover', (e) => {
        const it = this.isOpen() && e.target.closest('.ti-item');
        if (it && !it.disabled && Number(it.dataset.i) !== this.focus) { this.focus = Number(it.dataset.i); document.querySelectorAll('.ti-item').forEach((x) => x.classList.toggle('on', x === it)); }
      });
      // gentle parallax on the city art
      document.addEventListener('mousemove', (e) => {
        if (!this.isOpen()) return;
        const el = $('#title');
        el.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * -14).toFixed(1) + 'px');
        el.style.setProperty('--py', ((e.clientY / innerHeight - 0.5) * -10).toFixed(1) + 'px');
      });
    },
  });
})(window.ND);
