// Full-screen secondary screens (V3). One screen = one purpose; every screen fits the viewport.
// Large collections are paginated by measuring the space actually available (never by page scrolling).
// Screens only read game state and call the same core APIs / UI commands as before.
(function (ND) {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sgn = (n) => (n > 0 ? '+' + n : String(n));
  const costHtml = (c) => {
    const parts = ND.RES.filter((r) => c[r]).map((r) => `<span class="c-${r}">${c[r]}&nbsp;${ND.RES_SHORT[r]}</span>`);
    return parts.length ? parts.join(' ') : '<span class="dim">free</span>';
  };
  const bar = (v, color) => `<span class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></span>`;
  const sector = (d) => ND.World.sector(d);
  const fname = (fid) => ND.FDEF[fid].name;
  const UI = () => ND.UI;

  const NAV = [
    ['report', 'briefing', 'Briefing'], ['units', 'units', 'Units'], ['recruit', 'recruit', 'Recruit'], ['armory', 'armory', 'Armory'],
    ['research', 'research', 'Research'], ['battles', 'battles', 'Battles'], ['diplomacy', 'diplomacy', 'Diplomacy'],
    ['factions', 'factions', 'Factions'], ['intel', 'intelnav', 'Intel'], ['victory', 'victory', 'Objectives'],
    ['help', 'manual', 'Manual'], ['settings', 'settings', 'Settings'],
  ];
  const tabs = (key, list, cur) => `<div class="scr-tabs">${list.map(([k, label, n]) => `<button class="scr-tab ${k === cur ? 'on' : ''}" data-cmd="scr" data-arg="tab" data-arg2="${k}">${label}${n != null ? ` <span class="cnt">${n}</span>` : ''}</button>`).join('')}</div>`;
  const pager = (id) => `<div class="pager" id="${id}"></div>`;
  const EV_ICON = { op: 'campaign', control: 'factions', conflict: 'warn', alert: 'warn', econ: 'credits', unit: 'units', battle: 'battles', tech: 'research', spy: 'spy', diplo: 'diplomacy' };
  const EV_LABEL = { op: 'Operation', control: 'Territory', conflict: 'Conflict', alert: 'Alert', econ: 'Economy', unit: 'Units', battle: 'Battle', tech: 'Research', spy: 'Covert', diplo: 'Diplomacy' };
  const eventCard = (g, e, turn) => {
    const col = e.who ? ND.FDEF[e.who].color : 'var(--accent)';
    return `<div class="ev-card ev-${e.cat}" style="--fc:${col}">
      <div class="ev-top">${ND.icon(EV_ICON[e.cat] || 'help')}<span>${EV_LABEL[e.cat] || e.cat}</span>${turn != null ? `<span class="ev-turn">T${turn}</span>` : ''}</div>
      <div class="ev-text" title="${esc(e.text)}">${esc(e.text)}</div>
      <div class="ev-act">${e.battle && g.battles.some((b) => b.id === e.battle) ? `<button class="btn xs" data-cmd="battle" data-arg="${e.battle}">Report</button>` : ''}${e.d != null ? `<button class="btn xs" data-cmd="goto" data-arg="${e.d}">${ND.icon('move')}${sector(g.districts[e.d])}</button>` : ''}</div>
    </div>`;
  };

  // Flavour lines for recruits (presentation only).
  const PERSONA = {
    merc: ['Works for whoever pays on time.', 'Has a story for every scar.', 'Never asks why. Always asks how much.'],
    cyber: ['More chrome than flesh, and proud of it.', 'Recalibrates when nervous.', 'Remembers every face through a lens.'],
    mutant: ['Smells faintly of the vats.', 'Heals faster than it holds a grudge.', 'Loud, loyal, and slightly glowing.'],
    hacker: ['Sleeps in four-minute shifts.', 'Has read your messages. Twice.', 'Talks to firewalls like old friends.'],
    assassin: ['Was never here.', 'Speaks rarely. Misses never.', 'Collects coins from every job.'],
    engineer: ['Can wire a turret out of a toaster.', 'Measures twice, welds once.', 'Hums while building barricades.'],
    heavy: ['Doors are suggestions.', 'Moves like a rumour of thunder.', 'Polishes the armour every night.'],
    agent: ['Knows a guy who knows a guy.', 'Smiles like a closed deal.', 'Never forgets a favour owed.'],
  };
  const persona = (c) => { const r = ND.rosterOf(c.name); if (r) return `“${r.quote}”`; const L = PERSONA[c.type]; return L[ND.hashStr(c.name) % L.length]; };
  const ITEM_CAT = { pistol: 'weapons', smg: 'weapons', rifle: 'weapons', plasma: 'weapons', rail: 'weapons', vest: 'armor', plate: 'armor', exo: 'armor', deck: 'cyber', comms: 'cyber', medkit: 'special', cloak: 'special' };
  const ITEM_ICON = { weapons: 'assassinate', armor: 'armory', cyber: 'intel', special: 'star' };
  const TECH_ICON = { military: 'battles', bio: 'plague', info: 'intel', faction: 'star', ultimate: 'crown' };
  const BRANCH_COL = { military: '#f06b75', bio: '#8bd46a', info: '#42d5e8', faction: '#f2c15c', ultimate: '#a98af0' };

  const S = (ND.Screens = {
    cur: null,
    state: {},
    st(name) { return (this.state[name] = this.state[name] || { tab: null, page: 0, sel: null }); },
    isOpen() { return !!this.cur; },

    open(name, opts = {}) {
      const def = SCREENS[name], g = UI().g;
      if (!def || !g) return;
      const st = this.st(name);
      Object.assign(st, opts);
      this.cur = name;
      $('#tooltip').classList.add('hidden');
      $('#screen').classList.remove('hidden');
      $('#screen').dataset.screen = name;
      $('#screen-title').innerHTML = `${ND.icon(def.icon)}<span>${esc(def.title)}</span>`;
      $('#screen-nav').innerHTML = NAV.map(([k, ic, label]) => `<button class="nav-b ${k === name ? 'on' : ''}" data-screen="${k}" title="${label}">${ND.icon(ic)}<span>${label}</span></button>`).join('');
      const body = $('#screen-body');
      body.className = `scr-body scr-${name}`;
      body.innerHTML = def.render(g, st);
      if (def.after) def.after(g, st);
      this.paint(body);
    },
    refresh() { if (this.cur) this.open(this.cur); },
    close() { $('#screen').classList.add('hidden'); this.cur = null; },
    set(key, val) {
      const st = this.st(this.cur);
      if (key === 'tab') { st.tab = val; st.page = 0; }
      else if (key === 'page') st.page = Number(val);
      else if (key === 'sel') st.sel = val;
      else if (key === 'sub') st.sub = val;
      this.refresh();
    },

    // Fill a grid with as many cards as fit; paginate the rest.
    fill(gridSel, pagerSel, items, minW, cardH, renderItem, st, gap = 12) {
      const el = $(gridSel), pg = $(pagerSel);
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      const cols = Math.max(1, Math.floor((w + gap) / (minW + gap)));
      const rows = Math.max(1, Math.floor((h + gap) / (cardH + gap)));
      const per = cols * rows, pages = Math.max(1, Math.ceil(items.length / per));
      st.page = Math.min(st.page || 0, pages - 1);
      el.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      el.style.gridAutoRows = `${cardH}px`;
      el.innerHTML = items.slice(st.page * per, st.page * per + per).map(renderItem).join('') || '<div class="empty">Nothing here yet.</div>';
      if (pg) pg.innerHTML = pages > 1 ? `<button class="btn sm" data-cmd="scr" data-arg="page" data-arg2="${st.page - 1}" ${st.page ? '' : 'disabled'}>‹ Prev</button><span>Page ${st.page + 1} / ${pages}</span><button class="btn sm" data-cmd="scr" data-arg="page" data-arg2="${st.page + 1}" ${st.page < pages - 1 ? '' : 'disabled'}>Next ›</button>` : (items.length ? `<span class="dim">${items.length} shown</span>` : '');
      this.paint(el);
    },

    // Draw every artwork canvas inside root at its displayed size.
    paint(root) {
      const g = UI().g, dpr = window.devicePixelRatio || 1;
      root.querySelectorAll('canvas[data-fig], canvas[data-uport], canvas[data-hero]').forEach((cv) => {
        const w = cv.clientWidth, h = cv.clientHeight;
        if (!w || !h) return;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        if (cv.dataset.uport) { const u = g.units[cv.dataset.uport]; if (u) ND.drawUnitPortrait(cv, u); return; }
        if (cv.dataset.hero != null) { const d = g.districts[cv.dataset.hero]; ND.drawDistrictHero(cv, d, d.owner ? ND.FDEF[d.owner].color : '#8fa3ba'); return; }
        const [kind, a, b, c] = cv.dataset.fig.split('|');
        if (kind === 'leader') ND.drawPortrait(cv, a);
        else if (kind === 'cand') { const cd = g.factions[g.player].market[a]; if (cd) ND.drawFigure(cv, { seed: cd.name, fid: g.player, role: cd.type, accent: ND.UNIT_TYPES[cd.type].accent, skin: cd.skin, hair: cd.hair }); }
        else if (kind === 'fig') ND.drawFigure(cv, { seed: c, fid: a, role: b, accent: ND.UNIT_TYPES[b] ? ND.UNIT_TYPES[b].accent : null });
      });
    },
  });

  // ---------- screen definitions ----------
  const SCREENS = {};

  // BRIEFING: start-of-turn report, split into tabs.
  SCREENS.report = {
    title: 'Intelligence Briefing', icon: 'briefing',
    render(g, st) {
      const rep = g.lastReport;
      if (!rep) return '<div class="center-msg">No briefing yet — end your first turn.</div>';
      const offers = g.proposals.filter((x) => x.to === g.player);
      st.tab = st.tab || 'summary';
      const L = rep.ledger;
      let body = '';
      if (st.tab === 'summary') {
        body = `<div class="two-col">
          <section class="card">
            <h3>${ND.icon('credits')}Income collected · maintenance paid</h3>
            ${L ? `<table class="ledger big"><tr><th></th>${ND.RES.map((r) => `<th class="c-${r}">${ND.RES_LABEL[r]}</th>`).join('')}</tr>
              <tr><td>Income</td>${ND.RES.map((r) => `<td>+${L.income[r]}</td>`).join('')}</tr>
              <tr><td>Districts</td>${ND.RES.map((r) => `<td class="neg">−${L.distUpkeep[r]}</td>`).join('')}</tr>
              <tr><td>Payroll</td>${ND.RES.map((r) => `<td class="neg">−${L.payroll[r]}</td>`).join('')}</tr>
              <tr class="net"><td>Net</td>${ND.RES.map((r) => `<td class="${L.net[r] < 0 ? 'neg' : 'pos'}">${sgn(L.net[r])}</td>`).join('')}</tr>
              <tr><td>In stock</td>${ND.RES.map((r) => `<td><b>${rep.stock[r]}</b></td>`).join('')}</tr></table>` : ''}
            ${rep.unrest ? `<div class="d-status st-danger">${ND.icon('warn')}<span>Unpaid upkeep (${rep.unrest.map((r) => ND.RES_LABEL[r]).join(', ')}) caused unrest.</span></div>` : ''}
            <div class="sum-chips">
              <button class="sum-chip" data-cmd="scr" data-arg="tab" data-arg2="events">${ND.icon('intelnav')}<b>${rep.events.length}</b> events seen</button>
              <button class="sum-chip" data-cmd="scr" data-arg="tab" data-arg2="battles">${ND.icon('battles')}<b>${(rep.battles || []).length}</b> battles</button>
              ${offers.length ? `<button class="sum-chip hot" data-cmd="scr" data-arg="tab" data-arg2="offers">${ND.icon('diplomacy')}<b>${offers.length}</b> pact offer${offers.length > 1 ? 's' : ''}</button>` : ''}
            </div>
          </section>
          <section class="card">
            <h3>${ND.icon('star')}Standings</h3>
            ${rep.standings.map((s, i) => `<div class="rank-row ${s.fid === g.player ? 'me' : ''} ${s.alive ? '' : 'dead'}">
              <span class="rk">${i + 1}</span>${ND.emblemSvg(s.fid)}<span class="nm">${esc(fname(s.fid))}</span>
              <span class="dim">${s.alive ? s.districts + ' districts' : 'eliminated'}</span><b>${s.score}</b></div>`).join('')}
          </section></div>`;
      } else if (st.tab === 'offers') {
        body = `<div class="card offers-card">${UI().offersHtml() || '<div class="center-msg">No offers on the table.</div>'}</div>`;
      } else body = `<div class="grid-fill" id="g-ev"></div>${pager('p-ev')}`;
      return `${tabs('report', [['summary', 'Summary'], ['events', 'Events', rep.events.length], ['battles', 'Battles', (rep.battles || []).length], ['offers', 'Offers', offers.length]], st.tab)}
        <div class="scr-main">${body}</div>
        <div class="scr-foot"><button class="btn primary big" data-cmd="close">Issue commands ›</button></div>`;
    },
    after(g, st) {
      const rep = g.lastReport;
      if (!rep) return;
      if (st.tab === 'events') {
        const order = { control: 0, alert: 1, battle: 2, conflict: 3, spy: 4, tech: 5, diplo: 6, unit: 7, op: 8 };
        const ev = rep.events.slice().sort((a, b) => (order[a.cat] ?? 9) - (order[b.cat] ?? 9));
        S.fill('#g-ev', '#p-ev', ev, 300, 128, (e) => eventCard(g, e), st);
      } else if (st.tab === 'battles') {
        const list = g.battles.filter((b) => (rep.battles || []).includes(b.id));
        S.fill('#g-ev', '#p-ev', list, 320, 96, (b) => battleCard(g, b, false), st);
      }
    },
  };

  // UNITS: roster grid with filters + detail of the selected unit.
  SCREENS.units = {
    title: 'Unit Management', icon: 'units',
    list(g, st) {
      const us = ND.Units.list(g, g.player);
      const f = st.tab || 'all';
      return us.filter((u) => f === 'all' || (f === 'idle' && !u.injured && u.task.kind === 'rest') || (f === 'assigned' && !u.injured && u.task.kind !== 'rest') || (f === 'injured' && u.injured));
    },
    render(g, st) {
      const us = ND.Units.list(g, g.player);
      st.tab = st.tab || 'all';
      if (st.sel != null && !g.units[st.sel]) st.sel = null;
      const L = ND.Econ.ledger(g, g.player);
      const sel = st.sel != null ? g.units[st.sel] : this.list(g, st)[0] || us[0];
      const cnt = (fn) => us.filter(fn).length;
      return `<div class="split">
        <div class="split-main">
          <div class="bar-row">${tabs('units', [['all', 'All', us.length], ['idle', 'Idle', cnt((u) => !u.injured && u.task.kind === 'rest')], ['assigned', 'On assignment', cnt((u) => !u.injured && u.task.kind !== 'rest')], ['injured', 'Injured', cnt((u) => u.injured)]], st.tab)}
            <span class="dim">${us.length}/${ND.Units.cap(g, g.player)} units · payroll ${costHtml(L.payroll)}/turn</span>
            <button class="btn sm" data-screen="recruit">${ND.icon('recruit')}Recruit</button></div>
          <div class="grid-fill" id="g-units"></div>${pager('p-units')}
        </div>
        <aside class="split-side">${sel ? UI().unitDetailHtml(sel, 'screen') : '<div class="center-msg">No units yet.<br><button class="btn primary" data-screen="recruit">Recruit personnel</button></div>'}</aside>
      </div>`;
    },
    after(g, st) {
      const list = this.list(g, st);
      const selId = st.sel != null ? Number(st.sel) : list[0] && list[0].id;
      S.fill('#g-units', '#p-units', list, 300, 132, (u) => UI().unitCardHtml(u, u.id === selId), st);
    },
  };

  // RECRUIT: candidate cards + large preview.
  SCREENS.recruit = {
    title: 'Recruitment', icon: 'recruit',
    render(g, st) {
      const f = g.factions[g.player], sig = ND.SIGNATURE[g.player];
      const i = Math.min(st.sel != null ? Number(st.sel) : 0, Math.max(0, f.market.length - 1));
      const c = f.market[i];
      let side = '<div class="center-msg">Nobody left to hire this turn.<br><span class="dim">New candidates arrive every turn.</span></div>';
      if (c) {
        const T = ND.UNIT_TYPES[c.type], chk = ND.Units.canRecruit(g, g.player, i), nm = ND.splitName(c.name);
        side = `<div class="detail">
          <div class="art-tall"><canvas data-fig="cand|${i}"></canvas>${c.type === sig ? '<span class="ribbon">Signature</span>' : ''}</div>
          <div class="dt-name">${esc(nm.first)} <span class="nick">“${esc(nm.nick)}”</span> ${esc(nm.last)}</div>
          <div class="dt-sub">${esc(T.label)} · <i>${esc(persona(c))}</i></div>
          ${ND.rosterOf(c.name) ? `<div class="dt-bio" title="${esc(ND.rosterOf(c.name).bio)}">${esc(ND.rosterOf(c.name).bio)}</div>` : ''}
          <div class="stat-row big">${['atk', 'def', 'inf', 'int'].map((k) => `<div class="stat-b"><span>${ND.STAT_LABEL[k]}</span><b>${c.base[k]}</b></div>`).join('')}</div>
          <div class="trait good">${ND.icon('star')}<div><b>Special</b>${esc(T.special)}</div></div>
          <div class="kv"><span>Hire cost</span><b>${costHtml(chk.cost)}</b></div>
          <div class="kv"><span>Upkeep</span><b>${costHtml(T.upkeep)} / turn</b></div>
          <div class="kv"><span>Gear slots</span><b>${T.slots.join(' · ')}</b></div>
          <div class="dt-foot">${chk.ok ? '' : `<div class="d-status st-danger">${ND.icon('warn')}<span>${esc(chk.reason)}</span></div>`}
            <button class="btn primary big" data-cmd="recruit" data-arg="${i}" ${chk.ok ? '' : 'disabled'}>${ND.icon('recruit')}Recruit</button></div>
        </div>`;
      }
      return `<div class="split">
        <div class="split-main">
          <div class="bar-row"><span class="dim">Roster ${ND.Units.list(g, g.player).length}/${ND.Units.cap(g, g.player)} · recruits report to your HQ · signature unit: <b>${esc(ND.UNIT_TYPES[sig].label)}</b> (−25%, common)</span></div>
          <div class="grid-fill" id="g-rec"></div>${pager('p-rec')}
        </div>
        <aside class="split-side">${side}</aside></div>`;
    },
    after(g, st) {
      const f = g.factions[g.player], sel = st.sel != null ? Number(st.sel) : 0;
      const items = f.market.map((c, i) => ({ c, i }));
      S.fill('#g-rec', '#p-rec', items, 230, 250, ({ c, i }) => {
        const T = ND.UNIT_TYPES[c.type], chk = ND.Units.canRecruit(g, g.player, i), nm = ND.splitName(c.name);
        return `<button class="rec-card ${i === sel ? 'on' : ''} ${chk.ok ? '' : 'off'}" data-cmd="scr" data-arg="sel" data-arg2="${i}">
          <canvas data-fig="cand|${i}"></canvas>
          <span class="rc-name">${esc(nm.first)} “${esc(nm.nick)}”</span>
          <span class="rc-cls">${esc(T.label)}</span>
          <span class="rc-ab">${esc(T.special.split(' — ')[0])}</span>
          <span class="rc-cost">${costHtml(chk.cost)}</span>
        </button>`;
      }, st);
    },
  };

  // ARMORY: categories, item cards, large detail with compatibility and equip targets.
  SCREENS.armory = {
    title: 'Armory', icon: 'armory',
    render(g, st) {
      st.tab = st.tab || 'weapons';
      const f = g.factions[g.player];
      const items = Object.keys(ND.ITEMS).filter((k) => ITEM_CAT[k] === st.tab);
      const key = items.includes(st.sel) ? st.sel : items[0];
      const it = ND.ITEMS[key], chk = ND.Units.canBuy(g, g.player, key);
      const compat = Object.entries(ND.UNIT_TYPES).filter(([, T]) => T.slots.includes(it.slot)).map(([, T]) => T.label);
      const eligible = ND.Units.list(g, g.player).filter((u) => ND.UNIT_TYPES[u.type].slots.some((s, i) => s === it.slot && !u.equip[i]));
      const cats = [['weapons', 'Weapons'], ['armor', 'Armor'], ['cyber', 'Cybernetics'], ['special', 'Special equipment']];
      return `<div class="split">
        <div class="split-main">
          <div class="bar-row">${tabs('armory', cats.map(([k, l]) => [k, l, Object.keys(ND.ITEMS).filter((x) => ITEM_CAT[x] === k).length]), st.tab)}<span class="dim">Credits ${f.res.credits}</span></div>
          <div class="grid-fill" id="g-arm"></div>${pager('p-arm')}
        </div>
        <aside class="split-side"><div class="detail">
          <div class="item-art big">${ND.icon(ITEM_ICON[ITEM_CAT[key]])}</div>
          <div class="dt-name">${esc(it.label)}</div>
          <div class="dt-sub">${esc(it.slot)} slot${it.note ? ' · ' + esc(it.note) : ''}</div>
          <div class="stat-row big">${Object.entries(it.bonus).map(([b, v]) => `<div class="stat-b"><span>${ND.STAT_LABEL[b]}</span><b class="pos">+${v}</b></div>`).join('')}</div>
          <div class="kv"><span>Price</span><b>${costHtml(it.cost)}</b></div>
          <div class="kv"><span>In armory</span><b>${f.inventory[key] || 0}</b></div>
          <div class="kv"><span>Fits</span><b class="small">${esc(compat.join(', '))}</b></div>
          <div class="dt-foot">
            ${chk.ok ? '' : `<div class="d-status st-danger">${ND.icon('warn')}<span>${esc(chk.reason)}</span></div>`}
            <button class="btn primary" data-cmd="buy" data-arg="${key}" ${chk.ok ? '' : 'disabled'}>Buy</button>
            ${f.inventory[key] > 0 ? `<div class="eq-to"><span class="dim small">Equip to a unit with a free ${esc(it.slot)} slot:</span>
              ${eligible.slice(0, 4).map((u) => `<button class="btn xs" data-cmd="equipto" data-arg="${u.id}" data-arg2="${key}">${esc(ND.splitName(u.name).nick || u.name)}</button>`).join('')}
              ${eligible.length > 4 ? `<button class="btn xs" data-screen="units">+${eligible.length - 4} more…</button>` : ''}${eligible.length ? '' : '<span class="dim small">none</span>'}</div>` : ''}
          </div></div></aside></div>`;
    },
    after(g, st) {
      const f = g.factions[g.player];
      const items = Object.keys(ND.ITEMS).filter((k) => ITEM_CAT[k] === st.tab);
      const key = items.includes(st.sel) ? st.sel : items[0];
      S.fill('#g-arm', '#p-arm', items, 200, 170, (k) => {
        const it = ND.ITEMS[k], ok = ND.Units.canBuy(g, g.player, k).ok;
        return `<button class="item-card ${k === key ? 'on' : ''} ${ok ? '' : 'off'}" data-cmd="scr" data-arg="sel" data-arg2="${k}">
          <span class="item-art">${ND.icon(ITEM_ICON[ITEM_CAT[k]])}</span>
          <span class="rc-name">${esc(it.label)}</span>
          <span class="pos">${Object.entries(it.bonus).map(([b, v]) => `+${v} ${ND.STAT_LABEL[b]}`).join(' ')}</span>
          <span class="rc-cost">${costHtml(it.cost)}</span><span class="dim small">Owned: ${f.inventory[k] || 0}</span></button>`;
      }, st);
    },
  };

  // RESEARCH: graphical tree per branch with connectors; detail panel.
  const tier = (id) => { const t = ND.TECHS[id]; const same = t.req.filter((r) => ND.TECHS[r].branch === t.branch); return same.length ? 1 + Math.max(...same.map(tier)) : 0; };
  SCREENS.research = {
    title: 'Research', icon: 'research',
    render(g, st) {
      const p = g.player, f = g.factions[p], cur = f.tech.current;
      const ids = ND.Tech.listFor(p);
      const selId = ids.includes(st.sel) ? st.sel : (cur ? cur.id : ids.find((id) => ND.Tech.status(g, p, id) === 'available') || ids[0]);
      const t = ND.TECHS[selId], s = ND.Tech.status(g, p, selId), chk = ND.Tech.canStart(g, p, selId);
      const rp = ND.Tech.rpPerTurn(g, p);
      const prog = s === 'active' ? cur.progress : s === 'done' ? t.rp : 0;
      const node = (id) => {
        const T = ND.TECHS[id], ss = ND.Tech.status(g, p, id), pr = ss === 'active' ? cur.progress / T.rp : ss === 'done' ? 1 : 0;
        return `<button class="tech-node ${ss} ${id === selId ? 'on' : ''}" data-tech="${id}" data-cmd="scr" data-arg="sel" data-arg2="${id}" style="--bc:${BRANCH_COL[T.branch]};--pr:${pr}">
          <span class="tn-ico">${ND.icon(TECH_ICON[T.branch])}</span><span class="tn-name">${esc(T.name)}</span>
          <span class="tn-st">${{ done: 'Researched', active: `${cur ? cur.progress : 0}/${T.rp} RP`, available: `${T.rp} RP`, locked: 'Locked' }[ss]}</span></button>`;
      };
      const col = (b) => {
        const list = ids.filter((id) => ND.TECHS[id].branch === b);
        const rows = [0, 1, 2].map((tr) => `<div class="tree-row">${list.filter((id) => tier(id) === tr).map(node).join('')}</div>`).join('');
        return `<div class="tree-col"><h4 style="color:${BRANCH_COL[b]}">${ND.icon(TECH_ICON[b])}${ND.BRANCHES[b]}</h4>${rows}</div>`;
      };
      const sig = ids.find((id) => ND.TECHS[id].branch === 'faction');
      return `<div class="split">
        <div class="split-main tree-wrap" id="tree">
          <svg class="tree-lines" id="tree-lines"></svg>
          <div class="tree">${col('military')}${col('bio')}${col('info')}</div>
          <div class="tree-extra"><div class="tree-col small-col"><h4 style="color:${BRANCH_COL.faction}">${ND.icon('star')}Signature</h4>${node(sig)}</div>
            <div class="tree-col small-col"><h4 style="color:${BRANCH_COL.ultimate}">${ND.icon('crown')}Ultimate</h4>${node('singularity')}</div>
            <div class="rp-box"><b>${rp}</b> RP / turn<span class="dim small">2 base + research districts & facilities${ND.Tech.has(g, p, 'aiIntel') ? ' + AI Intelligence' : ''}</span>${cur ? `<span>Researching <b>${esc(ND.TECHS[cur.id].name)}</b></span>` : '<span class="warn">No active project</span>'}</div></div>
        </div>
        <aside class="split-side"><div class="detail">
          <div class="item-art big" style="--ic:${BRANCH_COL[t.branch]}">${ND.icon(TECH_ICON[t.branch])}</div>
          <div class="dt-name">${esc(t.name)}</div>
          <div class="dt-sub">${ND.BRANCHES[t.branch]} · ${t.rp} research points</div>
          <p class="dt-text">${esc(t.effect)}</p>
          ${t.req.length ? `<div class="kv"><span>Requires</span><b class="small">${t.req.map((r) => `<span class="${ND.Tech.has(g, p, r) ? 'pos' : 'neg'}">${esc(ND.TECHS[r].name)}</span>`).join(', ')}</b></div>` : ''}
          <div class="kv"><span>Cost</span><b>${costHtml(t.cost)}</b></div>
          <div class="kv"><span>Progress</span><b>${bar((prog / t.rp) * 100, BRANCH_COL[t.branch])} ${Math.min(prog, t.rp)}/${t.rp}</b></div>
          <div class="dt-foot">
            ${s === 'available' ? `${chk.ok ? '' : `<div class="d-status st-danger">${ND.icon('warn')}<span>${esc(chk.reason)}</span></div>`}<button class="btn primary big" data-cmd="research" data-arg="${selId}" ${chk.ok ? '' : 'disabled'}>Start research</button>` : ''}
            ${s === 'active' ? `<div class="d-status st-ok">${ND.icon('research')}<span>In progress — about ${Math.ceil((t.rp - cur.progress) / Math.max(1, rp))} turn(s) left</span></div><button class="btn danger" data-cmd="research-cancel">Cancel (50% refund)</button>` : ''}
            ${s === 'done' ? `<div class="d-status st-ok">${ND.icon('check')}<span>Researched</span></div>` : ''}
            ${s === 'locked' ? `<div class="d-status">${ND.icon('warn')}<span>Locked — research the requirements first</span></div>` : ''}
          </div></div></aside></div>`;
    },
    after() {
      const svg = $('#tree-lines'), wrap = $('#tree');
      if (!svg || !wrap) return;
      const wr = wrap.getBoundingClientRect();
      svg.setAttribute('width', wr.width); svg.setAttribute('height', wr.height);
      let lines = '';
      wrap.querySelectorAll('.tech-node').forEach((n) => {
        const t = ND.TECHS[n.dataset.tech];
        for (const r of t.req) {
          if (ND.TECHS[r].branch !== t.branch) continue;
          const a = wrap.querySelector(`.tech-node[data-tech="${r}"]`);
          if (!a) continue;
          const ra = a.getBoundingClientRect(), rb = n.getBoundingClientRect();
          const x1 = ra.left + ra.width / 2 - wr.left, y1 = ra.bottom - wr.top, x2 = rb.left + rb.width / 2 - wr.left, y2 = rb.top - wr.top;
          const done = a.classList.contains('done');
          lines += `<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}" stroke="${done ? BRANCH_COL[t.branch] : 'rgba(160,180,205,.3)'}" stroke-width="2" fill="none"/>`;
        }
      });
      svg.innerHTML = lines;
    },
  };

  // BATTLES: history list + illustrated report.
  function battleCard(g, b, on) {
    const d = g.districts[b.d], p = g.player;
    const mine = b.att.fid === p || b.def.fid === p, won = b.winner === p;
    const lost = (S) => S.units.filter((u) => u.fate === 'killed').length;
    return `<button class="battle-card ${on ? 'on' : ''}" data-cmd="battle" data-arg="${b.id}">
      <span class="bc-sides">${ND.emblemSvg(b.att.fid)}<span class="vs">vs</span>${ND.emblemSvg(b.def.fid)}</span>
      <span class="bc-main"><span class="rc-name">${esc(d.name)} <span class="dim small">T${b.turn}</span></span>
        <span class="small dim">${b.kind === 'interception' ? 'Interception' : 'Assault'} · ${b.att.units.length} vs ${b.def.units.length} · ${lost(b.att) + lost(b.def)} killed</span></span>
      <span class="bc-res ${mine ? (won ? 'won' : 'lost') : ''}">${mine ? (won ? 'Won' : 'Lost') : esc(ND.FDEF[b.winner].short) + ' won'}</span></button>`;
  }
  SCREENS.battles = {
    title: 'Battles', icon: 'battles',
    list(g) { return g.battles.filter((b) => ND.Combat.visibleTo(g, b, g.player)); },
    render(g, st) {
      const list = this.list(g);
      const b = list.find((x) => x.id === Number(st.sel)) || list[0];
      if (!b) return '<div class="center-msg">No battles observed yet.<br><span class="dim">Battles happen when units attack, or when guards intercept intruders.</span></div>';
      st.sub = st.sub || 'overview';
      const d = g.districts[b.d];
      const fate = { killed: ['KILLED', 'neg'], wounded: ['WOUNDED', 'warn'], hurt: ['HURT', 'warn'], fit: ['FIT', 'pos'] };
      const side = (S, role) => `<div class="bside" style="--fc:${ND.FDEF[S.fid].color}">
        <div class="bs-head">${ND.emblemSvg(S.fid)}<div><b>${esc(fname(S.fid))}</b><div class="dim small">${role}${S.bonus && S.bonus.total ? ` · +${S.bonus.total} DEF defending` : ''} · morale ${sgn(S.morale)}</div></div>${b.winner === S.fid ? '<span class="ribbon static">Victor</span>' : ''}</div>
        ${S.units.map((u) => `<div class="bu-row"><canvas data-fig="fig|${S.fid}|${u.type}|${esc(u.name)}"></canvas><div class="bu-main"><b>${esc(u.name)}</b><span class="dim small">${esc(ND.UNIT_TYPES[u.type].label)} Lv${u.level} · ATK ${u.atk} DEF ${u.def}</span>${bar((u.hp / u.maxHp) * 100, u.hp ? '#8bd46a' : '#f06b75')}</div><span class="fate ${fate[u.fate][1]}">${fate[u.fate][0]}</span></div>`).join('')}
      </div>`;
      let detail;
      if (st.sub === 'overview') {
        detail = `<div class="two-col">${side(b.att, 'Attacker')}${side(b.def, 'Defender')}</div>
          <div class="card aftermath"><h3>${ND.icon('star')}Aftermath</h3>${b.consequences.map((c) => `<p>${esc(c)}</p>`).join('')}</div>`;
      } else {
        const r = b.rounds && b.rounds[Number(st.sub.slice(1)) - 1];
        detail = r ? `<div class="card log-card">${r.map((l) => `<div class="log-line"><span style="color:${ND.FDEF[l.af].color}">${esc(l.a)}</span> → <span style="color:${ND.FDEF[l.tf].color}">${esc(l.t)}</span>: ${l.hit ? `hit for <b>${l.dmg}</b>${l.down ? ' <b class="neg">DOWN</b>' : ''}` : '<span class="dim">miss</span>'} <span class="dim small">(${l.pct}%)</span></div>`).join('')}</div>`
          : '<div class="center-msg">The detailed log of older battles is archived.</div>';
      }
      const rounds = (b.rounds || []).map((_, i) => [`r${i + 1}`, `Round ${i + 1}`]);
      return `<div class="split wide-side">
        <div class="split-main narrow"><div class="grid-fill" id="g-bat"></div>${pager('p-bat')}</div>
        <aside class="split-side">
          <div class="battle-hero"><canvas data-hero="${b.d}"></canvas><div class="bh-title"><span>${b.kind === 'interception' ? 'Interception' : 'Assault'} · Turn ${b.turn}</span><b>${esc(d.name)} <span class="dim">${sector(d)}</span></b><span style="color:${ND.FDEF[b.winner].color}">${esc(fname(b.winner))} won</span></div></div>
          ${tabs('battle', [['overview', 'Overview'], ...rounds], st.sub).replace(/data-arg="tab"/g, 'data-arg="sub"')}
          <div class="battle-detail">${detail}</div>
        </aside></div>`;
    },
    after(g, st) {
      const list = this.list(g);
      const b = list.find((x) => x.id === Number(st.sel)) || list[0];
      if (!b) return;
      S.fill('#g-bat', '#p-bat', list, 260, 84, (x) => battleCard(g, x, x.id === b.id), st, 8);
    },
  };

  // DIPLOMACY: rival portraits with relationship meters and actions.
  SCREENS.diplomacy = {
    title: 'Diplomacy', icon: 'diplomacy',
    render(g) {
      const p = g.player, D = ND.Diplo;
      const rivals = g.order.filter((x) => x !== p);
      const stance = { pact: ['Pact', 'pos'], friendly: ['Friendly', 'pos'], neutral: ['Neutral', 'dim'], hostile: ['Hostile', 'neg'] };
      return `${UI().offersHtml() ? `<div class="card offers-card">${UI().offersHtml()}</div>` : ''}
        <div class="dip-grid">${rivals.map((fid) => {
          const F = ND.FDEF[fid], f = g.factions[fid];
          if (!f.alive) return `<div class="dip-card dead" style="--fc:${F.color}"><canvas data-fig="leader|${fid}"></canvas><div class="dc-body"><b>${esc(F.name)}</b><span class="neg">Eliminated</span></div></div>`;
          const r = D.rel(g, p, fid), s = D.stance(g, p, fid), can = D.canPropose(g, p, fid);
          return `<div class="dip-card" style="--fc:${F.color}">
            <canvas data-fig="leader|${fid}"></canvas>
            <div class="dc-body">
              <div class="dc-name">${ND.emblemSvg(fid)}<b>${esc(F.name)}</b></div>
              <div class="dim small">${esc(F.leader)}</div>
              <span class="badge ${stance[s][1]}">${stance[s][0]}${s === 'pact' ? ` · until T${D.pactUntil(g, p, fid)}` : ''}</span>
              <div class="rel-meter"><span class="relbar"><i style="left:${50 + Math.min(0, r) / 2}%;width:${Math.abs(r) / 2}%;background:${r < 0 ? '#f06b75' : '#8bd46a'}"></i></span><b>${sgn(r)}</b></div>
              ${s === 'pact' ? `<button class="btn danger" data-cmd="breakpact" data-arg="${fid}">Break pact</button>`
                : `<button class="btn primary" data-cmd="propose" data-arg="${fid}" ${can.ok ? '' : 'disabled'} title="${can.ok ? 'Ask for a 12-turn non-aggression pact' : esc(can.reason)}">Propose pact</button>${can.ok ? '' : `<span class="dim small">${esc(can.reason)}</span>`}`}
              <button class="btn xs" data-cmd="profile" data-arg="${fid}">Profile</button>
            </div></div>`;
        }).join('')}</div>
        <div class="scr-foot"><button class="btn sm" data-cmd="diplohelp">${ND.icon('help')}How diplomacy works</button></div>`;
    },
  };

  // FACTIONS: visual overview + profile.
  SCREENS.factions = {
    title: 'Factions', icon: 'factions',
    render(g, st) {
      const p = g.player, stn = ND.Turn.standings(g);
      const sel = g.order.includes(st.sel) ? st.sel : p;
      const card = (fid) => {
        const F = ND.FDEF[fid], f = g.factions[fid], s = stn.find((x) => x.fid === fid);
        const seen = fid === p || ND.FDEF[p].mods.panopticon || g.factions[p].spiedFaction[fid] >= g.turn;
        const inc = ND.Econ.ledger(g, fid).income.credits;
        const mil = ND.Units.list(g, fid).reduce((a, u) => a + ND.Units.stats(u).atk + ND.Units.stats(u).def, 0);
        return `<button class="fac-card ${fid === sel ? 'on' : ''} ${f.alive ? '' : 'dead'}" style="--fc:${F.color}" data-cmd="scr" data-arg="sel" data-arg2="${fid}">
          <canvas data-fig="leader|${fid}"></canvas>
          <span class="fcd-name">${ND.emblemSvg(fid)}${esc(F.name)}${fid === p ? ' <span class="badge pos">You</span>' : ''}</span>
          <span class="fcd-id">${esc(F.motto)}</span>
          ${f.alive ? `<span class="fcd-stats"><span title="Districts controlled">${ND.icon('factions')}${s.districts}</span><span title="Total influence (full districts)">${ND.icon('influence')}${(s.influence / 100).toFixed(1)}</span>
            <span title="Credit income per turn${seen ? '' : ' (estimate)'}">${ND.icon('credits')}${seen ? inc : '~' + Math.round(inc / 10) * 10}</span><span title="Military strength: total ATK+DEF of ${s.units} units">${ND.icon('battles')}${mil}</span></span>` : '<span class="neg">Eliminated</span>'}
        </button>`;
      };
      const F = ND.FDEF[sel], f = g.factions[sel], s = stn.find((x) => x.fid === sel);
      const exact = sel === p || ND.FDEF[p].mods.panopticon || g.factions[p].spiedFaction[sel] >= g.turn;
      const sid = ND.Tech.listFor(sel).find((id) => ND.TECHS[id].faction === sel);
      const est = (v) => (v < 100 ? '<100' : '~' + Math.round(v / 100) * 100);
      return `<div class="split">
        <div class="split-main"><div class="fac-grid">${g.order.map(card).join('')}</div></div>
        <aside class="split-side"><div class="detail" style="--fc:${F.color}">
          <div class="art-tall short"><canvas data-fig="leader|${sel}"></canvas><span class="emblem-big">${ND.emblemSvg(sel)}</span></div>
          <div class="dt-name" style="color:${F.color}">${esc(F.name)}</div>
          <div class="dt-sub">${esc(F.leader)} · ${f.alive ? `${s.districts} districts · ${s.units} units` : 'eliminated'}</div>
          <p class="dt-text">${esc(F.identity)}</p>
          <div class="trait good">${ND.icon('check')}<div><b>Ability</b>${esc(F.ability)}</div></div>
          <div class="trait bad">${ND.icon('warn')}<div><b>Weakness</b>${esc(F.weakness)}</div></div>
          <div class="kv"><span>Combat doctrine</span><b class="small">${esc(F.military.split(' — ')[0])}</b></div>
          <div class="kv"><span>Signature tech</span><b class="small">${esc(ND.TECHS[sid].name)}${exact ? (f.tech.done.includes(sid) ? ' ✓' : '') : ''}</b></div>
          <div class="kv"><span>Treasury</span><b class="small">${ND.RES.map((r) => `<span class="c-${r}">${ND.RES_SHORT[r]} ${exact ? f.res[r] : est(f.res[r])}</span>`).join(' ')}</b></div>
          ${sel !== p ? `<div class="kv"><span>Relations</span><b>${sgn(ND.Diplo.rel(g, p, sel))} · ${ND.Diplo.stance(g, p, sel)}</b></div><div class="dt-foot"><button class="btn" data-screen="diplomacy">${ND.icon('diplomacy')}Diplomacy</button></div>` : ''}
        </div></aside></div>`;
    },
  };

  // INTEL: categorised event cards.
  SCREENS.intel = {
    title: 'Intelligence', icon: 'intelnav',
    cats(g) {
      const p = g.player, all = [];
      for (const t of [g.current, ...g.history]) for (const e of t.entries) if (e.seen) all.push({ e, turn: t.turn });
      const isMe = (e) => e.who === p;
      const threat = (e) => !isMe(e) && (e.public || e.cat === 'battle' || e.cat === 'conflict' || (e.cat === 'spy') || (e.cat === 'control' && e.d != null && g.districts[e.d].owner !== p && /from/.test(e.text) && e.text.includes(fname(p))));
      return {
        enemy: all.filter(({ e }) => !isMe(e) && ['op', 'unit', 'tech', 'diplo'].includes(e.cat)),
        districts: all.filter(({ e }) => e.cat === 'control'),
        espionage: all.filter(({ e }) => e.cat === 'spy'),
        economy: all.filter(({ e }) => e.cat === 'alert' || e.cat === 'econ' || (isMe(e) && e.cat === 'op')),
        threats: all.filter(({ e }) => threat(e)),
      };
    },
    render(g, st) {
      st.tab = st.tab || 'threats';
      const c = this.cats(g);
      return `${tabs('intel', [['threats', 'Threat warnings', c.threats.length], ['enemy', 'Enemy activity', c.enemy.length], ['districts', 'District intelligence', c.districts.length], ['espionage', 'Espionage reports', c.espionage.length], ['economy', 'Economic information', c.economy.length]], st.tab)}
        <div class="scr-main"><div class="grid-fill" id="g-int"></div>${pager('p-int')}</div>`;
    },
    after(g, st) { S.fill('#g-int', '#p-int', this.cats(g)[st.tab], 300, 128, ({ e, turn }) => eventCard(g, e, turn), st); },
  };

  // OBJECTIVES: victory conditions with everyone's progress.
  SCREENS.victory = {
    title: 'Objectives', icon: 'victory',
    render(g) {
      const alive = g.order.filter((fid) => g.factions[fid].alive);
      const prog = Object.fromEntries(alive.map((fid) => [fid, ND.Victory.progress(g, fid)]));
      const ICON = { territorial: 'factions', domination: 'battles', economic: 'credits', tech: 'research', political: 'influence' };
      return `<div class="obj-grid">${Object.keys(ND.VICTORY_INFO).map((k) => {
        const info = ND.VICTORY_INFO[k], v = g.victory[k];
        if (!v.on) return `<div class="obj-card off"><div class="obj-head">${ND.icon(ICON[k])}<b>${info.name}</b></div><p class="dim">Switched off for this game.</p></div>`;
        return `<div class="obj-card"><div class="obj-head">${ND.icon(ICON[k])}<b>${info.name}</b></div><p class="small dim">${esc(info.desc(v))}</p>
          ${alive.map((fid) => { const pr = prog[fid][k]; return `<div class="obj-row ${fid === g.player ? 'me' : ''}">${ND.emblemSvg(fid)}${bar(Math.min(100, pr.pct * 100), ND.FDEF[fid].color)}<b>${pr.value}/${pr.need}</b></div>`; }).join('')}</div>`;
      }).join('')}
        <div class="obj-card"><div class="obj-head">${ND.icon('warn')}<b>Defeat</b></div><p class="small">You lose if you control no districts, or if any rival completes an enabled objective first.</p><p class="small dim">Difficulty: ${ND.DIFFICULTY[g.difficulty].label} — ${esc(ND.DIFFICULTY[g.difficulty].desc)}</p></div></div>`;
    },
  };

  // TREASURY: forecast, stock and the black market.
  SCREENS.treasury = {
    title: 'Treasury', icon: 'credits',
    render(g) {
      const p = g.player, f = g.factions[p], L = ND.Econ.ledger(g, p);
      return `<div class="two-col">
        <section class="card"><h3>${ND.icon('economy')}Forecast for next turn</h3>
          <table class="ledger big"><tr><th></th>${ND.RES.map((r) => `<th class="c-${r}">${ND.RES_LABEL[r]}</th>`).join('')}</tr>
            <tr><td>In stock</td>${ND.RES.map((r) => `<td><b>${f.res[r]}</b></td>`).join('')}</tr>
            <tr><td>Income</td>${ND.RES.map((r) => `<td>+${L.income[r]}</td>`).join('')}</tr>
            <tr><td>Districts</td>${ND.RES.map((r) => `<td class="neg">−${L.distUpkeep[r]}</td>`).join('')}</tr>
            <tr><td>Payroll</td>${ND.RES.map((r) => `<td class="neg">−${L.payroll[r]}</td>`).join('')}</tr>
            <tr class="net"><td>Net</td>${ND.RES.map((r) => `<td class="${L.net[r] < 0 ? 'neg' : 'pos'}">${sgn(L.net[r])}</td>`).join('')}</tr></table>
          <p class="small dim">${L.districts} districts${L.facilities ? ` · ${L.facilities} facilities held` : ''}${L.skim ? ` · ${L.skim} CR skimmed from ${L.skimDistricts} district(s)` : ''}.</p>
          ${ND.RES.some((r) => f.res[r] + L.net[r] < 0) ? `<div class="d-status st-warn">${ND.icon('warn')}<span>Shortfall ahead: unpaid upkeep causes unrest; unpaid credits make your priciest unit desert.</span></div>` : ''}
        </section>
        <section class="card"><h3>${ND.icon('credits')}Black market</h3>
          <p class="small dim">Trade in lots of ${ND.Market.LOT}. Each Black Market district you control improves rates by 5% (max 25%)${ND.Market.bonus(g, p) ? ` — currently +${Math.round(ND.Market.bonus(g, p) * 100)}%` : ''}.</p>
          ${ND.Market.goods.map((r) => `<div class="mkt-row"><span class="c-${r}">${ND.icon(r)}${ND.RES_LABEL[r]} <b class="num">${f.res[r]}</b></span>
            <button class="btn" data-cmd="sell" data-arg="${r}" ${f.res[r] >= ND.Market.LOT && !g.over ? '' : 'disabled'}>Sell ${ND.Market.LOT} → ${ND.Market.sellPrice(g, p, r)} CR</button>
            <button class="btn" data-cmd="buy-res" data-arg="${r}" ${f.res.credits >= ND.Market.buyPrice(g, p, r) && !g.over ? '' : 'disabled'}>Buy ${ND.Market.LOT} ← ${ND.Market.buyPrice(g, p, r)} CR</button></div>`).join('')}
        </section></div>`;
    },
  };

  // SETTINGS: tabs.
  SCREENS.settings = {
    title: 'Settings', icon: 'settings',
    render(g, st) {
      st.tab = st.tab || 'saves';
      let body = '';
      if (st.tab === 'saves') {
        body = `<div class="slot-grid">${ND.Save.slots.map((slot) => {
          const m = ND.Save.meta(slot);
          return `<div class="slot-card">${m ? `<canvas data-fig="leader|${m.faction}"></canvas>` : '<div class="slot-empty">Empty</div>'}
            <b>${slot === 'auto' ? 'Autosave' : 'Slot ' + slot}</b>
            <span class="dim small">${m ? `Turn ${m.turn} · ${esc(fname(m.faction))}<br>${new Date(m.date).toLocaleString()}${m.over ? ' · finished' : ''}` : 'No save'}</span>
            <span class="slot-btns">${slot === 'auto' ? '' : `<button class="btn sm" data-cmd="save" data-arg="${slot}">Save here</button>`}
            <button class="btn sm" data-cmd="load" data-arg="${slot}" ${m ? '' : 'disabled'}>Load</button>
            <button class="btn sm danger" data-cmd="del" data-arg="${slot}" ${m ? '' : 'disabled'}>Delete</button></span></div>`;
        }).join('')}</div><p class="small dim">Saves live in this browser's local storage. Game seed: ${g.seed}.</p>`;
      } else if (st.tab === 'gameplay') {
        body = `<div class="card set-card">
          <label class="check big"><input type="checkbox" id="opt-autosave" ${g.settings.autosave ? 'checked' : ''} data-cmd="autosave"> Autosave at the end of every turn</label>
          <label class="check big"><input type="checkbox" id="opt-brief" ${g.settings.autoBriefing !== false ? 'checked' : ''} data-cmd="autobrief"> Open the briefing automatically at the start of each turn</label>
          <p class="small dim">Difficulty: ${ND.DIFFICULTY[g.difficulty].label}. Victory conditions are fixed once a game starts — see Objectives.</p></div>`;
      } else if (st.tab === 'audio') {
        const P = ND.Audio.prefs;
        const slider = (k, label, onKey, hint) => `<div class="aud-row">
            ${onKey ? `<label class="check"><input type="checkbox" data-audio-flag="${onKey}" ${P[onKey] ? 'checked' : ''}> ${label}</label>` : `<b>${label}</b>`}
            <input type="range" min="0" max="100" step="1" value="${Math.round(P[k] * 100)}" data-audio-vol="${k}" aria-label="${label} volume">
            <output>${Math.round(P[k] * 100)}%</output><span class="small dim">${hint}</span></div>`;
        body = `<div class="card set-card aud-card">
          ${ND.Audio.ctx ? '' : `<div class="d-status st-warn">${ND.icon('mute')}<span>Sound starts after your first click or key press (browser rule).</span></div>`}
          <label class="check big"><input type="checkbox" data-audio-flag="muted" ${P.muted ? 'checked' : ''}> Mute all sound</label>
          ${slider('master', 'Master', null, 'Overall level')}
          ${slider('music', 'Music', 'musicOn', 'Synthesised score — changes with the screen and your faction')}
          ${slider('sfx', 'Sound effects', 'sfxOn', 'Interface and gameplay feedback')}
          ${slider('ambient', 'Ambience', 'ambientOn', 'City soundscape — follows the district you select')}
          <p class="small dim">Release a slider to hear a preview. Preferences are saved in this browser and apply to every game.</p></div>`;
      } else {
        body = `<div class="card set-card"><p>Leave this game and return to the faction selection screen. Your autosave stays available under Continue.</p>
          <button class="btn danger big" data-cmd="quit">Quit to main menu</button>
          <p>Learn the basics with the interactive tutorial (starts a separate practice game; it never overwrites your autosave).</p>
          <button class="btn primary" data-cmd="tutorial">${ND.icon('manual')}Start tutorial</button></div>`;
      }
      return `${tabs('settings', [['saves', 'Save & load'], ['gameplay', 'Gameplay'], ['audio', 'Audio'], ['session', 'Session']], st.tab)}<div class="scr-main">${body}</div>`;
    },
  };

  // MANUAL: chapters.
  const R = () => ND.RULES;
  const CHAPTERS = [
    ['goal', 'Goal', (g) => `<p>Build a criminal empire until you meet one of this game's objectives:</p><ul>${Object.keys(ND.VICTORY_INFO).filter((k) => g.victory[k].on).map((k) => `<li><b>${ND.VICTORY_INFO[k].name}</b> — ${esc(ND.VICTORY_INFO[k].desc(g.victory[k]))}</li>`).join('')}</ul><p>Rivals can win the same ways. Check <b>Objectives</b> to see who is close.</p>`],
    ['influence', 'Influence & control', () => `<p>Every district holds an influence share for each faction plus unaligned citizens.</p><p>A faction <b>takes control</b> at the end of a turn when it has at least <b>${R().captureMin}%</b> and leads the runner-up by <b>${R().captureMargin}</b> points. An owner keeps control while it stays at <b>${R().holdMin}%</b> or more.</p><p>Holding ${R().skimMin}%+ in a district you don't control skims ${R().skimRate * 100}% of its credits.</p>`],
    ['ops', 'Operations', () => `<p>District operations cost <b>operation points (OPS)</b> plus resources. You get ${R().baseOps} OPS a turn, +1 per ${R().opsPerDistricts} districts (max ${R().maxOps}).</p><ul>${ND.Actions.keys.map((k) => `<li><b>${ND.Actions.defs[k].hotkey} · ${ND.Actions.defs[k].label}</b> — ${esc(ND.Actions.defs[k].desc)}</li>`).join('')}</ul>`],
    ['units', 'Units', () => `<p>Recruit personnel on the <b>Recruit</b> screen; they appear at your HQ and cost upkeep every turn.</p><p>Each unit can <b>move</b> once a turn (anywhere through your connected territory, plus one step beyond) and keeps a <b>standing order</b>: Canvass, Guard, Gather Intel, Train, Seize or Sabotage a facility, Attack, Establish HQ or Rest.</p><p>Experience raises level (max 5, +1 to all stats per level). Gear from the <b>Armory</b> fills weapon, armor and gear slots.</p>`],
    ['combat', 'Combat', () => `<p>Battles resolve automatically at the end of the turn: first Attack orders, then guards intercepting intruders who canvass, seize or sabotage in their district.</p><p>Up to ${ND.Combat.ROUNDS} rounds. Hit chance rises with ATK over the target's DEF; defenders in their own district gain DEF from security, development, HQ and Guard stance. Ties go to the defender.</p><p>Fallen units are killed or wounded. Every battle has a report on the <b>Battles</b> screen.</p>`],
    ['research', 'Research', () => `<p>Open <b>Research</b> from the top bar. Pick one project at a time: the cost is paid up front, then it completes after enough research points (2 a turn, more from research districts and facilities).</p><p>Three branches — Military, Biological, Information — plus a signature technology for your faction and the Singularity Protocol.</p>`],
    ['covert', 'Covert operations', () => `<p>The <b>Covert Ops</b> tab under the map holds spying, opinion manipulation, income disruption, factory sabotage, technology theft, plague release and assassination.</p><p>The success chance is shown before you commit. Nearby Agents, Hackers and Assassins help. Failures alert the district and expose you; operatives near a failed plot may be wounded or executed.</p>`],
    ['diplomacy', 'Diplomacy', () => `<p>Non-aggression pacts last ${ND.Diplo.PACT_TURNS} turns and forbid hostile actions both ways. Relations fall with battles, raids, captures and exposed plots, and recover slowly.</p><p>Breaking a pact angers the partner and everyone else.</p>`],
    ['economy', 'Economy', () => `<p><span class="c-credits">Credits</span> pay for almost everything. <span class="c-energy">Energy</span> powers your territory — every district costs 1 a turn. <span class="c-materials">Materials</span> build fortifications, development and gear. <span class="c-intel">Intel</span> pays for bribes and covert operations.</p><p>Click the resource bar for the <b>Treasury</b>: next turn's forecast and the black market.</p>`],
    ['turn', 'Turn sequence', () => `<ol><li>Collect income.</li><li>Pay maintenance.</li><li>Receive the briefing.</li><li><b>Issue your commands.</b></li><li>Rival factions act.</li><li>Battles, unit orders and security crackdowns resolve.</li><li>Influence and control update.</li><li>Standings, diplomacy and objectives are checked.</li></ol>`],
    ['controls', 'Controls', () => `<p>Click a district to inspect it. Arrow keys move the selection, <b>1–5</b> run district operations, <b>E</b> ends the turn, <b>Esc</b> closes screens.</p><p>New to the game? The interactive tutorial walks you through your first capture.</p><button class="btn primary" data-cmd="tutorial">${ND.icon('manual')}Start tutorial</button>`],
  ];
  SCREENS.help = {
    title: 'Manual', icon: 'manual',
    render(g, st) {
      const cur = CHAPTERS.find((c) => c[0] === st.tab) || CHAPTERS[0];
      return `<div class="split manual">
        <nav class="chapters">${CHAPTERS.map(([k, t], i) => `<button class="chap ${k === cur[0] ? 'on' : ''}" data-cmd="scr" data-arg="tab" data-arg2="${k}"><span class="num">${i + 1}</span>${t}</button>`).join('')}</nav>
        <article class="chapter card"><h2>${cur[1]}</h2>${cur[2](g)}</article></div>`;
    },
  };

  // GAME OVER: cinematic result.
  SCREENS.gameover = {
    title: 'Campaign Result', icon: 'victory',
    render(g) {
      const o = g.over, p = g.player, st = ND.Turn.standings(g);
      const winner = o.result === 'victory' ? p : o.winner || (st.find((s) => s.alive && s.fid !== p) || st[0]).fid;
      const W = ND.FDEF[winner], f = g.factions[p], me = st.find((s) => s.fid === p);
      const econ = f.res.credits + ND.Econ.ledger(g, p).income.credits * 10;
      const mil = ND.Units.list(g, p).reduce((a, u) => a + ND.Units.stats(u).atk + ND.Units.stats(u).def, 0);
      return `<div class="go-wrap ${o.result}" style="--fc:${W.color}">
        <div class="go-art"><canvas data-fig="leader|${winner}"></canvas><span class="emblem-big">${ND.emblemSvg(winner)}</span></div>
        <div class="go-info">
          <div class="go-type">${o.result === 'victory' ? 'VICTORY' : 'DEFEAT'}</div>
          <div class="go-sub">${esc(o.type)}</div>
          <p>${esc(o.text)}</p>
          <div class="go-stats">
            <div><span>Final territory</span><b>${me.districts}</b></div>
            <div><span>Economic score</span><b>${econ}</b></div>
            <div><span>Military score</span><b>${mil}</b></div>
            <div><span>Battles won / lost</span><b>${f.battlesWon || 0} / ${f.battlesLost || 0}</b></div>
            <div><span>Technologies</span><b>${f.tech.done.length}</b></div>
            <div><span>Turns played</span><b>${o.turn}</b></div>
          </div>
          <div class="go-rank">${st.map((s, i) => `<span class="${s.fid === p ? 'me' : ''}">${i + 1}. ${ND.emblemSvg(s.fid)}${esc(ND.FDEF[s.fid].short)} ${s.alive ? s.districts : '—'}</span>`).join('')}</div>
          <div class="go-btns"><button class="btn big" data-cmd="close">View the city</button><button class="btn primary big" data-cmd="quit">New campaign</button></div>
        </div></div>`;
    },
  };

  ND.Screens.list = SCREENS;
})(window.ND);
