// Faction identity: insignias (SVG for UI, Path2D for canvas), faction visual themes, and illustrated vector
// portraits for leaders and units. Overrides the pixel-art ND.drawPortrait / ND.drawUnitPortrait from art.js.
(function (ND) {
  // 24×24 insignia paths. Filled shapes (evenodd) so they read at any size.
  ND.EMBLEMS = {
    // The Syndicate: a crowned diamond — a criminal corporation's seal.
    syndicate: 'M12 2 20 9 12 22 4 9Z M12 6.2 7.6 9.4 12 17.6 16.4 9.4Z M6 3l2.5 2.4L12 2l3.5 3.4L18 3l-.8 3.6H6.8Z',
    // Iron Legion: a shield split by a sword.
    legion: 'M12 2 20.5 5v6.5c0 5-3.6 9-8.5 10.5C7.1 20.5 3.5 16.5 3.5 11.5V5Z M11 5.5v9.2l-2.2-1.6v2.1L11 17v2h2v-2l2.2-1.8v-2.1L13 14.7V5.5Z',
    // Cyber Cult: an all-seeing eye inside a triangle.
    cult: 'M12 2 22.5 20.5h-21Z M12 8.6c-3 0-5.3 2.6-6.1 4 .8 1.4 3.1 4 6.1 4s5.3-2.6 6.1-4c-.8-1.4-3.1-4-6.1-4Z M12 10.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
    // Bio Mutants: three-lobed biohazard bloom.
    mutants: 'M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z M12 1.8c2.8 1.4 3.6 4.6 2.4 6.9A4 4 0 0 0 12 8a4 4 0 0 0-2.4.7C8.4 6.4 9.2 3.2 12 1.8Z M3.1 18.2c-.2-3.1 2.2-5.4 4.8-5.5a4 4 0 0 0 1.3 2.2 4 4 0 0 0 2.3 1.2c-.3 2.6-3 4.6-8.4 2.1Z M20.9 18.2c-5.4 2.5-8.1.5-8.4-2.1a4 4 0 0 0 2.3-1.2 4 4 0 0 0 1.3-2.2c2.6.1 5 2.4 4.8 5.5Z',
    // Shadow Network: a crescent mask with a single slit eye.
    shadow: 'M12 2.5a9.5 9.5 0 1 0 9.5 9.5A7.6 7.6 0 0 1 12 2.5Z M7 11.2c1.6-1.3 3.9-1.3 5.5 0-1.6 1.3-3.9 1.3-5.5 0Z',
    // Street Reapers: a grinning skull over crossed blades.
    reapers: 'M12 2.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.6 5v3h2v-1.8h1.4V17h3v-1.3h1.4V17h2v-3c1.5-1 2.6-2.6 2.6-5 0-4-3.1-6.5-7.5-6.5Z M8.6 8.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z M15.4 8.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z M12 11.6l1.2 2.1h-2.4Z M3 21.5l3.5-3.5 1.1 1.1-3.5 3.5Z M21 21.5l-3.5-3.5-1.1 1.1 3.5 3.5Z',
  };

  // Visual theme per faction: background tone, secondary accent, architectural mood (used by the map).
  ND.FACTION_THEME = {
    syndicate: { bg: '#2a2210', accent2: '#fff1c2', style: 'gilded', tagline: 'Old money. New crimes.' },
    legion: { bg: '#2a1214', accent2: '#ffb3a8', style: 'fortified', tagline: 'Order through steel.' },
    cult: { bg: '#0d262b', accent2: '#c8fbff', style: 'holo', tagline: 'Upload your soul.' },
    mutants: { bg: '#18260f', accent2: '#e4ffb8', style: 'organic', tagline: 'Evolve or rot.' },
    shadow: { bg: '#1c1430', accent2: '#e2d4ff', style: 'veiled', tagline: 'Nothing to see here.' },
    reapers: { bg: '#2b170a', accent2: '#ffd9b5', style: 'graffiti', tagline: 'Our block. Our rules.' },
  };

  const pathCache = {};
  ND.emblemPath = (fid) => (pathCache[fid] = pathCache[fid] || new Path2D(ND.EMBLEMS[fid]));
  ND.emblemSvg = (fid, cls = '', color) => `<svg class="emblem ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${color || ND.FDEF[fid].color}" fill-rule="evenodd" d="${ND.EMBLEMS[fid]}"/></svg>`;
  // Draw an insignia centred at (x, y) with the given size on a canvas.
  ND.drawEmblem = (ctx, fid, x, y, size, color, glow) => {
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    if (glow) { ctx.shadowColor = color || ND.FDEF[fid].color; ctx.shadowBlur = glow; }
    ctx.fillStyle = color || ND.FDEF[fid].color;
    ctx.fill(ND.emblemPath(fid), 'evenodd');
    ctx.restore();
  };

  // ---------- Illustrated portraits ----------
  const SKIN = ['#f1c9a5', '#d9a77f', '#b98160', '#8d5a3e', '#6a4130', '#e8b894'];
  const HAIR = ['#14100e', '#3b2516', '#6b3e1f', '#c79a52', '#e9e2d6', '#3a3f4d', '#7a1f3d'];
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  // spec: { seed, fid, skin, hair, accent, role }  role: 'leader' | unit type key
  ND.drawFigure = (canvas, spec) => {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    const F = ND.FDEF[spec.fid], col = F.color, TH = ND.FACTION_THEME[spec.fid];
    const r = { rng: ND.hashStr(spec.seed + '|p') }, rnd = () => ND.rand(r), pick = (a) => a[Math.floor(rnd() * a.length)];
    const u = W / 100; // design units: 100 × (H/W*100)
    const skin = spec.skin && !/^#(8fae6a|9fb3a0)/.test(spec.skin) ? spec.skin : spec.role === 'mutant' || spec.fid === 'mutants' && spec.role === 'leader' ? '#8fbf6a' : pick(SKIN);
    const hair = spec.hair || pick(HAIR);
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    // backdrop: faction-tinted room light + insignia watermark
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.38, W * 0.05, W * 0.5, H * 0.45, W * 0.85);
    bg.addColorStop(0, shade(col, 0.55)); bg.addColorStop(0.55, TH.bg); bg.addColorStop(1, '#0c111a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.12; ND.drawEmblem(ctx, spec.fid, W * 0.78, H * 0.22, W * 0.42, col); ctx.globalAlpha = 1;
    // city bokeh
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = ND.hexA(i % 2 ? col : '#ffffff', 0.08 + rnd() * 0.1);
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H * 0.6, (2 + rnd() * 6) * u, 0, Math.PI * 2); ctx.fill();
    }
    const cx = W * 0.5, headY = H * 0.43, hw = 21 * u, hh = 26 * u;
    const role = spec.role;
    // --- torso / outfit ---
    const coat = shade(col, role === 'leader' ? 0.42 : 0.3);
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(cx - 46 * u, H); ctx.quadraticCurveTo(cx - 44 * u, headY + 34 * u, cx - 15 * u, headY + 28 * u);
    ctx.lineTo(cx + 15 * u, headY + 28 * u); ctx.quadraticCurveTo(cx + 44 * u, headY + 34 * u, cx + 46 * u, H); ctx.closePath(); ctx.fill();
    // lapels / armor plates by role
    if (role === 'heavy' || role === 'cyber') {
      ctx.fillStyle = shade('#8a99aa', role === 'heavy' ? 0.75 : 0.95);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * 30 * u, headY + 40 * u, 17 * u, 10 * u, s * 0.35, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = col; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(cx - 12 * u, headY + 50 * u); ctx.lineTo(cx + 12 * u, headY + 50 * u); ctx.stroke();
    } else if (role === 'mutant') {
      ctx.fillStyle = '#5d7d3f';
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx + s * (22 + i * 7) * u, headY + 33 * u); ctx.lineTo(cx + s * (26 + i * 7) * u, headY + 22 * u); ctx.lineTo(cx + s * (30 + i * 7) * u, headY + 34 * u); ctx.fill(); }
    } else {
      ctx.fillStyle = shade(col, 0.6);
      ctx.beginPath(); ctx.moveTo(cx - 15 * u, headY + 28 * u); ctx.lineTo(cx - 4 * u, headY + 60 * u); ctx.lineTo(cx - 20 * u, headY + 40 * u); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 15 * u, headY + 28 * u); ctx.lineTo(cx + 4 * u, headY + 60 * u); ctx.lineTo(cx + 20 * u, headY + 40 * u); ctx.fill();
      if (role === 'leader') { ctx.fillStyle = '#e9edf2'; ctx.beginPath(); ctx.moveTo(cx - 6 * u, headY + 28 * u); ctx.lineTo(cx, headY + 46 * u); ctx.lineTo(cx + 6 * u, headY + 28 * u); ctx.fill(); ctx.fillStyle = col; ctx.fillRect(cx - 1.5 * u, headY + 30 * u, 3 * u, 14 * u); }
    }
    // collar insignia
    ND.drawEmblem(ctx, spec.fid, cx + 26 * u, headY + 46 * u, 9 * u, col, 6 * u);
    // --- neck & head ---
    ctx.fillStyle = shade(skin, 0.82); ctx.fillRect(cx - 7 * u, headY + 14 * u, 14 * u, 16 * u);
    const face = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    face.addColorStop(0, shade(skin, 0.78)); face.addColorStop(0.45, skin); face.addColorStop(1, shade(skin, 0.85));
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.ellipse(cx, headY, hw * 0.92, hh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - hw * 0.85, headY + 6 * u); ctx.quadraticCurveTo(cx, headY + hh * 1.45, cx + hw * 0.85, headY + 6 * u); ctx.fill(); // jaw
    // rim light in faction colour
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
    ctx.strokeStyle = ND.hexA(col, 0.65); ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); ctx.ellipse(cx, headY, hw * 0.92, hh, 0, -0.9, 0.9); ctx.stroke();
    // ears
    ctx.fillStyle = shade(skin, 0.88);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * hw * 0.93, headY + 2 * u, 3.4 * u, 5.5 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    // --- hair styles ---
    const style = role === 'assassin' || (role === 'leader' && spec.fid === 'shadow') ? 'hood'
      : role === 'heavy' || (role === 'leader' && spec.fid === 'legion') ? 'helmet'
        : role === 'merc' || (role === 'leader' && spec.fid === 'reapers') ? pick(['mohawk', 'buzz', 'mohawk'])
          : pick(['short', 'long', 'bun', 'buzz', 'side', 'bald']);
    ctx.fillStyle = hair;
    if (style === 'short' || style === 'side' || style === 'bun' || style === 'long') {
      ctx.beginPath(); ctx.ellipse(cx, headY - hh * 0.45, hw * 0.98, hh * 0.62, 0, Math.PI, 0); ctx.fill();
      if (style === 'side') { ctx.beginPath(); ctx.moveTo(cx - hw, headY - 8 * u); ctx.quadraticCurveTo(cx + 4 * u, headY - hh * 1.2, cx + hw * 1.05, headY + 4 * u); ctx.lineTo(cx + hw * 0.7, headY - 10 * u); ctx.fill(); }
      if (style === 'bun') { ctx.beginPath(); ctx.arc(cx, headY - hh - 4 * u, 7 * u, 0, Math.PI * 2); ctx.fill(); }
      if (style === 'long') { ctx.fillRect(cx - hw * 1.02, headY - 8 * u, 6 * u, hh * 1.4); ctx.fillRect(cx + hw * 1.02 - 6 * u, headY - 8 * u, 6 * u, hh * 1.4); }
    } else if (style === 'buzz') {
      ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(cx, headY - hh * 0.4, hw * 0.94, hh * 0.6, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
    } else if (style === 'mohawk') {
      ctx.fillStyle = spec.fid === 'reapers' ? col : hair;
      ctx.beginPath(); ctx.moveTo(cx - 5 * u, headY - hh * 0.75); ctx.lineTo(cx, headY - hh * 1.55); ctx.lineTo(cx + 5 * u, headY - hh * 0.75); ctx.fill();
      ctx.fillRect(cx - 4 * u, headY - hh * 1.1, 8 * u, hh * 0.5);
    } else if (style === 'helmet') {
      ctx.fillStyle = '#5b6878';
      ctx.beginPath(); ctx.ellipse(cx, headY - hh * 0.3, hw * 1.1, hh * 0.85, 0, Math.PI * 1.02, -0.02); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(cx - hw * 1.05, headY - 6 * u, hw * 2.1, 2.6 * u);
    } else if (style === 'hood') {
      ctx.fillStyle = '#1a1726';
      ctx.beginPath(); ctx.moveTo(cx - hw * 1.45, H * 0.82); ctx.quadraticCurveTo(cx - hw * 1.5, headY - hh * 1.5, cx, headY - hh * 1.3);
      ctx.quadraticCurveTo(cx + hw * 1.5, headY - hh * 1.5, cx + hw * 1.45, H * 0.82); ctx.lineTo(cx + hw * 0.95, H * 0.82);
      ctx.quadraticCurveTo(cx + hw * 1.05, headY - hh * 0.6, cx, headY - hh * 0.95); ctx.quadraticCurveTo(cx - hw * 1.05, headY - hh * 0.6, cx - hw * 0.95, H * 0.82); ctx.fill();
    }
    // --- eyes, brows, nose, mouth ---
    const eyeY = headY + 1 * u, ex = 8.5 * u;
    const accent = spec.accent;
    const glowEyes = role === 'cyber' || role === 'hacker' || accent === 'visor';
    if (accent === 'visor' || role === 'hacker' || role === 'cyber') {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8 * u;
      ctx.fillStyle = ND.hexA(col, 0.9); ctx.beginPath(); ctx.moveTo(cx - hw * 0.95, eyeY - 4 * u); ctx.lineTo(cx + hw * 0.95, eyeY - 4 * u); ctx.lineTo(cx + hw * 0.85, eyeY + 4 * u); ctx.lineTo(cx - hw * 0.85, eyeY + 4 * u); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cx - hw * 0.7, eyeY - 2.5 * u, hw * 0.5, 1.2 * u);
    } else if (accent === 'shades' || role === 'agent') {
      ctx.fillStyle = '#0c0f14';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * ex, eyeY, 7 * u, 4.6 * u, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillRect(cx - 3 * u, eyeY - 1 * u, 6 * u, 1.5 * u);
      ctx.fillStyle = ND.hexA(col, 0.8); for (const s of [-1, 1]) ctx.fillRect(cx + s * ex - 4 * u, eyeY - 2.5 * u, 3 * u, 1.2 * u);
    } else {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#f4f2ee'; ctx.beginPath(); ctx.ellipse(cx + s * ex, eyeY, 4.6 * u, 2.6 * u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = glowEyes ? col : pick(['#3b2a1a', '#2d4a6b', '#3c5a2c', '#5a3a2a']);
        ctx.beginPath(); ctx.arc(cx + s * ex + 0.6 * u, eyeY, 2.1 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(cx + s * ex + 0.6 * u, eyeY, 1 * u, 0, Math.PI * 2); ctx.fill();
      }
    }
    // cybernetic eye on one side for some
    if (role === 'cyber' || role === 'heavy' || rnd() < 0.3) {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6 * u; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx + ex, eyeY, 2.6 * u, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = ND.hexA(col, 0.8); ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.moveTo(cx + ex + 5 * u, eyeY); ctx.lineTo(cx + hw * 0.9, eyeY + 6 * u); ctx.lineTo(cx + hw * 0.9, eyeY + 14 * u); ctx.stroke();
    }
    ctx.strokeStyle = shade(hair, 0.9); ctx.lineWidth = 1.8 * u; ctx.lineCap = 'round';
    const browTilt = role === 'heavy' || role === 'assassin' || role === 'mutant' ? 2 : rnd() < 0.5 ? 1 : -0.5;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * (ex - 5 * u), eyeY - 6 * u + browTilt * u); ctx.lineTo(cx + s * (ex + 5 * u), eyeY - 6.5 * u - browTilt * 0.6 * u); ctx.stroke(); }
    ctx.strokeStyle = shade(skin, 0.68); ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.moveTo(cx, eyeY + 3 * u); ctx.lineTo(cx - 2 * u, eyeY + 10 * u); ctx.lineTo(cx + 1.5 * u, eyeY + 11 * u); ctx.stroke();
    // expression: smirk, grim line, or grin (slightly humorous)
    const mood = role === 'merc' || spec.fid === 'reapers' ? 'grin' : role === 'heavy' || spec.fid === 'legion' ? 'grim' : pick(['smirk', 'smirk', 'grim', 'grin']);
    ctx.strokeStyle = shade(skin, 0.45); ctx.lineWidth = 1.8 * u; ctx.beginPath();
    const my = eyeY + 17 * u;
    if (mood === 'grin') { ctx.moveTo(cx - 6 * u, my - 1 * u); ctx.quadraticCurveTo(cx, my + 4 * u, cx + 6 * u, my - 1 * u); ctx.stroke(); ctx.fillStyle = '#f2efe8'; ctx.beginPath(); ctx.moveTo(cx - 5 * u, my - 0.6 * u); ctx.quadraticCurveTo(cx, my + 2.6 * u, cx + 5 * u, my - 0.6 * u); ctx.fill(); }
    else if (mood === 'smirk') { ctx.moveTo(cx - 5 * u, my); ctx.quadraticCurveTo(cx + 2 * u, my + 1.5 * u, cx + 6 * u, my - 2.5 * u); ctx.stroke(); }
    else { ctx.moveTo(cx - 5.5 * u, my + 0.5 * u); ctx.lineTo(cx + 5.5 * u, my + 0.5 * u); ctx.stroke(); }
    // marks: scar, face tattoo in faction colour, mutant growths
    if (rnd() < 0.35 || role === 'merc') { ctx.strokeStyle = shade(skin, 0.55); ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.moveTo(cx - ex - 3 * u, eyeY - 9 * u); ctx.lineTo(cx - ex + 1 * u, eyeY + 9 * u); ctx.stroke(); }
    if (spec.fid === 'reapers' || spec.fid === 'cult' || rnd() < 0.2) { ctx.fillStyle = ND.hexA(col, 0.75); for (let i = 0; i < 3; i++) ctx.fillRect(cx - hw * 0.75 + i * 2.4 * u, eyeY + 6 * u, 1.2 * u, 5 * u); }
    if (role === 'mutant' || (role === 'leader' && spec.fid === 'mutants')) { ctx.fillStyle = '#9fdc5a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + (6 + rnd() * 12) * u, headY - (6 + rnd() * 14) * u, (1.5 + rnd() * 2.5) * u, 0, Math.PI * 2); ctx.fill(); } }
    if (role === 'leader') { // a touch of status: gold earring / tie pin / crown of light
      ctx.fillStyle = TH.accent2; ctx.beginPath(); ctx.arc(cx - hw * 0.95, headY + 9 * u, 1.6 * u, 0, Math.PI * 2); ctx.fill();
    }
    // vignette + scan sheen
    const vig = ctx.createRadialGradient(cx, H * 0.45, W * 0.3, cx, H * 0.5, W * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  // Illustrated leader art (assets/factions/<fid>.webp, 4:5). fx/fy = face centre as a fraction of the image,
  // so every crop (tall hero, square card, wide roster strip) keeps the face in frame.
  const LEADER_ART = {
    syndicate: { fx: 0.51, fy: 0.19 }, legion: { fx: 0.57, fy: 0.17 }, cult: { fx: 0.51, fy: 0.21 },
    mutants: { fx: 0.57, fy: 0.15 }, shadow: { fx: 0.52, fy: 0.24 }, reapers: { fx: 0.57, fy: 0.15 },
  };
  const waiting = []; // canvases drawn with the vector fallback before their image finished loading
  for (const fid in LEADER_ART) {
    const img = new Image();
    img.onload = () => { for (const [cv, f] of waiting.splice(0)) if (cv.isConnected) ND.drawPortrait(cv, f); };
    img.src = `assets/factions/${fid}.webp`;
    LEADER_ART[fid].img = img;
  }
  const drawLeaderArt = (canvas, art) => {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, img = art.img;
    const iw = img.naturalWidth, ih = img.naturalHeight, ca = W / H;
    const zoom = ca > 1.3 ? 1.7 : ca > 0.9 ? 1.35 : 1; // small cards and strips zoom towards the face
    let vw = ca > iw / ih ? iw : ih * ca, vh = vw / ca;
    vw /= zoom; vh /= zoom;
    const faceAt = ca > 1.3 ? 0.45 : ca > 0.9 ? 0.4 : 0.3; // where the face sits in the crop, from the top
    const sx = Math.max(0, Math.min(iw - vw, art.fx * iw - vw / 2));
    const sy = Math.max(0, Math.min(ih - vh, art.fy * ih - vh * faceAt));
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, sx, sy, vw, vh, 0, 0, W, H);
  };

  ND.drawPortrait = (canvas, fid) => {
    const F = ND.FDEF[fid], art = LEADER_ART[fid];
    if (art && art.img.complete && art.img.naturalWidth) return drawLeaderArt(canvas, art);
    ND.drawFigure(canvas, { seed: F.leader, fid, role: 'leader', accent: F.portrait.accent, skin: F.portrait.skin, hair: F.portrait.hair });
    if (art) waiting.push([canvas, fid]);
  };
  ND.drawUnitPortrait = (canvas, u) => {
    ND.drawFigure(canvas, { seed: u.name, fid: u.fid, role: u.type, accent: ND.UNIT_TYPES[u.type].accent, skin: u.skin, hair: u.hair });
  };
  // "Jax "Razor" Moreno" → { first, nick, last }
  ND.splitName = (name) => {
    const m = /^(.*?)\s*"(.+?)"\s*(.*)$/.exec(name);
    return m ? { first: m[1], nick: m[2], last: m[3] } : { first: name, nick: '', last: '' };
  };
})(window.ND);
