'use strict';
// Voz, câmera e compartilhamento de tela via WebRTC em malha (cada um conecta direto com cada um).
// Usa "perfect negotiation" para as renegociações (ligar/desligar câmera e tela).

// Qualidades do compartilhamento de tela.
// Todas mantêm a resolução: se faltar banda ou CPU, cai o fps, nunca a nitidez.
const SCREEN_PRESETS = {
  '720p30': { label: '720p · 30 fps', desc: 'Leve, bom para internet fraca', w: 1280, h: 720, fps: 30, kbps: 3000 },
  '720p60': { label: '720p · 60 fps', desc: 'Fluido, bom para jogos', w: 1280, h: 720, fps: 60, kbps: 6000 },
  '1080p30': { label: '1080p · 30 fps', desc: 'Nítido, bom para textos e código', w: 1920, h: 1080, fps: 30, kbps: 8000 },
  '1080p60': { label: '1080p · 60 fps', desc: 'Máxima (precisa de PC e internet bons)', w: 1920, h: 1080, fps: 60, kbps: 12000 },
};
window.SCREEN_PRESETS = SCREEN_PRESETS;

// Eliminador de ruído: filtros (graves e chiado) + "porta de ruído" que só deixa a voz passar.
class MicProcessor {
  constructor(ctx, stream, opts) {
    this.ctx = ctx;
    this.opts = { noise: 'forte', gate: 'auto', gateDb: -50, ...opts };
    this.src = ctx.createMediaStreamSource(stream);
    let node = this.src;
    this.nodes = [];
    if (this.opts.noise === 'forte') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.7;   // ronco, ventilador, batida na mesa
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000; lp.Q.value = 0.7;  // chiado agudo
      node.connect(hp); hp.connect(lp); node = lp;
      this.nodes.push(hp, lp);
    }
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    node.connect(this.analyser);
    this.gain = ctx.createGain();
    node.connect(this.gain);
    this.dest = ctx.createMediaStreamDestination();
    this.gain.connect(this.dest);
    this.level = -100;
    this.floor = -60;
    this.threshold = -50;
    this.open = this.opts.gate === 'off';
    this.lastLoud = 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.timer = setInterval(() => {
      this.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
      this.level = db;
      // ruído de fundo: desce rápido, sobe devagar
      this.floor += (db < this.floor ? 0.25 : 0.003) * (db - this.floor);
      this.floor = Math.max(-90, Math.min(-35, this.floor));
      const g = this.opts.gate;
      this.threshold = g === 'manual' ? this.opts.gateDb : Math.max(-70, Math.min(-30, this.floor + 11));
      const now = performance.now();
      if (g === 'off' || db > this.threshold) this.lastLoud = now;
      const open = g === 'off' || now - this.lastLoud < 280;
      if (open !== this.open) {
        this.open = open;
        this.gain.gain.setTargetAtTime(open ? 1 : 0, ctx.currentTime, open ? 0.004 : 0.04);
      }
    }, 20);
    this.gain.gain.value = this.open ? 1 : 0;
  }
  get track() { return this.dest.stream.getAudioTracks()[0]; }
  get stream() { return this.dest.stream; }
  setGate(gate, gateDb) { this.opts.gate = gate; this.opts.gateDb = gateDb; }
  stop() {
    clearInterval(this.timer);
    try { this.src.disconnect(); this.gain.disconnect(); this.nodes.forEach((n) => n.disconnect()); } catch { /* já desligado */ }
    this.dest.stream.getTracks().forEach((t) => t.stop());
  }
}
window.MicProcessor = MicProcessor;

class Voice {
  constructor(h) {
    this.h = h; // { send, onRemoteVideo(peerId, kind, stream|null), onLocalVideo(kind, stream|null), onSpeaking(bool), onError(msg), pickScreen() }
    this.peers = new Map();
    this.mic = null;
    this.cam = null;
    this.screen = null;
    this.active = false;
    this.muted = false;
    this.deafened = false;
    this.speaking = false;
    this.myId = null;
    this.volumes = new Map(); // uid -> { voice: 0..2, screen: 0..2 }
    this.silenced = new Set(); // quem não deve ser ouvido (silenciado para mim ou por um moderador)
    this.ctx = null;
    this.screenPreset = SCREEN_PRESETS['720p60'];
    this.devices = { mic: '', cam: '' };
    this.noise = { noise: 'forte', gate: 'auto', gateDb: -50 };
    this.raw = null;
    this.proc = null;
  }

