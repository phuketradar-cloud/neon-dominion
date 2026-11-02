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
