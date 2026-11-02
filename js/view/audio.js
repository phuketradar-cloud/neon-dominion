// Audio manager: original music, city ambience and sound effects synthesised live with the Web Audio API, so the game
// ships no audio files. Optional recorded tracks can replace the synthesised music (ND.Audio.TRACK_FILES).
// Graph: voices → bus (music | sfx | ambient) → master → limiter → speakers; a shared reverb is fed by sends.
// The AudioContext is created only after the player's first click or key press (browser autoplay rules).
(function (ND) {
  const PREF_KEY = 'neon-dominion:audio';
  const DEFAULTS = { master: 0.8, music: 0.45, sfx: 0.75, ambient: 0.25, muted: false, musicOn: true, sfxOn: true, ambientOn: true };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SCALES = {
    aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  const deg = (scale, d) => { const n = SCALES[scale], o = Math.floor(d / 7); return n[((d % 7) + 7) % 7] + 12 * o; };

  // Each faction colours the faction-select and city music and owns a short signature motif.
  const FLAVOR = {
    syndicate: { root: 41, scale: 'dorian', arp: 'triangle', extra: 'bell', cutoff: 2600, motif: [0, 4, 7, 11], motifWave: 'triangle' },
    legion: { root: 38, scale: 'aeolian', arp: 'sawtooth', extra: 'metal', cutoff: 1500, motif: [0, 0, 7, 3], motifWave: 'sawtooth', snare: true },
    cult: { root: 44, scale: 'phrygian', arp: 'square', extra: 'glitch', cutoff: 3200, motif: [0, 1, 7, 12], motifWave: 'square' },
    mutants: { root: 37, scale: 'harmonic', arp: 'sawtooth', extra: 'wobble', cutoff: 1100, motif: [0, 3, 1, 6], motifWave: 'sawtooth' },
    shadow: { root: 39, scale: 'aeolian', arp: 'sine', extra: null, cutoff: 900, motif: [0, 7, 3, 2], motifWave: 'sine' },
    reapers: { root: 40, scale: 'aeolian', arp: 'sawtooth', extra: 'dist', cutoff: 1800, motif: [0, 3, 5, 0], motifWave: 'square', snare: true },
  };
  const NEUTRAL = { root: 38, scale: 'aeolian', arp: 'triangle', extra: null, cutoff: 1400 };

  // Music themes. Patterns are one bar of 16 steps: x = accent, o = soft, . = rest.
  const THEMES = {
    menu: (F) => ({ bpm: 68, root: 38, scale: 'aeolian', prog: [0, 5, 2, 6], barsPer: 2, padCut: 900, padVol: 0.08,
      bass: { pat: 'x...............', vol: 0.12, cut: 260 }, arp: { pat: 'o...o.....o.o...', vol: 0.035, wave: 'triangle', cut: 1600, prob: 0.8 },
      kick: 'o...............', kickVol: 0.18, extra: null }),
    select: (F) => ({ bpm: 96, root: F.root, scale: F.scale, prog: [0, 5, 3, 4], barsPer: 1, padCut: 1200, padVol: 0.06,
      bass: { pat: 'x.o.x.o.x.o.x.o.', vol: 0.1, cut: 420, dist: F.extra === 'dist' }, arp: { pat: 'x.o.o.x.o.o.x.o.', vol: 0.032, wave: F.arp, cut: F.cutoff, prob: 0.9 },
      kick: 'x.......x.......', kickVol: 0.22, hat: '..o...o...o...o.', hatVol: 0.025, snare: F.snare ? '....x.......x...' : '', snareVol: 0.08, extra: F.extra }),
    city: (F) => ({ bpm: 84, root: F.root, scale: F.scale, prog: [0, 5, 2, 6, 0, 3, 4, 4], barsPer: 2, padCut: 1000, padVol: 0.055,
      bass: { pat: 'x..o..x...o..o..', vol: 0.09, cut: 340, dist: F.extra === 'dist' }, arp: { pat: 'o..o..o...o..o..', vol: 0.026, wave: F.arp, cut: F.cutoff, prob: 0.6 },
      kick: 'o.......o.......', kickVol: 0.14, hat: '..o...o...o...o.', hatVol: 0.016, extra: F.extra }),
    battle: (F) => ({ bpm: 128, root: 40, scale: 'phrygian', prog: [0, 1, 0, 6], barsPer: 1, padCut: 1600, padVol: 0.04,
      bass: { pat: 'xoxoxoxoxoxoxoxo', vol: 0.09, cut: 600, dist: true }, arp: { pat: 'x..x..x.x..x..x.', vol: 0.03, wave: 'sawtooth', cut: 2200, prob: 1 },
      kick: 'x...x...x...x...', kickVol: 0.26, hat: 'oxoxoxoxoxoxoxox', hatVol: 0.022, snare: '....x.......x..o', snareVol: 0.12, extra: 'metal' }),
    victory: (F) => ({ bpm: 100, root: F.root || 41, scale: 'lydian', prog: [0, 4, 5, 3], barsPer: 2, padCut: 2400, padVol: 0.08,
      bass: { pat: 'x.......x.......', vol: 0.11, cut: 500 }, arp: { pat: 'x.o.x.o.x.o.xoxo', vol: 0.03, wave: 'triangle', cut: 3000, prob: 1 },
      kick: 'x.......x.......', kickVol: 0.2, snare: '........x.......', snareVol: 0.08, extra: 'bell' }),
    defeat: (F) => ({ bpm: 58, root: 36, scale: 'aeolian', prog: [0, 6, 5, 4], barsPer: 2, padCut: 700, padVol: 0.08,
      bass: { pat: 'x...............', vol: 0.13, cut: 220 }, arp: { pat: '........o.......', vol: 0.025, wave: 'sine', cut: 900, prob: 0.6 },
      kick: '', extra: null }),
  };

  let rngState = 1;
  const rnd = () => { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; };

  const A = (ND.Audio = {
    ctx: null,
    prefs: { ...DEFAULTS },
    bus: {},
    song: null, // the music theme playing now
    fading: [], // themes fading out
    musicKey: null,
    wanted: null, // { id, fid } requested before audio was unlocked
    amb: null,
    ambProfile: 'street',
    last: {},
    voices: 0,
    trackPos: {}, // playback position of recorded tracks, so returning to a screen continues the music
    // Recorded music used instead of the synthesised theme (null = synthesised). Title screens share one track.
    TRACK_FILES: {
      menu: 'assets/audio/music/opening.mp3', select: 'assets/audio/music/opening.mp3', city: 'assets/audio/music/gameplay.mp3',
      battle: null, victory: null, defeat: null,
    },
    // Mastered tracks are far louder than the synthesised score; trim them to sit at the same level in the mix
    // (measured: opening RMS 0.159, gameplay RMS 0.131; the synthesised themes run at about 0.055 before the buses).
    TRACK_GAIN: { 'assets/audio/music/opening.mp3': 0.35, 'assets/audio/music/gameplay.mp3': 0.42 },

    // ---------- setup ----------
    initialize() {
      try { Object.assign(this.prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* defaults */ }
      const unlock = () => this.unlockAudio();
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend(); else if (!this.prefs.muted) this.ctx.resume();
      });
      this.renderToggles();
    },
    // Called from a real user gesture only; never tries to start audio by itself.
    unlockAudio() {
      if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.unlockedAt = performance.now();
      const c = (this.ctx = new AC());
      const lim = c.createDynamicsCompressor();
      lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
      lim.connect(c.destination);
      this.bus.master = c.createGain(); this.bus.master.connect(lim);
      for (const k of ['music', 'sfx', 'ambient']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.bus.master); }
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024; lim.connect(this.analyser);
      // shared plate-like reverb from decaying noise
      const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.reverb = c.createConvolver(); this.reverb.buffer = ir;
      this.revIn = c.createGain(); this.revIn.gain.value = 0.5; this.revIn.connect(this.reverb); this.reverb.connect(this.bus.master);
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      this.applyVolumes(true);
      this.timer = setInterval(() => this.tick(), 25);
      if (this.wanted) { const w = this.wanted; this.wanted = null; this.playMusic(w.id, w.fid); }
      if (this.ambWanted) this.playAmbient();
      this.renderToggles();
    },
    get running() { return !!this.ctx && this.ctx.state === 'running'; },

    // ---------- volumes & preferences ----------
    save() { try { localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs)); } catch (e) { /* storage unavailable */ } },
    applyVolumes(now) {
      if (!this.ctx) return;
      const p = this.prefs, t = this.ctx.currentTime, set = (n, v) => (now ? (n.gain.value = v) : n.gain.setTargetAtTime(v, t, 0.06));
      set(this.bus.master, p.muted ? 0 : p.master);
      set(this.bus.music, p.musicOn ? p.music : 0);
      set(this.bus.sfx, p.sfxOn ? p.sfx : 0);
      set(this.bus.ambient, p.ambientOn ? p.ambient : 0);
    },
    setPref(k, v) {
      this.prefs[k] = v;
      this.save(); this.applyVolumes(); this.renderToggles();
      if (k === 'musicOn' && v && this.ctx && !this.song && this.musicKey) { const [id, fid] = this.musicKey.split('|'); this.musicKey = null; this.playMusic(id, fid || null); }
    },
    setMasterVolume(v) { this.setPref('master', v); },
    setMusicVolume(v) { this.setPref('music', v); },
    setSFXVolume(v) { this.setPref('sfx', v); },
    setAmbientVolume(v) { this.setPref('ambient', v); },
    mute() { this.setPref('muted', true); },
    unmute() { this.unlockAudio(); this.setPref('muted', false); if (this.ctx) this.ctx.resume(); },
    toggleMute() {
      if (this.ctx && performance.now() - this.unlockedAt < 600 && !this.prefs.muted) return; // this click just switched sound on
      if (this.prefs.muted || !this.ctx) this.unmute(); else this.mute();
    },
    // Speaker buttons ([data-audio-toggle]) show: off until the first click, then on / muted.
    renderToggles() {
      const st = !this.ctx ? 'locked' : this.prefs.muted ? 'muted' : 'on';
      document.querySelectorAll('[data-audio-toggle]').forEach((b) => {
        b.dataset.state = st;
        b.innerHTML = ND.icon(st === 'on' ? 'sound' : 'mute') + (b.dataset.label ? `<span>${st === 'locked' ? 'Click to enable sound' : st === 'muted' ? 'Sound off' : 'Sound on'}</span>` : '');
        b.title = st === 'locked' ? 'Sound starts after your first click' : st === 'muted' ? 'Unmute sound' : 'Mute sound';
      });
    },

    // ---------- music ----------
    // id: menu | select | city | battle | victory | defeat; fid gives faction colour where the theme uses it.
    playMusic(id, fid) {
      const key = id + '|' + (fid || '');
      if (!this.ctx) { this.wanted = { id, fid }; return; }
      if (this.musicKey === key && (this.song || !this.prefs.musicOn)) return; // never start a second copy
      this.musicKey = key;
      if (!this.prefs.musicOn) { this.stopMusic(0.8); return; }
      this.crossfadeMusic(id, fid, id === 'battle' ? 1.2 : id === 'victory' || id === 'defeat' ? 0.6 : 2.2);
    },
    crossfadeMusic(id, fid, dur) {
      const old = this.song, url = this.TRACK_FILES[id];
      if (url && old instanceof FileSong && old.url === url) return; // same recording (menu → faction select): keep playing
      if (old) { old.fadeOut(dur); this.fading.push(old); }
      const back = url && this.fading.find((s) => s instanceof FileSong && s.url === url && s !== old);
      if (back) { // still fading out (e.g. a quick look at Battles): bring it back instead of restarting
        this.fading = this.fading.filter((s) => s !== back);
        back.endAt = Infinity; this.song = back; back.fadeIn(dur);
        return;
      }
      this.song = url ? new FileSong(this, url) : new Song(this, THEMES[id](FLAVOR[fid] || NEUTRAL), id);
      this.song.fadeIn(dur);
      if (id === 'battle') this.sfx('impact', { force: true });
      if (id === 'victory') this.sfx('victoryHit', { force: true });
      if (id === 'defeat') this.sfx('defeatHit', { force: true });
    },
    stopMusic(dur = 1.5) {
      if (this.song) { this.song.fadeOut(dur); this.fading.push(this.song); this.song = null; }
    },
    tick() {
      if (!this.running) return;
      const until = this.ctx.currentTime + 0.15;
      if (this.song) this.song.tick(until);
      this.fading = this.fading.filter((s) => { if (s.done()) { s.dispose(); return false; } s.tick(until); return true; });
    },

    // ---------- sound effects ----------
    // Throttled per name and capped overall so rapid clicks never pile up.
    sfx(name, o = {}) {
      if (!this.running || !this.prefs.sfxOn || this.prefs.muted) return;
      const fn = SFX[name];
      if (!fn) return;
      const now = performance.now(), gap = name === 'hover' ? 70 : 55;
      if (!o.force && now - (this.last[name] || 0) < gap) return;
      if (!o.force && this.voices > 10) return;
      this.last[name] = now;
      this.voices++;
      setTimeout(() => this.voices--, 450);
      fn(this.ctx.currentTime + (o.delay || 0) + 0.005, o);
    },

    // ---------- ambience ----------
    playAmbient() {
      this.ambWanted = true;
      if (!this.ctx || this.amb) return;
      const c = this.ctx, out = c.createGain(); out.gain.value = 0; out.connect(this.bus.ambient);
      out.gain.setTargetAtTime(1, c.currentTime, 1.2);
      const loop = (filterType, f, q, vol) => {
        const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const fl = c.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q;
        const gn = c.createGain(); gn.gain.value = vol;
        s.connect(fl); fl.connect(gn); gn.connect(out); s.start();
        return { s, fl, gn };
      };
      const rumble = loop('lowpass', 130, 0.7, 0.55), vent = loop('bandpass', 520, 0.6, 0.12), air = loop('highpass', 5200, 0.5, 0.012);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.08; lfo.connect(lg); lg.connect(vent.gn.gain); lfo.start();
      const hum = [55, 110, 165].map((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = [0.03, 0.016, 0.008][i]; o.connect(g); g.connect(out); o.start(); return { o, g }; });
      this.amb = { out, rumble, vent, air, lfo, hum, timer: null };
      this.setAmbientProfile(this.ambProfile, true);
      const next = () => { if (!this.amb) return; this.ambientEvent(); this.amb.timer = setTimeout(next, 2500 + Math.random() * 6500); };
      this.amb.timer = setTimeout(next, 3000);
    },
    stopAmbient() {
      this.ambWanted = false;
      const a = this.amb;
      if (!a) return;
      this.amb = null;
      clearTimeout(a.timer);
      const t = this.ctx.currentTime;
      a.out.gain.setTargetAtTime(0, t, 0.5);
      setTimeout(() => { [a.rumble.s, a.vent.s, a.air.s, a.lfo, ...a.hum.map((h) => h.o)].forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); a.out.disconnect(); }, 3000);
    },
    // Profiles follow the district type in focus: industrial machinery, tech hum, street traffic, civic sirens.
    PROFILE_OF: { industrial: 'industrial', power: 'industrial', military: 'industrial', research: 'tech', corporate: 'tech',
      residential: 'street', casino: 'street', blackmarket: 'street', hospital: 'civic', police: 'civic' },
    setAmbientProfile(type, force) {
      const p = this.PROFILE_OF[type] || type || 'street';
      if (p === this.ambProfile && !force) return;
      this.ambProfile = p;
      if (!this.amb) return;
      const t = this.ctx.currentTime, a = this.amb;
      const L = { industrial: [0.75, 0.2, 1.4], tech: [0.4, 0.1, 1.1], street: [0.55, 0.12, 0.7], civic: [0.5, 0.12, 0.8] }[p];
      a.rumble.gn.gain.setTargetAtTime(L[0], t, 1.5);
      a.vent.gn.gain.setTargetAtTime(L[1], t, 1.5);
      a.hum.forEach((h, i) => h.g.gain.setTargetAtTime([0.03, 0.016, 0.008][i] * L[2], t, 1.5));
    },
    ambientEvent() {
      if (!this.running || !this.amb || !this.prefs.ambientOn) return;
      const W = { industrial: { machine: 5, traffic: 1, siren: 1, radio: 1, chirp: 1 }, tech: { chirp: 5, radio: 2, traffic: 1, machine: 1, siren: 0.5 },
        street: { traffic: 5, radio: 2, siren: 1.5, chirp: 1, machine: 0.5 }, civic: { siren: 4, radio: 3, traffic: 2, chirp: 1, machine: 0.5 } }[this.ambProfile];
      let r = Math.random() * Object.values(W).reduce((s, x) => s + x, 0), pick = 'traffic';
      for (const k in W) if ((r -= W[k]) < 0) { pick = k; break; }
      AMB[pick](this.ctx.currentTime + 0.05, this.amb.out);
    },
  });

  // ---------- synthesis helpers ----------
  const C = () => A.ctx;
  // envelope: attack a, peak v, exponential decay over d
  const env = (p, t, a, v, d) => { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); p.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const panTo = (node, pan, out) => { if (!pan || !C().createStereoPanner) { node.connect(out); return; } const p = C().createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(out); };
  // tone: { f, f2 (glide target), w, a, v, d, lp|bp|hp, q, det, out, rv (reverb send), pan }
  const tone = (t, o) => {
    const c = C(), osc = c.createOscillator();
    osc.type = o.w || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.g || o.d || 0.1));
    if (o.det) osc.detune.value = o.det;
    let n = osc;
    if (o.lp || o.bp || o.hp) { const fl = c.createBiquadFilter(); fl.type = o.lp ? 'lowpass' : o.bp ? 'bandpass' : 'highpass'; fl.frequency.value = o.lp || o.bp || o.hp; fl.Q.value = o.q || 0.7; n.connect(fl); n = fl; }
    const gn = c.createGain(), a = o.a || 0.005, d = o.d || 0.15;
    env(gn.gain, t, a, o.v || 0.1, d);
    n.connect(gn);
    panTo(gn, o.pan, o.out || A.bus.sfx);
    if (o.rv) { const s = c.createGain(); s.gain.value = o.rv; gn.connect(s); s.connect(A.revIn); }
    osc.start(t); osc.stop(t + a + d + 0.05);
    return osc;
  };
  // noise: { a, v, d, type, f, f2, q, out, rv, pan }
  const noise = (t, o) => {
    const c = C(), s = c.createBufferSource();
    s.buffer = A.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1000, t); fl.Q.value = o.q || 0.8;
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + (o.g || o.d || 0.2));
    const gn = c.createGain(), a = o.a || 0.003, d = o.d || 0.1;
    env(gn.gain, t, a, o.v || 0.1, d);
    s.connect(fl); fl.connect(gn);
    panTo(gn, o.pan, o.out || A.bus.sfx);
    if (o.rv) { const r = c.createGain(); r.gain.value = o.rv; gn.connect(r); r.connect(A.revIn); }
    s.start(t, Math.random()); s.stop(t + a + d + 0.05);
  };
  const kick = (t, v = 0.3, out) => tone(t, { f: 140, f2: 40, g: 0.12, w: 'sine', a: 0.002, v, d: 0.32, out });
  const notes = (t, list, o) => list.forEach((m, i) => tone(t + i * (o.step || 0.07), { ...o, f: mtof(m) }));
  const metal = (t, v, out) => { noise(t, { f: 3300, q: 14, v, d: 0.35, out, rv: 0.2 }); tone(t, { f: 233, w: 'square', v: v * 0.25, d: 0.18, lp: 2400, out }); };
  let shaper = null;
  const dist = () => {
    if (shaper && shaper.context === C()) return shaper;
    shaper = C().createWaveShaper();
    const k = 18, n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    shaper.curve = curve;
    return shaper;
  };

  // ---------- generative music ----------
  class Song {
    constructor(au, def, id) {
      const c = au.ctx;
      this.def = def; this.id = id;
      this.out = c.createGain(); this.out.gain.value = 0.0001; this.out.connect(au.bus.music);
      this.delay = c.createDelay(1); this.delay.delayTime.value = (60 / def.bpm) * 0.75;
      const fb = c.createGain(); fb.gain.value = 0.32; this.delay.connect(fb); fb.connect(this.delay);
      const wet = c.createGain(); wet.gain.value = 0.3; this.delay.connect(wet); wet.connect(this.out);
      this.send = c.createGain(); this.send.gain.value = 0.35; this.out.connect(this.send); this.send.connect(au.revIn);
      this.step = 0; this.next = c.currentTime + 0.08; this.endAt = Infinity; this.arpI = 0;
      if (def.bass.dist) { // the shaper adds a lot of gain, so trim after it to keep the mix level
        this.drive = c.createWaveShaper(); this.drive.curve = dist().curve;
        const trim = c.createGain(); trim.gain.value = 0.16; this.drive.connect(trim); trim.connect(this.out);
      }
    }
    fadeIn(dur) { const t = A.ctx.currentTime; this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(0.0001, t); this.out.gain.exponentialRampToValueAtTime(1, t + dur); }
    fadeOut(dur) { const t = A.ctx.currentTime; this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t); this.out.gain.exponentialRampToValueAtTime(0.0001, t + dur); this.endAt = t + dur + 0.1; }
    done() { return A.ctx.currentTime > this.endAt + 2.5; } // let tails ring out
    dispose() { try { this.out.disconnect(); this.send.disconnect(); this.delay.disconnect(); } catch (e) { /* gone */ } }
    tick(until) {
      const spb = 60 / this.def.bpm / 4, now = A.ctx.currentTime;
      if (this.next < now - 0.05) this.next = now + 0.05; // after a suspend, skip instead of bunching notes
      while (this.next < until && this.next < this.endAt) { this.play(this.step, this.next, spb); this.next += spb; this.step++; }
    }
    play(step, t, spb) {
      const D = this.def, s = step % 16, bar = Math.floor(step / 16), out = this.out;
      const chordDeg = D.prog[Math.floor(bar / D.barsPer) % D.prog.length];
      const note = (d, oct) => D.root + deg(D.scale, chordDeg + d) + 12 * oct;
      const hit = (pat) => pat && pat[s] && pat[s] !== '.' ? (pat[s] === 'x' ? 1 : 0.55) : 0;
      if (s === 0 && bar % D.barsPer === 0) this.pad(t, [note(0, 1), note(2, 1), note(4, 1)], D.barsPer * 16 * spb);
      let h = hit(D.bass.pat);
      if (h) this.bass(t, mtof(note(0, 0)), spb * 3.2, D.bass.vol * h);
      h = hit(D.arp.pat);
      if (h && rnd() < D.arp.prob) {
        const seq = [0, 2, 4, 7, 4, 2];
        const f = mtof(note(seq[this.arpI++ % seq.length], 2));
        tone(t, { f, w: D.arp.wave, a: 0.004, v: D.arp.vol * h, d: 0.22, lp: D.arp.cut, q: 2, out });
        tone(t, { f, w: D.arp.wave, a: 0.004, v: D.arp.vol * h * 0.6, d: 0.22, lp: D.arp.cut * 0.7, out: this.delay }); // echo
      }
      if ((h = hit(D.kick))) kick(t, D.kickVol * h, out);
      if ((h = hit(D.snare))) { noise(t, { f: 1900, q: 0.9, v: D.snareVol * h, d: 0.17, out }); tone(t, { f: 190, w: 'triangle', v: D.snareVol * h * 0.6, d: 0.09, out }); }
      if ((h = hit(D.hat))) noise(t, { type: 'highpass', f: 7500, v: D.hatVol * h, d: 0.045, out });
      // faction / theme colour
      if (D.extra === 'bell' && s === 14 && bar % 2 === 1) [1, 2.76, 5.4].forEach((p, i) => tone(t, { f: mtof(note(4, 2)) * p, v: 0.02 / (i + 1), d: 1.2, out, rv: 0.4 }));
      if (D.extra === 'metal' && s === 10 && bar % 2 === 0) metal(t, 0.035, out);
      if (D.extra === 'glitch' && rnd() < 0.08) for (let i = 0; i < 4; i++) tone(t + i * spb * 0.25, { f: 1200 + rnd() * 3200, w: 'square', v: 0.012, d: 0.02, out });
      if (D.extra === 'wobble' && s === 8 && bar % 4 === 3) noise(t, { f: 300, f2: 1400, g: spb * 6, q: 6, v: 0.03, d: spb * 7, a: spb * 3, out });
    }
    pad(t, ms, dur) {
      const c = A.ctx, D = this.def;
      ms.forEach((m) => [-7, 7].forEach((det) => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.8;
        fl.frequency.setValueAtTime(D.padCut * 0.5, t); fl.frequency.linearRampToValueAtTime(D.padCut, t + dur * 0.5); fl.frequency.linearRampToValueAtTime(D.padCut * 0.6, t + dur);
        const g = c.createGain(), att = Math.min(1.6, dur * 0.35);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(D.padVol / 3, t + att);
        g.gain.setValueAtTime(D.padVol / 3, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
        o.connect(fl); fl.connect(g); g.connect(this.out);
        o.start(t); o.stop(t + dur + 1.3);
      }));
    }
    bass(t, f, dur, v) {
      const c = A.ctx, D = this.def;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 3;
      fl.frequency.setValueAtTime(D.bass.cut * 2.4, t); fl.frequency.exponentialRampToValueAtTime(D.bass.cut, t + 0.14);
      if (D.extra === 'wobble') { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 3; lg.gain.value = D.bass.cut * 0.7; l.connect(lg); lg.connect(fl.frequency); l.start(t); l.stop(t + dur + 0.1); }
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const sg = c.createGain(); sg.gain.value = 0.9;
      o.connect(fl); sub.connect(sg); sg.connect(fl); fl.connect(g); g.connect(this.drive || this.out);
      o.start(t); sub.start(t); o.stop(t + dur + 0.05); sub.stop(t + dur + 0.05);
    }
  }
  // A recorded track (optional replacement for a synthesised theme), routed through the same music bus.
  class FileSong {
    constructor(au, url) {
      this.url = url;
      this.el = new Audio(url); this.el.loop = true; this.el.preload = 'auto';
      this.src = au.ctx.createMediaElementSource(this.el);
      this.trim = au.ctx.createGain(); this.trim.gain.value = au.TRACK_GAIN[url] != null ? au.TRACK_GAIN[url] : 0.3;
      this.out = au.ctx.createGain(); this.out.gain.value = 0.0001;
      this.src.connect(this.trim); this.trim.connect(this.out); this.out.connect(au.bus.music);
      this.endAt = Infinity;
      const pos = au.trackPos[url]; // resume where this track was left
      if (pos) this.el.addEventListener('loadedmetadata', () => { this.el.currentTime = pos % (this.el.duration || Infinity); }, { once: true });
      this.el.play().catch(() => {});
    }
    fadeIn(d) { Song.prototype.fadeIn.call(this, d); }
    fadeOut(d) { Song.prototype.fadeOut.call(this, d); }
    done() { return A.ctx.currentTime > this.endAt; }
    dispose() { A.trackPos[this.url] = this.el.currentTime; this.el.pause(); this.el.removeAttribute('src'); this.el.load(); try { this.out.disconnect(); this.src.disconnect(); } catch (e) { /* gone */ } }
    tick() {}
  }

  // ---------- sound effects library ----------
  const SFX = {
    // interface
    hover: (t) => tone(t, { f: 2600 + Math.random() * 200, v: 0.018, d: 0.025, w: 'sine' }),
    click: (t) => { noise(t, { type: 'highpass', f: 3500, v: 0.05, d: 0.012 }); tone(t, { f: 1100, f2: 700, w: 'square', v: 0.03, d: 0.04, lp: 3000 }); },
    tab: (t) => { tone(t, { f: 1320, v: 0.045, d: 0.06, w: 'triangle' }); tone(t + 0.045, { f: 1980, v: 0.04, d: 0.08, w: 'triangle' }); },
    sweep: (t) => { noise(t, { f: 500, f2: 3800, g: 0.22, q: 2.5, v: 0.05, a: 0.06, d: 0.2 }); tone(t, { f: 260, f2: 780, g: 0.2, w: 'triangle', v: 0.03, d: 0.22 }); },
    back: (t) => { noise(t, { f: 3200, f2: 450, g: 0.2, q: 2.5, v: 0.04, a: 0.03, d: 0.18 }); tone(t, { f: 700, f2: 300, g: 0.18, w: 'triangle', v: 0.025, d: 0.2 }); },
    modalOpen: (t) => [880, 1318, 1760].forEach((f, i) => tone(t + i * 0.025, { f, v: 0.03, a: 0.01, d: 0.35, rv: 0.4 })),
    modalClose: (t) => tone(t, { f: 980, f2: 320, g: 0.14, w: 'sine', v: 0.035, d: 0.16 }),
    error: (t) => { tone(t, { f: 220, w: 'square', v: 0.045, d: 0.09, lp: 1100 }); tone(t + 0.1, { f: 185, w: 'square', v: 0.045, d: 0.14, lp: 1000 }); },
    notify: (t) => { tone(t, { f: 1046, v: 0.04, d: 0.4, rv: 0.3 }); tone(t + 0.08, { f: 1568, v: 0.035, d: 0.5, rv: 0.3 }); },
    endTurn: (t) => {
      kick(t, 0.35); noise(t, { f: 200, f2: 4200, g: 0.6, q: 1.5, v: 0.06, a: 0.45, d: 0.25, rv: 0.4 });
      [0, 7, 12].forEach((m) => tone(t, { f: mtof(50 + m), w: 'sawtooth', a: 0.25, v: 0.025, d: 0.9, lp: 1400, rv: 0.5 }));
    },
    faction: (t, o) => {
      const F = FLAVOR[o.fid] || NEUTRAL, base = F.root + 24;
      (F.motif || [0, 7]).forEach((m, i) => tone(t + i * 0.11, { f: mtof(base + m), w: F.motifWave || 'triangle', a: 0.005, v: 0.05, d: 0.35, lp: F.cutoff * 1.5, rv: 0.4 }));
      kick(t, 0.2);
      if (F.extra === 'metal') metal(t + 0.33, 0.05);
      if (F.extra === 'glitch') for (let i = 0; i < 6; i++) tone(t + 0.3 + i * 0.025, { f: 1500 + Math.random() * 3000, w: 'square', v: 0.015, d: 0.02 });
      if (F.extra === 'wobble') noise(t + 0.2, { f: 250, f2: 1600, g: 0.4, q: 7, v: 0.05, a: 0.2, d: 0.3 });
      if (F.extra === 'dist') tone(t, { f: mtof(F.root), w: 'sawtooth', v: 0.06, d: 0.5, lp: 600 });
      if (F.extra === 'bell') [1, 2.76].forEach((p) => tone(t + 0.4, { f: mtof(base + 12) * p, v: 0.025, d: 1, rv: 0.5 }));
    },
    resUp: (t) => notes(t, [84, 88, 91], { v: 0.03, d: 0.18, step: 0.06, w: 'triangle' }),
    resDown: (t) => notes(t, [52, 47], { v: 0.04, d: 0.2, step: 0.09, w: 'triangle', lp: 900 }),
    // district operations
    campaign: (t) => { noise(t, { f: 700, f2: 1100, q: 1.2, v: 0.05, a: 0.15, d: 0.4, rv: 0.3 }); [0, 4, 7].forEach((m) => tone(t, { f: mtof(62 + m), w: 'sawtooth', v: 0.025, d: 0.3, bp: 1300, q: 1.5 })); },
    consolidate: (t) => { kick(t, 0.22); [660, 990].forEach((f, i) => tone(t + 0.05 + i * 0.06, { f, v: 0.03, d: 0.45, rv: 0.4 })); },
    bribe: (t) => [2093, 2637, 3136].forEach((f, i) => { tone(t + i * 0.06, { f, v: 0.03, d: 0.25 }); tone(t + i * 0.06, { f: f * 2.7, v: 0.008, d: 0.12 }); }),
    fortify: (t) => { metal(t, 0.06); metal(t + 0.14, 0.05); kick(t + 0.02, 0.2); },
    develop: (t) => { notes(t, [60, 64, 67, 72], { w: 'square', v: 0.025, d: 0.1, step: 0.06, lp: 2400 }); noise(t + 0.25, { f: 2400, q: 3, v: 0.03, d: 0.15 }); },
    capture: (t) => { kick(t, 0.35); [0, 7, 12, 16].forEach((m, i) => tone(t + i * 0.08, { f: mtof(55 + m), w: 'sawtooth', v: 0.035, a: 0.01, d: 0.7, lp: 2600, rv: 0.5 })); },
    lost: (t) => { kick(t, 0.3); tone(t, { f: 330, f2: 110, g: 0.6, w: 'sawtooth', v: 0.04, d: 0.7, lp: 900, rv: 0.4 }); },
    // units
    recruit: (t) => { SFX.click(t); tone(t + 0.04, { f: 180, f2: 420, g: 0.25, w: 'sawtooth', v: 0.03, d: 0.25, lp: 1200 }); tone(t + 0.3, { f: 1320, v: 0.04, d: 0.3, rv: 0.3 }); },
    unitSelect: (t) => { noise(t, { f: 2000, q: 2, v: 0.03, d: 0.04 }); tone(t + 0.02, { f: 1200, v: 0.03, d: 0.06, w: 'triangle' }); },
    select: (t) => tone(t, { f: 900, f2: 1100, g: 0.05, v: 0.022, d: 0.07, w: 'triangle' }),
    moveArm: (t) => { tone(t, { f: 1500, v: 0.03, d: 0.05 }); tone(t + 0.08, { f: 1500, v: 0.03, d: 0.05 }); },
    move: (t) => { noise(t, { f: 300, f2: 1600, g: 0.3, q: 1.2, v: 0.05, a: 0.1, d: 0.25 }); tone(t + 0.25, { f: 880, v: 0.03, d: 0.12, w: 'triangle' }); },
    order: (t) => { tone(t, { f: 660, w: 'square', v: 0.025, d: 0.06, lp: 2200 }); tone(t + 0.06, { f: 990, w: 'square', v: 0.025, d: 0.1, lp: 2200 }); },
    equip: (t) => { metal(t, 0.03); noise(t + 0.05, { f: 1800, f2: 600, q: 1.5, v: 0.03, d: 0.15 }); },
    injure: (t) => { noise(t, { type: 'lowpass', f: 450, v: 0.1, d: 0.2 }); tone(t, { f: 140, f2: 90, w: 'sine', v: 0.06, d: 0.35 }); },
    recover: (t) => { tone(t, { f: 440, f2: 880, g: 0.4, v: 0.03, a: 0.08, d: 0.4, rv: 0.4 }); },
    death: (t) => { kick(t, 0.35); tone(t, { f: 110, f2: 45, g: 0.8, w: 'sawtooth', v: 0.04, d: 1, lp: 500, rv: 0.6 }); },
    dismiss: (t) => notes(t, [64, 59, 55], { v: 0.03, d: 0.18, step: 0.08, w: 'triangle' }),
    // economy
    income: (t) => { [2093, 2637].forEach((f, i) => tone(t + i * 0.07, { f, v: 0.025, d: 0.2 })); },
    trade: (t) => { SFX.click(t); [1568, 2093].forEach((f, i) => tone(t + 0.05 + i * 0.06, { f, v: 0.03, d: 0.2 })); },
    buy: (t) => { SFX.trade(t); SFX.equip(t + 0.12); },
    // research & covert
    research: (t) => { for (let i = 0; i < 8; i++) tone(t + i * 0.035, { f: 800 + Math.random() * 2400, w: 'square', v: 0.016, d: 0.03, lp: 4000 }); tone(t + 0.3, { f: 1760, v: 0.03, d: 0.3, rv: 0.3 }); },
    techDone: (t) => { [0, 4, 7, 11, 14].forEach((m, i) => tone(t + i * 0.07, { f: mtof(60 + m), w: 'triangle', v: 0.035, d: 0.9, rv: 0.6 })); [0, 7].forEach((m) => tone(t, { f: mtof(48 + m), w: 'sawtooth', a: 0.2, v: 0.03, d: 1.2, lp: 1600, rv: 0.5 })); },
    hack: (t) => { for (let i = 0; i < 10; i++) tone(t + i * 0.022, { f: 600 + Math.random() * 3600, w: 'square', v: 0.014, d: 0.018 }); tone(t + 0.26, { f: 1318, v: 0.035, d: 0.25 }); tone(t + 0.33, { f: 1760, v: 0.035, d: 0.35, rv: 0.3 }); },
    alarm: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.18, { f: 700, f2: 520, g: 0.16, w: 'sawtooth', v: 0.025, d: 0.16, lp: 1800 }); },
    // diplomacy
    pact: (t) => [0, 4, 7, 12].forEach((m) => tone(t, { f: mtof(57 + m), w: 'triangle', a: 0.15, v: 0.03, d: 1, rv: 0.6 })),
    decline: (t) => { tone(t, { f: mtof(58), w: 'triangle', v: 0.035, d: 0.3 }); tone(t, { f: mtof(59), w: 'triangle', v: 0.03, d: 0.3 }); },
    hostile: (t) => { kick(t, 0.3); tone(t, { f: 220, f2: 70, g: 0.5, w: 'sawtooth', v: 0.05, d: 0.6, lp: 900 }); metal(t + 0.05, 0.04); },
    // combat
    attack: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.09, { type: 'highpass', f: 1200, v: 0.07, d: 0.06 }); kick(t, 0.2); },
    battleWin: (t) => { SFX.attack(t); [0, 7, 12].forEach((m, i) => tone(t + 0.3 + i * 0.07, { f: mtof(57 + m), w: 'sawtooth', v: 0.03, d: 0.6, lp: 2400, rv: 0.4 })); },
    battleLoss: (t) => { SFX.attack(t); tone(t + 0.3, { f: 300, f2: 100, g: 0.6, w: 'sawtooth', v: 0.04, d: 0.7, lp: 900, rv: 0.4 }); },
    impact: (t) => { kick(t, 0.45); noise(t, { type: 'lowpass', f: 1800, v: 0.12, d: 0.6, rv: 0.6 }); metal(t + 0.02, 0.05); },
    victoryHit: (t) => { kick(t, 0.4); [0, 4, 7, 12, 16].forEach((m, i) => tone(t + i * 0.05, { f: mtof(53 + m), w: 'sawtooth', a: 0.02, v: 0.035, d: 1.6, lp: 3000, rv: 0.7 })); },
    defeatHit: (t) => { kick(t, 0.45); [0, -5, -12].forEach((m, i) => tone(t + i * 0.25, { f: mtof(45 + m), f2: mtof(40 + m), g: 1, w: 'sawtooth', v: 0.04, d: 1.4, lp: 700, rv: 0.7 })); },
  };

  // ---------- ambient one-shots ----------
  const AMB = {
    traffic: (t, out) => { const p = Math.random() * 1.6 - 0.8; noise(t, { f: 220, f2: 900, g: 1.2, q: 0.8, v: 0.18, a: 0.9, d: 1.4, out, pan: p }); },
    siren: (t, out) => { const p = Math.random() * 1.4 - 0.7; for (let i = 0; i < 4; i++) tone(t + i * 0.9, { f: 620, f2: 880, g: 0.45, w: 'triangle', a: 0.2, v: 0.025, d: 0.7, lp: 1400, out, pan: p, rv: 0.5 }); },
    radio: (t, out) => {
      const p = Math.random() * 1.2 - 0.6;
      tone(t, { f: 1700, v: 0.02, d: 0.06, out, pan: p });
      for (let i = 0; i < 9; i++) if (Math.random() < 0.75) noise(t + 0.12 + i * 0.09, { f: 1600, q: 3, v: 0.035, d: 0.07, out, pan: p });
    },
    machine: (t, out) => { for (let i = 0; i < 3; i++) metal(t + i * 0.45 + Math.random() * 0.1, 0.035, out); noise(t, { f: 120, q: 4, v: 0.12, a: 0.3, d: 1.2, out }); },
    chirp: (t, out) => { const p = Math.random() * 1.2 - 0.6; for (let i = 0; i < 5; i++) tone(t + i * 0.05, { f: 1800 + Math.random() * 1600, v: 0.012, d: 0.04, out, pan: p }); },
  };

  ND.sfx = (name, o) => A.sfx(name, o);
})(window.ND);