  get micTrack() { return this.mic ? this.mic.getAudioTracks()[0] || null : null; }

  async join(myId) {
    this.myId = myId;
    this.retries = new Map();
    // criado já no clique (o navegador só libera áudio depois de uma interação)
    try {
      this.ctx = new AudioContext();
      const out = this.h.outputDevice && this.h.outputDevice();
      if (out && this.ctx.setSinkId) this.ctx.setSinkId(out).catch(() => {});
    } catch { this.ctx = null; }
    // Só fica "ativo" depois do microfone pronto: assim as conexões já nascem com o áudio
    // e nenhuma mensagem sai antes do servidor saber que entramos na sala.
    await this._openMic();
    this.active = true;
    this._applyMute();
  }

  async _openMic() {
    const n = this.noise;
    const audio = {
      echoCancellation: true, autoGainControl: true, noiseSuppression: n.noise !== 'off',
      ...(this.devices.mic ? { deviceId: { exact: this.devices.mic } } : {}),
    };
    // isolamento de voz do próprio navegador, quando existe (Chrome/Edge mais novos)
    if (n.noise === 'forte' && navigator.mediaDevices.getSupportedConstraints && navigator.mediaDevices.getSupportedConstraints().voiceIsolation) audio.voiceIsolation = true;
    try {
      this.raw = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (e) {
      this.raw = null;
      this.mic = null;
      this.h.onError(`Não consegui acessar o microfone (${e.name}). Você entrou só ouvindo.`);
      return;
    }
    this.proc = null;
    if (this.ctx && (n.noise === 'forte' || n.gate !== 'off')) {
      try {
        this.proc = new MicProcessor(this.ctx, this.raw, n);
        this.mic = this.proc.stream;
      } catch (e) { console.warn('[dl] eliminador de ruído', e); this.proc = null; }
    }
    if (!this.proc) this.mic = this.raw;
    this._startDetector();
  }
  _closeMic(stream, raw, proc) {
    if (proc) proc.stop();
    if (raw) raw.getTracks().forEach((t) => t.stop());
    if (stream && stream !== raw) stream.getTracks().forEach((t) => t.stop());
  }

  // Muda o eliminador de ruído; a porta de ruído troca na hora, o resto reabre o microfone.
  setNoise(opts) {
    const prev = this.noise;
    this.noise = { ...this.noise, ...opts };
    if (!this.active) return;
    if (prev.noise === this.noise.noise && (prev.gate === 'off') === (this.noise.gate === 'off') && this.proc) this.proc.setGate(this.noise.gate, this.noise.gateDb);
    else this.setMicDevice(this.devices.mic);
  }

  // Troca o microfone durante a chamada.
  async setMicDevice(id) {
    this.devices.mic = id;
    if (!this.active) return;
    const old = this.mic;
    const oldRaw = this.raw;
    const oldProc = this.proc;
    this._stopDetector();
    await this._openMic();
    const t = this.micTrack;
    for (const p of this.peers.values()) {
      const sender = p.pc.getSenders().find((s) => s.track && old && old.getAudioTracks().includes(s.track));
      if (sender && t) sender.replaceTrack(t);
      else if (t && !sender) p.pc.addTrack(t, this.mic);
    }
    this._closeMic(old, oldRaw, oldProc);
    this._applyMute();
  }

  leave() {
    for (const id of [...this.peers.keys()]) this._closePeer(id);
    this.stopScreen(true);
    this.stopCamera(true);
    this._stopDetector();
    this._closeMic(this.mic, this.raw, this.proc);
    this.mic = null;
    this.raw = null;
    this.proc = null;
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
    this.active = false;
  }

  setMuted(v) { this.muted = v; this._applyMute(); }
  setDeafened(v) {
    this.deafened = v;
    this._applyMute();
    for (const p of this.peers.values()) this._applyAudioAll(p);
  }

  // ---------- volume por pessoa (0 a 200%) ----------
  getVolume(uid, kind = 'voice') {
    const v = this.volumes.get(uid);
    return v && typeof v[kind] === 'number' ? v[kind] : 1;
  }
  setVolume(uid, kind, value) {
    const v = { voice: 1, screen: 1, ...(this.volumes.get(uid) || {}) };
    v[kind] = Math.max(0, Math.min(2, value));
    this.volumes.set(uid, v);
    if (this.h.onVolumeChange) this.h.onVolumeChange(uid, v);
    const p = this.peers.get(uid);
    if (p) this._applyAudioAll(p);
  }
  setSilenced(uids) {
    const next = new Set(uids);
    if (next.size === this.silenced.size && [...next].every((u) => this.silenced.has(u))) return;
    this.silenced = next;
    for (const p of this.peers.values()) this._applyAudioAll(p);
  }
  setOutput(id) {
    for (const p of this.peers.values()) for (const e of p.audio.values()) if (e.a.setSinkId) e.a.setSinkId(id || '').catch(() => {});
    if (this.ctx && this.ctx.setSinkId) this.ctx.setSinkId(id || '').catch(() => {});
  }
  _audioKind(p, e) { return p.remoteMedia.screen && e.stream.id === p.remoteMedia.screen ? 'screen' : 'voice'; }
  _applyAudioAll(p) { for (const e of p.audio.values()) this._applyAudio(p, e); }
  // Até 100% usa o próprio elemento de áudio (melhor para o cancelamento de eco);
  // acima disso passa por um amplificador (Web Audio).
  _applyAudio(p, e) {
    const kind = this._audioKind(p, e);
    const v = kind === 'voice' && this.silenced.has(p.id) ? 0 : this.getVolume(p.id, kind);
    if (v > 1 && this.ctx) {
      if (!e.g) {
        try {
          e.src = this.ctx.createMediaStreamSource(e.stream);
          e.g = this.ctx.createGain();
          e.src.connect(e.g).connect(this.ctx.destination);
        } catch { e.src = e.g = null; }
      }
      if (e.g) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        e.g.gain.value = this.deafened ? 0 : v;
        e.a.muted = true; // continua tocando mudo para o navegador manter o áudio chegando
        return;
      }
    }
    if (e.g) { try { e.src.disconnect(); e.g.disconnect(); } catch { /* já desligado */ } e.src = e.g = null; }
    e.a.muted = this.deafened;
    e.a.volume = Math.min(1, v);
  }
  _applyMute() {
    const t = this.micTrack;
    if (t) t.enabled = !(this.muted || this.deafened);
  }

