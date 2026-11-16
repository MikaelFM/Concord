'use strict';
// Concord — servidor: HTTPS + WebSocket + salas + chat + sinalização WebRTC.
// Só usa módulos nativos do Node.js. Pode rodar sozinho (node server.js) ou dentro do app desktop.
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { acceptUpgrade } = require('./ws');

const PUBLIC = path.join(__dirname, 'public');
const MAX_PER_CHANNEL = 500;
const HISTORY_PAGE = 120;
const STATUSES = ['online', 'ausente', 'ocupado', 'invisivel'];
const MAX_UPLOAD = 100 * 1024 * 1024; // 100 MB por arquivo
const MAX_ATTACHMENTS = 10;
const MAX_CHANNELS = 60; // por servidor
const MAX_GUILDS = 100;
const BOT_ID = 'bot-musica';
const BOT_PROFILE = { name: 'DJ Galera', color: '#1ABC9C', avatar: null, bot: true };
const PALETTE = ['#5865F2', '#3BA55C', '#FAA61A', '#EB459E', '#ED4245', '#00A8FC', '#9B59B6', '#E67E22', '#1ABC9C', '#F47FFF'];
const DEFAULT_GUILD = 'galera';
const DEFAULT_CHANNELS = [
  { id: 'geral', guild: DEFAULT_GUILD, name: 'geral', type: 'text', createdBy: null, ts: 0 },
  { id: 'voz', guild: DEFAULT_GUILD, name: 'Sala de voz', type: 'voice', createdBy: null, ts: 0 },
];
// Permissões dos cargos
const PERMS = ['administrador', 'gerenciar_servidor', 'gerenciar_salas', 'gerenciar_cargos', 'expulsar', 'banir', 'gerenciar_mensagens',
  'desconectar_membros', 'silenciar_membros', 'mencionar_todos', 'criar_convites', 'enviar_mensagens', 'enviar_arquivos', 'reagir', 'conectar_voz', 'falar',
  'transmitir', 'usar_musica'];
const EVERYONE_PERMS = ['criar_convites', 'enviar_mensagens', 'enviar_arquivos', 'reagir', 'conectar_voz', 'falar', 'transmitir', 'usar_musica'];
const AUDIO_URL_RE = /^https?:\/\/[^\s]{4,480}\.(mp3|ogg|oga|opus|wav|m4a|aac|flac)(\?[^\s]*)?$/i;

function localIPv4() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push({ name, address: a.address });
    }
  }
  // Radmin primeiro
  return out.sort((a, b) => (b.address.startsWith('26.') ? 1 : 0) - (a.address.startsWith('26.') ? 1 : 0));
}

function findOpenSSL() {
  for (const c of ['openssl', 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', 'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe']) {
    try { execFileSync(c, ['version'], { stdio: 'ignore', windowsHide: true }); return c; } catch { /* próximo */ }
  }
  return null;
}

function loadCertificate(certDir, log) {
  const keyFile = path.join(certDir, 'key.pem');
  const certFile = path.join(certDir, 'cert.pem');
  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  const ossl = findOpenSSL();
  if (ossl) {
    const san = ['DNS:localhost', 'IP:127.0.0.1', ...localIPv4().map((i) => 'IP:' + i.address)].join(',');
    const cfg = path.join(certDir, 'openssl.cnf');
    fs.writeFileSync(cfg, ['[req]', 'distinguished_name=dn', 'x509_extensions=ext', 'prompt=no', '[dn]', 'CN=Concord',
      '[ext]', `subjectAltName=${san}`, 'basicConstraints=CA:FALSE', 'keyUsage=digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth', ''].join('\n'));
    try {
      execFileSync(ossl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-keyout', keyFile, '-out', certFile,
        '-days', '825', '-config', cfg], { stdio: 'ignore', windowsHide: true });
      log('  Certificado HTTPS gerado.');
      return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
    } catch { /* usa o padrão */ }
  }
  return {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'padrao', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'padrao', 'cert.pem')),
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg',
};
const UPLOAD_RE = /^\/uploads\/[a-f0-9]{24}\.(png|jpg|gif|webp)$/; // avatares
const SOUND_RE = /^\/uploads\/[a-f0-9]{24}\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|webm)$/; // sons do servidor
const SOUND_KINDS = ['join', 'leave', 'message', 'streamStart', 'streamEnd'];
const FILE_RE = /^\/uploads\/([a-f0-9]{24}(?:\.[a-z0-9]{1,8})?)$/;
const STORED_RE = /^[a-f0-9]{24}(?:\.[a-z0-9]{1,8})?$/;
// O que pode ser mostrado direto no chat; o resto é sempre servido como download.
const INLINE = {
  png: ['image', 'image/png'], jpg: ['image', 'image/jpeg'], jpeg: ['image', 'image/jpeg'], gif: ['image', 'image/gif'],
  webp: ['image', 'image/webp'], avif: ['image', 'image/avif'], bmp: ['image', 'image/bmp'],
  mp4: ['video', 'video/mp4'], webm: ['video', 'video/webm'], m4v: ['video', 'video/mp4'], ogv: ['video', 'video/ogg'], mov: ['video', 'video/mp4'],
  mp3: ['audio', 'audio/mpeg'], wav: ['audio', 'audio/wav'], ogg: ['audio', 'audio/ogg'], oga: ['audio', 'audio/ogg'], opus: ['audio', 'audio/ogg'],
  m4a: ['audio', 'audio/mp4'], aac: ['audio', 'audio/aac'], flac: ['audio', 'audio/flac'],
};
const extOf = (name) => { const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/); return m ? m[1] : ''; };
const kindOf = (ext) => (INLINE[ext] ? INLINE[ext][0] : 'file');
const COLOR_RE = /^#[0-9a-f]{6}$/i;

