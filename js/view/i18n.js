// Language layer (English / Thai). The game renders in English; when Thai is on, every text node and tooltip that
// appears on the page is translated just before it is painted:
//   1. exact phrases            ND.I18N.TH.exact['Operation points'] = 'แต้มปฏิบัติการ'
//   2. phrases with numbers     'Turn {n}' → 'เทิร์น {n}'   (numbers are matched and put back in order)
//   3. sentences with names     regex rules for log lines, reasons and reports (names stay in English)
// Proper names (factions, leaders, districts, characters) stay in English. Canvas text (map labels) is not touched.
// Purely presentational: the rules, saves and logs keep their English text.
(function (ND) {
  const KEY = 'neon-dominion:lang';
  const orig = new WeakMap(); // node → English text, so switching back to English restores it exactly
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  const NUM = /-?\d+(?:[.,]\d+)*%?/g;

  const I = (ND.I18N = {
    lang: 'en',
    TH: { exact: {}, num: {}, rules: [] }, // filled by js/view/i18n-th.js

    init() {
      try { this.lang = localStorage.getItem(KEY) === 'th' ? 'th' : 'en'; } catch (e) { /* default en */ }
      document.documentElement.lang = this.lang;
      new MutationObserver((muts) => {
        if (this.lang !== 'th') return;
        for (const m of muts) {
          if (m.type === 'characterData') this.node(m.target);
          else if (m.type === 'attributes') this.attr(m.target, m.attributeName);
          else for (const n of m.addedNodes) this.walk(n);
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      if (this.lang === 'th') this.walk(document.body);
    },

    set(lang) {
      if (lang === this.lang) return;
      this.lang = lang;
      try { localStorage.setItem(KEY, lang); } catch (e) { /* storage unavailable */ }
      document.documentElement.lang = lang;
      if (lang === 'th') this.walk(document.body);
      else this.restore(document.body);
      this.rerender();
    },
    toggle() { this.set(this.lang === 'th' ? 'en' : 'th'); },

    // Re-render whatever is on screen so freshly built English text goes through the translator (or not).
    rerender() {
      const vis = (s) => { const e = document.querySelector(s); return e && !e.classList.contains('hidden'); };
      if (vis('#title') && ND.Title) ND.Title.render();
      if (vis('#start')) ND.Main.renderStart();
      if (vis('#setupscr')) ND.Main.renderSetup();
      if (ND.UI && ND.UI.g && vis('#game')) { ND.UI.renderAll(); if (ND.Screens.isOpen()) ND.Screens.refresh(); }
      if (ND.Tutorial && ND.Tutorial.render) try { ND.Tutorial.render(); } catch (e) { /* tutorial not active */ }
    },

    // ---------- translation ----------
    // English text → Thai (or null when there is no translation). Leading/trailing spaces are kept.
    tr(text) {
      const T = this.TH, s = text.trim();
      if (!s || !/[A-Za-z]/.test(s)) return null;
      // decorations around a phrase ("⚠ …", "‹ City", "Treasury ›", "“quote”") are kept and the phrase translated
      const deco = s.match(/^([⚠•‹›▸▾“"(—–·\s]+)?(.*?)([›”")\s.:✓]+)?$/);
      if (deco && (deco[1] || deco[3]) && deco[2] && deco[2] !== s) {
        const inner = T.exact[deco[2]] ?? T.exact[deco[2] + '.'] ?? this.tr(deco[2]);
        if (inner != null) return text.match(/^\s*/)[0] + (deco[1] || '') + inner.trim() + (deco[3] || '').replace(/\./g, '') + text.match(/\s*$/)[0]; // Thai has no full stop
      }
      let out = T.exact[s];
      if (out == null) {
        const nums = s.match(NUM);
        if (nums) {
          const tpl = T.num[s.replace(NUM, '{n}')];
          if (tpl != null) { let i = 0; out = tpl.replace(/\{n\}/g, () => nums[i++] ?? ''); }
        }
      }
      if (out == null) {
        for (const [re, fn] of T.rules) {
          const m = s.match(re);
          if (!m) continue;
          out = typeof fn === 'function' ? fn(m, (x) => this.word(x), (x) => this.full(x) ?? x) : s.replace(re, fn);
          if (out != null) break; // a rule returns null when a label inside it is unknown; try the next one
        }
      }
      if (out == null) return null;
      const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
      return lead + out + trail;
    },
    // a single word or label inside a sentence (e.g. a district type): translated when known, else unchanged
    word(x) { const t = this.TH.exact[String(x).trim()]; return t == null ? x : t; },
    // translate a whole string: directly, else line by line, sentence by sentence ("A. B."), and finally piece by
    // piece around " · " / " — " separators (e.g. "B8 · Corporate HQ · HQ"). Untranslatable pieces stay English.
    full(text) {
      const one = this.tr(text);
      if (one != null) return one;
      const pieces = (s, re, join, next) => {
        const parts = s.split(re);
        if (parts.length < 2) return null;
        let hit = false;
        const out = parts.map((p) => { const t = next(p); if (t != null) hit = true; return t == null ? p : t; });
        return hit ? out.join(join) : null;
      };
      const seg = (s) => this.tr(s) ?? pieces(s, ' · ', ' · ', (p) => this.tr(p)) ?? pieces(s, ' — ', ' — ', (p) => this.tr(p)) ?? pieces(s, ', ', ', ', (p) => this.tr(p));
      const sentence = (s) => seg(s) ?? pieces(s, /(?<=[.!?])\s+(?=[A-Z⚠])/, ' ', seg);
      if (text.includes('\n')) {
        const lines = text.split('\n');
        let hit = false;
        const out = lines.map((l) => { const t = l.trim() ? sentence(l) : null; if (t != null) hit = true; return t == null ? l : t; });
        return hit ? out.join('\n') : null;
      }
      return sentence(text);
    },

    node(n) {
      if (n.nodeType !== 3 || !n.parentNode || /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) return;
      const en = orig.has(n) && n.nodeValue === orig.get(n).th ? orig.get(n).en : n.nodeValue;
      const th = this.full(en);
      if (th != null && th !== n.nodeValue) { orig.set(n, { en, th }); n.nodeValue = th; }
    },
    attr(el, a) {
      const v = el.getAttribute(a);
      if (!v) return;
      const key = 'a:' + a, rec = (orig.get(el) || {})[key];
      const en = rec && rec.th === v ? rec.en : v;
      const th = this.full(en);
      if (th != null && th !== v) { const r = orig.get(el) || {}; r[key] = { en, th }; orig.set(el, r); el.setAttribute(a, th); }
    },
    walk(root) {
      if (!root) return;
      if (root.nodeType === 3) { this.node(root); return; }
      if (root.nodeType !== 1) return;
      for (const a of ATTRS) if (root.hasAttribute(a)) this.attr(root, a);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeType === 3) this.node(n);
        else for (const a of ATTRS) if (n.hasAttribute(a)) this.attr(n, a);
      }
    },
    restore(root) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = root; n; n = w.nextNode()) {
        const r = orig.get(n);
        if (!r) continue;
        if (n.nodeType === 3) { if (n.nodeValue === r.th) n.nodeValue = r.en; }
        else for (const a of ATTRS) { const x = r['a:' + a]; if (x && n.getAttribute(a) === x.th) n.setAttribute(a, x.en); }
      }
    },

    // Small switch used on the title menu and in Settings: [data-lang-toggle]
    switchHtml() {
      return `<span class="lang-sw" role="group" aria-label="Language"><button class="lang-b ${this.lang === 'en' ? 'on' : ''}" data-lang="en">EN</button><button class="lang-b ${this.lang === 'th' ? 'on' : ''}" data-lang="th">ไทย</button></span>`;
    },
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) { I.set(b.dataset.lang); document.querySelectorAll('.lang-b').forEach((x) => x.classList.toggle('on', x.dataset.lang === I.lang)); }
  });
})(window.ND);