  reconcile(ids) {
    if (!this.active) return;
    const set = new Set(ids);
    set.delete(this.myId);
    for (const id of set) if (!this.peers.has(id)) this._createPeer(id);
    for (const id of [...this.peers.keys()]) if (!set.has(id)) this._closePeer(id);
  }

  _mediaMap() {
    return { camera: this.cam ? this.cam.id : null, screen: this.screen ? this.screen.id : null };
  }
  _announce(p) { this.h.send({ type: 'signal', to: p.id, data: { media: this._mediaMap() } }); }
  _announceAll() { for (const p of this.peers.values()) this._announce(p); }

  _createPeer(id) {
    // Sem STUN/TURN: dentro do Radmin VPN / rede local os PCs se enxergam direto.
    const pc = new RTCPeerConnection({ iceServers: [] });
    const p = {
      id, pc, polite: this.myId > id, makingOffer: false, ignoreOffer: false, established: false, pending: false,
      queue: Promise.resolve(), senders: { camera: [], screen: [] }, audio: new Map(),
      remoteMedia: { camera: null, screen: null }, videos: new Map(), shown: { camera: null, screen: null },
    };
    this.peers.set(id, p);
    this._announce(p);

    if (this.micTrack) pc.addTrack(this.micTrack, this.mic);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    if (this.cam) for (const t of this.cam.getTracks()) p.senders.camera.push(pc.addTrack(t, this.cam));
    if (this.screen) for (const t of this.screen.getTracks()) { const snd = pc.addTrack(t, this.screen); p.senders.screen.push(snd); if (t.kind === 'video') this._preferCodecs(pc, snd); }

    pc.onnegotiationneeded = () => this._negotiate(p);
    pc.onicecandidate = ({ candidate }) => { if (candidate) this.h.send({ type: 'signal', to: id, data: { candidate } }); };
    pc.ontrack = ({ track, streams }) => this._onTrack(p, track, streams[0] || new MediaStream([track]));
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' && pc.restartIce) pc.restartIce(); };
    pc.addEventListener('signalingstatechange', () => { if (pc.signalingState === 'stable') this._tune(p); });
    // Quem inicia a conexão vigia: se não conectar em alguns segundos, recomeça dos dois lados.
    if (!p.polite) p.watch = setTimeout(() => this._watchdog(id, p), 8000);
    return p;
  }

