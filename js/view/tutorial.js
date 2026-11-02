// Interactive tutorial (Thai). A guided game: a coach card explains each step, a pulsing ring points at the
// control to use, and action steps advance by themselves once the player has actually done the thing.
// Progress lives in g.tutorial, so it survives save/load.
(function (ND) {
  const $ = (s) => document.querySelector(s);
  const ui = () => ND.UI;
  const G = () => ND.UI.g;
  const me = (g) => g.factions[g.player];
  const tgt = (g) => g.districts[g.tutorial.target];
  const inf = (g) => ND.Inf.get(tgt(g), g.player);
  const modalOpen = () => !$('#modal').classList.contains('hidden');
  const modalTitle = () => $('#modal-title').textContent;
  const myUnits = (g) => ND.Units.list(g, g.player);
  const sec = (d) => ND.World.sector(d);
  const b = (s) => `<b>${s}</b>`;

  const STEPS = [
    {
      title: 'ยินดีต้อนรับสู่ Neon Dominion',
      info: true,
      body: () => `คุณคือหัวหน้าแก๊ง ${b('Street Reapers')} (สีส้ม) ที่ต้องแย่งชิงเมืองกับอีก 5 แก๊ง<br><br>
        บทเรียนนี้จะพาเล่นทีละขั้น อ่านกล่องนี้แล้วทำตาม<br>
        <span class="tut-key">กรอบสีเหลืองกระพริบ</span> = สิ่งที่ต้องกดต่อไป<br><br>
        ขั้นที่ต้อง "ทำ" จะไปต่อเองเมื่อทำเสร็จ ส่วนขั้นที่เป็นคำอธิบายให้กด ${b('ถัดไป')}`,
    },
    {
      title: 'แผนที่เมือง',
      info: true,
      target: '#center',
      hint: (g) => g.tutorial.hq,
      body: (g) => `เมืองมี 100 เขต (10×10) แต่ละช่องคือ 1 เขต<br>
        • ${b('สีของช่อง')} = แก๊งที่ครองเขตนั้น ช่องเทา = ยังไม่มีใครครอง<br>
        • ${b('◆')} = สำนักงานใหญ่ (HQ) ของแต่ละแก๊ง — ของคุณคือช่องที่มีวงเหลือง (${sec(g.districts[g.tutorial.hq])})<br>
        • ${b('กรอบเส้นประสีส้ม')} = เขตที่คุณ "เอื้อมถึง" และสั่งการได้ (ติดกับเขตของคุณ)<br>
        • ${b('แถบสีใต้ช่อง')} = สัดส่วนอิทธิพลของแต่ละแก๊งในเขตนั้น`,
    },
    {
      title: 'ทรัพยากร 4 อย่าง',
      info: true,
      target: '#resources',
      body: () => `• ${b('CR')} เครดิต (เงิน) — ใช้แทบทุกอย่าง สำคัญที่สุด<br>
        • ${b('EN')} พลังงาน — ทุกเขตที่ครองกิน 1 ต่อเทิร์น<br>
        • ${b('MT')} วัตถุดิบ — สร้างป้อม พัฒนาเขต วิจัย<br>
        • ${b('ID')} ข้อมูลข่าวกรอง — ติดสินบน ปฏิบัติการลับ วิจัย<br><br>
        ตัวเลขเล็กสีเขียว/แดงข้าง ๆ = จะได้หรือเสียเท่าไรในเทิร์นหน้า ถ้าเป็น${b(' สีแดง')} ต้องระวัง`,
    },
    {
      title: 'เลือกเขตเป้าหมาย',
      target: '#center',
      hint: (g) => g.tutorial.target,
      body: (g) => `${b('คลิกช่องที่มีวงเหลืองกระพริบ')} บนแผนที่<br><br>
        นั่นคือ ${b(tgt(g).name)} (${sec(tgt(g))}) — อยู่ติดกับ HQ และ Security ต่ำ จึงยึดง่าย`,
      done: (g) => ui().sel === g.tutorial.target,
    },
    {
      title: 'อิทธิพล ≠ การครอง (สำคัญที่สุด!)',
      info: true,
      target: '#right',
      enter: (g) => { if (ui().sel !== g.tutorial.target) ui().select(g.tutorial.target); },
      body: (g) => `ดูแผงขวา หัวข้อ ${b('Influence')} — ตอนนี้คุณมีอิทธิพลในเขตนี้ ${b(inf(g) + '%')}<br><br>
        จะ${b('ยึด')}เขตได้ต้องครบ 2 ข้อ:<br>
        ① อิทธิพล ${b('50% ขึ้นไป')}<br>
        ② นำแก๊งอันดับสองอย่างน้อย ${b('15 แต้ม')}<br><br>
        การยึดเกิดขึ้น${b('ตอนจบเทิร์น')} ไม่ใช่ทันที ส่วน ${b('Security')} ยิ่งสูงยิ่งเพิ่มอิทธิพลยาก`,
    },
    {
      title: 'สั่ง Influence Campaign',
      target: '[data-act="campaign"]',
      enter: (g) => { ui().actTab = 'district'; ui().select(g.tutorial.target); g.tutorial.mark = inf(g); },
      body: (g) => `ด้านล่างคือ${b('คำสั่งของเขต')}ที่เลือกอยู่<br><br>
        กดปุ่ม ${b('Influence Campaign')} (หรือกดเลข ${b('1')} บนคีย์บอร์ด)<br>
        ใช้ 1 OPS + เงินเล็กน้อย เพื่อเพิ่มอิทธิพลในเขตนี้`,
      done: (g) => inf(g) > g.tutorial.mark,
    },
    {
      title: 'ทำอีกครั้ง',
      target: '[data-act="campaign"]',
      enter: (g) => { g.tutorial.mark = inf(g); },
      body: (g) => `เยี่ยม! อิทธิพลขึ้นเป็น ${b(inf(g) + '%')} แล้ว<br><br>
        ${b('OPS')} บนแถบด้านบน = จำนวนคำสั่งที่เหลือในเทิร์นนี้ (ต้นเกมได้ 3 ต่อเทิร์น)<br><br>
        กด ${b('Influence Campaign')} อีกครั้ง เพื่อดันให้ใกล้ 50%`,
      done: (g) => inf(g) > g.tutorial.mark || me(g).ops === 0,
    },
    {
      title: 'จ้างหน่วย (Recruit)',
      target: () => (modalOpen() && modalTitle() === 'Recruitment' ? '#modal [data-cmd="recruit"]:not([disabled])' : '#topbar [data-screen="recruit"]'),
      body: () => `${b('หน่วย')}คือลูกน้องที่ทำงานให้ทุกเทิร์นเอง${b('โดยไม่ใช้ OPS')}<br><br>
        ① กดปุ่ม ${b('Recruit')} ด้านบน<br>
        ② กด ${b('Recruit')} ใต้ ${b('Human Mercenary')} คนไหนก็ได้<br><br>
        หน่วยใหม่จะไปอยู่ที่ HQ และมี${b('ค่าจ้างทุกเทิร์น')} — อย่าจ้างเยอะจนเงินติดลบ`,
      done: (g) => myUnits(g).length > 0,
    },
    {
      title: 'ย้ายหน่วยไปเขตเป้าหมาย',
      target: (g) => {
        if (modalOpen()) return '#modal .modal-head [data-cmd="close"]';
        if (ui().moving != null) return '#center';
        if (ui().sel !== g.tutorial.hq) return '#center';
        return '#right [data-cmd="move"]';
      },
      hint: (g) => (ui().moving != null ? g.tutorial.target : ui().sel !== g.tutorial.hq ? g.tutorial.hq : null),
      body: (g) => `① ปิดหน้าต่าง (ปุ่ม ✕) ถ้ายังเปิดอยู่<br>
        ② คลิก ${b('HQ')} ของคุณบนแผนที่ (วงเหลือง)<br>
        ③ ในแผงขวา หัวข้อ ${b('Units here')} กดปุ่มสีเขียว ${b('➜ Move')} ที่หน่วย<br>
        ④ ช่องที่ไปได้จะเป็นสีเขียว — คลิก ${b(tgt(g).name)} (วงเหลือง)<br><br>
        หน่วยย้ายได้ 1 ครั้งต่อเทิร์น`,
      done: (g) => myUnits(g).some((u) => u.loc === g.tutorial.target),
    },
    {
      title: 'สั่งให้หาเสียง (Canvass)',
      target: () => ($('#right [data-order="canvass"]') ? '#right [data-order="canvass"]' : '#right .u-cur'),
      enter: (g) => { if (!modalOpen()) ui().select(g.tutorial.target); },
      body: () => `ทุกหน่วยมี${b('คำสั่งประจำ')} ที่จะทำซ้ำทุกเทิร์นจนกว่าคุณจะเปลี่ยน<br><br>
        ในแผงขวา ใต้ชื่อหน่วยจะมี${b('ปุ่มคำสั่ง')} (ถ้ายังไม่เห็น ให้กดแถบ ${b('Change ▼')} ของหน่วย)<br>
        กดปุ่ม ${b('📢 Canvass')} (หาเสียง) — หน่วยจะเพิ่มอิทธิพลในเขตที่ยืนอยู่ทุกเทิร์น<br><br>
        ใต้แต่ละปุ่มบอกผลที่จะได้ เช่น ${b('+7% influence')} ปุ่มสีจางคือใช้ไม่ได้ในเขตนี้ (ชี้เมาส์ค้างเพื่อดูเหตุผล)<br><br>
        คำสั่งอื่นที่ควรรู้: ${b('🛡 Guard')} = เฝ้าเขตของตัวเอง และสู้กับศัตรูที่เข้ามา`,
      done: (g) => myUnits(g).some((u) => u.task.kind === 'canvass'),
    },
    {
      title: 'เริ่มงานวิจัย',
      target: () => (modalOpen() && modalTitle() === 'Technology Tree' ? '#modal [data-cmd="research"]:not([disabled])' : '#rdpill'),
      body: () => `งานวิจัยให้โบนัสถาวร เช่น หน่วยตีแรงขึ้น<br><br>
        ① กดกล่อง ${b('R&D')} บนแถบด้านบน<br>
        ② กดปุ่ม ${b('Research')} ที่เทคไหนก็ได้ที่กดได้ (ตอนนี้แนะนำ ${b('Advanced Weapons')})<br><br>
        วิจัยได้ทีละอย่าง จ่ายเงินก่อนแล้วรอหลายเทิร์น`,
      done: (g) => !!me(g).tech.current || me(g).tech.done.length > 0,
    },
    {
      title: 'จบเทิร์น',
      target: () => (modalOpen() ? '#modal .modal-head [data-cmd="close"]' : '#btn-end'),
      body: () => `สั่งงานครบแล้ว! ปิดหน้าต่าง (ถ้าเปิดอยู่) แล้วกด ${b('END TURN')} (หรือกด ${b('E')})<br><br>
        แก๊งอื่นจะเล่นตาของเขา จากนั้นคำสั่งทั้งหมดจะเกิดผล: หน่วยหาเสียง เกิดการรบ และยึดเขต`,
      done: (g) => g.turn >= 2,
    },
    {
      title: 'รายงานต้นเทิร์น',
      target: '#modal .modal-box',
      body: () => `ทุกต้นเทิร์นจะมี${b('รายงาน')}สรุป:<br>
        • ${b('รายรับ-รายจ่าย')} ของเทิร์นนี้<br>
        • ${b('อันดับ')}ของทุกแก๊ง<br>
        • ${b('เหตุการณ์')}ที่คุณมองเห็น เช่น ใครยึดเขตไหน หรือเกิดการรบที่ไหน<br><br>
        อ่านแล้วกด ${b('Issue commands')} เพื่อเล่นต่อ (เปิดดูใหม่ได้ที่ปุ่ม Briefing)`,
      done: () => !modalOpen(),
    },
    {
      title: 'ยึดเขตให้สำเร็จ',
      target: (g) => (modalOpen() ? '#modal .modal-head [data-cmd="close"]' : me(g).ops > 0 && ui().sel === g.tutorial.target ? '[data-act="campaign"]' : ui().sel !== g.tutorial.target ? '#center' : '#btn-end'),
      hint: (g) => (ui().sel !== g.tutorial.target ? g.tutorial.target : null),
      body: (g) => `อิทธิพลของคุณใน ${b(tgt(g).name)} ตอนนี้: ${b(inf(g) + '%')} (ต้อง 50% และนำ 15 แต้ม)<br><br>
        ทำซ้ำแบบเดิมจนกว่าจะยึดได้:<br>
        ① คลิกเขตเป้าหมาย ② กด ${b('Influence Campaign')} ③ กด ${b('END TURN')}<br><br>
        หน่วยของคุณจะช่วยหาเสียงให้ทุกเทิร์นด้วย`,
      done: (g) => tgt(g).owner === g.player,
    },
    {
      title: 'ยึดได้แล้ว! 🎉',
      info: true,
      target: '#left .ledger',
      body: (g) => `${b(tgt(g).name)} เป็นของคุณแล้ว (สีส้ม)<br><br>
        เขตที่ครองจะ${b('ให้รายได้ทุกเทิร์น')} แต่มี${b('ค่าดูแล')} 3 CR + 1 EN ต่อเขต<br><br>
        ดูกรอบ ${b('Treasury forecast')} ทางซ้าย: แถว ${b('Net')} คือกำไรสุทธิต่อเทิร์น<br>
        ถ้าเป็นสีแดงแปลว่าขาดทุน — ถ้าทรัพยากรหมด อิทธิพลจะลดลงทุกเขต และหน่วยจะหนี`,
    },
    {
      title: 'พลังงานและการป้องกัน',
      info: true,
      hint: (g) => {
        const hq = g.districts[g.tutorial.hq];
        const pp = g.districts.filter((d) => d.type === 'power' && d.owner !== g.player)
          .sort((a, c) => (Math.abs(a.x - hq.x) + Math.abs(a.y - hq.y)) - (Math.abs(c.x - hq.x) + Math.abs(c.y - hq.y)))[0];
        return pp ? pp.id : null;
      },
      target: '#center',
      body: () => `⚡ ${b('พลังงาน')}: ยิ่งมีเขตมาก ยิ่งกินพลังงานมาก<br>
        วงเหลืองบนแผนที่คือ${b('โรงไฟฟ้า')}ที่ใกล้คุณที่สุด (ไอคอนสายฟ้า) — พยายามยึดมาให้ได้<br><br>
        🛡️ ${b('การป้องกัน')}: ถ้า HQ ไม่มีหน่วยเฝ้า ศัตรูจะแอบเข้ามาปล้น<br>
        จ้างหน่วยเพิ่มแล้วสั่ง ${b('Guard')} ในเขตชายแดน — Guard จะสู้กับศัตรูที่เข้ามาโดยอัตโนมัติ`,
    },
    {
      title: 'เมนูอื่น ๆ',
      info: true,
      target: '#topbar nav',
      body: () => `• ${b('Units')} — ดูหน่วยทั้งหมด ใส่อาวุธ ฝึก<br>
        • ${b('Armory')} — ซื้ออาวุธและเกราะ<br>
        • ${b('Battles')} — รายงานการรบละเอียด<br>
        • ${b('Diplomacy')} — ทำสนธิสัญญาไม่รุกรานกับแก๊งอื่น<br>
        • ${b('Victory')} — ดูว่าใครใกล้ชนะแค่ไหน<br>
        • ${b('Manual')} — คู่มือกฎทั้งหมด<br>
        • แท็บ ${b('Covert Ops')} ใต้แผนที่ — ปฏิบัติการลับ เช่น ขโมยเงิน สอดแนม<br>
        • ${b('ตลาดมืด')} ทางซ้าย — ขายทรัพยากรที่เหลือเป็นเงิน`,
    },
    {
      title: 'จบบทเรียน!',
      info: true,
      last: true,
      body: () => `ตอนนี้คุณรู้พื้นฐานครบแล้ว 🎓<br><br>
        ${b('วิธีชนะง่ายที่สุด')}: ครอง 50 เขต — ขยายทีละเขตแบบที่เพิ่งทำ<br><br>
        วนแบบนี้ทุกเทิร์น:<br>
        ① ใช้ OPS ทำ Campaign กับเขตรอบตัว<br>
        ② ดูแลหน่วยไม่ให้ว่างงาน (กล่อง UNITS ด้านบนจะเตือนคำว่า idle)<br>
        ③ คุมเงินไม่ให้ติดลบ<br>
        ④ กด END TURN<br><br>
        เกมนี้ยังเล่นต่อได้เลย หรือเริ่มเกมใหม่จากเมนูหลัก (บทเรียนเปิดใหม่ได้จากปุ่ม Manual)`,
    },
  ];

  const T = (ND.Tutorial = {
    STEPS,
    timer: null,
    lastStep: -1,

    active() { const g = G(); return !!(g && g.tutorial && !g.tutorial.done); },

    // Start a fresh guided game: Street Reapers, easy, and a market with affordable signature recruits.
    startGame() {
      const g = ND.World.create(20261102, 'reapers', { difficulty: 'easy' });
      const f = g.factions.reapers, hq = g.districts[f.hq];
      const target = ND.World.neighbors(g, hq).filter((n) => !n.owner).sort((a, c) => a.security - c.security)[0];
      f.market = f.market.map(() => {
        let c;
        for (let i = 0; i < 80; i++) { c = ND.Units.makeCandidate(g, 'reapers'); if (c.type === 'merc') break; }
        return c;
      });
      g.tutorial = { step: 0, target: target.id, hq: hq.id, mark: 0, done: false };
      ND.UI.start(g);
    },

    attach() {
      if (!$('#tut-card')) {
        const card = document.createElement('div');
        card.id = 'tut-card';
        document.body.appendChild(card);
        const ring = document.createElement('div');
        ring.id = 'tut-ring';
        document.body.appendChild(ring);
        card.addEventListener('click', (e) => {
          const bt = e.target.closest('[data-tut]');
          if (bt) T.command(bt.dataset.tut);
        });
      }
      T.lastStep = -1;
      clearInterval(T.timer);
      T.timer = setInterval(T.tick, 250);
      T.tick();
    },
    detach() {
      clearInterval(T.timer);
      T.timer = null;
      const c = $('#tut-card'), r = $('#tut-ring');
      if (c) c.classList.add('hidden');
      if (r) r.classList.add('hidden');
    },
    command(c) {
      const g = G();
      if (!g || !g.tutorial) return;
      if (c === 'next' || c === 'skip') T.go(g.tutorial.step + 1);
      else if (c === 'back') T.go(Math.max(0, g.tutorial.step - 1));
      else if (c === 'exit' || c === 'finish') { g.tutorial.done = true; T.detach(); ui().drawMap(); }
      else if (c === 'min') { g.tutorial.min = !g.tutorial.min; T.render(); }
    },
    go(i) {
      const g = G();
      if (i >= STEPS.length) { g.tutorial.done = true; T.detach(); return; }
      g.tutorial.step = i;
      const s = STEPS[i];
      if (s.enter) s.enter(g);
      T.lastStep = i;
      T.render();
      ui().drawMap();
    },

    hintCell() {
      if (!T.active()) return null;
      const g = G(), s = STEPS[g.tutorial.step];
      return s && s.hint ? s.hint(g) : null;
    },

    // Poll: advance finished action steps, keep the highlight ring glued to its target, animate the map hint.
    tick() {
      const g = G();
      if (!T.active() || $('#game').classList.contains('hidden')) { T.detach(); return; }
      let s = STEPS[g.tutorial.step];
      if (g.tutorial.step !== T.lastStep) { if (s.enter) s.enter(g); T.lastStep = g.tutorial.step; T.render(); }
      if (!s.info && s.done && s.done(g)) { T.go(g.tutorial.step + 1); s = STEPS[g.tutorial.step]; if (!T.active()) return; }
      T.render(true);
      T.placeRing(s);
      if (s.hint) ui().drawMap();
    },

    placeRing(s) {
      const ring = $('#tut-ring'), g = G();
      const sel = typeof s.target === 'function' ? s.target(g) : s.target;
      const el = sel && document.querySelector(sel);
      const r = el && el.getBoundingClientRect();
      if (!r || !r.width || !r.height) { ring.classList.add('hidden'); return; }
      ring.classList.remove('hidden');
      Object.assign(ring.style, { left: r.left - 4 + 'px', top: r.top - 4 + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px' });
    },

    // quiet=true re-renders only when the text would change (live numbers like influence %).
    render(quiet) {
      const g = G(), card = $('#tut-card');
      if (!card || !T.active()) return;
      const i = g.tutorial.step, s = STEPS[i];
      const html = `
        <div class="tut-head">
          <span class="tut-n">บทเรียน ${i + 1}/${STEPS.length}</span>
          <span><button class="tut-x" data-tut="min" title="ย่อ/ขยาย">${g.tutorial.min ? '▢' : '—'}</button><button class="tut-x" data-tut="exit" title="ออกจากบทเรียน">✕</button></span>
        </div>
        <div class="tut-title">${s.title}</div>
        ${g.tutorial.min ? '' : `<div class="tut-body">${s.body(g)}</div>`}
        <div class="tut-foot">
          ${i > 0 ? '<button class="btn xs" data-tut="back">‹ ย้อนกลับ</button>' : '<span></span>'}
          ${s.last ? '<button class="btn sm primary" data-tut="finish">เล่นต่อเอง ✓</button>'
            : s.info ? '<button class="btn sm primary" data-tut="next">ถัดไป ›</button>'
            : '<span class="tut-wait">⏳ ทำตามขั้นตอนด้านบน</span><button class="btn xs" data-tut="skip">ข้ามขั้นนี้</button>'}
        </div>`;
      if (quiet && card.dataset.html === html) return;
      card.dataset.html = html;
      card.innerHTML = html;
      card.classList.remove('hidden');
      card.classList.toggle('min', !!g.tutorial.min);
    },
  });
})(window.ND);
