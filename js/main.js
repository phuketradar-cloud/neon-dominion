// Boot and main menu (faction selection, new game, continue).
(function (ND) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  ND.Main = {
    picked: ND.FACTIONS[0].id,

    showStart() {
      $('#start').classList.remove('hidden');
      $('#seed').value = Math.floor(Math.random() * 1e9);
      $('#pick').innerHTML = ND.FACTIONS.map((F) => `
        <button class="pick ${F.id === this.picked ? 'on' : ''}" data-fid="${F.id}" style="--fc:${F.color}">
          <canvas width="80" height="80" data-fid="${F.id}"></canvas>
          <span class="pick-name">${esc(F.name)}</span>
          <span class="pick-leader">${esc(F.leader)}</span>
          <span class="pick-txt"><b>+</b> ${esc(F.ability)}</span>
          <span class="pick-txt"><b>$</b> ${esc(F.economy)}</span>
          <span class="pick-txt bad"><b>−</b> ${esc(F.weakness)}</span>
        </button>`).join('');
      document.querySelectorAll('#pick canvas').forEach((c) => ND.drawPortrait(c, c.dataset.fid));
      this.renderSetup();
      const m = ND.Save.meta('auto');
      $('#btn-continue').disabled = !m;
      $('#continue-info').textContent = m ? `Turn ${m.turn} · ${ND.FDEF[m.faction].name}${m.over ? ' · finished' : ''}` : 'No autosave';
      const slots = ['1', '2', '3'].map((s) => [s, ND.Save.meta(s)]).filter((x) => x[1]);
      $('#load-slots').innerHTML = slots.length
        ? slots.map(([s, m2]) => `<button class="btn sm" data-load="${s}">Slot ${s}: T${m2.turn} ${esc(ND.FDEF[m2.faction].short)}</button>`).join('')
        : '';
    },

    // Game setup: difficulty and which victory conditions are in play (with their targets).
    renderSetup() {
      const V = ND.VICTORY_DEFAULTS;
      const num = (id, val, min, max, step, suffix) =>
        `<input type="number" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}"> ${suffix}`;
      const params = {
        territorial: num('v-territorial-share', V.territorial.share, 25, 90, 5, '% of districts'),
        domination: '',
        economic: num('v-economic-target', V.economic.target, 2000, 50000, 500, 'credits'),
        tech: '',
        political: `${num('v-political-min', V.political.min, 10, 50, 5, '% influence in')} ${num('v-political-districts', V.political.districts, 20, 100, 5, 'districts')}`,
      };
      $('#setup').innerHTML = `
        <div class="setup-col">
          <h3>Difficulty</h3>
          ${Object.entries(ND.DIFFICULTY).map(([k, d]) => `<label class="check"><input type="radio" name="difficulty" value="${k}" ${k === 'normal' ? 'checked' : ''}> <b>${d.label}</b> <span class="dim small">${esc(d.desc)}</span></label>`).join('')}
        </div>
        <div class="setup-col wide">
          <h3>Victory conditions <span class="dim small">(at least one)</span></h3>
          ${Object.keys(ND.VICTORY_INFO).map((k) => `<div class="vrow"><label class="check"><input type="checkbox" id="v-${k}" ${V[k].on ? 'checked' : ''}> <b>${ND.VICTORY_INFO[k].name}</b></label>
            <span class="small">${params[k] || `<span class="dim">${esc(ND.VICTORY_INFO[k].desc(V[k]))}</span>`}</span></div>`).join('')}
        </div>`;
    },

    readSetup() {
      const v = JSON.parse(JSON.stringify(ND.VICTORY_DEFAULTS));
      const n = (id, lo, hi, def) => { const x = Number($(id).value); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : def; };
      for (const k in v) v[k].on = $(`#v-${k}`).checked;
      v.territorial.share = n('#v-territorial-share', 25, 90, v.territorial.share);
      v.economic.target = n('#v-economic-target', 2000, 50000, v.economic.target);
      v.political.min = n('#v-political-min', 10, 50, v.political.min);
      v.political.districts = n('#v-political-districts', 20, 100, v.political.districts);
      const diff = (document.querySelector('input[name="difficulty"]:checked') || {}).value || 'normal';
      return { victory: v, difficulty: diff };
    },

    init() {
      ND.UI.init();
      $('#pick').addEventListener('click', (e) => {
        const b = e.target.closest('.pick');
        if (!b) return;
        this.picked = b.dataset.fid;
        document.querySelectorAll('.pick').forEach((x) => x.classList.toggle('on', x === b));
      });
      $('#btn-new').addEventListener('click', () => {
        const seed = Number($('#seed').value) || Math.floor(Math.random() * 1e9);
        const opts = this.readSetup();
        if (!Object.values(opts.victory).some((v) => v.on)) {
          $('#setup-err').textContent = 'Enable at least one victory condition.';
          return;
        }
        $('#setup-err').textContent = '';
        const g = ND.World.create(seed, this.picked, opts);
        if (g.settings.autosave) ND.Save.save(g, 'auto');
        ND.UI.start(g);
      });
      $('#btn-tutorial').addEventListener('click', () => ND.Tutorial.startGame());
      $('#btn-continue').addEventListener('click', () => {
        const g = ND.Save.load('auto');
        if (g) ND.UI.start(g);
      });
      $('#load-slots').addEventListener('click', (e) => {
        const b = e.target.closest('[data-load]');
        const g = b && ND.Save.load(b.dataset.load);
        if (g) ND.UI.start(g);
      });
      this.showStart();
    },
  };

  window.addEventListener('DOMContentLoaded', () => ND.Main.init());
})(window.ND);