  _watchdog(id, p) {
    if (this.peers.get(id) !== p || p.pc.connectionState === 'connected') return;
    const n = (this.retries.get(id) || 0) + 1;
    this.retries.set(id, n);
    if (n > 3) return console.warn('[dl] desisti de reconectar com', id);
    console.warn('[dl] conexão com', id, 'travada; recomeçando (tentativa ' + n + ')');
    this.h.send({ type: 'signal', to: id, data: { reset: true } });
    this._closePeer(id);
    this._createPeer(id);
  }

  // Faz a transmissão já começar com boa qualidade em vez de subir devagar (padrão do navegador ~300 kbps).
  _bitrateSdp(sdp) {
    if (!sdp) return sdp;
    const sharing = !!this.screen;
    const pr = this.screenPreset;
    const max = sharing ? pr.kbps : 2500;
    const start = sharing ? Math.round(pr.kbps * 0.6) : 1200;
    const min = sharing ? Math.round(pr.kbps * 0.25) : 300;
    const extra = `x-google-start-bitrate=${start};x-google-min-bitrate=${min};x-google-max-bitrate=${max}`;
    const lines = sdp.split('\r\n');
    let video = false;
    const pts = new Set();
    for (const l of lines) {
      if (l.startsWith('m=')) video = l.startsWith('m=video');
      const m = video && l.match(/^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i);
      if (m) pts.add(m[1]);
    }
    const out = [];
    const hasFmtp = new Set();
    for (const l of lines) {
      const f = l.match(/^a=fmtp:(\d+) (.*)$/);
      if (f && pts.has(f[1])) {
        hasFmtp.add(f[1]);
        out.push(`a=fmtp:${f[1]} ` + f[2].split(';').filter((x) => !/^x-google-(start|min|max)-bitrate/.test(x)).concat(extra).join(';'));
        continue;
      }
      out.push(l);
    }
    for (let i = 0; i < out.length; i++) {
      const m = out[i].match(/^a=rtpmap:(\d+) /);
      if (m && pts.has(m[1]) && !hasFmtp.has(m[1])) { out.splice(i + 1, 0, `a=fmtp:${m[1]} ${extra}`); hasFmtp.add(m[1]); }
    }
    return out.join('\r\n');
  }

  // Prefere H.264 na tela (no Windows costuma usar a placa de vídeo para codificar) e depois VP9/VP8.
  _preferCodecs(pc, sender) {
    try {
      const tr = pc.getTransceivers().find((t) => t.sender === sender);
      const caps = RTCRtpSender.getCapabilities && RTCRtpSender.getCapabilities('video');
      if (!tr || !tr.setCodecPreferences || !caps) return;
      const rank = (c) => { const i = ['video/H264', 'video/VP9', 'video/VP8'].indexOf(c.mimeType); return i < 0 ? 9 : i; };
      tr.setCodecPreferences([...caps.codecs].sort((a, b) => rank(a) - rank(b)));
    } catch (e) { console.warn('[dl] codec', e); }
  }

  // Estatísticas do que está saindo (para o quadro da sua própria tela)
  async getSendStats(kind = 'screen') {
    let bytes = 0, w = 0, hh = 0, fps = 0, reason = 'none', n = 0;
    for (const p of this.peers.values()) {
      for (const s of p.senders[kind]) {
        if (!s.track || s.track.kind !== 'video') continue;
        n++;
        (await s.getStats()).forEach((r) => {
          if (r.type !== 'outbound-rtp' || r.kind !== 'video') return;
          bytes += r.bytesSent || 0;
          if ((r.frameWidth || 0) >= w) { w = r.frameWidth || 0; hh = r.frameHeight || 0; fps = r.framesPerSecond || 0; }
          if (r.qualityLimitationReason && r.qualityLimitationReason !== 'none') reason = r.qualityLimitationReason;
        });
      }
    }
    return { bytes, w, h: hh, fps, reason, peers: n };
  }

  async _negotiate(p) {
    const pc = p.pc;
    // Na primeira conexão só o lado "impolite" oferta, para não haver colisão.
    if (p.polite && !p.established) { p.pending = true; return; }
    if (p.makingOffer || pc.signalingState !== 'stable') return;
    try {
      p.makingOffer = true;
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription({ type: 'offer', sdp: this._bitrateSdp(offer.sdp) });
      this.h.send({ type: 'signal', to: p.id, data: { description: pc.localDescription } });
    } catch (e) {
      console.warn('negociação', e);
    } finally {
      p.makingOffer = false;
    }
  }

