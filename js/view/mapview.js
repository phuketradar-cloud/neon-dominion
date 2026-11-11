// Canvas renderer for the 10×10 city grid. Reads game state; never mutates it.
// Static tiles are painted into an offscreen cache on draw(); a light animation loop composites the cache with
// the animated layer (selection glow, hover, tutorial pointer) so hovering never repaints the whole city.
(function (ND) {
  const MODES = {
    owner: 'Ownership',
    influence: 'Your influence',
    economy: 'Economy',
    security: 'Security',
    facilities: 'Facilities',
  };
  ND.MAP_MODES = MODES;
  const MODE_HELP = {
    owner: 'Territory colours by controlling faction.',
    influence: 'Brighter = more of your influence in the district.',
    economy: 'Brighter = higher income value.',
    security: 'Redder = higher security (harder to influence).',
    facilities: 'How many of the district\'s facilities you hold.',
  };
  ND.MAP_MODE_HELP = MODE_HELP;

  const rr = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };

  class MapView {
    constructor(canvas, handlers) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.cache = document.createElement('canvas');
      this.cctx = this.cache.getContext('2d');
      this.h = handlers;
      this.hover = -1;
      this.mode = 'owner';
      this.size = 0;
      this.sel = -1;
      this.selAt = 0;
      this.hint = null;
      this.g = null;
      canvas.addEventListener('mousemove', (e) => { this.hover = this.hit(e); this.h.onHover(this.hover, e); });
      canvas.addEventListener('mouseleave', () => { this.hover = -1; this.h.onHover(-1, null); });
      canvas.addEventListener('click', (e) => { const id = this.hit(e); if (id >= 0) this.h.onSelect(id); });
      const loop = () => { this.frame(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }

    resize() {
      const r = this.c.parentElement.getBoundingClientRect();
      // Cells may be up to 1.4x wider than tall so the map fills wide screens; the grid stays 10x10.
      const pad = 22;
      const ch = Math.max(26, Math.floor((r.height - 16 - pad) / 10));
      const cw = Math.max(26, Math.min(Math.floor((r.width - 16 - pad) / 10), Math.floor(ch * 1.4)));
      const W = cw * 10 + pad, H = ch * 10 + pad;
      const dpr = window.devicePixelRatio || 1;
      this.dpr = dpr;
      this.c.style.width = W + 'px';
      this.c.style.height = H + 'px';
      for (const cv of [this.c, this.cache]) { cv.width = W * dpr; cv.height = H * dpr; }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.W = W; this.H = H; this.size = Math.max(W, H);
      this.ox = this.oy = 20;
      this.cw = cw; this.ch = ch;
      this.cell = Math.min(cw, ch);
    }

    hit(e) {
      const r = this.c.getBoundingClientRect();
      const x = e.clientX - r.left - this.ox, y = e.clientY - r.top - this.oy;
      if (x < 0 || y < 0) return -1;
      const cx = Math.floor(x / this.cw), cy = Math.floor(y / this.ch);
      return cx > 9 || cy > 9 ? -1 : cy * 10 + cx;
    }

    tileBox(d) {
      const gap = Math.max(3, this.cell * 0.06);
      return { x: this.ox + d.x * this.cw + gap / 2, y: this.oy + d.y * this.ch + gap / 2, w: this.cw - gap, h: this.ch - gap };
    }

    // Repaint the static layer, then the visible canvas.
    draw(g, sel, moveSet, hintCell) {
      this.g = g;
      if (sel !== this.sel) { this.sel = sel; this.selAt = performance.now(); }
      this.hint = hintCell;
      this.paint(this.cctx, g, moveSet);
      this.frame(true);
    }

    paint(ctx, g, moveSet) {
      const S = this.cell, CW = this.cw, CH = this.ch, p = g.player, pc = ND.FDEF[p].color;
      ctx.clearRect(0, 0, this.W, this.H);
      // axis labels
      ctx.font = `600 ${Math.max(11, Math.round(S / 6.5))}px Rajdhani, sans-serif`;
      ctx.fillStyle = '#6f8196';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 10; i++) {
        ctx.fillText(String.fromCharCode(65 + i), this.ox + i * CW + CW / 2, 10);
        ctx.fillText(String(i + 1), 9, this.oy + i * CH + CH / 2);
      }
      const battleAt = new Set(g.battles.filter((b) => b.turn === g.turn - 1 && ND.Combat.visibleTo(g, b, p)).map((b) => b.d));
      const unitsAt = {};
      for (const u of Object.values(g.units)) {
        if (!ND.Units.visibleTo(g, u, p)) continue;
        const m = (unitsAt[u.loc] = unitsAt[u.loc] || {});
        m[u.fid] = (m[u.fid] || 0) + 1;
      }
      const val = (d) => ND.Econ.baseValue(d) * ND.RULES.devMult[d.dev - 1];
      const maxVal = Math.max(...g.districts.map(val));

      for (const d of g.districts) {
        const { x, y, w, h } = this.tileBox(d);
        const s = Math.min(w, h);
        const oc = d.owner ? ND.FDEF[d.owner].color : null;
        const rad = Math.max(4, s * 0.09);

        // tile body with depth
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = s * 0.08; ctx.shadowOffsetY = s * 0.03;
        const base = ctx.createLinearGradient(0, y, 0, y + h);
        base.addColorStop(0, '#21334d'); base.addColorStop(1, '#111a29');
        ctx.fillStyle = base; rr(ctx, x, y, w, h, rad); ctx.fill();
        ctx.restore();
        ctx.save();
        rr(ctx, x, y, w, h, rad); ctx.clip();

        // overlay modes
        let heat = null, heatCol = null;
        if (this.mode === 'owner') {
          if (oc) {
            const t = ctx.createLinearGradient(0, y, 0, y + h);
            t.addColorStop(0, ND.hexA(oc, 0.1)); t.addColorStop(1, ND.hexA(oc, 0.34));
            ctx.fillStyle = t; ctx.fillRect(x, y, w, h);
          } else {
            const lead = ND.Inf.leader(d);
            if (lead) this.stripes(ctx, x, y, w, h, ND.hexA(ND.FDEF[lead].color, 0.05 + ND.Inf.get(d, lead) / 500));
          }
        } else if (this.mode === 'influence') { heat = ND.Inf.get(d, p) / 100; heatCol = pc; }
        else if (this.mode === 'security') { heat = d.security / 100; heatCol = '#e45b68'; }
        else if (this.mode === 'economy') { heat = val(d) / maxVal; heatCol = '#e8c063'; }
        else if (this.mode === 'facilities') {
          heat = d.facilities.length ? d.facilities.filter((f) => f.owner === p).length / d.facilities.length : 0; heatCol = pc;
        }
        if (heat != null) { ctx.fillStyle = ND.hexA(heatCol, 0.08 + heat * 0.62); ctx.fillRect(x, y, w, h); }

        // street glow + building (unowned blocks glow a cool night-city blue)
        const light = oc || '#5aaef0';
        const ground = y + h * 0.66;
        const halo = ctx.createRadialGradient(x + w / 2, ground, 1, x + w / 2, ground, w * 0.5);
        halo.addColorStop(0, ND.hexA(light, oc ? 0.26 : 0.13)); halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, ground, w, h * 0.04);
        ND.drawBuilding(ctx, d.type, x + w / 2, ground, s * 0.62, light, d.id + 7);
        if (d.disrupted > 0) { ctx.fillStyle = 'rgba(10,14,20,.55)'; ctx.fillRect(x, y, w, h); }
        ctx.restore();

        // name
        if (s > 40) {
          ctx.font = `600 ${Math.max(10, Math.floor(s / 6.4))}px Rajdhani, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#dbe5ef';
          ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 3;
          ctx.fillText(d.name.split(' ')[0].slice(0, 12), x + w / 2, y + h * 0.84);
          ctx.shadowBlur = 0;
        }

        // influence bar
        const bh = Math.max(4, Math.round(s / 15)), bx0 = x + w * 0.1, bw = w * 0.8, by = y + h - bh - Math.max(3, s * 0.05);
        ctx.save(); rr(ctx, bx0, by, bw, bh, bh / 2); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(bx0, by, bw, bh);
        let bx = bx0;
        for (const fid of g.order) {
          const v = ND.Inf.get(d, fid);
          if (!v) continue;
          ctx.fillStyle = ND.FDEF[fid].color; ctx.fillRect(bx, by, (bw * v) / 100, bh); bx += (bw * v) / 100;
        }
        ctx.restore();

        // facility pips (top right), one per facility, coloured by holder
        const fp = Math.max(4, Math.round(s / 13));
        d.facilities.forEach((fc, i) => {
          const px = x + w - (i + 1) * (fp + 2) - 3, py = y + 4;
          ctx.fillStyle = fc.owner ? ND.FDEF[fc.owner].color : 'rgba(150,170,195,.25)';
          rr(ctx, px, py, fp, fp, 1.5); ctx.fill();
        });

        // development pips (right of bar, above it)
        for (let i = 0; i < d.dev - 1; i++) {
          const px = x + w * 0.9 - (i + 1) * (fp + 2), py = by - fp - 3;
          ctx.fillStyle = '#e8c063';
          ctx.beginPath(); ctx.moveTo(px + fp / 2, py); ctx.lineTo(px + fp, py + fp / 2); ctx.lineTo(px + fp / 2, py + fp); ctx.lineTo(px, py + fp / 2); ctx.closePath(); ctx.fill();
        }

        // HQ crown (top left) or sector code
        if (d.hq) {
          const hc = ND.FDEF[d.hq].color, cs = Math.max(10, s * 0.2), cx0 = x + 4, cy0 = y + 4;
          ctx.save(); ctx.shadowColor = hc; ctx.shadowBlur = 8; ctx.fillStyle = hc;
          ctx.beginPath(); ctx.moveTo(cx0, cy0 + cs * 0.8); ctx.lineTo(cx0, cy0 + cs * 0.25); ctx.lineTo(cx0 + cs * 0.3, cy0 + cs * 0.5);
          ctx.lineTo(cx0 + cs * 0.5, cy0); ctx.lineTo(cx0 + cs * 0.7, cy0 + cs * 0.5); ctx.lineTo(cx0 + cs, cy0 + cs * 0.25); ctx.lineTo(cx0 + cs, cy0 + cs * 0.8); ctx.closePath(); ctx.fill();
          ctx.restore();
        } else if (s > 48) {
          ctx.font = `500 ${Math.max(9, Math.floor(s / 9))}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(160,178,198,.55)';
          ctx.fillText(ND.World.sector(d), x + 5, y + 4);
        }

        // contested marker
        if (!d.hq && ND.Inf.contested(d)) {
          ctx.fillStyle = '#e45b68';
          const cs = Math.max(7, s * 0.13);
          ctx.beginPath(); ctx.moveTo(x + 2, y + h - 2); ctx.lineTo(x + 2, y + h - 2 - cs); ctx.lineTo(x + 2 + cs, y + h - 2); ctx.closePath(); ctx.fill();
        }

        // unit chips
        const here = unitsAt[d.id];
        if (here && s > 30) {
          const fids = Object.keys(here).sort((a, b) => (b === p) - (a === p));
          const ch = Math.max(12, Math.floor(s / 5.6)), cw = ch * 1.55;
          ctx.font = `700 ${Math.max(9, ch - 4)}px "IBM Plex Mono", monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          fids.slice(0, 3).forEach((fid, i) => {
            const cx = x + 3 + i * (cw + 2), cy = by - ch - 3;
            ctx.fillStyle = 'rgba(11,17,26,.92)'; rr(ctx, cx, cy, cw, ch, ch / 2); ctx.fill();
            ctx.strokeStyle = ND.FDEF[fid].color; ctx.lineWidth = fid === p ? 1.6 : 1; ctx.stroke();
            ctx.fillStyle = ND.FDEF[fid].color; ctx.fillText('●' + here[fid], cx + cw / 2, cy + ch / 2 + 0.5);
          });
        }

        // battle last turn
        if (battleAt.has(d.id) && s > 30) {
          const bs = Math.max(10, Math.floor(s / 5.5)), bx1 = x + w - bs - 4, by1 = y + h * 0.22;
          ctx.strokeStyle = '#e45b68'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(bx1, by1); ctx.lineTo(bx1 + bs, by1 + bs); ctx.moveTo(bx1 + bs, by1); ctx.lineTo(bx1, by1 + bs); ctx.stroke();
          ctx.lineCap = 'butt';
        }

        // frame
        ctx.lineWidth = 1;
        ctx.strokeStyle = oc ? ND.hexA(oc, 0.5) : 'rgba(110,170,230,.22)';
        rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, rad); ctx.stroke();

        if (moveSet && moveSet.has(d.id)) {
          ctx.fillStyle = 'rgba(117,201,138,.16)'; rr(ctx, x, y, w, h, rad); ctx.fill();
          ctx.strokeStyle = 'rgba(117,201,138,.95)'; ctx.lineWidth = 2; rr(ctx, x + 2, y + 2, w - 4, h - 4, rad); ctx.stroke();
        } else if (!g.over && g.factions[p].alive && d.owner !== p && ND.World.reachable(g, p, d)) {
          ctx.setLineDash([4, 4]); ctx.strokeStyle = ND.hexA(pc, 0.7); ctx.lineWidth = 1.4;
          rr(ctx, x + 3, y + 3, w - 6, h - 6, rad); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // territory borders where ownership changes
      if (this.mode === 'owner') {
        ctx.save(); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        for (const d of g.districts) {
          if (!d.owner) continue;
          const col = ND.FDEF[d.owner].color, x0 = this.ox + d.x * CW + 1, y0 = this.oy + d.y * CH + 1, x1 = x0 + CW - 2, y1 = y0 + CH - 2;
          ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 5;
          for (const [dx, dy, ax, ay, bx2, by2] of [[0, -1, x0, y0, x1, y0], [1, 0, x1, y0, x1, y1], [0, 1, x0, y1, x1, y1], [-1, 0, x0, y0, x0, y1]]) {
            const n = ND.World.at(g, d.x + dx, d.y + dy);
            if (n && n.owner === d.owner) continue;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // Animated layer: composite cache + hover + selection glow + tutorial pointer.
    frame(force) {
      if (!this.g || !this.size) return;
      const now = performance.now();
      if (!force && now - (this.lastFrame || 0) < 33) return; // ~30 fps is plenty for glows
      this.lastFrame = now;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.drawImage(this.cache, 0, 0, this.W, this.H);
      const g = this.g, pc = ND.FDEF[g.player].color;
      if (this.hover >= 0 && this.hover !== this.sel && g.districts[this.hover]) {
        const { x, y, w, h } = this.tileBox(g.districts[this.hover]);
        ctx.fillStyle = 'rgba(255,255,255,.06)'; rr(ctx, x, y, w, h, h * 0.09); ctx.fill();
        ctx.strokeStyle = 'rgba(226,234,242,.55)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h * 0.09); ctx.stroke();
      }
      if (this.sel >= 0 && g.districts[this.sel]) {
        const { x, y, w, h } = this.tileBox(g.districts[this.sel]);
        const k = Math.min(1, (now - this.selAt) / 220), grow = (1 - k) * h * 0.12;
        const pulse = 0.6 + 0.4 * Math.sin(now / 320);
        ctx.save();
        ctx.shadowColor = pc; ctx.shadowBlur = 10 + 10 * pulse;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4;
        rr(ctx, x - 1 - grow, y - 1 - grow, w + 2 + grow * 2, h + 2 + grow * 2, h * 0.1); ctx.stroke();
        // corner brackets in faction colour
        ctx.shadowBlur = 0; ctx.strokeStyle = pc; ctx.lineWidth = 3;
        const c = h * 0.22, o = 4;
        for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const px = x - o + sx * (w + o * 2), py = y - o + sy * (h + o * 2), dx = sx ? -c : c, dy = sy ? -c : c;
          ctx.beginPath(); ctx.moveTo(px + dx, py); ctx.lineTo(px, py); ctx.lineTo(px, py + dy); ctx.stroke();
        }
        ctx.restore();
      }
      if (this.hint != null && g.districts[this.hint]) {
        const d = g.districts[this.hint];
        const pulse = 0.55 + 0.45 * Math.sin(now / 180);
        ctx.save();
        ctx.strokeStyle = `rgba(255,210,63,${pulse})`; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(this.ox + d.x * this.cw + this.cw / 2, this.oy + d.y * this.ch + this.ch / 2, this.cw * 0.64, this.ch * 0.64, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    stripes(ctx, x, y, w, h, color) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      for (let i = -h; i < w; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
      ctx.restore();
    }
  }
  ND.MapView = MapView;
})(window.ND);
