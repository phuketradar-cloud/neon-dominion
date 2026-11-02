// Canvas renderer for the 10×10 city grid. Reads game state; never mutates it.
(function (ND) {
  const MODES = {
    owner: 'Ownership',
    influence: 'Your influence',
    security: 'Security',
    economy: 'Economic value',
  };
  ND.MAP_MODES = MODES;

  class MapView {
    constructor(canvas, handlers) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.h = handlers;
      this.hover = -1;
      this.mode = 'owner';
      this.size = 0;
      canvas.addEventListener('mousemove', (e) => { this.hover = this.hit(e); this.h.onHover(this.hover, e); });
      canvas.addEventListener('mouseleave', () => { this.hover = -1; this.h.onHover(-1, null); });
      canvas.addEventListener('click', (e) => { const id = this.hit(e); if (id >= 0) this.h.onSelect(id); });
    }

    resize() {
      const r = this.c.parentElement.getBoundingClientRect();
      const size = Math.max(280, Math.floor(Math.min(r.width, r.height) - 12));
      const dpr = window.devicePixelRatio || 1;
      this.c.style.width = size + 'px';
      this.c.style.height = size + 'px';
      this.c.width = size * dpr;
      this.c.height = size * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.size = size;
      this.ox = this.oy = 18;
      this.cell = (size - 18) / 10;
    }

    hit(e) {
      const r = this.c.getBoundingClientRect();
      const x = e.clientX - r.left - this.ox, y = e.clientY - r.top - this.oy;
      if (x < 0 || y < 0) return -1;
      const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
      return cx > 9 || cy > 9 ? -1 : cy * 10 + cx;
    }

    draw(g, sel, moveSet, hintCell) {
      const ctx = this.ctx, S = this.cell, p = g.player, pc = ND.FDEF[p].color;
      const battleAt = new Set(g.battles.filter((b) => b.turn === g.turn - 1 && ND.Combat.visibleTo(g, b, p)).map((b) => b.d));
      // Visible unit counts per district, by faction.
      const unitsAt = {};
      for (const u of Object.values(g.units)) {
        if (!ND.Units.visibleTo(g, u, p)) continue;
        const m = (unitsAt[u.loc] = unitsAt[u.loc] || {});
        m[u.fid] = (m[u.fid] || 0) + 1;
      }
      ctx.clearRect(0, 0, this.size, this.size);
      ctx.font = '11px "Share Tech Mono", monospace';
      ctx.fillStyle = '#4d5b6e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 10; i++) {
        ctx.fillText(String.fromCharCode(65 + i), this.ox + i * S + S / 2, 9);
        ctx.fillText(String(i + 1), 8, this.oy + i * S + S / 2);
      }
      const maxVal = Math.max(...g.districts.map((d) => ND.Econ.baseValue(d) * ND.RULES.devMult[d.dev - 1]));

      for (const d of g.districts) {
        const x = this.ox + d.x * S + 1.5, y = this.oy + d.y * S + 1.5, w = S - 3;
        const oc = d.owner ? ND.FDEF[d.owner].color : null;
        ctx.fillStyle = '#0b0f15';
        ctx.fillRect(x, y, w, w);

        if (this.mode === 'owner') {
          if (oc) { ctx.fillStyle = ND.hexA(oc, 0.28); ctx.fillRect(x, y, w, w); }
          else {
            const lead = ND.Inf.leader(d);
            if (lead) this.stripes(x, y, w, ND.hexA(ND.FDEF[lead].color, 0.06 + ND.Inf.get(d, lead) / 400));
          }
        } else if (this.mode === 'influence') {
          ctx.fillStyle = ND.hexA(pc, (ND.Inf.get(d, p) / 100) * 0.75);
          ctx.fillRect(x, y, w, w);
        } else if (this.mode === 'security') {
          ctx.fillStyle = `rgba(224,56,74,${(d.security / 100) * 0.75})`;
          ctx.fillRect(x, y, w, w);
        } else if (this.mode === 'economy') {
          ctx.fillStyle = `rgba(227,178,60,${(ND.Econ.baseValue(d) * ND.RULES.devMult[d.dev - 1] / maxVal) * 0.7})`;
          ctx.fillRect(x, y, w, w);
        }

        const px = Math.max(1, Math.floor((w * 0.4) / 8));
        ND.drawGlyph(ctx, d.type, Math.round(x + (w - 8 * px) / 2), Math.round(y + w * 0.26), px, oc || '#5a6a80');

        if (w > 44) {
          ctx.font = `${Math.max(9, Math.floor(w / 7.5))}px "Share Tech Mono", monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#aab6c6';
          ctx.fillText(d.name.split(' ')[0].slice(0, 9), x + 3, y + 2);
        }

        // Influence bar: each faction's share, remainder unaligned.
        const bh = Math.max(3, Math.floor(w / 15)), by = y + w - bh;
        ctx.fillStyle = '#1b222c';
        ctx.fillRect(x, by, w, bh);
        let bx = x;
        for (const fid of g.order) {
          const v = ND.Inf.get(d, fid);
          if (!v) continue;
          ctx.fillStyle = ND.FDEF[fid].color;
          ctx.fillRect(bx, by, (w * v) / 100, bh);
          bx += (w * v) / 100;
        }
        // Development pips
        ctx.fillStyle = '#e3b23c';
        for (let i = 0; i < d.dev - 1; i++) ctx.fillRect(x + w - 6 - i * 6, by - 6, 4, 4);

        if (d.hq) {
          const hc = ND.FDEF[d.hq].color, cx = x + w - 9, cy = y + 8;
          ctx.fillStyle = hc;
          ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 5, cy); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#05070a'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
        } else if (ND.Inf.contested(d)) {
          ctx.fillStyle = '#ff3b4e';
          ctx.beginPath(); ctx.moveTo(x + w - 3, y + 3); ctx.lineTo(x + w - 3, y + 11); ctx.lineTo(x + w - 11, y + 3); ctx.closePath(); ctx.fill();
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = oc ? ND.hexA(oc, 0.3) : '#1f2834';
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, w - 1);

        // Unit markers: one chip per faction present, yours first.
        const here = unitsAt[d.id];
        if (here && w > 30) {
          const fids = Object.keys(here).sort((a, b) => (b === p) - (a === p));
          const cw = Math.max(12, Math.floor(w / 4.2)), ch = Math.max(10, Math.floor(w / 6));
          ctx.font = `bold ${Math.max(8, ch - 2)}px "Share Tech Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          fids.slice(0, 3).forEach((fid, i) => {
            const cx = x + 2 + i * (cw + 2), cy = by - ch - 2;
            ctx.fillStyle = '#05070a';
            ctx.fillRect(cx, cy, cw, ch);
            ctx.strokeStyle = ND.FDEF[fid].color;
            ctx.lineWidth = fid === p ? 1.5 : 1;
            ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
            ctx.fillStyle = ND.FDEF[fid].color;
            ctx.fillText('▲' + here[fid], cx + cw / 2, cy + ch / 2 + 0.5);
          });
        }

        // Crossed blades where a battle you could see was fought last turn.
        if (battleAt.has(d.id) && w > 30) {
          const s = Math.max(10, Math.floor(w / 5)), bx0 = x + 3, by0 = y + w * 0.26;
          ctx.strokeStyle = '#ff3b4e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx0, by0); ctx.lineTo(bx0 + s, by0 + s);
          ctx.moveTo(bx0 + s, by0); ctx.lineTo(bx0, by0 + s);
          ctx.stroke();
        }

        if (moveSet && moveSet.has(d.id)) {
          ctx.fillStyle = 'rgba(140,255,58,0.14)';
          ctx.fillRect(x, y, w, w);
          ctx.strokeStyle = 'rgba(140,255,58,0.85)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2, y + 2, w - 4, w - 4);
        } else if (!g.over && g.factions[p].alive && d.owner !== p && ND.World.reachable(g, p, d)) {
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = ND.hexA(pc, 0.6);
          ctx.strokeRect(x + 3.5, y + 3.5, w - 7, w - 7);
          ctx.setLineDash([]);
        }
      }

      // Territory borders: a glowing edge wherever ownership changes, drawn just inside the owner's cell.
      if (this.mode === 'owner') {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.lineCap = 'square';
        for (const d of g.districts) {
          if (!d.owner) continue;
          const col = ND.FDEF[d.owner].color;
          const x0 = this.ox + d.x * S + 2.5, y0 = this.oy + d.y * S + 2.5, x1 = x0 + S - 5, y1 = y0 + S - 5;
          const edges = [[0, -1, x0, y0, x1, y0], [1, 0, x1, y0, x1, y1], [0, 1, x0, y1, x1, y1], [-1, 0, x0, y0, x0, y1]];
          ctx.strokeStyle = col;
          ctx.shadowColor = col;
          ctx.shadowBlur = 6;
          for (const [dx, dy, ax, ay, bx, by2] of edges) {
            const n = ND.World.at(g, d.x + dx, d.y + dy);
            if (n && n.owner === d.owner) continue;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by2); ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Tutorial pointer: pulsing yellow ring around one district.
      if (hintCell != null && g.districts[hintCell]) {
        const d = g.districts[hintCell];
        const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 180);
        ctx.save();
        ctx.strokeStyle = `rgba(255,210,63,${pulse})`;
        ctx.shadowColor = '#ffd23f';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.ox + d.x * S + S / 2, this.oy + d.y * S + S / 2, S * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (this.hover >= 0 && this.hover !== sel) {
        const d = g.districts[this.hover];
        ctx.strokeStyle = 'rgba(200,215,230,0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(this.ox + d.x * S + 1.5, this.oy + d.y * S + 1.5, S - 3, S - 3);
      }
      if (sel >= 0) {
        const d = g.districts[sel];
        ctx.save();
        ctx.shadowColor = pc;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.ox + d.x * S + 1, this.oy + d.y * S + 1, S - 2, S - 2);
        ctx.restore();
      }
    }

    stripes(x, y, w, color) {
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, w); ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = -w; i < w; i += 7) { ctx.beginPath(); ctx.moveTo(x + i, y + w); ctx.lineTo(x + i + w, y); ctx.stroke(); }
      ctx.restore();
    }
  }
  ND.MapView = MapView;
})(window.ND);