  _closePeer(id) {
    const p = this.peers.get(id);
    if (!p) return;
    clearTimeout(p.watch);
    for (const e of p.audio.values()) {
      e.a.pause(); e.a.srcObject = null;
      if (e.g) { try { e.src.disconnect(); e.g.disconnect(); } catch { /* já desligado */ } }
    }
    p.pc.close();
    this.peers.delete(id);
    for (const kind of ['camera', 'screen']) if (p.shown[kind]) this.h.onRemoteVideo(id, kind, null);
  }

  handleSignal(from, data) {
    if (!this.active) return;
    if (data.reset) {
      this._closePeer(from);
      this._createPeer(from);
      return;
    }
    let p = this.peers.get(from);
    if (!p) p = this._createPeer(from);
    p.queue = p.queue.then(() => this._signal(p, data)).catch((e) => console.warn('sinal', e));
  }

  async _signal(p, data) {
    const pc = p.pc;
    if (pc.signalingState === 'closed') return;
    if (data.media) {
      p.remoteMedia = { camera: data.media.camera || null, screen: data.media.screen || null };
      this._classify(p);
      return;
    }
    if (data.description) {
      const d = data.description;
      const collision = d.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
      p.ignoreOffer = !p.polite && collision;
      if (p.ignoreOffer) return;
      await pc.setRemoteDescription({ type: d.type, sdp: this._bitrateSdp(d.sdp) });
      if (d.type === 'offer') {
        const ans = await pc.createAnswer();
        await pc.setLocalDescription({ type: 'answer', sdp: this._bitrateSdp(ans.sdp) });
        this.h.send({ type: 'signal', to: p.id, data: { description: pc.localDescription } });
      }
      if (!p.established) {
        p.established = true;
        if (p.pending) { p.pending = false; setTimeout(() => this._negotiate(p), 0); }
      }
    } else if (data.candidate) {
      try { await pc.addIceCandidate(data.candidate); } catch (e) { if (!p.ignoreOffer) throw e; }
    }
  }

  _onTrack(p, track, stream) {
    if (track.kind === 'audio') {
      if (p.audio.has(stream.id)) return;
      const a = new Audio();
      a.autoplay = true;
      a.srcObject = stream;
      const out = this.h.outputDevice && this.h.outputDevice();
      if (out && a.setSinkId) a.setSinkId(out).catch(() => {});
      const e = { a, stream, src: null, g: null };
      p.audio.set(stream.id, e);
      this._applyAudio(p, e);
      a.play().catch(() => {});
      stream.addEventListener('removetrack', () => {
        if (stream.getAudioTracks().length) return;
        a.srcObject = null;
        if (e.g) { try { e.src.disconnect(); e.g.disconnect(); } catch { /* já desligado */ } }
        p.audio.delete(stream.id);
      });
      return;
    }
    p.videos.set(stream.id, stream);
    const refresh = () => this._classify(p);
    stream.addEventListener('removetrack', refresh);
    track.addEventListener('ended', refresh);
    track.addEventListener('unmute', refresh);
    this._classify(p);
  }

  // Descobre qual vídeo recebido é a câmera e qual é a tela.
  _classify(p) {
    this._applyAudioAll(p); // o áudio da tela pode ter acabado de ser identificado
    for (const [sid, s] of p.videos) {
      if (!s.getVideoTracks().some((t) => t.readyState === 'live')) p.videos.delete(sid);
    }
    for (const kind of ['camera', 'screen']) {
      const sid = p.remoteMedia[kind];
      const stream = sid ? p.videos.get(sid) || null : null;
      if (p.shown[kind] !== stream) {
        p.shown[kind] = stream;
        this.h.onRemoteVideo(p.id, kind, stream);
      }
    }
  }

  getRemote(id, kind) {
    const p = this.peers.get(id);
    return p ? p.shown[kind] : null;
  }

  // Ajusta taxa de bits e fps de câmera e tela (o padrão do navegador é bem conservador).
  _tune(p) {
    const cfg = {
      screen: { kbps: this.screenPreset.kbps, fps: this.screenPreset.fps, pref: this.screenPreset.h >= 1080 ? 'maintain-resolution' : 'balanced' },
      camera: { kbps: 1500, fps: 30, pref: 'balanced' },
    };
    for (const kind of ['screen', 'camera']) {
      for (const s of p.senders[kind]) {
        if (!s.track || s.track.kind !== 'video') continue;
        const params = s.getParameters();
        if (!params.encodings || !params.encodings.length) continue;
        params.encodings[0].maxBitrate = cfg[kind].kbps * 1000;
        params.encodings[0].maxFramerate = cfg[kind].fps;
        params.degradationPreference = cfg[kind].pref;
        s.setParameters(params).catch(() => {
          delete params.degradationPreference;
          s.setParameters(params).catch(() => {});
        });
      }
    }
  }