const cleanName = (n, max = 32) => String(n || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');

function start(opts = {}) {
  const PORT = Number(opts.port || process.env.PORT) || 3000;
  const DATA = opts.dataDir || process.env.DATA_DIR || path.join(__dirname, 'data');
  // servidor de apoio das chamadas (coturn), para quem não se conecta direto pela internet
  const TURN_HOST = opts.turnHost || process.env.TURN_HOST || '';
  const TURN_SECRET = opts.turnSecret || process.env.TURN_SECRET || '';
  // No servidor online: quando alguém abre o app, pede uma verificada rápida no GitHub
  // (o systemd vigia este arquivo e roda o atualizador). No máximo uma vez a cada 2 minutos.
  let lastPoke = 0;
  const pokeUpdate = () => {
    if (!process.env.CONCORD_REPO || Date.now() - lastPoke < 120000) return;
    lastPoke = Date.now();
    fs.writeFile(path.join(DATA, '.verificar-atualizacao'), String(lastPoke), () => {});
  };
  const iceFor = (uid) => {
    if (!TURN_HOST) return []; // rede local / Radmin: os PCs se enxergam direto
    const list = [{ urls: `stun:${TURN_HOST}:3478` }];
    if (TURN_SECRET) {
      const username = `${Math.floor(Date.now() / 1000) + 7 * 86400}:${uid}`; // vale 7 dias
      const credential = crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64');
      list.push({ urls: [`turn:${TURN_HOST}:3478?transport=udp`, `turn:${TURN_HOST}:3478?transport=tcp`], username, credential });
    }
    return list;
  };
  const UPLOADS = path.join(DATA, 'uploads');
  const CERTS = path.join(DATA, 'certs');
  const log = opts.log || (opts.quiet ? () => {} : (...a) => console.log(...a));
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.mkdirSync(CERTS, { recursive: true });

  // ---------- persistência ----------
  const FILES = {
    channels: path.join(DATA, 'canais.json'),
    messages: path.join(DATA, 'mensagens.json'),
    profiles: path.join(DATA, 'perfis.json'),
    accounts: path.join(DATA, 'contas.json'),
    sessions: path.join(DATA, 'sessoes.json'),
    guilds: path.join(DATA, 'servidores.json'),
    friends: path.join(DATA, 'amigos.json'),
    dms: path.join(DATA, 'conversas.json'),
  };
  const readJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
  const dirty = new Set();
  let saveTimer = null;

  let channels = readJSON(FILES.channels, null);
  if (!Array.isArray(channels) || !channels.length) channels = DEFAULT_CHANNELS.map((c) => ({ ...c }));
  for (const d of DEFAULT_CHANNELS) if (!channels.some((c) => c.id === d.id)) channels.unshift({ ...d });

  const messages = new Map(Object.entries(readJSON(FILES.messages, {})));
  for (const c of channels) if (!messages.has(c.id)) messages.set(c.id, []);
  // migra o histórico da primeira versão
  const oldFile = path.join(DATA, 'mensagens.jsonl');
  if (fs.existsSync(oldFile)) {
    const old = fs.readFileSync(oldFile, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).map((m) => ({ id: m.id, ch: 'geral', uid: m.userId, name: m.name, color: m.color, avatar: null,
        text: m.text || '', image: m.image || null, ts: m.ts, reactions: {} }));
    messages.set('geral', [...old, ...messages.get('geral')].slice(-MAX_PER_CHANNEL));
    try { fs.renameSync(oldFile, oldFile + '.migrado'); } catch { /* ignora */ }
  }
  const profiles = new Map(Object.entries(readJSON(FILES.profiles, {})));

  // ---------- contas ----------
  // contas.json: usuário -> { uid, salt, hash } (senha com scrypt, nunca guardada em texto)
  // sessoes.json: sha256(token) -> { uid, ts, last } (o token em si fica só no aparelho da pessoa)
  const accounts = new Map(Object.entries(readJSON(FILES.accounts, {})));
  const sessions = new Map(Object.entries(readJSON(FILES.sessions, {})));
  const uidToUser = new Map([...accounts].map(([u, a]) => [a.uid, u]));
  const USER_RE = /^[a-z0-9_.]{3,20}$/;
  const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
  const scrypt = (pw, salt) => new Promise((res, rej) =>
    crypto.scrypt(pw.normalize('NFC'), salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
  const SESSION_TTL = 60 * 864e5; // 60 dias sem uso
  for (const [k, v] of sessions) if (Date.now() - v.last > SESSION_TTL || !uidToUser.has(v.uid)) sessions.delete(k);

  function newSession(c, uid) {
    const token = rid(32);
    c.sessionHash = sha(token);
    sessions.set(c.sessionHash, { uid, ts: Date.now(), last: Date.now() });
    const mine = [...sessions].filter(([, x]) => x.uid === uid).sort((a, b) => a[1].last - b[1].last);
    while (mine.length > 10) sessions.delete(mine.shift()[0]);
    save('sessions');
    return token;
  }
  const authFails = new Map(); // ip -> [instantes]
  function authLimited(ip) {
    const now = Date.now();
    const list = (authFails.get(ip) || []).filter((t) => now - t < 5 * 60e3);
    authFails.set(ip, list);
    return list.length >= 10;
  }
  const noteFail = (ip) => authFails.set(ip, [...(authFails.get(ip) || []), Date.now()]);

  // ---------- servidores (comunidades) ----------
  // servidores.json: id -> { id, name, icon, ownerId, ts, roles[], members{uid:{roles,joined}}, bans{}, invites{} }
  const guilds = new Map(Object.entries(readJSON(FILES.guilds, {})));
  const newGuild = (id, name, ownerId) => ({
    id, name, icon: null, ownerId, ts: Date.now(),
    roles: [{ id, name: '@todos', color: null, perms: [...EVERYONE_PERMS], hoist: false, pos: 0 }],
    members: {}, bans: {}, invites: {},
  });
  if (!guilds.size) {
    // migração: o servidor que já existia vira o "Servidor da Galera", com todas as contas dentro
    const accs = [...accounts.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const g = newGuild(DEFAULT_GUILD, 'Servidor da Galera', accs[0] ? accs[0].uid : null);
    for (const a of accs) g.members[a.uid] = { roles: [], joined: a.ts || Date.now() };
    guilds.set(g.id, g);
    save('guilds');
  }
  for (const ch of channels) if (!ch.guild) { ch.guild = DEFAULT_GUILD; delete ch.fixed; save('channels'); }

  // ---------- amizades e conversas privadas ----------
  // amigos.json: uid -> { friends: [], in: [] (pedidos recebidos), out: [] (pedidos enviados) }
  // conversas.json: id -> { id, type: 'dm', members: [uidA, uidB], ts }
  const relations = new Map(Object.entries(readJSON(FILES.friends, {})));
  const dms = new Map(Object.entries(readJSON(FILES.dms, {})));
  for (const id of dms.keys()) if (!messages.has(id)) messages.set(id, []);
  // Modo simples: todo mundo que já criou conta neste servidor é amigo de todo mundo
  // (sem pedidos de amizade). As funções de pedido continuam aqui, mas sem efeito.
  const rel = (uid) => ({ friends: [...uidToUser.keys()].filter((u) => u !== uid), in: [], out: [] });
  const areFriends = (a, b) => a !== b && uidToUser.has(a) && uidToUser.has(b);
  function unlink(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const r = rel(x);
      r.friends = r.friends.filter((u) => u !== y);
      r.in = r.in.filter((u) => u !== y);
      r.out = r.out.filter((u) => u !== y);
    }
  }

  function save(...what) {
    what.forEach((w) => dirty.add(w));
    if (saveTimer) return;
    saveTimer = setTimeout(flush, 800);
  }
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const write = (file, data) => {
      const tmp = file + '.tmp';
      try { fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, file); } catch (e) { console.error('Falha ao salvar', file, e.message); }
    };
    if (dirty.has('channels')) write(FILES.channels, channels);
    if (dirty.has('messages')) write(FILES.messages, Object.fromEntries(messages));
    if (dirty.has('profiles')) write(FILES.profiles, Object.fromEntries(profiles));
    if (dirty.has('accounts')) write(FILES.accounts, Object.fromEntries(accounts));
    if (dirty.has('sessions')) write(FILES.sessions, Object.fromEntries(sessions));
    if (dirty.has('guilds')) write(FILES.guilds, Object.fromEntries(guilds));
    if (dirty.has('friends')) write(FILES.friends, Object.fromEntries(relations));
    if (dirty.has('dms')) write(FILES.dms, Object.fromEntries(dms));
    dirty.clear();
  }

  // ---------- HTTP ----------
  function serveFile(res, base, rel, extra = {}) {
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base + path.sep)) { res.writeHead(404); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end('Não encontrado'); }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff', ...extra,
      });
      fs.createReadStream(file).pipe(res);
    });
  }
  const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  function handleUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token || ![...clients.values()].some((c) => c.token === token)) return json(res, 401, { erro: 'não autorizado' });
    let name = 'arquivo';
    try { name = cleanName(decodeURIComponent(req.headers['x-filename'] || ''), 120) || 'arquivo'; } catch { /* nome inválido */ }
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_UPLOAD) { json(res, 413, { erro: 'arquivo muito grande (máx. 100 MB)' }); return req.destroy(); }
    const ext = extOf(name);
    const stored = rid(12) + (ext ? '.' + ext : '');
    const final = path.join(UPLOADS, stored);
    const tmp = final + '.part';
    const out = fs.createWriteStream(tmp);
    let size = 0;
    let failed = false;
    const fail = (code, msg) => {
      if (failed) return;
      failed = true;
      out.destroy();
      fs.unlink(tmp, () => {});
      if (!res.headersSent) json(res, code, { erro: msg });
      req.destroy();
    };
    req.on('data', (c) => { size += c.length; if (size > MAX_UPLOAD) fail(413, 'arquivo muito grande (máx. 100 MB)'); });
    req.on('aborted', () => fail(400, 'envio interrompido'));
    req.on('error', () => fail(400, 'envio interrompido'));
    out.on('error', () => fail(500, 'falha ao salvar'));
    out.on('finish', () => {
      if (failed) return;
      if (!size) { fs.unlink(tmp, () => {}); return json(res, 400, { erro: 'arquivo vazio' }); }
      fs.rename(tmp, final, (err) => {
        if (err) return json(res, 500, { erro: 'falha ao salvar' });
        json(res, 200, { url: '/uploads/' + stored, name, size, kind: kindOf(ext) });
      });
    });
    req.pipe(out);
  }

  // Arquivos enviados: com suporte a Range (para avançar vídeo/áudio) e sempre isolados (sandbox).
  function serveUpload(req, res, url) {
    const stored = decodeURIComponent(url.pathname.slice(9));
    if (!STORED_RE.test(stored)) { res.writeHead(404); return res.end(); }
    const file = path.join(UPLOADS, stored);
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end('Não encontrado'); }
      const ext = extOf(stored);
      const inline = INLINE[ext] && url.searchParams.get('baixar') === null;
      const dlName = cleanName(url.searchParams.get('n') || '', 120) || stored;
      const headers = {
        'Content-Type': inline ? INLINE[ext][1] : 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'",
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
        'Content-Disposition': (inline ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(dlName),
      };
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range && (range[1] || range[2])) {
        let startB = range[1] ? Number(range[1]) : st.size - Number(range[2]);
        let endB = range[1] && range[2] ? Number(range[2]) : st.size - 1;
        if (startB < 0) startB = 0;
        if (endB >= st.size) endB = st.size - 1;
        if (startB > endB) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${startB}-${endB}/${st.size}`, 'Content-Length': endB - startB + 1 });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(file, { start: startB, end: endB }).pipe(res);
      }
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  // Valida os anexos de uma mensagem (só arquivos que existem de verdade aqui).
  function cleanAttachments(list) {
    const out = [];
    for (const a of (Array.isArray(list) ? list : []).slice(0, MAX_ATTACHMENTS)) {
      const mm = a && typeof a.url === 'string' && FILE_RE.exec(a.url);
      if (!mm) continue;
      let st;
      try { st = fs.statSync(path.join(UPLOADS, mm[1])); } catch { continue; }
      out.push({ url: a.url, name: cleanName(a.name, 120) || mm[1], size: st.size, kind: kindOf(extOf(mm[1])) });
    }
    return out;
  }

  // ---------- atualização automática do app (.exe) ----------
  // O app dos amigos compara estes arquivos com os dele e baixa os que mudaram.
  const APP_ROOT = __dirname;
  let manifestCache = null;
  function updateManifest() {
    if (manifestCache && Date.now() - manifestCache.at < 5000) return manifestCache.data;
    const files = {};
    const add = (rel) => {
      try { files[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(APP_ROOT, rel))).digest('hex'); } catch { /* ignora */ }
    };
    const walk = (dir, re) => {
      let list = [];
      try { list = fs.readdirSync(path.join(APP_ROOT, dir), { withFileTypes: true }); } catch { return; }
      for (const e of list) {
        const rel = dir + '/' + e.name;
        if (e.isDirectory()) walk(rel, re);
        else if (re.test(e.name)) add(rel);
      }
    };
    for (const f of ['server.js', 'ws.js', 'package.json']) add(f);
    walk('desktop', /\.(js|json|html|png|ico)$/i);
    delete files['desktop/update-source.json'];
    walk('public', /\.(js|json|html|css|png|ico|svg|woff2?|mp3|ogg|wav)$/i);
    let version = '0.0.0';
    try { version = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')).version; } catch { /* ignora */ }
    let notes = [];
    try { notes = (JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'public', 'novidades.json'), 'utf8')).find((x) => x.version === version) || {}).items || []; } catch { /* sem notas */ }
    manifestCache = { at: Date.now(), data: { version, notes, files } };
    return manifestCache.data;
  }

  function onRequest(req, res) {
    const url = new URL(req.url, 'https://x');
    if (req.method === 'POST' && url.pathname === '/upload') return handleUpload(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (url.pathname === '/info') return json(res, 200, { port: PORT, addresses: localIPv4().map((i) => i.address) });
    if (url.pathname === '/baixar') { // instalador mais novo, publicado no GitHub
      res.writeHead(302, { Location: `https://github.com/${process.env.CONCORD_REPO || 'MikaelFM/Concord'}/releases/latest/download/Concord-Instalador.exe` });
      return res.end();
    }
    if (url.pathname === '/atualizacao') return json(res, 200, updateManifest());
    if (url.pathname === '/atualizacao/arquivo') {
      const files = updateManifest().files;
      const rel = url.searchParams.get('p') || '';
      if (!files[rel]) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' });
      return fs.createReadStream(path.join(APP_ROOT, rel)).pipe(res);
    }
    if (url.pathname.startsWith('/uploads/')) return serveUpload(req, res, url);
    const rel = url.pathname === '/' || url.pathname.startsWith('/convite/') ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    serveFile(res, PUBLIC, rel, { 'Cache-Control': 'no-cache' });
  }

  // ---------- tempo real ----------
  const clients = new Map(); // uid -> cliente
  const callStart = new Map(); // sala de voz -> instante em que a chamada começou
  const music = new Map(); // sala de voz -> { queue, current }
  const musicTimers = new Map();

  const publicUser = (c) => ({
    id: c.id, username: c.username, name: c.name, color: c.color, avatar: c.avatar, activity: c.activity || null,
    voice: c.voice, muted: c.muted, deafened: c.deafened, sharing: c.sharing, camera: c.camera, speaking: c.speaking,
    status: c.status || 'online', afk: !!c.afk,
  });
  const channelInfo = (ch) => {
    const list = messages.get(ch.id) || [];
    const last = list[list.length - 1];
    return { ...ch, lastTs: last ? last.ts : 0, lastUid: last ? last.uid : null, callStart: callStart.get(ch.id) || null };
  };
  const publicGuild = (g) => ({ id: g.id, name: g.name, icon: g.icon, ownerId: g.ownerId, roles: g.roles, members: g.members, sounds: g.sounds || {} });
  function broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const c of clients.values()) if (c !== except) c.ws.send(s);
  }
  // só para quem é membro do servidor
  function toGuild(gid, obj, except) {
    const g = guilds.get(gid);
    if (!g) return;
    const s = JSON.stringify(obj);
    for (const c of clients.values()) if (c !== except && g.members[c.id]) c.ws.send(s);
  }
  const sendTo = (c, obj) => c.ws.send(JSON.stringify(obj));
  const sendGuild = (g) => toGuild(g.id, { type: 'guild', guild: publicGuild(g) });
  function voiceReset(c) { c.voice = null; c.muted = false; c.deafened = false; c.sharing = false; c.camera = false; c.speaking = false; }
  const findChannel = (id) => channels.find((c) => c.id === id) || dms.get(id) || null;
  const DM_PERMS = new Set(['enviar_mensagens', 'enviar_arquivos', 'reagir']);
  function canSee(c, ch) {
    if (!ch) return false;
    if (ch.type === 'dm') return ch.members.includes(c.id);
    return isMember(guildOfChannel(ch), c.id);
  }
  const chPerms = (ch, uid) => (ch.type === 'dm' ? DM_PERMS : permsOf(guildOfChannel(ch), uid));
  function toChannel(ch, obj, except) {
    if (ch.type !== 'dm') return toGuild(ch.guild, obj, except);
    const s = JSON.stringify(obj);
    for (const uid of ch.members) { const u = clients.get(uid); if (u && u !== except) u.ws.send(s); }
  }
  function sendRel(uid) { const u = clients.get(uid); if (u) sendTo(u, { type: 'relations', relations: rel(uid) }); }
  const sharesGuild = (a, b) => [...guilds.values()].some((g) => g.members[a] && g.members[b]);
  const findMsg = (ch, id) => (messages.get(ch) || []).find((m) => m.id === id);
  const err = (c, message) => sendTo(c, { type: 'error', message });

  function limited(c, key, max, windowMs) {
    const now = Date.now();
    c.rate = c.rate || {};
    const arr = (c.rate[key] = (c.rate[key] || []).filter((t) => now - t < windowMs));
    if (arr.length >= max) return true;
    arr.push(now);
    return false;
  }

  // ---------- permissões ----------
  function permsOf(g, uid) {
    if (!g || !g.members[uid]) return new Set();
    if (g.ownerId === uid) return new Set(PERMS);
    const mine = new Set(g.members[uid].roles);
    const out = new Set();
    for (const r of g.roles) if (r.id === g.id || mine.has(r.id)) for (const p of r.perms) out.add(p);
    return out.has('administrador') ? new Set(PERMS) : out;
  }
  const can = (g, uid, perm) => permsOf(g, uid).has(perm);
  function topPos(g, uid) {
    if (g.ownerId === uid) return Infinity;
    const mine = new Set((g.members[uid] || { roles: [] }).roles);
    return Math.max(0, ...g.roles.filter((r) => mine.has(r.id)).map((r) => r.pos));
  }
  const outranks = (g, a, b) => b !== g.ownerId && topPos(g, a) > topPos(g, b);
  const guildOfChannel = (ch) => (ch ? guilds.get(ch.guild) : null);
  const isMember = (g, uid) => !!(g && g.members[uid]);
  function normalizeRoles(g) {
    g.roles.sort((a, b) => a.pos - b.pos);
    g.roles.forEach((r, i) => { r.pos = i; });
  }

  function setProfile(c, p) {
    const name = cleanName(p.name);
    if (name) c.name = name;
    if (typeof p.color === 'string' && COLOR_RE.test(p.color)) c.color = p.color;
    if (p.avatar === null || (typeof p.avatar === 'string' && UPLOAD_RE.test(p.avatar))) c.avatar = p.avatar;
    profiles.set(c.id, { ...(profiles.get(c.id) || {}), name: c.name, color: c.color, avatar: c.avatar });
    save('profiles');
  }

  function channelName(raw, type) {
    let n = cleanName(raw, 40);
    if (type === 'text') n = n.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return n;
  }

  // tudo o que o cliente precisa saber de um servidor
  function guildPayload(g) {
    const chs = channels.filter((ch) => ch.guild === g.id);
    const mus = {};
    for (const ch of chs) if (music.has(ch.id)) mus[ch.id] = musicState(ch.id);
    return { guild: publicGuild(g), channels: chs.map(channelInfo), music: mus };
  }

  // Coloca a pessoa já autenticada para dentro.
  function enter(c, uid, p) {
    if (c.ws.closed) return;
    c.id = uid;
    c.username = uidToUser.get(uid);
    const saved = profiles.get(uid) || {};
    c.name = saved.name || c.username;
    c.color = saved.color || PALETTE[Math.floor(Math.random() * PALETTE.length)];
    c.avatar = saved.avatar || null;
    c.activity = null;
    c.status = STATUSES.includes(saved.status) ? saved.status : 'online';
    c.afk = false;
    if (p || !profiles.has(uid)) setProfile(c, p || {});
    // contas novas entram no servidor principal
    const home = guilds.get(DEFAULT_GUILD);
    if (home && !home.members[uid] && !home.bans[uid] && p) {
      home.members[uid] = { roles: [], joined: Date.now() };
      if (!home.ownerId) home.ownerId = uid;
      save('guilds');
      sendGuild(home);
    }
    const old = clients.get(c.id);
    if (old) {
      old.replaced = true;
      clients.delete(c.id);
      sendTo(old, { type: 'replaced' });
      if (old.voice) leaveVoice(old, true);
      broadcast({ type: 'user-leave', id: c.id }, old);
      old.ws.destroy();
    }
    c.ready = true;
    clients.set(c.id, c);
    pokeUpdate();
    const mine = [...guilds.values()].filter((g) => g.members[uid]);
    sendTo(c, {
      type: 'welcome', you: publicUser(c), token: c.token, username: c.username, now: Date.now(), perms: PERMS, ice: iceFor(uid),
      users: [...clients.values()].map(publicUser),
      profiles: { ...Object.fromEntries(profiles), [BOT_ID]: BOT_PROFILE },
      guilds: mine.map(guildPayload),
      relations: rel(uid),
      dms: [...dms.values()].filter((d) => d.members.includes(uid)).map(channelInfo),
    });
    broadcast({ type: 'user-join', user: publicUser(c) }, c);
    log(`  + ${c.name} (@${c.username}) entrou (${clients.size} online)`);
  }

  async function auth(c, m) {
    if (c.ready || c.authBusy) return;
    const fail = (message) => sendTo(c, { type: 'auth-error', message });
    if (m.type === 'hello') {
      const s = typeof m.session === 'string' ? sessions.get(sha(m.session)) : null;
      if (!s || !uidToUser.has(s.uid)) return sendTo(c, { type: 'auth-error', expired: true, message: 'Sua sessão expirou. Entre de novo.' });
      s.last = Date.now();
      c.sessionHash = sha(m.session);
      save('sessions');
      return enter(c, s.uid, null);
    }
    if (authLimited(c.ip)) return fail('Muitas tentativas. Espere alguns minutos e tente de novo.');
    const username = String(m.username || '').trim().toLowerCase();
    const password = typeof m.password === 'string' ? m.password : '';
    c.authBusy = true;
    try {
      if (m.type === 'register') {
        noteFail(c.ip); // conta como tentativa para evitar criação em massa
        if (!USER_RE.test(username)) return fail('O usuário deve ter de 3 a 20 caracteres: letras minúsculas, números, _ ou ponto.');
        if (password.length < 6 || password.length > 128) return fail('A senha precisa ter pelo menos 6 caracteres.');
        if (accounts.has(username)) return fail('Esse nome de usuário já está em uso.');
        let uid = null;
        if (typeof m.secret === 'string' && /^[a-f0-9]{32,128}$/.test(m.secret)) {
          const legacy = sha('dl:' + m.secret).slice(0, 16);
          if (!uidToUser.has(legacy)) uid = legacy; // herda o perfil e as mensagens de antes das contas
        }
        uid = uid || rid(8);
        const salt = rid(16);
        const hash = await scrypt(password, salt);
        if (accounts.has(username)) return fail('Esse nome de usuário já está em uso.');
        accounts.set(username, { uid, salt, hash, ts: Date.now() });
        uidToUser.set(uid, username);
        save('accounts');
        const session = newSession(c, uid);
        sendTo(c, { type: 'auth-ok', session, username });
        log(`  * conta criada: @${username}`);
        setTimeout(() => { for (const u of clients.keys()) if (u !== uid) sendRel(u); }, 50); // aparece na lista de todos
        return enter(c, uid, { name: cleanName(m.name) || username, color: m.color, avatar: m.avatar });
      }
      // login
      const acc = accounts.get(username);
      const hash = await scrypt(password, acc ? acc.salt : '0'.repeat(32));
      if (!acc || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(acc.hash, 'hex'))) {
        noteFail(c.ip);
        return fail('Usuário ou senha incorretos.');
      }
      const session = newSession(c, acc.uid);
      sendTo(c, { type: 'auth-ok', session, username });
      return enter(c, acc.uid, null);
    } finally {
      c.authBusy = false;
    }
  }

  async function changePassword(c, m) {
    if (c.authBusy) return;
    const acc = accounts.get(c.username);
    if (!acc) return;
    if (authLimited(c.ip)) return sendTo(c, { type: 'password-result', ok: false, message: 'Muitas tentativas. Espere alguns minutos.' });
    const nova = typeof m.newPassword === 'string' ? m.newPassword : '';
    if (nova.length < 6 || nova.length > 128) return sendTo(c, { type: 'password-result', ok: false, message: 'A nova senha precisa ter pelo menos 6 caracteres.' });
    c.authBusy = true;
    try {
      const hash = await scrypt(typeof m.oldPassword === 'string' ? m.oldPassword : '', acc.salt);
      if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(acc.hash, 'hex'))) {
        noteFail(c.ip);
        return sendTo(c, { type: 'password-result', ok: false, message: 'A senha atual está errada.' });
      }
      acc.salt = rid(16);
      acc.hash = await scrypt(nova, acc.salt);
      for (const [k, v] of sessions) if (v.uid === c.id && k !== c.sessionHash) sessions.delete(k);
      save('accounts', 'sessions');
      sendTo(c, { type: 'password-result', ok: true, message: 'Senha alterada. Os outros aparelhos vão precisar entrar de novo.' });
    } finally {
      c.authBusy = false;
    }
  }

  // ---------- chamada ----------
  function updateCall(chId) {
    const ch = findChannel(chId);
    if (!ch) return;
    const someone = [...clients.values()].some((u) => u.voice === chId);
    if (someone && !callStart.has(chId)) callStart.set(chId, Date.now());
    else if (!someone && callStart.has(chId)) {
      callStart.delete(chId);
      if (music.has(chId)) { clearTimeout(musicTimers.get(chId)); music.delete(chId); toChannel(ch, { type: 'music', ch: chId, state: null, now: Date.now() }); }
    } else return;
    toChannel(ch, { type: 'call', ch: chId, start: callStart.get(chId) || null });
    if (ch.type === 'dm' && !someone) for (const uid of ch.members) { const u = clients.get(uid); if (u) sendTo(u, { type: 'dm-ring-stop', ch: chId }); }
  }

  function leaveVoice(c, silent) {
    if (!c.voice) return;
    const ch = c.voice;
    voiceReset(c);
    if (!silent) broadcast({ type: 'user-update', user: publicUser(c) });
    updateCall(ch);
  }

  // ---------- bot de música ----------
  function musicState(chId) {
    const st = music.get(chId);
    if (!st) return null;
    return { queue: st.queue, current: st.current };
  }
  function musicPush(chId) {
    const ch = findChannel(chId);
    if (ch) toGuild(ch.guild, { type: 'music', ch: chId, state: musicState(chId), now: Date.now() });
  }
  function botSay(chId, text) {
    const list = messages.get(chId);
    if (!list) return;
    const msg = { id: rid(), ch: chId, uid: BOT_ID, name: BOT_PROFILE.name, color: BOT_PROFILE.color, avatar: null, bot: true, text, attachments: [], ts: Date.now(), reactions: {} };
    list.push(msg);
    if (list.length > MAX_PER_CHANNEL) list.splice(0, list.length - MAX_PER_CHANNEL);
    save('messages');
    toGuild(findChannel(chId).guild, { type: 'chat', message: msg });
  }
  function scheduleEnd(chId) {
    clearTimeout(musicTimers.get(chId));
    const st = music.get(chId);
    const cur = st && st.current;
    if (!cur || cur.pausedAt != null || !cur.duration) return;
    const left = cur.startedAt + cur.duration * 1000 - Date.now();
    musicTimers.set(chId, setTimeout(() => musicNext(chId, cur.id), Math.max(0, left) + 800));
  }
  function musicNext(chId, endedId) {
    const st = music.get(chId);
    if (!st) return;
    if (endedId && (!st.current || st.current.id !== endedId)) return;
    clearTimeout(musicTimers.get(chId));
    const next = st.queue.shift();
    st.current = next ? { ...next, startedAt: Date.now() + 600, pausedAt: null, duration: next.duration || null } : null;
    if (next) botSay(chId, `Tocando agora: **${next.name}** (pedido por ${next.byName})`);
    musicPush(chId);
    scheduleEnd(chId);
  }
  function handleMusic(c, m) {
    const ch = findChannel(m.ch);
    const g = guildOfChannel(ch);
    if (!ch || ch.type !== 'voice' || !isMember(g, c.id)) return;
    if (c.voice !== ch.id) return err(c, 'Entre na chamada para usar o bot de música.');
    if (!can(g, c.id, 'usar_musica')) return err(c, 'Você não tem permissão para usar o bot de música.');
    let st = music.get(ch.id);
    switch (m.action) {
      case 'add': {
        const items = (Array.isArray(m.items) ? m.items : []).slice(0, 50).map((it) => {
          if (!it || typeof it.url !== 'string') return null;
          const fm = FILE_RE.exec(it.url);
          if (fm) {
            if (kindOf(extOf(fm[1])) !== 'audio' && kindOf(extOf(fm[1])) !== 'video') return null;
            if (!fs.existsSync(path.join(UPLOADS, fm[1]))) return null;
          } else if (!AUDIO_URL_RE.test(it.url)) return null;
          const fallback = decodeURIComponent(it.url.split('/').pop().split('?')[0]).replace(/\.[a-z0-9]+$/i, '');
          return { id: rid(6), url: it.url, name: cleanName(it.name, 120).replace(/\.[a-z0-9]{2,5}$/i, '') || fallback || 'música', by: c.id, byName: c.name };
        }).filter(Boolean);
        if (!items.length) return err(c, 'Não deu para adicionar: use arquivos de áudio ou links diretos para .mp3, .ogg, .wav, .m4a ou .flac.');
        if (!st) { st = { queue: [], current: null }; music.set(ch.id, st); }
        if (st.queue.length + items.length > 200) return err(c, 'A fila está cheia (máx. 200 músicas).');
        st.queue.push(...items);
        if (!st.current) musicNext(ch.id);
        else {
          botSay(ch.id, items.length === 1 ? `**${items[0].name}** entrou na fila (posição ${st.queue.length}).` : `${items.length} músicas entraram na fila.`);
          musicPush(ch.id);
        }
        return;
      }
      case 'skip':
        if (st && st.current) { botSay(ch.id, `${c.name} pulou **${st.current.name}**.`); musicNext(ch.id); }
        return;
      case 'pause':
        if (!st || !st.current || st.current.pausedAt != null) return;
        st.current.pausedAt = Math.max(0, (Date.now() - st.current.startedAt) / 1000);
        clearTimeout(musicTimers.get(ch.id));
        return musicPush(ch.id);
      case 'resume':
        if (!st || !st.current || st.current.pausedAt == null) return;
        st.current.startedAt = Date.now() - st.current.pausedAt * 1000 + 300;
        st.current.pausedAt = null;
        musicPush(ch.id);
        return scheduleEnd(ch.id);
      case 'seek': {
        if (!st || !st.current) return;
        const pos = Math.max(0, Number(m.pos) || 0);
        if (st.current.duration && pos > st.current.duration) return;
        if (st.current.pausedAt != null) st.current.pausedAt = pos;
        else st.current.startedAt = Date.now() - pos * 1000 + 300;
        musicPush(ch.id);
        return scheduleEnd(ch.id);
      }
      case 'stop':
        if (!st) return;
        clearTimeout(musicTimers.get(ch.id));
        music.delete(ch.id);
        botSay(ch.id, `${c.name} parou a música e limpou a fila.`);
        return musicPush(ch.id);
      case 'remove':
        if (!st) return;
        st.queue = st.queue.filter((x) => x.id !== m.id);
        return musicPush(ch.id);
      case 'shuffle':
        if (!st) return;
        for (let i = st.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [st.queue[i], st.queue[j]] = [st.queue[j], st.queue[i]]; }
        return musicPush(ch.id);
      case 'duration': {
        const d = Number(m.duration);
        if (!st || !st.current || st.current.id !== m.track || st.current.duration || !(d > 0 && d < 6 * 3600)) return;
        st.current.duration = d;
        scheduleEnd(ch.id);
        return musicPush(ch.id);
      }
      case 'ended': {
        // reserva: se o servidor ainda não sabe a duração, quem terminou de ouvir avisa
        if (!st || !st.current || st.current.id !== m.track || st.current.pausedAt != null) return;
        if (Date.now() - st.current.startedAt < 3000) return;
        return musicNext(ch.id, m.track);
      }
    }
  }

  // ---------- servidores, convites, cargos ----------
  function removeMember(g, uid, reason) {
    if (!g.members[uid]) return;
    const u = clients.get(uid);
    if (u && u.voice && findChannel(u.voice) && findChannel(u.voice).guild === g.id) leaveVoice(u);
    delete g.members[uid];
    save('guilds');
    if (u) sendTo(u, { type: 'guild-removed', id: g.id, reason });
    sendGuild(g);
  }
  const inviteCode = () => { const abc = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (const b of crypto.randomBytes(8)) s += abc[b % abc.length]; return s; };
  function findInvite(code) {
    code = String(code || '').trim().replace(/^.*\/convite\//, '').toLowerCase();
    for (const g of guilds.values()) {
      const inv = g.invites[code];
      if (!inv) continue;
      if ((inv.exp && Date.now() > inv.exp) || (inv.max && inv.uses >= inv.max)) { delete g.invites[code]; save('guilds'); return null; }
      return { g, inv, code };
    }
    return null;
  }

  function handleGuild(c, m) {
    const g = guilds.get(m.gid);
    switch (m.type) {
      case 'guild-create': {
        const name = cleanName(m.name, 50);
        if (!name) return err(c, 'Dê um nome para o servidor.');
        if (guilds.size >= MAX_GUILDS) return err(c, 'Limite de servidores atingido.');
        if ([...guilds.values()].filter((x) => x.ownerId === c.id).length >= 10) return err(c, 'Você já é dono de 10 servidores.');
        if (limited(c, 'guild', 3, 60000)) return err(c, 'Espere um pouco para criar outro servidor.');
        const ng = newGuild(rid(6), name, c.id);
        if (typeof m.icon === 'string' && UPLOAD_RE.test(m.icon)) ng.icon = m.icon;
        ng.members[c.id] = { roles: [], joined: Date.now() };
        guilds.set(ng.id, ng);
        channels.push({ id: rid(6), guild: ng.id, name: 'geral', type: 'text', createdBy: c.id, ts: Date.now() });
        channels.push({ id: rid(6), guild: ng.id, name: 'Geral', type: 'voice', createdBy: c.id, ts: Date.now() });
        for (const ch of channels.filter((x) => x.guild === ng.id)) messages.set(ch.id, []);
        const added = (Array.isArray(m.friends) ? m.friends : []).filter((u) => typeof u === 'string' && areFriends(c.id, u)).slice(0, 100);
        for (const u of added) ng.members[u] = { roles: [], joined: Date.now() };
        save('guilds', 'channels', 'messages');
        sendTo(c, { type: 'guild-join', ...guildPayload(ng), created: true });
        for (const u of added) { const t = clients.get(u); if (t) sendTo(t, { type: 'guild-join', ...guildPayload(ng), added: true, by: c.name }); }
        log(`  * ${c.name} criou o servidor ${name}`);
        return;
      }
      case 'invite-info': {
        const f = findInvite(m.code);
        if (!f) return sendTo(c, { type: 'invite-info', ok: false, message: 'Convite inválido ou expirado.' });
        return sendTo(c, { type: 'invite-info', ok: true, code: f.code, guild: { id: f.g.id, name: f.g.name, icon: f.g.icon, members: Object.keys(f.g.members).length,
          online: Object.keys(f.g.members).filter((u) => clients.has(u)).length }, member: !!f.g.members[c.id] });
      }
      case 'invite-join': {
        const f = findInvite(m.code);
        if (!f) return err(c, 'Convite inválido ou expirado.');
        if (f.g.bans[c.id]) return err(c, 'Você foi banido desse servidor.');
        if (f.g.members[c.id]) return sendTo(c, { type: 'guild-join', ...guildPayload(f.g) });
        f.g.members[c.id] = { roles: [], joined: Date.now() };
        f.inv.uses = (f.inv.uses || 0) + 1;
        if (f.inv.max && f.inv.uses >= f.inv.max) delete f.g.invites[f.code];
        save('guilds');
        sendTo(c, { type: 'guild-join', ...guildPayload(f.g) });
        sendGuild(f.g);
        return;
      }
    }
    if (!g || !isMember(g, c.id)) return;
    const P = permsOf(g, c.id);
    switch (m.type) {
      case 'guild-update': {
        if (!P.has('gerenciar_servidor')) return err(c, 'Sem permissão para editar o servidor.');
        const name = cleanName(m.name, 50);
        if (name) g.name = name;
        if (m.icon === null || (typeof m.icon === 'string' && UPLOAD_RE.test(m.icon))) g.icon = m.icon;
        if (m.sounds && typeof m.sounds === 'object') {
          const snd = { ...(g.sounds || {}) };
          for (const k of SOUND_KINDS) {
            if (!(k in m.sounds)) continue;
            const v = m.sounds[k];
            if (v === null) delete snd[k];
            else if (v && typeof v.url === 'string' && SOUND_RE.test(v.url)) snd[k] = { url: v.url, name: cleanName(v.name, 80) || 'som', vol: Math.max(0.05, Math.min(1, Number(v.vol) || 1)) };
          }
          g.sounds = snd;
        }
        save('guilds');
        return sendGuild(g);
      }
      case 'guild-delete': {
        if (g.ownerId !== c.id) return err(c, 'Só o dono pode apagar o servidor.');
        for (const ch of channels.filter((x) => x.guild === g.id)) {
          for (const u of clients.values()) if (u.voice === ch.id) leaveVoice(u);
          messages.delete(ch.id);
          music.delete(ch.id);
        }
        toGuild(g.id, { type: 'guild-removed', id: g.id, reason: 'deleted' });
        channels = channels.filter((x) => x.guild !== g.id);
        guilds.delete(g.id);
        save('guilds', 'channels', 'messages');
        return;
      }
      case 'guild-leave':
        if (g.ownerId === c.id) return err(c, 'Você é o dono: passe o servidor para outra pessoa ou apague-o.');
        return removeMember(g, c.id, 'left');
      case 'guild-transfer': {
        if (g.ownerId !== c.id || !g.members[m.uid]) return;
        g.ownerId = m.uid;
        save('guilds');
        return sendGuild(g);
      }
      case 'guild-add-friends': {
        if (!P.has('criar_convites')) return err(c, 'Você não tem permissão para chamar pessoas para este servidor.');
        const list = (Array.isArray(m.uids) ? m.uids : []).filter((u) => typeof u === 'string' && areFriends(c.id, u) && !g.members[u] && !g.bans[u]).slice(0, 100);
        if (!list.length) return;
        for (const u of list) g.members[u] = { roles: [], joined: Date.now() };
        save('guilds');
        sendGuild(g);
        for (const u of list) { const t = clients.get(u); if (t) sendTo(t, { type: 'guild-join', ...guildPayload(g), added: true, by: c.name }); }
        return sendTo(c, { type: 'friend-result', ok: true, message: list.length === 1 ? 'Pessoa adicionada ao servidor.' : `${list.length} pessoas adicionadas ao servidor.` });
      }
      case 'invite-create': {
        if (!P.has('criar_convites')) return err(c, 'Sem permissão para criar convites.');
        if (Object.keys(g.invites).length >= 50) return err(c, 'Limite de convites atingido. Apague alguns.');
        const code = inviteCode();
        const hours = Math.max(0, Math.min(24 * 30, Number(m.hours) || 0));
        g.invites[code] = { by: c.id, ts: Date.now(), uses: 0, max: Math.max(0, Math.min(1000, Number(m.max) || 0)), exp: hours ? Date.now() + hours * 3600e3 : 0 };
        save('guilds');
        return sendTo(c, { type: 'invite-created', gid: g.id, code, invite: g.invites[code] });
      }
      case 'invite-list':
        if (!P.has('gerenciar_servidor')) return;
        return sendTo(c, { type: 'invite-list', gid: g.id, invites: g.invites });
      case 'invite-delete':
        if (!g.invites[m.code] || (!P.has('gerenciar_servidor') && g.invites[m.code].by !== c.id)) return;
        delete g.invites[m.code];
        save('guilds');
        return sendTo(c, { type: 'invite-list', gid: g.id, invites: P.has('gerenciar_servidor') ? g.invites : {} });
      case 'ban-list':
        if (!P.has('banir')) return;
        return sendTo(c, { type: 'ban-list', gid: g.id, bans: g.bans });
      case 'member-kick':
      case 'member-ban': {
        const ban = m.type === 'member-ban';
        if (!P.has(ban ? 'banir' : 'expulsar')) return err(c, 'Sem permissão.');
        if (m.uid === c.id || !outranks(g, c.id, m.uid)) return err(c, 'Você não pode fazer isso com alguém do mesmo cargo ou acima.');
        if (ban) { g.bans[m.uid] = { by: c.id, ts: Date.now(), name: (profiles.get(m.uid) || {}).name || m.uid }; save('guilds'); }
        if (g.members[m.uid]) removeMember(g, m.uid, ban ? 'banned' : 'kicked');
        if (ban) sendTo(c, { type: 'ban-list', gid: g.id, bans: g.bans });
        return;
      }
      case 'member-unban':
        if (!P.has('banir')) return;
        delete g.bans[m.uid];
        save('guilds');
        return sendTo(c, { type: 'ban-list', gid: g.id, bans: g.bans });
      case 'member-disconnect': {
        const u = clients.get(m.uid);
        if (!P.has('desconectar_membros') || !u || !u.voice || findChannel(u.voice).guild !== g.id) return;
        if (m.uid !== c.id && !outranks(g, c.id, m.uid)) return err(c, 'Você não pode desconectar alguém do mesmo cargo ou acima.');
        leaveVoice(u);
        sendTo(u, { type: 'voice-kicked', by: c.name });
        return;
      }
      case 'member-voice-mod': { // silenciar / ensurdecer alguém para todos (vale em qualquer chamada do servidor)
        if (!P.has('silenciar_membros')) return err(c, 'Você não tem permissão para silenciar pessoas.');
        const mem = g.members[m.uid];
        if (!mem || m.uid === c.id) return;
        if (!outranks(g, c.id, m.uid)) return err(c, 'Você não pode silenciar alguém do mesmo cargo ou acima.');
        if (typeof m.mute === 'boolean') { if (m.mute) mem.smute = true; else delete mem.smute; }
        if (typeof m.deaf === 'boolean') { if (m.deaf) mem.sdeaf = true; else delete mem.sdeaf; }
        save('guilds');
        sendGuild(g);
        const u = clients.get(m.uid);
        if (u) {
          sendTo(u, { type: 'voice-mod', gid: g.id, by: c.name, mute: !!mem.smute, deaf: !!mem.sdeaf, changed: typeof m.mute === 'boolean' ? 'mute' : 'deaf' });
          const vch = u.voice && findChannel(u.voice);
          if (vch && vch.guild === g.id) {
            if (mem.smute || mem.sdeaf) { u.muted = true; u.speaking = false; }
            if (mem.sdeaf) u.deafened = true;
            broadcast({ type: 'user-update', user: publicUser(u) });
          }
        }
        return;
      }
      case 'member-move': {
        const u = clients.get(m.uid);
        const to = findChannel(m.ch);
        if (!u || !to || to.type !== 'voice' || to.guild !== g.id) return;
        if (!u.voice || findChannel(u.voice).guild !== g.id) return err(c, 'Essa pessoa não está numa chamada deste servidor.');
        if (u.voice === to.id) return;
        if (m.uid !== c.id) {
          if (!P.has('desconectar_membros')) return err(c, 'Você não tem permissão para mover pessoas.');
          if (!outranks(g, c.id, m.uid)) return err(c, 'Você não pode mover alguém do mesmo cargo ou acima.');
        }
        // quem é movido troca de sala do lado dele (a chamada é direta entre os PCs)
        u.movedTo = to.id;
        sendTo(u, { type: 'voice-move', ch: to.id, by: m.uid === c.id ? null : c.name });
        log(`  > ${c.name} moveu ${u.name} para ${to.name}`);
        return;
      }
      case 'member-roles': {
        if (!P.has('gerenciar_cargos') || !g.members[m.uid]) return err(c, 'Sem permissão para mudar cargos.');
        if (m.uid !== c.id && !outranks(g, c.id, m.uid) && g.ownerId !== c.id) return err(c, 'Você não pode mudar os cargos de alguém do mesmo cargo ou acima.');
        const top = topPos(g, c.id);
        const wanted = new Set(Array.isArray(m.roles) ? m.roles : []);
        const manageable = new Set(g.roles.filter((r) => r.id !== g.id && r.pos < top).map((r) => r.id));
        const keep = g.members[m.uid].roles.filter((r) => !manageable.has(r) && g.roles.some((x) => x.id === r));
        g.members[m.uid].roles = [...new Set([...keep, ...[...wanted].filter((r) => manageable.has(r))])];
        save('guilds');
        return sendGuild(g);
      }
      case 'role-create': {
        if (!P.has('gerenciar_cargos')) return err(c, 'Sem permissão para criar cargos.');
        if (g.roles.length >= 30) return err(c, 'Limite de cargos atingido.');
        for (const r of g.roles) if (r.pos >= 1) r.pos += 1;
        const role = { id: rid(6), name: cleanName(m.name, 30) || 'novo cargo', color: null, perms: [], hoist: false, pos: 1 };
        g.roles.push(role);
        normalizeRoles(g);
        save('guilds');
        sendGuild(g);
        return sendTo(c, { type: 'role-created', gid: g.id, id: role.id });
      }
      case 'role-update': {
        const r = g.roles.find((x) => x.id === m.id);
        if (!r || !P.has('gerenciar_cargos') || (r.pos >= topPos(g, c.id))) return err(c, 'Você só pode editar cargos abaixo do seu.');
        if (r.id !== g.id) {
          const name = cleanName(m.name, 30);
          if (name) r.name = name;
          if (m.color === null || (typeof m.color === 'string' && COLOR_RE.test(m.color))) r.color = m.color;
          if (typeof m.hoist === 'boolean') r.hoist = m.hoist;
        }
        if (Array.isArray(m.perms)) {
          // só dá para ligar/desligar permissões que você mesmo tem
          const req = new Set(m.perms.filter((p) => PERMS.includes(p)));
          r.perms = PERMS.filter((p) => (P.has(p) ? req.has(p) : r.perms.includes(p)));
        }
        save('guilds');
        return sendGuild(g);
      }
      case 'role-move': {
        const r = g.roles.find((x) => x.id === m.id);
        const top = topPos(g, c.id);
        if (!r || r.id === g.id || !P.has('gerenciar_cargos') || r.pos >= top) return;
        const target = r.pos + (m.dir > 0 ? 1 : -1);
        const other = g.roles.find((x) => x.pos === target);
        if (!other || other.id === g.id || other.pos >= top) return;
        [r.pos, other.pos] = [other.pos, r.pos];
        normalizeRoles(g);
        save('guilds');
        return sendGuild(g);
      }
      case 'role-delete': {
        const r = g.roles.find((x) => x.id === m.id);
        if (!r || r.id === g.id || !P.has('gerenciar_cargos') || r.pos >= topPos(g, c.id)) return;
        g.roles = g.roles.filter((x) => x !== r);
        for (const mem of Object.values(g.members)) mem.roles = mem.roles.filter((x) => x !== r.id);
        normalizeRoles(g);
        save('guilds');
        return sendGuild(g);
      }
    }
  }

  function handle(c, m) {
    if (['hello', 'login', 'register'].includes(m.type)) {
      auth(c, m).catch((e) => { c.authBusy = false; log('ERRO auth', e && e.stack || String(e)); sendTo(c, { type: 'auth-error', message: 'Erro no servidor. Tente de novo.' }); });
      return;
    }
    if (!c.ready) return;
    if (limited(c, 'all', 80, 5000)) return;
    if (m.type.startsWith('guild-') || m.type.startsWith('invite-') || m.type.startsWith('member-') || m.type.startsWith('role-') || m.type === 'ban-list') return handleGuild(c, m);

    switch (m.type) {
      case 'change-password':
        changePassword(c, m).catch((e) => { c.authBusy = false; log('ERRO senha', e && e.stack || String(e)); });
        return;
      case 'logout':
        if (c.sessionHash) { sessions.delete(c.sessionHash); save('sessions'); }
        sendTo(c, { type: 'logged-out' });
        setTimeout(() => c.ws.destroy(), 100);
        return;
      case 'profile':
        setProfile(c, m);
        broadcast({ type: 'user-update', user: publicUser(c) });
        broadcast({ type: 'profile', id: c.id, profile: profiles.get(c.id) });
        return;
      case 'status': {
        if (!STATUSES.includes(m.status)) return;
        c.status = m.status;
        profiles.set(c.id, { ...(profiles.get(c.id) || {}), status: m.status });
        save('profiles');
        broadcast({ type: 'user-update', user: publicUser(c) });
        return;
      }
      case 'afk': {
        if (!!m.afk === !!c.afk) return;
        c.afk = !!m.afk;
        broadcast({ type: 'user-update', user: publicUser(c) });
        return;
      }
      case 'activity': {
        const a = m.activity;
        const name = a && cleanName(a.name, 60);
        const kind = a && ['jogando', 'ouvindo', 'assistindo', 'status'].includes(a.kind) ? a.kind : 'jogando';
        const prev = c.activity;
        c.activity = name ? { name, kind, since: prev && prev.name === name ? prev.since : Date.now() } : null;
        if (JSON.stringify(prev) === JSON.stringify(c.activity)) return;
        broadcast({ type: 'user-update', user: publicUser(c) });
        return;
      }
      case 'music':
        return handleMusic(c, m);

      case 'history': {
        const ch = findChannel(m.ch);
        if (!canSee(c, ch)) return;
        const all = messages.get(m.ch) || [];
        const at = typeof m.around === 'string' ? all.findIndex((x) => x.id === m.around) : -1;
        if (at >= 0 && at < all.length - HISTORY_PAGE) {
          sendTo(c, { type: 'history', ch: m.ch, around: m.around, newer: true, messages: all.slice(Math.max(0, at - 60), at + 60) });
        } else sendTo(c, { type: 'history', ch: m.ch, around: at >= 0 ? m.around : undefined, messages: all.slice(-HISTORY_PAGE) });
        return;
      }

      case 'pin': {
        const ch = findChannel(m.ch);
        const msg = findMsg(m.ch, m.id);
        if (!msg || !canSee(c, ch)) return;
        if (ch.type !== 'dm' && !chPerms(ch, c.id).has('gerenciar_mensagens')) return err(c, 'Você não tem permissão para fixar mensagens aqui.');
        if (m.pinned) {
          if ((messages.get(m.ch) || []).filter((x) => x.pinned).length >= 50) return err(c, 'Limite de 50 mensagens fixadas nesta sala.');
          msg.pinned = { by: c.id, name: c.name, ts: Date.now() };
        } else delete msg.pinned;
        save('messages');
        toChannel(ch, { type: 'message-update', message: msg, pinBy: m.pinned ? c.name : null });
        return;
      }
      case 'pins': {
        const ch = findChannel(m.ch);
        if (!canSee(c, ch)) return;
        sendTo(c, { type: 'pins', ch: m.ch, messages: (messages.get(m.ch) || []).filter((x) => x.pinned).sort((a, b) => b.pinned.ts - a.pinned.ts) });
        return;
      }
      case 'search': {
        if (limited(c, 'search', 10, 10000)) return err(c, 'Calma, muitas buscas seguidas.');
        let chs;
        if (typeof m.gid === 'string') { const g = guilds.get(m.gid); if (!isMember(g, c.id)) return; chs = channels.filter((x) => x.guild === g.id); }
        else { const ch = findChannel(m.ch); if (!canSee(c, ch)) return; chs = [ch]; }
        if (typeof m.in === 'string' && m.in) chs = chs.filter((x) => x.id === m.in);
        const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const words = norm(m.q).split(/\s+/).filter(Boolean).slice(0, 10);
        const from = typeof m.from === 'string' ? m.from : null;
        const before = Number(m.before) || 0;
        const after = Number(m.after) || 0;
        const has = typeof m.has === 'string' ? m.has : '';
        const isImg = (a) => a.kind === 'image' || /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.name || a.url || '');
        const isVid = (a) => a.kind === 'video' || /\.(mp4|webm|mov|mkv)$/i.test(a.name || a.url || '');
        const out = [];
        for (const ch of chs) {
          for (const msg of messages.get(ch.id) || []) {
            if (msg.bot && from !== BOT_ID) { if (from) continue; }
            if (from && msg.uid !== from) continue;
            if (before && msg.ts >= before) continue;
            if (after && msg.ts < after) continue;
            const files = msg.attachments || [];
            if (has === 'arquivo' && !files.length && !msg.image) continue;
            if (has === 'imagem' && !files.some(isImg) && !msg.image) continue;
            if (has === 'video' && !files.some(isVid)) continue;
            if (has === 'link' && !/https?:\/\//i.test(msg.text || '')) continue;
            if (has === 'fixada' && !msg.pinned) continue;
            if (words.length) {
              const hay = norm(msg.text + ' ' + files.map((f) => f.name).join(' '));
              if (!words.every((w) => hay.includes(w))) continue;
            }
            out.push({ ...msg, chName: ch.type === 'dm' ? null : ch.name, chType: ch.type });
          }
        }
        out.sort((a, b) => b.ts - a.ts);
        sendTo(c, { type: 'search-results', token: m.token, total: out.length, results: out.slice(0, 60) });
        return;
      }
      case 'chat': {
        const ch = findChannel(m.ch);
        const list = messages.get(m.ch);
        if (!list || !canSee(c, ch)) return;
        const P = chPerms(ch, c.id);
        if (!P.has('enviar_mensagens')) return err(c, 'Você não tem permissão para enviar mensagens aqui.');
        if (limited(c, 'chat', 8, 5000)) return err(c, 'Calma! Você está enviando mensagens rápido demais.');
        const text = typeof m.text === 'string' ? m.text.trim().slice(0, 2000) : '';
        let attachments = cleanAttachments(m.attachments || (m.image ? [{ url: m.image, name: 'imagem' }] : []));
        if (attachments.length && !P.has('enviar_arquivos')) { err(c, 'Você não tem permissão para enviar arquivos.'); attachments = []; }
        if (!text && !attachments.length) return;
        const msg = { id: rid(), ch: m.ch, uid: c.id, name: c.name, color: c.color, avatar: c.avatar, text, attachments, ts: Date.now(), reactions: {} };
        if (/@(todos|everyone)(?![\p{L}\p{N}_])/iu.test(text)) msg.everyone = P.has('mencionar_todos');
        const target = typeof m.replyTo === 'string' ? list.find((x) => x.id === m.replyTo) : null;
        if (target) {
          msg.replyTo = target.id;
          msg.reply = { uid: target.uid, name: target.name, text: target.text.slice(0, 120), files: (target.attachments || []).length || (target.image ? 1 : 0) };
        }
        list.push(msg);
        if (list.length > MAX_PER_CHANNEL) list.splice(0, list.length - MAX_PER_CHANNEL);
        if (ch.type === 'thread') { // atualiza o resumo do tópico na mensagem que o originou
          const start = findMsg(ch.parent, ch.starter);
          if (start && start.thread) {
            start.thread.count = (start.thread.count || 0) + 1;
            start.thread.lastTs = msg.ts;
            toChannel(ch, { type: 'message-update', message: start });
          }
        }
        save('messages');
        toChannel(ch, { type: 'chat', message: msg });
        return;
      }

      case 'edit': {
        const msg = findMsg(m.ch, m.id);
        const ch = findChannel(m.ch);
        if (!msg || msg.uid !== c.id || !canSee(c, ch)) return;
        const text = typeof m.text === 'string' ? m.text.trim().slice(0, 2000) : '';
        if (!text && !msg.image && !(msg.attachments || []).length) return;
        if (text === msg.text) return;
        msg.text = text;
        msg.edited = Date.now();
        for (const r of messages.get(m.ch)) if (r.replyTo === msg.id && r.reply) r.reply.text = text.slice(0, 120);
        save('messages');
        toChannel(ch, { type: 'message-update', message: msg });
        return;
      }

      case 'delete': {
        const list = messages.get(m.ch);
        const ch = findChannel(m.ch);
        const i = list ? list.findIndex((x) => x.id === m.id) : -1;
        if (i < 0 || !canSee(c, ch)) return;
        if (list[i].uid !== c.id && !chPerms(ch, c.id).has('gerenciar_mensagens')) return err(c, 'Você não pode apagar mensagens dos outros.');
        list.splice(i, 1);
        for (const r of list) if (r.replyTo === m.id && r.reply) r.reply.deleted = true;
        save('messages');
        toChannel(ch, { type: 'message-delete', ch: m.ch, id: m.id });
        return;
      }

      case 'react': {
        const msg = findMsg(m.ch, m.id);
        const ch = findChannel(m.ch);
        const emoji = typeof m.emoji === 'string' ? m.emoji : '';
        if (!msg || !canSee(c, ch) || !emoji || emoji.length > 16 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji)) return;
        msg.reactions = msg.reactions || {};
        const who = msg.reactions[emoji] || [];
        if (who.includes(c.id)) {
          msg.reactions[emoji] = who.filter((u) => u !== c.id);
          if (!msg.reactions[emoji].length) delete msg.reactions[emoji];
        } else {
          if (!chPerms(ch, c.id).has('reagir')) return err(c, 'Você não tem permissão para reagir.');
          if (!msg.reactions[emoji] && Object.keys(msg.reactions).length >= 20) return;
          msg.reactions[emoji] = [...who, c.id];
        }
        save('messages');
        toChannel(ch, { type: 'message-update', message: msg });
        return;
      }

      case 'typing': {
        const ch = findChannel(m.ch);
        if (canSee(c, ch)) toChannel(ch, { type: 'typing', id: c.id, ch: m.ch }, c);
        return;
      }

      // ---------- amigos ----------
      case 'friend-request': case 'friend-accept': case 'friend-decline': case 'friend-cancel': case 'friend-remove':
        return; // modo simples: todos já são amigos
      case 'friend-request-old': {
        if (limited(c, 'friend', 10, 60000)) return err(c, 'Calma! Espere um pouco para mandar mais pedidos.');
        let to = typeof m.uid === 'string' ? m.uid : null;
        if (!to && typeof m.username === 'string') { const acc = accounts.get(m.username.trim().toLowerCase().replace(/^@/, '')); to = acc ? acc.uid : null; }
        const reply = (ok, message) => sendTo(c, { type: 'friend-result', ok, message });
        if (!to || !uidToUser.has(to)) return reply(false, 'Não encontrei ninguém com esse nome de usuário. Confira se está certinho (é o @usuário, não o nome de exibição).');
        if (to === c.id) return reply(false, 'Você não pode adicionar a si mesmo.');
        const me = rel(c.id);
        if (me.friends.includes(to)) return reply(false, 'Vocês já são amigos.');
        if (me.out.includes(to)) return reply(false, 'Você já mandou um pedido para essa pessoa.');
        if (me.friends.length >= 500) return reply(false, 'Limite de amigos atingido.');
        if (me.in.includes(to)) {
          unlink(c.id, to);
          rel(c.id).friends.push(to);
          rel(to).friends.push(c.id);
          save('friends'); sendRel(c.id); sendRel(to);
          return reply(true, `Agora vocês são amigos!`);
        }
        me.out.push(to);
        rel(to).in.push(c.id);
        save('friends'); sendRel(c.id); sendRel(to);
        const t = clients.get(to);
        if (t) sendTo(t, { type: 'friend-request-received', from: c.id, name: c.name });
        return reply(true, `Pedido de amizade enviado para @${uidToUser.get(to)}.`);
      }
      case 'friend-accept': {
        if (!rel(c.id).in.includes(m.uid)) return;
        unlink(c.id, m.uid);
        rel(c.id).friends.push(m.uid);
        rel(m.uid).friends.push(c.id);
        save('friends'); sendRel(c.id); sendRel(m.uid);
        const t = clients.get(m.uid);
        if (t) sendTo(t, { type: 'friend-accepted', by: c.id, name: c.name });
        return;
      }
      case 'friend-decline':
      case 'friend-cancel':
      case 'friend-remove':
        if (typeof m.uid !== 'string') return;
        unlink(c.id, m.uid);
        save('friends'); sendRel(c.id); sendRel(m.uid);
        return;

      // ---------- conversas privadas ----------
      case 'dm-open': {
        const to = m.uid;
        if (typeof to !== 'string' || to === c.id || !uidToUser.has(to)) return;
        if (!areFriends(c.id, to) && !sharesGuild(c.id, to)) return err(c, 'Só dá para mandar mensagem para amigos ou para quem está num servidor com você.');
        const pair = [c.id, to].sort();
        const id = 'dm' + sha(pair.join(':')).slice(0, 12);
        let ch = dms.get(id);
        if (!ch) {
          ch = { id, type: 'dm', members: pair, ts: Date.now() };
          dms.set(id, ch);
          messages.set(id, []);
          save('dms', 'messages');
        }
        for (const uid of ch.members) { const u = clients.get(uid); if (u) sendTo(u, { type: 'dm', channel: channelInfo(ch), opened: uid === c.id }); }
        return;
      }

      case 'thread-create': {
        const parent = findChannel(m.ch);
        const start = findMsg(m.ch, m.msg);
        if (!parent || parent.type !== 'text' || !start || !canSee(c, parent)) return;
        if (!chPerms(parent, c.id).has('enviar_mensagens')) return err(c, 'Você não tem permissão para criar tópicos aqui.');
        if (start.thread && findChannel(start.thread.id)) return sendTo(c, { type: 'thread-open', id: start.thread.id });
        if (limited(c, 'create', 5, 60000)) return err(c, 'Espere um pouco para criar outro tópico.');
        const name = cleanName(m.name, 60) || cleanName((start.text || 'Tópico').split('\n')[0], 40) || 'Tópico';
        const ch = { id: rid(6), guild: parent.guild, name, type: 'thread', parent: parent.id, starter: start.id, createdBy: c.id, ts: Date.now() };
        channels.push(ch);
        messages.set(ch.id, []);
        start.thread = { id: ch.id, name, count: 0, lastTs: ch.ts };
        save('channels', 'messages');
        toGuild(parent.guild, { type: 'channel-create', channel: channelInfo(ch), by: c.id });
        toChannel(parent, { type: 'message-update', message: start });
        sendTo(c, { type: 'thread-open', id: ch.id });
        return;
      }
      case 'channel-create': {
        const g = guilds.get(m.gid);
        if (!isMember(g, c.id)) return;
        if (!can(g, c.id, 'gerenciar_salas')) return err(c, 'Você não tem permissão para criar salas neste servidor.');
        const type = m.kind === 'voice' ? 'voice' : 'text';
        const name = channelName(m.name, type);
        if (!name) return err(c, 'Nome de sala inválido.');
        if (channels.filter((x) => x.guild === g.id).length >= MAX_CHANNELS) return err(c, 'Limite de salas atingido.');
        if (limited(c, 'create', 5, 60000)) return err(c, 'Espere um pouco para criar outra sala.');
        const ch = { id: rid(6), guild: g.id, name, type, createdBy: c.id, ts: Date.now() };
        channels.push(ch);
        messages.set(ch.id, []);
        save('channels', 'messages');
        toGuild(g.id, { type: 'channel-create', channel: channelInfo(ch), by: c.id });
        return;
      }

      case 'channel-rename': {
        const ch = findChannel(m.id);
        const g = guildOfChannel(ch);
        if (!ch || !isMember(g, c.id) || !(can(g, c.id, 'gerenciar_salas') || (ch.type === 'thread' && ch.createdBy === c.id))) return err(c, 'Sem permissão para editar salas.');
        const name = channelName(m.name, ch.type);
        if (!name) return;
        ch.name = name;
        if (ch.type === 'thread') { const st = findMsg(ch.parent, ch.starter); if (st && st.thread) { st.thread.name = name; toGuild(g.id, { type: 'message-update', message: st }); } }
        save('channels');
        toGuild(g.id, { type: 'channel-update', channel: channelInfo(ch) });
        return;
      }

      case 'channel-delete': {
        const ch = findChannel(m.id);
        const g = guildOfChannel(ch);
        if (!ch || !isMember(g, c.id) || !(can(g, c.id, 'gerenciar_salas') || (ch.type === 'thread' && ch.createdBy === c.id))) return err(c, 'Sem permissão para apagar salas.');
        if (ch.type === 'text' && channels.filter((x) => x.guild === g.id && x.type === 'text').length <= 1) return err(c, 'O servidor precisa de pelo menos uma sala de texto.');
        const gone = [ch, ...channels.filter((x) => x.type === 'thread' && x.parent === ch.id)]; // apagar a sala apaga os tópicos dela
        if (ch.type === 'thread') { const st = findMsg(ch.parent, ch.starter); if (st) { delete st.thread; toGuild(g.id, { type: 'message-update', message: st }); } }
        channels = channels.filter((x) => !gone.includes(x));
        for (const x of gone.slice(1)) { messages.delete(x.id); toGuild(g.id, { type: 'channel-delete', id: x.id }); }
        messages.delete(ch.id);
        for (const u of clients.values()) if (u.voice === ch.id) leaveVoice(u);
        music.delete(ch.id);
        save('channels', 'messages');
        toGuild(g.id, { type: 'channel-delete', id: ch.id });
        return;
      }

      case 'voice-join': {
        const ch = findChannel(m.ch);
        if (ch && ch.type === 'dm') { // ligação no privado
          if (!ch.members.includes(c.id)) return;
          const prev = c.voice;
          voiceReset(c);
          c.voice = ch.id;
          c.muted = !!m.muted;
          c.deafened = !!m.deafened;
          broadcast({ type: 'user-update', user: publicUser(c) });
          if (prev && prev !== ch.id) updateCall(prev);
          updateCall(ch.id);
          // toca para quem ainda não está na ligação
          for (const uid of ch.members) {
            const u = clients.get(uid);
            if (uid !== c.id && u && u.voice !== ch.id) sendTo(u, { type: 'dm-ring', ch: ch.id, from: c.id, name: c.name });
          }
          return;
        }
        const g = guildOfChannel(ch);
        if (!ch || ch.type !== 'voice' || !isMember(g, c.id)) return;
        if (!can(g, c.id, 'conectar_voz') && c.movedTo !== ch.id) return err(c, 'Você não tem permissão para entrar nas chamadas deste servidor.');
        c.movedTo = null;
        const prev = c.voice;
        voiceReset(c);
        c.voice = ch.id;
        c.muted = !!m.muted || !can(g, c.id, 'falar');
        c.deafened = !!m.deafened;
        broadcast({ type: 'user-update', user: publicUser(c) });
        if (prev && prev !== ch.id) updateCall(prev);
        updateCall(ch.id);
        log(`  > ${c.name} entrou na voz em ${ch.name}`);
        return;
      }
      case 'voice-leave':
        leaveVoice(c);
        return;
      case 'dm-ring-decline': {
        const ch = findChannel(m.ch);
        if (!ch || ch.type !== 'dm' || !ch.members.includes(c.id)) return;
        for (const uid of ch.members) { const u = clients.get(uid); if (u && uid !== c.id && u.voice === ch.id) sendTo(u, { type: 'dm-ring-declined', ch: ch.id, by: c.name }); }
        for (const u of clients.values()) if (u.id === c.id) sendTo(u, { type: 'dm-ring-stop', ch: ch.id });
        return;
      }
      case 'voice-state': {
        if (!c.voice) return;
        const vch = findChannel(c.voice);
        const g = guildOfChannel(vch);
        const P = vch && vch.type === 'dm' ? new Set(['falar', 'transmitir']) : permsOf(g, c.id);
        for (const k of ['muted', 'deafened', 'sharing', 'camera', 'speaking']) if (typeof m[k] === 'boolean') c[k] = m[k];
        if (!P.has('falar')) { c.muted = true; c.speaking = false; }
        const mem = g && g.members[c.id];
        if (mem && (mem.smute || mem.sdeaf)) { c.muted = true; c.speaking = false; } // silenciado por um moderador
        if (mem && mem.sdeaf) c.deafened = true;
        if (!P.has('transmitir')) { if (m.sharing || m.camera) err(c, 'Você não tem permissão para vídeo ou tela neste servidor.'); c.sharing = false; c.camera = false; }
        broadcast({ type: 'user-update', user: publicUser(c) });
        return;
      }
      case 'signal': {
        const t = clients.get(m.to);
        if (!t || !c.voice || t.voice !== c.voice || !m.data || typeof m.data !== 'object') return;
        sendTo(t, { type: 'signal', from: c.id, data: m.data });
        return;
      }
    }
  }

  function onConnection(ws, ip) {
    const c = { id: null, token: rid(16), ws, ready: false, ip };
    voiceReset(c);
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (opts.log && !['signal', 'typing', 'login', 'register', 'change-password'].includes(m.type) && !(m.type === 'voice-state' && 'speaking' in m)) log('recebido', m.type, c.name || '');
      try { handle(c, m); } catch (e) { log('ERRO ao tratar', m.type, e && e.stack || String(e)); }
    });
    ws.on('close', () => {
      if (!c.ready || c.replaced || clients.get(c.id) !== c) return;
      clients.delete(c.id);
      const wasIn = c.voice;
      broadcast({ type: 'user-leave', id: c.id });
      if (wasIn) { voiceReset(c); updateCall(wasIn); }
      log(`  - ${c.name} saiu (${clients.size} online)`);
    });
  }

  const pinger = setInterval(() => {
    for (const c of clients.values()) {
      if (!c.ws.alive) { c.ws.destroy(); continue; }
      c.ws.alive = false;
      c.ws.ping();
    }
  }, 25000);

  const server = https.createServer(loadCertificate(CERTS, log), onRequest);
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'https://x').pathname !== '/ws') return socket.destroy();
    const ws = acceptUpgrade(req, socket, head);
    if (opts.log) log('websocket', ws ? 'conectado' : 'recusado', req.socket.remoteAddress);
    if (ws) onConnection(ws, req.socket.remoteAddress);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '0.0.0.0', () => {
      server.off('error', reject);
      resolve({
        port: PORT,
        addresses: localIPv4(),
        close: () => { clearInterval(pinger); flush(); server.close(); for (const c of clients.values()) c.ws.destroy(); },
        flush,
      });
    });
  });
}

module.exports = { start };

if (require.main === module) {
  console.log('\n  Concord');
  start().then(({ port, addresses, flush }) => {
    console.log('\n  Servidor rodando! Endereços para abrir no navegador:\n');
    console.log(`    Neste PC:   https://localhost:${port}`);
    for (const ip of addresses) {
      const tag = ip.address.startsWith('26.') ? '  <-- Radmin VPN (mande este para os amigos)' : '';
      console.log(`    ${ip.name}: https://${ip.address}:${port}${tag}`);
    }
    console.log('\n  Na primeira vez o navegador mostra um aviso de segurança:');
    console.log('  clique em "Avançado" e depois em "Continuar". Para parar, feche esta janela.\n');
    const bye = () => { flush(); process.exit(0); };
    process.on('SIGINT', bye);
    process.on('SIGTERM', bye);
  }).catch((e) => {
    if (e.code === 'EADDRINUSE') console.error('\n  A porta já está em uso. Feche o outro servidor ou use outra porta (set PORT=3001).\n');
    else console.error(e);
    process.exit(1);
  });
}
