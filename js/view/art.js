// Pixel art: 8×8 district glyphs and procedural 16×16 faction leader portraits.
(function (ND) {
  ND.GLYPHS = {
    residential: ['..####..', '.######.', '.#.##.#.', '.######.', '.#.##.#.', '.######.', '.##..##.', '.##..##.'],
    industrial: ['#.......', '#.......', '#...#..#', '#..##.##', '#.######', '########', '#.#.#.##', '########'],
    research: ['..####..', '...##...', '...##...', '..#..#..', '.#....#.', '.#.##.#.', '#.####.#', '########'],
    blackmarket: ['...##...', '.######.', '##.##...', '.#####..', '...##.#.', '...##.##', '.######.', '...##...'],
    casino: ['...##...', '..####..', '.##..##.', '##.##.##', '##.##.##', '.##..##.', '..####..', '...##...'],
    hospital: ['..####..', '..#..#..', '###..###', '#......#', '#......#', '###..###', '..#..#..', '..####..'],
    police: ['########', '#......#', '#..##..#', '#.####.#', '#..##..#', '.#....#.', '..#..#..', '...##...'],
    power: ['....###.', '...###..', '..###...', '.######.', '...###..', '..###...', '.##.....', '#.......'],
    military: ['...##...', '.#.##.#.', '#..##..#', '########', '########', '#..##..#', '.#.##.#.', '...##...'],
    corporate: ['...##...', '...##...', '..####..', '..#..#..', '..####..', '.#.##.#.', '.######.', '########'],
  };

  ND.hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  ND.drawGlyph = (ctx, type, x, y, px, color) => {
    const G = ND.GLYPHS[type];
    ctx.fillStyle = color;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (G[r][c] === '#') ctx.fillRect(x + c * px, y + r * px, px, px);
  };

  // ---------- Vector building illustrations (map tiles, district hero) ----------
  // Draws a night-time silhouette of the district type standing on `ground`, centred on cx, `s` wide.
  // `light` colours windows/signs (controller colour, or a cool grey when unaligned). `seed` varies lit windows.
  ND.drawBuilding = (ctx, type, cx, ground, s, light, seed = 1) => {
    const u = s / 10, L = cx - s / 2;
    const X = (x) => L + x * u, Y = (y) => ground - y * u;
    const body = '#0e1621', edge = '#2c3c52';
    let h = (seed * 2654435761) >>> 0;
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
    const rect = (x, y, w, hh, c = body) => { ctx.fillStyle = c; ctx.fillRect(X(x), Y(y + hh), w * u, hh * u); };
    const outline = (x, y, w, hh) => { ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1, u * 0.18); ctx.strokeRect(X(x), Y(y + hh), w * u, hh * u); };
    const block = (x, y, w, hh) => { rect(x, y, w, hh); outline(x, y, w, hh); };
    const windows = (x, y, w, hh, cols, rows, density = 0.55) => {
      const cw = w / cols, rh = hh / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const on = rnd() < density;
        ctx.fillStyle = on ? light : 'rgba(120,140,165,.12)';
        ctx.globalAlpha = on ? 0.55 + rnd() * 0.45 : 1;
        ctx.fillRect(X(x + i * cw + cw * 0.25), Y(y + j * rh + rh * 0.75), cw * 0.5 * u, rh * 0.45 * u);
      }
      ctx.globalAlpha = 1;
    };
    const poly = (pts, c = body, stroke = true) => {
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py)))); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); if (stroke) { ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1, u * 0.18); ctx.stroke(); }
    };
    const glow = (fn, blur = 1.2) => { ctx.save(); ctx.shadowColor = light; ctx.shadowBlur = u * blur * 4; fn(); ctx.restore(); };
    const dot = (x, y, r, c = light) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(x), Y(y), r * u, 0, Math.PI * 2); ctx.fill(); };
    ctx.save();
    switch (type) {
      case 'residential':
        block(0.6, 0, 3.6, 8.2); windows(0.6, 0.4, 3.6, 7.4, 3, 6);
        block(4.6, 0, 2.6, 6.2); windows(4.6, 0.4, 2.6, 5.4, 2, 5);
        block(7.5, 0, 2, 4.4); windows(7.5, 0.4, 2, 3.6, 2, 3);
        rect(1.8, 8.2, 0.25, 1.1, edge); dot(1.92, 9.4, 0.18, '#ff5566');
        break;
      case 'industrial':
        poly([[0.4, 0], [0.4, 3.6], [2.2, 5], [2.2, 3.6], [4, 5], [4, 3.6], [5.8, 5], [5.8, 3.6], [6.6, 3.6], [6.6, 0]]);
        block(6.9, 0, 1.2, 8); block(8.4, 0, 1, 6);
        windows(0.6, 0.6, 5.8, 2.2, 5, 2, 0.7);
        ctx.globalAlpha = 0.18; dot(7.6, 8.9, 0.7, '#c9d6e6'); dot(8.3, 9.6, 0.9, '#c9d6e6'); dot(7.4, 10.2, 0.6, '#c9d6e6'); ctx.globalAlpha = 1;
        glow(() => dot(7.5, 8.15, 0.16));
        break;
      case 'research':
        block(0.8, 0, 8.4, 3.2); windows(0.8, 0.4, 8.4, 2.4, 7, 2, 0.6);
        ctx.beginPath(); ctx.arc(X(5), Y(3.2), 2.8 * u, Math.PI, 0); ctx.closePath(); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
        glow(() => { ctx.strokeStyle = light; ctx.lineWidth = u * 0.3; ctx.beginPath(); ctx.arc(X(5), Y(3.2), 1.9 * u, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); });
        rect(4.9, 6, 0.2, 3.2, edge); glow(() => dot(5, 9.4, 0.28));
        break;
      case 'blackmarket':
        for (let i = 0; i < 3; i++) {
          const x = 0.5 + i * 3.1;
          block(x, 0, 2.7, 2.6); windows(x, 0.3, 2.7, 1.8, 2, 1, 0.8);
          poly([[x - 0.2, 2.6], [x + 1.35, 3.9], [x + 2.9, 2.6]], i % 2 ? '#2a1f33' : '#33241c');
          glow(() => dot(x + 1.35, 3.3, 0.22));
        }
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = u * 0.08; ctx.beginPath(); ctx.moveTo(X(0.5), Y(4.6)); ctx.quadraticCurveTo(X(5), Y(3.9), X(9.6), Y(4.6)); ctx.stroke();
        for (let i = 0; i < 6; i++) glow(() => dot(1 + i * 1.6, 4.35 - Math.sin((i / 5) * Math.PI) * 0.3, 0.13), 0.8);
        break;
      case 'casino':
        block(1.2, 0, 7.6, 5.6); windows(1.2, 0.6, 7.6, 2.6, 6, 2, 0.75);
        for (let i = 0; i < 9; i++) glow(() => dot(1.6 + i * 0.85, 4.2, 0.17), 0.8);
        glow(() => poly([[5, 9.6], [6.6, 7.6], [5, 5.6], [3.4, 7.6]], light, false), 2);
        poly([[5, 8.9], [6, 7.6], [5, 6.3], [4, 7.6]], body, false);
        break;
      case 'hospital':
        block(0.8, 0, 8.4, 5.4); windows(0.8, 0.5, 8.4, 3, 7, 3, 0.7);
        rect(2.5, 5.4, 5, 0.5, edge);
        glow(() => { ctx.fillStyle = light; ctx.fillRect(X(4.55), Y(8.8), 0.9 * u, 2.8 * u); ctx.fillRect(X(3.6), Y(7.85), 2.8 * u, 0.9 * u); }, 1.6);
        break;
      case 'police':
        block(0.8, 0, 8.4, 4.6); for (let i = 0; i < 5; i++) rect(1.4 + i * 1.7, 0, 0.5, 3.6, '#1a2636');
        poly([[0.5, 4.6], [5, 6.2], [9.5, 4.6]]);
        glow(() => poly([[5, 9.5], [6.4, 8.9], [6.1, 7.4], [5, 6.6], [3.9, 7.4], [3.6, 8.9]], light, false), 1.6);
        glow(() => dot(1.4, 5.1, 0.25, '#ff4d5e'), 1.2); glow(() => dot(8.6, 5.1, 0.25, '#4da3ff'), 1.2);
        break;
      case 'power':
        poly([[0.6, 0], [1.4, 4], [1, 7.6], [4.6, 7.6], [4.2, 4], [5, 0]]);
        ctx.globalAlpha = 0.2; dot(2.8, 8.6, 1.1, '#c9d6e6'); dot(3.8, 9.6, 0.9, '#c9d6e6'); ctx.globalAlpha = 1;
        block(5.6, 0, 3.8, 4.2); windows(5.6, 0.5, 3.8, 1.6, 3, 1, 0.8);
        glow(() => poly([[7.9, 7.6], [6.8, 5.6], [7.5, 5.6], [7, 4.4], [8.3, 6.2], [7.6, 6.2]], light, false), 1.8);
        break;
      case 'military':
        poly([[0.3, 0], [1.2, 3.4], [8.8, 3.4], [9.7, 0]]);
        for (let i = 0; i < 4; i++) glow(() => { ctx.fillStyle = light; ctx.fillRect(X(2 + i * 1.7), Y(2.2), 1 * u, 0.35 * u); }, 0.8);
        rect(6.9, 3.4, 0.3, 3.4, edge);
        ctx.beginPath(); ctx.arc(X(7.05), Y(7.6), 1.4 * u, Math.PI * 0.9, Math.PI * 1.9); ctx.strokeStyle = '#3c5068'; ctx.lineWidth = u * 0.35; ctx.stroke();
        glow(() => dot(7.05, 7.6, 0.2));
        rect(2.4, 3.4, 0.18, 2.6, edge); poly([[2.58, 6], [4, 5.5], [2.58, 5]], light, false);
        break;
      case 'corporate':
      default:
        block(1.6, 0, 2, 5); block(6.4, 0, 2, 4); windows(1.6, 0.4, 2, 4.2, 2, 4); windows(6.4, 0.4, 2, 3.2, 2, 3);
        poly([[3.6, 0], [3.6, 8.4], [5, 10], [6.4, 8.4], [6.4, 0]]);
        for (let j = 0; j < 8; j++) { ctx.fillStyle = light; ctx.globalAlpha = 0.35 + (j % 3) * 0.2; ctx.fillRect(X(4), Y(1 + j), 2 * u, 0.28 * u); }
        ctx.globalAlpha = 1; glow(() => dot(5, 10.1, 0.22, '#ff5566'));
        break;
    }
    ctx.restore();
  };

  // District hero art for the side panel: dusk sky, distant skyline, the building, a wet street reflection.
  ND.drawDistrictHero = (canvas, d, light) => {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0f1826'); sky.addColorStop(0.7, '#1b2a3e'); sky.addColorStop(1, '#0b111a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(W / 2, H * 0.78, 4, W / 2, H * 0.78, W * 0.55);
    halo.addColorStop(0, ND.hexA(light, 0.28)); halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    // distant skyline
    const g = { rng: ND.hashStr(d.name) };
    ctx.fillStyle = '#16212f';
    for (let x = 0; x < W; ) { const w = 10 + ND.rand(g) * 22, h = H * (0.25 + ND.rand(g) * 0.35); ctx.fillRect(x, H * 0.82 - h, w, h); x += w + 2; }
    ctx.fillStyle = 'rgba(160,190,220,.12)';
    for (let i = 0; i < 40; i++) ctx.fillRect(ND.rand(g) * W, H * (0.3 + ND.rand(g) * 0.45), 2, 2);
    const s = Math.min(W * 0.5, H * 0.95);
    ND.drawBuilding(ctx, d.type, W / 2, H * 0.84, s, light, d.id + 7);
    // street + reflection
    ctx.fillStyle = '#0a0f17'; ctx.fillRect(0, H * 0.84, W, H * 0.16);
    const refl = ctx.createLinearGradient(0, H * 0.84, 0, H);
    refl.addColorStop(0, ND.hexA(light, 0.22)); refl.addColorStop(1, 'transparent');
    ctx.fillStyle = refl; ctx.fillRect(W / 2 - s / 2, H * 0.84, s, H * 0.16);
  };

  ND.glyphCanvas = (type, color, px = 3) => {
    const c = document.createElement('canvas');
    c.width = c.height = 8 * px;
    ND.drawGlyph(c.getContext('2d'), type, 0, 0, px, color);
    return c;
  };

  // Left half of a 16×16 bust; mirrored. h=hair, s=skin, e=eye, m=mouth, n=neck, c=collar.
  const BUST = [
    '........', '.....hhh', '...hhhhh', '..hhhhhh', '..hsssss', '..ssssss', '..ssesss', '..ssssss',
    '...sssss', '...sssss', '....sssm', '.....sss', '......nn', '..cccccc', '.ccccccc', 'cccccccc',
  ];

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  ND.drawPortrait = (canvas, fid) => {
    const F = ND.FDEF[fid];
    ND.drawBust(canvas, { seed: F.leader, color: F.color, ...F.portrait });
  };

  ND.drawUnitPortrait = (canvas, u) => {
    ND.drawBust(canvas, { seed: u.name, color: ND.FDEF[u.fid].color, skin: u.skin, hair: u.hair, accent: ND.UNIT_TYPES[u.type].accent });
  };

  // spec: { seed, color, skin, hair, accent }
  ND.drawBust = (canvas, P) => {
    const F = { color: P.color };
    const ctx = canvas.getContext('2d');
    const N = 16, px = Math.floor(canvas.width / N);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#05070a');
    grad.addColorStop(1, ND.hexA(F.color, 0.35));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const g = { rng: ND.hashStr(P.seed) };
    const pal = { h: P.hair, s: P.skin, e: F.color, m: shade(P.skin, 0.55), n: shade(P.skin, 0.8), c: shade(F.color, 0.45) };
    const put = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x * px, y * px, px, px); };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < 8; x++) {
        const ch = BUST[y][x];
        if (ch === '.') continue;
        let col = pal[ch];
        if (ch === 's' && x === 2) col = shade(P.skin, 0.75); // cheek shadow
        put(x, y, col);
        put(N - 1 - x, y, ch === 's' && x === 2 ? shade(P.skin, 0.9) : col);
      }
    }
    // Faction-specific accents
    const acc = P.accent;
    if (acc === 'shades') { for (let x = 3; x <= 12; x++) put(x, 6, '#0a0a0a'); put(4, 6, F.color); put(11, 6, F.color); }
    if (acc === 'visor') { for (let x = 2; x <= 13; x++) put(x, 6, F.color); for (let x = 3; x <= 12; x++) put(x, 5, shade(F.color, 0.4)); }
    if (acc === 'helmet') { for (let x = 2; x <= 13; x++) { put(x, 3, '#7b8794'); put(x, 4, '#55606c'); } put(2, 5, '#55606c'); put(13, 5, '#55606c'); for (let x = 2; x <= 13; x++) put(x, 1 + (x > 4 && x < 11 ? 1 : 2), '#7b8794'); }
    if (acc === 'growth') { for (let i = 0; i < 6; i++) put(ND.randInt(g, 9, 13), ND.randInt(g, 3, 10), F.color); put(5, 9, shade(P.skin, 0.6)); }
    if (acc === 'hood') { for (let y = 1; y <= 12; y++) { put(1, y, '#1a1426'); put(14, y, '#1a1426'); if (y < 5) for (let x = 2; x <= 13; x++) put(x, y, '#1a1426'); } }
    if (acc === 'mohawk') { for (let y = 0; y <= 3; y++) { put(7, y, F.color); put(8, y, F.color); } for (let x = 2; x <= 13; x++) if (x < 6 || x > 9) put(x, 3, P.skin); }
    // Seeded scar and cybernetic implant so individuals are distinguishable
    if (ND.rand(g) < 0.4) { const sx = ND.randInt(g, 4, 6); put(sx, 7, shade(P.skin, 0.6)); put(sx + 1, 8, shade(P.skin, 0.6)); }
    put(12, 7, F.color); put(13, 8, shade(F.color, 0.7));
    // Collar trim
    for (let x = 0; x < N; x++) if (ctx.getImageData(x * px + 1, 13 * px + 1, 1, 1).data[3]) put(x, 13, shade(F.color, 0.8));
  };
})(window.ND);
