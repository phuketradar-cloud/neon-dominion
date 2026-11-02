// DOM interface: panels, command bar, screens and reports. All game changes go through ND.Actions / ND.Turn.
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
  const CAT = { op: 'OPS', control: 'CONTROL', conflict: 'CONFLICT', alert: 'ALERT', econ: 'ECON', unit: 'UNITS', battle: 'BATTLE', tech: 'R&D', spy: 'COVERT', diplo: 'DIPLOMACY' };
  const statLine = (s) => ['atk', 'def', 'inf', 'int'].map((k) => `<span class="st"><i>${ND.STAT_LABEL[k]}</i>${s[k]}</span>`).join('');
  const ORDER_ICON = { rest: 'rest', canvass: 'canvass', guard: 'guard', intel: 'gather', train: 'train', hq: 'hq', seize: 'seize', sabotage: 'sabotage', attack: 'attack' };
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
  const unitStatus = (u) => (u.injured ? `<span class="neg">Injured (${u.injured})</span>` : u.moved ? '<span class="dim">Moved</span>' : '<span class="pos">Ready</span>');

  const UI = (ND.UI = {
    g: null,
    sel: -1,
    map: null,
    moving: null, // unit id awaiting a destination click

    init() {
      this.map = new ND.MapView($('#map'), {
        onSelect: (id) => this.select(id),
        onHover: (id, e) => this.tooltip(id, e),
      });
      // Re-fit the map whenever its container changes size (window resize, top bar wrapping, etc.).
      new ResizeObserver(() => { if (this.g) { this.map.resize(); this.drawMap(); } }).observe($('#center'));
      document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act],[data-mode],[data-screen],[data-cmd]');
        if (!t || t.disabled) return;
        if (t.dataset.act) this.act(t.dataset.act);
        else if (t.dataset.mode) { this.map.mode = t.dataset.mode; this.renderLeft(); this.drawMap(); }
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
      const f = g.factions[g.player];
      this.sel = f.hq != null ? f.hq : ND.World.owned(g, g.player)[0]?.id ?? 0;
      $('#start').classList.add('hidden');
      $('#game').classList.remove('hidden');
      this.closeModal();
      // Wait one tick so the grid layout has its size before the canvas measures it.
      setTimeout(() => {
        this.map.resize();
        this.renderAll();
        // Panels are filled now, so the map's container has its final size.
        this.map.resize();
        this.drawMap();
        if (g.over) this.showGameOver();
        else if (g.tutorial && !g.tutorial.done) ND.Tutorial.attach();
        else if (g.turn === 1) this.openScreen('help');
      }, 0);
    },

    renderAll() {
      this.renderTop();
      this.renderLeft();
      this.renderRight();
      this.renderActions();
      this.drawMap();
    },
    drawMap() {
      if (!this.g) return;
      const u = this.moving != null && this.g.units[this.moving];
      this.map.draw(this.g, this.sel, u ? ND.Units.reach(this.g, u) : null, ND.Tutorial ? ND.Tutorial.hintCell() : null);
      $('#move-banner').classList.toggle('hidden', !u);
      if (u) $('#move-banner').innerHTML = `Moving <b>${esc(u.name)}</b> — click a highlighted district · <b>Esc</b> cancels`;
    },

    select(id) {
      if (this.moving != null) {
        const u = this.g.units[this.moving];
        this.moving = null;
        if (u && id !== u.loc) {
          const r = ND.Units.move(this.g, u, id);
          this.toast(r.ok ? `${u.name} moved to ${this.g.districts[id].name}. Now pick its order.` : r.reason, r.ok ? 'ok' : 'err');
          if (r.ok) { this.renderTop(); this.openUnit = u.id; this.closedUnit = null; }
        }
      }
      this.sel = id;
      this.renderRight();
      this.renderActions();
      this.drawMap();
    },

    // ---------- top bar ----------
    renderTop() {
      const g = this.g, f = g.factions[g.player], L = ND.Econ.ledger(g, g.player);
      const RES_ICON = { credits: 'credits', energy: 'energy', materials: 'materials', intel: 'intel' };
      // Build the resource chips once, then update numbers in place so changes can animate.
      if (!$('#resources .res')) {
        $('#resources').innerHTML = ND.RES.map((r) => `
          <div class="res c-${r}" data-res="${r}">
            ${ND.icon(RES_ICON[r])}
            <span class="res-k">${ND.RES_LABEL[r]}</span>
            <span class="res-row"><span class="res-v num">0</span><span class="res-d"></span></span>
          </div>`).join('');
      }
      for (const r of ND.RES) {
        const el = $(`#resources [data-res="${r}"]`);
        el.title = `${ND.RES_LABEL[r]}: ${f.res[r]} in stock.\nNext turn: ${sgn(L.net[r])} (income ${L.income[r]}, upkeep ${L.upkeep[r]}).`;
        this.tween(el, f.res[r]);
        const dEl = el.querySelector('.res-d');
        dEl.textContent = sgn(L.net[r]);
        dEl.className = 'res-d ' + (L.net[r] < 0 ? 'neg' : 'pos');
      }
      $('#turn').innerHTML = `${ND.icon('turn')}<span class="lbl">Turn</span> <b>${g.turn}</b>`;
      $('#turn').title = 'Current turn';
      const max = ND.Actions.maxOps(g, g.player);
      $('#ops').innerHTML = `${ND.icon('ops')}<span class="lbl">Ops</span> <b>${f.ops}</b>/${max}`;
      $('#ops').title = `Operation points left this turn: ${f.ops} of ${max}.\nEach district or covert operation costs operation points.`;
      $('#ops').classList.toggle('empty', f.ops === 0);
      const us = ND.Units.list(g, g.player);
      const idle = us.filter((u) => !u.injured && u.task.kind === 'rest').length;
      $('#unitpill').innerHTML = `${ND.icon('units')}<span class="lbl">Units</span> <b>${us.length}</b>/${ND.Units.cap(g, g.player)}${idle ? ` <span class="warn">· ${idle} idle</span>` : ''}`;
      $('#unitpill').title = `Units ${us.length} of ${ND.Units.cap(g, g.player)} (cap grows with territory).${idle ? `\n${idle} healthy unit${idle > 1 ? 's have' : ' has'} no orders.` : ''}`;
      const cur = f.tech.current;
      $('#rdpill').innerHTML = cur
        ? `${ND.icon('research')}<b>${esc(ND.TECHS[cur.id].name)}</b> <span class="num">${cur.progress}/${ND.TECHS[cur.id].rp}</span>`
        : `${ND.icon('research')}<span class="warn">Research idle</span>`;
      $('#rdpill').title = cur ? `Researching ${ND.TECHS[cur.id].name}: ${cur.progress}/${ND.TECHS[cur.id].rp} research points.\nClick to open the technology tree.` : 'No research project. Click to open the technology tree.';
      $('#btn-end').disabled = !!g.over;
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
      setTimeout(() => { v.textContent = el.dataset.v; }, dur + 50); // settle even if frames are paused
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
        let x = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
        let y = r.bottom + 8;
        if (y + th > window.innerHeight - 8) y = r.top - th - 8;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
      });
      document.addEventListener('mouseout', (e) => { if (cur && !cur.contains(e.relatedTarget)) hide(); });
      document.addEventListener('mousedown', hide, true);
      document.addEventListener('scroll', hide, true);
    },

    // ---------- left: faction & ledger ----------
    renderLeft() {
      const g = this.g, p = g.player, F = ND.FDEF[p], f = g.factions[p], L = ND.Econ.ledger(g, p);
      const st = ND.Turn.standings(g);
      const me = st.find((s) => s.fid === p), rank = st.indexOf(me) + 1;
      const vp = ND.Victory.progress(g, p);
      const best = Object.keys(vp).sort((a, b) => vp[b].pct - vp[a].pct)[0];
      // Reputation: average relations with living rivals, plus active pacts (diplomacy data).
      const rivals = g.order.filter((x) => x !== p && g.factions[x].alive);
      const avgRel = rivals.length ? Math.round(rivals.reduce((a, x) => a + ND.Diplo.rel(g, p, x), 0) / rivals.length) : 0;
      const pacts = rivals.filter((x) => ND.Diplo.pact(g, p, x)).length;
      const repTxt = avgRel >= 30 ? 'Trusted' : avgRel >= 10 ? 'Respected' : avgRel > -10 ? 'Neutral' : avgRel > -30 ? 'Distrusted' : 'Hated';
      const repCls = avgRel >= 10 ? 'pos' : avgRel > -10 ? '' : 'neg';
      const stat = (icon, k, v, title, txt) => `<div class="fp-stat" title="${esc(title)}"><div class="k">${ND.icon(icon)}${k}</div><div class="v${txt ? ' txt' : ''}">${v}</div></div>`;
      $('#left').innerHTML = `
        <section class="panel faction-card" style="--fc:${F.color}">
          <div class="fp-hero">
            <div class="fp-portrait"><canvas id="portrait" width="96" height="96"></canvas></div>
            <div>
              <div class="fp-name">${esc(F.name)}</div>
              <div class="fp-leader">${esc(F.leader)}</div>
              <div class="fp-motto">“${esc(F.motto)}”</div>
            </div>
          </div>
          <div class="fp-body">
            <p class="fp-desc" title="${esc(F.identity)}">${esc(F.identity)}</p>
            <div class="fp-stats">
              ${stat('factions', 'Districts', L.districts, 'Districts you control')}
              ${stat('star', 'Rank', `#${rank}`, `Position ${rank} of ${st.length} in the standings (${me.score} points)`)}
              ${stat('influence', 'Influence', (me.influence / 100).toFixed(1), 'Total influence across the city, in "full districts" (sum of all your influence ÷ 100)')}
              ${stat('diplomacy', 'Reputation', `<span class="${repCls}">${repTxt}</span>${pacts ? ` <span class="dim small">· ${pacts} pact${pacts > 1 ? 's' : ''}</span>` : ''}`, `Average relations with rival factions: ${sgn(avgRel)}`, true)}
              ${best ? stat('victory', 'Closest win', `<button class="linkbtn" data-screen="victory">${Math.floor(vp[best].pct * 100)}%</button>`, `${ND.VICTORY_INFO[best].name}: ${vp[best].value}/${vp[best].need}. Click for all victory conditions.`) : ''}
              ${stat('crown', 'HQ', f.hq != null ? `<button class="linkbtn" data-cmd="goto" data-arg="${f.hq}">${sector(g.districts[f.hq])}</button>` : '<span class="neg">none</span>', f.hq != null ? `Headquarters: ${g.districts[f.hq].name}. Click to show it.` : 'You have no headquarters', true)}
            </div>
            <div class="trait good">${ND.icon('check')}<div><b>Special ability</b>${esc(F.ability)}</div></div>
            <div class="trait bad">${ND.icon('warn')}<div><b>Weakness</b>${esc(F.weakness)}</div></div>
          </div>
        </section>
        <section class="panel">
          <h3>${ND.icon('economy')}Treasury forecast <span class="small">next turn</span></h3>
          <table class="ledger">
            <tr><th></th>${ND.RES.map((r) => `<th class="c-${r}" title="${ND.RES_LABEL[r]}">${ND.RES_SHORT[r]}</th>`).join('')}</tr>
            <tr><td>Income</td>${ND.RES.map((r) => `<td>${L.income[r]}</td>`).join('')}</tr>
            <tr><td>Districts</td>${ND.RES.map((r) => `<td class="neg">${L.distUpkeep[r] ? '−' + L.distUpkeep[r] : 0}</td>`).join('')}</tr>
            <tr><td>Payroll</td>${ND.RES.map((r) => `<td class="neg">${L.payroll[r] ? '−' + L.payroll[r] : 0}</td>`).join('')}</tr>
            <tr class="net"><td>Net</td>${ND.RES.map((r) => `<td class="${L.net[r] < 0 ? 'neg' : 'pos'}">${sgn(L.net[r])}</td>`).join('')}</tr>
          </table>
          ${L.facilities ? `<div class="small dim">Includes ${L.facilities} held facilit${L.facilities === 1 ? 'y' : 'ies'}.</div>` : ''}
          ${L.skim ? `<div class="small dim">Includes ${L.skim} CR skimmed from ${L.skimDistricts} district(s) where you hold ≥${ND.RULES.skimMin}% without control.</div>` : ''}
          ${ND.RES.some((r) => f.res[r] + L.net[r] < 0) ? `<div class="d-status st-warn small">${ND.icon('warn')}<span>Shortfall ahead: unpaid upkeep causes unrest (−5% influence everywhere); unpaid credits make your priciest unit desert.</span></div>` : ''}
          <div class="market">
            <div class="small dim" title="Trade surplus resources for credits, or buy what you lack. Each Black Market district you control improves rates by 5% (max 25%).">Black market · lots of ${ND.Market.LOT}${ND.Market.bonus(g, p) ? ` · +${Math.round(ND.Market.bonus(g, p) * 100)}% rates` : ''}</div>
            ${ND.Market.goods.map((r) => `<div class="mrow"><span class="c-${r}">${ND.RES_SHORT[r]}</span>
              <button class="btn xs" data-cmd="sell" data-arg="${r}" ${f.res[r] >= ND.Market.LOT && !g.over ? '' : 'disabled'} title="Sell ${ND.Market.LOT} ${ND.RES_LABEL[r]}">Sell → ${ND.Market.sellPrice(g, p, r)} CR</button>
              <button class="btn xs" data-cmd="buy-res" data-arg="${r}" ${f.res.credits >= ND.Market.buyPrice(g, p, r) && !g.over ? '' : 'disabled'} title="Buy ${ND.Market.LOT} ${ND.RES_LABEL[r]}">Buy ← ${ND.Market.buyPrice(g, p, r)} CR</button></div>`).join('')}
          </div>
        </section>
        <section class="panel">
          <h3>${ND.icon('star')}Faction rankings</h3>
          <ol class="standings">${st.map((s, i) => `
            <li class="${s.alive ? '' : 'dead'} ${s.fid === p ? 'me' : ''}" title="${esc(ND.FDEF[s.fid].name)}: ${s.alive ? `${s.districts} districts, ${s.units} units, score ${s.score}` : 'eliminated'}">
              <span class="rk">${i + 1}</span><i class="sw" style="background:${ND.FDEF[s.fid].color}"></i>
              <span class="nm">${esc(ND.FDEF[s.fid].name)}</span>
              <span class="dim small">${s.alive ? s.districts + ' dist' : 'out'}</span><b>${s.score}</b>
            </li>`).join('')}
          </ol>
        </section>
        <section class="panel">
          <h3>${ND.icon('intelnav')}Map overlay</h3>
          <div class="modes">${Object.entries(ND.MAP_MODES).map(([k, v]) => `<button class="btn sm ${this.map.mode === k ? 'on' : ''}" data-mode="${k}" title="${esc(ND.MAP_MODE_HELP[k])}">${v}</button>`).join('')}</div>
          <div class="small dim legend">
            <span title="Faction headquarters">${ND.icon('crown')}HQ</span>
            <span title="Two or more factions hold 20%+ influence"><i class="lg-sw" style="background:var(--danger)"></i>Contested</span>
            <span title="Districts you can operate in"><i class="lg-sw" style="border:1.5px dashed ${F.color}"></i>In reach</span>
            <span title="Facility markers (top-right), coloured by holder"><i class="lg-sw" style="background:var(--text2)"></i>Facilities</span>
            <span title="Development level (gold diamonds)"><i class="lg-sw" style="background:var(--credits);transform:rotate(45deg) scale(.8)"></i>Development</span>
          </div>
        </section>`;
      ND.drawPortrait($('#portrait'), p);
    },

    // ---------- right: district detail ----------
    renderRight() {
      const g = this.g, p = g.player;
      if (this.sel < 0) { $('#right').innerHTML = '<section class="panel dim">Select a district on the map.</section>'; return; }
      const d = g.districts[this.sel], T = ND.TYPES[d.type];
      const ranked = ND.Inf.ranked(d);
      const neutral = ND.Inf.neutral(d);
      const cand = ND.Inf.captureCandidate(d);
      let status, stCls = '', stIcon = 'help';
      if (d.owner && cand && cand !== d.owner) { status = `${esc(ND.FDEF[cand].name)} will seize it at turn end`; stCls = 'st-warn'; stIcon = 'warn'; }
      else if (d.owner && ND.Inf.get(d, d.owner) < ND.RULES.holdMin) { status = `Owner below ${ND.RULES.holdMin}% — control will collapse at turn end`; stCls = 'st-warn'; stIcon = 'warn'; }
      else if (!d.owner && cand) { status = `${esc(ND.FDEF[cand].name)} will take control at turn end`; stCls = cand === p ? 'st-ok' : 'st-warn'; stIcon = cand === p ? 'check' : 'warn'; }
      else if (ND.Inf.contested(d)) { status = 'Contested — several factions hold 20%+'; stCls = 'st-danger'; stIcon = 'battles'; }
      else if (d.owner === p) { status = 'Under your control'; stCls = 'st-ok'; stIcon = 'check'; }
      else status = d.owner ? `Controlled by ${esc(ND.FDEF[d.owner].name)}` : 'Unaligned — nobody controls it';
      const ownerYield = d.owner ? ND.Econ.yieldFor(g, d.owner, d) : null;
      const baseY = ND.RES.filter((r) => T.yields[r]).map((r) => `<span class="c-${r}">${Math.round(T.yields[r] * ND.RULES.devMult[d.dev - 1])} ${ND.RES_SHORT[r]}</span>`).join(' ');
      const myInf = ND.Inf.get(d, p);
      let mine = '';
      if (d.owner === p) {
        const y = ND.Econ.yieldFor(g, p, d), u = ND.Econ.upkeepFor(g, p, d);
        mine = `Yields you ${costHtml(y)} · upkeep ${costHtml(u)}`;
      } else if (myInf >= ND.RULES.skimMin) mine = `You skim <span class="c-credits">${ND.Econ.skimFor(d)} CR</span>/turn here.`;
      else if (ND.World.reachable(g, p, d)) mine = 'Within your reach — you can run operations here.';
      else mine = '<span class="dim">Out of reach — you need a bordering district.</span>';
      const oc = d.owner ? ND.FDEF[d.owner].color : '#3a4f68';
      const secTip = `Security ${d.security} (base ${d.baseSec}). Higher security weakens influence gains and injures canvassers. It drifts back toward its base each turn.`;
      const facTip = `Facilities are held separately from district control. Seize them with units (needs 25% influence here). Each pays its holder ${Object.entries(ND.FAC_YIELD[d.type] || {}).map(([r, v]) => v + ' ' + ND.RES_SHORT[r]).join(' + ')} per turn and +1% influence here.`;
      const inflTip = `Control needs ≥${ND.RULES.captureMin}% and a ${ND.RULES.captureMargin}-point lead over the runner-up. Owners keep control while ≥${ND.RULES.holdMin}%. Changes resolve at end of turn.`;
      $('#right').innerHTML = `
        <section class="panel district" style="--oc:${oc}">
          <div class="d-hero"><canvas id="d-hero-cv"></canvas>
            <span class="d-badge">${sector(d)}</span>
            ${d.hq ? `<span class="d-hq" style="--hc:${ND.FDEF[d.hq].color}">${ND.icon('crown')}HQ</span>` : ''}
          </div>
          <div class="d-body">
            <div>
              <div class="d-name">${esc(d.name)}</div>
              <div class="d-sub">${esc(T.label)}${d.hq ? ` · headquarters of ${esc(ND.FDEF[d.hq].name)}` : ''}</div>
            </div>
            <div class="kv"><span>Controller</span><span>${chip(d.owner)}${d.owner && d.owner !== p && ND.Diplo.pact(g, p, d.owner) ? ' <span class="tag" title="Non-aggression pact in force">PACT</span>' : ''}</span></div>
            <div class="d-status ${stCls}">${ND.icon(stIcon)}<span>${status}</span></div>
            <div class="d-grid">
              <div class="tile" title="Residents (thousands)"><div class="tile-k">${ND.icon('population')}Population</div><div class="tile-v">${d.pop}k</div></div>
              <div class="tile" title="Development level 1–3: level 2 yields ×1.5, level 3 ×2"><div class="tile-k">${ND.icon('dev')}Development</div><div class="tile-v"><span class="pips">${[1, 2, 3].map((i) => `<i class="${i <= d.dev ? 'on' : ''}"></i>`).join('')}</span><span class="small">Lv ${d.dev}</span></div></div>
              <div class="tile wide" title="${esc(secTip)}"><div class="tile-k">${ND.icon('security')}Security</div>
                <div class="tile-v">${d.security} <span class="dim small">base ${d.baseSec}</span></div>
                <div class="meter"><i style="width:${d.security}%;background:linear-gradient(90deg,#f0b84a,#e45b68)"></i><span class="base" style="left:${d.baseSec}%"></span></div></div>
              <div class="tile wide" title="Output per turn for the controller at the current development level"><div class="tile-k">${ND.icon('economy')}Economic value</div><div class="tile-v">${baseY || '—'}${d.hq ? ' <span class="dim small">+HQ bonus</span>' : ''}</div></div>
              ${ownerYield && d.owner !== p ? `<div class="tile wide"><div class="tile-k">${ND.icon('credits')}Owner earns</div><div class="tile-v">${costHtml(ownerYield)}</div></div>` : ''}
            </div>
            ${d.disrupted > 0 ? `<div class="d-status st-danger">${ND.icon('sabotage')}<span>Sabotaged — no output for ${d.disrupted} more collection${d.disrupted > 1 ? 's' : ''}</span></div>` : ''}
            ${g.factions[p].spied[d.id] >= g.turn ? `<div class="d-status st-ok">${ND.icon('spy')}<span>Your informants are active until turn ${g.factions[p].spied[d.id]}</span></div>` : ''}
            <div class="mine">${mine}</div>
          </div>
        </section>
        <section class="panel">
          <h3>${ND.icon('facility')}Facilities <span class="help-ico" title="${esc(facTip)}">${ND.icon('help')}</span></h3>
          ${d.facilities.map((fc) => `<div class="fac-row"><span class="facs">${ND.icon('facility')}${esc(fc.name)}</span>${fc.owner ? chip(fc.owner) : '<span class="chip neutral">Unclaimed</span>'}</div>`).join('')}
        </section>
        ${this.unitsHereHtml(d)}
        <section class="panel">
          <h3>${ND.icon('influence')}Influence <span class="help-ico" title="${esc(inflTip)}">${ND.icon('help')}</span></h3>
          ${ranked.map(([fid, v]) => `<div class="infl ${fid === p ? 'me' : ''}"><span style="color:${ND.FDEF[fid].color}">${esc(ND.FDEF[fid].name)}</span>${bar(v, ND.FDEF[fid].color)}<b>${v}%</b></div>`).join('')}
          <div class="infl"><span class="dim">Unaligned</span>${bar(neutral, '#4a5d75')}<b>${neutral}%</b></div>
          <p class="small dim">Control needs ≥${ND.RULES.captureMin}% and a ${ND.RULES.captureMargin}-point lead. Owners keep control while ≥${ND.RULES.holdMin}%.</p>
        </section>`;
      const cv = $('#d-hero-cv'), dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, cv.clientWidth * dpr); cv.height = Math.max(1, cv.clientHeight * dpr);
      ND.drawDistrictHero(cv, d, d.owner ? ND.FDEF[d.owner].color : '#8fa3ba');
      this.paintPortraits($('#right'));
    },

    paintPortraits(root) {
      root.querySelectorAll('canvas[data-uport]').forEach((c) => { const u = this.g.units[c.dataset.uport]; if (u) ND.drawUnitPortrait(c, u); });
    },

    // ---------- unit cards & orders ----------
    // An order key is "kind", "kind:facilityIndex" or "attack:factionId".
    orderKey(t) { return t.kind + (t.fac != null ? ':' + t.fac : t.target ? ':' + t.target : ''); },

    // The order's display: icon, short name and a one-line forecast.
    orderView(u, t) {
      const d = this.g.districts[u.loc];
      if (t.kind === 'seize' || t.kind === 'sabotage') {
        const fac = d.facilities[t.fac];
        return { icon: ND.icon(ORDER_ICON[t.kind]), name: `${t.kind === 'seize' ? 'Seize' : 'Sabotage'} ${fac ? fac.name : ''}`, info: t.info ? t.info.replace(/^[^:]*: /, '') + ' success' : '' };
      }
      if (t.kind === 'attack') return { icon: ND.icon(ORDER_ICON.attack), name: `Attack ${ND.FDEF[t.target].short}`, info: t.info ? t.info.replace(/^[A-Z]{3} — /, '') : '' };
      return { icon: ND.icon(ORDER_ICON[t.kind]), name: ND.TASKS[t.kind], info: t.info || '' };
    },

    // Grid of order buttons: everyday orders first, then the ones aimed at something in this district.
    orderButtons(u) {
      const opts = ND.Units.tasks(this.g, u);
      const cur = this.orderKey(u.task);
      const btn = (t) => {
        const v = this.orderView(u, t), k = this.orderKey(t), on = k === cur;
        return `<button class="ord ${on ? 'on' : ''}" data-cmd="order" data-arg="${u.id}" data-arg2="${k}" data-order="${k}" ${t.ok && !on ? '' : 'disabled'}
          title="${esc(ORDER_HELP[t.kind] + (t.ok ? '' : '\n\nNot available: ' + t.reason))}">
          <span class="ord-i">${v.icon}</span><span class="ord-n">${esc(v.name)}</span>
          <span class="ord-x">${on ? 'current order' : t.ok ? esc(v.info) : esc(t.reason)}</span></button>`;
      };
      const basic = opts.filter((t) => ['canvass', 'guard', 'intel', 'train', 'rest', 'hq'].includes(t.kind));
      const aimed = opts.filter((t) => ['seize', 'sabotage', 'attack'].includes(t.kind));
      return `<div class="orders">${basic.map(btn).join('')}</div>
        ${aimed.length ? `<div class="ord-h">Targets in this district</div><div class="orders">${aimed.map(btn).join('')}</div>` : ''}`;
    },

    // A card is open if the player opened it, or (in the district panel) if it is the only unit there and
    // has not been closed explicitly.
    isOpen(u, compact) {
      if (this.openUnit === u.id) return true;
      if (this.closedUnit === u.id || !compact) return false;
      return ND.Units.at(this.g, u.loc).filter((x) => x.fid === this.g.player).length === 1;
    },

    // Unit card. Collapsed: who, where, current order, Move. Expanded: the order buttons.
    unitRow(u, compact) {
      const g = this.g, s = ND.Units.stats(u), T = ND.UNIT_TYPES[u.type];
      const open = this.isOpen(u, compact);
      const cur = ND.Units.tasks(g, u).find((t) => this.orderKey(t) === this.orderKey(u.task)) || u.task;
      const v = this.orderView(u, cur);
      const idle = !u.injured && u.task.kind === 'rest';
      const moveWhy = u.injured ? 'Injured units cannot move' : u.moved ? 'Already moved this turn' : 'Move this unit (then click a green district)';
      const cond = u.injured ? `<span class="u-cond neg" title="Injured units rest until healed">Injured · ${u.injured} turn${u.injured > 1 ? 's' : ''}</span>`
        : u.moved ? '<span class="u-cond dim" title="Already moved this turn">Moved</span>' : '<span class="u-cond pos">Ready</span>';
      const eq = T.slots.map((slot, i) => (u.equip[i]
        ? `<span class="eq" title="${esc(slot)}: ${esc(ND.ITEMS[u.equip[i]].label)}">${esc(ND.ITEMS[u.equip[i]].label)}</span>`
        : `<span class="eq empty" title="Empty ${esc(slot)} slot — equip from the unit page">${esc(slot)}</span>`)).join('');
      return `<div class="unit ${u.injured ? 'hurt' : ''} ${open ? 'open' : ''}">
        <div class="u-top">
          <canvas data-uport="${u.id}" width="48" height="48"></canvas>
          <div class="u-main">
            <div class="u-name"><button class="linkbtn" data-cmd="unit" data-arg="${u.id}" title="Open the unit page: equipment, stats, details">${esc(u.name)}</button> <span class="dim">Lv${u.level}</span></div>
            <div class="u-cls">${esc(T.label)} ${cond}${compact ? '' : `<span class="dim">· ${esc(g.districts[u.loc].name)} ${sector(g.districts[u.loc])}</span>`}</div>
            <div class="stats">${statLine(s)}</div>
            <div class="u-eq">${eq}</div>
          </div>
        </div>
        <div class="u-bar">
          <button class="u-cur ${idle ? 'idle' : ''}" data-cmd="utoggle" data-arg="${u.id}" title="Change this unit's order">
            <span class="ord-i">${v.icon}</span><span><b>${esc(v.name)}</b>${idle ? ' — no orders!' : ''}</span><span class="u-chg">${open ? '▲' : 'Change ▼'}</span>
          </button>
          <button class="btn sm u-move" data-cmd="move" data-arg="${u.id}" ${u.injured || u.moved ? 'disabled' : ''} title="${moveWhy}">${ND.icon('move')}Move</button>
        </div>
        ${open && !u.injured ? this.orderButtons(u) : ''}
        ${u.injured ? `<div class="small neg">Injured — resting ${u.injured} more turn${u.injured > 1 ? 's' : ''}.</div>` : ''}
      </div>`;
    },

    unitsHereHtml(d) {
      const g = this.g, p = g.player;
      const here = ND.Units.at(g, d.id);
      const mine = here.filter((u) => u.fid === p);
      const seen = ND.Log.canSee(g, p, d.id);
      const rivals = here.filter((u) => u.fid !== p);
      return `<section class="panel">
        <h3>Units here <span class="dim small">${mine.length} yours${seen ? `, ${rivals.length} rival` : ''}</span></h3>
        ${mine.map((u) => this.unitRow(u, true)).join('') || '<p class="small dim">None of your units are here. Use ➜ Move on a unit, or recruit at your HQ.</p>'}
        ${seen ? rivals.map((u) => `<div class="rival small"><i class="sw" style="background:${ND.FDEF[u.fid].color}"></i> ${esc(u.name)} · ${esc(ND.UNIT_TYPES[u.type].label)} Lv${u.level} · <span class="dim">${esc(ND.Units.taskLabel(g, u))}</span></div>`).join('') : '<p class="small dim">Rival units here are hidden — you have no eyes on this district.</p>'}
        ${rivals.length && seen ? `<p class="small dim">Use the ⚔ Attack order to fight them.${d.owner && d.owner !== p && rivals.some((u) => u.fid === d.owner && u.task.kind === 'guard') ? ' <span class="warn">Owner guards will intercept your units that canvass, seize or sabotage here.</span>' : ''}</p>` : ''}
      </section>`;
    },

    setOrder(id, key) {
      const u = this.g.units[id];
      if (!u) return;
      const [kind, arg] = key.split(':');
      const t = arg == null ? { kind } : kind === 'attack' ? { kind, target: arg } : { kind, fac: Number(arg) };
      const r = ND.Units.setTask(this.g, u, t);
      if (!r.ok) this.toast(r.reason, 'err');
      else { this.openUnit = null; this.closedUnit = id; this.toast(`${u.name}: ${this.orderView(u, ND.Units.tasks(this.g, u).find((x) => this.orderKey(x) === key) || t).name}.`, 'ok'); }
      this.refreshUnitViews(id);
    },

    // Re-render whatever is showing units (right panel, roster, unit page).
    refreshUnitViews(id) {
      this.renderTop();
      this.renderRight();
      this.drawMap();
      const t = $('#modal').classList.contains('hidden') ? '' : $('#modal-title').textContent;
      if (t === 'Unit Management') this.screenUnits();
      else if (id != null && this.g.units[id] && t === this.g.units[id].name) this.screenUnit(id);
    },
    equipSlot(id, slot, key) {
      const u = this.g.units[id];
      if (!u) return;
      const r = ND.Units.equip(this.g, u, slot, key || null);
      if (!r.ok) this.toast(r.reason, 'err');
      this.screenUnit(id);
      this.renderRight();
    },

    // ---------- bottom: commands ----------
    renderActions() {
      const g = this.g, p = g.player, f = g.factions[p];
      if (this.sel < 0) { $('#actions').innerHTML = '<div class="dim">Select a district to see available operations.</div>'; return; }
      const d = g.districts[this.sel];
      const tab = this.actTab || 'district';
      const max = ND.Actions.maxOps(g, p);
      const head = `
        <div class="act-head">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">
            <div class="tabs">
              <button class="tab ${tab === 'district' ? 'on' : ''}" data-cmd="acttab" data-arg="district" title="Influence, security and development operations">${ND.icon('campaign')}District Ops</button>
              <button class="tab ${tab === 'covert' ? 'on' : ''}" data-cmd="acttab" data-arg="covert" title="Espionage and special operations">${ND.icon('spy')}Covert Ops</button>
            </div>
            <span class="act-target">${esc(d.name)} <span class="dim small num">${sector(d)}</span></span>
          </div>
          <div class="act-meta">${ND.icon('ops')}<span>Operation points <b>${f.ops}</b>/${max}</span>${tab === 'district' ? '<span>· keys 1–5</span>' : ''}${f.leaderless ? '<span class="neg">· LEADERLESS</span>' : ''}</div>
        </div>`;
      // One card: icon, name, short description, expected result, cost + OPS, and why it is unavailable.
      const card = (attr, icon, label, shortDesc, expected, cost, ops, c, tip, hotkey) => `
        <button class="act ${c.ok ? '' : 'off'}" ${attr} ${c.ok ? '' : 'disabled'} title="${esc(tip)}">
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
      // Show "rivals are acting" first, then run the real turn on the next tick so the overlay can paint.
      const busy = $('#busy');
      busy.innerHTML = `<div class="busy-card"><span class="busy-dots">${g.order.filter((f) => g.factions[f].alive && f !== g.player)
        .map((f) => `<i style="--fc:${ND.FDEF[f].color}"></i>`).join('')}</span>Rival factions are making their moves…</div>`;
      busy.classList.remove('hidden');
      setTimeout(() => {
        try {
          const report = ND.Turn.end(g);
          // The tutorial game never overwrites the real autosave.
          if (g.settings.autosave && !g.tutorial) ND.Save.save(g, 'auto');
          this.renderAll();
          const after = ND.Turn.standings(g);
          const deltas = after.map((s) => ({ fid: s.fid, d: s.districts - (before[s.fid] || 0), alive: s.alive })).filter((x) => x.d !== 0);
          this.flash(g.over ? (g.over.result === 'victory' ? 'VICTORY' : 'DEFEAT') : `TURN ${g.turn}`, deltas, g.over && g.over.result);
          if (g.over) this.showGameOver();
          else this.showReport(report);
        } finally {
          busy.classList.add('hidden');
          this.busy = false;
          this.renderTop();
        }
      }, 40);
    },

    // Title card between turns, with each faction's real change in territory (purely visual; never blocks input).
    flash(text, deltas = [], result) {
      const el = $('#turnflash');
      el.innerHTML = `<div class="tf-title ${result || ''}">${esc(text)}</div>${deltas.length ? `<div class="tf-rows">${deltas.map((x) => `
        <span class="tf-f" style="--fc:${ND.FDEF[x.fid].color}"><i></i>${esc(ND.FDEF[x.fid].name)} <b class="${x.d > 0 ? 'pos' : 'neg'}">${x.d > 0 ? '+' : ''}${x.d}</b> <span class="dim small">district${Math.abs(x.d) > 1 ? 's' : ''}</span></span>`).join('')}</div>` : ''}`;
      el.classList.remove('hidden', 'go');
      void el.offsetWidth; // restart the animation
      el.classList.add('go');
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => el.classList.add('hidden'), 2000);
    },

    // ---------- tooltip / toast ----------
    tooltip(id, e) {
      const tip = $('#tooltip');
      // The map's own animation loop draws the hover highlight; this only manages the info bubble.
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
      setTimeout(() => el.classList.add('out'), 2600);
      setTimeout(() => el.remove(), 3100);
    },

    // ---------- modal screens ----------
    modal(title, html, wide) {
      $('#modal-title').textContent = title;
      $('#modal-body').innerHTML = html;
      $('#modal .modal-box').classList.toggle('wide', !!wide);
      $('#modal').classList.remove('hidden');
    },
    closeModal() { $('#modal').classList.add('hidden'); },

    openScreen(name) {
      const fn = { factions: this.screenFactions, intel: this.screenIntel, victory: this.screenVictory, settings: this.screenSettings, help: this.screenHelp,
        units: this.screenUnits, recruit: this.screenRecruit, armory: this.screenArmory, battles: this.screenBattles, research: this.screenResearch,
        diplomacy: this.screenDiplomacy,
        report: () => this.showReport(this.g.lastReport) }[name];
      if (fn) fn.call(this);
    },

    screenResearch() {
      const g = this.g, p = g.player, f = g.factions[p];
      const cur = f.tech.current;
      const card = (id) => {
        const t = ND.TECHS[id], st = ND.Tech.status(g, p, id), chk = ND.Tech.canStart(g, p, id);
        const prog = st === 'active' ? cur.progress : st === 'done' ? t.rp : 0;
        return `<div class="tech ${st}">
          <div class="tech-name">${esc(t.name)} <span class="tag ${st === 'done' ? '' : 'dimtag'}">${{ done: 'DONE', active: 'IN PROGRESS', available: 'AVAILABLE', locked: 'LOCKED' }[st]}</span></div>
          <div class="small">${esc(t.effect)}</div>
          ${t.req.length ? `<div class="small dim">Requires: ${t.req.map((r) => `<span class="${ND.Tech.has(g, p, r) ? 'pos' : 'neg'}">${esc(ND.TECHS[r].name)}</span>`).join(', ')}</div>` : ''}
          <div class="small">${costHtml(t.cost)} · ${t.rp} RP</div>
          ${st === 'active' || st === 'done' ? bar((prog / t.rp) * 100, st === 'done' ? '#8cff3a' : '#2fd6e6') + ` <span class="small">${Math.min(prog, t.rp)}/${t.rp}</span>` : ''}
          ${st === 'available' ? `<button class="btn xs" data-cmd="research" data-arg="${id}" ${chk.ok ? '' : 'disabled'} title="${chk.ok ? '' : esc(chk.reason)}">Research</button>${chk.ok ? '' : ` <span class="small neg">${esc(chk.reason)}</span>`}` : ''}
        </div>`;
      };
      const ids = ND.Tech.listFor(p).filter((id) => id !== 'singularity');
      const col = (b) => `<div class="tech-col"><h3>${ND.BRANCHES[b]}</h3>${ids.filter((id) => ND.TECHS[id].branch === b).map(card).join('')}</div>`;
      const rp = ND.Tech.rpPerTurn(g, p);
      const eta = cur ? Math.ceil((ND.TECHS[cur.id].rp - cur.progress) / Math.max(1, rp)) : null;
      this.modal('Technology Tree', `
        <div class="bar-row"><span>${cur ? `Researching <b>${esc(ND.TECHS[cur.id].name)}</b> — ${cur.progress}/${ND.TECHS[cur.id].rp} RP${rp ? `, done in ~${eta} turn${eta === 1 ? '' : 's'}` : ' (frozen)'}` : '<span class="warn">No active project.</span> Pick one below.'}</span>
          <span>${cur ? '<button class="btn sm danger" data-cmd="research-cancel">Cancel (50% refund)</button>' : ''}</span></div>
        <p class="small dim">Research points: <b>${rp}</b>/turn = 2 base + 1 per controlled Research Facility + 0.5 per research facility you hold${ND.Tech.has(g, p, 'aiIntel') ? ' + 1 AI Intelligence' : ''}. One project at a time; the cost is paid up front. Completed: ${f.tech.done.length}/${ids.length}.</p>
        <div class="tech-grid">${col('military')}${col('bio')}${col('info')}${col('faction')}</div>
        <h3>Ultimate${g.victory.tech.on ? ' — completing it wins Technological Supremacy' : ' — Technological Supremacy is switched off in this game'}</h3>
        <div class="tech-ultimate">${card('singularity')}</div>`, true);
    },

    battleList(list) {
      const g = this.g;
      if (!list.length) return '<p class="dim">No battles observed.</p>';
      return `<ul class="events">${list.map((b) => {
        const d = g.districts[b.d], A = ND.FDEF[b.att.fid], D = ND.FDEF[b.def.fid];
        const mine = b.att.fid === g.player || b.def.fid === g.player;
        const won = b.winner === g.player;
        return `<li class="ev-battle">
          <span class="ev-tag ${mine ? (won ? 'won' : 'lost') : ''}">${mine ? (won ? 'WON' : 'LOST') : 'T' + b.turn}</span>
          <span><b style="color:${A.color}">${esc(A.short)}</b> ${b.att.units.length} vs <b style="color:${D.color}">${esc(D.short)}</b> ${b.def.units.length} — ${b.kind === 'interception' ? 'interception' : 'assault'} in ${esc(d.name)}, turn ${b.turn}. <span class="dim">${esc(ND.FDEF[b.winner].name)} won.</span></span>
          <span class="ev-btns"><button class="btn xs" data-cmd="battle" data-arg="${b.id}">Report</button></span>
        </li>`;
      }).join('')}</ul>`;
    },

    screenBattles() {
      const g = this.g;
      const list = g.battles.filter((b) => ND.Combat.visibleTo(g, b, g.player));
      const mine = list.filter((b) => b.att.fid === g.player || b.def.fid === g.player);
      this.modal('Battle Reports', `
        <p class="small dim">Battles you fought or could observe (the most recent 60 battles city-wide are kept). Your record here: ${mine.filter((b) => b.winner === g.player).length} won, ${mine.filter((b) => b.winner !== g.player).length} lost.</p>
        ${this.battleList(list)}`, true);
    },

    screenBattle(id) {
      const g = this.g, b = g.battles.find((x) => x.id === Number(id));
      if (!b) { this.screenBattles(); return; }
      const d = g.districts[b.d];
      const fateTag = { killed: '<span class="neg">KILLED</span>', wounded: '<span class="warn">WOUNDED</span>', hurt: '<span class="warn">HURT</span>', fit: '<span class="pos">OK</span>' };
      const side = (S, role) => {
        const F = ND.FDEF[S.fid];
        const mods = [`morale ${sgn(S.morale)} ATK`];
        if (S.bonus && S.bonus.total) mods.push(`district defense +${S.bonus.total} DEF (${S.bonus.parts.map((p) => `${p[0]} +${p[1]}`).join(', ')})`);
        if (F.mods.combat) mods.push(`doctrine: ${F.military.split(' — ')[0]}`);
        return `<div class="bside" style="--fc:${F.color}">
          <div class="fc-name">${role}: ${esc(F.name)} ${b.winner === S.fid ? '<span class="tag">VICTOR</span>' : ''}</div>
          <div class="small dim">${mods.map(esc).join(' · ')}</div>
          <table class="slots"><tr><th>Unit</th><th>ATK</th><th>DEF</th><th>HP</th><th>Downs</th><th>Fate</th></tr>
          ${S.units.map((u) => `<tr><td>${esc(u.name)}<div class="small dim">${esc(ND.UNIT_TYPES[u.type].label)} Lv${u.level}</div></td><td>${u.atk}</td><td>${u.def}</td>
            <td>${bar((u.hp / u.maxHp) * 100, u.hp ? '#8cff3a' : '#ff5566')} ${u.hp}/${u.maxHp}</td><td>${u.downs}</td><td>${fateTag[u.fate] || ''}</td></tr>`).join('')}
          </table></div>`;
      };
      const rounds = b.rounds.map((lines, i) => `<details ${i === 0 ? 'open' : ''}><summary>Round ${i + 1} — ${lines.filter((l) => l.hit).length} hit${lines.filter((l) => l.hit).length === 1 ? '' : 's'}, ${lines.filter((l) => l.down).length} down</summary>
        <ul class="blog">${lines.map((l) => `<li><span style="color:${ND.FDEF[l.af].color}">${esc(l.a)}</span> → <span style="color:${ND.FDEF[l.tf].color}">${esc(l.t)}</span>:
          ${l.hit ? `hit for <b>${l.dmg}</b>${l.down ? ' — <b class="neg">DOWN</b>' : ''}` : '<span class="dim">miss</span>'} <span class="dim">(${l.pct}%)</span></li>`).join('')}</ul></details>`).join('');
      this.modal(`Battle Report — ${d.name}`, `
        <p>${b.kind === 'interception' ? 'Interception' : 'Assault'} in <b>${esc(d.name)}</b> [${sector(d)}], turn ${b.turn}. <b style="color:${ND.FDEF[b.winner].color}">${esc(ND.FDEF[b.winner].name)}</b> won.</p>
        <div class="cols">${side(b.att, 'Attacker')}${side(b.def, 'Defender')}</div>
        <h3>Combat log</h3>${rounds}
        <h3>Aftermath</h3><ul class="small">${b.consequences.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <div class="modal-foot"><button class="btn" data-screen="battles">◂ All battles</button> <button class="btn" data-cmd="goto" data-arg="${b.d}">Show on map</button></div>`, true);
    },

    screenUnits() {
      const g = this.g, p = g.player, us = ND.Units.list(g, p);
      const L = ND.Econ.ledger(g, p);
      this.modal('Unit Management', `
        <div class="bar-row"><span>${us.length} / ${ND.Units.cap(g, p)} units · payroll ${costHtml(L.payroll)} per turn</span>
          <span><button class="btn sm" data-screen="recruit">Recruit</button> <button class="btn sm" data-screen="armory">Armory</button></span></div>
        <p class="small dim">Orders are standing: a unit repeats its order every turn until you change it. Each unit may move once per turn. Orders resolve at end of turn.</p>
        <div class="roster">${us.map((u) => this.unitRow(u, false)).join('') || '<p class="dim">No units yet. Recruit personnel to canvass districts, guard territory and seize facilities.</p>'}</div>`, true);
      this.paintPortraits($('#modal-body'));
    },

    screenUnit(id) {
      const g = this.g, u = g.units[id];
      if (!u) { this.screenUnits(); return; }
      const T = ND.UNIT_TYPES[u.type], s = ND.Units.stats(u), f = g.factions[u.fid], d = g.districts[u.loc];
      const next = ND.Units.nextLevelXp(u);
      const slots = T.slots.map((slot, i) => {
        const cur = u.equip[i];
        const options = Object.entries(ND.ITEMS).filter(([k, it]) => it.slot === slot && (f.inventory[k] > 0 || k === cur));
        return `<div class="kv"><span>${slot.toUpperCase()} ${i + 1}</span>
          <select class="equip-sel" data-unit="${u.id}" data-slot="${i}">
            <option value="">— empty —</option>
            ${options.map(([k, it]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(it.label)} (${Object.entries(it.bonus).map(([b, v]) => '+' + v + ' ' + ND.STAT_LABEL[b]).join(' ')})${k === cur ? '' : ` ×${f.inventory[k]}`}</option>`).join('')}
          </select></div>`;
      }).join('');
      this.modal(u.name, `
        <div class="cols">
          <div>
            <div class="fc-head"><canvas data-uport="${u.id}" width="128" height="128" class="bigport"></canvas>
              <div><div class="fc-name" style="color:${ND.FDEF[u.fid].color}">${esc(T.label)}</div>
              <div class="small">Level ${u.level} · ${u.xp} XP${next ? ` / ${next}` : ' (max)'}</div>
              ${next ? bar(((u.xp - ND.Units.XP_LEVELS[u.level - 1]) / (next - ND.Units.XP_LEVELS[u.level - 1])) * 100, '#8cff3a') : ''}
              <div class="small">${unitStatus(u)} · in ${esc(d.name)} [${sector(d)}]</div>
              <div class="small dim">Joined turn ${u.joined}</div></div></div>
            <h3>Stats <span class="dim small">base + level + equipment</span></h3>
            <div class="stats big">${statLine(s)}</div>
            <p class="small"><span class="tag">SPECIAL</span> ${esc(T.special)}</p>
            <p class="small dim">${esc(T.desc)}</p>
            <div class="kv"><span>Maintenance</span><b>${costHtml(T.upkeep)} / turn</b></div>
          </div>
          <div>
            <h3>Orders</h3>
            <div class="u-bar"><span class="small">Current: <b>${esc(ND.Units.taskLabel(g, u))}</b></span>
              <button class="btn sm u-move" data-cmd="move" data-arg="${u.id}" ${u.injured || u.moved ? 'disabled' : ''}>${ND.icon('move')}Move</button></div>
            ${u.injured ? `<p class="small neg">Injured — resting ${u.injured} more turn${u.injured > 1 ? 's' : ''}.</p>` : this.orderButtons(u)}
            <p class="small dim">Canvass raises your influence here · Guard (your districts) blunts rival campaigns, intercepts intruders and gets +2 DEF in battle · Attack fights a rival's units here (odds shown are an estimate) · Seize/Sabotage target facilities · Train buys experience.</p>
            <h3>Equipment</h3>
            ${slots}
            <p class="small dim">Items come from your armory. Unequipping returns them there.</p>
            <h3>Discharge</h3>
            <button class="btn sm danger" data-cmd="dismiss" data-arg="${u.id}">Dismiss unit</button>
            <span class="small dim">Equipment is returned to the armory; the unit is gone for good.</span>
          </div>
        </div>
        <div class="modal-foot"><button class="btn" data-screen="units">◂ All units</button></div>`, true);
      this.paintPortraits($('#modal-body'));
    },

    screenRecruit() {
      const g = this.g, p = g.player, f = g.factions[p], sig = ND.SIGNATURE[p];
      const cards = f.market.map((c, i) => {
        const T = ND.UNIT_TYPES[c.type], chk = ND.Units.canRecruit(g, p, i);
        return `<article class="fbox recruit" style="--fc:${ND.FDEF[p].color}">
          <div class="fc-head"><canvas data-cand="${i}" width="64" height="64"></canvas>
            <div><div class="fc-name">${esc(c.name)}</div><div class="small">${esc(T.label)}${c.type === sig ? ' <span class="tag">SIGNATURE</span>' : ''}</div></div></div>
          <div class="stats">${statLine(c.base)}</div>
          <div class="small"><span class="tag">SPECIAL</span> ${esc(T.special)}</div>
          <div class="small dim">Slots: ${T.slots.join(', ')}</div>
          <div class="kv"><span>Hire</span><b>${costHtml(chk.cost)}</b></div>
          <div class="kv"><span>Maintenance</span><b>${costHtml(T.upkeep)} / turn</b></div>
          ${T.req && c.type !== sig && ND.Units.reqMet(g, p, c.type) ? `<div class="small dim">Requires a controlled ${T.req.map((t) => ND.TYPES[t].label).join(' or ')} ✓</div>` : ''}
          <button class="btn primary" data-cmd="recruit" data-arg="${i}" ${chk.ok ? '' : 'disabled'}>Recruit</button>
          ${chk.ok ? '' : `<div class="small neg">${esc(chk.reason)}</div>`}
        </article>`;
      }).join('');
      this.modal('Recruitment', `
        <div class="bar-row"><span>Roster ${ND.Units.list(g, p).length} / ${ND.Units.cap(g, p)} (cap = 3 + 1 per 2 districts, max 20) · recruits report to your HQ</span>
          <button class="btn sm" data-screen="units">Unit Management</button></div>
        <p class="small dim">New candidates arrive every turn; unhired ones move on. Your signature unit (${esc(ND.UNIT_TYPES[sig].label)}) costs 25% less, shows up three times as often and ignores facility requirements.</p>
        <div class="fgrid">${cards || '<p class="dim">Nobody left to hire this turn.</p>'}</div>`, true);
      document.querySelectorAll('canvas[data-cand]').forEach((cv) => {
        const c = f.market[cv.dataset.cand];
        ND.drawUnitPortrait(cv, { name: c.name, fid: p, skin: c.skin, hair: c.hair, type: c.type });
      });
    },

    screenArmory() {
      const g = this.g, p = g.player, f = g.factions[p];
      const rows = Object.entries(ND.ITEMS).map(([k, it]) => {
        const chk = ND.Units.canBuy(g, p, k);
        return `<tr><td><b>${esc(it.label)}</b><div class="small dim">${it.note ? esc(it.note) : ''}</div></td><td>${it.slot}</td>
          <td>${Object.entries(it.bonus).map(([b, v]) => `+${v} ${ND.STAT_LABEL[b]}`).join(' ')}</td>
          <td>${costHtml(it.cost)}</td><td class="num">${f.inventory[k] || 0}</td>
          <td><button class="btn xs" data-cmd="buy" data-arg="${k}" ${chk.ok ? '' : 'disabled'} title="${chk.ok ? '' : esc(chk.reason)}">Buy</button></td></tr>`;
      }).join('');
      this.modal('Equipment Inventory', `
        <p class="small dim">Bought gear goes into your armory. Equip it from a unit's page (Unit Management → click a name). Stock column = unequipped items you own.</p>
        <table class="slots armory"><tr><th>Item</th><th>Slot</th><th>Bonus</th><th>Price</th><th>Stock</th><th></th></tr>${rows}</table>
        <div class="modal-foot"><button class="btn" data-screen="units">Unit Management</button></div>`, true);
    },

    eventList(events) {
      if (!events.length) return '<p class="dim">No activity observed.</p>';
      return `<ul class="events">${events.map((e) => `
        <li class="ev-${e.cat}">
          <span class="ev-tag">${CAT[e.cat] || e.cat}</span>
          <span>${esc(e.text)}</span>
          <span class="ev-btns">${e.battle && this.g.battles.some((b) => b.id === e.battle) ? `<button class="btn xs" data-cmd="battle" data-arg="${e.battle}">Report</button>` : ''}
          ${e.d != null ? `<button class="btn xs" data-cmd="goto" data-arg="${e.d}">${sector(this.g.districts[e.d])}</button>` : ''}</span>
        </li>`).join('')}</ul>`;
    },

    showReport(rep) {
      const g = this.g;
      if (!rep) { this.modal('Intelligence Briefing', '<p class="dim">No briefing yet — end your first turn.</p>'); return; }
      const L = rep.ledger;
      const order = { control: 0, alert: 1, battle: 2, conflict: 3, unit: 4, op: 5 };
      const events = rep.events.slice().sort((a, b) => (order[a.cat] ?? 9) - (order[b.cat] ?? 9));
      this.modal(`Intelligence Briefing — Turn ${rep.turn}`, `
        <div class="cols">
          <div>
            <h3>1 · Income collected &nbsp; 2 · Maintenance paid</h3>
            ${L ? `<table class="ledger big">
              <tr><th></th>${ND.RES.map((r) => `<th class="c-${r}">${ND.RES_LABEL[r]}</th>`).join('')}</tr>
              <tr><td>Income</td>${ND.RES.map((r) => `<td>+${L.income[r]}</td>`).join('')}</tr>
              <tr><td>Districts</td>${ND.RES.map((r) => `<td class="neg">−${L.distUpkeep[r]}</td>`).join('')}</tr>
              <tr><td>Payroll</td>${ND.RES.map((r) => `<td class="neg">−${L.payroll[r]}</td>`).join('')}</tr>
              <tr class="net"><td>Net</td>${ND.RES.map((r) => `<td class="${L.net[r] < 0 ? 'neg' : 'pos'}">${sgn(L.net[r])}</td>`).join('')}</tr>
              <tr><td>In stock</td>${ND.RES.map((r) => `<td><b>${rep.stock[r]}</b></td>`).join('')}</tr>
            </table>` : ''}
            ${rep.unrest ? `<p class="warn">Unpaid upkeep (${rep.unrest.map((r) => ND.RES_LABEL[r]).join(', ')}) — unrest cost you influence in every district.</p>` : ''}
            <h3>Standings</h3>
            <ol class="standings">${rep.standings.map((s) => `<li class="${s.alive ? '' : 'dead'} ${s.fid === g.player ? 'me' : ''}"><i class="sw" style="background:${ND.FDEF[s.fid].color}"></i><span class="nm">${esc(ND.FDEF[s.fid].name)}</span><span class="dim">${s.alive ? s.districts + ' dist' : 'ELIMINATED'}</span><b>${s.score}</b></li>`).join('')}</ol>
            ${(rep.battles || []).length ? `<h3>Battles observed</h3>${this.battleList(g.battles.filter((b) => rep.battles.includes(b.id)))}` : ''}
            ${this.offersHtml()}
          </div>
          <div>
            <h3>3 · Field reports <span class="dim small">(${events.length} observed${ND.FDEF[g.player].mods.panopticon ? ' — Panopticon: city-wide' : ' — only near your territory'})</span></h3>
            ${this.eventList(events)}
          </div>
        </div>
        <div class="modal-foot"><button class="btn primary" data-cmd="close">Issue commands ▸</button></div>`, true);
    },

    screenFactions() {
      const g = this.g, p = g.player, st = ND.Turn.standings(g);
      const seeAll = ND.FDEF[p].mods.panopticon;
      const est = (v) => (v < 100 ? '<100' : `~${Math.round(v / 100) * 100}`);
      this.modal('Faction Management', `
        <div class="fgrid">${g.order.map((fid) => {
          const F = ND.FDEF[fid], f = g.factions[fid], s = st.find((x) => x.fid === fid);
          const exact = fid === p || seeAll || g.factions[p].spiedFaction[fid] >= g.turn;
          return `<article class="fbox ${f.alive ? '' : 'dead'}" style="--fc:${F.color}">
            <div class="fc-head"><canvas class="fport" data-fid="${fid}" width="64" height="64"></canvas>
              <div><div class="fc-name">${esc(F.name)} ${fid === p ? '<span class="tag">YOU</span>' : ''}</div><div class="dim small">${esc(F.leader)}</div>
              <div class="small">${f.alive ? `${s.districts} districts · ${s.units} units · score ${s.score} · seized ${f.captured} / lost ${f.lost}` : `<span class="neg">Eliminated on turn ${f.eliminatedTurn}</span>`}</div></div></div>
            <p class="small">${esc(F.identity)}</p>
            <div class="small"><span class="tag">ABILITY</span> ${esc(F.ability)}</div>
            <div class="small"><span class="tag">ECONOMY</span> ${esc(F.economy)}</div>
            <div class="small"><span class="tag bad">WEAKNESS</span> ${esc(F.weakness)}</div>
            <div class="small"><span class="tag">AI</span> ${esc(F.aiStrategy)}</div>
            <div class="small"><span class="tag">SIGNATURE UNIT</span> ${esc(ND.UNIT_TYPES[ND.SIGNATURE[fid]].label)} — 25% cheaper, common, no facility requirement.</div>
            <div class="small"><span class="tag">COMBAT DOCTRINE</span> ${esc(F.military)}</div>
            ${(() => { const sid = ND.Tech.listFor(fid).find((id) => ND.TECHS[id].faction === fid); return `<div class="small"><span class="tag">SIGNATURE TECH</span> ${esc(ND.TECHS[sid].name)} — ${esc(ND.TECHS[sid].effect)}${exact && f.alive ? ` <span class="${f.tech.done.includes(sid) ? 'pos' : 'dim'}">(${f.tech.done.includes(sid) ? 'researched' : 'not yet researched'})</span>` : ''}</div>`; })()}
            ${f.alive ? `<div class="small">${exact ? `${f.tech.done.length} technologies${f.tech.current ? ` · researching ${esc(ND.TECHS[f.tech.current.id].name)}` : ''}` : '<span class="dim">Research unknown — spy on them to find out.</span>'}${f.leaderless ? ` · <span class="neg">LEADERLESS (${f.leaderless})</span>` : ''}</div>` : ''}
            <div class="treasury small">${ND.RES.map((r) => `<span class="c-${r}">${ND.RES_SHORT[r]} ${exact ? f.res[r] : est(f.res[r])}</span>`).join(' ')} ${exact ? '' : '<span class="dim">(estimated)</span>'}</div>
          </article>`;
        }).join('')}</div>`, true);
      document.querySelectorAll('.fport').forEach((c) => ND.drawPortrait(c, c.dataset.fid));
    },

    screenIntel() {
      const g = this.g;
      const turns = [g.current, ...g.history];
      const html = turns.map((t) => {
        const ev = t.entries.filter((e) => e.seen);
        return `<details ${t === g.current || t === g.history[0] ? 'open' : ''}><summary>Turn ${t.turn}${t === g.current ? ' (in progress)' : ''} — ${ev.length} reports</summary>${this.eventList(ev)}</details>`;
      }).join('');
      this.modal('Intelligence Reports', `<p class="small dim">You only observe operations in or next to your territory, and wherever you hold influence${ND.FDEF[g.player].mods.panopticon ? ' — except the Cyber Cult, whose Panopticon sees the whole city' : ''}. Last 40 turns kept.</p>${html}`, true);
    },

    screenVictory() {
      const g = this.g, p = g.player;
      const alive = g.order.filter((fid) => g.factions[fid].alive);
      const prog = Object.fromEntries(alive.map((fid) => [fid, ND.Victory.progress(g, fid)]));
      const sections = Object.keys(ND.VICTORY_INFO).map((k) => {
        const info = ND.VICTORY_INFO[k], v = g.victory[k];
        if (!v.on) return `<h3 class="dim">${info.name} — switched off for this game</h3>`;
        const rows = alive.map((fid) => {
          const pr = prog[fid][k], F = ND.FDEF[fid];
          return `<div class="infl ${fid === p ? 'me' : ''}"><span style="color:${F.color}">${esc(F.name)}</span>${bar(Math.min(100, pr.pct * 100), F.color)}<b>${pr.value}/${pr.need}</b></div>`;
        }).join('');
        return `<h3>${info.name}</h3><p class="small">${esc(info.desc(v))}</p>${rows}`;
      }).join('');
      this.modal('Victory Conditions', `
        <p class="small dim">Any faction can win any enabled condition — if a rival gets there first, you lose. Conditions are checked at the end of every turn. Difficulty: <b>${ND.DIFFICULTY[g.difficulty].label}</b> (${esc(ND.DIFFICULTY[g.difficulty].desc)})</p>
        ${sections}
        <h3>Defeat</h3>
        <p class="small">You lose if you control no districts, or if any rival meets an enabled victory condition. Losing your HQ relocates it to your strongest district and lets the captor loot 30% of your credits.</p>`, true);
    },

    // Pending pact offers to the player, with answer buttons (shown in the briefing and on the Diplomacy screen).
    offersHtml() {
      const g = this.g, offers = g.proposals.filter((x) => x.to === g.player);
      if (!offers.length) return '';
      return `<h3>Pact offers <span class="dim small">(answer this turn)</span></h3>${offers.map((o) => `<div class="offer">
        <span><b style="color:${ND.FDEF[o.from].color}">${esc(ND.FDEF[o.from].name)}</b> offers a ${ND.Diplo.PACT_TURNS}-turn non-aggression pact. <span class="dim small">Relations ${sgn(ND.Diplo.rel(g, g.player, o.from))}</span></span>
        <span><button class="btn xs primary" data-cmd="answer" data-arg="${o.from}" data-arg2="yes">Accept</button> <button class="btn xs" data-cmd="answer" data-arg="${o.from}" data-arg2="no">Decline</button></span></div>`).join('')}`;
    },

    screenDiplomacy() {
      const g = this.g, p = g.player, D = ND.Diplo;
      const stanceTag = { pact: '<span class="tag">PACT</span>', friendly: '<span class="pos">Friendly</span>', neutral: '<span class="dim">Neutral</span>', hostile: '<span class="neg">Hostile</span>' };
      const rows = g.order.filter((fid) => fid !== p).map((fid) => {
        const F = ND.FDEF[fid], f = g.factions[fid];
        if (!f.alive) return `<tr class="dead"><td><i class="sw" style="background:${F.color}"></i> ${esc(F.name)}</td><td colspan="3" class="dim">Eliminated</td></tr>`;
        const r = D.rel(g, p, fid), st = D.stance(g, p, fid), can = D.canPropose(g, p, fid);
        const relBar = `<span class="relbar"><i style="left:${50 + Math.min(0, r) / 2}%;width:${Math.abs(r) / 2}%;background:${r < 0 ? '#e0384a' : '#8cff3a'}"></i></span>`;
        return `<tr><td><i class="sw" style="background:${F.color}"></i> <b>${esc(F.name)}</b><div class="small dim">${esc(F.aiStrategy)}</div></td>
          <td>${relBar} ${sgn(r)}</td>
          <td>${stanceTag[st]}${st === 'pact' ? ` <span class="small dim">until turn ${D.pactUntil(g, p, fid)}</span>` : ''}</td>
          <td>${st === 'pact'
            ? `<button class="btn xs danger" data-cmd="breakpact" data-arg="${fid}">Break pact</button>`
            : `<button class="btn xs" data-cmd="propose" data-arg="${fid}" ${can.ok ? '' : 'disabled'} title="${can.ok ? '' : esc(can.reason)}">Propose pact</button>${can.ok ? '' : ` <span class="small dim">${esc(can.reason)}</span>`}`}</td></tr>`;
      }).join('');
      this.modal('Diplomacy', `
        ${this.offersHtml()}
        <table class="slots diplo"><tr><th>Faction</th><th>Relations</th><th>Status</th><th></th></tr>${rows}</table>
        <h3>How it works</h3>
        <p class="small">A <b>non-aggression pact</b> lasts ${D.PACT_TURNS} turns. While it holds, neither side can campaign, bribe, canvass, seize or sabotage in the other's districts, attack its units, or run covert operations against it — and guards ignore the partner's units. Relations (−100…+100) fall with battles (−8), raids (−5), captured districts (−6), exposed covert operations (−15) — at most −6 per pair per turn — and recover by 3 per turn; pacts warm them. Rivals accept when relations are good, when you are stronger than them, or when they already have too many enemies; aggressive factions are hard to deal with. <b>Breaking</b> a pact costs −50 relations with the partner and −10 with everyone else.</p>`, true);
    },

    screenSettings() {
      const g = this.g;
      const row = (slot) => {
        const m = ND.Save.meta(slot);
        const info = m ? `Turn ${m.turn} · ${esc(ND.FDEF[m.faction].name)} · ${new Date(m.date).toLocaleString()}${m.over ? ' · finished' : ''}` : '<span class="dim">empty</span>';
        return `<tr><td><b>${slot === 'auto' ? 'Autosave' : 'Slot ' + slot}</b></td><td>${info}</td>
          <td>${slot === 'auto' ? '' : `<button class="btn sm" data-cmd="save" data-arg="${slot}">Save</button>`}
          <button class="btn sm" data-cmd="load" data-arg="${slot}" ${m ? '' : 'disabled'}>Load</button>
          <button class="btn sm danger" data-cmd="del" data-arg="${slot}" ${m ? '' : 'disabled'}>Delete</button></td></tr>`;
      };
      this.modal('Game Settings', `
        <h3>Save / Load</h3>
        <table class="slots">${ND.Save.slots.map(row).join('')}</table>
        <h3>Options</h3>
        <label class="check"><input type="checkbox" id="opt-autosave" ${g.settings.autosave ? 'checked' : ''} data-cmd="autosave"> Autosave at the end of every turn</label>
        <p class="small dim">Game seed: ${g.seed}. Saves are stored in this browser's local storage.</p>
        <h3>Session</h3>
        <button class="btn danger" data-cmd="quit">Quit to main menu</button>`);
    },

    screenHelp() {
      const R = ND.RULES;
      this.modal('Field Manual', `
        <div class="tut-banner"><span><b>งงใช่ไหม?</b> ลองบทเรียนแบบลงมือทำทีละขั้น (ภาษาไทย) — จะเริ่มเป็นเกมใหม่ เกมนี้ยังกลับมาเล่นต่อได้จากเซฟ</span><button class="btn primary" data-cmd="tutorial">📘 เริ่มบทเรียน</button></div>
        <div class="cols">
        <div>
          <h3>Goal</h3>
          <p>Build your empire until you meet one of this game's enabled victory conditions:</p>
          <ul class="small">${Object.keys(ND.VICTORY_INFO).filter((k) => this.g.victory[k].on).map((k) => `<li><b>${ND.VICTORY_INFO[k].name}</b> — ${esc(ND.VICTORY_INFO[k].desc(this.g.victory[k]))}</li>`).join('')}</ul>
          <p class="small">Rivals can win the same ways. Track everyone's progress on the <b>Victory</b> screen.</p>
          <h3>Influence ≠ ownership</h3>
          <p>Every district holds influence shares for each faction plus an unaligned remainder. A faction <b>seizes control</b> at end of turn when it has ≥${R.captureMin}% <i>and</i> leads the runner-up by ≥${R.captureMargin} points. An owner keeps control while it stays at ≥${R.holdMin}%.</p>
          <p>Holding ≥${R.skimMin}% in a district you don't control lets you <b>skim</b> ${R.skimRate * 100}% of its credit yield.</p>
          <h3>Reach</h3>
          <p>You can only operate in districts you control or that <b>border</b> one (dashed outline on the map).</p>
          <h3>Operations</h3>
          <p>Each command costs 1 operation point plus resources. You get ${R.baseOps} OPS, +1 per ${R.opsPerDistricts} districts (max ${R.maxOps}).</p>
          <ul class="small">${ND.Actions.keys.map((k) => `<li><b>${ND.Actions.defs[k].hotkey} · ${ND.Actions.defs[k].label}</b> — ${esc(ND.Actions.defs[k].desc)}</li>`).join('')}</ul>
          <h3>Units</h3>
          <p class="small">Recruit personnel (<b>Recruit</b> screen) — they report to your HQ and cost maintenance every turn. Units don't use OPS: each gets one <b>move</b> per turn (anywhere through your connected territory plus one step beyond) and one <b>standing order</b>, resolved at turn end:</p>
          <ul class="small">
            <li><b>Canvass</b> — gain influence (INF-driven; reduced by security and the owner's guards). High security may injure the unit.</li>
            <li><b>Guard</b> — in your districts: weakens rival campaigns/canvassing and adds to crackdowns on outsiders.</li>
            <li><b>Seize facility</b> — needs 25% influence; success by ATK+INF vs security and guards. Held facilities yield income and +1% influence/turn.</li>
            <li><b>Sabotage facility</b> — knock a rival off a facility. Failure risks injury or death.</li>
            <li><b>Attack</b> — fight a rival faction's units in the same district (all of its healthy units there defend). With no defenders present, it raids the owner's influence instead.</li>
            <li><b>Gather Intel</b> · <b>Train</b> (+30 XP) · <b>Establish HQ</b> (150 CR) · <b>Rest</b>.</li>
          </ul>
          <h3>Research</h3>
          <p class="small">Open the tree from the <b>R&amp;D</b> pill in the top bar. Three branches (Military, Biological, Information) plus one signature technology for your faction. One project at a time: pay the cost up front, then it completes after enough research points (2/turn base, more from research districts and facilities). Every technology has a concrete rule effect listed on its card.</p>
          <h3>Covert operations</h3>
          <p class="small">The <b>Covert Ops</b> tab under the map lists Spy, Manipulate Public Opinion, Disrupt Income, Sabotage Factory, Steal Technology, Plague Release (needs Biological Warfare) and Assassinate Leader. They cost OPS, intel and sometimes credits, and need eyes on the target (Spy works up to 3 districts out). Success chance is shown with its breakdown: base, minus security, +10 per Agent/Hacker/Assassin within 1 district, plus tech bonuses, minus target defences. Failures alert the district (+10 security) and expose you; on risky ops nearby operatives may be wounded or executed.</p>
          <h3>Combat</h3>
          <p class="small">Battles resolve automatically in step 6, before other orders: first all Attack orders, then <b>interceptions</b> — guards in their own district engage enemy units that canvass, seize or sabotage there. Up to ${ND.Combat.ROUNDS} rounds; each unit fires at a random enemy. Hit chance 55% ±5% per point of ATK vs target DEF (10–92%); damage grows with ATK and is reduced by DEF. HP = 10 + DEF + 2×level (+5 Heavy).</p>
          <p class="small">Defenders in a district they control gain DEF: +1 per 20 security, +1 per development level above 1, +2 at an HQ, and +2 for units on Guard. Each side also rolls morale (−2…+2 ATK). Faction doctrines and equipment count. Ties go to the defender.</p>
          <p class="small">Fallen units are killed (35%) or wounded for 2–4 turns; badly hurt survivors rest 1 turn. Winning attackers cut the owner's influence; losing attackers are repelled and their orders that turn are cancelled. Every battle produces a full report (<b>Battles</b> screen).</p>
          <p class="small">Experience raises level (max 5, +1 all stats per level). Gear from the <b>Armory</b> fills weapon/armor/gear slots. Injured units rest; hospitals you hold a facility in speed healing.</p>
        </div>
        <div>
          <h3>Turn sequence</h3>
          <ol class="small">
            <li>Collect income from controlled districts (+ skim).</li>
            <li>Pay maintenance: ${R.upkeep.credits} CR and ${R.upkeep.energy} EN per district (HQ free). Unpaid upkeep causes unrest.</li>
            <li>Receive the intelligence briefing.</li>
            <li><b>You issue commands.</b></li>
            <li>Rival factions act (same rules, same costs).</li>
            <li>Conflicts resolve: battles (assaults, then guard interceptions), then unit orders, then security cracks down on outsiders (−1% per 25 security in owned districts, per 30 in unaligned ones; owner guards add more).</li>
            <li>Influence updates: owners regrow ${R.driftOwned}%/turn (HQ ${R.driftHQ}%), unreachable influence fades, security drifts to base; control changes.</li>
            <li>Standings update; factions with no districts are eliminated; relations drift and pacts expire; victory conditions are checked.</li>
            <li>Next turn begins.</li>
          </ol>
          <h3>Resources</h3>
          <p class="small"><span class="c-credits">Credits</span> pay for nearly everything. <span class="c-energy">Energy</span> powers your territory — grab power plants as you grow. <span class="c-materials">Materials</span> build fortifications and development. <span class="c-intel">Intel</span> pays for bribes, covert operations and campaigns against high-security districts (≥50). Surpluses can be sold (and shortages bought) on the <b>black market</b> under the treasury forecast; each Black Market district you control improves the rates by 5% (max 25%).</p>
          <h3>Diplomacy</h3>
          <p class="small">Non-aggression pacts with rival factions forbid hostile actions both ways for ${ND.Diplo.PACT_TURNS} turns. Propose, accept offers or break pacts on the <b>Diplomacy</b> screen. See it for how relations move.</p>
          <h3>Controls</h3>
          <p class="small">Click a district to inspect it · arrow keys move the selection · 1–5 run operations · <b>E</b> ends the turn · <b>Esc</b> closes windows.</p>
        </div></div>
        <div class="modal-foot"><button class="btn primary" data-cmd="close">Understood</button></div>`, true);
    },

    showGameOver() {
      const g = this.g, o = g.over;
      const st = ND.Turn.standings(g);
      const rows = st.map((s) => {
        const f = g.factions[s.fid], F = ND.FDEF[s.fid];
        return `<tr class="${s.fid === g.player ? 'me' : ''} ${s.alive ? '' : 'dead'}"><td><i class="sw" style="background:${F.color}"></i> ${esc(F.name)}</td>
          <td>${s.alive ? s.districts : '—'}</td><td>${s.units}</td><td>${f.tech.done.length}</td><td>${f.captured}/${f.lost}</td>
          <td>${f.battlesWon || 0}/${f.battlesLost || 0}</td><td>${f.res.credits}</td><td><b>${s.score}</b></td></tr>`;
      }).join('');
      this.modal(o.result === 'victory' ? 'VICTORY' : 'DEFEAT', `
        <div class="gameover ${o.result}">
          <div class="go-type">${esc(o.type)}</div>
          <p>${esc(o.text)}</p>
          <p class="dim">Turn ${o.turn} · ${esc(ND.FDEF[g.player].name)} · ${ND.DIFFICULTY[g.difficulty].label} · seed ${g.seed}</p>
        </div>
        <table class="slots final"><tr><th>Faction</th><th>Districts</th><th>Units</th><th>Techs</th><th>Seized/Lost</th><th>Battles W/L</th><th>Credits</th><th>Score</th></tr>${rows}</table>
        <div class="modal-foot"><button class="btn" data-cmd="close">View map</button> <button class="btn primary" data-cmd="quit">Main menu</button></div>`, true);
    },

    cmd(c, arg, arg2) {
      const g = this.g;
      if (c === 'sell' || c === 'buy-res') {
        const r = c === 'sell' ? ND.Market.sell(g, g.player, arg) : ND.Market.buy(g, g.player, arg);
        this.toast(r.ok ? r.msg : r.reason, r.ok ? 'ok' : 'err');
        this.renderTop(); this.renderLeft(); this.renderActions();
        return;
      }
      if (c === 'propose') {
        const r = ND.Diplo.propose(g, g.player, arg);
        this.toast(!r.ok ? r.reason : r.accepted ? `${ND.FDEF[arg].name} accepted the pact.` : `${ND.FDEF[arg].name} refused.`, r.ok && r.accepted ? 'ok' : 'err');
        this.renderAll(); this.screenDiplomacy();
        return;
      }
      if (c === 'breakpact') {
        const r = ND.Diplo.breakPact(g, g.player, arg);
        this.toast(r.ok ? `You broke the pact with ${ND.FDEF[arg].name}.` : r.reason, r.ok ? 'ok' : 'err');
        this.renderAll(); this.screenDiplomacy();
        return;
      }
      if (c === 'answer') {
        const r = ND.Diplo.answer(g, arg, arg2 === 'yes');
        this.toast(!r.ok ? r.reason : arg2 === 'yes' ? `Pact signed with ${ND.FDEF[arg].name}.` : `You declined ${ND.FDEF[arg].name}'s offer.`, r.ok ? 'ok' : 'err');
        const fromBriefing = $('#modal-title').textContent.startsWith('Intelligence Briefing');
        this.renderAll();
        if (fromBriefing) this.showReport(g.lastReport); else this.screenDiplomacy();
        return;
      }
      if (c === 'tutorial') {
        // Keep the current game recoverable before switching to the tutorial.
        if (!g.tutorial || g.tutorial.done) ND.Save.save(g, 'auto');
        this.closeModal();
        ND.Tutorial.startGame();
        return;
      }
      if (c === 'order') { this.setOrder(Number(arg), arg2); return; }
      if (c === 'utoggle') {
        const id = Number(arg), u = g.units[id];
        if (!u) return;
        const inRoster = !$('#modal').classList.contains('hidden');
        if (this.isOpen(u, !inRoster)) { this.openUnit = null; this.closedUnit = id; }
        else { this.openUnit = id; this.closedUnit = null; }
        this.refreshUnitViews(id);
        return;
      }
      if (c === 'unit') this.screenUnit(Number(arg));
      else if (c === 'battle') this.screenBattle(arg);
      else if (c === 'acttab') { this.actTab = arg; this.renderActions(); }
      else if (c === 'covert') {
        const d = g.districts[this.sel];
        const r = ND.Espionage.exec(g, g.player, arg, d);
        if (!r.ok) this.toast(r.reason, 'err');
        else this.toast(r.success ? `Success (${r.pct}%): you ${r.msg}.` : `Failed (${r.pct}%): ${r.msg}. The target is on alert.`, r.success ? 'ok' : 'err');
        this.renderAll();
      }
      else if (c === 'research') {
        const r = ND.Tech.start(g, g.player, arg);
        this.toast(r.ok ? `Research started: ${ND.TECHS[arg].name}.` : r.reason, r.ok ? 'ok' : 'err');
        this.renderTop(); this.renderLeft(); this.screenResearch();
      }
      else if (c === 'research-cancel') {
        const r = ND.Tech.cancel(g, g.player);
        this.toast(r.ok ? 'Project cancelled; half the cost refunded.' : r.reason, r.ok ? 'ok' : 'err');
        this.renderTop(); this.renderLeft(); this.screenResearch();
      }
      else if (c === 'move') {
        const u = g.units[arg];
        if (!u) return;
        if (u.injured || u.moved) { this.toast(u.injured ? 'Injured units cannot move.' : 'Already moved this turn.', 'err'); return; }
        this.closeModal();
        this.moving = u.id;
        this.sel = u.loc;
        this.renderRight();
        this.renderActions();
        this.drawMap();
      }
      else if (c === 'recruit') {
        const r = ND.Units.recruit(g, g.player, Number(arg));
        this.toast(r.ok ? `${r.unit.name} joined at your HQ.` : r.reason, r.ok ? 'ok' : 'err');
        this.renderAll();
        this.screenRecruit();
      }
      else if (c === 'buy') {
        const r = ND.Units.buy(g, g.player, arg);
        this.toast(r.ok ? `${ND.ITEMS[arg].label} added to the armory.` : r.reason, r.ok ? 'ok' : 'err');
        this.renderAll();
        this.screenArmory();
      }
      else if (c === 'dismiss') {
        const u = g.units[arg];
        if (!u) return;
        this.modal('Dismiss unit?', `<p>Discharge <b>${esc(u.name)}</b> (${esc(ND.UNIT_TYPES[u.type].label)}, level ${u.level})? This cannot be undone. Equipment returns to the armory.</p>
          <div class="modal-foot"><button class="btn" data-cmd="unit" data-arg="${u.id}">Cancel</button> <button class="btn danger" data-cmd="dismiss-yes" data-arg="${u.id}">Dismiss</button></div>`);
      }
      else if (c === 'dismiss-yes') {
        const u = g.units[arg];
        if (u) { ND.Units.dismiss(g, u); this.toast(`${u.name} dismissed.`, 'ok'); }
        this.renderAll();
        this.screenUnits();
      }
      else if (c === 'close') this.closeModal();
      else if (c === 'end') this.endTurn();
      else if (c === 'goto') { this.closeModal(); this.select(Number(arg)); }
      else if (c === 'save') { this.toast(ND.Save.save(g, arg) ? `Saved to slot ${arg}.` : 'Save failed (storage unavailable).', 'ok'); this.screenSettings(); }
      else if (c === 'load') {
        const s = ND.Save.load(arg);
        if (s) { this.toast(`Loaded ${arg === 'auto' ? 'autosave' : 'slot ' + arg} (turn ${s.turn}).`, 'ok'); this.start(s); }
        else this.toast('That save could not be read.', 'err');
      }
      else if (c === 'del') { ND.Save.remove(arg); this.screenSettings(); }
      else if (c === 'autosave') { g.settings.autosave = $('#opt-autosave').checked; }
      else if (c === 'quit') { this.closeModal(); $('#game').classList.add('hidden'); ND.Main.showStart(); }
    },

    key(e) {
      if (!this.g || $('#game').classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        if (this.moving != null) { this.moving = null; this.drawMap(); }
        this.closeModal();
        return;
      }
      if (!$('#modal').classList.contains('hidden')) return;
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
