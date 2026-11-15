// Звук игры: тихо и без музыки. Только шум прибоя у воды, редкие негромкие голоса зверей рядом,
// треск при рубке и добыче и мягкий звук, когда что-то подбираешь. Всё — из шума (Web Audio), без синтезаторных тонов.
export class Sound {
  constructor() {
    this.ctx = null; this.on = true; this.vol = 0.35;
    try { const v = localStorage.getItem('insulaSound'); if (v === 'off') this.on = false; } catch {}
    const unlock = () => { this.init(); if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); };
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    this.last = {}; this.voiceT = 3;
  }
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol : 0; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.5; }
    this.noise = buf;
    // прибой — постоянный мягкий шум, громче у воды
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = 0.8;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    this.surf = { f, g };
  }
  toggle() {
    this.init();
    this.on = !this.on;
    try { localStorage.setItem('insulaSound', this.on ? 'on' : 'off'); } catch {}
    if (this.master) this.master.gain.setTargetAtTime(this.on ? this.vol : 0, this.ctx.currentTime, 0.1);
    return this.on;
  }
  // короткий отфильтрованный шум с огибающей
  burst(dur, { freq = 1200, q = 1, vol = 0.3, type = 'bandpass', delay = 0, slide = 0, trem = 0 } = {}) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.9 + Math.random() * 0.3;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g);
    if (trem) {
      // рычание: дрожание громкости
      const lfo = c.createOscillator(), lg = c.createGain(), out = c.createGain();
      lfo.frequency.value = trem; lg.gain.value = 0.5; out.gain.value = 0.5;
      lfo.connect(lg); lg.connect(out.gain); g.connect(out); out.connect(this.master);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    } else g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name, vol = 1) {
    if (!this.ctx || !this.on) return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < 80) return;
    this.last[name] = now;
    if (name === 'chop') {
      // треск рубки: сухой удар и щепки
      this.burst(0.07, { freq: 1800, q: 1.5, vol: 0.5 * vol });
      this.burst(0.18, { freq: 3200, q: 0.8, vol: 0.18 * vol, delay: 0.03, type: 'highpass' });
    } else if (name === 'dig') {
      this.burst(0.2, { freq: 700, q: 0.8, vol: 0.3 * vol, slide: 0.6 });
    } else if (name === 'pickup') {
      this.burst(0.15, { freq: 1400, q: 1.2, vol: 0.18 * vol, slide: 1.4 });
    }
    // остальные звуки (музыка, сигналы, удары) убраны по просьбе игроков
  }
  // голос зверя рядом: тихо и изредка
  animal(type, d) {
    if (!this.ctx || !this.on || d > 30) return;
    const v = 0.22 * (1 - d / 30);
    if (type === 'lion') this.burst(1.1, { freq: 160, q: 2, vol: v, type: 'bandpass', trem: 22 });
    else if (type === 'boar') { this.burst(0.25, { freq: 380, q: 3, vol: v, trem: 30 }); this.burst(0.2, { freq: 420, q: 3, vol: v * 0.8, delay: 0.32, trem: 30 }); }
    else if (type === 'elephant') this.burst(1.4, { freq: 600, q: 6, vol: v, slide: 1.6 });
    else if (type === 'jackal' || type === 'nightbeast') { this.burst(0.35, { freq: 1300, q: 8, vol: v * 0.7, slide: 1.5 }); this.burst(0.3, { freq: 1500, q: 8, vol: v * 0.5, delay: 0.4, slide: 1.4 }); }
  }
  fx() {}
  // фон: только прибой; редкие голоса ближайшего зверя
  ambient({ t, nearWater, beast }) {
    if (!this.ctx || !this.on || !this.surf) return;
    const c = this.ctx;
    this.surf.g.gain.setTargetAtTime((0.03 + 0.14 * nearWater) * (0.7 + 0.3 * Math.sin(t * 0.45)), c.currentTime, 0.4);
    this.surf.f.frequency.setTargetAtTime(380 + 240 * (0.5 + 0.5 * Math.sin(t * 0.45)), c.currentTime, 0.3);
    this.voiceT -= 1 / 60;
    if (this.voiceT <= 0) { this.voiceT = 6 + Math.random() * 8; if (beast) this.animal(beast.type, beast.d); }
  }
}
