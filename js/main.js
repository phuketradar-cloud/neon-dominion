// Boot, faction selection and new-game setup (V3). Each fits one viewport.
(function (ND) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Short pitch per faction: one identity line + three characteristics (two strengths, one weakness).
  const PITCH = {
    syndicate: { line: 'A criminal corporation that buys cities instead of fighting for them.', traits: [['+', 'Richer districts (+10% credits)'], ['+', 'Bribes cost 25% less'], ['−', 'Weaker influence campaigns']] },
    legion: { line: 'A rogue army that holds every block behind steel and checkpoints.', traits: [['+', 'Cheaper, stronger fortifications'], ['+', 'Heavy weapons doctrine in battle'], ['−', 'Slightly lower credit income']] },
    cult: { line: 'Techno-mystics who see everything through the city\'s cameras.', traits: [['+', 'Sees every rival move and treasury'], ['+', 'Huge intel income, sharper campaigns'], ['−', 'Short on materials']] },
    mutants: { line: 'Gene-hacked outcasts spreading through the city like an infection.', traits: [['+', 'Territory regrows influence fast'], ['+', 'Tough units that rarely die'], ['−', 'Every district drinks extra energy']] },
    shadow: { line: 'Spies and assassins who own the city\'s secrets.', traits: [['+', 'Bribes cut security deep'], ['+', 'Ambushes and strong covert ops'], ['−', 'Slightly lower credit income']] },
    reapers: { line: 'The biggest street gang in the city — and still growing.', traits: [['+', 'Cheaper, stronger campaigns'], ['+', 'Residential blocks pay more'], ['−', 'Fickle loyalty, costly development']] },
  };

  ND.Main = {
    picked: ND.FACTIONS[0].id,
    setup: null,

    // Backdrop art per faction (assets/factions/bg-<fid>.webp). Factions not listed keep the plain gradient.
    BACKDROPS: { syndicate: 'assets/factions/bg-syndicate.webp', legion: 'assets/factions/bg-legion.jpg', mutants: 'assets/factions/bg-mutants.jpg' },
    bgFid: null,
    backdrop(fid) {
      if (this.bgFid === fid) return;
      this.bgFid = fid;
      const [a, b] = document.querySelectorAll('#fsbg .fsbg-l'), next = a.classList.contains('on') ? b : a;
      const url = this.BACKDROPS[fid];
      next.style.backgroundImage = url ? `url("${url}")` : 'none';
      next.classList.add('on');
      (next === a ? b : a).classList.remove('on'); // the old layer fades out underneath
    },

    // ---------- faction selection ----------
    showStart() {
      $('#setupscr').classList.add('hidden');
      $('#title').classList.add('hidden');
      $('#start').classList.remove('hidden');
      this.renderStart();
    },
    renderStart() {
      const F = ND.FDEF[this.picked], P = PITCH[this.picked], TH = ND.FACTION_THEME[this.picked];
      this.backdrop(this.picked);
      $('#start').innerHTML = `
        <header class="menu-head">
          <div class="brand"><span class="brand-mark"></span><span class="brand-t">NEON <b>DOMINION</b></span></div>
          <div class="menu-right">
            <button class="btn" id="btn-menu" title="Back to the main menu (Esc)">‹ Main menu</button>
          </div>
        </header>
        <main class="fs-stage" style="--fc:${F.color}">
          <div class="fs-art"><canvas id="fs-art"></canvas><span class="fs-emblem">${ND.emblemSvg(this.picked)}</span></div>
          <div class="fs-info">
            <div class="fs-kicker">Choose your empire</div>
            <h1 class="fs-name">${esc(F.name)}</h1>
            <div class="fs-leader">${esc(F.leader)} · <i>“${esc(F.motto)}”</i></div>
            <p class="fs-line">${esc(P.line)}</p>
            <ul class="fs-traits">${P.traits.map(([k, t]) => `<li class="${k === '+' ? 'good' : 'bad'}">${ND.icon(k === '+' ? 'check' : 'warn')}<span>${esc(t)}</span></li>`).join('')}</ul>
            <div class="fs-ability"><span>Special ability</span>${esc(F.ability.split(' — ')[0])}</div>
            <button class="btn primary big fs-go" id="btn-next">${ND.icon('end')}Select ${esc(F.name)}</button>
            <div class="fs-tag">${esc(TH.tagline)}</div>
          </div>
        </main>
        <nav class="fs-roster" id="pick">${ND.FACTIONS.map((x) => `
          <button class="fs-card ${x.id === this.picked ? 'on' : ''}" data-fid="${x.id}" style="--fc:${x.color}" title="${esc(x.name)}">
            <canvas data-fig="leader|${x.id}"></canvas>
            <span class="fsc-name">${ND.emblemSvg(x.id)}${esc(x.name)}</span>
          </button>`).join('')}</nav>`;
      ND.applyIcons($('#start'));
      this.paintArt();
    },
    paintArt() {
      const dpr = window.devicePixelRatio || 1;
      const art = $('#fs-art');
      if (art) { art.width = art.clientWidth * dpr; art.height = art.clientHeight * dpr; ND.drawPortrait(art, this.picked); }
      document.querySelectorAll('#start canvas[data-fig]').forEach((cv) => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; ND.drawPortrait(cv, cv.dataset.fig.split('|')[1]); });
    },

    // ---------- new game setup ----------
    showSetup() {
      if (!this.setup) {
        this.setup = { difficulty: 'normal', victory: JSON.parse(JSON.stringify(ND.VICTORY_DEFAULTS)), seed: Math.floor(Math.random() * 1e9), adv: false };
      }
      $('#start').classList.add('hidden');
      $('#title').classList.add('hidden');
      $('#setupscr').classList.remove('hidden');
      this.backdrop(this.picked);
      this.renderSetup();
    },
    renderSetup() {
      const s = this.setup, F = ND.FDEF[this.picked], V = s.victory;
      const VIC_ICON = { territorial: 'factions', domination: 'battles', economic: 'credits', tech: 'research', political: 'influence' };
      const DIFF_ICON = { easy: 'check', normal: 'ops', hard: 'warn' };
      const anyOn = Object.values(V).some((v) => v.on);
      $('#setupscr').innerHTML = `
        <header class="menu-head">
          <button class="btn" data-setup="back">‹ Back to factions</button>
          <h1 class="menu-title">${ND.icon('settings')}New Game Setup</h1>
          <span></span>
        </header>
        <main class="setup-stage">
          <aside class="setup-faction" style="--fc:${F.color}">
            <canvas id="setup-art"></canvas>
            <div class="sf-info"><span class="sf-k">Your faction</span><b>${ND.emblemSvg(this.picked)}${esc(F.name)}</b><span>${esc(F.leader)}</span>
              <span class="dim small">${esc(PITCH[this.picked].line)}</span></div>
          </aside>
          <section class="setup-opts">
            <h2>Difficulty</h2>
            <div class="opt-row">${Object.entries(ND.DIFFICULTY).map(([k, d]) => `
              <button class="opt-card ${s.difficulty === k ? 'on' : ''}" data-setup="diff" data-v="${k}">${ND.icon(DIFF_ICON[k])}<b>${d.label}</b><span>${esc(d.desc)}</span></button>`).join('')}</div>
            <h2>Victory conditions <span class="dim small">— pick at least one</span></h2>
            <div class="opt-row five">${Object.keys(ND.VICTORY_INFO).map((k) => `
              <button class="opt-card ${V[k].on ? 'on' : ''}" data-setup="vic" data-v="${k}" title="${esc(ND.VICTORY_INFO[k].desc(V[k]))}">${ND.icon(VIC_ICON[k])}<b>${ND.VICTORY_INFO[k].name.replace(' Supremacy', '').replace('Total ', '')}</b><span>${esc(ND.VICTORY_INFO[k].desc(V[k]))}</span><i class="tick">${V[k].on ? '✓' : ''}</i></button>`).join('')}</div>
            <div class="opt-info">${ND.icon('factions')}<span>Opponents: <b>5 rival factions</b> — every faction is always in play in this version.</span></div>
            <button class="adv-toggle" data-setup="adv">${s.adv ? '▾' : '▸'} Advanced settings</button>
            ${s.adv ? `<div class="adv-panel">
              <label>Territorial target <input type="number" data-setup-in="territorial.share" value="${V.territorial.share}" min="25" max="90" step="5"> % of districts</label>
              <label>Economic target <input type="number" data-setup-in="economic.target" value="${V.economic.target}" min="2000" max="50000" step="500"> credits</label>
              <label>Political: <input type="number" data-setup-in="political.min" value="${V.political.min}" min="10" max="50" step="5"> % influence in <input type="number" data-setup-in="political.districts" value="${V.political.districts}" min="20" max="100" step="5"> districts</label>
              <label>City seed <input type="number" data-setup-in="seed" value="${s.seed}"></label>
            </div>` : ''}
          </section>
        </main>
        <footer class="setup-foot">
          <span id="setup-err" class="neg">${anyOn ? '' : 'Enable at least one victory condition.'}</span>
          <button class="btn primary big" id="btn-new" ${anyOn ? '' : 'disabled'}>${ND.icon('end')}Start game</button>
        </footer>`;
      const dpr = window.devicePixelRatio || 1, art = $('#setup-art');
      art.width = art.clientWidth * dpr; art.height = art.clientHeight * dpr; ND.drawPortrait(art, this.picked);
    },
    readSetupInputs() {
      document.querySelectorAll('[data-setup-in]').forEach((inp) => {
        const key = inp.dataset.setupIn, x = Number(inp.value);
        if (!Number.isFinite(x)) return;
        if (key === 'seed') { this.setup.seed = x; return; }
        const [a, b] = key.split('.');
        const lim = { 'territorial.share': [25, 90], 'economic.target': [2000, 50000], 'political.min': [10, 50], 'political.districts': [20, 100] }[key];
        this.setup.victory[a][b] = Math.max(lim[0], Math.min(lim[1], Math.round(x)));
      });
    },
    startGame() {
      this.readSetupInputs();
      const s = this.setup;
      if (!Object.values(s.victory).some((v) => v.on)) return;
      const g = ND.World.create(s.seed || Math.floor(Math.random() * 1e9), this.picked, { victory: s.victory, difficulty: s.difficulty });
      if (g.settings.autosave) ND.Save.save(g, 'auto');
      this.setup = null;
      ND.UI.start(g);
    },

    init() {
      ND.UI.init();
      for (const url of Object.values(this.BACKDROPS)) new Image().src = url; // ready before the first crossfade
      ND.Title.init();
      ND.Sound.init();
      document.addEventListener('click', (e) => {
        const card = e.target.closest('#start .fs-card');
        if (card) { this.picked = card.dataset.fid; this.renderStart(); return; }
        if (e.target.closest('#btn-next')) { this.setup = null; this.showSetup(); return; }
        if (e.target.closest('#btn-menu')) { ND.Title.show('menu'); return; }
        const st = e.target.closest('#setupscr [data-setup]');
        if (st) {
          this.readSetupInputs();
          const k = st.dataset.setup, v = st.dataset.v;
          if (k === 'back') { this.showStart(); return; }
          if (k === 'diff') this.setup.difficulty = v;
          if (k === 'vic') this.setup.victory[v].on = !this.setup.victory[v].on;
          if (k === 'adv') this.setup.adv = !this.setup.adv;
          this.renderSetup();
          return;
        }
        if (e.target.closest('#btn-new')) this.startGame();
      });
      window.addEventListener('resize', () => {
        if (!$('#start').classList.contains('hidden')) this.paintArt();
        if (!$('#setupscr').classList.contains('hidden')) this.renderSetup();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#start').classList.contains('hidden')) ND.Title.show('menu'); });
      ND.Title.show();
    },
  };

  window.addEventListener('DOMContentLoaded', () => ND.Main.init());
})(window.ND);
