// Main city screen (V3): top bar, compact faction sidebar, map, contextual right panel, command cards.
// All game changes go through ND.Actions / ND.Units / ND.Turn etc.; secondary screens live in screens.js.
(function (ND) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sgn = (n) => (n > 0 ? '+' + n : String(n));
  const sector = (d) => ND.World.sector(d);
  const costHtml = (c) => {
    const parts = ND.RES.filter((r) => c[r]).map((r) => `<span class="c-${r}">${c[r]}&nbsp;${ND.RES_SHORT[r]}</span>`);
    return parts.length ? parts.join(' ') : '<span class="dim">free</span>';
  };
  const chip = (fid) => {
    if (!fid) return '<span class="chip neutral">Unaligned</span>';
    const F = ND.FDEF[fid];
    return `<span class="chip" style="--fc:${F.color}">${esc(F.name)}</span>`;
  };
  const bar = (v, color) => `<span class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></span>`;
  const statLine = (s) => ['atk', 'def', 'inf', 'int'].map((k) => `<span class="st"><i>${ND.STAT_LABEL[k]}</i>${s[k]}</span>`).join('');
  const ORDER_ICON = { rest: 'rest', canvass: 'canvass', guard: 'guard', intel: 'gather', train: 'train', hq: 'hq', seize: 'seize', sabotage: 'sabotage', attack: 'attack' };
  const ORDER_HELP = {
    rest: 'Do nothing this turn. Injured units rest automatically.',
    canvass: 'Spread your influence in this district every turn. High security may injure the unit; enemy guards may intercept it.',
    guard: 'Defend this district (yours only): weakens rival influence gains, adds crackdowns, and fights intruders automatically (+2 DEF).',
    intel: 'Collect intel data every turn.',
    train: 'Pay credits for +30 experience at the end of the turn.',
    hq: 'Move your headquarters here (150 credits).',
    seize: 'Try to take this facility. Held facilities pay income and add influence every turn.',
    sabotage: 'Knock a rival off this facility. Failure risks injury or death.',
    attack: 'Fight this faction\'s units here. With nobody to fight, raid its hold on the district instead.',
  };
  const ACTION_SHORT = {
    campaign: 'Raise your influence with propaganda and payoffs.',
    consolidate: 'Tighten your hold and push rival influence out.',
    bribe: 'Lower security so influence is easier to win.',
    fortify: 'Raise security: rivals gain less and get cracked down on.',
    develop: 'Boost this district\'s output (×1.5, then ×2).',
  };
  const COVERT_ICON = { spy: 'spy', opinion: 'opinion', disrupt: 'disrupt', sabotage: 'sabotage', steal: 'steal', plague: 'plague', assassinate: 'assassinate' };
  const COVERT_SHORT = {
    spy: 'See the district and its owner\'s treasury for 3 turns.',
    opinion: 'Gain influence here and cut the controller\'s.',
    disrupt: 'Siphon 15% of the owner\'s credits (max 150).',
    sabotage: 'Knock a production district offline for 3 turns.',
    steal: 'Copy one technology the owner has.',
    plague: 'Wound every unit here and hit the controller.',
    assassinate: 'Leave a rival leaderless for 3 turns.',
  };
  const condition = (u) => (u.injured ? { label: `Injured · ${u.injured} turn${u.injured > 1 ? 's' : ''}`, cls: 'neg', pct: Math.max(10, 100 - u.injured * 25) }
    : u.moved ? { label: 'Moved this turn', cls: 'dim', pct: 100 } : { label: 'Ready', cls: 'pos', pct: 100 });

  const UI = (ND.UI = {
    g: null,
    sel: -1,
    map: null,
    moving: null, // unit id awaiting a destination click
    panel: { kind: 'district' }, // right panel context: district | unit | faction
    rtab: 'overview',
    utab: 'orders',

    init() {
      this.map = new ND.MapView($('#map'), {
        onSelect: (id) => this.select(id),
        onHover: (id, e) => this.tooltip(id, e),
      });
      // Re-fit the map and paged lists whenever the layout changes size.
      new ResizeObserver(() => { if (this.g) { this.map.resize(); this.drawMap(); } }).observe($('#center'));
      window.addEventListener('resize', () => { if (this.g && !$('#game').classList.contains('hidden')) { this.renderRight(); if (ND.Screens.isOpen()) ND.Screens.refresh(); } });
      document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act],[data-mode],[data-screen],[data-cmd]');
        if (!t || t.disabled || !this.g) return;
        if (t.dataset.act) this.act(t.dataset.act);
        else if (t.dataset.mode) { this.map.mode = t.dataset.mode; this.renderMapTools(); this.drawMap(); }
        else if (t.dataset.screen) this.openScreen(t.dataset.screen);
        else if (t.dataset.cmd) this.cmd(t.dataset.cmd, t.dataset.arg, t.dataset.arg2);
      });
      document.addEventListener('change', (e) => {
        const t = e.target;
        if (t.matches('.equip-sel')) this.equipSlot(Number(t.dataset.unit), Number(t.dataset.slot), t.value);
      });
      document.addEventListener('keydown', (e) => this.key(e));
      ND.applyIcons();
      this.initTips();
    },

    start(g) {
      this.g = g;
      if (!g.settings) g.settings = { autosave: true };
      const f = g.factions[g.player];
      this.sel = f.hq != null ? f.hq : ND.World.owned(g, g.player)[0]?.id ?? 0;
      this.panel = { kind: 'district' };
      this.rtab = 'overview';
      $('#start').classList.add('hidden');
      $('#setupscr').classList.add('hidden');
      $('#title').classList.add('hidden');
      $('#game').classList.remove('hidden');
      ND.Screens.close();
      ND.Screens.state = {}; // tabs/selections belong to the previous game
      this.closeModal();
      // Wait one tick so the grid layout has its size before the canvas measures it.
      setTimeout(() => {
        this.map.resize();
        this.renderAll();
        this.map.resize();
        this.drawMap();
        if (g.over) ND.Screens.open('gameover');
        else if (g.tutorial && !g.tutorial.done) ND.Tutorial.attach();
        else if (g.turn === 1) ND.Screens.open('help', { tab: 'goal' });
      }, 0);
    },

    renderAll() {
      this.renderTop();
      this.renderLeft();
      this.renderRight();
      this.renderActions();
      this.renderMapTools();
      this.drawMap();
    },
    drawMap() {
      if (!this.g) return;
      const u = this.moving != null && this.g.units[this.moving];
      this.map.draw(this.g, this.sel, u ? ND.Units.reach(this.g, u) : null, ND.Tutorial ? ND.Tutorial.hintCell() : null);
      $('#move-banner').classList.toggle('hidden', !u);
      if (u) $('#move-banner').innerHTML = `${ND.icon('move')}Moving <b>${esc(u.name)}</b> — click a green district · <b>Esc</b> cancels`;
    },

    select(id) {
      if (this.moving != null) {
        const u = this.g.units[this.moving];
        this.moving = null;
        if (u && id !== u.loc) {
          const r = ND.Units.move(this.g, u, id);
          this.toast(r.ok ? `${u.name} moved to ${this.g.districts[id].name}. Now pick an order.` : r.reason, r.ok ? 'ok' : 'err');
          if (r.ok) { ND.sfx('move'); this.sel = id; this.panel = { kind: 'unit', id: u.id }; this.utab = 'orders'; this.renderTop(); this.renderRight(); this.renderActions(); this.drawMap(); return; }
        }
      }
      this.sel = id;
      this.panel = { kind: 'district' };
      if (this.g.districts[id]) { ND.sfx('select'); ND.Audio.setAmbientProfile(this.g.districts[id].type); }
      this.renderRight();
      this.renderActions();
      this.drawMap();
    },

    // ---------- top bar ----------
    renderTop() {
      const g = this.g, f = g.factions[g.player], L = ND.Econ.ledger(g, g.player);
      if (!$('#resources .res')) {
        $('#resources').innerHTML = ND.RES.map((r) => `
          <div class="res c-${r}" data-res="${r}">${ND.icon(r)}
            <span class="res-k">${ND.RES_LABEL[r]}</span>
            <span class="res-row"><span class="res-v num">0</span><span class="res-d"></span></span>
          </div>`).join('');
      }
      for (const r of ND.RES) {
        const el = $(`#resources [data-res="${r}"]`);
        el.title = `${ND.RES_LABEL[r]}: ${f.res[r]} in stock.\nNext turn: ${sgn(L.net[r])} (income ${L.income[r]}, upkeep ${L.upkeep[r]}).\nClick for the Treasury.`;
        this.tween(el, f.res[r]);
        const dEl = el.querySelector('.res-d');
        dEl.textContent = sgn(L.net[r]);
        dEl.className = 'res-d ' + (L.net[r] < 0 ? 'neg' : 'pos');
      }
      $('#turn').innerHTML = `${ND.icon('turn')}<span class="lbl">Turn</span> <b>${g.turn}</b>`;
      $('#turn').title = 'Current turn';
      const max = ND.Actions.maxOps(g, g.player);
      $('#ops').innerHTML = `${ND.icon('ops')}<span class="lbl">Ops</span> <b>${f.ops}</b>/${max}`;
      $('#ops').title = `Operation points left this turn: ${f.ops} of ${max}.`;
      $('#ops').classList.toggle('empty', f.ops === 0);
      const us = ND.Units.list(g, g.player);
      const idle = us.filter((u) => !u.injured && u.task.kind === 'rest').length;
      $('#unitpill').innerHTML = `${ND.icon('units')}<span class="lbl">Units</span> <b>${us.length}</b>/${ND.Units.cap(g, g.player)}${idle ? ` <span class="warn">· ${idle} idle</span>` : ''}`;
      $('#unitpill').title = `Units ${us.length} of ${ND.Units.cap(g, g.player)}.${idle ? `\n${idle} healthy unit${idle > 1 ? 's have' : ' has'} no orders.` : ''}\nClick for Unit Management.`;
      const cur = f.tech.current;
      $('#rdpill').innerHTML = cur
        ? `${ND.icon('research')}<b>${esc(ND.TECHS[cur.id].name)}</b> <span class="num">${cur.progress}/${ND.TECHS[cur.id].rp}</span>`
        : `${ND.icon('research')}<span class="warn">Research idle</span>`;
      $('#rdpill').title = cur ? `Researching ${ND.TECHS[cur.id].name}. Click to open Research.` : 'No research project. Click to open Research.';
      $('#btn-end').disabled = !!g.over || !!this.busy;
      $('#btn-end').classList.toggle('ready', f.ops === 0 && !g.over);
    },

    // Count a resource chip toward its new value (display only).
    tween(el, to) {
      const v = el.querySelector('.res-v');
      const from = Number(el.dataset.v ?? to);
      el.dataset.v = to;
      if (from === to) { v.textContent = to; return; }
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      const t0 = performance.now(), dur = 450;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        v.textContent = Math.round(from + (to - from) * e);
        if (k < 1 && el.dataset.v == to) requestAnimationFrame(step); else v.textContent = el.dataset.v;
      };
      requestAnimationFrame(step);
      setTimeout(() => { v.textContent = el.dataset.v; }, dur + 50);
    },

    // Styled tooltips for every [title] element: the title moves to data-tip while hovering.
    initTips() {
      const tip = document.createElement('div');
      tip.id = 'tip';
      document.body.appendChild(tip);
      let cur = null;
      const hide = () => { tip.classList.remove('on'); if (cur && cur.dataset.tip != null) { cur.title = cur.dataset.tip; delete cur.dataset.tip; } cur = null; };
      document.addEventListener('mouseover', (e) => {
        const el = e.target.closest && e.target.closest('[title]');
        if (!el || el === cur) return;
        hide();
        if (!el.title) return;
        cur = el; el.dataset.tip = el.title; el.title = '';
        tip.textContent = el.dataset.tip;
        const r = el.getBoundingClientRect();
        tip.classList.add('on');
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        const x = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
        let y = r.bottom + 8;
        if (y + th > window.innerHeight - 8) y = r.top - th - 8;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
      });
      document.addEventListener('mouseout', (e) => { if (cur && !cur.contains(e.relatedTarget)) hide(); });
      document.addEventListener('mousedown', hide, true);
    },

    // ---------- left: compact faction identity ----------
    renderLeft() {
      const g = this.g, p = g.player, F = ND.FDEF[p], f = g.factions[p], L = ND.Econ.ledger(g, p);
      const st = ND.Turn.standings(g);
      const me = st.find((s) => s.fid === p), rank = st.indexOf(me) + 1;
      const vp = ND.Victory.progress(g, p);
      const best = Object.keys(vp).sort((a, b) => vp[b].pct - vp[a].pct)[0];
      const rivals = g.order.filter((x) => x !== p && g.factions[x].alive);
      const avgRel = rivals.length ? Math.round(rivals.reduce((a, x) => a + ND.Diplo.rel(g, p, x), 0) / rivals.length) : 0;
      const repTxt = avgRel >= 30 ? 'Trusted' : avgRel >= 10 ? 'Respected' : avgRel > -10 ? 'Neutral' : avgRel > -30 ? 'Distrusted' : 'Hated';
      const shortfall = ND.RES.some((r) => f.res[r] + L.net[r] < 0);
      $('#left').innerHTML = `
        <button class="side-card fid-card" style="--fc:${F.color}" data-cmd="panel" data-arg="faction" data-arg2="${p}" title="Open your faction profile">
          <span class="fid-art"><canvas data-fig="leader|${p}"></canvas><span class="fid-emb">${ND.emblemSvg(p)}</span></span>
          <span class="fid-name">${esc(F.name)}</span>
          <span class="fid-leader">${esc(F.leader)}</span>
          <span class="fid-chips">
            <span title="Districts you control">${ND.icon('factions')}<b>${L.districts}</b></span>
            <span title="Rank ${rank} of ${st.length} (${me.score} points)">${ND.icon('star')}<b>#${rank}</b></span>
            <span title="Average relations with rivals: ${sgn(avgRel)}">${ND.icon('diplomacy')}<b>${repTxt}</b></span>
            ${best ? `<span title="${esc(ND.VICTORY_INFO[best].name)}: ${vp[best].value}/${vp[best].need}">${ND.icon('victory')}<b>${Math.floor(vp[best].pct * 100)}%</b></span>` : ''}
          </span>
        </button>
        <button class="side-card treasury-mini" data-cmd="treasury" title="Open the Treasury: forecast and black market">
          <span class="sc-h">${ND.icon('economy')}Next turn<span class="sc-more">Treasury ›</span></span>
          ${ND.RES.map((r) => `<span class="tm-row c-${r}">${ND.icon(r)}<span>${ND.RES_LABEL[r]}</span><b class="${L.net[r] < 0 ? 'neg' : 'pos'}">${sgn(L.net[r])}</b></span>`).join('')}
          ${shortfall ? `<span class="tm-warn">${ND.icon('warn')}Shortfall ahead</span>` : ''}
        </button>
        <div class="side-card ranks">
          <span class="sc-h">${ND.icon('star')}Rankings</span>
          ${st.map((s, i) => `<button class="rk-row ${s.fid === p ? 'me' : ''} ${s.alive ? '' : 'dead'}" data-cmd="panel" data-arg="faction" data-arg2="${s.fid}" title="${esc(ND.FDEF[s.fid].name)}: ${s.alive ? `${s.districts} districts, ${s.units} units, score ${s.score}` : 'eliminated'}">
            <span class="rk">${i + 1}</span>${ND.emblemSvg(s.fid)}<span class="nm">${esc(ND.FDEF[s.fid].name)}</span><b>${s.alive ? s.districts : '—'}</b></button>`).join('')}
        </div>`;
      ND.Screens.paint($('#left'));
    },

    // Map overlay switcher floating on the map.
    renderMapTools() {
      const F = ND.FDEF[this.g.player];
      $('#map-tools').innerHTML = `${Object.entries(ND.MAP_MODES).map(([k, v]) => `<button class="mt-b ${this.map.mode === k ? 'on' : ''}" data-mode="${k}" title="${esc(ND.MAP_MODE_HELP[k])}">${v}</button>`).join('')}
        <span class="mt-legend" title="Map legend:\n• Crown — faction headquarters\n• Red corner — contested (two factions hold 20%+)\n• Dashed outline — districts you can operate in\n• Squares top-right — facilities, coloured by holder\n• Gold diamonds — development level\n• Round badges — units present (your colour: ${F.name})">${ND.icon('help')}</span>`;
    },

    // ---------- right: contextual panel ----------
    renderRight() {
      const g = this.g;
      if (!g) return;
      let html;
      if (this.panel.kind === 'unit' && g.units[this.panel.id] && g.units[this.panel.id].fid === g.player) html = this.unitPanel(g.units[this.panel.id]);
      else if (this.panel.kind === 'faction' && g.factions[this.panel.id]) html = this.factionPanel(this.panel.id);
      else { this.panel = { kind: 'district' }; html = this.districtPanel(); }
      $('#right').innerHTML = html;
      ND.Screens.paint($('#right'));
      if (this.panel.kind === 'district' && this.rtab === 'units') this.fillUnitsTab();
    },

    districtPanel() {
      const g = this.g, p = g.player;
      if (this.sel < 0) return '<div class="ctx-empty">Select a district on the map.</div>';
      const d = g.districts[this.sel], T = ND.TYPES[d.type];
      const cand = ND.Inf.captureCandidate(d);
      let status, stCls = '', stIcon = 'help';
      if (d.owner && cand && cand !== d.owner) { status = `${esc(ND.FDEF[cand].name)} will seize it at turn end`; stCls = 'st-warn'; stIcon = 'warn'; }
      else if (d.owner && ND.Inf.get(d, d.owner) < ND.RULES.holdMin) { status = `Owner below ${ND.RULES.holdMin}% — control collapses at turn end`; stCls = 'st-warn'; stIcon = 'warn'; }
      else if (!d.owner && cand) { status = `${esc(ND.FDEF[cand].name)} takes control at turn end`; stCls = cand === p ? 'st-ok' : 'st-warn'; stIcon = cand === p ? 'check' : 'warn'; }
      else if (ND.Inf.contested(d)) { status = 'Contested — several factions hold 20%+'; stCls = 'st-danger'; stIcon = 'battles'; }
      else if (d.owner === p) { status = 'Under your control'; stCls = 'st-ok'; stIcon = 'check'; }
      else status = d.owner ? `Controlled by ${esc(ND.FDEF[d.owner].name)}` : 'Unaligned — nobody controls it';
      const here = ND.Units.at(g, d.id);
      const mine = here.filter((u) => u.fid === p);
      const seen = ND.Log.canSee(g, p, d.id);
      const rivalsHere = seen ? here.filter((u) => u.fid !== p) : [];
      const tab = this.rtab;
      const tabsHtml = [['overview', 'Overview'], ['units', `Units <span class="cnt">${mine.length + rivalsHere.length}</span>`], ['facilities', `Facilities <span class="cnt">${d.facilities.length}</span>`], ['influence', 'Influence']]
        .map(([k, l]) => `<button class="ctx-tab ${tab === k ? 'on' : ''}" data-cmd="rtab" data-arg="${k}">${l}</button>`).join('');
      let body = '';
      if (tab === 'overview') {
        const baseY = ND.RES.filter((r) => T.yields[r]).map((r) => `<span class="c-${r}">${Math.round(T.yields[r] * ND.RULES.devMult[d.dev - 1])} ${ND.RES_SHORT[r]}</span>`).join(' ');
        const myInf = ND.Inf.get(d, p);
        let mineTxt;
        if (d.owner === p) mineTxt = `Yields you ${costHtml(ND.Econ.yieldFor(g, p, d))} · upkeep ${costHtml(ND.Econ.upkeepFor(g, p, d))}`;
        else if (myInf >= ND.RULES.skimMin) mineTxt = `You skim <span class="c-credits">${ND.Econ.skimFor(d)} CR</span>/turn here.`;
        else if (ND.World.reachable(g, p, d)) mineTxt = 'Within your reach — operations are available below.';
        else mineTxt = '<span class="dim">Out of reach — you need a bordering district.</span>';
        body = `<div class="d-grid">
            <div class="tile" title="Residents (thousands)"><div class="tile-k">${ND.icon('population')}Population</div><div class="tile-v">${d.pop}k</div></div>
            <div class="tile" title="Level 2 yields ×1.5, level 3 ×2"><div class="tile-k">${ND.icon('dev')}Development</div><div class="tile-v"><span class="pips">${[1, 2, 3].map((i) => `<i class="${i <= d.dev ? 'on' : ''}"></i>`).join('')}</span></div></div>
            <div class="tile" title="Security ${d.security} (base ${d.baseSec}): weakens influence gains, injures canvassers; drifts back to base."><div class="tile-k">${ND.icon('security')}Security</div><div class="tile-v">${d.security}<span class="dim small"> /${d.baseSec}</span></div><div class="meter"><i style="width:${d.security}%;background:linear-gradient(90deg,#f2c15c,#f06b75)"></i></div></div>
            <div class="tile" title="Output per turn for the controller"><div class="tile-k">${ND.icon('economy')}Value</div><div class="tile-v small">${baseY || '—'}</div></div>
          </div>
          ${d.disrupted > 0 ? `<div class="d-status st-danger">${ND.icon('sabotage')}<span>Sabotaged — offline ${d.disrupted} more turn(s)</span></div>` : ''}
          <div class="mine">${mineTxt}</div>
          ${mine.length ? `<div class="here-strip">${mine.slice(0, 2).map((u) => this.unitMini(u)).join('')}${mine.length > 2 ? `<button class="linkbtn small" data-cmd="rtab" data-arg="units">+${mine.length - 2} more units here ›</button>` : ''}</div>` : ''}`;
      } else if (tab === 'units') {
        body = `<div class="list-fill" id="rp-units"></div><div class="pager" id="rp-units-p"></div>`;
      } else if (tab === 'facilities') {
        const y = Object.entries(ND.FAC_YIELD[d.type] || {}).map(([r, v]) => v + ' ' + ND.RES_SHORT[r]).join(' + ');
        body = `${d.facilities.map((fc) => `<div class="fac-row"><span class="facs">${ND.icon('facility')}${esc(fc.name)}</span>${fc.owner ? chip(fc.owner) : '<span class="chip neutral">Unclaimed</span>'}</div>`).join('')}
          <p class="small dim">Each facility pays its holder ${y} per turn and +1% influence here. Seize them with a unit's Seize order (needs 25% influence).</p>`;
      } else {
        const ranked = ND.Inf.ranked(d), neutral = ND.Inf.neutral(d);
        body = `${ranked.map(([fid, v]) => `<div class="infl ${fid === p ? 'me' : ''}"><span>${ND.emblemSvg(fid)}${esc(ND.FDEF[fid].name)}</span>${bar(v, ND.FDEF[fid].color)}<b>${v}%</b></div>`).join('')}
          <div class="infl"><span class="dim">Unaligned</span>${bar(neutral, '#4a5d75')}<b>${neutral}%</b></div>
          <p class="small dim">Control needs ≥${ND.RULES.captureMin}% and a ${ND.RULES.captureMargin}-point lead. Owners keep control while ≥${ND.RULES.holdMin}%. Changes resolve at end of turn.</p>`;
      }
      return `<div class="ctx ctx-district" style="--oc:${d.owner ? ND.FDEF[d.owner].color : '#4a5d75'}">
        <div class="ctx-hero"><canvas data-hero="${d.id}"></canvas>
          <div class="hero-plate"><span class="hp-sec">${sector(d)} · ${esc(T.label)}${d.hq ? ' · HQ' : ''}</span><b class="hp-name">${esc(d.name)}</b>
            <span class="hp-own">${d.owner ? ND.emblemSvg(d.owner) : ''}${d.owner ? esc(ND.FDEF[d.owner].name) : 'Unaligned'}${d.owner && d.owner !== p && ND.Diplo.pact(g, p, d.owner) ? ' <span class="badge pos">Pact</span>' : ''}</span></div></div>
        <div class="d-status ${stCls}">${ND.icon(stIcon)}<span>${status}</span></div>
        <div class="ctx-tabs">${tabsHtml}</div>
        <div class="ctx-body">${body}</div></div>`;
    },

    // Units tab: as many rows as fit, then pages.
    fillUnitsTab() {
      const g = this.g, d = g.districts[this.sel], p = g.player;
      const el = $('#rp-units'), pg = $('#rp-units-p');
      if (!el) return;
      const here = ND.Units.at(g, d.id);
      const items = [...here.filter((u) => u.fid === p), ...(ND.Log.canSee(g, p, d.id) ? here.filter((u) => u.fid !== p) : [])];
      const rowH = 62, per = Math.max(1, Math.floor((el.clientHeight + 6) / (rowH + 6)));
      const pages = Math.max(1, Math.ceil(items.length / per));
      this.upage = Math.min(this.upage || 0, pages - 1);
      el.innerHTML = items.slice(this.upage * per, this.upage * per + per).map((u) => (u.fid === p ? this.unitMini(u) : `<div class="u-mini rival" style="--fc:${ND.FDEF[u.fid].color}">${ND.emblemSvg(u.fid)}<span class="um-main"><b>${esc(u.name)}</b><span class="dim small">${esc(ND.UNIT_TYPES[u.type].label)} Lv${u.level} · ${esc(ND.Units.taskLabel(g, u))}</span></span></div>`)).join('')
        || '<div class="ctx-empty small">No units here. Use Move on one of your units, or recruit at your HQ.</div>';
      pg.innerHTML = pages > 1 ? `<button class="btn xs" data-cmd="upage" data-arg="${this.upage - 1}" ${this.upage ? '' : 'disabled'}>‹</button><span>${this.upage + 1}/${pages}</span><button class="btn xs" data-cmd="upage" data-arg="${this.upage + 1}" ${this.upage < pages - 1 ? '' : 'disabled'}>›</button>` : '';
      ND.Screens.paint(el);
    },

    // Compact unit row for the district panel.
    unitMini(u) {
      const g = this.g, c = condition(u);
      const cur = ND.Units.tasks(g, u).find((t) => this.orderKey(t) === this.orderKey(u.task)) || u.task;
      const v = this.orderView(u, cur), idle = !u.injured && u.task.kind === 'rest';
      return `<div class="u-mini">
        <button class="um-art" data-cmd="unit" data-arg="${u.id}" title="Open ${esc(u.name)}"><canvas data-uport="${u.id}"></canvas></button>
        <span class="um-main"><button class="linkbtn um-name" data-cmd="unit" data-arg="${u.id}">${esc(u.name)}</button>
          <span class="small"><span class="${c.cls}">${c.label}</span> · <button class="u-cur ${idle ? 'idle' : ''}" data-cmd="unit" data-arg="${u.id}" title="Change orders">${v.icon}<span>${idle ? 'No orders!' : esc(v.name)}</span></button></span></span>
        <button class="btn sm u-move" data-cmd="move" data-arg="${u.id}" ${u.injured || u.moved ? 'disabled' : ''} title="${u.injured ? 'Injured units cannot move' : u.moved ? 'Already moved this turn' : 'Move (then click a green district)'}">${ND.icon('move')}Move</button>
      </div>`;
    },

    unitPanel(u) {
      return `<div class="ctx ctx-unit"><button class="ctx-back" data-cmd="panel" data-arg="district">‹ Back to ${esc(this.g.districts[u.loc].name)}</button>${this.unitDetailHtml(u, 'panel')}</div>`;
    },

    // Character sheet shared by the right panel and the Units screen.
    unitDetailHtml(u, ctx) {
      const g = this.g, T = ND.UNIT_TYPES[u.type], s = ND.Units.stats(u), nm = ND.splitName(u.name), c = condition(u);
      const next = ND.Units.nextLevelXp(u), base = ND.Units.XP_LEVELS[u.level - 1];
      const d = g.districts[u.loc];
      const cur = ND.Units.tasks(g, u).find((t) => this.orderKey(t) === this.orderKey(u.task)) || u.task;
      const v = this.orderView(u, cur);
      const opts = ND.Units.tasks(g, u);
      const aimed = opts.filter((t) => ['seize', 'sabotage', 'attack'].includes(t.kind));
      const ros = ND.rosterOf(u.name);
      const tab = this.utab === 'profile' && !ros ? 'orders' : this.utab;
      let body;
      if (tab === 'profile') body = `<div class="ud-profile"><q>${esc(ros.quote)}</q><p>${esc(ros.bio)}</p><span class="small dim">With you since turn ${u.joined || 1}</span></div>`;
      else if (u.injured) body = `<div class="d-status st-danger">${ND.icon('warn')}<span>Injured — resting ${u.injured} more turn(s). Orders resume when healed.</span></div>`;
      else if (tab === 'targets') body = aimed.length ? `<div class="orders">${aimed.map((t) => this.orderBtn(u, t)).join('')}</div>` : '<div class="ctx-empty small">No facilities or enemies to target in this district.</div>';
      else if (tab === 'gear') {
        const f = g.factions[u.fid];
        body = `${T.slots.map((slot, i) => {
          const curI = u.equip[i];
          const options = Object.entries(ND.ITEMS).filter(([k, it]) => it.slot === slot && (f.inventory[k] > 0 || k === curI));
          return `<div class="kv"><span>${esc(slot)}</span><select class="equip-sel" data-unit="${u.id}" data-slot="${i}"><option value="">— empty —</option>
            ${options.map(([k, it]) => `<option value="${k}" ${k === curI ? 'selected' : ''}>${esc(it.label)} (${Object.entries(it.bonus).map(([b, x]) => '+' + x + ' ' + ND.STAT_LABEL[b]).join(' ')})${k === curI ? '' : ` ×${f.inventory[k]}`}</option>`).join('')}</select></div>`;
        }).join('')}<button class="btn sm" data-screen="armory">${ND.icon('armory')}Buy gear in the Armory</button>`;
      } else body = `<div class="orders">${opts.filter((t) => !['seize', 'sabotage', 'attack'].includes(t.kind)).map((t) => this.orderBtn(u, t)).join('')}</div>`;
      return `<div class="unit-detail ud-${ctx}">
        <div class="ud-head">
          <div class="ud-art" style="--fc:${ND.FDEF[u.fid].color}"><canvas data-uport="${u.id}"></canvas><span class="ud-lv">Lv ${u.level}</span></div>
          <div class="ud-info">
            <div class="ud-name">${esc(nm.first)} ${nm.nick ? `<span class="nick">“${esc(nm.nick)}”</span>` : ''} ${esc(nm.last)}</div>
            <div class="ud-cls">${esc(T.label)}</div>
            <div class="ud-bar" title="Experience ${u.xp}${next ? '/' + next : ' (max level)'}"><span>XP</span>${bar(next ? ((u.xp - base) / (next - base)) * 100 : 100, '#a98af0')}</div>
            <div class="ud-bar" title="Condition: ${c.label}"><span>Health</span>${bar(c.pct, u.injured ? '#f06b75' : '#8bd46a')}<em class="${c.cls}">${c.label}</em></div>
            <div class="small dim">At <button class="linkbtn" data-cmd="goto" data-arg="${u.loc}">${esc(d.name)} ${sector(d)}</button></div>
          </div>
        </div>
        <div class="stat-row">${['atk', 'def', 'inf', 'int'].map((k) => `<div class="stat-b"><span>${ND.STAT_LABEL[k]}</span><b>${s[k]}</b></div>`).join('')}</div>
        <div class="ud-eq">${T.slots.map((slot, i) => (u.equip[i] ? `<span class="eq" title="${esc(slot)}">${esc(ND.ITEMS[u.equip[i]].label)}</span>` : `<span class="eq empty">${esc(slot)}</span>`)).join('')}</div>
        <div class="ud-assign">${v.icon}<span>Assignment: <b>${u.task.kind === 'rest' && !u.injured ? '<span class="warn">none</span>' : esc(v.name)}</b></span>
          <button class="btn sm u-move" data-cmd="move" data-arg="${u.id}" ${u.injured || u.moved ? 'disabled' : ''} title="${u.injured ? 'Injured units cannot move' : u.moved ? 'Already moved this turn' : 'Move (then click a green district)'}">${ND.icon('move')}Move</button></div>
        <div class="ctx-tabs">${[['orders', 'Orders'], ['targets', `Targets <span class="cnt">${aimed.length}</span>`], ['gear', 'Gear'], ...(ros ? [['profile', 'Profile']] : [])].map(([k, l]) => `<button class="ctx-tab ${tab === k ? 'on' : ''}" data-cmd="utab" data-arg="${k}">${l}</button>`).join('')}</div>
        <div class="ud-body">${body}</div>
        <div class="ud-foot"><span class="small dim" title="${esc(T.special)}">${ND.icon('star')}${esc(T.special.split(' — ')[0])}</span><button class="btn xs danger" data-cmd="dismiss" data-arg="${u.id}">Dismiss</button></div>
      </div>`;
    },

    // Illustrated card for the Units screen grid.
    unitCardHtml(u, on) {
      const g = this.g, T = ND.UNIT_TYPES[u.type], s = ND.Units.stats(u), nm = ND.splitName(u.name), c = condition(u);
      const cur = ND.Units.tasks(g, u).find((t) => this.orderKey(t) === this.orderKey(u.task)) || u.task;
      const v = this.orderView(u, cur);
      return `<button class="u-card ${on ? 'on' : ''} ${u.injured ? 'hurt' : ''}" data-cmd="unit" data-arg="${u.id}" style="--fc:${ND.FDEF[u.fid].color}">
        <span class="uc-art"><canvas data-uport="${u.id}"></canvas><span class="ud-lv">Lv ${u.level}</span></span>
        <span class="uc-main"><span class="uc-name">${esc(nm.first)} <span class="nick">“${esc(nm.nick)}”</span></span>
          <span class="uc-cls">${esc(T.label)} · <span class="${c.cls}">${c.label}</span></span>
          <span class="stats">${statLine(s)}</span>
          <span class="uc-as">${v.icon}<span>${u.task.kind === 'rest' && !u.injured ? '<span class="warn">No assignment</span>' : esc(v.name)}</span> <span class="dim">· ${sector(g.districts[u.loc])}</span></span>
          <span class="u-eq">${T.slots.map((slot, i) => (u.equip[i] ? `<span class="eq">${esc(ND.ITEMS[u.equip[i]].label)}</span>` : `<span class="eq empty">${esc(slot)}</span>`)).join('')}</span></span>
      </button>`;
    },

    factionPanel(fid) {
      const g = this.g, p = g.player, F = ND.FDEF[fid], f = g.factions[fid], s = ND.Turn.standings(g).find((x) => x.fid === fid);
      const sid = ND.Tech.listFor(fid).find((id) => ND.TECHS[id].faction === fid);
      return `<div class="ctx ctx-faction" style="--fc:${F.color}"><button class="ctx-back" data-cmd="panel" data-arg="district">‹ Back to the district</button>
        <div class="fp-art"><canvas data-fig="leader|${fid}"></canvas><span class="emblem-big">${ND.emblemSvg(fid)}</span>
          <div class="hero-plate"><b class="hp-name" style="color:${F.color}">${esc(F.name)}</b><span>${esc(F.leader)}</span></div></div>
        <p class="ctx-text">${esc(F.identity)}</p>
        <div class="fid-chips wide"><span>${ND.icon('factions')}<b>${f.alive ? s.districts : 0}</b> districts</span><span>${ND.icon('units')}<b>${s.units}</b> units</span><span>${ND.icon('star')}<b>${s.score}</b> pts</span></div>
        <div class="trait good">${ND.icon('check')}<div><b>Ability</b>${esc(F.ability)}</div></div>
        <div class="trait bad">${ND.icon('warn')}<div><b>Weakness</b>${esc(F.weakness)}</div></div>
        <div class="kv"><span>Doctrine</span><b class="small">${esc(F.military.split(' — ')[0])}</b></div>
        <div class="kv"><span>Signature tech</span><b class="small">${esc(ND.TECHS[sid].name)}</b></div>
        ${fid !== p ? `<div class="kv"><span>Relations</span><b>${sgn(ND.Diplo.rel(g, p, fid))} · ${ND.Diplo.stance(g, p, fid)}</b></div>` : ''}
        <div class="ctx-btns"><button class="btn sm" data-cmd="profile" data-arg="${fid}">${ND.icon('factions')}Full profile</button>${fid !== p ? `<button class="btn sm" data-screen="diplomacy">${ND.icon('diplomacy')}Diplomacy</button>` : ''}</div>
      </div>`;
    },

    // ---------- orders ----------
    // An order key is "kind", "kind:facilityIndex" or "attack:factionId".
    orderKey(t) { return t.kind + (t.fac != null ? ':' + t.fac : t.target ? ':' + t.target : ''); },
    orderView(u, t) {
      const d = this.g.districts[u.loc];
      if (t.kind === 'seize' || t.kind === 'sabotage') {
        const fac = d.facilities[t.fac];
        return { icon: ND.icon(ORDER_ICON[t.kind]), name: `${t.kind === 'seize' ? 'Seize' : 'Sabotage'} ${fac ? fac.name : ''}`, info: t.info ? t.info.replace(/^[^:]*: /, '') + ' success' : '' };
      }
      if (t.kind === 'attack') return { icon: ND.icon(ORDER_ICON.attack), name: `Attack ${ND.FDEF[t.target].short}`, info: t.info ? t.info.replace(/^[A-Z]{3} — /, '') : '' };
      return { icon: ND.icon(ORDER_ICON[t.kind]), name: ND.TASKS[t.kind], info: t.info || '' };
    },
    orderBtn(u, t) {
      const v = this.orderView(u, t), k = this.orderKey(t), on = k === this.orderKey(u.task);
      return `<button class="ord ${on ? 'on' : ''}" data-cmd="order" data-arg="${u.id}" data-arg2="${k}" data-order="${k}" ${t.ok && !on ? '' : 'disabled'}
        title="${esc(ORDER_HELP[t.kind] + (t.ok ? '' : '\n\nNot available: ' + t.reason))}">
        <span class="ord-i">${v.icon}</span><span class="ord-n">${esc(v.name)}</span>
        <span class="ord-x">${on ? 'current order' : t.ok ? esc(v.info) : esc(t.reason)}</span></button>`;
    },
    setOrder(id, key) {
      const u = this.g.units[id];
      if (!u) return;
      const [kind, arg] = key.split(':');
      const t = arg == null ? { kind } : kind === 'attack' ? { kind, target: arg } : { kind, fac: Number(arg) };
      const r = ND.Units.setTask(this.g, u, t);
      if (!r.ok) this.toast(r.reason, 'err');
      else {
        ND.sfx('order');
        this.toast(`${u.name}: ${this.orderView(u, ND.Units.tasks(this.g, u).find((x) => this.orderKey(x) === key) || t).name}.`, 'ok');
      }
      this.refreshUnitViews(id);
    },
    refreshUnitViews() {
      this.renderTop();
      this.renderRight();
      this.drawMap();
      if (ND.Screens.isOpen()) ND.Screens.refresh();
    },
    equipSlot(id, slot, key) {
      const u = this.g.units[id];
      if (!u) return;
      const r = ND.Units.equip(this.g, u, slot, key || null);
      if (!r.ok) this.toast(r.reason, 'err'); else ND.sfx('equip');
      this.refreshUnitViews(id);
    },
    // Pending pact offers to the player, with answer buttons.
    offersHtml() {
      const g = this.g, offers = g.proposals.filter((x) => x.to === g.player);
      if (!offers.length) return '';
      return `<h3>${ND.icon('diplomacy')}Pact offers <span class="small">answer this turn</span></h3>${offers.map((o) => `<div class="offer">
        <span>${ND.emblemSvg(o.from)}<b style="color:${ND.FDEF[o.from].color}">${esc(ND.FDEF[o.from].name)}</b> offers a ${ND.Diplo.PACT_TURNS}-turn non-aggression pact. <span class="dim small">Relations ${sgn(ND.Diplo.rel(g, g.player, o.from))}</span></span>
        <span><button class="btn sm primary" data-cmd="answer" data-arg="${o.from}" data-arg2="yes">Accept</button> <button class="btn sm" data-cmd="answer" data-arg="${o.from}" data-arg2="no">Decline</button></span></div>`).join('')}`;
    },

    // ---------- bottom: command cards ----------
    renderActions() {
      const g = this.g, p = g.player, f = g.factions[p];
      if (this.sel < 0) { $('#actions').innerHTML = '<div class="dim">Select a district to see available operations.</div>'; return; }
      const d = g.districts[this.sel];
      const tab = this.actTab || 'district';
      const max = ND.Actions.maxOps(g, p);
      const head = `
        <div class="act-head">
          <div class="tabs">
            <button class="tab ${tab === 'district' ? 'on' : ''}" data-cmd="acttab" data-arg="district" title="Influence, security and development operations">${ND.icon('campaign')}District Ops</button>
            <button class="tab ${tab === 'covert' ? 'on' : ''}" data-cmd="acttab" data-arg="covert" title="Espionage and special operations">${ND.icon('spy')}Covert Ops</button>
          </div>
          <span class="act-target">${esc(d.name)} <span class="dim small num">${sector(d)}</span></span>
          <div class="act-meta">${ND.icon('ops')}<span>Operation points <b>${f.ops}</b>/${max}</span>${f.leaderless ? '<span class="neg">· LEADERLESS</span>' : ''}</div>
        </div>`;
      const card = (attr, icon, label, shortDesc, expected, cost, ops, c, tip, hotkey) => `
        <button class="act ${c.ok ? '' : 'off'}" ${attr} ${c.ok ? '' : 'disabled'} title="${esc(c.ok ? tip : tip + '\n\n⚠ ' + c.reason)}">
          ${hotkey ? `<span class="act-k">${hotkey}</span>` : ''}
          <span class="act-ico">${ND.icon(icon)}</span>
          <span class="act-l">${esc(label)}</span>
          <span class="act-d">${esc(shortDesc)}</span>
          <span class="act-foot"><span class="act-e">${esc(expected)}</span><span class="act-c">${costHtml(cost)}<span class="opc">· ${ops} OP</span></span></span>
          ${c.ok ? '' : `<span class="act-r">${ND.icon('warn')}<span>${esc(c.reason)}</span></span>`}
        </button>`;
      if (tab === 'covert') {
        $('#actions').innerHTML = head + `<div class="act-row covert">${ND.Espionage.keys.map((k) => {
          const op = ND.Espionage.OPS[k], c = ND.Espionage.check(g, p, k, d), ch = ND.Espionage.chance(g, p, k, d);
          const tip = `${op.desc}\n\nSuccess ${ch.pct}%: ${ch.parts.map((x) => `${x[0]} ${sgn(x[1])}`).join(', ')}`;
          return card(`data-cmd="covert" data-arg="${k}"`, COVERT_ICON[k], op.label, COVERT_SHORT[k], `${ch.pct}% success`, c.cost, op.ops, c, tip);
        }).join('')}</div>`;
        return;
      }
      $('#actions').innerHTML = head + `<div class="act-row">${ND.Actions.keys.map((k) => {
        const def = ND.Actions.defs[k], c = ND.Actions.check(g, p, k, d);
        return card(`data-act="${k}"`, k, def.label, ACTION_SHORT[k], def.preview(g, p, d), c.cost, 1, c, def.desc, def.hotkey);
      }).join('')}</div>`;
    },

    act(key) {
      const g = this.g, d = g.districts[this.sel];
      if (!d) return;
      const r = ND.Actions.exec(g, g.player, key, d);
      if (r.ok) ND.sfx(key);
      this.toast(r.ok ? `You ${r.msg}.` : r.reason, r.ok ? 'ok' : 'err');
      this.renderAll();
    },

    endTurn() {
      const g = this.g;
      if (g.over || this.busy) return;
      this.busy = true;
      this.moving = null;
      $('#btn-end').disabled = true;
      const before = Object.fromEntries(ND.Turn.standings(g).map((s) => [s.fid, s.districts]));
      const busy = $('#busy');
      busy.innerHTML = `<div class="busy-card"><span class="busy-dots">${g.order.filter((f) => g.factions[f].alive && f !== g.player)
        .map((f) => `<i style="--fc:${ND.FDEF[f].color}"></i>`).join('')}</span>Rival factions are making their moves…</div>`;
      busy.classList.remove('hidden');
      ND.Sound.beforeTurn(g);
      setTimeout(() => {
        try {
          ND.Turn.end(g);
          ND.Sound.afterTurn(g);
          // The tutorial game never overwrites the real autosave.
          if (g.settings.autosave && !g.tutorial) ND.Save.save(g, 'auto');
          this.panel = { kind: 'district' };
          this.renderAll();
          const after = ND.Turn.standings(g);
          const deltas = after.map((s) => ({ fid: s.fid, d: s.districts - (before[s.fid] || 0) })).filter((x) => x.d !== 0);
          this.flash(g.over ? (g.over.result === 'victory' ? 'VICTORY' : 'DEFEAT') : `TURN ${g.turn}`, deltas, g.over && g.over.result);
          if (g.over) ND.Screens.open('gameover');
          else if (g.settings.autoBriefing !== false || (g.tutorial && !g.tutorial.done)) ND.Screens.open('report', { tab: 'summary', page: 0 });
        } finally {
          busy.classList.add('hidden');
          this.busy = false;
          this.renderTop();
        }
      }, 40);
    },

    // Title card between turns with each faction's real change in territory (purely visual).
    flash(text, deltas = [], result) {
      const el = $('#turnflash');
      el.innerHTML = `<div class="tf-title ${result || ''}">${esc(text)}</div>${deltas.length ? `<div class="tf-rows">${deltas.map((x) => `
        <span class="tf-f" style="--fc:${ND.FDEF[x.fid].color}">${ND.emblemSvg(x.fid)}${esc(ND.FDEF[x.fid].name)} <b class="${x.d > 0 ? 'pos' : 'neg'}">${x.d > 0 ? '+' : ''}${x.d}</b></span>`).join('')}</div>` : ''}`;
      el.classList.remove('hidden', 'go');
      void el.offsetWidth;
      el.classList.add('go');
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => el.classList.add('hidden'), 2000);
    },

    // ---------- tooltip / toast / dialogs ----------
    tooltip(id, e) {
      const tip = $('#tooltip');
      if (id < 0 || !e || !this.g) { tip.classList.add('hidden'); return; }
      const g = this.g, d = g.districts[id];
      const held = d.facilities.filter((f) => f.owner === g.player).length;
      tip.innerHTML = `<div class="tt-name">${esc(d.name)} <span class="dim small">${sector(d)}</span></div>
        <div class="dim">${esc(ND.TYPES[d.type].label)}${d.hq ? ' · HQ' : ''}</div>
        <div class="tt-row"><span>Controller</span><b style="color:${d.owner ? ND.FDEF[d.owner].color : 'inherit'}">${d.owner ? esc(ND.FDEF[d.owner].name) : 'Unaligned'}</b></div>
        <div class="tt-row"><span>Your influence</span><b>${ND.Inf.get(d, g.player)}%</b></div>
        <div class="tt-row"><span>Security</span><b>${d.security}</b></div>
        <div class="tt-row"><span>Facilities held</span><b>${held}/${d.facilities.length}</b></div>`;
      const box = $('#center').getBoundingClientRect();
      tip.classList.remove('hidden');
      tip.style.left = Math.min(e.clientX - box.left + 16, box.width - tip.offsetWidth - 8) + 'px';
      tip.style.top = Math.min(e.clientY - box.top + 16, box.height - tip.offsetHeight - 8) + 'px';
    },
    toast(msg, kind) {
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || '');
      el.innerHTML = ND.icon(kind === 'err' ? 'warn' : kind === 'ok' ? 'check' : 'help');
      el.appendChild(document.createElement('span')).textContent = msg;
      $('#toasts').appendChild(el);
      while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
      setTimeout(() => el.classList.add('out'), 2600);
      setTimeout(() => el.remove(), 3100);
    },
    // Small dialogs only (confirmations, short help). Full screens use ND.Screens.
    modal(title, html) {
      $('#modal-title').textContent = title;
      $('#modal-body').innerHTML = html;
      $('#modal').classList.remove('hidden');
    },
    closeModal() { $('#modal').classList.add('hidden'); },
    openScreen(name) { this.closeModal(); ND.Screens.open(name); },
    // Kept for callers from earlier versions.
    showReport() { ND.Screens.open('report', { tab: 'summary', page: 0 }); },
    showGameOver() { ND.Screens.open('gameover'); },

    cmd(c, arg, arg2) {
      const g = this.g;
      const S = ND.Screens;
      switch (c) {
        case 'close':
          if (!$('#modal').classList.contains('hidden')) this.closeModal();
          else S.close();
          return;
        case 'scr': S.set(arg, arg2); return;
        case 'panel':
          this.panel = arg === 'district' ? { kind: 'district' } : { kind: arg, id: arg === 'unit' ? Number(arg2) : arg2 };
          if (arg === 'unit') this.utab = 'orders';
          this.renderRight();
          return;
        case 'rtab': this.rtab = arg; this.upage = 0; this.renderRight(); return;
        case 'upage': this.upage = Number(arg); this.renderRight(); return;
        case 'utab': this.utab = arg; this.refreshUnitViews(); return;
        case 'treasury': S.open('treasury'); return;
        case 'profile': S.open('factions', { sel: arg }); return;
        case 'battle': S.open('battles', { sel: Number(arg), sub: 'overview' }); return;
        case 'unit': {
          const id = Number(arg);
          if (!g.units[id]) return;
          if (S.cur === 'units') { S.set('sel', id); return; }
          if (S.isOpen()) { S.open('units', { sel: id, tab: 'all', page: 0 }); return; }
          ND.sfx('unitSelect');
          this.panel = { kind: 'unit', id }; this.utab = 'orders'; this.renderRight();
          return;
        }
        case 'order': this.setOrder(Number(arg), arg2); return;
        case 'acttab': this.actTab = arg; this.renderActions(); return;
        case 'sell': case 'buy-res': {
          const r = c === 'sell' ? ND.Market.sell(g, g.player, arg) : ND.Market.buy(g, g.player, arg);
          if (r.ok) ND.sfx('trade');
          this.toast(r.ok ? r.msg : r.reason, r.ok ? 'ok' : 'err');
          this.renderTop(); this.renderLeft(); this.renderActions(); S.refresh();
          return;
        }
        case 'propose': {
          const r = ND.Diplo.propose(g, g.player, arg);
          if (r.ok) ND.sfx(r.accepted ? 'pact' : 'decline');
          this.toast(!r.ok ? r.reason : r.accepted ? `${ND.FDEF[arg].name} accepted the pact.` : `${ND.FDEF[arg].name} refused.`, r.ok && r.accepted ? 'ok' : 'err');
          this.renderAll(); S.refresh();
          return;
        }
        case 'breakpact': {
          const r = ND.Diplo.breakPact(g, g.player, arg);
          if (r.ok) ND.sfx('hostile');
          this.toast(r.ok ? `You broke the pact with ${ND.FDEF[arg].name}.` : r.reason, r.ok ? 'ok' : 'err');
          this.renderAll(); S.refresh();
          return;
        }
        case 'answer': {
          const r = ND.Diplo.answer(g, arg, arg2 === 'yes');
          if (r.ok) ND.sfx(arg2 === 'yes' ? 'pact' : 'decline');
          this.toast(!r.ok ? r.reason : arg2 === 'yes' ? `Pact signed with ${ND.FDEF[arg].name}.` : `You declined ${ND.FDEF[arg].name}'s offer.`, r.ok ? 'ok' : 'err');
          this.renderAll(); S.refresh();
          return;
        }
        case 'diplohelp':
          this.modal('How diplomacy works', `<p>A <b>non-aggression pact</b> lasts ${ND.Diplo.PACT_TURNS} turns. While it holds, neither side can campaign, bribe, canvass, seize or sabotage in the other's districts, attack its units, or run covert operations against it.</p>
            <p>Relations (−100…+100) fall with battles, raids, captured districts and exposed covert operations — at most −6 per pair per turn — and recover by 3 per turn. Pacts warm them.</p>
            <p>Rivals accept when relations are good, when you are stronger than them, or when they have too many enemies. <b>Breaking</b> a pact costs −50 relations with the partner and −10 with everyone else.</p>
            <div class="modal-foot"><button class="btn primary" data-cmd="close">Got it</button></div>`);
          return;
        case 'tutorial':
          // Keep the current game recoverable before switching to the tutorial.
          if (g && (!g.tutorial || g.tutorial.done)) ND.Save.save(g, 'auto');
          this.closeModal(); S.close();
          ND.Tutorial.startGame();
          return;
        case 'covert': {
          const d = g.districts[this.sel];
          const r = ND.Espionage.exec(g, g.player, arg, d);
          if (r.ok) ND.sfx(r.success ? 'hack' : 'alarm');
          if (!r.ok) this.toast(r.reason, 'err');
          else this.toast(r.success ? `Success (${r.pct}%): you ${r.msg}.` : `Failed (${r.pct}%): ${r.msg}. The target is on alert.`, r.success ? 'ok' : 'err');
          this.renderAll();
          return;
        }
        case 'research': {
          const r = ND.Tech.start(g, g.player, arg);
          if (r.ok) ND.sfx('research');
          this.toast(r.ok ? `Research started: ${ND.TECHS[arg].name}.` : r.reason, r.ok ? 'ok' : 'err');
          this.renderTop(); S.refresh();
          return;
        }
        case 'research-cancel': {
          const r = ND.Tech.cancel(g, g.player);
          this.toast(r.ok ? 'Project cancelled; half the cost refunded.' : r.reason, r.ok ? 'ok' : 'err');
          this.renderTop(); S.refresh();
          return;
        }
        case 'move': {
          const u = g.units[arg];
          if (!u) return;
          if (u.injured || u.moved) { this.toast(u.injured ? 'Injured units cannot move.' : 'Already moved this turn.', 'err'); return; }
          this.closeModal(); S.close();
          ND.sfx('moveArm');
          this.moving = u.id;
          this.sel = u.loc;
          this.renderRight(); this.renderActions(); this.drawMap();
          return;
        }
        case 'recruit': {
          const r = ND.Units.recruit(g, g.player, Number(arg));
          if (r.ok) ND.sfx('recruit');
          this.toast(r.ok ? `${r.unit.name} joined at your HQ.` : r.reason, r.ok ? 'ok' : 'err');
          this.renderAll(); S.set('sel', 0);
          return;
        }
        case 'buy': {
          const r = ND.Units.buy(g, g.player, arg);
          if (r.ok) ND.sfx('buy');
          this.toast(r.ok ? `${ND.ITEMS[arg].label} added to the armory.` : r.reason, r.ok ? 'ok' : 'err');
          this.renderAll(); S.refresh();
          return;
        }
        case 'equipto': {
          const u = g.units[arg], it = ND.ITEMS[arg2];
          if (!u || !it) return;
          const slot = ND.UNIT_TYPES[u.type].slots.findIndex((s, i) => s === it.slot && !u.equip[i]);
          const r = slot < 0 ? { ok: false, reason: 'No free slot.' } : ND.Units.equip(g, u, slot, arg2);
          if (r.ok) ND.sfx('equip');
          this.toast(r.ok ? `${u.name} equipped ${it.label}.` : r.reason, r.ok ? 'ok' : 'err');
          this.refreshUnitViews(u.id);
          return;
        }
        case 'dismiss': {
          const u = g.units[arg];
          if (!u) return;
          this.modal('Dismiss unit?', `<p>Discharge <b>${esc(u.name)}</b> (${esc(ND.UNIT_TYPES[u.type].label)}, level ${u.level})? This cannot be undone. Equipment returns to the armory.</p>
            <div class="modal-foot"><button class="btn" data-cmd="close">Cancel</button> <button class="btn danger" data-cmd="dismiss-yes" data-arg="${u.id}">Dismiss</button></div>`);
          return;
        }
        case 'dismiss-yes': {
          const u = g.units[arg];
          if (u) { ND.Units.dismiss(g, u); ND.sfx('dismiss'); this.toast(`${u.name} dismissed.`, 'ok'); }
          this.closeModal();
          if (this.panel.kind === 'unit') this.panel = { kind: 'district' };
          this.renderAll(); S.refresh();
          return;
        }
        case 'end': this.endTurn(); return;
        case 'goto': this.closeModal(); S.close(); this.select(Number(arg)); return;
        case 'save': this.toast(ND.Save.save(g, arg) ? `Saved to slot ${arg}.` : 'Save failed (storage unavailable).', 'ok'); S.refresh(); return;
        case 'load': {
          const s = ND.Save.load(arg);
          if (s) { this.toast(`Loaded ${arg === 'auto' ? 'autosave' : 'slot ' + arg} (turn ${s.turn}).`, 'ok'); this.start(s); }
          else this.toast('That save could not be read.', 'err');
          return;
        }
        case 'del': ND.Save.remove(arg); S.refresh(); return;
        case 'autosave': g.settings.autosave = $('#opt-autosave').checked; return;
        case 'autobrief': g.settings.autoBriefing = $('#opt-brief').checked; return;
        case 'quit': this.closeModal(); S.close(); $('#game').classList.add('hidden'); ND.Title.show('menu'); return;
        default:
      }
    },

    key(e) {
      if (!this.g || $('#game').classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        if (this.moving != null) { this.moving = null; this.drawMap(); return; }
        if (!$('#modal').classList.contains('hidden')) this.closeModal();
        else if (ND.Screens.isOpen() && ND.Screens.cur !== 'gameover') ND.Screens.close();
        else if (this.panel.kind !== 'district') { this.panel = { kind: 'district' }; this.renderRight(); }
        return;
      }
      if (!$('#modal').classList.contains('hidden') || ND.Screens.isOpen()) return;
      if (e.target.matches && e.target.matches('input,textarea,select')) return;
      const d = this.g.districts[this.sel];
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (mv && d) {
        const n = ND.World.at(this.g, d.x + mv[0], d.y + mv[1]);
        if (n) this.select(n.id);
        e.preventDefault();
      } else if (/^[1-5]$/.test(e.key)) {
        const k = ND.Actions.keys[Number(e.key) - 1];
        if (ND.Actions.check(this.g, this.g.player, k, d).ok) this.act(k);
        else this.toast(ND.Actions.check(this.g, this.g.player, k, d).reason, 'err');
      } else if (e.key === 'e' || e.key === 'E') this.endTurn();
    },
  });
})(window.ND);