  _addLocal(kind, stream) {
    for (const p of this.peers.values()) {
      this._announce(p);
      for (const t of stream.getTracks()) {
        const snd = p.pc.addTrack(t, stream);
        p.senders[kind].push(snd);
        if (kind === 'screen' && t.kind === 'video') this._preferCodecs(p.pc, snd);
      }
    }
  }
  _removeLocal(kind) {
    for (const p of this.peers.values()) {
      for (const s of p.senders[kind]) { try { p.pc.removeTrack(s); } catch { /* fechada */ } }
      p.senders[kind] = [];
    }
    this._announceAll();
  }

  async startCamera() {
    if (!this.active || this.cam) return false;
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
          ...(this.devices.cam ? { deviceId: { exact: this.devices.cam } } : {}),
        },
      });
    } catch (e) {
      this.h.onError(`Não consegui abrir a câmera (${e.name}).`);
      return false;
    }
    if (!this.active) { s.getTracks().forEach((t) => t.stop()); return false; }
    s.getVideoTracks()[0].addEventListener('ended', () => this.stopCamera());
    this.cam = s;
    this._addLocal('camera', s);
    this.h.onLocalVideo('camera', s);
    return true;
  }

  stopCamera(silent) {
    if (!this.cam) return;
    const s = this.cam;
    this.cam = null;
    this._removeLocal('camera');
    s.getTracks().forEach((t) => t.stop());
    if (!silent) this.h.onLocalVideo('camera', null);
  }

  async startScreen() {
    if (!this.active || this.screen) return false;
    if (!navigator.mediaDevices.getDisplayMedia) { this.h.onError('Este navegador não suporta compartilhamento de tela.'); return false; }
    let audio = true;
    let preset = this.screenPreset;
    if (this.h.pickScreen) {
      const pick = await this.h.pickScreen();
      if (!pick) return false;
      audio = pick.audio;
      preset = SCREEN_PRESETS[pick.quality] || preset;
      this._pickSurface = pick.surface || null;
    }
    this.screenPreset = preset;
    const videoC = { width: { ideal: preset.w, max: preset.w }, height: { ideal: preset.h, max: preset.h }, frameRate: { ideal: preset.fps, max: preset.fps } };
    let s;
    try {
      s = await navigator.mediaDevices.getDisplayMedia({
        video: videoC, audio, systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include',
      });
    } catch (e) {
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') this.h.onError('Falha ao compartilhar a tela: ' + e.message);
      return false;
    }
    if (!this.active) { s.getTracks().forEach((t) => t.stop()); return false; }
    const v = s.getVideoTracks()[0];
    if (v) {
      v.contentHint = preset.h >= 1080 ? 'detail' : 'motion';
      v.applyConstraints(videoC).catch(() => {});
      v.addEventListener('ended', () => this.stopScreen());
    }
    // tela inteira (monitor) ou janela: a prévia da tela inteira vira "espelho infinito"
    this.screenSurface = (v && v.getSettings && v.getSettings().displaySurface) || this._pickSurface || null;
    this.screen = s;
    this._addLocal('screen', s);
    this.h.onLocalVideo('screen', s);
    return true;
  }

  stopScreen(silent) {
    if (!this.screen) return;
    const s = this.screen;
    this.screen = null;
    this._removeLocal('screen');
    s.getTracks().forEach((t) => t.stop());
    if (!silent) this.h.onLocalVideo('screen', null);
  }

  // Detecta quando você está falando.
  _startDetector() {
    if (!this.mic || this._det) return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(this.mic);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let lastLoud = 0;
      const timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        const live = !(this.muted || this.deafened);
        if (live && rms > 0.015) lastLoud = now;
        const speaking = live && now - lastLoud < 300;
        if (speaking !== this.speaking) { this.speaking = speaking; this.h.onSpeaking(speaking); }
      }, 80);
      this._det = { ctx, timer };
    } catch (e) { console.warn('detector de voz', e); }
  }
  _stopDetector() {
    if (!this._det) return;
    clearInterval(this._det.timer);
    this._det.ctx.close();
    this._det = null;
    if (this.speaking) { this.speaking = false; this.h.onSpeaking(false); }
  }
}

window.Voice = Voice;
