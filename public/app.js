'use strict';

// =====================================================================
// utilidades
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const els = {};
for (const id of ['login', 'loginForm', 'nameInput', 'secureHint', 'userInput', 'passInput', 'pass2Input', 'nameField', 'pass2Field', 'authTitle',
  'authSub', 'authError', 'authBtn', 'authSwitch', 'authSwitchText', 'channels', 'messages', 'input', 'composer', 'composerBox', 'typing',
  'attachBtn', 'fileInput', 'emojiBtn', 'dropOverlay', 'main', 'members', 'membersToggle', 'voicePanel', 'vpText', 'vpSub', 'leaveBtn',
  'camBtn', 'screenBtn', 'stage', 'muteBtn', 'deafenBtn', 'settingsBtn', 'meBox', 'meAvatar', 'meName', 'meStatus', 'banner', 'toasts',
  'notifs', 'lightbox', 'popover', 'emojiPicker', 'ctxMenu', 'modalRoot', 'topIcon', 'topTitle', 'topDesc', 'joinFromChat', 'replyBar',
  'replyName', 'replyCancel', 'autocomplete', 'attachBar', 'guildList', 'addGuildBtn', 'serverTitle', 'serverHeader', 'railMe', 'railLeave',
  'railMute', 'railDeafen', 'railAvatar', 'sidebarToggle', 'vpTimer', 'app', 'bugBtn', 'homeItem', 'homeBadge', 'friendsPage', 'callBar', 'sendBtn', 'dmCallBtn', 'dmVideoBtn', 'threadsBtn', 'pinsBtn', 'searchInput', 'searchClear', 'searchBox', 'newBar', 'jumpBottom', 'sidePanel', 'ringBox', 'callChatBtn', 'callChatBadge', 'callChatHead', 'callChatTitle', 'callChatMin', 'inviteBtn', 'addChannelRail']) els[id] = document.getElementById(id);

const desk = window.desktop || null;

function load(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } }
function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sem storage */ } }
function unstore(key) { try { localStorage.removeItem(key); } catch { /* sem storage */ } }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk.startsWith('--') ? sk : sk.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), sv);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
  return el;
}

const I = {
  hash: lu('hash'),
  speaker: lu('volume-2'),
  chat: lu('message-circle'),
  plus: lu('plus'),
  gear: lu('settings'),
  reply: lu('reply'),
  edit: lu('pencil'),
  trash: lu('trash'),
  react: lu('face-slightly-smiling-plus'),
  mention: lu('at-sign'),
  micOff: lu('mic-off', 'muted-ic'),
  deafOff: lu('headphone-off', 'muted-ic'),
  cam: lu('video'),
  expand: lu('fullscreen'),
  focus: lu('maximize-2'),
  x: lu('x'),
  copy: lu('copy'),
  crown: lu('crown', 'lu-fill'),
  game: lu('gamepad-2'),
  music: lu('eighth-notes'),
  headphones: lu('headphones'),
  tv: lu('monitor'),
  megaphone: lu('megaphone'),
  clock: lu('clock'),
  home: lu('house'),
  link: lu('link'),
  image: lu('image'),
  list: lu('list'),
  up: lu('arrow-up'),
  down: lu('arrow-down'),
  smile: lu('face-slightly-smiling'),
  heart: lu('heart'),
  leaf: lu('leaf'),
  food: lu('utensils'),
  ball: lu('trophy'),
  car: lu('car'),
  bulb: lu('lightbulb'),
  shapes: lu('shapes'),
  chatDots: lu('message-circle-more'),
};
const ico = (name, cls = '') => h('span', { class: 'ico-inline ' + cls, html: I[name] });
// "Em [alto-falante] Sala" como elementos (sem emoji)
const inVoiceLabel = (name) => (name ? h('span', { class: 'with-ico' }, 'Em ', ico('speaker'), name) : h('span', { class: 'with-ico' }, ico('headphones'), 'Em uma ligação'));
const ACT_ICON = { jogando: 'game', ouvindo: 'headphones', assistindo: 'tv', status: 'chatDots' };

function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase();
}
// status: online, ausente, ocupado (não perturbe), invisivel; quem está invisível aparece offline para os outros
const STATUS_INFO = {
  online: { label: 'Online', desc: '' },
  ausente: { label: 'Ausente', desc: 'Fica automático quando você passa um tempo sem mexer no PC.' },
  ocupado: { label: 'Não perturbe', desc: 'Sem popups, sons nem notificações.' },
  invisivel: { label: 'Invisível', desc: 'Você aparece offline, mas continua usando tudo normal.' },
  offline: { label: 'Offline', desc: '' },
};
function statusOf(uid) {
  const u = state.users && state.users.get(uid);
  if (!u) return 'offline';
  const st = u.status || 'online';
  if (st === 'invisivel') return state.me && uid === state.me.id ? 'invisivel' : 'offline';
  if (st === 'online' && u.afk) return 'ausente';
  return st;
}
const isOnline = (uid) => statusOf(uid) !== 'offline';
function avatar(u, { speaking = false, presence = false, cls = '' } = {}) {
  const el = h('div', { class: 'avatar' + (speaking ? ' speaking' : '') + (cls ? ' ' + cls : '') });
  if (u && u.avatar) el.style.backgroundImage = `url("${u.avatar}")`;
  else { el.style.background = (u && u.color) || '#5865F2'; el.textContent = initials(u && u.name); }
  if (presence) {
    const st = typeof presence === 'string' ? presence : u && u.id ? statusOf(u.id) : 'online';
    if (st !== 'offline') el.append(h('span', { class: 'presence st-' + st, title: STATUS_INFO[st].label }));
  }
  return el;
}

function toast(text, ms = 4000) {
  const t = h('div', { class: 'toast', text });
  els.toasts.append(t);
  setTimeout(() => t.remove(), ms);
}

const fmtTime = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function fmtStamp(ts) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoje às ' + fmtTime(ts);
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return 'Ontem às ' + fmtTime(ts);
  return d.toLocaleDateString('pt-BR') + ' ' + fmtTime(ts);
}

// =====================================================================
// estado
// =====================================================================
const settings = Object.assign({ theme: 'concord', accent: '#5865f2', fontSize: 15, popups: true, notifyMode: 'all', sound: true, serverSounds: true, systemNotify: true, voiceNotify: true,
  globalKeys: { mute: 'CommandOrControl+Shift+M', deafen: 'CommandOrControl+Shift+D', overlay: 'CommandOrControl+Shift+O' },
  overlay: { enabled: true, pos: 'top-left', showMsgs: true, scale: 1, opacity: 1 },
  mic: '', cam: '', speaker: '', noise: 'forte', gate: 'auto', gateDb: -50, hideSidebar: false, hideMembers: false, collapsed: {},
  activity: null, autoGame: true, customGames: [] }, load('dl-settings', {}));
// identidade da versão sem contas (se existir, é usada para herdar perfil e mensagens ao criar a conta)
const legacy = load('dl-identity', null);
const BOT_ID = 'bot-musica';
const MUSIC_ENABLED = false; // bot de música desligado por enquanto (o código continua aqui para voltar depois)

const state = {
  me: null, token: null, ws: null, connected: false, replaced: false, session: load('dl-session', null), username: null,
  users: new Map(), profiles: new Map(), channels: [], current: null, guilds: new Map(), guild: null, music: new Map(), clockOffset: 0,
  msgs: new Map(), lastRead: load('dl-read', null), mentions: new Map(),
  typing: new Map(), replyTo: null, editing: null,
  muted: !!load('dl-audio', {}).muted, deafened: !!load('dl-audio', {}).deafened, voiceCh: null, // lembra como você deixou da última vez joining: false,
  lastTypingSent: 0, focusedTile: null, detached: new Set(), sidePanel: null, unreadFrom: {}, titleUnread: 0, detectedGame: null,
  relations: { friends: [], in: [], out: [] }, openDMs: new Set(),
  pendingInvite: (location.pathname.match(/^\/convite\/([a-z0-9]+)/i) || [])[1] || null,
};
const waiters = {}; // respostas pontuais do servidor (convites, cargos...)

const chan = (id) => state.channels.find((c) => c.id === id);
const profileOf = (uid, fallback) => state.users.get(uid) || state.profiles.get(uid) || fallback || { name: 'Desconhecido', color: '#80848e' };
const isMine = (m) => state.me && m.uid === state.me.id;
const guildOf = (chId) => { const c = chan(chId); return c ? state.guilds.get(c.guild) : null; };
const curGuild = () => state.guilds.get(state.guild);
const guildChannels = (gid) => state.channels.filter((c) => c.guild === gid);

// ---------- permissões (mesma regra do servidor; o servidor sempre confere de novo) ----------
function permsIn(g, uid = state.me && state.me.id) {
  if (!g || !uid || !g.members[uid]) return new Set();
  if (g.ownerId === uid) return new Set(state.perms);
  const mine = new Set(g.members[uid].roles);
  const out = new Set();
  for (const r of g.roles) if (r.id === g.id || mine.has(r.id)) for (const p of r.perms) out.add(p);
  return out.has('administrador') ? new Set(state.perms) : out;
}
const canIn = (g, perm) => permsIn(g).has(perm);
const can = (perm, chId = state.current) => {
  const c = chId && chan(chId);
  if (c && c.type === 'dm') return ['enviar_mensagens', 'enviar_arquivos', 'reagir', 'conectar_voz', 'falar', 'transmitir'].includes(perm);
  const g = (chId && guildOf(chId)) || curGuild();
  return !!g && canIn(g, perm);
};
function topPos(g, uid) {
  if (g.ownerId === uid) return Infinity;
  const mine = new Set((g.members[uid] || { roles: [] }).roles);
  return Math.max(0, ...g.roles.filter((r) => mine.has(r.id)).map((r) => r.pos));
}
const outranks = (g, a, b) => b !== g.ownerId && topPos(g, a) > topPos(g, b);
function rolesOf(g, uid) {
  const mine = new Set((g && g.members[uid] || { roles: [] }).roles);
  return g ? g.roles.filter((r) => mine.has(r.id)).sort((a, b) => b.pos - a.pos) : [];
}
function nameColor(uid, fallback, g = curGuild()) {
  if (uid === BOT_ID) return '#1ABC9C';
  const r = rolesOf(g, uid).find((x) => x.color);
  return r ? r.color : fallback;
}
const PERM_INFO = {
  administrador: ['Administrador', 'Todas as permissões e ignora qualquer restrição. Cuidado ao dar.'],
  gerenciar_servidor: ['Gerenciar servidor', 'Mudar nome e ícone do servidor e ver/apagar convites.'],
  gerenciar_salas: ['Gerenciar salas', 'Criar, renomear e apagar salas de texto e voz.'],
  gerenciar_cargos: ['Gerenciar cargos', 'Criar e editar cargos abaixo do seu e dar cargos para as pessoas.'],
  expulsar: ['Expulsar membros', 'Tirar pessoas do servidor (elas podem voltar com convite).'],
  banir: ['Banir membros', 'Tirar pessoas e impedir que voltem.'],
  gerenciar_mensagens: ['Gerenciar mensagens', 'Apagar mensagens de outras pessoas.'],
  desconectar_membros: ['Mover e desconectar membros', 'Arrastar pessoas de uma chamada para outra e tirar pessoas da chamada.'],
  silenciar_membros: ['Silenciar membros', 'Silenciar ou ensurdecer pessoas na chamada para todo mundo (elas não conseguem desfazer).'],
  mencionar_todos: ['Mencionar @todos', 'Notificar todo mundo com @todos.'],
  criar_convites: ['Criar convites', 'Gerar links de convite para o servidor.'],
  enviar_mensagens: ['Enviar mensagens', 'Escrever nas salas de texto e nos chats de chamada.'],
  enviar_arquivos: ['Enviar arquivos', 'Mandar imagens, vídeos e outros arquivos.'],
  reagir: ['Adicionar reações', 'Reagir às mensagens com emojis.'],
  conectar_voz: ['Conectar', 'Entrar nas salas de voz.'],
  falar: ['Falar', 'Usar o microfone nas chamadas.'],
  transmitir: ['Vídeo e tela', 'Ligar a câmera e compartilhar a tela.'],
  ...(MUSIC_ENABLED ? { usar_musica: ['Usar o bot de música', 'Adicionar, pausar e pular músicas.'] } : {}),
};

function saveSettings() { store('dl-settings', settings); }
// visual novo (Concord): quem estava no tema Escuro padrão passa para o novo, uma vez só
if (!settings.v5) { if (settings.theme === 'escuro') settings.theme = 'concord'; settings.v5 = true; saveSettings(); }
function applyTheme() {
  const r = document.documentElement;
  r.dataset.theme = settings.theme;
  r.style.setProperty('--accent', settings.accent);
  r.style.setProperty('--font-size', settings.fontSize + 'px');
}
applyTheme();

// tempo decorrido (chamadas, atividade, música)
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h2 = Math.floor(sec / 3600), m2 = Math.floor((sec % 3600) / 60), s2 = sec % 60;
  return (h2 ? h2 + ':' + String(m2).padStart(2, '0') : m2) + ':' + String(s2).padStart(2, '0');
}
const serverNow = () => Date.now() + state.clockOffset;
function timer(since, cls = 'timer') { return h('span', { class: cls, 'data-since': since, text: fmtDur((serverNow() - since) / 1000) }); }
setInterval(() => {
  for (const el of document.querySelectorAll('[data-since]')) el.textContent = fmtDur((serverNow() - Number(el.dataset.since)) / 1000);
  if (typeof updateMusicProgress === 'function') updateMusicProgress();
}, 1000);
function fmtAgo(ts) {
  const min = Math.floor((serverNow() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hrs = Math.floor(min / 60);
  return `há ${hrs} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`;
}
const ACT_VERB = { jogando: 'Jogando', ouvindo: 'Ouvindo', assistindo: 'Assistindo', status: '' };
const actText = (a) => (a ? (ACT_VERB[a.kind] ? ACT_VERB[a.kind] + ' ' : '') + a.name : '');

// =====================================================================
// conexão
// =====================================================================
function send(obj) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify(obj));
  else console.warn('[dl] não enviado (sem conexão):', obj.type);
}
const logRing = [];
for (const lvl of ['error', 'warn']) {
  const orig = console[lvl].bind(console);
  console[lvl] = (...a) => {
    logRing.push(`[${new Date().toLocaleTimeString('pt-BR')}] ${lvl}: ` + a.map((x) => (x instanceof Error ? x.message : typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(' ').slice(0, 300));
    if (logRing.length > 25) logRing.shift();
    orig(...a);
  };
}
window.addEventListener('error', (e) => console.error('[dl] ERRO', e.message, (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => console.error('[dl] PROMISE', e.reason && (e.reason.stack || e.reason.message) || String(e.reason)));

function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  state.ws = ws;
  ws.onerror = () => console.warn('[dl] websocket: erro');
  ws.onopen = () => {
    console.info('[dl] websocket aberto');
    if (state.session) send({ type: 'hello', session: state.session });
    else { els.banner.hidden = true; showAuth(); }
  };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } try { onMessage(m); } catch (err) { console.error(err); } };
  ws.onclose = (ev) => {
    console.warn('[dl] websocket fechado', ev.code, ev.reason);
    if (state.ws !== ws) return;
    const was = state.connected;
    state.connected = false;
    if (voice.active) { localLeaveVoice(); toast('Você foi desconectado da voz.'); }
    if (state.replaced || state.loggingOut) return;
    if (was || state.session) els.banner.hidden = false;
    setTimeout(connect, was ? 500 : 2000);
  };
}

function addGuildPayload(p) {
  state.guilds.set(p.guild.id, p.guild);
  state.channels = state.channels.filter((c) => c.guild !== p.guild.id).concat(p.channels);
  for (const [ch, st] of Object.entries(p.music || {})) if (st) state.music.set(ch, st);
  for (const c of p.channels) if (state.lastRead[c.id] == null) state.lastRead[c.id] = c.lastTs;
  store('dl-read', state.lastRead);
}
function removeGuildLocal(gid) {
  const gone = guildChannels(gid).map((c) => c.id);
  if (state.voiceCh && gone.includes(state.voiceCh) && voice.active) localLeaveVoice();
  state.channels = state.channels.filter((c) => c.guild !== gid);
  for (const id of gone) { state.msgs.delete(id); state.music.delete(id); }
  state.guilds.delete(gid);
  if (state.guild === gid) selectGuild([...state.guilds.keys()][0] || '@me');
  renderRail();
}

function onMessage(m) {
  if (waiters[m.type]) { const f = waiters[m.type]; if (f(m) !== 'keep') delete waiters[m.type]; }
  switch (m.type) {
    case 'welcome': {
      state.me = m.you;
      state.token = m.token;
      state.connected = true;
      state.perms = m.perms;
      state.ice = m.ice || [];
      state.clockOffset = m.now - Date.now();
      state.users = new Map(m.users.map((u) => [u.id, u]));
      state.profiles = new Map(Object.entries(m.profiles));
      state.guilds = new Map();
      state.channels = [];
      state.music = new Map();
      state.msgs.clear();
      const firstTime = !state.lastRead;
      state.lastRead = state.lastRead || {};
      for (const p of m.guilds) addGuildPayload(p);
      state.relations = m.relations || { friends: [], in: [], out: [] };
      for (const d of m.dms || []) { state.channels.push(d); if (state.lastRead[d.id] == null) state.lastRead[d.id] = d.lastTs; }
      if (firstTime) for (const c of state.channels) state.lastRead[c.id] = c.lastTs;
      store('dl-read', state.lastRead);
      state.username = m.username;
      if (legacy) unstore('dl-identity'); // já migrou para a conta
      els.banner.hidden = true;
      els.login.hidden = true;
      rebuildMentionRegex();
      renderMe();
      const lastG = load('dl-last-guild', null);
      const startAt = (g) => g === '@me' || state.guilds.has(g);
      selectGuild(startAt(state.guild) ? state.guild : startAt(lastG) ? lastG : [...state.guilds.keys()][0] || '@me', true);
      if (!state.changelogChecked) {
        state.changelogChecked = true;
        if (authMode === 'register' && state.justAuthed) loadChangelog().then((l) => { if (l[0]) { settings.seenVersion = l[0].version; saveSettings(); } }); // conta nova não precisa ver "o que mudou"
        else setTimeout(() => { if (!els.modalRoot.children.length) showChangelog(true); }, 1200);
      }
      renderVoiceUI();
      sendActivity(true);
      if (state.pendingInvite) {
        const code = state.pendingInvite;
        state.pendingInvite = null;
        history.replaceState(null, '', '/');
        joinGuildModal(code);
      }
      break;
    }
    case 'auth-ok':
      state.session = m.session;
      store('dl-session', m.session);
      els.passInput.value = '';
      els.pass2Input.value = '';
      break;
    case 'auth-error':
      if (m.expired) { state.session = null; unstore('dl-session'); }
      showAuth(m.message);
      break;
    case 'logged-out':
      state.session = null;
      unstore('dl-session');
      location.reload();
      break;
    case 'password-result':
      if (state.onPasswordResult) state.onPasswordResult(m);
      else toast(m.message);
      break;
    case 'replaced':
      state.replaced = true;
      showReplaced();
      break;
    case 'user-join':
      state.users.set(m.user.id, m.user);
      state.profiles.set(m.user.id, { name: m.user.name, color: m.user.color, avatar: m.user.avatar });
      rebuildMentionRegex();
      renderMembers();
      break;
    case 'user-leave': {
      const u = state.users.get(m.id);
      state.users.delete(m.id);
      if (u && u.voice && u.voice === state.voiceCh && voice.active) sfx('leave', state.voiceCh);
      for (const key of [...state.typing.keys()]) if (key.endsWith(':' + m.id)) clearTyping(key);
      afterUsersChanged();
      break;
    }
    case 'user-update': {
      const prev = state.users.get(m.user.id);
      state.users.set(m.user.id, m.user);
      if (m.user.id === state.me.id) {
        state.me = m.user;
        if (!m.user.voice && voice.active && state.voiceCh && !state.joining) localLeaveVoice();
        if (m.user.muted && !state.muted && voice.active && !can('falar', state.voiceCh)) { state.muted = true; voice.setMuted(true); }
        renderMe();
      } else if (voice.active && prev && prev.voice !== m.user.voice) {
        if (m.user.voice === state.voiceCh) sfx('join', state.voiceCh);
        else if (prev.voice === state.voiceCh) sfx('leave', state.voiceCh);
      }
      // alguém da sua chamada (ou você) começou / parou de compartilhar a tela
      if (voice.active && prev && m.user.voice && m.user.voice === state.voiceCh && prev.voice === m.user.voice && !!prev.sharing !== !!m.user.sharing) sfx(m.user.sharing ? 'streamStart' : 'streamEnd', state.voiceCh);
      if (m.user.id !== state.me.id && prev && m.user.voice && prev.voice !== m.user.voice && m.user.voice !== state.voiceCh) notifyVoiceJoin(m.user);
      if (prev && (prev.name !== m.user.name || prev.avatar !== m.user.avatar || prev.color !== m.user.color)) {
        state.profiles.set(m.user.id, { name: m.user.name, color: m.user.color, avatar: m.user.avatar });
        rebuildMentionRegex();
        renderMessages(true);
      }
      afterUsersChanged();
      break;
    }
    case 'profile':
      state.profiles.set(m.id, m.profile);
      break;
    case 'history':
      state.msgs.set(m.ch, m.messages);
      if (m.newer) state.detached.add(m.ch); else state.detached.delete(m.ch);
      if (m.ch === state.voiceCh && fsChat.isConnected) placeFsChat();
      if (m.ch === state.current) {
        renderMessages();
        if (m.around) setTimeout(() => jumpTo(m.around), 50);
      }
      break;
    case 'pins': if (state.sidePanel === 'pins:' + m.ch) renderPins(m.ch, m.messages); break;
    case 'search-results': if (m.token === searchToken) renderSearchResults(m); break;
    case 'thread-open': setTimeout(() => openChannel(m.id), 50); break;
    case 'dm-ring': onRing(m); break;
    case 'dm-ring-stop': stopRing(m.ch); break;
    case 'dm-ring-declined': toast(`${m.by} recusou a ligação.`); stopRingTone(); break;
    case 'chat': onChat(m.message); break;
    case 'message-update': {
      const list = state.msgs.get(m.message.ch);
      if (!list) return;
      const i = list.findIndex((x) => x.id === m.message.id);
      if (i < 0) return;
      list[i] = m.message;
      if (m.pinBy && m.message.ch === state.current) toast(`${m.pinBy} fixou uma mensagem.`);
      if (state.sidePanel === 'pins:' + m.message.ch) send({ type: 'pins', ch: m.message.ch });
      if (m.message.ch === state.current) {
        refreshMsg(m.message.id);
        for (const r of list) if (r.replyTo === m.message.id) { if (r.reply) r.reply.text = m.message.text.slice(0, 120); refreshMsg(r.id); }
      }
      break;
    }
    case 'message-delete': {
      const list = state.msgs.get(m.ch);
      if (!list) return;
      const i = list.findIndex((x) => x.id === m.id);
      if (i < 0) return;
      list.splice(i, 1);
      for (const r of list) if (r.replyTo === m.id && r.reply) r.reply.deleted = true;
      if (state.replyTo === m.id) setReply(null);
      if (state.editing && state.editing.id === m.id) state.editing = null;
      if (m.ch === state.current) renderMessages(true);
      break;
    }
    case 'typing': setTyping(m.ch, m.id); break;
    case 'channel-create':
      state.channels.push(m.channel);
      state.lastRead[m.channel.id] = Date.now();
      store('dl-read', state.lastRead);
      renderChannels();
      if (m.by === state.me.id) {
        if (m.channel.type === 'text') openChannel(m.channel.id);
        else if (m.channel.type === 'voice') toast(`Sala de voz "${m.channel.name}" criada. Clique nela para entrar.`);
      }
      break;
    case 'channel-update': {
      const i = state.channels.findIndex((c) => c.id === m.channel.id);
      if (i >= 0) state.channels[i] = m.channel;
      renderChannels();
      if (state.current === m.channel.id) renderHeader();
      renderVoiceUI();
      break;
    }
    case 'channel-delete': {
      const c = chan(m.id);
      state.channels = state.channels.filter((x) => x.id !== m.id);
      state.msgs.delete(m.id);
      state.music.delete(m.id);
      if (state.voiceCh === m.id && voice.active) localLeaveVoice();
      if (state.current === m.id) { toast('A sala que você estava vendo foi apagada.'); openChannel(firstChannel(c && c.guild)); }
      renderChannels();
      break;
    }
    case 'guild': {
      state.guilds.set(m.guild.id, m.guild);
      if (!m.guild.members[state.me.id]) break;
      renderRail();
      if (m.guild.id === state.guild) { renderServerHeader(); renderChannels(); renderMembers(); renderHeader(); renderMessages(true); }
      if (state.onGuildChange) state.onGuildChange(m.guild);
      renderVoiceUI();
      break;
    }
    case 'guild-join':
      addGuildPayload(m);
      renderRail();
      if (m.added) { toast(`${m.by} adicionou você ao servidor "${m.guild.name}".`, 6000); break; }
      selectGuild(m.guild.id);
      toast(m.created ? `Servidor "${m.guild.name}" criado!` : `Você entrou em "${m.guild.name}".`);
      break;
    case 'guild-removed': {
      const g = state.guilds.get(m.id);
      removeGuildLocal(m.id);
      const msg = { kicked: 'Você foi expulso de', banned: 'Você foi banido de', deleted: 'O dono apagou o servidor', left: 'Você saiu de' }[m.reason] || 'Você saiu de';
      if (g) toast(`${msg} "${g.name}".`, 6000);
      break;
    }
    case 'call': {
      const c = chan(m.ch);
      if (c) c.callStart = m.start;
      renderChannels();
      renderHeader();
      renderVoiceUI();
      break;
    }
    case 'music':
      state.clockOffset = m.now - Date.now();
      if (m.state) state.music.set(m.ch, m.state); else state.music.delete(m.ch);
      musicSync();
      renderChannels();
      renderStage();
      if (state.onMusicChange) state.onMusicChange();
      break;
    case 'relations': {
      const before = state.relations;
      state.relations = m.relations;
      const newFriends = m.relations.friends.filter((u) => !before.friends.includes(u));

      renderRail();
      if (state.guild === '@me') { renderHome(); if (friendsTab !== 'adicionar') renderFriendsPage(); renderMembers(); }
      break;
    }
    case 'friend-request-received':
      toast(`${m.name} quer ser seu amigo. Veja em Amigos → Pendentes.`, 6000);
      if (settings.sound) sfx('message');
      if (desk && desk.flash) desk.flash();
      break;
    case 'dm': {
      const i = state.channels.findIndex((c) => c.id === m.channel.id);
      if (i >= 0) state.channels[i] = { ...state.channels[i], ...m.channel }; else state.channels.push(m.channel);
      if (state.lastRead[m.channel.id] == null) { state.lastRead[m.channel.id] = m.channel.lastTs; store('dl-read', state.lastRead); }
      if (m.opened && state.pendingDM && m.channel.members.includes(state.pendingDM)) {
        state.pendingDM = null;
        state.openDMs.add(m.channel.id);
        openChannel(m.channel.id);
      } else if (state.guild === '@me') renderHome();
      break;
    }
    case 'voice-mod': {
      const g = state.guilds.get(m.gid);
      const where = g && state.guilds.size > 1 ? ` em "${g.name}"` : '';
      if (m.changed === 'mute') toast(m.mute ? `${m.by} silenciou você${where}. Ninguém te ouve até liberarem.` : `${m.by} tirou seu silêncio${where}.`, 6000);
      else toast(m.deaf ? `${m.by} ensurdeceu você${where}.` : `${m.by} tirou seu ensurdecimento${where}.`, 6000);
      break;
    }
    case 'voice-move': {
      const to = chan(m.ch);
      if (!to) break;
      const wasViewing = state.current === state.voiceCh;
      joinVoice(m.ch, true).then(() => { if (wasViewing) openChannel(m.ch); });
      toast(m.by ? `${m.by} moveu você para ${to.name}.` : `Você foi para ${to.name}.`);
      break;
    }
    case 'voice-kicked':
      if (voice.active) localLeaveVoice();
      toast(`${m.by} desconectou você da chamada.`, 6000);
      break;
    case 'signal': voice.handleSignal(m.from, m.data); break;
    case 'error': toast(m.message); break;
  }
}

function afterUsersChanged() {
  if (voice.active && state.voiceCh) {
    voice.reconcile([...state.users.values()].filter((u) => u.voice === state.voiceCh).map((u) => u.id));
  }
  for (const id of Object.keys(remoteVideo)) {
    const u = state.users.get(id);
    if (!u || u.voice !== state.voiceCh) delete remoteVideo[id];
  }
  renderMembers();
  renderChannels();
  renderVoiceUI();
}

// =====================================================================
// servidores (barra da esquerda)
// =====================================================================
function guildIcon(g, cls = '') {
  const el = h('div', { class: 'g-icon ' + cls });
  if (g.icon) el.style.backgroundImage = `url("${g.icon}")`;
  else el.textContent = g.name.split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join('').toUpperCase() || '?';
  return el;
}
function guildUnread(gid) { return !mutedNow(notifCfg(gid)) && guildChannels(gid).some((c) => isUnread(c) && c.id !== state.current && !notifFor(c.id).chMuted); }
function guildMentions(gid) { return guildChannels(gid).reduce((n, c) => n + (c.id !== state.current ? state.mentions.get(c.id) || 0 : 0), 0); }

let railSig = '';
function renderRail() {
  const box = els.guildList;
  const anyVoice0 = voice.active && state.voiceCh;
  els.railMe.hidden = !settings.hideSidebar;
  els.railLeave.hidden = !anyVoice0;
  const sig = state.guild + '#' + state.relations.in.length + '#' + state.channels.filter((c) => c.type === 'dm').map((c) => c.id + ':' + (state.mentions.get(c.id) || 0)).join(',') + '#' +
    [...state.guilds.values()].map((g) => [g.id, g.name, g.icon, g.id === state.guild, guildUnread(g.id), guildMentions(g.id)].join('|')).join('/');
  if (sig === railSig && box.children.length) return;
  railSig = sig;
  els.homeItem.classList.toggle('active', state.guild === '@me');
  const homeCount = state.relations.in.length + state.channels.filter((c) => c.type === 'dm' && c.id !== state.current && state.mentions.get(c.id)).reduce((n, c) => n + state.mentions.get(c.id), 0);
  els.homeBadge.hidden = !homeCount;
  els.homeBadge.textContent = homeCount > 99 ? '99+' : homeCount;
  box.replaceChildren(...[...state.guilds.values()].map((g) => {
    const item = h('div', { class: 'server-item' + (g.id === state.guild ? ' active' : '') + (guildUnread(g.id) ? ' unread' : '') + (mutedNow(notifCfg(g.id)) ? ' muted-guild' : ''), 'data-gid': g.id, title: g.name });
    const icon = guildIcon(g, 'server-icon');
    item.append(h('span', { class: 'pill' }), icon);
    const mc = guildMentions(g.id);
    if (mc) item.append(h('span', { class: 'badge rail-badge', text: mc > 99 ? '99+' : mc }));
    return item;
  }));
  const anyVoice = voice.active && state.voiceCh;
  els.railMe.hidden = !settings.hideSidebar;
  els.railLeave.hidden = !anyVoice;
}

function selectGuild(gid, keepChannel) {
  state.guild = gid;
  if (gid) store('dl-last-guild', gid);
  renderRail();
  renderServerHeader();
  if (gid === '@me') {
    const last = load('dl-last-channels', {})['@me'];
    const want = keepChannel && chan(state.current) && chan(state.current).type === 'dm' ? state.current : last;
    openChannel(chan(want) && chan(want).type === 'dm' ? want : '@friends');
    return;
  }
  if (!gid) { els.channels.replaceChildren(h('div', { class: 'empty-guilds', text: 'Você não está em nenhum servidor. Crie um ou entre com um convite pelo botão +.' })); renderMembers(); return; }
  const lastByGuild = load('dl-last-channels', {});
  const want = keepChannel && chan(state.current) && chan(state.current).guild === gid ? state.current : lastByGuild[gid];
  openChannel(chan(want) && chan(want).guild === gid ? want : firstChannel(gid));
  renderMembers();
}
function firstChannel(gid) {
  if ((gid || state.guild) === '@me') return '@friends';
  const list = guildChannels(gid || state.guild);
  const t = list.find((c) => c.type === 'text') || list[0];
  return t ? t.id : null;
}

els.guildList.addEventListener('click', (e) => {
  const it = e.target.closest('.server-item');
  if (it && it.dataset.gid !== state.guild) selectGuild(it.dataset.gid);
});
els.guildList.addEventListener('contextmenu', (e) => {
  const it = e.target.closest('.server-item');
  if (!it) return;
  e.preventDefault();
  serverMenu(state.guilds.get(it.dataset.gid), e.clientX, e.clientY);
});
els.addGuildBtn.addEventListener('click', () => addGuildModal());

function serverMenu(g, x, y) {
  if (!g) return;
  const P = permsIn(g);
  const items = [];
  if (P.has('criar_convites')) items.push({ label: 'Convidar pessoas', fn: () => inviteModal(g) });
  if (P.has('criar_convites') && state.relations.friends.length) items.push({ label: 'Adicionar pessoas', fn: () => addFriendsToGuildModal(g) });
  if (P.has('gerenciar_salas')) items.push({ label: 'Criar sala', fn: () => { if (state.guild !== g.id) selectGuild(g.id); createChannelModal('text'); } });
  if (['gerenciar_servidor', 'gerenciar_cargos', 'expulsar', 'banir'].some((p) => P.has(p))) items.push({ label: 'Configurações do servidor', fn: () => openGuildSettings(g.id) });
  items.push({ label: 'Marcar tudo como lido', fn: () => { guildChannels(g.id).forEach((c) => markRead(c.id, true)); renderChannels(); renderRail(); } });
  items.push({ label: 'Notificações…', fn: () => notifModal(g.id, 'guild', g.name) });
  items.push(mutedNow(notifCfg(g.id)) ? { label: 'Reativar servidor', fn: () => setNotif(g.id, { muteUntil: 0 }) } : { label: 'Silenciar servidor', fn: () => setNotif(g.id, { muteUntil: -1 }) });
  if (g.ownerId !== state.me.id) items.push({ label: 'Sair do servidor', danger: true, fn: () => modal({
    title: `Sair de "${g.name}"`, desc: 'Você só poderá voltar com um novo convite.',
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Sair do servidor', cls: 'danger-btn', fn: () => send({ type: 'guild-leave', gid: g.id }) }],
  }) });
  showContextMenu(x, y, items);
}

function renderServerHeader() {
  const g = curGuild();
  els.serverTitle.textContent = g ? g.name : state.guild === '@me' ? 'Conversas' : 'Concord';
  els.serverHeader.classList.toggle('home', state.guild === '@me');
  els.serverHeader.classList.toggle('disabled', !g);
  els.inviteBtn.hidden = !g || !canIn(g, 'criar_convites');
}
els.serverHeader.addEventListener('click', (e) => {
  const g = curGuild();
  if (!g || e.target.closest('#inviteBtn')) return;
  const r = els.serverHeader.getBoundingClientRect();
  serverMenu(g, r.left + 8, r.bottom + 4);
});

// =====================================================================
// início: amigos e mensagens diretas
// =====================================================================
const HOME = '@me';
const FRIENDS = '@friends';
const isDM = (c) => c && c.type === 'dm';
const dmOther = (c) => (c && c.members ? c.members.find((u) => u !== state.me.id) || state.me.id : null);
const dmName = (c) => profileOf(dmOther(c)).name;
const relOf = (uid) => {
  const r = state.relations;
  return r.friends.includes(uid) ? 'friend' : r.in.includes(uid) ? 'incoming' : r.out.includes(uid) ? 'outgoing' : 'none';
};
function dmUnread() { return state.channels.filter((c) => isDM(c) && isUnread(c) && c.id !== state.current).length; }
function visibleDMs() {
  const hidden = load('dl-hidden-dms', {});
  return state.channels.filter((c) => isDM(c) && (state.openDMs.has(c.id) || (c.lastTs && (!hidden[c.id] || c.lastTs > hidden[c.id]))))
    .sort((a, b) => (b.lastTs || b.ts || 0) - (a.lastTs || a.ts || 0));
}
function openDM(uid) {
  const existing = state.channels.find((c) => isDM(c) && c.members.includes(uid) && c.members.includes(state.me.id) && (uid !== state.me.id || c.members[0] === c.members[1]));
  if (existing) { state.openDMs.add(existing.id); openChannel(existing.id); return; }
  waiters.dm = (m) => { if (!m.opened) return 'keep'; };
  state.pendingDM = uid;
  send({ type: 'dm-open', uid });
}
function friendAction(uid, kind) {
  send({ type: kind, uid });
}
function sendFriendRequest(username, onResult) {
  waiters['friend-result'] = (m) => { if (onResult) onResult(m); else toast(m.message); };
  send({ type: 'friend-request', ...(username.startsWith('uid:') ? { uid: username.slice(4) } : { username }) });
}

function renderHome() {
  const box = els.channels;
  const scroll = box.scrollTop;
  const pending = state.relations.in.length;
  const friendsRow = h('div', { class: 'channel home-link' + (state.current === FRIENDS ? ' active' : ''), 'data-id': FRIENDS },
    h('span', { class: 'ico', html: lu('users') }),
    h('span', { class: 'ch-name', text: 'Pessoas' }), pending ? h('span', { class: 'badge', text: pending }) : null);
  const head = h('div', { class: 'category' }, h('span', { text: 'Mensagens diretas' }),
    h('button', { title: 'Nova mensagem', html: I.plus, onclick: () => newDMModal() }));
  const list = visibleDMs().map((c) => {
    const uid = dmOther(c);
    const u = state.users.get(uid);
    const p = profileOf(uid);
    const unread = isUnread(c) && c.id !== state.current;
    const mc = state.mentions.get(c.id);
    return h('div', { class: 'channel dm-row' + (state.current === c.id ? ' active' : '') + (unread ? ' unread' : ''), 'data-id': c.id },
      avatar(p, { presence: statusOf(uid) }),
      h('div', { class: 'dm-text' }, h('span', { class: 'ch-name', text: p.name }), u && u.activity ? h('span', { class: 'dm-sub', text: actText(u.activity) }) : null),
      c.callStart ? h('span', { class: 'dm-call', title: 'Ligação em andamento', html: lu('phone-call') }) : null,
      mc && c.id !== state.current ? h('span', { class: 'badge', text: mc }) : null,
      h('span', { class: 'ch-actions' }, h('button', { title: 'Fechar conversa', 'data-act': 'close-dm', html: I.x })));
  });
  box.replaceChildren(friendsRow, head, ...(list.length ? list : [h('div', { class: 'empty-dms', text: 'Nenhuma conversa ainda. Clique no balão ao lado de alguém em Pessoas.' })]));
  box.scrollTop = scroll;
}

function showFriendsPage(show) {
  els.friendsPage.hidden = !show;
  for (const el of [$('.messages-wrap'), els.composer]) el.hidden = show;
  if (show) els.stage.hidden = true;
}

let friendsTab = 'online';
function renderFriendsPage() {
  if (state.current !== FRIENDS) return;
  const r = state.relations;
  if (friendsTab !== 'online' && friendsTab !== 'todos') friendsTab = 'online';
  const tabs = [['online', 'Online'], ['todos', 'Todos']];
  const bar = h('div', { class: 'friends-tabs' }, ...tabs.map(([k, l]) => h('button', { class: (k === friendsTab ? 'on' : '') + (k === 'adicionar' ? ' add' : ''), text: l, onclick: () => { friendsTab = k; renderFriendsPage(); } })));
  const body = h('div', { class: 'friends-body' });
  const row = (uid, sub, actions) => {
    const p = profileOf(uid);
    const u = state.users.get(uid);
    return h('div', { class: 'friend-row', 'data-uid': uid },
      avatar(p, { presence: statusOf(uid) }),
      h('div', { class: 'fr-info' }, h('div', { class: 'fr-name' }, p.name, h('span', { class: 'fr-user', text: u && u.username ? ' @' + u.username : '' })),
        h('div', { class: 'fr-sub', text: sub })),
      h('div', { class: 'fr-actions' }, ...actions));
  };
  const btn = (title, icon, fn, cls = '') => h('button', { class: 'fr-btn ' + cls, title, html: icon, onclick: (e) => { e.stopPropagation(); fn(); } });
  const MSG = I.chatDots;
  const OK = lu('check');
  const MORE = lu('ellipsis-vertical');
  const subFor = (uid) => { const u = state.users.get(uid); const st = statusOf(uid); return st === 'offline' ? 'Offline' : u.activity ? actText(u.activity) : u.voice ? 'Em chamada' : STATUS_INFO[st].label; };
  const search = h('input', { class: 'text-input fr-search', placeholder: 'Buscar' });
  const friendRows = (ids, title) => {
    const q = search.value.trim().toLowerCase();
    const list = ids.filter((uid) => !q || profileOf(uid).name.toLowerCase().includes(q)).sort((a, b) => profileOf(a).name.localeCompare(profileOf(b).name, 'pt-BR'));
    return [h('div', { class: 'fr-title', text: `${title} — ${list.length}` }),
      ...list.map((uid) => row(uid, subFor(uid), [btn('Mensagem', MSG, () => openDM(uid)),
        btn('Ver perfil', MORE, () => showProfile(uid, body.querySelector(`[data-uid="${uid}"] .fr-btn:last-child`)))]))];
  };
  const draw = () => {
    if (friendsTab === 'adicionar') {
      const input = h('input', { class: 'text-input', placeholder: 'Digite o nome de usuário (ex.: mikael_fm)', maxlength: 21 });
      const msg = h('div', { class: 'form-msg' });
      const go = () => {
        const v = input.value.trim().replace(/^@/, '').toLowerCase();
        if (!v) return;
        sendFriendRequest(v, (res) => { msg.textContent = res.message; msg.className = 'form-msg ' + (res.ok ? 'ok' : 'err'); if (res.ok) input.value = ''; });
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      body.replaceChildren(h('div', { class: 'fr-add' }, h('h2', { text: 'Adicionar amigo' }),
        h('p', { class: 'sr-desc', text: 'Use o nome de usuário da pessoa (o @ que aparece no perfil dela).' }),
        h('div', { class: 'fr-add-row' }, input, h('button', { class: 'primary', text: 'Enviar pedido de amizade', onclick: go })), msg));
      setTimeout(() => input.focus(), 0);
      return;
    }
    if (friendsTab === 'pendentes') {
      const items = [];
      if (r.in.length) items.push(h('div', { class: 'fr-title', text: `Recebidos — ${r.in.length}` }),
        ...r.in.map((uid) => row(uid, 'Quer ser seu amigo', [btn('Aceitar', OK, () => friendAction(uid, 'friend-accept'), 'ok'), btn('Recusar', I.x, () => friendAction(uid, 'friend-decline'), 'no')])));
      if (r.out.length) items.push(h('div', { class: 'fr-title', text: `Enviados — ${r.out.length}` }),
        ...r.out.map((uid) => row(uid, 'Pedido enviado', [btn('Cancelar pedido', I.x, () => friendAction(uid, 'friend-cancel'), 'no')])));
      body.replaceChildren(...(items.length ? items : [h('div', { class: 'fr-empty', text: 'Nenhum pedido pendente.' })]));
      return;
    }
    const ids = friendsTab === 'online' ? r.friends.filter((u) => isOnline(u)) : r.friends;
    const content = friendRows(ids, friendsTab === 'online' ? 'Online' : 'Todos');
    body.replaceChildren(search, ...(ids.length ? content : [h('div', { class: 'fr-empty', text: friendsTab === 'online' ? 'Ninguém online agora.' : 'Quando outra pessoa criar uma conta, ela aparece aqui automaticamente.' })]));
  };
  search.addEventListener('input', () => { const pos = search.selectionStart; draw(); search.focus(); search.setSelectionRange(pos, pos); });
  draw();
  els.friendsPage.replaceChildren(bar, body);
}

function newDMModal() {
  const friends = state.relations.friends;
  if (!friends.length) return toast('Ainda não tem mais ninguém com conta aqui.');
  const m = modal({
    title: 'Nova mensagem', desc: 'Escolha uma pessoa.',
    body: [h('div', { class: 'pick-list' }, ...friends.map((uid) => h('button', { type: 'button', class: 'pick-row', onclick: () => { m.close(); openDM(uid); } },
      avatar(profileOf(uid), { presence: statusOf(uid) }), h('span', { text: profileOf(uid).name }))))],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }],
  });
}

// lista de amigos com caixas de marcar (criar servidor / adicionar ao servidor)
function friendPicker(excluded = new Set()) {
  const avail = state.relations.friends.filter((u) => !excluded.has(u)).sort((a, b) => profileOf(a).name.localeCompare(profileOf(b).name, 'pt-BR'));
  const boxes = avail.map((uid) => {
    const cb = h('input', { type: 'checkbox' });
    cb.dataset.uid = uid;
    return h('label', { class: 'check-row role-check' }, cb, avatar(profileOf(uid), { presence: statusOf(uid) }), h('span', { class: 'rc-name', text: profileOf(uid).name }));
  });
  const el = h('div', { class: 'role-check-list friend-pick' }, ...(boxes.length ? boxes : [h('p', { class: 'sr-desc', text: 'Todo mundo que tem conta já está aqui.' })]));
  return { el, selected: () => boxes.map((b) => $('input', b)).filter((x) => x.checked).map((x) => x.dataset.uid) };
}
function addFriendsToGuildModal(g) {
  const pick = friendPicker(new Set(Object.keys(g.members)));
  modal({
    title: `Adicionar pessoas a "${g.name}"`, desc: 'Elas entram direto no servidor e recebem um aviso.',
    body: [pick.el],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Adicionar', cls: 'primary', fn: () => {
      const uids = pick.selected();
      if (!uids.length) { toast('Marque pelo menos uma pessoa.'); return false; }
      waiters['friend-result'] = (m) => toast(m.message);
      send({ type: 'guild-add-friends', gid: g.id, uids });
    } }],
  });
}

els.homeItem.addEventListener('click', () => { if (state.guild !== HOME) selectGuild(HOME); });

// =====================================================================
// salas
// =====================================================================
function isUnread(c) {
  return c.lastTs > (state.lastRead[c.id] || 0) && c.lastUid !== (state.me && state.me.id);
}

function canMove(g, uid) { return uid === state.me.id || (canIn(g, 'desconectar_membros') && outranks(g, state.me.id, uid)); }
function renderChannels() {
  if (state.guild === '@me') { if (!state.dragging) renderHome(); renderRail(); return; }
  const g = curGuild();
  const box = els.channels;
  if (!g || state.dragging) return;
  if (state.pressVm) { state.pendingChannels = true; return; } // não troca o item embaixo do mouse antes do arrasto começar
  const scroll = box.scrollTop;
  box.innerHTML = '';
  const manage = canIn(g, 'gerenciar_salas');
  const section = (title, type) => {
    const key = g.id + ':' + type;
    const collapsed = !!settings.collapsed[key];
    const head = h('div', { class: 'category' + (collapsed ? ' collapsed' : '') },
      h('span', { class: 'cat-toggle', 'data-cat': key }, h('span', { class: 'chev', html: lu('chevron-down') }), title));
    if (manage) head.append(h('button', { title: 'Criar sala', html: I.plus, onclick: () => createChannelModal(type) }));
    box.append(head);
    for (const c of guildChannels(g.id).filter((x) => x.type === type)) {
      const active = state.current === c.id;
      const inRoom = c.type === 'voice' ? [...state.users.values()].filter((u) => u.voice === c.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) : [];
      if (collapsed && !active && !inRoom.length && !(isUnread(c) && type === 'text')) continue;
      const row = h('div', {
        class: 'channel' + (c.type === 'voice' ? ' voice' : '') + (active ? ' active' : '') + (isUnread(c) && !active && !notifFor(c.id).chMuted ? ' unread' : '') + (notifFor(c.id).chMuted ? ' muted-ch' : '') + (state.voiceCh === c.id ? ' connected' : ''),
        'data-id': c.id, title: c.type === 'voice' ? 'Clique para entrar na chamada' : '',
      });
      row.innerHTML = c.type === 'voice' ? I.speaker : I.hash;
      row.firstElementChild.classList.add('ico');
      row.append(h('span', { class: 'ch-name', text: c.name }));
      if (c.type === 'voice' && c.callStart) row.append(timer(c.callStart, 'timer ch-timer'));
      const mc = state.mentions.get(c.id);
      if (mc && !active) row.append(h('span', { class: 'badge', text: mc > 99 ? '99+' : mc }));
      const actions = h('span', { class: 'ch-actions' });
      if (c.type === 'voice') actions.append(h('button', { title: 'Abrir chat', 'data-act': 'chat', html: I.chat }));
      if (manage) actions.append(h('button', { title: 'Editar sala', 'data-act': 'menu', html: I.gear }));
      row.append(actions);
      box.append(row);
      if (c.type === 'text') {
        const recent = Date.now() + state.clockOffset - 3 * 86400000;
        for (const t of state.channels.filter((x) => x.type === 'thread' && x.parent === c.id && (x.id === state.current || isUnread(x) || Math.max(x.lastTs || 0, x.ts || 0) > recent))
          .sort((a, b) => Math.max(b.lastTs || 0, b.ts) - Math.max(a.lastTs || 0, a.ts))) {
          if (collapsed && t.id !== state.current && !isUnread(t)) continue;
          const tr = h('div', { class: 'channel thread-row' + (state.current === t.id ? ' active' : '') + (isUnread(t) && state.current !== t.id && !notifFor(t.id).chMuted ? ' unread' : ''), 'data-id': t.id, title: 'Tópico' },
            h('span', { class: 'ico', html: lu('corner-down-right') }), h('span', { class: 'ch-name', text: t.name }));
          const tm = state.mentions.get(t.id);
          if (tm && state.current !== t.id) tr.append(h('span', { class: 'badge', text: tm }));
          box.append(tr);
        }
      }
      if (c.type === 'voice') {
        const vm = h('div', { class: 'voice-members' });
        for (const u of inRoom) {
          const r = h('div', { class: 'vm', 'data-uid': u.id, draggable: canMove(g, u.id) ? 'true' : null, title: canMove(g, u.id) ? 'Arraste para outra sala de voz para mover' : null });
          r.append(avatar(u, { speaking: u.speaking && !u.muted && !u.deafened }), h('span', { class: 'vm-name', text: u.name, style: { color: nameColor(u.id, '', g) } }));
          const ic = h('span', { class: 'vm-icons' });
          if (u.activity && u.activity.kind === 'jogando') ic.append(h('span', { class: 'vm-game', title: actText(u.activity), html: I.game }));
          if (u.camera) ic.insertAdjacentHTML('beforeend', I.cam);
          if (u.sharing) ic.append(h('span', { class: 'live', text: 'AO VIVO' }));
          ic.insertAdjacentHTML('beforeend', voiceIcons(u, g));
          r.append(ic);
          vm.append(r);
        }
        const mus = MUSIC_ENABLED && state.music.get(c.id);
        if (mus && mus.current) {
          vm.append(h('div', { class: 'vm bot', title: 'Tocando: ' + mus.current.name },
            h('div', { class: 'avatar bot-avatar', html: I.music }), h('span', { class: 'vm-name', text: 'DJ Galera' }), h('span', { class: 'bot-tag', text: 'BOT' })));
        }
        box.append(vm);
      }
    }
  };
  section('Canais de texto', 'text');
  section('Canais de voz', 'voice');
  box.scrollTop = scroll;
  renderRail();
  updateOverlay();
}

els.channels.addEventListener('click', (e) => {
  const cat = e.target.closest('[data-cat]');
  if (cat) { settings.collapsed[cat.dataset.cat] = !settings.collapsed[cat.dataset.cat]; saveSettings(); return renderChannels(); }
  const vm = e.target.closest('.vm[data-uid]');
  if (vm) return showProfile(vm.dataset.uid, vm);
  if (e.target.closest('.vm.bot')) { const c = e.target.closest('.voice-members').previousElementSibling; if (c) openChannel(c.dataset.id); return; }
  const row = e.target.closest('.channel');
  if (!row) return;
  if (row.dataset.id === '@friends') return openChannel('@friends');
  const c = chan(row.dataset.id);
  if (!c) return;
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act === 'close-dm') {
    const hidden = load('dl-hidden-dms', {}); hidden[c.id] = Date.now(); store('dl-hidden-dms', hidden);
    state.openDMs.delete(c.id);
    if (state.current === c.id) openChannel('@friends'); else renderHome();
    return;
  }
  if (c.type === 'dm') return openChannel(c.id);
  if (act && act.dataset.act === 'chat') { // abre o chat da sala de voz (e tira do minimizado)
    openChannel(c.id);
    if (settings.callChatMin) setCallChatMin(false);
    return;
  }
  if (act && act.dataset.act === 'menu') return channelMenu(c, e);
  if (c.type === 'voice') { joinVoice(c.id); openChannel(c.id); } else openChannel(c.id);
});
els.channels.addEventListener('mousedown', (e) => { if (e.button === 0 && e.target.closest('.vm[data-uid][draggable="true"]')) state.pressVm = true; });
document.addEventListener('mouseup', () => {
  if (!state.pressVm) return;
  state.pressVm = false;
  if (state.pendingChannels && !state.dragging) { state.pendingChannels = false; renderChannels(); }
});
els.channels.addEventListener('dragstart', (e) => {
  state.pressVm = false;
  const vm = e.target.closest('.vm[data-uid]');
  if (!vm) return;
  state.dragging = vm.dataset.uid;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', vm.dataset.uid);
  vm.classList.add('dragging');
});
els.channels.addEventListener('dragover', (e) => {
  const row = state.dragging && e.target.closest('.channel.voice');
  $$('.drop-target', els.channels).forEach((x) => { if (x !== row) x.classList.remove('drop-target'); });
  if (!row) return;
  e.preventDefault();
  row.classList.add('drop-target');
});
els.channels.addEventListener('drop', (e) => {
  const row = e.target.closest('.channel.voice');
  const uid = state.dragging;
  state.dragging = null;
  if (row && uid) {
    e.preventDefault();
    const ch = row.dataset.id;
    const u = state.users.get(uid);
    if (u && u.voice !== ch) {
      if (uid === state.me.id) joinVoice(ch);
      else send({ type: 'member-move', gid: state.guild, uid, ch });
    }
  }
  renderChannels();
});
els.channels.addEventListener('dragend', () => { state.pressVm = false; state.pendingChannels = false; if (state.dragging) { state.dragging = null; renderChannels(); } });
els.channels.addEventListener('contextmenu', (e) => {
  const vm = e.target.closest('.vm[data-uid]');
  if (vm) { e.preventDefault(); return memberMenu(vm.dataset.uid, e.clientX, e.clientY); }
  const row = e.target.closest('.channel');
  if (!row) return;
  e.preventDefault();
  const c = chan(row.dataset.id);
  if (c && c.type === 'dm') return memberMenu(dmOther(c), e.clientX, e.clientY);
  channelMenu(c, e);
});

function channelMenu(c, e) {
  if (!c) return;
  const items = [{ label: 'Marcar como lida', fn: () => markRead(c.id) }];
  if (c.type === 'voice') items.push({ label: 'Abrir chat', fn: () => openChannel(c.id) });
  items.push({ label: 'Notificações…', fn: () => notifModal(c.id, 'channel', c.name) });
  items.push(mutedNow(notifCfg(c.id)) ? { label: 'Reativar sala', fn: () => setNotif(c.id, { muteUntil: 0 }) } : { label: 'Silenciar sala', fn: () => setNotif(c.id, { muteUntil: -1 }) });
  if (can('gerenciar_salas', c.id) || (c.type === 'thread' && c.createdBy === state.me.id)) {
    items.push({ label: c.type === 'thread' ? 'Renomear tópico' : 'Renomear sala', fn: () => renameChannelModal(c) });
    items.push({ label: c.type === 'thread' ? 'Apagar tópico' : 'Apagar sala', danger: true, fn: () => deleteChannelModal(c) });
  }
  showContextMenu(e.clientX, e.clientY, items);
}

function openChannel(id) {
  if (id === '@friends') {
    if (state.guild !== '@me') { state.guild = '@me'; store('dl-last-guild', '@me'); renderServerHeader(); }
    state.current = '@friends';
    const last = load('dl-last-channels', {}); last['@me'] = '@friends'; store('dl-last-channels', last);
    showFriendsPage(true);
    renderFriendsPage();
    renderHeader();
    renderChannels();
    renderMembers();
    renderRail();
    renderTyping();
    return;
  }
  showFriendsPage(false);
  const c = chan(id) || chan(firstChannel());
  if (!c) return;
  if (c.type === 'dm') {
    state.openDMs.add(c.id);
    if (state.guild !== '@me') { state.guild = '@me'; store('dl-last-guild', '@me'); renderServerHeader(); }
  } else if (c.guild !== state.guild) {
    state.guild = c.guild;
    store('dl-last-guild', c.guild);
    renderServerHeader();
    renderMembers();
  }
  if (state.current !== c.id) {
    setReply(null);
    state.editing = null;
    state.focusedTile = null;
    state.unreadFrom[c.id] = isUnread(c) ? (state.lastRead[c.id] || 0) : null;
    if (state.sidePanel && !state.sidePanel.startsWith('search')) closeSidePanel();
  }
  state.current = c.id;
  const lastByGuild = load('dl-last-channels', {});
  lastByGuild[c.type === 'dm' ? '@me' : c.guild] = c.id;
  store('dl-last-channels', lastByGuild);
  if (c.type === 'dm') renderMembers();
  if (!state.msgs.has(c.id)) {
    send({ type: 'history', ch: c.id });
    els.messages.innerHTML = '<div class="loading">Carregando mensagens…</div>';
  } else renderMessages();
  renderHeader();
  markRead(c.id);
  renderTyping();
  renderStage();
  closeAutocomplete();
  els.members.classList.remove('open');
  if (matchMedia('(pointer: fine)').matches && !els.input.disabled) els.input.focus();
}

function renderTopButtons() {
  const c = chan(state.current);
  const friends = state.current === '@friends';
  const isDm = c && c.type === 'dm';
  const inThisCall = voice.active && state.voiceCh === state.current;
  els.dmCallBtn.hidden = !isDm || inThisCall;
  els.dmVideoBtn.hidden = !isDm || inThisCall;
  els.threadsBtn.hidden = !(c && (c.type === 'text' || c.type === 'thread'));
  els.pinsBtn.hidden = friends || !c;
  els.searchBox.hidden = friends || (state.guild === '@me' && !isDm);
  els.searchInput.placeholder = isDm ? 'Buscar nesta conversa' : (curGuild() ? `Buscar em ${curGuild().name}` : 'Buscar');
}
function renderHeader() {
  renderTopButtons();
  if (state.current === '@friends') {
    els.topIcon.innerHTML = lu('users');
    els.topTitle.textContent = 'Pessoas';
    els.topDesc.replaceChildren('Todo mundo que já usou o programa');
    els.joinFromChat.hidden = true;
    return;
  }
  const c = chan(state.current);
  if (!c) return;
  if (c.type === 'dm') {
    const uid = dmOther(c);
    const u = state.users.get(uid);
    els.topIcon.innerHTML = I.mention;
    els.topTitle.textContent = dmName(c);
    const st = statusOf(uid);
    els.topDesc.replaceChildren(c.callStart ? h('span', {}, 'Ligação em andamento há ', timer(c.callStart)) : st === 'offline' ? 'Offline' : u.activity ? actText(u.activity) : STATUS_INFO[st].label);
    els.joinFromChat.hidden = true;
    renderComposerPerms();
    return;
  }
  if (c.type === 'thread') {
    const parent = chan(c.parent);
    els.topIcon.innerHTML = lu('messages-square');
    els.topTitle.textContent = c.name;
    els.topDesc.replaceChildren('Tópico em ', h('a', { class: 'link', text: '#' + (parent ? parent.name : '?'), onclick: () => parent && openChannel(parent.id) }));
    els.joinFromChat.hidden = true;
    renderComposerPerms();
    return;
  }
  els.topIcon.innerHTML = c.type === 'voice' ? I.speaker : I.hash;
  els.topTitle.textContent = c.name;
  const g = guildOf(c.id);
  els.topDesc.replaceChildren(c.type === 'voice'
    ? (c.callStart ? h('span', {}, 'Chamada em andamento há ', timer(c.callStart)) : 'Chat da chamada')
    : (g ? g.name : ''));
  els.joinFromChat.hidden = !(c.type === 'voice' && state.voiceCh !== c.id);
  renderComposerPerms();
}
els.joinFromChat.addEventListener('click', () => joinVoice(state.current));

function renderComposerPerms() {
  const c = chan(state.current);
  if (!c) return;
  const canSend = can('enviar_mensagens');
  els.input.disabled = !canSend;
  els.input.placeholder = canSend ? (c.type === 'dm' ? `Conversar com @${dmName(c)}` : `Conversar em ${c.type === 'voice' ? '' : '#'}${c.name}`) : 'Você não tem permissão para enviar mensagens aqui';
  els.composerBox.classList.toggle('locked', !canSend);
  els.attachBtn.hidden = !canSend || !can('enviar_arquivos');
}

function markRead(id, quiet) {
  const c = chan(id);
  if (!c) return;
  state.lastRead[id] = Math.max(c.lastTs, Date.now());
  store('dl-read', state.lastRead);
  state.mentions.delete(id);
  if (!quiet) renderChannels();
}

function createChannelModal(type = 'text') {
  const g = curGuild();
  if (!g) return;
  let kind = type;
  const name = h('input', { type: 'text', maxlength: 40, placeholder: 'nova-sala' });
  const opt = (k, title, desc, icon) => h('button', { type: 'button', class: 'type-option' + (kind === k ? ' on' : ''), 'data-k': k, html: icon },
    h('div', {}, h('div', { class: 't-name', text: title }), h('div', { class: 't-desc', text: desc })), h('span', { class: 'radio' }));
  const opts = h('div', {}, opt('text', 'Texto', 'Mande mensagens, imagens, emojis e opiniões', I.hash), opt('voice', 'Voz', 'Converse por voz, vídeo e compartilhe a tela', I.speaker));
  opts.addEventListener('click', (e) => {
    const b = e.target.closest('.type-option');
    if (!b) return;
    kind = b.dataset.k;
    $$('.type-option', opts).forEach((x) => x.classList.toggle('on', x === b));
    name.placeholder = kind === 'voice' ? 'Nova sala de voz' : 'nova-sala';
  });
  const m = modal({
    title: 'Criar sala', desc: `em ${g.name}`,
    body: [h('label', { text: 'Tipo de sala' }), opts, h('label', { text: 'Nome da sala', style: { marginTop: '16px' } }), name],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Criar sala', cls: 'primary', submit: true, fn: () => {
      if (!name.value.trim()) { name.focus(); return false; }
      send({ type: 'channel-create', gid: g.id, kind, name: name.value });
    } }],
  });
  name.placeholder = kind === 'voice' ? 'Nova sala de voz' : 'nova-sala';
  setTimeout(() => name.focus(), 50);
  return m;
}

function renameChannelModal(c) {
  const name = h('input', { type: 'text', maxlength: 40, value: c.name });
  modal({
    title: 'Renomear sala', body: [h('label', { text: 'Nome da sala' }), name],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Salvar', cls: 'primary', submit: true, fn: () => send({ type: 'channel-rename', id: c.id, name: name.value }) }],
  });
  setTimeout(() => name.select(), 50);
}
function deleteChannelModal(c) {
  modal({
    title: 'Apagar sala', body: [h('p', { html: `Tem certeza que quer apagar <b>${esc(c.name)}</b>? Todas as mensagens dela serão perdidas.` })],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Apagar sala', cls: 'danger-btn', fn: () => send({ type: 'channel-delete', id: c.id }) }],
  });
}

// =====================================================================
// mensagens
// =====================================================================
let mentionRe = null;
function rebuildMentionRegex() {
  const names = new Set(['todos', 'everyone']);
  for (const p of [...state.profiles.values(), ...state.users.values()]) if (p.name) names.add(p.name);
  const list = [...names].sort((a, b) => b.length - a.length).map((n) => reEsc(esc(n)));
  mentionRe = new RegExp('@(' + list.join('|') + ')(?![\\p{L}\\p{N}_])', 'giu');
}

function formatText(text) {
  const keep = [];
  const hold = (html) => `\u0000${keep.push(html) - 1}\u0000`;
  let s = esc(text);
  s = s.replace(/```(?:[a-z0-9]+\n)?([\s\S]*?)```/gi, (_, code) => hold(`<pre><code>${code.replace(/^\n|\n$/g, '')}</code></pre>`));
  s = s.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${code}</code>`));
  s = s.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/g, (url) => hold(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`));
  if (mentionRe) s = s.replace(mentionRe, (all) => hold(`<span class="mention">${all}</span>`));
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<u>$1</u>');
  s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
  s = s.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');
  s = s.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[i]);
}

function isJumbo(text) {
  if (!text || text.length > 120) return false;
  const t = text.replace(/\s/g, '');
  if (!/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u.test(t)) return false;
  if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)) return false;
  return [...new Intl.Segmenter().segment(t)].length <= 27;
}

// ---------- preferências de notificação por servidor / sala ----------
// settings.notif[id] = { mode: 'all' | 'mentions' | 'none', noEveryone: bool, muteUntil: instante | -1 (até reativar) }
const notifCfg = (id) => (settings.notif || {})[id] || {};
const mutedNow = (cfg) => cfg.muteUntil === -1 || (cfg.muteUntil > Date.now());
function notifFor(chId) {
  const c = chan(chId);
  if (!c) return { mode: settings.notifyMode, muted: false, noEveryone: false };
  const cc = notifCfg(c.id);
  if (c.type === 'dm') return { mode: cc.mode || 'all', muted: mutedNow(cc), chMuted: mutedNow(cc), noEveryone: false };
  const pc = c.parent ? notifCfg(c.parent) : {};
  const gc = notifCfg(c.guild);
  const chMuted = mutedNow(cc) || mutedNow(pc);
  return { mode: cc.mode || pc.mode || gc.mode || settings.notifyMode || 'all', muted: chMuted || mutedNow(gc), chMuted, guildMuted: mutedNow(gc), noEveryone: !!gc.noEveryone };
}
function setNotif(id, patch) {
  const all = { ...(settings.notif || {}) };
  const cur = { ...(all[id] || {}), ...patch };
  for (const k of Object.keys(cur)) if (cur[k] === undefined || cur[k] === null || cur[k] === '' || cur[k] === false || cur[k] === 0) delete cur[k];
  if (Object.keys(cur).length) all[id] = cur; else delete all[id];
  settings.notif = all;
  saveSettings();
  renderChannels(); renderRail();
}
function muteLabel(cfg) {
  if (cfg.muteUntil === -1) return 'Silenciado até você reativar';
  if (cfg.muteUntil > Date.now()) return 'Silenciado até ' + new Date(cfg.muteUntil).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  return '';
}
function notifModal(id, kind, name) {
  const cfg = notifCfg(id);
  const isGuild = kind === 'guild';
  const parentMode = isGuild ? settings.notifyMode : (chan(id) && chan(id).type !== 'dm' ? notifCfg(chan(id).guild).mode : null) || settings.notifyMode;
  const modeLabels = { all: 'Todas as mensagens', mentions: 'Só @menções e respostas', none: 'Nada' };
  const opts = [['', `Padrão (${isGuild ? 'das configurações' : 'do servidor'}: ${modeLabels[parentMode || 'all'].toLowerCase()})`], ['all', modeLabels.all], ['mentions', modeLabels.mentions], ['none', modeLabels.none]];
  let mode = cfg.mode || '';
  const radios = h('div', { class: 'radio-list' }, ...opts.map(([v, l]) => {
    const r = h('input', { type: 'radio', name: 'nmode', value: v });
    r.checked = v === mode;
    r.addEventListener('change', () => { mode = v; });
    return h('label', { class: 'radio-row' }, r, h('span', { text: l }));
  }));
  const muteSel = h('select', { class: 'select' },
    h('option', { value: '', text: 'Não silenciar' }), h('option', { value: '15', text: 'Por 15 minutos' }), h('option', { value: '60', text: 'Por 1 hora' }),
    h('option', { value: '480', text: 'Por 8 horas' }), h('option', { value: '1440', text: 'Por 24 horas' }), h('option', { value: '-1', text: 'Até eu reativar' }));
  muteSel.value = cfg.muteUntil === -1 ? '-1' : '';
  const status = muteLabel(cfg);
  const evBox = h('input', { type: 'checkbox' });
  evBox.checked = !!cfg.noEveryone;
  modal({
    title: `Notificações de ${isGuild ? '' : kind === 'dm' ? 'conversa com ' : '#'}${name}`,
    desc: isGuild ? 'Vale para todas as salas deste servidor, menos as que tiverem configuração própria.' : 'Vale só para esta sala (e os tópicos dela).',
    body: [
      h('label', { text: 'Avisar quando chegar' }), radios,
      h('label', { text: isGuild ? 'Silenciar o servidor' : 'Silenciar' }), muteSel,
      status ? h('p', { class: 'sr-desc', text: status + '. Escolha "Não silenciar" para reativar ou mantenha a opção para continuar.' }) : null,
      h('p', { class: 'sr-desc', text: 'Silenciado: sem popups nem sons, e a sala/servidor fica apagada na lista. Menções diretas ainda aparecem no contador.' }),
      isGuild ? h('label', { class: 'check-row' }, evBox, h('span', { text: 'Ignorar @todos neste servidor' })) : null,
    ],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Salvar', cls: 'primary', fn: () => {
      const mv = muteSel.value;
      const muteUntil = !muteSel.dataset.touched ? cfg.muteUntil : mv === '' ? 0 : mv === '-1' ? -1 : Date.now() + Number(mv) * 60000;
      setNotif(id, { mode: mode || null, muteUntil, noEveryone: isGuild ? evBox.checked : undefined });
      toast('Notificações salvas.');
    } }],
  });
  muteSel.addEventListener('change', () => { muteSel.dataset.touched = '1'; });
}

function mentionsMe(m, noEveryone) {
  if (!state.me || isMine(m)) return false;
  if (m.reply && m.reply.uid === state.me.id) return true;
  if (!m.text) return false;
  const t = m.text.toLowerCase();
  const n = '@' + state.me.name.toLowerCase();
  const i = t.indexOf(n);
  if (i >= 0 && !/[\p{L}\p{N}_]/u.test(t[i + n.length] || '')) return true;
  return !noEveryone && m.everyone !== false && /@(todos|everyone)(?![\p{L}\p{N}_])/u.test(t);
}

function curList() { return state.msgs.get(state.current) || []; }

function renderAttachments(atts) {
  const box = h('div', { class: 'attachments' });
  const imgs = atts.filter((a) => a.kind === 'image');
  if (imgs.length) {
    const grid = h('div', { class: 'image' + (imgs.length > 1 ? ' grid' : '') });
    for (const a of imgs) {
      const img = h('img', { src: a.url, alt: a.name, title: a.name, loading: 'lazy' });
      img.dataset.dl = `${a.url}?baixar&n=${encodeURIComponent(a.name)}`;
      img.dataset.name = a.name;
      img.addEventListener('load', () => { if (stickBottom) scrollBottom(); });
      grid.append(h('span', { class: 'img-wrap' }, img, h('a', { class: 'img-dl', href: img.dataset.dl, download: a.name, title: 'Baixar ' + a.name, html: lu('download') })));
    }
    box.append(grid);
  }
  for (const a of atts) {
    const dl = `${a.url}?baixar&n=${encodeURIComponent(a.name)}`;
    if (a.kind === 'video') {
      const v = h('video', { src: a.url, controls: true, preload: 'metadata', class: 'att-video' });
      v.addEventListener('loadedmetadata', () => { if (stickBottom) scrollBottom(); });
      box.append(h('div', { class: 'att-media' }, v, h('a', { class: 'att-dl-line', href: dl, download: a.name, text: `${a.name} · ${fmtSize(a.size || 0)}` })));
    } else if (a.kind === 'audio') {
      box.append(h('div', { class: 'att-card audio' },
        h('div', { class: 'att-card-top' }, h('span', { class: 'att-card-icon', html: AUDIO_ICON }),
          h('div', { class: 'att-card-info' }, h('a', { href: dl, download: a.name, text: a.name }), h('span', { text: fmtSize(a.size || 0) })),
          !MUSIC_ENABLED ? null : h('button', { type: 'button', class: 'att-play-call', title: 'Tocar no bot de música da chamada', 'data-music-url': a.url, 'data-music-name': a.name, text: '▶ Tocar na chamada' })),
        h('audio', { src: a.url, controls: true, preload: 'metadata' })));
    } else if (a.kind !== 'image') {
      box.append(h('div', { class: 'att-card' },
        h('div', { class: 'att-card-top' }, h('span', { class: 'att-card-icon', html: FILE_ICON }),
          h('div', { class: 'att-card-info' }, h('a', { href: dl, download: a.name, text: a.name }), h('span', { text: fmtSize(a.size || 0) })),
          h('a', { class: 'att-card-dl', href: dl, download: a.name, title: 'Baixar', html: lu('download') }))));
    }
  }
  return box;
}

function isGrouped(m, prev) {
  return prev && !m.replyTo && prev.uid === m.uid && m.ts - prev.ts < 5 * 60e3 &&
    new Date(prev.ts).toDateString() === new Date(m.ts).toDateString();
}

function buildWrap(m, prev, { preview = false } = {}) {
  const wrap = h('div', { class: 'msg-wrap', 'data-id': m.id });
  if (!preview && (!prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString())) {
    wrap.append(h('div', { class: 'day-divider' }, h('span', { text: new Date(m.ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) })));
  }
  const grouped = !preview && isGrouped(m, prev);
  const p = profileOf(m.uid, m);
  const el = h('div', { class: 'msg' + (grouped ? '' : ' head') + (m.replyTo ? ' has-reply' : '') + (mentionsMe(m) ? ' mentioned' : ''), 'data-id': m.id });

  if (m.replyTo && !grouped) {
    const target = curList().find((x) => x.id === m.replyTo);
    const ref = h('div', { class: 'reply-ref', 'data-jump': m.replyTo });
    if (target) {
      const tp = profileOf(target.uid, target);
      ref.append(avatar(tp), h('b', { text: tp.name }), h('span', { class: 'rtext', text: target.text || 'Clique para ver o anexo' }));
    } else if (m.reply && !m.reply.deleted) {
      const tp = profileOf(m.reply.uid, m.reply);
      ref.append(avatar(tp), h('b', { text: tp.name }), h('span', { class: 'rtext', text: m.reply.text || 'Clique para ver o anexo' }));
    } else {
      ref.append(h('span', { class: 'rtext', html: '<i>A mensagem original foi apagada</i>' }));
    }
    el.append(ref);
  }
  if (grouped) {
    el.append(h('span', { class: 'side-time', text: fmtTime(m.ts) }));
  } else {
    const av = avatar(p);
    av.dataset.uid = m.uid;
    if (m.uid === BOT_ID) { av.textContent = ''; av.innerHTML = I.music; av.classList.add('bot-avatar'); }
    el.append(av, h('div', { class: 'meta' },
      h('span', { class: 'author', 'data-uid': m.uid, style: { color: nameColor(m.uid, p.color, guildOf(m.ch)) }, text: p.name }),
      m.uid === BOT_ID ? h('span', { class: 'bot-tag', text: 'BOT' }) : null,
      h('span', { class: 'time', text: fmtStamp(m.ts) })));
  }

  if (!preview && state.editing && state.editing.id === m.id) {
    const ta = h('textarea', { rows: 1, maxlength: 2000 });
    ta.value = state.editing.draft;
    el.append(h('div', { class: 'edit-box' }, ta),
      h('div', { class: 'edit-hint', html: 'esc para <a data-edit="cancel">cancelar</a> • enter para <a data-edit="save">salvar</a>' }));
  } else if (m.text) {
    const c = h('div', { class: 'content' + (isJumbo(m.text) ? ' jumbo' : ''), html: formatText(m.text) });
    if (m.edited) c.append(h('span', { class: 'edited', title: fmtStamp(m.edited), text: '(editado)' }));
    el.append(c);
  }
  const atts = m.attachments || (m.image ? [{ url: m.image, name: 'imagem', kind: 'image' }] : []);
  if (atts.length) el.append(renderAttachments(atts));
  if (m.pinned) el.classList.add('pinned');
  if (m.thread && !preview) {
    const t = m.thread;
    el.append(h('div', { class: 'thread-link', 'data-thread': t.id, title: 'Abrir tópico' },
      h('span', { class: 'tl-ico', html: lu('messages-square') }), h('b', { text: t.name }),
      h('span', { class: 'tl-count', text: t.count ? `${t.count} ${t.count === 1 ? 'mensagem' : 'mensagens'}` : 'Nenhuma mensagem ainda' }),
      t.count && t.lastTs ? h('span', { class: 'tl-when', text: '· ' + relTime(t.lastTs) }) : null));
  }
  if (!preview) {
    const reacts = Object.entries(m.reactions || {});
    if (reacts.length) {
      const bar = h('div', { class: 'reactions' });
      for (const [emoji, who] of reacts) {
        const names = who.map((u) => profileOf(u).name).join(', ');
        bar.append(h('button', { class: 'reaction' + (who.includes(state.me.id) ? ' me' : ''), 'data-emoji': emoji, title: `${names} reagiu com ${emoji}` },
          h('span', { text: emoji }), h('span', { class: 'count', text: who.length })));
      }
      bar.append(h('button', { class: 'reaction add', 'data-act': 'react', title: 'Adicionar reação', html: I.react }));
      el.append(bar);
    }
    const acts = h('div', { class: 'msg-actions' },
      h('button', { 'data-act': 'react', title: 'Adicionar reação', html: I.react }),
      h('button', { 'data-act': 'reply', title: 'Responder', html: I.reply }));
    const mc = chan(m.ch);
    if (mc && mc.type === 'text' && can('enviar_mensagens', m.ch)) acts.append(h('button', { 'data-act': 'thread', title: m.thread ? 'Abrir tópico' : 'Criar tópico', html: lu('messages-square') }));
    if (mc && (mc.type === 'dm' || can('gerenciar_mensagens', m.ch))) acts.append(h('button', { 'data-act': 'pin', title: m.pinned ? 'Desafixar' : 'Fixar mensagem', html: lu(m.pinned ? 'pin-off' : 'pin') }));
    if (isMine(m)) {
      acts.append(h('button', { 'data-act': 'edit', title: 'Editar', html: I.edit }),
        h('button', { 'data-act': 'delete', class: 'danger', title: 'Apagar (Shift+clique apaga direto)', html: I.trash }));
    } else {
      if (m.uid !== BOT_ID) acts.append(h('button', { 'data-act': 'mention', title: 'Mencionar', html: I.mention }));
      if (can('gerenciar_mensagens', m.ch)) acts.append(h('button', { 'data-act': 'delete', class: 'danger', title: 'Apagar mensagem (moderação)', html: I.trash }));
    }
    el.append(acts);
  }
  wrap.append(el);
  return wrap;
}

let stickBottom = true;
function isNearBottom() { const el = els.messages; return el.scrollHeight - el.scrollTop - el.clientHeight < 120; }
function scrollBottom() { els.messages.scrollTop = els.messages.scrollHeight; }
// quem está no fim continua no fim: quando chega mensagem, quando imagem/vídeo termina de carregar
// e quando o tamanho da área muda (chamada, barra de resposta, janela)
let programmaticScroll = false;
function scrollBottomQuiet() { const b = els.messages.scrollTop; scrollBottom(); programmaticScroll = els.messages.scrollTop !== b; }
const keepBottom = () => { if (stickBottom && !state.detached.has(state.current)) scrollBottomQuiet(); };
els.messages.addEventListener('load', keepBottom, true);
els.messages.addEventListener('loadedmetadata', keepBottom, true);
if ('ResizeObserver' in window) new ResizeObserver(keepBottom).observe(els.messages);
els.messages.addEventListener('scroll', () => {
  if (programmaticScroll) { programmaticScroll = false; stickBottom = true; updateJumpBottom(); return; }
  stickBottom = isNearBottom();
  if (stickBottom && !els.newBar.hidden && !state.detached.has(state.current)) els.newBar.hidden = true;
  updateJumpBottom();
});

function renderMessages(keepScroll) {
  const c = chan(state.current);
  if (!c) return;
  const list = state.msgs.get(c.id);
  if (!list) return;
  const fromBottom = els.messages.scrollHeight - els.messages.scrollTop;
  const frag = document.createDocumentFragment();
  if (c.type === 'dm') {
    const uid = dmOther(c);
    const p = profileOf(uid);
    frag.append(h('div', { class: 'welcome' }, avatar(p, { cls: 'welcome-avatar' }), h('h2', { text: p.name }),
      h('p', { text: `Este é o começo da sua conversa privada com ${p.name}. Só vocês dois veem estas mensagens.` })));
  } else if (c.type === 'thread') {
    const parent = chan(c.parent);
    const start = (state.msgs.get(c.parent) || []).find((x) => x.id === c.starter);
    frag.append(h('div', { class: 'welcome' }, h('div', { class: 'big-ico', html: lu('messages-square') }), h('h2', { text: c.name }),
      h('p', {}, 'Tópico criado a partir de uma mensagem em ', h('a', { class: 'link', text: '#' + (parent ? parent.name : 'sala'), onclick: () => parent && openChannel(parent.id) }), '.'),
      start ? buildWrap(start, null, { preview: true }) : null));
  } else frag.append(h('div', { class: 'welcome' },
    h('div', { class: 'big-ico', html: c.type === 'voice' ? I.speaker : I.hash }),
    h('h2', { text: c.type === 'voice' ? `Chat de ${c.name}` : `Bem-vindo(a) a #${c.name}!` }),
    h('p', { text: c.type === 'voice' ? 'As mensagens desta chamada ficam aqui. Quem estiver na chamada pode conversar por texto também.' : `Este é o começo da sala #${c.name}.` })));
  let prev = null;
  const from = state.unreadFrom[c.id];
  let divider = null;
  let newCount = 0;
  for (const m of list) {
    if (from != null && m.ts > from && !isMine(m)) {
      newCount++;
      if (!divider) { divider = h('div', { class: 'new-divider' }, h('span', { text: 'Novas' })); frag.append(divider); }
    }
    frag.append(buildWrap(m, prev));
    prev = m;
  }
  els.messages.replaceChildren(frag);
  if (keepScroll && !stickBottom) els.messages.scrollTop = els.messages.scrollHeight - fromBottom;
  else if (divider && !keepScroll && divider.offsetTop > els.messages.clientHeight * 0.6 && !state.detached.has(c.id)) {
    els.messages.scrollTop = divider.offsetTop - 80; // abre onde você parou
    stickBottom = isNearBottom();
  } else { scrollBottom(); stickBottom = true; }
  renderNewBar(c.id, divider ? newCount : 0);
  updateJumpBottom();
  focusEditor();
}

function refreshMsg(id) {
  const list = curList();
  const i = list.findIndex((x) => x.id === id);
  const old = els.messages.querySelector(`.msg-wrap[data-id="${CSS.escape(id)}"]`);
  if (i < 0 || !old) return;
  const stick = isNearBottom();
  old.replaceWith(buildWrap(list[i], list[i - 1] || null));
  if (stick) scrollBottom();
  focusEditor();
}

function appendMsg(m) {
  const list = curList();
  const stick = stickBottom || isNearBottom() || isMine(m);
  els.messages.append(buildWrap(m, list[list.length - 2] || null));
  if (stick) { scrollBottomQuiet(); stickBottom = true; }
}

function onChat(m) {
  const c = chan(m.ch);
  if (!c) return;
  c.lastTs = m.ts;
  c.lastUid = m.uid;
  const list = state.msgs.get(m.ch);
  if (list) {
    list.push(m);
    if (list.length > 1000) list.shift();
  }
  clearTyping(m.ch + ':' + m.uid);
  overlayMessage(m);
  fsChatOnMessage(m);
  // o chat da chamada minimizado (ou a tela cheia com o chat fechado) não conta como "vendo" a mensagem
  const chatHidden = els.main.classList.contains('chat-min') || (!!document.fullscreenElement && !fsChat.isConnected);
  const viewing = m.ch === state.current && document.hasFocus() && !document.hidden && !chatHidden;
  if (m.ch === state.current && list) appendMsg(m);
  if (m.ch === state.current && els.main.classList.contains('chat-min') && !isMine(m)) {
    state.callChatUnread = (state.callChatUnread || 0) + 1;
    els.callChatBadge.hidden = false;
    els.callChatBadge.textContent = state.callChatUnread > 9 ? '9+' : state.callChatUnread;
  }
  if (isMine(m)) { markRead(m.ch); return; }
  const nf = notifFor(m.ch);
  const mention = mentionsMe(m, nf.noEveryone) || c.type === 'dm';
  if (c.type === 'dm' && !state.openDMs.has(c.id)) { const hidden = load('dl-hidden-dms', {}); if (hidden[c.id]) { delete hidden[c.id]; store('dl-hidden-dms', hidden); } }
  if (viewing) { markRead(m.ch); return; }
  if (m.ch === state.current) markRead(m.ch); // está na sala mas com a janela em segundo plano
  if (mention) state.mentions.set(m.ch, (state.mentions.get(m.ch) || 0) + 1);
  renderChannels();
  notifyMessage(m, mention, nf);
}

els.messages.addEventListener('click', (e) => {
  const mb = e.target.closest('[data-music-url]');
  if (mb) return musicAdd([{ url: mb.dataset.musicUrl, name: mb.dataset.musicName }]);
  const sp = e.target.closest('.spoiler');
  if (sp) return sp.classList.add('shown');
  const img = e.target.closest('.image img');
  if (img) { openLightbox(img); return; }
  const who = e.target.closest('[data-uid]');
  if (who && (who.classList.contains('author') || who.classList.contains('avatar'))) return showProfile(who.dataset.uid, who);
  const jump = e.target.closest('[data-jump]');
  if (jump) return jumpTo(jump.dataset.jump);
  const th = e.target.closest('[data-thread]');
  if (th) return chan(th.dataset.thread) ? openChannel(th.dataset.thread) : toast('Esse tópico foi apagado.');
  const ed = e.target.closest('[data-edit]');
  if (ed) return ed.dataset.edit === 'save' ? saveEdit() : cancelEdit();
  const reaction = e.target.closest('.reaction[data-emoji]');
  const msgEl = e.target.closest('.msg');
  if (!msgEl) return;
  const m = curList().find((x) => x.id === msgEl.dataset.id);
  if (!m) return;
  if (reaction) return send({ type: 'react', ch: m.ch, id: m.id, emoji: reaction.dataset.emoji });
  const act = e.target.closest('[data-act]');
  if (!act) return;
  switch (act.dataset.act) {
    case 'react':
      msgEl.classList.add('menu-open');
      openEmojiPicker(act, (emoji) => send({ type: 'react', ch: m.ch, id: m.id, emoji }), () => msgEl.classList.remove('menu-open'));
      break;
    case 'reply': setReply(m.id); break;
    case 'edit': startEdit(m); break;
    case 'delete': if (e.shiftKey) send({ type: 'delete', ch: m.ch, id: m.id }); else confirmDelete(m); break;
    case 'mention': insertMention(profileOf(m.uid, m).name); break;
    case 'pin': send({ type: 'pin', ch: m.ch, id: m.id, pinned: !m.pinned }); break;
    case 'thread': if (m.thread && chan(m.thread.id)) openChannel(m.thread.id); else createThreadModal(m); break;
  }
});
function openLightbox(img) {
  $('img', els.lightbox).src = img.src;
  const bar = $('.lb-bar', els.lightbox);
  bar.replaceChildren(h('span', { class: 'lb-name', text: img.dataset.name || '' }),
    h('a', { class: 'lb-btn', href: img.dataset.dl || img.src, download: img.dataset.name || '', html: lu('download') + '<span>Baixar</span>', onclick: (e) => e.stopPropagation() }),
    h('button', { type: 'button', class: 'lb-btn', title: 'Fechar (Esc)', html: lu('x') }));
  els.lightbox.hidden = false;
}
els.lightbox.addEventListener('click', (e) => { if (e.target.closest('a')) return; els.lightbox.hidden = true; });
// aviso dos downloads no app (.exe): salva em Downloads e dá para abrir
if (desk && desk.onDownload) desk.onDownload((d) => {
  if (d.state === 'started') return toast(`Baixando ${d.name}…`, 2500);
  if (d.state !== 'completed') return toast(`Não deu para baixar ${d.name}.`);
  const t = h('div', { class: 'toast dl-toast' }, h('span', { html: lu('check') }), h('span', { class: 'dl-name', text: `${d.name} salvo em Downloads` }),
    h('button', { type: 'button', text: 'Abrir', onclick: () => { desk.openDownload(d.path); t.remove(); } }),
    h('button', { type: 'button', text: 'Mostrar na pasta', onclick: () => { desk.showDownload(d.path); t.remove(); } }));
  els.toasts.append(t);
  setTimeout(() => t.remove(), 9000);
});

function jumpTo(id) {
  const el = els.messages.querySelector(`.msg[data-id="${CSS.escape(id)}"]`);
  if (!el) return toast('Essa mensagem é antiga demais ou foi apagada.');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

// =====================================================================
// barra de mensagens novas / ir para o fim
// =====================================================================
function renderNewBar(chId, count) {
  const from = state.unreadFrom[chId];
  if (state.detached.has(chId)) {
    els.newBar.hidden = false;
    els.newBar.replaceChildren(h('span', { text: 'Você está vendo mensagens antigas' }), h('button', { type: 'button', text: 'Voltar para o presente', onclick: jumpToPresent }));
    return;
  }
  if (!count || from == null || isNearBottom()) { els.newBar.hidden = true; return; }
  els.newBar.hidden = false;
  els.newBar.replaceChildren(
    h('span', { class: 'nb-text', text: `${count} ${count === 1 ? 'mensagem nova' : 'mensagens novas'} desde ${fmtTime(from)}`, onclick: () => { const d = $('.new-divider', els.messages); if (d) els.messages.scrollTop = d.offsetTop - 80; } }),
    h('button', { type: 'button', html: lu('check-check') + '<span>Marcar como lida</span>', onclick: () => { state.unreadFrom[chId] = null; els.newBar.hidden = true; const d = $('.new-divider', els.messages); if (d) d.remove(); } }));
}
function updateJumpBottom() {
  const far = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight > 600;
  els.jumpBottom.hidden = !(far || state.detached.has(state.current));
}
function jumpToPresent() {
  const ch = state.current;
  if (state.detached.has(ch)) { state.detached.delete(ch); send({ type: 'history', ch }); return; }
  els.messages.scrollTo({ top: els.messages.scrollHeight, behavior: 'smooth' });
}
els.jumpBottom.addEventListener('click', jumpToPresent);
// abre uma mensagem de qualquer sala (busca, fixadas)
function goToMessage(ch, id) {
  if (state.current !== ch) openChannel(ch);
  const tryJump = () => {
    const list = state.msgs.get(ch);
    if (!list) return setTimeout(tryJump, 150);
    if (list.some((x) => x.id === id)) jumpTo(id);
    else send({ type: 'history', ch, around: id });
  };
  setTimeout(tryJump, 60);
}

// =====================================================================
// painel lateral: fixadas, busca, tópicos
// =====================================================================
function openSidePanel(key, title, body) {
  state.sidePanel = key;
  els.sidePanel.hidden = false;
  els.sidePanel.replaceChildren(h('div', { class: 'sp-head' }, h('b', { text: title }),
    h('button', { type: 'button', class: 'icon-btn small', title: 'Fechar (Esc)', html: lu('x'), onclick: closeSidePanel })), h('div', { class: 'sp-body' }, ...[].concat(body)));
  els.pinsBtn.classList.toggle('on', key.startsWith('pins'));
  els.threadsBtn.classList.toggle('on', key.startsWith('threads'));
}
function closeSidePanel() {
  state.sidePanel = null;
  els.sidePanel.hidden = true;
  els.pinsBtn.classList.remove('on');
  els.threadsBtn.classList.remove('on');
}
function miniMsg(m, opts = {}) {
  const p = profileOf(m.uid, m);
  const files = (m.attachments || []).map((a) => a.name);
  const card = h('div', { class: 'sp-msg', title: 'Ir para a mensagem' },
    h('div', { class: 'spm-head' }, avatar(p), h('b', { style: { color: nameColor(m.uid, p.color, guildOf(m.ch)) }, text: p.name }),
      opts.where ? h('span', { class: 'spm-where', text: opts.where }) : null,
      h('span', { class: 'spm-time', text: new Date(m.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) })),
    m.text ? h('div', { class: 'spm-text', html: opts.words ? highlight(formatText(m.text.slice(0, 400)), opts.words) : formatText(m.text.slice(0, 400)) }) : null,
    files.length ? h('div', { class: 'spm-files' }, h('span', { html: lu('paperclip') }), files.slice(0, 3).join(', ') + (files.length > 3 ? ` e mais ${files.length - 3}` : '')) : null);
  card.addEventListener('click', (e) => { if (e.target.closest('button')) return; goToMessage(m.ch, m.id); });
  if (opts.actions) card.append(h('div', { class: 'spm-actions' }, ...opts.actions));
  return card;
}
function highlight(html, words) {
  if (!words.length) return html;
  const re = new RegExp('(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return html.replace(/(^|>)([^<]+)/g, (all, a, txt) => a + txt.replace(re, '<mark>$1</mark>'));
}

// ---------- fixadas ----------
els.pinsBtn.addEventListener('click', () => {
  const ch = state.current;
  if (state.sidePanel === 'pins:' + ch) return closeSidePanel();
  openSidePanel('pins:' + ch, 'Mensagens fixadas', h('div', { class: 'sp-empty', text: 'Carregando…' }));
  send({ type: 'pins', ch });
});
function renderPins(ch, msgs) {
  const c = chan(ch);
  const canPin = c && (c.type === 'dm' || can('gerenciar_mensagens', ch));
  openSidePanel('pins:' + ch, `Mensagens fixadas${c && c.name ? ' em #' + c.name : ''}`, msgs.length ? msgs.map((m) => miniMsg(m, {
    actions: canPin ? [h('button', { type: 'button', class: 'icon-btn small', title: 'Desafixar', html: lu('pin-off'), onclick: () => send({ type: 'pin', ch, id: m.id, pinned: false }) })] : [],
  })) : h('div', { class: 'sp-empty' }, h('div', { class: 'sp-empty-ico', html: lu('pin') }), 'Nenhuma mensagem fixada aqui.',
    h('small', { text: canPin ? 'Passe o mouse numa mensagem e clique no alfinete para fixar.' : 'Quem pode gerenciar mensagens consegue fixar.' })));
}

// ---------- tópicos ----------
els.threadsBtn.addEventListener('click', () => {
  const c = chan(state.current);
  const parentId = c && c.type === 'thread' ? c.parent : state.current;
  if (state.sidePanel === 'threads:' + parentId) return closeSidePanel();
  const list = state.channels.filter((x) => x.type === 'thread' && x.parent === parentId).sort((a, b) => Math.max(b.lastTs || 0, b.ts) - Math.max(a.lastTs || 0, a.ts));
  openSidePanel('threads:' + parentId, 'Tópicos de #' + (chan(parentId) ? chan(parentId).name : ''), list.length ? list.map((t) => {
    const n = ((state.msgs.get(parentId) || []).find((x) => x.id === t.starter) || {}).thread;
    return h('div', { class: 'sp-thread' + (isUnread(t) ? ' unread' : ''), onclick: () => openChannel(t.id) },
      h('span', { class: 'tl-ico', html: lu('messages-square') }),
      h('div', { class: 'spt-text' }, h('b', { text: t.name }), h('small', { text: (n && n.count ? `${n.count} ${n.count === 1 ? 'mensagem' : 'mensagens'} · ` : '') + 'ativo ' + relTime(Math.max(t.lastTs || 0, t.ts)) })));
  }) : h('div', { class: 'sp-empty' }, h('div', { class: 'sp-empty-ico', html: lu('messages-square') }), 'Nenhum tópico nesta sala.',
    h('small', { text: 'Passe o mouse numa mensagem e clique em "Criar tópico" para puxar uma conversa paralela.' })));
});
function createThreadModal(m) {
  const name = h('input', { type: 'text', class: 'text-input', maxlength: 60, placeholder: 'Nome do tópico' });
  name.value = (m.text || '').split('\n')[0].replace(/[*_~`|>#]/g, '').trim().slice(0, 40) || 'Novo tópico';
  modal({
    title: 'Criar tópico', desc: 'Uma conversa separada a partir desta mensagem. Aparece embaixo da sala, na barra da esquerda.',
    body: [buildWrap(m, null, { preview: true }), h('label', { text: 'Nome do tópico' }), name],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Criar tópico', cls: 'primary', fn: () => send({ type: 'thread-create', ch: m.ch, msg: m.id, name: name.value }) }],
  });
  setTimeout(() => { name.focus(); name.select(); }, 30);
}
function relTime(ts) {
  const d = (Date.now() + state.clockOffset - ts) / 1000;
  if (d < 60) return 'agora';
  if (d < 3600) return `há ${Math.floor(d / 60)} min`;
  if (d < 86400) return `há ${Math.floor(d / 3600)} h`;
  const days = Math.floor(d / 86400);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

// ---------- busca ----------
let searchToken = 0;
const SEARCH_HINTS = [
  ['de:', 'pessoa', 'de:mikael'], ['em:', 'sala', 'em:geral'], ['tem:', 'arquivo, imagem, video, link ou fixada', 'tem:imagem'],
  ['antes:', 'data', 'antes:10/11/2026'], ['depois:', 'data', 'depois:01/11/2026'], ['durante:', 'dia', 'durante:11/11/2026'],
];
function parseDate(t) {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t) || /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  let d, mo, y;
  if (t.includes('-')) { y = +m[1]; mo = +m[2]; d = +m[3]; } else { d = +m[1]; mo = +m[2]; y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000; }
  const dt = new Date(y, mo - 1, d);
  return isNaN(dt) ? null : dt.getTime() - state.clockOffset;
}
function findUserByName(q) {
  q = q.toLowerCase().replace(/^@/, '');
  const all = [...new Set([...state.users.keys(), ...state.profiles.keys()])];
  return all.find((id) => (state.users.get(id) || {}).username === q) || all.find((id) => profileOf(id).name.toLowerCase() === q) ||
    all.find((id) => profileOf(id).name.toLowerCase().startsWith(q)) || all.find((id) => ((state.users.get(id) || {}).username || '').startsWith(q));
}
function runSearch(raw) {
  const c = chan(state.current);
  const q = { type: 'search', token: ++searchToken };
  if (c && c.type === 'dm') q.ch = c.id; else if (curGuild()) q.gid = curGuild().id; else return;
  const words = [];
  const problems = [];
  const toks = raw.match(/\S+:"[^"]*"|\S+/g) || [];
  for (const tok of toks) {
    const m = /^(de|em|tem|antes|depois|durante):(.*)$/i.exec(tok);
    if (!m) { words.push(tok); continue; }
    const v = m[2].replace(/^"|"$/g, '');
    const k = m[1].toLowerCase();
    if (k === 'de') { const uid = v.toLowerCase() === 'bot' ? BOT_ID : findUserByName(v); if (uid) q.from = uid; else problems.push(`ninguém chamado "${v}"`); }
    else if (k === 'em') { const ch = state.channels.find((x) => x.guild === q.gid && x.name.toLowerCase() === v.replace(/^#/, '').toLowerCase()); if (ch) q.in = ch.id; else problems.push(`sala "${v}" não encontrada`); }
    else if (k === 'tem') q.has = { arquivos: 'arquivo', imagens: 'imagem', foto: 'imagem', fotos: 'imagem', videos: 'video', 'vídeo': 'video', links: 'link', fixadas: 'fixada' }[v.toLowerCase()] || v.toLowerCase();
    else { const t = parseDate(v); if (t == null) { problems.push(`data "${v}" inválida (use dd/mm/aaaa)`); continue; }
      if (k === 'antes') q.before = t; else if (k === 'depois') q.after = t + 86400000; else { q.after = t; q.before = t + 86400000; } }
  }
  q.q = words.join(' ');
  if (!q.q && !q.from && !q.in && !q.has && !q.before && !q.after) {
    if (problems.length) openSidePanel('search', 'Busca', h('div', { class: 'sp-warn', text: 'Não entendi: ' + problems.join('; ') }));
    return;
  }
  state.searchWords = words.map((w) => w.toLowerCase());
  openSidePanel('search', 'Buscando…', [problems.length ? h('div', { class: 'sp-warn', text: 'Ignorado: ' + problems.join('; ') }) : null, h('div', { class: 'sp-empty', text: 'Buscando…' })].filter(Boolean));
  state.searchProblems = problems;
  send(q);
}
function renderSearchResults(m) {
  const words = state.searchWords || [];
  const body = [];
  if ((state.searchProblems || []).length) body.push(h('div', { class: 'sp-warn', text: 'Ignorado: ' + state.searchProblems.join('; ') }));
  if (!m.results.length) body.push(h('div', { class: 'sp-empty' }, h('div', { class: 'sp-empty-ico', html: lu('search') }), 'Nada encontrado.', h('small', { text: 'Tente outras palavras ou tire alguns filtros.' })));
  for (const r of m.results) body.push(miniMsg(r, { words, where: r.chName ? (r.chType === 'voice' ? '' : r.chType === 'thread' ? '' : '#') + r.chName : null }));
  if (m.total > m.results.length) body.push(h('div', { class: 'sp-empty small', text: `Mostrando as ${m.results.length} mais recentes. Use filtros para achar as outras.` }));
  openSidePanel('search', m.total ? `${m.total} ${m.total === 1 ? 'resultado' : 'resultados'}` : 'Busca', body);
}
function showSearchHints() {
  if (els.searchInput.value.trim() || (state.sidePanel && state.sidePanel !== 'hints')) return;
  openSidePanel('hints', 'Filtros de busca', [h('p', { class: 'sr-desc', text: 'Digite palavras e/ou filtros e aperte Enter.' }),
    ...SEARCH_HINTS.map(([k, d, ex]) => h('div', { class: 'sp-hint', onmousedown: (e) => { e.preventDefault(); els.searchInput.value = (els.searchInput.value + ' ' + k).trim(); els.searchInput.focus(); els.searchClear.hidden = false; } },
      h('b', { text: k }), h('span', { text: d }), h('code', { text: ex })))]);
}
els.searchInput.addEventListener('focus', showSearchHints);
els.searchInput.addEventListener('input', () => { els.searchClear.hidden = !els.searchInput.value; if (!els.searchInput.value && state.sidePanel === 'search') showSearchHints(); });
els.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); runSearch(els.searchInput.value.trim()); }
  if (e.key === 'Escape') { els.searchInput.value = ''; els.searchClear.hidden = true; closeSidePanel(); els.searchInput.blur(); }
});
els.searchInput.addEventListener('blur', () => { if (state.sidePanel === 'hints') setTimeout(() => { if (state.sidePanel === 'hints' && document.activeElement !== els.searchInput) closeSidePanel(); }, 150); });
els.searchClear.addEventListener('click', () => { els.searchInput.value = ''; els.searchClear.hidden = true; closeSidePanel(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.sidePanel && !document.querySelector('.modal-backdrop')) closeSidePanel();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !els.searchBox.hidden) { e.preventDefault(); els.searchInput.focus(); els.searchInput.select(); }
});

// =====================================================================
// ligação no privado
// =====================================================================
els.dmCallBtn.addEventListener('click', () => startDmCall(false));
els.dmVideoBtn.addEventListener('click', () => startDmCall(true));
async function startDmCall(video) {
  const c = chan(state.current);
  if (!c || c.type !== 'dm') return;
  const other = dmOther(c);
  await joinVoice(c.id);
  if (!voice.active) return;
  if (![...state.users.values()].some((u) => u.id === other && u.voice === c.id)) toast(isOnline(other) || state.users.has(other) ? `Chamando ${dmName(c)}…` : `${dmName(c)} está offline. A ligação fica aberta caso entre.`, 5000);
  if (video && !localVideo.camera) setTimeout(() => els.camBtn.click(), 600);
}
let ringTimer = null;
let ringCtx = null;
function ringTone() {
  if (statusOf(state.me.id) === 'ocupado') return;
  try {
    ringCtx = ringCtx || new AudioContext();
    const beep = (t, f) => { const o = ringCtx.createOscillator(); const g = ringCtx.createGain(); o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + 0.35); g.gain.linearRampToValueAtTime(0, t + 0.4);
      o.connect(g).connect(ringCtx.destination); o.start(t); o.stop(t + 0.42); };
    const t = ringCtx.currentTime + 0.05;
    beep(t, 660); beep(t + 0.45, 880);
  } catch { /* sem som */ }
}
function stopRingTone() { clearInterval(ringTimer); ringTimer = null; }
function onRing(m) {
  if (voice.active && state.voiceCh === m.ch) return;
  const c = chan(m.ch);
  if (!c) return;
  const p = profileOf(m.from);
  els.ringBox.hidden = false;
  els.ringBox.dataset.ch = m.ch;
  els.ringBox.replaceChildren(avatar(p, { cls: 'ring-avatar' }), h('div', { class: 'ring-text' }, h('b', { text: p.name }), h('span', { text: 'está te ligando…' })),
    h('div', { class: 'ring-btns' },
      h('button', { type: 'button', class: 'ring-no', title: 'Recusar', html: lu('hang-up'), onclick: () => { send({ type: 'dm-ring-decline', ch: m.ch }); stopRing(m.ch); } }),
      h('button', { type: 'button', class: 'ring-yes', title: 'Atender', html: lu('phone'), onclick: () => { stopRing(m.ch); openChannel(m.ch); joinVoice(m.ch); } })));
  stopRingTone();
  ringTone();
  ringTimer = setInterval(ringTone, 2500);
  setTimeout(() => stopRing(m.ch), 45000);
  if (document.hidden || !document.hasFocus()) {
    if (desk && desk.flash) desk.flash();
    if (statusOf(state.me.id) !== 'ocupado') sysNotify(`${p.name} está te ligando`, 'Clique para abrir o Concord e atender', { ch: m.ch }, 'ring:' + m.ch);
  }
}
function stopRing(ch) {
  if (els.ringBox.dataset.ch !== ch) return;
  els.ringBox.hidden = true;
  els.ringBox.dataset.ch = '';
  stopRingTone();
}

// ---------- editar / apagar / responder ----------
function startEdit(m) {
  state.editing = { id: m.id, draft: m.text };
  refreshMsg(m.id);
}
function focusEditor() {
  if (!state.editing) return;
  const ta = els.messages.querySelector(`.msg[data-id="${CSS.escape(state.editing.id)}"] .edit-box textarea`);
  if (!ta || document.activeElement === ta) return;
  const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  grow();
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.oninput = () => { state.editing.draft = ta.value; grow(); };
  ta.onkeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
    else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); saveEdit(); }
  };
}
function cancelEdit() {
  if (!state.editing) return;
  const id = state.editing.id;
  state.editing = null;
  refreshMsg(id);
  els.input.focus();
}
function saveEdit() {
  if (!state.editing) return;
  const m = curList().find((x) => x.id === state.editing.id);
  const text = replaceShortcodes(state.editing.draft.trim());
  if (!m) return cancelEdit();
  if (!text && !m.image && !(m.attachments || []).length) { cancelEdit(); return confirmDelete(m); }
  if (text !== m.text) send({ type: 'edit', ch: m.ch, id: m.id, text });
  cancelEdit();
}
function confirmDelete(m) {
  const preview = h('div', { class: 'preview-box' }, buildWrap(m, null, { preview: true }));
  modal({
    title: 'Apagar mensagem', body: [h('p', { text: 'Tem certeza que deseja apagar esta mensagem?' }), preview,
      h('p', { class: 'edit-hint', style: { marginTop: '12px', marginBottom: '0' }, html: '<b>Dica:</b> segure Shift ao clicar na lixeira para apagar sem confirmar.' })],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Apagar', cls: 'danger-btn', fn: () => send({ type: 'delete', ch: m.ch, id: m.id }) }],
  });
}

function setReply(id) {
  state.replyTo = id;
  const m = id && curList().find((x) => x.id === id);
  els.replyBar.hidden = !m;
  els.composerBox.classList.toggle('with-reply', !!m);
  if (m) {
    els.replyName.textContent = profileOf(m.uid, m).name;
    els.input.focus();
  }
}
els.replyCancel.addEventListener('click', () => setReply(null));

function insertMention(name) {
  const v = els.input.value;
  const add = (v && !/\s$/.test(v) ? ' ' : '') + '@' + name + ' ';
  els.input.value = v + add;
  els.input.focus();
  autoGrow();
}

// =====================================================================
// composer, autocomplete
// =====================================================================
function autoGrow() { els.input.style.height = 'auto'; els.input.style.height = els.input.scrollHeight + 'px'; }

function replaceShortcodes(text) {
  return text.replace(/(^|[^\w`]):([a-z0-9_+-]{2,32}):/gi, (all, pre, name) => {
    const e = EMOJI_BY_NAME.get(name.toLowerCase());
    return e ? pre + e : all;
  });
}

function submit() {
  const text = replaceShortcodes(els.input.value.trim());
  if (!state.connected || sending) return;
  if (!pending.length && text.startsWith('/') && runCommand(text)) {
    els.input.value = '';
    autoGrow();
    closeAutocomplete();
    return;
  }
  if (pending.length) { closeAutocomplete(); sendWithAttachments(text); return; }
  if (!text) return;
  send({ type: 'chat', ch: state.current, text, replyTo: state.replyTo || undefined });
  els.input.value = '';
  autoGrow();
  setReply(null);
  state.lastTypingSent = 0;
  closeAutocomplete();
}

// ---------- comandos com / ----------
const COMMANDS = [
  ['tocar', '<link de áudio>', 'Toca uma música no bot (link direto de .mp3, .ogg…)'],
  ['pular', '', 'Pula para a próxima música'],
  ['pausar', '', 'Pausa a música'],
  ['continuar', '', 'Continua a música pausada'],
  ['parar', '', 'Para a música e limpa a fila'],
  ['fila', '', 'Mostra a fila de músicas'],
  ['embaralhar', '', 'Embaralha a fila'],
  ['status', '<texto>', 'Define seu status (ex.: /status estudando). Sem texto, limpa.'],
  ['ajuda', '', 'Lista os comandos'],
].filter((c) => MUSIC_ENABLED || !['tocar', 'pular', 'pausar', 'continuar', 'parar', 'fila', 'embaralhar'].includes(c[0]));
function runCommand(text) {
  const [, cmd, arg = ''] = text.match(/^\/(\S+)\s*([\s\S]*)$/) || [];
  const known = COMMANDS.find((c) => c[0] === (cmd || '').toLowerCase());
  if (!known) return false;
  const music = ['tocar', 'pular', 'pausar', 'continuar', 'parar', 'fila', 'embaralhar'];
  if (music.includes(known[0]) && !(voice.active && state.voiceCh)) { toast('Entre numa sala de voz para usar o bot de música.'); return true; }
  switch (known[0]) {
    case 'tocar':
      if (!arg.trim()) { openMusicQueue(); return true; }
      musicAdd([{ url: arg.trim(), name: '' }]);
      return true;
    case 'pular': musicCmd('skip'); return true;
    case 'pausar': musicCmd('pause'); return true;
    case 'continuar': musicCmd('resume'); return true;
    case 'parar': musicCmd('stop'); return true;
    case 'embaralhar': musicCmd('shuffle'); return true;
    case 'fila': openMusicQueue(); return true;
    case 'status':
      settings.activity = arg.trim() ? { kind: 'status', name: arg.trim().slice(0, 60) } : null;
      saveSettings();
      sendActivity();
      toast(arg.trim() ? 'Status definido.' : 'Status limpo.');
      return true;
    case 'ajuda':
      modal({ title: 'Comandos', body: [h('div', { class: 'cmd-list' }, ...COMMANDS.map(([n, a, d]) => h('div', { class: 'cmd-row' }, h('code', { text: `/${n} ${a}`.trim() }), h('span', { text: d }))))],
        buttons: [{ label: 'Fechar', cls: 'secondary' }] });
      return true;
  }
  return false;
}

const ac = { items: [], sel: 0, start: 0, kind: null };
function updateAutocomplete() {
  const pos = els.input.selectionStart;
  const before = els.input.value.slice(0, pos);
  const cm = before.match(/^\/(\S*)$/);
  if (cm) {
    const q = cm[1].toLowerCase();
    const items = COMMANDS.filter((c) => c[0].startsWith(q)).map(([n, a, d]) => ({ insert: '/' + n + ' ', node: [h('span', { class: 'em', text: '/' }), h('span', { text: n + (a ? ' ' + a : '') }), h('span', { class: 'ac-sub', text: d })] }));
    return showAutocomplete('Comandos', items, 0);
  }
  let m = before.match(/(?:^|\s)@([^\s@]{0,32})$/);
  if (m) {
    const q = m[1].toLowerCase();
    const seen = new Set();
    const people = [];
    const add = (id, p, online) => {
      if (seen.has(id) || !p.name) return;
      seen.add(id);
      if (!q || p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || p.name.toLowerCase().startsWith(q)) people.push({ id, p, online });
    };
    for (const [id, u] of state.users) add(id, u, true);
    for (const [id, p] of state.profiles) add(id, p, false);
    const items = people.slice(0, 8).map((x) => ({ insert: '@' + x.p.name + ' ', node: [avatar(x.p), h('span', { text: x.p.name }), h('span', { class: 'ac-sub', text: x.online ? 'online' : '' })] }));
    if ('todos'.startsWith(q)) items.push({ insert: '@todos ', node: [h('span', { class: 'em', html: I.megaphone }), h('span', { text: '@todos' }), h('span', { class: 'ac-sub', text: 'avisa todo mundo' })] });
    return showAutocomplete('Membros', items, pos - m[1].length - 1);
  }
  m = before.match(/(?:^|\s):([a-z0-9_+-]{2,32})$/i);
  if (m) {
    const q = m[1].toLowerCase();
    const starts = EMOJIS.filter((e) => e.name.startsWith(q));
    const contains = EMOJIS.filter((e) => !e.name.startsWith(q) && e.keywords.split(' ').some((k) => k.startsWith(q)));
    const items = [...starts, ...contains].slice(0, 10).map((e) => ({ insert: e.char + ' ', node: [h('span', { class: 'em', text: e.char }), h('span', { text: ':' + e.name + ':' })] }));
    return showAutocomplete(`Emojis correspondentes a :${q}`, items, pos - m[1].length - 1);
  }
  closeAutocomplete();
}
function showAutocomplete(title, items, start) {
  if (!items.length) return closeAutocomplete();
  ac.items = items; ac.start = start; ac.sel = Math.min(ac.sel, items.length - 1);
  const box = els.autocomplete;
  box.replaceChildren(h('div', { class: 'ac-title', text: title }),
    ...items.map((it, i) => h('div', { class: 'ac-item' + (i === ac.sel ? ' sel' : ''), 'data-i': i }, ...it.node)));
  box.hidden = false;
}
function closeAutocomplete() { els.autocomplete.hidden = true; ac.items = []; ac.sel = 0; }
function applyAutocomplete(i = ac.sel) {
  const it = ac.items[i];
  if (!it) return;
  const v = els.input.value;
  const pos = els.input.selectionStart;
  els.input.value = v.slice(0, ac.start) + it.insert + v.slice(pos);
  const caret = ac.start + it.insert.length;
  els.input.setSelectionRange(caret, caret);
  closeAutocomplete();
  autoGrow();
  els.input.focus();
}
els.autocomplete.addEventListener('mousedown', (e) => {
  const it = e.target.closest('.ac-item');
  if (it) { e.preventDefault(); applyAutocomplete(Number(it.dataset.i)); }
});

els.input.addEventListener('keydown', (e) => {
  if (!els.autocomplete.hidden && ac.items.length) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ac.sel = (ac.sel + (e.key === 'ArrowDown' ? 1 : -1) + ac.items.length) % ac.items.length;
      $$('.ac-item', els.autocomplete).forEach((x, i) => x.classList.toggle('sel', i === ac.sel));
      return;
    }
    const sel = ac.items[ac.sel];
    if (e.key === 'Enter' && !e.shiftKey && sel && sel.insert.startsWith('/') && els.input.value.trim().toLowerCase() === sel.insert.trim()) { closeAutocomplete(); }
    else if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); applyAutocomplete(); return; }
    if (e.key === 'Escape') { e.preventDefault(); closeAutocomplete(); return; }
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); return; }
  if (e.key === 'Escape' && state.replyTo) { setReply(null); return; }
  if (e.key === 'ArrowUp' && !els.input.value) {
    const mine = [...curList()].reverse().find((m) => isMine(m) && m.text);
    if (mine) { e.preventDefault(); startEdit(mine); }
  }
});
els.input.addEventListener('input', () => {
  autoGrow();
  updateAutocomplete();
  const now = Date.now();
  if (els.input.value.trim() && now - state.lastTypingSent > 3000) { state.lastTypingSent = now; send({ type: 'typing', ch: state.current }); }
});
els.input.addEventListener('click', updateAutocomplete);
els.input.addEventListener('blur', () => setTimeout(closeAutocomplete, 150));
els.composer.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

// ---------- digitando ----------
function setTyping(ch, id) {
  const key = ch + ':' + id;
  clearTimeout(state.typing.get(key));
  state.typing.set(key, setTimeout(() => clearTyping(key), 4500));
  renderTyping();
}
function clearTyping(key) {
  if (!state.typing.has(key)) return;
  clearTimeout(state.typing.get(key));
  state.typing.delete(key);
  renderTyping();
}
function renderTyping() {
  const names = [...state.typing.keys()].filter((k) => k.startsWith(state.current + ':'))
    .map((k) => state.users.get(k.split(':')[1])).filter(Boolean).map((u) => `<b>${esc(u.name)}</b>`);
  if (!names.length) { els.typing.innerHTML = ''; return; }
  let text;
  if (names.length === 1) text = `${names[0]} está digitando…`;
  else if (names.length <= 3) text = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} estão digitando…`;
  else text = 'Várias pessoas estão digitando…';
  els.typing.innerHTML = `<span class="dots"><i></i><i></i><i></i></span><span>${text}</span>`;
}

// ---------- imagens ----------
const MAX_FILE = 100 * 1024 * 1024;
const MAX_FILES = 10;
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const VID_EXT = /\.(mp4|webm|m4v|ogv|mov)$/i;
const AUD_EXT = /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac)$/i;
const kindOfName = (n) => (IMG_EXT.test(n) ? 'image' : VID_EXT.test(n) ? 'video' : AUD_EXT.test(n) ? 'audio' : 'file');
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10240 ? 1 : 0).replace('.', ',') + ' KB';
  if (b < 1024 ** 3) return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  return (b / 1024 ** 3).toFixed(2).replace('.', ',') + ' GB';
}
const FILE_ICON = lu('file');
const AUDIO_ICON = lu('file-music');

// envia um arquivo e avisa o progresso (0..1)
function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/upload');
    x.setRequestHeader('X-Token', state.token);
    x.setRequestHeader('X-Filename', encodeURIComponent(file.name || 'arquivo'));
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    if (onProgress) x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => {
      let r = {};
      try { r = JSON.parse(x.responseText); } catch { /* sem json */ }
      if (x.status === 200) resolve(r); else reject(new Error(r.erro || 'erro ' + x.status));
    };
    x.onerror = () => reject(new Error('falha de rede'));
    x.send(file);
  });
}

// ---------- anexos pendentes (prévia antes de enviar) ----------
const pending = []; // { id, file, kind, preview, progress, el }
let sending = false;

function addFiles(files) {
  for (const f of files) {
    if (!f || !f.size) continue;
    if (pending.length >= MAX_FILES) { toast(`Dá para anexar até ${MAX_FILES} arquivos por mensagem.`); break; }
    if (f.size > MAX_FILE) { toast(`"${f.name}" passa de 100 MB.`); continue; }
    let file = f;
    if (!file.name || file.name === 'image.png') {
      // imagem colada da área de transferência vem sem nome útil
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      file = new File([file], `colado-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`, { type: file.type });
    }
    const kind = kindOfName(file.name);
    pending.push({ id: randHex(6), file, kind, preview: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null, progress: 0 });
  }
  renderPending();
  els.input.focus();
}
function removePending(id) {
  const i = pending.findIndex((p) => p.id === id);
  if (i < 0 || sending) return;
  if (pending[i].preview) URL.revokeObjectURL(pending[i].preview);
  pending.splice(i, 1);
  renderPending();
}
function clearPending() {
  for (const p of pending) if (p.preview) URL.revokeObjectURL(p.preview);
  pending.length = 0;
  renderPending();
}
function renderPending() {
  const bar = els.attachBar;
  bar.hidden = !pending.length;
  els.composerBox.classList.toggle('with-attach', pending.length > 0);
  els.replyBar.classList.toggle('above-attach', pending.length > 0);
  bar.replaceChildren(...pending.map((p) => {
    let thumb;
    if (p.kind === 'image') thumb = h('img', { src: p.preview, alt: '' });
    else if (p.kind === 'video') { thumb = h('video', { src: p.preview, preload: 'metadata' }); thumb.muted = true; }
    else thumb = h('div', { class: 'att-icon', html: p.kind === 'audio' ? AUDIO_ICON : FILE_ICON });
    const tile = h('div', { class: 'att-tile' + (sending ? ' sending' : ''), title: p.file.name },
      h('div', { class: 'att-thumb' }, thumb, p.kind === 'video' ? h('span', { class: 'att-badge', text: '▶' }) : null),
      h('div', { class: 'att-name', text: p.file.name }),
      h('div', { class: 'att-size', text: fmtSize(p.file.size) }),
      h('button', { type: 'button', class: 'att-remove', title: 'Remover anexo', html: I.trash, onclick: () => removePending(p.id) }),
      h('div', { class: 'att-progress' }, h('i', { style: { width: Math.round(p.progress * 100) + '%' } })));
    p.el = tile;
    return tile;
  }));
}

async function sendWithAttachments(text) {
  sending = true;
  renderPending();
  const ch = state.current;
  const replyTo = state.replyTo || undefined;
  try {
    const attachments = [];
    for (const p of pending) {
      const r = await uploadFile(p.file, (v) => { p.progress = v; const bar = p.el && p.el.querySelector('.att-progress i'); if (bar) bar.style.width = Math.round(v * 100) + '%'; });
      attachments.push({ url: r.url, name: r.name });
    }
    send({ type: 'chat', ch, text, attachments, replyTo });
    sending = false;
    clearPending();
    els.input.value = '';
    autoGrow();
    setReply(null);
  } catch (e) {
    sending = false;
    for (const p of pending) p.progress = 0;
    renderPending();
    toast('Falha ao enviar: ' + e.message);
  }
}

els.attachBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => { const fs = [...els.fileInput.files]; els.fileInput.value = ''; addFiles(fs); });
els.input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
  if (files.length) { e.preventDefault(); addFiles(files); }
});
let dragDepth = 0;
els.main.addEventListener('dragenter', (e) => { if (![...e.dataTransfer.types].includes('Files')) return; dragDepth++; els.dropOverlay.hidden = false; });
els.main.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; els.dropOverlay.hidden = true; } });
els.main.addEventListener('dragover', (e) => e.preventDefault());
els.main.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; els.dropOverlay.hidden = true;
  addFiles([...e.dataTransfer.files]);
});

// =====================================================================
// seletor de emojis
// =====================================================================
let pickerClose = null;
function openEmojiPicker(anchor, onPick, onClose) {
  closeEmojiPicker();
  const recent = load('dl-recent-emojis', []);
  const pk = els.emojiPicker;
  const search = h('input', { placeholder: 'Procurar emoji (ex.: risada, coracao, fogo)' });
  const grid = h('div', { class: 'ep-grid' });
  const cats = h('div', { class: 'ep-cats' });
  const foot = h('div', { class: 'ep-foot' }, h('span', { class: 'big', text: '😀' }), h('span', { text: ':sorrindo:' }));
  const sections = [];
  if (recent.length) sections.push({ name: 'Usados recentemente', icon: 'clock', list: recent.map((c) => EMOJIS.find((e) => e.char === c) || { char: c, name: '' }) });
  const CAT_ICON = { Pessoas: 'smile', 'Corações': 'heart', Natureza: 'leaf', Comida: 'food', Atividades: 'ball', Viagens: 'car', Objetos: 'bulb', 'Símbolos': 'shapes' };
  for (const c of EMOJI_CATEGORIES) sections.push({ name: c.name, icon: CAT_ICON[c.name] || 'smile', list: EMOJIS.filter((e) => e.cat === c.name) });

  const renderGrid = (q) => {
    grid.innerHTML = '';
    const query = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (query) {
      const res = EMOJIS.filter((e) => e.name.includes(query.replace(/\s+/g, '_')) || e.keywords.split(' ').some((k) => k.startsWith(query)));
      if (!res.length) { grid.append(h('div', { class: 'ep-empty', text: 'Nenhum emoji encontrado.' })); return; }
      grid.append(h('div', { class: 'ep-list' }, ...res.map((e) => h('button', { 'data-c': e.char, 'data-n': e.name, text: e.char }))));
      return;
    }
    for (const s of sections) {
      grid.append(h('div', { class: 'ep-section', 'data-sec': s.name, text: s.name }),
        h('div', { class: 'ep-list' }, ...s.list.map((e) => h('button', { 'data-c': e.char, 'data-n': e.name, text: e.char }))));
    }
  };
  for (const s of sections) {
    cats.append(h('button', { title: s.name, html: I[s.icon], onclick: () => {
      search.value = ''; renderGrid('');
      const sec = $(`[data-sec="${CSS.escape(s.name)}"]`, grid);
      if (sec) grid.scrollTop = sec.offsetTop - 4;
    } }));
  }
  renderGrid('');
  search.addEventListener('input', () => renderGrid(search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = $('.ep-list button', grid); if (first) first.click(); }
    if (e.key === 'Escape') closeEmojiPicker();
  });
  grid.addEventListener('mouseover', (e) => {
    const b = e.target.closest('button[data-c]');
    if (b) { foot.children[0].textContent = b.dataset.c; foot.children[1].textContent = b.dataset.n ? `:${b.dataset.n}:` : ''; }
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    const list = [b.dataset.c, ...load('dl-recent-emojis', []).filter((x) => x !== b.dataset.c)].slice(0, 24);
    store('dl-recent-emojis', list);
    onPick(b.dataset.c);
    if (!e.shiftKey) closeEmojiPicker();
  });
  pk.replaceChildren(h('div', { class: 'ep-search' }, search), h('div', { class: 'ep-body' }, cats, grid), foot);
  pk.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = pk.offsetWidth, hh = pk.offsetHeight;
  let left = r.right - w;
  let top = r.top - hh - 8;
  if (top < 8) top = Math.min(r.bottom + 8, innerHeight - hh - 8);
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  pk.style.left = left + 'px';
  pk.style.top = top + 'px';
  anchor.classList.add('open');
  pickerClose = () => { anchor.classList.remove('open'); if (onClose) onClose(); };
  setTimeout(() => search.focus(), 0);
}
function closeEmojiPicker() {
  if (els.emojiPicker.hidden) return;
  els.emojiPicker.hidden = true;
  if (pickerClose) { const f = pickerClose; pickerClose = null; f(); }
}
els.emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!els.emojiPicker.hidden) return closeEmojiPicker();
  openEmojiPicker(els.emojiBtn, (emoji) => {
    const v = els.input.value;
    const s = els.input.selectionStart ?? v.length;
    const en = els.input.selectionEnd ?? v.length;
    els.input.value = v.slice(0, s) + emoji + v.slice(en);
    els.input.setSelectionRange(s + emoji.length, s + emoji.length);
    autoGrow();
    els.input.focus();
  });
});

// =====================================================================
// membros, perfil, menus
// =====================================================================
function renderMe() {
  if (!state.me) return;
  const av = avatar(state.me, { presence: statusOf(state.me.id) });
  av.id = 'meAvatar';
  els.meAvatar.replaceWith(av);
  els.meAvatar = av;
  els.meName.textContent = state.me.name;
  renderRailMe();
}

function renderMembers() {
  if (!state.me) return;
  const g = curGuild();
  if (state.guild === '@me') return renderHomeSide();
  if (!g) { els.members.replaceChildren(); return; }
  const ids = Object.keys(g.members);
  const people = ids.map((id) => ({ id, ...(state.users.get(id) || state.profiles.get(id) || { name: '?' }), online: isOnline(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const hoisted = g.roles.filter((r) => r.hoist && r.id !== g.id).sort((a, b) => b.pos - a.pos);
  const groups = new Map(hoisted.map((r) => [r.id, []]));
  const online = [];
  const offline = [];
  for (const u of people) {
    if (!u.online) { offline.push(u); continue; }
    const top = rolesOf(g, u.id).find((r) => r.hoist);
    (top ? groups.get(top.id) : online).push(u);
  }
  const row = (u) => {
    const r = h('div', { class: 'member' + (u.online ? '' : ' offline'), 'data-uid': u.id });
    r.append(avatar(u, { presence: statusOf(u.id) }));
    const ch = u.voice && chan(u.voice);
    const st = statusOf(u.id);
    const sub = !u.online ? '' : u.activity ? h('span', { class: 'with-ico' }, ico(ACT_ICON[u.activity.kind] || 'game'), actText(u.activity)) : u.sharing ? 'Compartilhando a tela' : u.camera ? 'Com a câmera ligada' : ch ? inVoiceLabel(ch.name) : st === 'ocupado' ? 'Não perturbe' : st === 'ausente' ? 'Ausente' : '';
    r.append(h('div', { style: { minWidth: '0' } },
      h('div', { class: 'm-name', style: { color: u.online ? nameColor(u.id, u.color, g) : '' } },
        u.name, g.ownerId === u.id ? h('span', { class: 'crown', title: 'Dono do servidor', html: I.crown }) : null,
        u.id === state.me.id ? h('span', { class: 'm-sub', text: ' (você)' }) : null),
      sub ? h('div', { class: 'm-sub' + (u.activity ? ' m-activity' : '') }, sub) : null));
    return r;
  };
  const out = [h('div', { class: 'members-head' }, h('span', { text: 'Membros' }),
    h('button', { class: 'icon-btn small', title: 'Esconder a lista de membros', html: lu('panel-right-close'), onclick: () => setMembersShown(false) }))];
  for (const r of hoisted) {
    const list = groups.get(r.id);
    if (list.length) out.push(h('div', { class: 'members-title role', text: `${r.name} — ${list.length}` }), ...list.map(row));
  }
  if (online.length) out.push(h('div', { class: 'members-title', text: `Online — ${online.length}` }), ...online.map(row));
  if (offline.length) out.push(h('div', { class: 'members-title', text: `Offline — ${offline.length}` }), ...offline.slice(0, 100).map(row));
  els.members.replaceChildren(...out);
}
els.members.addEventListener('click', (e) => { const r = e.target.closest('.member'); if (r) showProfile(r.dataset.uid, r); });
els.members.addEventListener('contextmenu', (e) => { const r = e.target.closest('.member'); if (r) { e.preventDefault(); memberMenu(r.dataset.uid, e.clientX, e.clientY); } });
els.meBox.addEventListener('click', () => statusMenu(els.meBox));
function statusMenu(anchor) {
  const cur = (state.me && state.me.status) || 'online';
  const dot = (st) => `<span class="status-dot st-${st}"></span>`;
  const r = anchor.getBoundingClientRect();
  showContextMenu(r.left, r.top - 8, [
    ...['online', 'ausente', 'ocupado', 'invisivel'].map((st) => ({ label: STATUS_INFO[st].label, desc: STATUS_INFO[st].desc, icon: dot(st), checked: cur === st, fn: () => setMyStatus(st) })),
    { sep: true },
    { label: 'Ver meu perfil', icon: lu('user'), fn: () => showProfile(state.me.id, els.meBox) },
  ]);
  const m = els.ctxMenu; // abre para cima
  m.style.top = Math.max(8, r.top - m.offsetHeight - 6) + 'px';
}
function setMyStatus(st) {
  send({ type: 'status', status: st });
  if (st === 'ocupado') toast('Não perturbe: popups, sons e notificações desligados.');
}
// ausente automático: 10 minutos sem mexer no PC (no app usa o tempo parado do Windows)
let lastInput = Date.now();
for (const ev of ['mousemove', 'keydown', 'mousedown', 'wheel', 'touchstart']) addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true });
setInterval(async () => {
  if (!state.connected || !state.me) return;
  let idle = (Date.now() - lastInput) / 1000;
  if (desk && desk.idle) { try { idle = await desk.idle(); } catch { /* usa o do navegador */ } }
  const afk = idle >= 600 && !(voice.active && state.voiceCh && !state.muted);
  if (afk !== !!state.me.afk) send({ type: 'afk', afk });
}, 30000);

// lateral direita na tela inicial: perfil de quem está na conversa, ou amigos ativos
function renderHomeSide() {
  const c = chan(state.current);
  const head = h('div', { class: 'members-head' }, h('span', { text: c && c.type === 'dm' ? 'Perfil' : 'Ativos agora' }),
    h('button', { class: 'icon-btn small', title: 'Esconder', html: lu('panel-right-close'), onclick: () => setMembersShown(false) }));
  if (c && c.type === 'dm') {
    const uid = dmOther(c);
    const p = profileOf(uid);
    const u = state.users.get(uid);
    const mutual = [...state.guilds.values()].filter((g) => g.members[uid]);
    const r = relOf(uid);
    els.members.replaceChildren(head, h('div', { class: 'dm-profile' },
      h('div', { class: 'pc-banner', style: { background: p.color } }), avatar(p, { cls: 'pc-avatar', presence: statusOf(uid) }),
      h('div', { class: 'pc-body' }, h('div', { class: 'pc-name', text: p.name }), u && u.username ? h('div', { class: 'pc-sub', text: '@' + u.username }) : null,
        h('div', { class: 'pc-sub' }, statusOf(uid) === 'offline' ? 'Offline' : u.voice ? inVoiceLabel(chan(u.voice) && chan(u.voice).name) : STATUS_INFO[statusOf(uid)].label),
        u && u.activity ? h('div', { class: 'pc-section' }, h('div', { class: 'pc-label', text: u.activity.kind === 'status' ? 'Status' : (ACT_VERB[u.activity.kind] || 'Jogando').toUpperCase() }), h('div', { class: 'pc-activity' }, h('span', { class: 'pc-act-icon', html: I[ACT_ICON[u.activity.kind] || 'game'] }), h('b', { text: u.activity.name }))) : null,
        mutual.length ? h('div', { class: 'pc-section' }, h('div', { class: 'pc-label', text: `Servidores em comum — ${mutual.length}` }), ...mutual.map((g) => h('div', { class: 'mutual-row', onclick: () => selectGuild(g.id) }, guildIcon(g, 'mutual-icon'), h('span', { text: g.name })))) : null,
        friendButton(uid, r))));
    return;
  }
  const active = state.relations.friends.filter((u) => isOnline(u));
  els.members.replaceChildren(head, ...(active.length ? active.map((uid) => {
    const u = state.users.get(uid);
    return h('div', { class: 'member', 'data-uid': uid }, avatar(u, { presence: true }),
      h('div', { style: { minWidth: '0' } }, h('div', { class: 'm-name', text: u.name }), h('div', { class: 'm-sub' }, u.activity ? actText(u.activity) : u.voice && chan(u.voice) ? inVoiceLabel(chan(u.voice).name) : 'Online')));
  }) : [h('div', { class: 'fr-empty small', text: 'Quando alguém estiver online, aparece aqui.' })]));
}
function friendButton() {
  return null; // modo simples: todos já são amigos
}
function friendButtonOld(uid, r = relOf(uid)) {
  if (uid === state.me.id) return null;
  if (r === 'friend') return h('button', { class: 'secondary pc-btn', text: 'Amigos', disabled: true });
  if (r === 'outgoing') return h('button', { class: 'secondary pc-btn', text: 'Pedido enviado', onclick: () => friendAction(uid, 'friend-cancel'), title: 'Clique para cancelar' });
  if (r === 'incoming') return h('button', { class: 'primary pc-btn', text: 'Aceitar amizade', onclick: () => friendAction(uid, 'friend-accept') });
  return h('button', { class: 'primary pc-btn', text: 'Adicionar amigo', onclick: () => sendFriendRequest('uid:' + uid) });
}

function placeFloating(el, anchor, prefer = 'right') {
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, hh = el.offsetHeight;
  let left = prefer === 'left' ? r.left - w - 8 : r.right + 8;
  if (left + w > innerWidth - 8) left = r.left - w - 8;
  if (left < 8) left = Math.min(r.left, innerWidth - w - 8);
  let top = Math.min(r.top, innerHeight - hh - 8);
  el.style.left = Math.max(8, left) + 'px';
  el.style.top = Math.max(8, top) + 'px';
}

function showProfile(uid, anchor) {
  const u = state.users.get(uid);
  const p = profileOf(uid);
  const g = curGuild();
  const online = !!u;
  const ch = u && u.voice && chan(u.voice);
  const body = h('div', { class: 'pc-body' },
    h('div', { class: 'pc-name' }, p.name, g && g.ownerId === uid ? h('span', { class: 'crown', title: 'Dono do servidor', html: I.crown }) : null),
    u && u.username ? h('div', { class: 'pc-sub', text: '@' + u.username }) : null,
    h('div', { class: 'pc-sub' }, online ? (ch ? inVoiceLabel(ch.name) : 'Online') : 'Offline'));
  if (u && u.activity) {
    body.append(h('div', { class: 'pc-section' }, h('div', { class: 'pc-label', text: u.activity.kind === 'status' ? 'Status' : (ACT_VERB[u.activity.kind] || 'Jogando').toUpperCase() }),
      h('div', { class: 'pc-activity' }, h('span', { class: 'pc-act-icon', html: I[ACT_ICON[u.activity.kind] || 'game'] }),
        h('div', {}, h('b', { text: u.activity.name }), u.activity.kind !== 'status' ? h('div', { class: 'pc-sub', text: fmtAgo(u.activity.since) }) : null))));
  }
  const roles = rolesOf(g, uid);
  if (g && g.members[uid]) {
    const chips = h('div', { class: 'role-chips' }, ...roles.map((r) => h('span', { class: 'role-chip' }, h('i', { style: { background: r.color || '#99aab5' } }), r.name)));
    if (canIn(g, 'gerenciar_cargos') && (uid === state.me.id || outranks(g, state.me.id, uid) || g.ownerId === state.me.id)) {
      chips.append(h('button', { class: 'role-chip add', title: 'Mudar cargos', text: '+', onclick: () => { hidePopover(); memberRolesModal(g, uid); } }));
    }
    if (roles.length || chips.children.length) body.append(h('div', { class: 'pc-section' }, h('div', { class: 'pc-label', text: 'Cargos' }), chips));
  }
  if (u && uid !== state.me.id && voice.active && u.voice === state.voiceCh) {
    body.append(h('div', { class: 'pc-vol' }, h('label', { text: 'Volume do usuário' }), volumeControl(uid, 'voice')));
    if (u.sharing) body.append(h('div', { class: 'pc-vol' }, h('label', { text: 'Volume da transmissão' }), volumeControl(uid, 'screen')));
  }
  if (uid === state.me.id) body.append(h('button', { class: 'primary pc-btn', text: 'Editar perfil', onclick: () => { hidePopover(); openSettings('perfil'); } }));
  else body.append(h('div', { class: 'pc-btns' },
    h('button', { class: 'primary pc-btn', text: 'Mensagem', onclick: () => { hidePopover(); openDM(uid); } }),
    (() => { const b = friendButton(uid); if (b) { b.classList.remove('primary'); b.classList.add('secondary'); const f = b.onclick; if (f) b.onclick = () => { hidePopover(); f(); }; } return b; })()),
    h('div', { class: 'pc-btns' },
    h('button', { class: 'secondary pc-btn', text: 'Mencionar', onclick: () => { hidePopover(); insertMention(p.name); } }),
    memberActions(g, uid).length ? h('button', { class: 'secondary pc-btn', text: 'Mais…', onclick: (e) => { const r = e.target.getBoundingClientRect(); memberMenu(uid, r.left, r.bottom + 4); } }) : null));
  const card = els.popover;
  card.className = 'popover profile-card';
  card.replaceChildren(h('div', { class: 'pc-banner', style: { background: p.color } }), avatar(p, { cls: 'pc-avatar' }), body);
  card.hidden = false;
  placeFloating(card, anchor, anchor.closest('.members') ? 'left' : 'right');
}
function hidePopover() { els.popover.hidden = true; }

// ações de moderação que eu posso fazer com essa pessoa
// ---------- silenciar ----------
// mod: silenciado/ensurdecido por um moderador (vale para todos); local: silenciado só para mim
const modOf = (uid, g = voiceGuild()) => (g && g.members[uid]) || {};
function voiceGuild() { const c = chan(state.voiceCh) || chan(state.current); return c && c.guild ? state.guilds.get(c.guild) : curGuild(); }
const isLocalMuted = (uid) => !!(settings.localMutes || {})[uid];
function setLocalMute(uid, on) {
  const lm = { ...(settings.localMutes || {}) };
  if (on) lm[uid] = true; else delete lm[uid];
  settings.localMutes = lm;
  saveSettings();
  syncSilenced();
  renderChannels(); renderStage(); renderMembers();
  toast(on ? `${profileOf(uid).name} foi silenciado só para você.` : `Você voltou a ouvir ${profileOf(uid).name}.`);
}
function syncSilenced() {
  const c = chan(state.voiceCh);
  const g = c && state.guilds.get(c.guild);
  const out = Object.keys(settings.localMutes || {});
  if (g) for (const [uid, mem] of Object.entries(g.members)) if (mem.smute || mem.sdeaf) out.push(uid);
  voice.setSilenced(out);
}
// ícones de microfone/fone de alguém (sala de voz e quadro da chamada)
function voiceIcons(u, g) {
  const mod = (g && g.members[u.id]) || {};
  let out = '';
  if (mod.smute || mod.sdeaf) out += lu('mic-off', 'muted-ic srv-ic');
  else if (u.muted || u.deafened) out += I.micOff;
  if (mod.sdeaf) out += lu('headphone-off', 'muted-ic srv-ic');
  else if (u.deafened) out += I.deafOff;
  if (u.id !== state.me.id && isLocalMuted(u.id)) out += lu('volume-x', 'local-ic');
  return out;
}
// aplica em mim o silêncio dado por um moderador
function applyVoiceMod() {
  const c = chan(state.voiceCh);
  const g = c && state.guilds.get(c.guild);
  const mod = (g && g.members[state.me.id]) || {};
  const want = { mute: !!(mod.smute || mod.sdeaf), deaf: !!mod.sdeaf };
  const had = state.modApplied || { mute: false, deaf: false };
  if (want.mute === had.mute && want.deaf === had.deaf) return;
  state.modApplied = want;
  if (want.mute && !had.mute) { state.mutedBeforeMod = state.muted; state.muted = true; }
  if (!want.mute && had.mute) state.muted = !!state.mutedBeforeMod;
  if (want.deaf && !had.deaf) { state.deafBeforeMod = state.deafened; state.deafened = true; }
  if (!want.deaf && had.deaf) state.deafened = !!state.deafBeforeMod;
  if (voice.active) applyAudioPrefs();
}

function memberActions(g, uid) {
  if (!g || !g.members[uid] || uid === state.me.id) return [];
  const P = permsIn(g);
  const above = outranks(g, state.me.id, uid);
  const u = state.users.get(uid);
  const name = profileOf(uid).name;
  const out = [];
  if (P.has('gerenciar_cargos') && (above || g.ownerId === state.me.id)) out.push({ label: 'Mudar cargos', fn: () => memberRolesModal(g, uid) });
  if (P.has('desconectar_membros') && above && u && u.voice && chan(u.voice) && chan(u.voice).guild === g.id) {
    for (const vc of guildChannels(g.id).filter((x) => x.type === 'voice' && x.id !== u.voice)) out.push({ label: `Mover para ${vc.name}`, fn: () => send({ type: 'member-move', gid: g.id, uid, ch: vc.id }) });
    out.push({ label: 'Desconectar da chamada', fn: () => send({ type: 'member-disconnect', gid: g.id, uid }) });
  }
  if (P.has('silenciar_membros') && above) {
    const mem = g.members[uid];
    out.push({ label: mem.smute ? 'Remover silêncio da chamada' : 'Silenciar na chamada (para todos)', fn: () => send({ type: 'member-voice-mod', gid: g.id, uid, mute: !mem.smute }) });
    out.push({ label: mem.sdeaf ? 'Remover ensurdecimento' : 'Ensurdecer na chamada (para todos)', fn: () => send({ type: 'member-voice-mod', gid: g.id, uid, deaf: !mem.sdeaf }) });
  }
  if (P.has('expulsar') && above) out.push({ label: `Expulsar ${name}`, danger: true, fn: () => confirmModeration(g, uid, 'kick') });
  if (P.has('banir') && above) out.push({ label: `Banir ${name}`, danger: true, fn: () => confirmModeration(g, uid, 'ban') });
  if (g.ownerId === state.me.id) out.push({ label: 'Transferir posse do servidor', danger: true, fn: () => modal({
    title: 'Transferir posse', desc: `${name} vira dono de "${g.name}" e você perde os poderes de dono. Isso não pode ser desfeito por você.`,
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Transferir', cls: 'danger-btn', fn: () => send({ type: 'guild-transfer', gid: g.id, uid }) }],
  }) });
  return out;
}
function memberMenu(uid, x, y) {
  const g = curGuild();
  const items = [{ label: 'Ver perfil', fn: () => { const el = document.querySelector(`.member[data-uid="${CSS.escape(uid)}"]`) || els.members; showProfile(uid, el); } }];
  if (uid !== state.me.id) {
    items.push({ label: 'Enviar mensagem', fn: () => openDM(uid) });
    if (state.guild !== '@me') items.push({ label: 'Mencionar', fn: () => insertMention(profileOf(uid).name) });
    items.push(isLocalMuted(uid) ? { label: 'Voltar a ouvir (só para mim)', fn: () => setLocalMute(uid, false) } : { label: 'Silenciar para mim', fn: () => setLocalMute(uid, true) });
  }
  items.push(...memberActions(g, uid));
  showContextMenu(x, y, items);
}
function confirmModeration(g, uid, kind) {
  const name = profileOf(uid).name;
  modal({
    title: kind === 'ban' ? `Banir ${name}` : `Expulsar ${name}`,
    desc: kind === 'ban' ? `${name} sai de "${g.name}" e não poderá voltar, nem com convite (até alguém desbanir).` : `${name} sai de "${g.name}", mas pode voltar com um convite.`,
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: kind === 'ban' ? 'Banir' : 'Expulsar', cls: 'danger-btn', fn: () => send({ type: kind === 'ban' ? 'member-ban' : 'member-kick', gid: g.id, uid }) }],
  });
}
function memberRolesModal(g, uid) {
  const top = topPos(g, state.me.id);
  const mine = new Set(g.members[uid].roles);
  const list = g.roles.filter((r) => r.id !== g.id).sort((a, b) => b.pos - a.pos);
  if (!list.length) return toast('Este servidor ainda não tem cargos. Crie em Configurações do servidor → Cargos.');
  const boxes = list.map((r) => {
    const cb = h('input', { type: 'checkbox', checked: mine.has(r.id), disabled: r.pos >= top });
    cb.dataset.id = r.id;
    const count = Object.values(g.members).filter((mm) => mm.roles.includes(r.id)).length;
    return h('label', { class: 'check-row role-check' + (r.pos >= top ? ' disabled' : '') }, cb, h('i', { class: 'role-dot', style: { background: r.color || '#99aab5' } }),
      h('span', { class: 'rc-name', text: r.name, style: { color: r.color || '' } }),
      h('small', { text: r.pos >= top ? 'acima do seu cargo' : `${count} ${count === 1 ? 'pessoa' : 'pessoas'}` }));
  });
  const who = profileOf(uid);
  modal({
    title: 'Mudar cargos', cardClass: 'roles-card',
    body: [h('div', { class: 'rc-who' }, avatar(who), h('div', {}, h('div', { class: 'sr-title', text: who.name }), h('div', { class: 'sr-desc', text: 'Marque os cargos que essa pessoa deve ter.' }))),
      h('div', { class: 'role-check-list' }, ...boxes)],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Salvar', cls: 'primary', fn: () => {
      const roles = boxes.map((b) => $('input', b)).filter((cb) => cb.checked).map((cb) => cb.dataset.id);
      send({ type: 'member-roles', gid: g.id, uid, roles });
    } }],
  });
}

function showContextMenu(x, y, items) {
  const m = els.ctxMenu;
  m.replaceChildren(...items.map((it) => it.sep ? h('div', { class: 'ctx-sep' }) : h('button', { class: (it.danger ? 'danger' : '') + (it.icon ? ' with-icon' : '') + (it.checked ? ' checked' : ''), onclick: () => { m.hidden = true; it.fn(); } },
    it.icon ? h('span', { class: 'ctx-ico', html: it.icon }) : null, h('span', { class: 'ctx-label' }, h('span', { text: it.label }), it.desc ? h('small', { text: it.desc }) : null))));
  m.hidden = false;
  m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + 'px';
}

document.addEventListener('mousedown', (e) => {
  if (!els.popover.hidden && !els.popover.contains(e.target) && !e.target.closest('[data-uid], .me-box')) hidePopover();
  if (!els.ctxMenu.hidden && !els.ctxMenu.contains(e.target)) els.ctxMenu.hidden = true;
  if (!els.emojiPicker.hidden && !els.emojiPicker.contains(e.target) && !e.target.closest('.emoji-btn, [data-act="react"]')) closeEmojiPicker();
});
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); return; }
  if (e.key !== 'Escape') return;
  if (!els.emojiPicker.hidden) return closeEmojiPicker();
  if (!els.popover.hidden) return hidePopover();
  if (!els.ctxMenu.hidden) { els.ctxMenu.hidden = true; return; }
  if (!els.lightbox.hidden) { els.lightbox.hidden = true; return; }
  if (state.editing) return cancelEdit();
  if (state.replyTo) return setReply(null);
  if (state.focusedTile && !document.fullscreenElement) setFocus(null);
});

// =====================================================================
// atalhos do teclado
// =====================================================================
const SHORTCUTS = [
  ['Ctrl+K', 'Ir rápido para uma sala, conversa ou servidor'],
  ['Alt+↑ ou Alt+↓', 'Sala anterior / próxima'],
  ['Alt+Shift+↑ ou Alt+Shift+↓', 'Sala não lida anterior / próxima'],
  ['Ctrl+Alt+↑ ou Ctrl+Alt+↓', 'Servidor anterior / próximo'],
  ['Ctrl+Shift+M', 'Silenciar / ativar microfone'],
  ['Ctrl+Shift+D', 'Silenciar / ativar fone'],
  ['Ctrl+F', 'Buscar'],
  ['Ctrl+B', 'Esconder / mostrar a barra de salas'],
  ['Ctrl+Shift+U', 'Enviar arquivo'],
  ['Ctrl+E', 'Abrir emojis'],
  ['Esc', 'Marcar a sala como lida / fechar'],
  ['Shift+Esc', 'Marcar o servidor inteiro como lido'],
  ['↑', 'Editar sua última mensagem (com a caixa vazia)'],
  ['PageUp ou PageDown', 'Rolar as mensagens'],
  ['Ctrl+/', 'Ver esta lista'],
];
// tecla que, sozinha, serve para digitar (letra, número, símbolo, espaço)
const typingKey = (acc) => !!acc && !acc.includes('+') && !/^(F\d+|num\d|Pause|Insert|Home|End|PageUp|PageDown|Delete|Up|Down|Left|Right)$/.test(acc);
function accelFromEvent(e, allowSingle) {
  const map = { Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Pause: 'Pause' };
  let key = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^Numpad\d$/.test(e.code)) key = 'num' + e.code.slice(6);
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
  else if (map[e.code]) key = map[e.code];
  if (!key) return null;
  const mods = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
  if (!mods.length && !allowSingle && typingKey(key)) return null; // ao comparar: letra sozinha só conta fora da digitação (ver abaixo)
  return [...mods, key].join('+');
}
const accelMatches = (acc, e) => {
  if (!acc) return false;
  if (typingKey(acc) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return false; // digitando: a letra é letra
  return accelFromEvent(e, true) === acc;
};
let globalKeysOn = false;
let globalKeysSig = '';
async function applyGlobalKeys() {
  if (!desk || !desk.setGlobalKeys) return;
  const want = !!(voice.active && state.voiceCh);
  const sig = want ? JSON.stringify(settings.globalKeys) : '';
  if (sig === globalKeysSig) return;
  globalKeysSig = sig;
  const res = await desk.setGlobalKeys(want ? settings.globalKeys : {});
  globalKeysOn = !!want && Object.values(res || {}).some(Boolean);
  if (want) for (const [k, ok] of Object.entries(res || {})) if (!ok && settings.globalKeys[k]) toast(`Não deu para usar ${settings.globalKeys[k].replace('CommandOrControl', 'Ctrl')} como atalho global: outro programa já usa. Troque em Configurações → Atalhos.`, 7000);
}
if (desk && desk.onOverlayPosSaved) desk.onOverlayPosSaved(() => {
  settings.overlay = { ...(settings.overlay || {}), pos: 'custom' };
  saveSettings(); overlaySig = ''; updateOverlay();
  const sel = document.querySelector('.ov-pos-row select');
  if (sel) sel.value = 'custom';
  toast('Posição da sobreposição salva.');
});
if (desk && desk.onGlobalKey) desk.onGlobalKey((name) => {
  if (name === 'mute') els.muteBtn.click();
  if (name === 'deafen') els.deafenBtn.click();
  if (name === 'overlay' && desk.overlayToggle) desk.overlayToggle();
});

// ---------- sobreposição no jogo (só no app) ----------
let overlaySig = '';
function updateOverlay() {
  if (!desk || !desk.overlay) return;
  const o = { enabled: true, pos: 'top-left', showMsgs: true, scale: 1, ...(settings.overlay || {}) };
  const c = voice.active && state.voiceCh ? chan(state.voiceCh) : null;
  let st = null;
  if (o.enabled && c) {
    const g = c.guild ? state.guilds.get(c.guild) : null;
    const members = [...state.users.values()].filter((u) => u.voice === c.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((u) => {
      const mod = (g && g.members[u.id]) || {};
      return { id: u.id, name: u.name, avatar: u.avatar ? new URL(u.avatar, location.href).href : null, color: u.color,
        speaking: !!(u.speaking && !u.muted && !u.deafened), muted: !!(u.muted || u.deafened), deafened: !!u.deafened, smuted: !!(mod.smute || mod.sdeaf), sdeaf: !!mod.sdeaf, live: !!u.sharing, camera: !!u.camera };
    });
    st = { title: c.type === 'dm' ? 'Ligação com ' + dmName(c) : c.name, pos: o.pos, showMsgs: o.showMsgs, scale: o.scale, opacity: o.opacity ?? 1, members };
  }
  const sig = JSON.stringify(st);
  if (sig === overlaySig) return;
  overlaySig = sig;
  desk.overlay(st);
}
function overlayMessage(m, where) {
  if (!desk || !desk.overlayMessage || !settings.overlay || !settings.overlay.enabled || !settings.overlay.showMsgs) return;
  if (!(voice.active && state.voiceCh) || isMine(m)) return;
  if (!where && state.voiceCh !== m.ch) return;
  const p = profileOf(m.uid, m);
  const att = (m.attachments || [])[0];
  desk.overlayMessage({ name: p.name, where: where || null, color: p.color, avatar: p.avatar ? new URL(p.avatar, location.href).href : null, nameColor: nameColor(m.uid, '', guildOf(m.ch)) || '#fff',
    text: (m.text || (att ? 'Enviou ' + att.name : '')).slice(0, 300) });
}

function navTargets() {
  // ordem das salas como aparecem na barra (texto, tópicos visíveis, voz) ou das conversas privadas
  if (state.guild === '@me') return ['@friends', ...visibleDMs().map((c) => c.id)];
  return [...els.channels.querySelectorAll('.channel[data-id]')].map((r) => r.dataset.id).filter((id) => chan(id));
}
function moveChannel(dir, unreadOnly) {
  const list = navTargets();
  if (!list.length) return;
  let i = list.indexOf(state.current);
  for (let n = 0; n < list.length; n++) {
    i = (i + dir + list.length) % list.length;
    const c = chan(list[i]);
    if (!unreadOnly || (c && isUnread(c))) { if (c && c.type === 'voice') openChannel(c.id); else openChannel(list[i]); return; }
  }
  if (unreadOnly) toast('Nenhuma sala não lida aqui.');
}
function moveGuild(dir) {
  const list = ['@me', ...state.guilds.keys()];
  const i = list.indexOf(state.guild);
  selectGuild(list[(i + dir + list.length) % list.length]);
}
function quickSwitcher() {
  const input = h('input', { type: 'text', class: 'text-input qs-input', placeholder: 'Para onde você quer ir?' });
  const list = h('div', { class: 'qs-list' });
  const all = [
    ...state.channels.filter((c) => c.type !== 'dm' && state.guilds.has(c.guild)).map((c) => ({ id: c.id, kind: c.type, name: c.name, sub: state.guilds.get(c.guild).name, unread: isUnread(c) })),
    ...state.channels.filter((c) => c.type === 'dm').map((c) => ({ id: c.id, kind: 'dm', name: dmName(c), sub: 'Mensagem privada', unread: isUnread(c) })),
    ...[...state.guilds.values()].map((g) => ({ id: 'g:' + g.id, kind: 'guild', name: g.name, sub: 'Servidor' })),
    ...state.relations.friends.filter((u) => !state.channels.some((c) => c.type === 'dm' && c.members.includes(u))).map((u) => ({ id: 'u:' + u, kind: 'user', name: profileOf(u).name, sub: 'Começar conversa' })),
  ];
  let sel = 0;
  let shown = [];
  const icon = { text: I.hash, voice: I.speaker, thread: lu('messages-square'), dm: lu('at-sign'), guild: lu('house'), user: lu('user') };
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const go = (it) => {
    m.close();
    if (it.kind === 'guild') selectGuild(it.id.slice(2));
    else if (it.kind === 'user') openDM(it.id.slice(2));
    else openChannel(it.id);
  };
  const draw = () => {
    const q = norm(input.value.trim().replace(/^[#@*]/, ''));
    shown = all.filter((it) => !q || norm(it.name).includes(q)).sort((a, b) => (q ? norm(a.name).indexOf(q) - norm(b.name).indexOf(q) : 0) || (b.unread ? 1 : 0) - (a.unread ? 1 : 0)).slice(0, 12);
    if (!q) shown = shown.filter((it) => it.unread || it.kind === 'dm').concat(shown.filter((it) => !it.unread && it.kind !== 'dm')).slice(0, 12);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.replaceChildren(...(shown.length ? shown.map((it, i) => h('div', { class: 'qs-item' + (i === sel ? ' sel' : '') + (it.unread ? ' unread' : ''), onmousemove: () => { if (sel !== i) { sel = i; draw(); } }, onclick: () => go(it) },
      h('span', { class: 'qs-ico', html: icon[it.kind] || I.hash }), h('span', { class: 'qs-name', text: it.name }), h('span', { class: 'qs-sub', text: it.sub }))) : [h('div', { class: 'sp-empty small', text: 'Nada encontrado.' })]));
  };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    if (e.key === 'Enter' && shown[sel]) { e.preventDefault(); go(shown[sel]); }
  });
  const m = modal({ title: 'Ir para…', desc: 'Digite o nome de uma sala, conversa, pessoa ou servidor. Setas para escolher, Enter para ir.', body: [input, list], buttons: [], cardClass: 'qs-card' });
  draw();
  setTimeout(() => input.focus(), 20);
}
function shortcutsModal() {
  modal({ title: 'Atalhos do teclado', body: [h('div', { class: 'kb-list' }, ...SHORTCUTS.map(([keys, what]) => h('div', { class: 'kb-row' }, h('span', { text: what }),
    h('span', { class: 'kb-keys' }, ...keys.split(' ou ').flatMap((k, i) => [i ? h('span', { class: 'kb-or', text: 'ou' }) : null, ...k.split('+').map((x) => h('kbd', { text: x }))])))))],
    buttons: [{ label: 'Configurar atalhos', cls: 'link-btn', fn: () => openSettings('atalhos') }, { label: 'Fechar', cls: 'primary' }] });
}
document.addEventListener('keydown', (e) => {
  if (!state.me || document.querySelector('.settings-root')) return;
  const modalOpen = !!els.modalRoot.children.length;
  const k = e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && !e.shiftKey && !e.altKey && k.toLowerCase() === 'k') { e.preventDefault(); if (!modalOpen) quickSwitcher(); return; }
  if (ctrl && (k === '/' || e.code === 'Slash' || e.code === 'IntlRo')) { e.preventDefault(); if (!modalOpen) shortcutsModal(); return; }
  if (modalOpen) return;
  // mutar / ensurdecer (se o atalho global estiver ativo, ele já cuida disso)
  if (!globalKeysOn && accelMatches(settings.globalKeys.mute || 'CommandOrControl+Shift+M', e)) { e.preventDefault(); els.muteBtn.click(); return; }
  if (!globalKeysOn && accelMatches(settings.globalKeys.deafen || 'CommandOrControl+Shift+D', e)) { e.preventDefault(); els.deafenBtn.click(); return; }
  if (globalKeysOn && (accelMatches(settings.globalKeys.mute, e) || accelMatches(settings.globalKeys.deafen, e))) { e.preventDefault(); return; }
  if (e.altKey && !ctrl && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); moveChannel(k === 'ArrowUp' ? -1 : 1, e.shiftKey); return; }
  if (e.altKey && ctrl && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); moveGuild(k === 'ArrowUp' ? -1 : 1); return; }
  if (ctrl && e.shiftKey && k.toLowerCase() === 'u') { e.preventDefault(); if (!els.composer.hidden && can('enviar_arquivos')) els.fileInput.click(); return; }
  if (ctrl && !e.shiftKey && !e.altKey && k.toLowerCase() === 'e') { e.preventDefault(); if (!els.composer.hidden) els.emojiBtn.click(); return; }
  if ((k === 'PageUp' || k === 'PageDown') && document.activeElement === els.input) {
    e.preventDefault(); els.messages.scrollBy({ top: (k === 'PageUp' ? -1 : 1) * els.messages.clientHeight * 0.85, behavior: 'smooth' }); return;
  }
  if (k === 'Escape' && e.shiftKey) { const g = curGuild(); if (g) { guildChannels(g.id).forEach((c) => markRead(c.id, true)); renderChannels(); renderRail(); toast('Servidor marcado como lido.'); } return; }
  if (k === 'Escape' && !els.newBar.hidden && !state.editing && !state.replyTo && els.ctxMenu.hidden && els.popover.hidden && els.emojiPicker.hidden && !state.sidePanel) {
    state.unreadFrom[state.current] = null; els.newBar.hidden = true; const d = $('.new-divider', els.messages); if (d) d.remove(); markRead(state.current); return;
  }
  // começar a digitar em qualquer lugar escreve na caixa de mensagem
  if (!ctrl && !e.altKey && k.length === 1 && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable && !els.composer.hidden && !els.input.disabled) els.input.focus();
});

// ---------- esconder barras ----------
function applyLayout() {
  els.app.classList.toggle('hide-sidebar', !!settings.hideSidebar);
  els.app.classList.toggle('hide-members', !!settings.hideMembers);
  els.sidebarToggle.title = settings.hideSidebar ? 'Mostrar barra lateral (Ctrl+B)' : 'Esconder barra lateral (Ctrl+B)';
  els.sidebarToggle.classList.toggle('on', !!settings.hideSidebar);
  const inCall = els.app.classList.contains('in-call-view');
  if (inCall) els.app.classList.toggle('call-members', !!settings.callMembers && !settings.hideMembers);
  const shown = inCall ? !!settings.callMembers && !settings.hideMembers : !settings.hideMembers;
  els.membersToggle.classList.toggle('on', shown);
  els.membersToggle.title = shown ? 'Esconder a lista de membros' : 'Mostrar a lista de membros';
  renderRail();
  renderRailMe();
}
function toggleSidebar() { settings.hideSidebar = !settings.hideSidebar; saveSettings(); applyLayout(); }
els.sidebarToggle.addEventListener('click', toggleSidebar);
// mostra / esconde a lista de membros (na chamada ela tem a sua própria preferência)
function setMembersShown(show) {
  if (matchMedia('(max-width: 1000px)').matches) {
    if (show && settings.hideMembers) { settings.hideMembers = false; saveSettings(); applyLayout(); }
    els.members.classList.toggle('open', show);
    return;
  }
  if (els.app.classList.contains('in-call-view')) { // na chamada a lista fica escondida por padrão, para sobrar espaço
    settings.callMembers = show;
    if (show) settings.hideMembers = false;
    saveSettings(); applyLayout(); applyCallView(true); return;
  }
  settings.hideMembers = !show; saveSettings(); applyLayout();
}
els.membersToggle.addEventListener('click', () => {
  const shown = matchMedia('(max-width: 1000px)').matches ? els.members.classList.contains('open')
    : els.app.classList.contains('in-call-view') ? !!settings.callMembers && !settings.hideMembers : !settings.hideMembers;
  setMembersShown(!shown);
});
function renderRailMe() {
  if (!state.me) return;
  const micOff = state.muted || state.deafened;
  els.railMute.innerHTML = micOff ? I.micOff : lu('mic');
  els.railDeafen.innerHTML = state.deafened ? I.deafOff : lu('headphones');
  els.railAvatar.replaceChildren(avatar(state.me, { presence: statusOf(state.me.id) }));
}
els.railMute.addEventListener('click', () => els.muteBtn.click());
els.railDeafen.addEventListener('click', () => els.deafenBtn.click());
els.railLeave.addEventListener('click', () => leaveVoice());
els.railAvatar.addEventListener('click', () => openSettings());

// ---------- modal genérico ----------
function modal({ title, desc, body = [], buttons = [], cardClass = '' }) {
  const form = h('form', { class: 'modal-card ' + cardClass });
  if (title) form.append(h('h2', { text: title }));
  if (desc) form.append(h('p', { text: desc }));
  form.append(...[].concat(body));
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  if (buttons.length) {
    form.append(h('div', { class: 'modal-actions' }, ...buttons.map((b) => h('button', {
      type: b.submit ? 'submit' : 'button', class: b.cls || 'secondary', text: b.label,
      onclick: b.submit ? null : () => { if (!b.fn || b.fn() !== false) close(); },
    }))));
  }
  const submitBtn = buttons.find((b) => b.submit);
  form.addEventListener('submit', (e) => { e.preventDefault(); if (submitBtn && (!submitBtn.fn || submitBtn.fn() !== false)) close(); });
  const wrap = h('div', { class: 'modal' }, form);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', onKey, true);
  els.modalRoot.append(wrap);
  return { close, el: form };
}

function showReplaced() {
  els.banner.hidden = true;
  modal({
    title: 'Aberto em outra janela',
    desc: 'Sua conta foi aberta em outra janela ou em outro aparelho. Esta janela foi desconectada.',
    buttons: [{ label: 'Usar nesta janela', cls: 'primary', fn: () => { state.replaced = false; connect(); } }],
  });
}

// ---------- convites ----------
let addressCache = null;
async function inviteBases() {
  if (!addressCache) {
    let info = { addresses: [], port: location.port };
    try { info = await (await fetch('/info')).json(); } catch { /* sem info */ }
    const port = info.port || location.port || 443;
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const list = info.addresses.map((a) => `https://${a}:${port}`);
    addressCache = local ? list : [location.origin]; // no servidor online, o endereço certo é o que você está usando
    if (!addressCache.length) addressCache = [location.origin];
  }
  return addressCache;
}
const EXPIRE_OPTS = [[168, '7 dias'], [24, '1 dia'], [1, '1 hora'], [0, 'Nunca']];
const USES_OPTS = [[0, 'Sem limite'], [1, '1 uso'], [5, '5 usos'], [10, '10 usos'], [25, '25 usos']];
function makeInvite(g, hours, max) {
  return new Promise((resolve) => {
    waiters['invite-created'] = (m) => resolve(m);
    send({ type: 'invite-create', gid: g.id, hours, max });
  });
}
async function inviteModal(g = curGuild()) {
  if (!g) return;
  let hours = 168, max = 0;
  const linkBox = h('div', { class: 'invite-links' }, h('div', { class: 'loading', text: 'Gerando convite…' }));
  const draw = async () => {
    const [res, bases] = await Promise.all([makeInvite(g, hours, max), inviteBases()]);
    const rows = bases.map((b, i) => {
      const url = `${b}/convite/${res.code}`;
      const inp = h('input', { type: 'text', value: url, readonly: true, class: 'text-input' });
      return h('div', { class: 'invite-row' + (i ? ' secondary-row' : '') }, inp, h('button', { type: 'button', class: i ? 'secondary' : 'primary', text: 'Copiar', onclick: (e) => {
        navigator.clipboard.writeText(url).then(() => { e.target.textContent = 'Copiado!'; setTimeout(() => { e.target.textContent = 'Copiar'; }, 1500); }, () => inp.select());
      } }));
    });
    const exp = EXPIRE_OPTS.find((x) => x[0] === hours)[1];
    linkBox.replaceChildren(...rows,
      h('p', { class: 'invite-meta', text: `Código: ${res.code} · expira: ${hours ? 'em ' + exp : 'nunca'} · ${max ? max + ' usos' : 'usos ilimitados'}. No app, dá para colar o link ou só o código em "Entrar com um convite".` }));
  };
  const sel = (opts, cur, on) => {
    const s = h('select', { class: 'select' }, ...opts.map(([v, l]) => h('option', { value: v, text: l, selected: v === cur })));
    s.addEventListener('change', () => { on(Number(s.value)); linkBox.replaceChildren(h('div', { class: 'loading', text: 'Gerando convite…' })); draw(); });
    return s;
  };
  modal({
    title: `Convidar para "${g.name}"`,
    body: [
      h('p', { text: 'Mande o link para a pessoa. Quem já tem o app entra direto no servidor; no navegador, é só abrir o link.' }),
      linkBox,
      h('div', { class: 'invite-opts' },
        h('div', {}, h('label', { text: 'Expira em' }), sel(EXPIRE_OPTS, hours, (v) => { hours = v; })),
        h('div', {}, h('label', { text: 'Limite de usos' }), sel(USES_OPTS, max, (v) => { max = v; }))),
    ],
    buttons: [{ label: 'Pronto', cls: 'primary' }],
  });
  draw();
}
els.inviteBtn.addEventListener('click', (e) => { e.stopPropagation(); inviteModal(); });

// ---------- reportar bug ----------
const BUG_EMAIL = 'mikaelfernandesmoreira@gmail.com';
const APP_VERSION = '3.1';
function bugInfo() {
  const c = chan(state.current);
  const g = curGuild();
  return [
    `Versão: ${APP_VERSION} (${desk ? 'app desktop' : 'navegador'})`,
    `Navegador: ${navigator.userAgent}`,
    `Servidor: ${location.host}`,
    `Usuário: @${state.username || '?'}`,
    `Onde: ${g ? g.name : '-'} / ${c ? (c.type === 'voice' ? 'voz: ' : '#') + c.name : '-'}`,
    `Na chamada: ${voice.active ? 'sim' : 'não'}${voice.active ? ` (${voice.peers.size} conexões: ${[...voice.peers.values()].map((p) => p.pc.connectionState).join(', ')})` : ''}`,
    `Tela: ${innerWidth}x${innerHeight} · tema ${settings.theme}`,
    '',
    'Últimos erros:',
    ...(logRing.length ? logRing.slice(-12) : ['(nenhum)']),
  ].join('\n');
}
function bugModal() {
  const what = h('textarea', { class: 'text-input bug-text', rows: 4, maxlength: 1500, placeholder: 'Ex.: quando clico em "Tela" a janela fica preta…' });
  const steps = h('textarea', { class: 'text-input bug-text', rows: 3, maxlength: 1000, placeholder: '1. Entrei na sala de voz  2. Cliquei em…' });
  const tech = h('input', { type: 'checkbox', checked: true });
  const preview = h('pre', { class: 'bug-preview', text: bugInfo() });
  const compose = () => {
    if (!what.value.trim()) { toast('Conte o que aconteceu.'); what.focus(); return null; }
    const subject = `[Concord] Bug: ${what.value.trim().split('\n')[0].slice(0, 70)}`;
    const body = `O que aconteceu:\n${what.value.trim()}\n\nComo fazer acontecer:\n${steps.value.trim() || '-'}\n` + (tech.checked ? `\n--- informações técnicas ---\n${bugInfo()}` : '');
    return { subject, body };
  };
  const open = (url) => {
    if (desk && desk.openExternal) desk.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  };
  modal({
    title: 'Reportar um bug', cardClass: 'bug-card',
    desc: `O relatório vai para ${BUG_EMAIL}. Ele abre pronto no seu e-mail; é só conferir e enviar.`,
    body: [h('label', { text: 'O que aconteceu?' }), what, h('label', { text: 'Como fazer o bug acontecer (opcional)' }), steps,
      h('label', { class: 'check-row' }, tech, h('span', { text: 'Incluir informações técnicas (versão, navegador, erros recentes)' })), preview],
    buttons: [
      { label: 'Copiar texto', cls: 'link-btn', fn: () => { const r = compose(); if (!r) return false; navigator.clipboard.writeText(`Para: ${BUG_EMAIL}\nAssunto: ${r.subject}\n\n${r.body}`).then(() => toast('Texto copiado. Cole num e-mail para ' + BUG_EMAIL)); return false; } },
      { label: 'Abrir no app de e-mail', cls: 'secondary', fn: () => { const r = compose(); if (!r) return false; open(`mailto:${BUG_EMAIL}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body.slice(0, 1800))}`); } },
      { label: 'Enviar pelo Gmail', cls: 'primary', fn: () => { const r = compose(); if (!r) return false; open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(BUG_EMAIL)}&su=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body.slice(0, 6000))}`); toast('Abrimos o Gmail com o relatório. Confira e clique em Enviar.'); } },
    ],
  });
  tech.addEventListener('change', () => { preview.hidden = !tech.checked; });
  setTimeout(() => what.focus(), 50);
}
els.bugBtn.addEventListener('click', bugModal);

// ---------- criar / entrar em servidor ----------
function addGuildModal() {
  const m = modal({
    title: 'Adicionar um servidor', cardClass: 'add-guild-card',
    body: [
      h('button', { type: 'button', class: 'type-option big', onclick: () => { m.close(); createGuildModal(); } },
        h('span', { class: 'big-ico', html: I.home }), h('div', {}, h('div', { class: 't-name', text: 'Criar meu servidor' }), h('div', { class: 't-desc', text: 'Um espaço novo para você e seus amigos, com salas próprias.' }))),
      h('button', { type: 'button', class: 'type-option big', onclick: () => { m.close(); joinGuildModal(); } },
        h('span', { class: 'big-ico', html: I.link }), h('div', {}, h('div', { class: 't-name', text: 'Entrar com um convite' }), h('div', { class: 't-desc', text: 'Cole o link ou o código que te mandaram.' }))),
    ],
    buttons: [{ label: 'Cancelar', cls: 'link-btn' }],
  });
}
function createGuildModal() {
  const name = h('input', { type: 'text', maxlength: 50, value: `Servidor de ${state.me.name}` });
  let icon = null;
  const preview = h('div', { class: 'icon-pick', title: 'Escolher ícone', html: I.image });
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
  preview.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try { icon = (await uploadFile(await squareImage(f))).url; preview.textContent = ''; preview.style.backgroundImage = `url("${icon}")`; }
    catch (e) { toast('Falha ao enviar o ícone: ' + e.message); }
  });
  const pick = friendPicker();
  modal({
    title: 'Criar servidor', desc: 'Dê um nome e, se quiser, um ícone. Dá para mudar depois.', cardClass: 'create-guild-card',
    body: [h('div', { class: 'icon-pick-row' }, preview, file), h('label', { text: 'Nome do servidor' }), name,
      h('label', { text: 'Já colocar pessoas no servidor (opcional)' }), pick.el],
    buttons: [{ label: 'Voltar', cls: 'link-btn', fn: () => { addGuildModal(); } }, { label: 'Criar', cls: 'primary', submit: true, fn: () => {
      if (!name.value.trim()) return false;
      send({ type: 'guild-create', name: name.value, icon, friends: pick.selected() });
    } }],
  });
  setTimeout(() => name.select(), 50);
}
function joinGuildModal(code) {
  const input = h('input', { type: 'text', placeholder: 'https://26.x.x.x:3000/convite/abc123 ou abc123', value: code || '' });
  const preview = h('div', { class: 'invite-preview' });
  let valid = null;
  const check = () => {
    const c = input.value.trim().replace(/^.*\/convite\//, '');
    if (!c) { preview.replaceChildren(); valid = null; return; }
    waiters['invite-info'] = (r) => {
      if (!r.ok) { valid = null; preview.replaceChildren(h('div', { class: 'form-msg err', text: r.message })); return; }
      valid = r.code;
      preview.replaceChildren(guildIcon(r.guild, 'invite-icon'), h('div', {},
        h('div', { class: 'ac-name', text: r.guild.name }),
        h('div', { class: 'pc-sub' }, h('span', { class: 'dot-on' }), `${r.guild.online} online · ${r.guild.members} membros`),
        r.member ? h('div', { class: 'pc-sub', text: 'Você já está nesse servidor.' }) : null));
    };
    send({ type: 'invite-info', code: c });
  };
  let t = null;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(check, 300); });
  modal({
    title: 'Entrar em um servidor', desc: 'Cole o convite que te mandaram.',
    body: [h('label', { text: 'Link ou código do convite' }), input, preview],
    buttons: [{ label: 'Voltar', cls: 'link-btn', fn: () => { addGuildModal(); } }, { label: 'Entrar no servidor', cls: 'primary', submit: true, fn: () => {
      if (!valid) { check(); toast('Confira o convite.'); return false; }
      send({ type: 'invite-join', code: valid });
    } }],
  });
  if (code) check();
  setTimeout(() => input.focus(), 50);
}

// ---------- configurações do servidor ----------
function openGuildSettings(gid, section) {
  let g = state.guilds.get(gid);
  if (!g) return;
  const root = h('div', { class: 'settings' });
  const content = h('div', { class: 'settings-content' });
  const nav = h('div', { class: 'settings-nav' });
  const P = () => permsIn(g);
  const sections = () => [
    ['geral', 'Visão geral', P().has('gerenciar_servidor') || g.ownerId === state.me.id],
    ['cargos', 'Cargos', P().has('gerenciar_cargos')],
    ['membros', 'Membros', ['gerenciar_cargos', 'expulsar', 'banir'].some((p) => P().has(p))],
    ['convites', 'Convites', P().has('gerenciar_servidor')],
    ['sons', 'Sons', P().has('gerenciar_servidor')],
    ['banidos', 'Banidos', P().has('banir')],
  ].filter((x) => x[2]);
  let current = section || (sections()[0] || [])[0];
  let selRole = null;
  const show = (s) => {
    current = s;
    nav.replaceChildren(h('div', {}, h('div', { class: 'nav-title', text: g.name }),
      ...sections().map(([k, label]) => h('button', { class: k === s ? 'on' : '', text: label, onclick: () => show(k) }))));
    const fn = { geral: overview, sons: soundsSection, cargos: rolesSection, membros: membersSection, convites: invitesSection, banidos: bansSection }[s];
    content.replaceChildren(h('div', {}, ...(fn ? fn() : [h('p', { text: 'Sem permissão.' })])));
    content.append(h('button', { class: 'settings-close', onclick: close, html: `<span class="x">${I.x}</span>ESC` }));
  };
  const onKey = (e) => { if (e.key === 'Escape' && !els.modalRoot.children.length) { e.stopPropagation(); close(); } };
  function close() { root.remove(); document.removeEventListener('keydown', onKey, true); state.onGuildChange = null; delete waiters['invite-list']; delete waiters['ban-list']; }
  document.addEventListener('keydown', onKey, true);
  state.onGuildChange = (ng) => {
    if (ng.id !== g.id) return;
    g = ng;
    const active = document.activeElement;
    if (active && root.contains(active) && active.matches('input[type=text], .text-input')) return; // não atrapalha quem está digitando
    if (!sections().some((x) => x[0] === current)) return close();
    show(current);
  };
  root.append(nav, content);
  document.body.append(root);
  show(current);

  function overview() {
    const name = h('input', { class: 'text-input', maxlength: 50, value: g.name });
    let icon = g.icon;
    const pic = guildIcon(g, 'icon-pick big');
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
    pic.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      try { icon = (await uploadFile(await squareImage(f))).url; pic.textContent = ''; pic.style.backgroundImage = `url("${icon}")`; } catch (e) { toast('Falha: ' + e.message); }
    });
    const out = [h('h2', { text: 'Visão geral do servidor' })];
    if (P().has('gerenciar_servidor')) {
      out.push(h('div', { class: 'overview-row' }, h('div', {}, pic, file, h('button', { class: 'link-btn', text: 'Remover ícone', onclick: () => { icon = null; pic.style.backgroundImage = ''; pic.textContent = g.name.slice(0, 2).toUpperCase(); } })),
        h('div', { style: { flex: '1' } }, h('h3', { text: 'Nome do servidor', style: { marginTop: '0' } }), name,
          h('button', { class: 'primary', text: 'Salvar alterações', onclick: () => { send({ type: 'guild-update', gid: g.id, name: name.value, icon }); toast('Servidor atualizado.'); } }))));
    }
    if (g.ownerId === state.me.id) {
      out.push(h('div', { class: 'sep-line' }), h('h3', { text: 'Zona de perigo' }),
        h('p', { class: 'sr-desc', text: 'Apagar o servidor remove todas as salas e mensagens para todo mundo. Não tem como desfazer.' }),
        h('button', { class: 'danger-btn', text: 'Apagar servidor', onclick: () => {
          const conf = h('input', { type: 'text', placeholder: g.name });
          modal({ title: `Apagar "${g.name}"`, desc: 'Digite o nome do servidor para confirmar.', body: [conf],
            buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Apagar para sempre', cls: 'danger-btn', fn: () => {
              if (conf.value.trim() !== g.name) { toast('O nome não confere.'); return false; }
              send({ type: 'guild-delete', gid: g.id });
              close();
            } }] });
        } }));
    }
    return out;
  }

  function soundsSection() {
    const cur = g.sounds || {};
    const saveSound = (k, v) => send({ type: 'guild-update', gid: g.id, sounds: { [k]: v } });
    const rows = SOUND_KINDS.map(([k, title, desc]) => {
      const s = cur[k];
      const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.ogg,.opus,.m4a,.aac,.flac', hidden: true });
      const pick = h('button', { class: 'secondary', html: lu('upload') + '<span>' + (s ? 'Trocar' : 'Escolher som') + '</span>', onclick: () => file.click() });
      file.addEventListener('change', async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) return toast('O som pode ter no máximo 2 MB.');
        const dur = await new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); a.src = URL.createObjectURL(f); });
        if (dur < 0) return toast('Não consegui ler esse arquivo de áudio. Use .mp3, .wav ou .ogg.');
        if (dur > 6.5) return toast(`Esse som tem ${Math.round(dur)} s. Use um de até 6 segundos.`);
        pick.disabled = true;
        try {
          const r = await uploadFile(f);
          saveSound(k, { url: r.url, name: f.name.replace(/\.[^.]+$/, ''), vol: s ? s.vol : 1 });
          toast('Som salvo para todo mundo do servidor.');
        } catch (e) { toast('Falha: ' + e.message); pick.disabled = false; }
      });
      const vol = h('input', { type: 'range', min: 5, max: 100, value: Math.round((s ? s.vol : 1) * 100), class: 'snd-vol', title: 'Volume' });
      vol.addEventListener('change', () => { if (s) saveSound(k, { ...s, vol: vol.value / 100 }); });
      const test = h('button', { class: 'icon-btn snd-test', title: 'Ouvir', html: lu('play'), onclick: () => {
        if (s) playSoundFile(s.url, vol.value / 100).catch(() => toast('Não deu para tocar o som.')); else sfxTone(k);
      } });
      return h('div', { class: 'snd-row' },
        test,
        h('div', { class: 'snd-info' }, h('div', { class: 'sr-title', text: title }),
          h('div', { class: 'sr-desc', text: s ? `Personalizado: ${s.name}` : 'Som padrão do Concord' }),
          h('div', { class: 'sr-desc', text: desc })),
        s ? vol : null,
        h('div', { class: 'snd-actions' }, pick, file,
          s ? h('button', { class: 'link-btn', text: 'Usar padrão', onclick: () => saveSound(k, null) }) : null));
    });
    return [h('h2', { text: 'Sons do servidor' }),
      h('p', { class: 'sr-desc', text: 'Escolha um som (até 6 segundos e 2 MB, em .mp3, .wav ou .ogg) para cada momento. Todo mundo do servidor ouve os mesmos sons; quem preferir os padrões desliga em Configurações → Notificações.' }),
      h('div', { class: 'snd-list' }, ...rows)];
  }

  function rolesSection() {
    const top = topPos(g, state.me.id);
    const myP = P();
    const roles = [...g.roles].sort((a, b) => b.pos - a.pos);
    if (!selRole || !g.roles.some((r) => r.id === selRole)) selRole = (roles.find((r) => r.id !== g.id && r.pos < top) || roles[roles.length - 1]).id;
    const list = h('div', { class: 'role-list' },
      h('button', { class: 'primary', text: 'Criar cargo', onclick: () => { waiters['role-created'] = (m) => { selRole = m.id; if (root.isConnected && current === 'cargos') show('cargos'); }; send({ type: 'role-create', gid: g.id }); } }),
      ...roles.map((r) => h('button', { class: 'role-item' + (r.id === selRole ? ' on' : ''), onclick: () => { selRole = r.id; show('cargos'); } },
        h('i', { class: 'role-dot', style: { background: r.color || '#99aab5' } }), h('span', { text: r.name }),
        h('small', { text: r.id === g.id ? 'todos' : String(Object.values(g.members).filter((mm) => mm.roles.includes(r.id)).length) }))));
    const r = g.roles.find((x) => x.id === selRole);
    const locked = r.pos >= top;
    const upd = (patch) => send({ type: 'role-update', gid: g.id, id: r.id, name: r.name, color: r.color, hoist: r.hoist, perms: r.perms, ...patch });
    const editor = h('div', { class: 'role-editor' });
    editor.append(h('h3', { text: r.id === g.id ? 'Permissões padrão (@todos)' : `Editar cargo — ${r.name}`, style: { marginTop: '0' } }));
    if (locked) editor.append(h('p', { class: 'form-msg err', text: 'Este cargo está no mesmo nível ou acima do seu: você não pode editá-lo.' }));
    if (r.id !== g.id) {
      const nm = h('input', { class: 'text-input', maxlength: 30, value: r.name, disabled: locked });
      nm.addEventListener('change', () => upd({ name: nm.value }));
      const colors = [null, '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#607d8b'];
      const sw = h('div', { class: 'swatches' }, ...colors.map((c) => h('button', { type: 'button', disabled: locked, title: c ? c : 'Sem cor', class: 'swatch' + ((r.color || null) === c ? ' on' : '') + (c ? '' : ' none'), style: { background: c || 'transparent' }, onclick: () => upd({ color: c }) })),
        h('label', { class: 'swatch custom', title: 'Cor personalizada' }, (() => { const ci = h('input', { type: 'color', value: r.color || '#99aab5', disabled: locked }); ci.addEventListener('change', () => upd({ color: ci.value })); return ci; })()));
      const hoist = h('button', { class: 'switch' + (r.hoist ? ' on' : ''), disabled: locked, onclick: () => upd({ hoist: !r.hoist }) });
      editor.append(h('label', { text: 'Nome do cargo' }), nm, h('label', { text: 'Cor' }), sw,
        h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'sr-title', text: 'Mostrar separado na lista de membros' }), h('div', { class: 'sr-desc', text: 'Quem tem esse cargo aparece num grupo próprio.' })), hoist),
        h('div', { class: 'btn-row', style: { marginTop: '12px' } },
          h('button', { class: 'secondary with-ico', html: I.up + 'Subir', disabled: locked || r.pos + 1 >= top || r.pos + 1 >= g.roles.length, onclick: () => send({ type: 'role-move', gid: g.id, id: r.id, dir: 1 }) }),
          h('button', { class: 'secondary with-ico', html: I.down + 'Descer', disabled: locked || r.pos <= 1, onclick: () => send({ type: 'role-move', gid: g.id, id: r.id, dir: -1 }) }),
          h('button', { class: 'danger-btn', text: 'Apagar cargo', disabled: locked, onclick: () => modal({ title: `Apagar o cargo "${r.name}"`, desc: 'Quem tem esse cargo perde as permissões dele.',
            buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Apagar', cls: 'danger-btn', fn: () => send({ type: 'role-delete', gid: g.id, id: r.id }) }] }) })));
    }
    editor.append(h('h3', { text: 'Permissões' }));
    for (const p of state.perms) {
      if (!PERM_INFO[p]) continue; // ex.: bot de música desligado
      const on = r.perms.includes(p);
      const dis = locked || !myP.has(p);
      editor.append(h('div', { class: 'setting-row' + (dis ? ' dim' : '') },
        h('div', {}, h('div', { class: 'sr-title', text: PERM_INFO[p][0] }), h('div', { class: 'sr-desc', text: PERM_INFO[p][1] + (dis && !locked ? ' (você não tem essa permissão)' : '') })),
        h('button', { class: 'switch' + (on ? ' on' : ''), disabled: dis, onclick: () => upd({ perms: on ? r.perms.filter((x) => x !== p) : [...r.perms, p] }) })));
    }
    return [h('h2', { text: 'Cargos' }), h('p', { class: 'sr-desc', text: 'Cargos mais altos na lista têm mais poder: você só gerencia os que estão abaixo do seu. O dono pode tudo.' }),
      h('div', { class: 'roles-layout' }, list, editor)];
  }

  function membersSection() {
    const search = h('input', { class: 'text-input', placeholder: 'Procurar membro' });
    const box = h('div', { class: 'member-table' });
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const rows = Object.entries(g.members).map(([uid, mem]) => ({ uid, mem, p: profileOf(uid) }))
        .filter((x) => !q || x.p.name.toLowerCase().includes(q) || (state.users.get(x.uid) || {}).username?.includes(q))
        .sort((a, b) => a.p.name.localeCompare(b.p.name, 'pt-BR'));
      box.replaceChildren(...rows.map(({ uid, mem, p }) => h('div', { class: 'mt-row' },
        avatar(p, { presence: state.users.has(uid) }),
        h('div', { class: 'mt-info' }, h('div', { class: 'sr-title', style: { color: nameColor(uid, p.color, g) } }, p.name, g.ownerId === uid ? h('span', { class: 'crown', title: 'Dono', html: I.crown }) : ''),
          h('div', { class: 'sr-desc', text: 'Entrou em ' + new Date(mem.joined).toLocaleDateString('pt-BR') })),
        h('div', { class: 'role-chips' }, ...rolesOf(g, uid).map((r) => h('span', { class: 'role-chip' }, h('i', { style: { background: r.color || '#99aab5' } }), r.name))),
        h('button', { class: 'icon-btn', title: 'Ações', html: lu('ellipsis'),
          onclick: (e) => { const acts = memberActions(g, uid); if (!acts.length) return toast('Nada que você possa fazer com essa pessoa.'); const r = e.currentTarget.getBoundingClientRect(); showContextMenu(r.left - 140, r.bottom + 4, acts); } }))));
    };
    search.addEventListener('input', draw);
    draw();
    return [h('h2', { text: `Membros — ${Object.keys(g.members).length}` }), search, box];
  }

  function invitesSection() {
    const box = h('div', { class: 'member-table' }, h('div', { class: 'loading', text: 'Carregando…' }));
    const draw = (invites) => {
      const list = Object.entries(invites || {});
      if (!list.length) return box.replaceChildren(h('p', { class: 'sr-desc', text: 'Nenhum convite ativo.' }));
      box.replaceChildren(...list.map(([code, inv]) => h('div', { class: 'mt-row' },
        h('code', { class: 'inv-code', text: code }),
        h('div', { class: 'mt-info' }, h('div', { class: 'sr-title', text: 'Criado por ' + profileOf(inv.by).name }),
          h('div', { class: 'sr-desc', text: `${inv.uses || 0}${inv.max ? '/' + inv.max : ''} usos · ${inv.exp ? 'expira ' + new Date(inv.exp).toLocaleString('pt-BR') : 'não expira'}` })),
        h('button', { class: 'secondary', text: 'Copiar', onclick: async () => { const b = (await inviteBases())[0]; navigator.clipboard.writeText(`${b}/convite/${code}`).then(() => toast('Link copiado.')); } }),
        h('button', { class: 'danger-btn', text: 'Apagar', onclick: () => send({ type: 'invite-delete', gid: g.id, code }) }))));
    };
    waiters['invite-list'] = (m) => { if (m.gid === g.id) draw(m.invites); return 'keep'; };
    send({ type: 'invite-list', gid: g.id });
    return [h('h2', { text: 'Convites' }), h('div', { class: 'btn-row' }, h('button', { class: 'primary', text: 'Criar convite', onclick: () => inviteModal(g) }),
      h('button', { class: 'secondary', text: 'Atualizar', onclick: () => send({ type: 'invite-list', gid: g.id }) })), box];
  }

  function bansSection() {
    const box = h('div', { class: 'member-table' }, h('div', { class: 'loading', text: 'Carregando…' }));
    waiters['ban-list'] = (m) => {
      if (m.gid !== g.id) return 'keep';
      const list = Object.entries(m.bans || {});
      box.replaceChildren(...(list.length ? list.map(([uid, b]) => h('div', { class: 'mt-row' }, avatar(profileOf(uid, { name: b.name })),
        h('div', { class: 'mt-info' }, h('div', { class: 'sr-title', text: profileOf(uid, { name: b.name }).name }), h('div', { class: 'sr-desc', text: `Banido por ${profileOf(b.by).name} em ${new Date(b.ts).toLocaleDateString('pt-BR')}` })),
        h('button', { class: 'secondary', text: 'Desbanir', onclick: () => send({ type: 'member-unban', gid: g.id, uid }) }))) : [h('p', { class: 'sr-desc', text: 'Ninguém banido.' })]));
      return 'keep';
    };
    send({ type: 'ban-list', gid: g.id });
    return [h('h2', { text: 'Banidos' }), box];
  }
}

// =====================================================================
// notificações (popup na tela + aviso do sistema)
// =====================================================================
let audioCtx = null;
// sons personalizados do servidor (Configurações do servidor → Sons)
const SOUND_KINDS = [
  ['join', 'Alguém entra na chamada', 'Também toca quando você entra.'],
  ['leave', 'Alguém sai da chamada', 'Também toca quando você sai.'],
  ['message', 'Mensagem nova', 'Quando chega mensagem numa sala deste servidor.'],
  ['streamStart', 'Começou uma live', 'Quando alguém da chamada começa a compartilhar a tela.'],
  ['streamEnd', 'Parou a live', 'Quando alguém para de compartilhar a tela.'],
];
function playSoundFile(url, vol) {
  const a = new Audio(url);
  a.volume = Math.max(0, Math.min(1, vol == null ? 1 : vol));
  if (a.setSinkId && settings.speaker) a.setSinkId(settings.speaker).catch(() => {});
  const stop = setTimeout(() => a.pause(), 6000); // sons longos são cortados
  a.addEventListener('ended', () => clearTimeout(stop));
  return a.play();
}
function sfx(kind, ch) {
  const g = ch && settings.serverSounds !== false ? guildOf(ch) : null;
  const cs = g && g.sounds && g.sounds[kind];
  if (cs && cs.url) { playSoundFile(cs.url, cs.vol).catch(() => sfxTone(kind)); return; }
  sfxTone(kind);
}
function sfxTone(kind) {
  try {
    audioCtx = audioCtx || new AudioContext();
    // toca no mesmo fone/caixa escolhido para a chamada (senão sai no dispositivo padrão do Windows)
    if (audioCtx.setSinkId && (audioCtx.sinkId || '') !== (settings.speaker || '')) audioCtx.setSinkId(settings.speaker || '').catch(() => {});
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const t = audioCtx.currentTime;
    const tones = { join: [[440, 440], [660, 660]], leave: [[660, 660], [415, 415]], toggle: [[600, 600]], message: [[880, 880], [1320, 1320]],
      // live: três notas subindo para começar, descendo para parar
      streamStart: [[523, 523], [659, 659], [988, 988]], streamEnd: [[880, 880], [659, 659], [440, 440]] }[kind] || [[600, 600]];
    const stream = ['streamStart', 'streamEnd', 'join', 'leave'].includes(kind);
    tones.forEach(([a, b], i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const st = t + i * (stream ? 0.11 : 0.09);
      o.type = stream ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(a, st);
      o.frequency.exponentialRampToValueAtTime(b, st + 0.12);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(kind === 'message' ? 0.08 : 0.12, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(st);
      o.stop(st + 0.22);
    });
  } catch { /* sem som */ }
}

function notifyMessage(m, mention, nf = notifFor(m.ch)) {
  if (statusOf(state.me.id) === 'ocupado') return; // não perturbe
  if (nf.muted || nf.mode === 'none') return;
  if (nf.mode === 'mentions' && !mention) return;
  const c = chan(m.ch);
  const p = profileOf(m.uid, m);
  const g = guildOf(m.ch);
  if (m.uid === BOT_ID && !mention) return;
  const where = !c ? '' : c.type === 'dm' ? 'mensagem direta' : (c.type === 'voice' ? '' : '#') + c.name + (g && state.guilds.size > 1 ? ' · ' + g.name : '');
  const att = (m.attachments || [])[0];
  const text = m.text || (att ? { image: 'Enviou uma imagem', video: 'Enviou um vídeo', audio: 'Enviou um áudio' }[att.kind] || `Enviou ${att.name}` : 'Enviou uma imagem');
  if (settings.sound) sfx('message', m.ch);
  const away = document.hidden || !document.hasFocus();
  if (away) {
    state.titleUnread++;
    updateTitle();
    if (desk && desk.flash) desk.flash();
    sysNotify(`${p.name} (${where})`, text.slice(0, 200), { ch: m.ch, id: m.id }, m.ch);
    if (m.ch !== state.voiceCh) overlayMessage(m, where); // jogando numa chamada: aparece também por cima do jogo
  }
  if (!settings.popups) return;
  const close = h('button', { class: 'n-close', title: 'Fechar', html: I.x });
  const n = h('div', { class: 'notif' + (mention ? ' mention' : '') },
    avatar(p),
    h('div', { class: 'n-body' }, h('div', { class: 'n-head', html: `<b>${esc(p.name)}</b> em ${c && c.type === 'voice' ? `<span class="ico-inline">${I.speaker}</span>` : ''}${esc(where)}` }), h('div', { class: 'n-text', text: text })),
    close);
  const remove = () => { n.classList.add('out'); setTimeout(() => n.remove(), 200); };
  n.addEventListener('click', (e) => {
    if (e.target.closest('.n-close')) return remove();
    openChannel(m.ch);
    if (settings.callChatMin && chan(m.ch) && chan(m.ch).type === 'voice') setCallChatMin(false);
    setTimeout(() => jumpTo(m.id), 300);
    remove();
  });
  els.notifs.prepend(n);
  while (els.notifs.children.length > 4) els.notifs.lastElementChild.remove();
  let timer = setTimeout(remove, 6000);
  n.addEventListener('mouseenter', () => clearTimeout(timer));
  n.addEventListener('mouseleave', () => { timer = setTimeout(remove, 3000); });
}

// notificação do Windows (no app usa a do sistema; no navegador, a do navegador)
function sysNotify(title, body, data, tag) {
  if (!settings.systemNotify) return;
  const open = () => { if (data && data.ch && chan(data.ch)) { openChannel(data.ch); if (data.id) setTimeout(() => jumpTo(data.id), 300); } };
  if (desk && desk.notify) { desk.notify({ title, body, data }); return; }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag, silent: true });
    n.onclick = () => { window.focus(); if (desk && desk.focus) desk.focus(); open(); n.close(); };
  } catch { /* sem notificação */ }
}
if (desk && desk.onNotifyClick) desk.onNotifyClick((data) => { if (data && data.ch && chan(data.ch)) { openChannel(data.ch); if (data.id) setTimeout(() => jumpTo(data.id), 300); } });

// aviso quando alguém entra numa chamada (em que você não está)
const voiceNotifyLast = new Map();
function notifyVoiceJoin(u) {
  if (!settings.voiceNotify || settings.notifyMode === 'none' || u.id === BOT_ID || statusOf(state.me.id) === 'ocupado') return;
  if (chan(u.voice) && notifFor(u.voice).muted) return;
  const c = chan(u.voice);
  if (!c || c.type !== 'voice') return;
  const key = u.id + ':' + c.id;
  if (Date.now() - (voiceNotifyLast.get(key) || 0) < 60000) return; // não repete se a pessoa cair e voltar
  voiceNotifyLast.set(key, Date.now());
  const g = guildOf(c.id);
  const others = [...state.users.values()].filter((x) => x.voice === c.id && x.id !== u.id).length;
  const where = c.name + (g && state.guilds.size > 1 ? ' · ' + g.name : '');
  const text = others ? `Entrou na chamada (agora são ${others + 1})` : 'Começou uma chamada';
  const join = () => { joinVoice(c.id); openChannel(c.id); };
  if (settings.sound) sfx('join', c.id);
  if (document.hidden || !document.hasFocus()) {
    if (desk && desk.flash) desk.flash();
    sysNotify(`${u.name} em ${where}`, text, { ch: c.id }, 'voz:' + c.id);
  }
  if (!settings.popups) return;
  const close = h('button', { class: 'n-close', title: 'Fechar', html: I.x });
  const enter = h('button', { class: 'n-join', text: 'Entrar' });
  const n = h('div', { class: 'notif voice-notif' },
    avatar(u),
    h('div', { class: 'n-body' }, h('div', { class: 'n-head', html: `<b>${esc(u.name)}</b> em <span class="ico-inline">${I.speaker}</span>${esc(where)}` }), h('div', { class: 'n-text', text: text })),
    enter, close);
  const remove = () => { n.classList.add('out'); setTimeout(() => n.remove(), 200); };
  n.addEventListener('click', (e) => {
    if (e.target.closest('.n-close')) return remove();
    if (e.target.closest('.n-join')) { remove(); return join(); }
    openChannel(c.id);
    remove();
  });
  els.notifs.prepend(n);
  while (els.notifs.children.length > 4) els.notifs.lastElementChild.remove();
  let timer = setTimeout(remove, 8000);
  n.addEventListener('mouseenter', () => clearTimeout(timer));
  n.addEventListener('mouseleave', () => { timer = setTimeout(remove, 3000); });
}

function updateTitle() { document.title = (state.titleUnread ? `(${state.titleUnread}) ` : '') + 'Concord'; }
function onFocusBack() {
  if (document.hidden) return;
  state.titleUnread = 0;
  updateTitle();
  if (state.current) markRead(state.current);
}
document.addEventListener('visibilitychange', onFocusBack);
window.addEventListener('focus', onFocusBack);

// =====================================================================
// voz, câmera e tela
// =====================================================================
const localVideo = { camera: null, screen: null };
const remoteVideo = {}; // uid -> { camera, screen }

const voice = new Voice({
  send,
  ice: () => state.ice || [],
  onRemoteVideo: (id, kind, stream) => {
    remoteVideo[id] = remoteVideo[id] || {};
    remoteVideo[id][kind] = stream;
    renderStage();
  },
  onLocalVideo: (kind, stream) => {
    localVideo[kind] = stream;
    send({ type: 'voice-state', [kind === 'camera' ? 'camera' : 'sharing']: !!stream });
    renderVoiceUI();
  },
  onSpeaking: (speaking) => send({ type: 'voice-state', speaking }),
  onError: (msg) => toast(msg, 6000),
  pickScreen: pickScreen,
  outputDevice: () => settings.speaker,
  onVolumeChange: (uid, v) => { settings.volumes = { ...(settings.volumes || {}), [uid]: v }; saveSettings(); },
});
for (const [uid, v] of Object.entries(settings.volumes || {})) voice.volumes.set(uid, v);
voice.devices.mic = settings.mic;
voice.devices.cam = settings.cam;
voice.noise = { noise: settings.noise, gate: settings.gate, gateDb: settings.gateDb };

async function joinVoice(ch, moved) {
  const c = chan(ch);
  if (!c || (c.type !== 'voice' && c.type !== 'dm') || !state.connected) return;
  if (voice.active && state.voiceCh === ch) return;
  if (state.joining) return;
  if (!window.isSecureContext) return toast('Voz, câmera e tela só funcionam pelo endereço https://.', 7000);
  if (!moved && !can('conectar_voz', ch)) return toast('Você não tem permissão para entrar nas chamadas deste servidor.');
  if (!can('falar', ch)) state.muted = true;
  if (voice.active) leaveVoice(true);
  state.joining = true;
  state.voiceCh = ch;
  try {
    await voice.join(state.me.id);
    voice.setMuted(state.muted);
    voice.setDeafened(state.deafened);
    send({ type: 'voice-join', ch, muted: state.muted, deafened: state.deafened });
    sfx('join', ch);
    musicSync();
  } finally {
    setTimeout(() => { state.joining = false; }, 500);
  }
  renderVoiceUI();
  renderHeader();
}

function localLeaveVoice(silent) {
  if (!silent && voice.active) sfx('leave', state.voiceCh); // som de saída em qualquer caso (sair, ser desconectado, sala apagada)
  voice.leave();
  state.voiceCh = null;
  musicSync();
  localVideo.camera = null;
  localVideo.screen = null;
  for (const k of Object.keys(remoteVideo)) delete remoteVideo[k];
  renderVoiceUI();
  renderHeader();
}
function leaveVoice(switching) {
  if (!voice.active) return;
  localLeaveVoice(!!switching);
  send({ type: 'voice-leave' });
}

els.leaveBtn.addEventListener('click', () => leaveVoice());
els.vpText.addEventListener('click', () => { if (state.voiceCh) openChannel(state.voiceCh); });
els.camBtn.addEventListener('click', async () => { if (voice.cam) voice.stopCamera(); else await voice.startCamera(); });
els.screenBtn.addEventListener('click', async () => { if (voice.screen) voice.stopScreen(); else { state.showOwnPreview = false; await voice.startScreen(); } });
els.muteBtn.addEventListener('click', () => {
  if (voice.active && state.voiceCh && !can('falar', state.voiceCh)) return toast('Você não tem permissão para falar nesta chamada.');
  if (voice.active && state.modApplied && state.modApplied.mute) return toast('Um moderador silenciou você nesta chamada.');
  if (state.deafened) { state.deafened = false; state.muted = false; } else state.muted = !state.muted;
  store('dl-audio', { muted: state.muted, deafened: state.deafened });
  applyAudioPrefs();
});
els.deafenBtn.addEventListener('click', () => {
  if (voice.active && state.modApplied && state.modApplied.deaf) return toast('Um moderador ensurdeceu você nesta chamada.');
  state.deafened = !state.deafened;
  store('dl-audio', { muted: state.muted, deafened: state.deafened });
  applyAudioPrefs();
});

function applyAudioPrefs() {
  voice.setMuted(state.muted);
  voice.setDeafened(state.deafened);
  musicApplyVolume();
  sfx(state.muted || state.deafened ? 'leave' : 'join');
  if (voice.active) send({ type: 'voice-state', muted: state.muted, deafened: state.deafened });
  renderVoiceUI();
}

function renderVoiceUI() {
  const inVoice = voice.active && !!state.voiceCh;
  applyGlobalKeys();
  updateOverlay();
  syncSilenced();
  if (inVoice) applyVoiceMod();
  else if (state.modApplied) { // saiu da chamada: volta o microfone/fone como estavam antes do moderador
    if (state.modApplied.mute) state.muted = !!state.mutedBeforeMod;
    if (state.modApplied.deaf) state.deafened = !!state.deafBeforeMod;
    state.modApplied = null;
  }
  els.voicePanel.hidden = !inVoice;
  const c = chan(state.voiceCh);
  const vg = c && state.guilds.get(c.guild);
  els.vpSub.textContent = !c ? '' : c.type === 'dm' ? `Ligação com ${dmName(c)}` : `${c.name} / ${vg ? vg.name : ''}`;
  els.vpTimer.replaceChildren(...(c && c.callStart ? [timer(c.callStart)] : []));
  const stream = inVoice && can('transmitir', state.voiceCh);
  els.camBtn.hidden = !stream;
  els.screenBtn.hidden = !stream;
  els.camBtn.classList.toggle('on', !!localVideo.camera);
  els.camBtn.title = localVideo.camera ? 'Desligar câmera' : 'Ligar câmera';
  els.screenBtn.classList.toggle('on', !!localVideo.screen);
  $('span', els.screenBtn).textContent = localVideo.screen ? 'Parar' : 'Tela';
  const micOff = state.muted || state.deafened;
  els.muteBtn.classList.toggle('toggled', micOff);
  els.muteBtn.title = micOff ? 'Reativar microfone' : 'Silenciar microfone';
  els.deafenBtn.classList.toggle('toggled', state.deafened);
  els.deafenBtn.title = state.deafened ? 'Reativar áudio' : 'Desativar áudio';
  els.meStatus.textContent = inVoice ? (localVideo.screen ? 'Ao vivo' : 'Em chamada') : (state.me && state.me.activity ? actText(state.me.activity) : STATUS_INFO[statusOf(state.me.id)].label);
  renderChannels();
  renderStage();
  renderRailMe();
}

// ---------- bot de música ----------
const MI = {
  play: lu('play', 'lu-fill'),
  pause: lu('pause', 'lu-fill'),
  skip: lu('skip-forward', 'lu-fill'),
  stop: lu('square', 'lu-fill'),
};
const musicAudio = new Audio();
musicAudio.preload = 'auto';
let musicTrack = null;
let musicStartTimer = null;
let musicErrorFor = null;
function musicStateHere() { return voice.active && state.voiceCh ? state.music.get(state.voiceCh) || null : null; }
function musicCur() { const st = musicStateHere(); return st && st.current ? st.current : null; }
function musicPos(cur) { return cur.pausedAt != null ? cur.pausedAt : (serverNow() - cur.startedAt) / 1000; }
function musicApplyVolume() {
  musicAudio.volume = Math.min(1, voice.getVolume(BOT_ID, 'voice'));
  musicAudio.muted = state.deafened;
  if (musicAudio.setSinkId) musicAudio.setSinkId(settings.speaker || '').catch(() => {});
}
function trySeek(pos) { try { musicAudio.currentTime = Math.max(0, pos); } catch { /* ainda carregando */ } }
function musicSync() {
  clearTimeout(musicStartTimer);
  const cur = MUSIC_ENABLED ? musicCur() : null;
  if (!cur) {
    if (musicTrack) { musicAudio.pause(); musicAudio.removeAttribute('src'); musicAudio.load(); musicTrack = null; }
    return;
  }
  musicApplyVolume();
  if (musicTrack !== cur.id) { musicTrack = cur.id; musicAudio.src = cur.url; }
  const pos = musicPos(cur);
  if (cur.pausedAt != null) { musicAudio.pause(); if (Math.abs(musicAudio.currentTime - pos) > 0.3) trySeek(pos); return; }
  if (pos < 0) { musicAudio.pause(); trySeek(0); musicStartTimer = setTimeout(musicSync, -pos * 1000); return; }
  if (Math.abs(musicAudio.currentTime - pos) > 0.6) trySeek(pos);
  if (musicAudio.paused) musicAudio.play().catch((e) => console.warn('[dl] música', e.name));
}
musicAudio.addEventListener('loadedmetadata', () => {
  const cur = musicCur();
  if (cur && cur.id === musicTrack && !cur.duration && isFinite(musicAudio.duration) && musicAudio.duration > 0) {
    send({ type: 'music', ch: state.voiceCh, action: 'duration', track: cur.id, duration: musicAudio.duration });
  }
  musicSync();
});
musicAudio.addEventListener('ended', () => { const cur = musicCur(); if (cur) send({ type: 'music', ch: state.voiceCh, action: 'ended', track: cur.id }); });
musicAudio.addEventListener('error', () => {
  const cur = musicCur();
  if (!cur || musicErrorFor === cur.id) return;
  musicErrorFor = cur.id;
  toast(`Não consegui tocar "${cur.name}". Pulando…`);
  setTimeout(() => send({ type: 'music', ch: state.voiceCh, action: 'ended', track: cur.id }), 3500);
});
setInterval(() => { const cur = musicCur(); if (cur && cur.pausedAt == null && !musicAudio.paused && Math.abs(musicAudio.currentTime - musicPos(cur)) > 0.8) trySeek(musicPos(cur)); }, 5000);

function musicCmd(action, extra = {}) {
  if (!(voice.active && state.voiceCh)) return toast('Entre numa sala de voz para usar o bot de música.');
  send({ type: 'music', ch: state.voiceCh, action, ...extra });
}
function musicAdd(items) { musicCmd('add', { items }); }
async function musicUpload(files) {
  const list = [...files].filter((f) => /\.(mp3|ogg|oga|opus|wav|m4a|aac|flac|mp4|webm)$/i.test(f.name));
  if (!list.length) return toast('Escolha arquivos de áudio (mp3, ogg, wav, m4a, flac…).');
  toast(`Enviando ${list.length} música${list.length > 1 ? 's' : ''}…`);
  const items = [];
  for (const f of list) {
    try { const r = await uploadFile(f); items.push({ url: r.url, name: f.name }); } catch (e) { toast(`Falha ao enviar ${f.name}: ${e.message}`); }
  }
  if (items.length) musicAdd(items);
}

function updateMusicProgress() {
  const t = tiles.get('bot:music');
  const cur = musicCur();
  if (!t || !cur) return;
  const pos = Math.max(0, musicPos(cur));
  const dur = cur.duration || (isFinite(musicAudio.duration) ? musicAudio.duration : 0);
  t.bar.style.width = dur ? Math.min(100, (pos / dur) * 100) + '%' : '0%';
  t.times.textContent = `${fmtDur(pos)} / ${dur ? fmtDur(dur) : '--:--'}`;
}
function renderMusicTile(t) {
  const st = musicStateHere();
  const cur = st && st.current;
  t.title.textContent = cur ? cur.name : 'Nada tocando';
  t.sub.textContent = cur ? `pedido por ${cur.byName}${st.queue.length ? ` · ${st.queue.length} na fila` : ''}` : (st && st.queue.length ? `${st.queue.length} na fila` : '');
  t.playBtn.innerHTML = cur && cur.pausedAt == null ? MI.pause : MI.play;
  t.playBtn.title = cur && cur.pausedAt == null ? 'Pausar' : 'Continuar';
  t.el.classList.toggle('paused', !!(cur && cur.pausedAt != null));
  updateMusicProgress();
}
function createMusicTile(key) {
  const el = h('div', { class: 'tile music no-video', 'data-key': key });
  const t = { el, kind: 'music', stream: null };
  t.title = h('div', { class: 'music-title' });
  t.sub = h('div', { class: 'music-sub' });
  t.bar = h('i');
  const barWrap = h('div', { class: 'music-bar', title: 'Clique para pular para esse ponto' }, t.bar);
  barWrap.addEventListener('click', (e) => {
    const cur = musicCur();
    const dur = cur && (cur.duration || musicAudio.duration);
    if (!dur) return;
    const r = barWrap.getBoundingClientRect();
    musicCmd('seek', { pos: ((e.clientX - r.left) / r.width) * dur });
  });
  t.times = h('div', { class: 'music-times' });
  t.playBtn = h('button', { type: 'button', class: 'mbtn big', onclick: () => { const cur = musicCur(); musicCmd(cur && cur.pausedAt == null ? 'pause' : 'resume'); } });
  el.append(h('div', { class: 'music-art', html: I.music }),
    h('div', { class: 'music-info' }, t.title, t.sub, barWrap, t.times,
      h('div', { class: 'music-ctl' }, t.playBtn,
        h('button', { type: 'button', class: 'mbtn', title: 'Pular', html: MI.skip, onclick: () => musicCmd('skip') }),
        h('button', { type: 'button', class: 'mbtn', title: 'Parar e limpar a fila', html: MI.stop, onclick: () => musicCmd('stop') }),
        h('button', { type: 'button', class: 'mbtn wide', title: 'Ver fila e adicionar músicas', html: I.list + '<span>Fila</span>', onclick: () => openMusicQueue() }))),
    h('div', { class: 'tile-actions' }, volumeControl(BOT_ID, 'voice', { compact: true })),
    h('div', { class: 'tile-label' }, h('span', { class: 'bot-tag', text: 'BOT' }), 'DJ Galera'));
  els.stage.append(el);
  tiles.set(key, t);
  return t;
}

function openMusicQueue() {
  if (!(voice.active && state.voiceCh)) return toast('Entre numa sala de voz para usar o bot de música.');
  const list = h('div', { class: 'queue-list' });
  const file = h('input', { type: 'file', multiple: true, accept: 'audio/*,.mp3,.ogg,.wav,.m4a,.flac,.opus', hidden: true });
  file.addEventListener('change', () => { const f = [...file.files]; file.value = ''; musicUpload(f); });
  const link = h('input', { type: 'text', class: 'text-input', placeholder: 'Link direto de áudio (https://….mp3)' });
  const draw = () => {
    const st = state.music.get(state.voiceCh);
    const rows = [];
    if (st && st.current) rows.push(h('div', { class: 'q-row now' }, h('span', { class: 'q-num', html: MI.play }), h('div', { class: 'q-info' }, h('b', { text: st.current.name }), h('small', { text: 'tocando agora · pedido por ' + st.current.byName }))));
    (st ? st.queue : []).forEach((it, i) => rows.push(h('div', { class: 'q-row' }, h('span', { class: 'q-num', text: i + 1 }),
      h('div', { class: 'q-info' }, h('span', { text: it.name }), h('small', { text: 'pedido por ' + it.byName })),
      h('button', { type: 'button', class: 'icon-btn small', title: 'Tirar da fila', html: I.x, onclick: () => musicCmd('remove', { id: it.id }) }))));
    list.replaceChildren(...(rows.length ? rows : [h('p', { class: 'sr-desc', text: 'A fila está vazia. Adicione músicas do seu PC ou um link.' })]));
  };
  state.onMusicChange = draw;
  draw();
  const m = modal({
    title: 'Bot de música', cardClass: 'queue-card',
    body: [list,
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        h('button', { type: 'button', class: 'primary', text: 'Adicionar músicas do PC', onclick: () => file.click() }),
        h('button', { type: 'button', class: 'secondary', text: 'Embaralhar', onclick: () => musicCmd('shuffle') }), file),
      h('div', { class: 'invite-row' }, link, h('button', { type: 'button', class: 'secondary', text: 'Adicionar link', onclick: () => { if (link.value.trim()) { musicAdd([{ url: link.value.trim(), name: '' }]); link.value = ''; } } })),
      h('p', { class: 'picker-hint', text: 'Todo mundo na chamada ouve a mesma música ao mesmo tempo. Dica: arquivos de áudio enviados no chat têm o botão "Tocar na chamada". YouTube e Spotify não são suportados.' })],
    buttons: [{ label: 'Fechar', cls: 'secondary' }],
  });
  const chk = setInterval(() => { if (!m.el.isConnected) { clearInterval(chk); state.onMusicChange = null; } }, 300);
}

// ---------- atividade (jogo / status) ----------
let lastActivitySent;
function currentActivity() {
  if (settings.autoGame && state.detectedGame) return { kind: 'jogando', name: state.detectedGame };
  return settings.activity || null;
}
function sendActivity(force) {
  const a = currentActivity();
  const key = JSON.stringify(a);
  if (!force && key === lastActivitySent) return;
  lastActivitySent = key;
  send({ type: 'activity', activity: a });
}
if (desk && desk.onGame) desk.onGame((name) => { state.detectedGame = name || null; if (state.connected) sendActivity(); });
if (desk && desk.setCustomGames) desk.setCustomGames(settings.customGames || []);

// ---------- palco da chamada ----------
const tiles = new Map();
const VOL_ICON = lu('volume-2');
const VOL_OFF_ICON = lu('volume-x');
const SHRINK_ICON = lu('minimize-2');

// controle de volume (usado nos quadros da chamada e no cartão da pessoa)
function volumeControl(uid, kind, { compact = false } = {}) {
  const pct = () => Math.round(voice.getVolume(uid, kind) * 100);
  const icon = h('button', { type: 'button', class: 'vol-btn', title: 'Silenciar para mim' });
  const range = h('input', { type: 'range', min: 0, max: 200, step: 5, value: pct(), class: 'vol-range' });
  const val = h('span', { class: 'vol-val', text: pct() + '%' });
  let before = 100;
  const draw = () => { const v = Number(range.value); icon.innerHTML = v === 0 ? VOL_OFF_ICON : VOL_ICON; val.textContent = v + '%'; range.style.setProperty('--fill', (v / 2) + '%'); range.classList.toggle('boost', v > 100); };
  range.addEventListener('input', () => { voice.setVolume(uid, kind, range.value / 100); draw(); });
  range.addEventListener('click', (e) => e.stopPropagation());
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    if (Number(range.value) > 0) { before = Number(range.value); range.value = 0; } else range.value = before || 100;
    voice.setVolume(uid, kind, range.value / 100);
    draw();
  });
  draw();
  return h('div', { class: 'vol-ctl' + (compact ? ' compact' : ''), onclick: (e) => e.stopPropagation(), ondblclick: (e) => e.stopPropagation() }, icon, range, val);
}

function renderStage() {
  const viewing = voice.active && state.voiceCh && state.current === state.voiceCh;
  const wanted = new Map();
  let anyVideo = false;
  if (viewing) {
    const people = [...state.users.values()].filter((u) => u.voice === state.voiceCh)
      .sort((a, b) => (a.id === state.me.id ? -1 : b.id === state.me.id ? 1 : a.name.localeCompare(b.name, 'pt-BR')));
    for (const u of people) {
      const me = u.id === state.me.id;
      const cam = me ? localVideo.camera : u.camera ? (remoteVideo[u.id] || {}).camera || null : null;
      const scr = me ? localVideo.screen : u.sharing ? (remoteVideo[u.id] || {}).screen || null : null;
      if (u.sharing || (me && localVideo.screen)) { wanted.set(u.id + ':screen', { u, kind: 'screen', stream: scr }); anyVideo = true; }
      if (u.camera || (me && localVideo.camera)) { wanted.set(u.id + ':camera', { u, kind: 'camera', stream: cam }); anyVideo = true; }
      else wanted.set(u.id + ':avatar', { u, kind: 'avatar', stream: null });
    }
    const mst = state.music.get(state.voiceCh);
    if (MUSIC_ENABLED && mst && (mst.current || mst.queue.length)) wanted.set('bot:music', { kind: 'music' });
  }
  for (const [key, t] of tiles) if (!wanted.has(key)) { if (t.video) t.video.srcObject = null; t.el.remove(); tiles.delete(key); }
  for (const [key, w] of wanted) {
    let t = tiles.get(key);
    if (w.kind === 'music') { renderMusicTile(t || createMusicTile(key)); continue; }
    const me = w.u.id === state.me.id;
    if (!t) t = createTile(key, w, me);
    if (w.kind === 'avatar') {
      const sig = [w.u.name, w.u.color, w.u.avatar].join('|');
      if (t.avSig !== sig) { const av = avatar(w.u, { cls: 'tile-avatar' }); t.av.replaceWith(av); t.av = av; t.avSig = sig; }
    }
    const speaking = w.u.speaking && !w.u.muted && !w.u.deafened && w.kind !== 'screen';
    t.el.classList.toggle('speaking', !!speaking);
    const label = (w.kind === 'screen' ? '<span class="live">AO VIVO</span>' : '') + esc(w.u.name) + (me ? ' (você)' : '') +
      (w.kind !== 'screen' ? voiceIcons(w.u, voiceGuild()) : '');
    if (t.labelHtml !== label) { t.label.innerHTML = label; t.labelHtml = label; }
    if (t.video && t.stream !== w.stream) {
      t.stream = w.stream;
      t.video.srcObject = w.stream;
      if (w.stream) t.video.play().catch(() => {});
    }
    if (t.video) { t.video.hidden = !w.stream; t.waiting.hidden = !!w.stream; }
    if (t.cover) {
      const big = document.fullscreenElement === t.el || state.focusedTile === key;
      const hide = voice.screenSurface === 'monitor' && (!state.showOwnPreview || big);
      t.cover.hidden = !hide;
      t.el.classList.toggle('preview-off', hide);
      if (hide && t.video) t.video.hidden = true;
      const pb = $('[data-act="preview"]', t.cover);
      pb.hidden = big;
      t.cover.querySelector('.ssc-desc').textContent = big
        ? 'Em tela cheia ou ampliada a prévia da tela inteira fica sempre escondida: ela mostraria a si mesma sem parar e embaralharia a imagem. Os outros veem normal.'
        : 'A prévia fica escondida para não criar o efeito de espelho infinito (a tela mostrando ela mesma). Os outros veem normal.';
    }
  }
  // Reordena só quando a ordem muda de verdade, e nunca com alguém em tela cheia
  // (mexer no elemento em tela cheia faz o navegador sair dela).
  const order = { screen: 0, music: 1, camera: 2, avatar: 3 };
  const keys = [...tiles.keys()].sort((a, b) => order[tiles.get(a).kind] - order[tiles.get(b).kind]);
  const current = [...els.stage.children].map((el) => el.dataset.key);
  if (keys.join('\n') !== current.join('\n') && !(document.fullscreenElement && els.stage.contains(document.fullscreenElement))) {
    keys.forEach((k) => els.stage.append(tiles.get(k).el));
  }
  if (state.focusedTile && !tiles.has(state.focusedTile)) state.focusedTile = null;
  // alguém fez live: a tela fica grande e os outros numa fileira embaixo (até você escolher a grade)
  const screens = keys.filter((k) => tiles.get(k).kind === 'screen');
  if (!screens.length) state.gridChosen = false;
  else if (viewing && !state.focusedTile && !state.gridChosen) state.focusedTile = screens.find((k) => !k.startsWith(state.me.id + ':')) || null; // a própria live não amplia sozinha
  els.stage.style.setProperty('--strip-n', Math.max(1, Math.min(8, tiles.size - 1)));
  els.stage.classList.toggle('strip-hidden', !!settings.hideStrip);
  els.stage.classList.toggle('focus', !!state.focusedTile);
  els.main.classList.toggle('focus-mode', !!state.focusedTile && !els.stage.hidden);
  els.stage.classList.toggle('audio-only', !anyVideo);
  for (const [k, t] of tiles) {
    t.el.classList.toggle('focused', k === state.focusedTile);
    if (t.focusBtn) {
      const on = k === state.focusedTile;
      t.focusBtn.innerHTML = on ? SHRINK_ICON : I.focus;
      t.focusBtn.title = on ? 'Voltar ao normal' : 'Ampliar';
    }
  }
  els.stage.hidden = tiles.size === 0;
  els.main.classList.toggle('focus-mode', !!state.focusedTile && !els.stage.hidden);
  toggleStatsTimer(viewing && anyVideo);
  renderCallBar(viewing);
  applyCallView(viewing && !els.stage.hidden);
}

// na chamada: palco grande à esquerda e o chat da sala à direita (dá para minimizar)
function applyCallView(on) {
  const was = els.main.classList.contains('call-view');
  const min = on && !!settings.callChatMin;
  els.main.classList.toggle('call-view', on);
  els.main.classList.toggle('chat-min', min);
  els.app.classList.toggle('in-call-view', on);
  els.app.classList.toggle('call-members', on && !!settings.callMembers && !settings.hideMembers);
  const membersShown = on ? !!settings.callMembers && !settings.hideMembers : !settings.hideMembers;
  els.membersToggle.classList.toggle('on', membersShown);
  els.callChatHead.hidden = !on;
  els.callChatBtn.hidden = !on || !min;
  if (!on || !min) { state.callChatUnread = 0; els.callChatBadge.hidden = true; }
  const c = chan(state.current);
  els.callChatTitle.textContent = c ? (c.type === 'dm' ? 'Chat' : 'Chat de ' + c.name) : 'Chat';
  if (!document.fullscreenElement) for (const b of els.stage.querySelectorAll('[data-act="fschat"]')) b.classList.toggle('on', on && !min);
  if (on !== was && !min) setTimeout(scrollBottom, 30);
}
function setCallChatMin(min) {
  settings.callChatMin = min;
  saveSettings();
  applyCallView(els.main.classList.contains('call-view'));
  if (!min) { setTimeout(scrollBottom, 30); els.input.focus(); }
}
els.callChatMin.addEventListener('click', () => setCallChatMin(true));
els.callChatBtn.addEventListener('click', () => setCallChatMin(false));

// barra de controles da chamada (embaixo do palco)
function renderCallBar(viewing) {
  const bar = els.callBar;
  bar.hidden = !viewing;
  if (!viewing) return;
  if (!bar.firstChild) {
    const mk = (id, title, src, cls = '') => {
      const b = h('button', { type: 'button', class: 'cb-btn ' + cls, title, 'data-for': id, onclick: () => src().click() });
      return b;
    };
    bar.append(
      mk('mute', 'Microfone', () => els.muteBtn), mk('deafen', 'Áudio', () => els.deafenBtn),
      mk('cam', 'Câmera', () => els.camBtn), mk('screen', 'Compartilhar tela', () => els.screenBtn),
      mk('leave', 'Sair da chamada', () => els.leaveBtn, 'danger'));
    const strip = h('button', { type: 'button', class: 'cb-btn cb-strip', 'data-for': 'strip', onclick: () => { settings.hideStrip = !settings.hideStrip; saveSettings(); renderStage(); } });
    bar.prepend(strip);
  }
  const MIC = lu('mic');
  const MIC_OFF = lu('mic-off');
  const HP = lu('headphones');
  const HP_OFF = lu('headphone-off');
  const CAM = lu('video');
  const SCR = lu('screen-share');
  const LEAVE = lu('hang-up');
  const micOff = state.muted || state.deafened;
  const set = (k, html, on, title, hidden) => {
    const b = bar.querySelector(`[data-for="${k}"]`);
    if (b.dataset.html !== html) { b.innerHTML = html; b.dataset.html = html; }
    b.classList.toggle('on', !!on); b.title = title; b.hidden = !!hidden;
  };
  set('mute', micOff ? MIC_OFF : MIC, micOff, micOff ? 'Reativar microfone' : 'Silenciar microfone');
  set('deafen', state.deafened ? HP_OFF : HP, state.deafened, state.deafened ? 'Reativar áudio' : 'Desativar áudio');
  set('cam', CAM, !!localVideo.camera, localVideo.camera ? 'Desligar câmera' : 'Ligar câmera', els.camBtn.hidden);
  set('screen', SCR, !!localVideo.screen, localVideo.screen ? 'Parar de compartilhar' : 'Compartilhar tela', els.screenBtn.hidden);
  set('leave', LEAVE, false, 'Sair da chamada');
  const focusOn = !!state.focusedTile && els.stage.children.length > 1;
  set('strip', lu(settings.hideStrip ? 'chevron-up' : 'chevron-down') + lu('users'), false, settings.hideStrip ? 'Mostrar participantes' : 'Esconder participantes', !focusOn);
}

function createTile(key, w, me) {
  const el = h('div', { class: 'tile ' + (w.kind === 'avatar' ? 'no-video' : w.kind) + (me && w.kind === 'camera' ? ' mirror' : ''), 'data-key': key });
  const t = { el, kind: w.kind, uid: w.u.id, stream: undefined };
  if (w.kind === 'avatar') {
    t.av = h('div');
    el.append(t.av);
  } else {
    t.video = h('video', { autoplay: true, playsinline: true });
    t.video.muted = true; // o som vem pelos elementos de áudio
    t.waiting = h('div', { class: 'waiting', text: 'Conectando…' });
    t.stats = h('div', { class: 'tile-stats' });
    t.focusBtn = h('button', { 'data-act': 'focus', title: 'Ampliar', html: I.focus });
    el.append(t.video, t.waiting, t.stats);
    if (me && w.kind === 'screen') {
      // prévia da própria tela: escondida quando é a tela inteira, para não virar espelho infinito
      t.cover = h('div', { class: 'self-screen-cover' },
        h('span', { class: 'ssc-ico', html: I.tv }),
        h('b', { text: 'Você está transmitindo a tela inteira' }),
        h('span', { class: 'ssc-desc', text: 'A prévia fica escondida para não criar o efeito de espelho infinito (a tela mostrando ela mesma). Os outros veem normal.' }),
        h('button', { type: 'button', class: 'secondary', 'data-act': 'preview', text: 'Mostrar prévia' }));
      el.append(t.cover);
    }
  }
  const actions = h('div', { class: 'tile-actions' });
  if (!me) actions.append(volumeControl(w.u.id, w.kind === 'screen' ? 'screen' : 'voice', { compact: true }));
  if (t.video) actions.append(h('button', { 'data-act': 'fschat', title: 'Mostrar / esconder o chat da chamada', html: lu('message-circle') }), t.focusBtn, h('button', { 'data-act': 'full', title: 'Tela cheia', html: I.expand }));
  if (actions.children.length) el.append(actions);
  t.label = h('div', { class: 'tile-label' });
  el.append(t.label);
  els.stage.append(el);
  tiles.set(key, t);
  return t;
}

// mostra resolução e fps dos vídeos (ao passar o mouse)
let statsTimer = null;
function toggleStatsTimer(on) {
  if (on && !statsTimer) {
    statsTimer = setInterval(() => {
      for (const t of tiles.values()) {
        if (t.kind === 'screen' && t.uid === state.me.id && t.stats) {
          voice.getSendStats('screen').then((st) => {
            const now = performance.now();
            if (!st.peers) { t.stats.textContent = 'Ninguém assistindo ainda'; t.sendBytes = null; return; }
            if (t.sendBytes != null && now > t.sendT) {
              const mbps = (((st.bytes - t.sendBytes) * 8) / ((now - t.sendT) / 1000) / 1e6 / st.peers).toFixed(1).replace('.', ',');
              const why = { cpu: ' · limitado pela CPU', bandwidth: ' · limitado pela internet' }[st.reason] || '';
              t.stats.textContent = `Enviando ${st.w}×${st.h} · ${Math.round(st.fps)} fps · ${mbps} Mbps por pessoa${why}`;
            }
            t.sendBytes = st.bytes;
            t.sendT = now;
          }).catch(() => {});
          continue;
        }
        if (!t.video || !t.stream || !t.video.getVideoPlaybackQuality) continue;
        const frames = t.video.getVideoPlaybackQuality().totalVideoFrames;
        const now = performance.now();
        if (t.lastFrames != null) {
          const fps = Math.round(((frames - t.lastFrames) * 1000) / (now - t.lastT));
          t.stats.textContent = `${t.video.videoWidth}×${t.video.videoHeight} · ${fps} fps`;
        }
        t.lastFrames = frames;
        t.lastT = now;
      }
    }, 1000);
  } else if (!on && statsTimer) { clearInterval(statsTimer); statsTimer = null; }
}

// ---------- chat da chamada dentro da tela cheia (estilo chat de live) ----------
const fsChat = h('div', { class: 'fs-chat' });
const fsList = h('div', { class: 'fsc-list' });
const fsInput = h('textarea', { rows: 1, maxlength: 2000, placeholder: 'Conversar na chamada…' });
fsChat.append(
  h('div', { class: 'fsc-head' }, h('span', { class: 'fsc-title', html: lu('message-circle') + '<b>Chat da chamada</b>' }),
    h('button', { type: 'button', class: 'fsc-min', title: 'Minimizar chat', html: lu('panel-right-close'), onclick: () => { settings.fsChat = false; saveSettings(); placeFsChat(); } })),
  fsList,
  h('form', { class: 'fsc-form', onsubmit: (e) => { e.preventDefault(); sendFsChat(); } }, fsInput, h('button', { type: 'submit', class: 'fsc-send', title: 'Enviar', html: lu('send-horizontal') })));
fsInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFsChat(); }
});
fsChat.addEventListener('click', (e) => e.stopPropagation());
fsChat.addEventListener('dblclick', (e) => e.stopPropagation());
function sendFsChat() {
  const text = replaceShortcodes(fsInput.value.trim());
  if (!text || !state.voiceCh || !state.connected) return;
  if (!can('enviar_mensagens', state.voiceCh)) return toast('Você não tem permissão para enviar mensagens aqui.');
  send({ type: 'chat', ch: state.voiceCh, text });
  fsInput.value = '';
}
function fsLine(m) {
  const p = profileOf(m.uid, m);
  const att = (m.attachments || []).length;
  return h('div', { class: 'fsc-msg', 'data-id': m.id }, avatar(p),
    h('div', { class: 'fsc-body' }, h('b', { style: { color: nameColor(m.uid, p.color, guildOf(m.ch)) || 'var(--text-strong)' }, text: p.name }),
      h('span', { class: 'fsc-text', html: m.text ? formatText(m.text) : '' }), att ? h('span', { class: 'fsc-att', text: `[${att} ${att === 1 ? 'anexo' : 'anexos'}]` }) : null));
}
let fsUnread = 0;
function placeFsChat() {
  const fs = document.fullscreenElement;
  const tile = fs && fs.classList && fs.classList.contains('tile') ? fs : null;
  const inCall = voice.active && state.voiceCh;
  for (const t of els.stage.querySelectorAll('.tile')) t.classList.remove('fs-chat-open');
  const btn = tile && tile.querySelector('[data-act="fschat"]');
  if (!tile || !inCall) { fsChat.remove(); return; }
  if (btn) { btn.classList.toggle('on', !!settings.fsChat); btn.dataset.badge = fsUnread && !settings.fsChat ? (fsUnread > 9 ? '9+' : fsUnread) : ''; }
  if (!settings.fsChat) { fsChat.remove(); return; }
  fsUnread = 0;
  if (btn) btn.dataset.badge = '';
  tile.classList.add('fs-chat-open');
  if (fsChat.parentNode !== tile) tile.append(fsChat);
  const list = state.msgs.get(state.voiceCh) || [];
  fsList.replaceChildren(...(list.length ? list.slice(-80).map(fsLine) : [h('div', { class: 'fsc-empty', text: 'Ninguém escreveu ainda. Diga oi!' })]));
  fsList.scrollTop = fsList.scrollHeight;
  if (!state.msgs.has(state.voiceCh)) send({ type: 'history', ch: state.voiceCh });
  setTimeout(() => fsInput.focus(), 30);
}
function fsChatOnMessage(m) {
  if (!document.fullscreenElement || m.ch !== state.voiceCh) return;
  if (fsChat.isConnected) {
    const near = fsList.scrollHeight - fsList.scrollTop - fsList.clientHeight < 80;
    const empty = fsList.querySelector('.fsc-empty');
    if (empty) empty.remove();
    fsList.append(fsLine(m));
    if (near || isMine(m)) fsList.scrollTop = fsList.scrollHeight;
  } else if (!isMine(m)) { fsUnread++; placeFsChat(); }
}

function setFocus(key) {
  if (!key) state.gridChosen = true; // voltou para a grade: não amplia sozinho de novo enquanto a live continuar
  state.focusedTile = key;
  renderStage();
}
function toggleFullscreen(tile) {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else tile.requestFullscreen?.().catch((e) => toast('Não deu para entrar em tela cheia: ' + e.message));
}
let clickTimer = null;
els.stage.addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('no-video')) return;
  const btn = e.target.closest('button');
  if (btn && btn.dataset.act === 'preview') { state.showOwnPreview = true; return renderStage(); }
  if (btn && btn.dataset.act === 'full') return toggleFullscreen(tile);
  if (btn && btn.dataset.act === 'fschat') {
    if (document.fullscreenElement) { settings.fsChat = !settings.fsChat; saveSettings(); return placeFsChat(); }
    return setCallChatMin(!settings.callChatMin); // fora da tela cheia: mostra/esconde o chat ao lado
  }
  if (btn && btn.dataset.act === 'focus') return setFocus(state.focusedTile === tile.dataset.key ? null : tile.dataset.key);
  if (btn || e.target.closest('.vol-ctl')) return;
  // clique simples amplia; duplo clique é tela cheia (espera um pouco para saber qual foi)
  clearTimeout(clickTimer);
  if (e.detail > 1) return;
  clickTimer = setTimeout(() => {
    if (document.fullscreenElement) return;
    setFocus(state.focusedTile === tile.dataset.key ? null : tile.dataset.key);
  }, 230);
});
els.stage.addEventListener('dblclick', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('no-video') || e.target.closest('button, .vol-ctl')) return;
  clearTimeout(clickTimer);
  toggleFullscreen(tile);
});
document.addEventListener('fullscreenchange', () => {
  els.stage.classList.toggle('has-fullscreen', !!document.fullscreenElement);
  placeFsChat();
  // em tela cheia o botão vira "sair da tela cheia" (e o de ampliar some, não faz sentido lá)
  for (const b of els.stage.querySelectorAll('[data-act="full"]')) {
    const on = document.fullscreenElement && document.fullscreenElement.contains(b);
    b.innerHTML = on ? lu('minimize') : I.expand;
    b.title = on ? 'Sair da tela cheia (Esc)' : 'Tela cheia';
  }
  if (!document.fullscreenElement) renderStage(); // aplica reordenações que ficaram esperando
  else { const t = [...tiles.values()].find((x) => x.el === document.fullscreenElement); if (t && t.cover) renderStage(); }
});

// ---------- janela de compartilhar tela (qualidade + tela/janela no app) ----------
async function pickScreen() {
  let sources = null;
  if (desk) {
    try { sources = await desk.getSources(); } catch (e) { toast('Não consegui listar as telas: ' + e.message); return null; }
  }
  return new Promise((resolve) => {
    let tab = 'screen';
    let chosen = null;
    let quality = SCREEN_PRESETS[settings.screenQuality] ? settings.screenQuality : '720p60';
    let done = false;
    const body = [];
    const grid = h('div', { class: 'picker-grid' });
    const tabs = h('div', { class: 'picker-tabs' });
    const audio = h('input', { type: 'checkbox' });
    const qbox = h('div', { class: 'quality-grid' });
    const drawQuality = () => qbox.replaceChildren(...Object.entries(SCREEN_PRESETS).map(([k, q]) =>
      h('button', { type: 'button', class: 'quality-opt' + (k === quality ? ' on' : ''), onclick: () => { quality = k; drawQuality(); } },
        h('b', { text: q.label }), h('span', { text: q.desc }))));
    const draw = () => {
      if (!sources) return;
      tabs.replaceChildren(...[['screen', 'Telas'], ['window', 'Janelas']].map(([k, label]) =>
        h('button', { type: 'button', class: tab === k ? 'on' : '', text: label, onclick: () => { tab = k; draw(); } })));
      grid.replaceChildren(...sources.filter((x) => x.type === tab).map((x) =>
        h('button', { type: 'button', class: 'picker-item' + (chosen === x.id ? ' on' : ''), onclick: () => { chosen = x.id; draw(); }, ondblclick: () => { chosen = x.id; go(); } },
          h('img', { src: x.thumbnail, alt: '' }), h('span', { text: x.name }))));
    };
    if (sources) body.push(tabs, grid, h('label', { class: 'check-row' }, audio, h('span', { text: 'Compartilhar o áudio do PC (use fone, senão os outros podem ouvir eco)' })));
    else body.push(h('p', { text: 'Escolha a qualidade. Em seguida o navegador vai perguntar qual tela, janela ou aba compartilhar (marque "Compartilhar áudio" lá se quiser som).' }));
    body.push(h('h3', { class: 'picker-sub', text: 'Qualidade' }), qbox,
      h('p', { class: 'picker-hint', text: 'Cada pessoa assistindo recebe a transmissão direto do seu PC: com muita gente, prefira uma qualidade menor.' }));
    function go() {
      if (sources && !chosen) { toast('Escolha uma tela ou janela.'); return false; }
      done = true;
      settings.screenQuality = quality;
      saveSettings();
      m.close();
      if (sources) desk.selectSource(chosen, audio.checked).then(() => resolve({ audio: audio.checked, quality, surface: String(chosen).startsWith('screen') ? 'monitor' : 'window' }));
      else resolve({ audio: true, quality });
      return false;
    }
    const m = modal({
      title: 'Compartilhar tela', cardClass: 'picker-card', body,
      buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: sources ? 'Transmitir' : 'Escolher tela', cls: 'primary', fn: go }],
    });
    const chk = setInterval(() => { if (!m.el.isConnected) { clearInterval(chk); if (!done) resolve(null); } }, 200);
    drawQuality();
    draw();
  });
}

// =====================================================================
// configurações
// =====================================================================
// ---------- novidades (notas da atualização) ----------
async function loadChangelog() {
  try { return await (await fetch('/novidades.json', { cache: 'no-store' })).json(); } catch { return []; }
}
async function showChangelog(onlyNew) {
  const list = await loadChangelog();
  if (!list.length) return onlyNew ? null : toast('Sem notas de atualização neste servidor.');
  const latest = list[0].version;
  if (onlyNew) {
    if (settings.seenVersion === latest) return;
    settings.seenVersion = latest;
    saveSettings();
  }
  const card = (v, open) => h('details', { class: 'cl-version', open: open || null },
    h('summary', {}, h('b', { text: v.title || 'Versão ' + v.version }), h('span', { class: 'cl-meta', text: `${v.version}${v.date ? ' · ' + v.date : ''}` })),
    h('ul', {}, ...v.items.map((t) => h('li', { text: t }))));
  modal({
    title: 'Novidades do Concord', desc: onlyNew ? 'O Concord foi atualizado. Veja o que mudou:' : 'O que mudou em cada versão.',
    body: [h('div', { class: 'cl-list' }, ...list.map((v, i) => card(v, i === 0)))],
    buttons: [{ label: 'Legal!', cls: 'primary' }], cardClass: 'cl-card',
  });
}

// versão do app (exe) e do servidor em que você está
async function showVersions(el) {
  let server = '?';
  try { server = (await (await fetch('/atualizacao', { cache: 'no-store' })).json()).version; } catch { /* servidor antigo */ }
  let app = null;
  if (desk && desk.version) { try { app = await desk.version(); } catch { /* ignora */ } }
  el.replaceChildren(h('b', { text: 'Concord' }), h('span', { text: app ? `App ${app}` : 'No navegador' }), h('span', { text: `Servidor ${server}` }));
  if (desk && desk.checkUpdate) el.append(h('button', { class: 'ver-check', text: 'Procurar atualizações', onclick: async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Procurando…';
    const r = await desk.checkUpdate().catch(() => ({ status: 'error' }));
    b.disabled = false; b.textContent = 'Procurar atualizações';
    const msg = { latest: 'Você já está na última versão.', 'no-source': 'A atualização pela internet ainda não foi configurada (veja o LEIA-ME).', dev: 'Rodando pelo npm start: as atualizações chegam pelos arquivos do projeto.',
      older: 'A versão publicada é mais antiga que a sua.', later: 'Ok, fica para depois.', busy: 'Já tem uma atualização em andamento.' }[r.status];
    if (msg) toast(msg);
  } }));
  if (app && server !== '?' && app !== server) el.append(h('small', { text: String(app).split('.').map((x) => x.padStart(4, '0')).join('.') < String(server).split('.').map((x) => x.padStart(4, '0')).join('.') ? 'Tem atualização: reabra o app para receber.' : 'O servidor está numa versão mais antiga.' }));
}
function openSettings(section = 'conta') {
  const root = h('div', { class: 'settings' });
  const content = h('div', { class: 'settings-content' });
  const nav = h('div', { class: 'settings-nav' });
  let testStream = null;
  let stopTests = () => { if (testStream) { testStream.getTracks().forEach((t) => t.stop()); testStream = null; } if (meterTimer) clearInterval(meterTimer); };
  let meterTimer = null;
  const items = [['conta', 'Minha conta'], ['perfil', 'Meu perfil'], ['atividade', 'Atividade'], ['aparencia', 'Aparência'], ['voz', 'Voz e vídeo'], ['notificacoes', 'Notificações'], ['atalhos', 'Atalhos do teclado'], ['sobreposicao', 'Sobreposição no jogo']];
  const show = (s) => {
    stopTests();
    section = s;
    $$('button[data-s]', nav).forEach((b) => b.classList.toggle('on', b.dataset.s === s));
    content.replaceChildren(h('div', {}, ...({ conta: accountSection, perfil: profileSection, atividade: activitySection, aparencia: appearanceSection, voz: voiceSection, notificacoes: notifySection, atalhos: shortcutsSection, sobreposicao: overlaySection }[s])()));
    content.append(h('button', { class: 'settings-close', onclick: close, html: `<span class="x">${I.x}</span>ESC` }));
  };
  const verBox = h('div', { class: 'version-box', text: 'Versão…' });
  showVersions(verBox);
  nav.append(h('div', {}, h('div', { class: 'nav-title', text: 'Configurações' }),
    ...items.map(([k, label]) => h('button', { 'data-s': k, text: label, onclick: () => show(k) })),
    h('div', { class: 'sep' }),
    h('button', { text: 'Novidades', onclick: () => showChangelog(false) }),
    h('button', { text: 'Reportar um bug', onclick: () => bugModal() }),
    verBox));
  const onKey = (e) => { if (e.key === 'Escape' && !els.modalRoot.children.length) { e.stopPropagation(); close(); } };
  function close() { stopTests(); root.remove(); document.removeEventListener('keydown', onKey, true); }
  document.addEventListener('keydown', onKey, true);
  root.append(nav, content);
  document.body.append(root);
  show(section);

  // ----- conta -----
  function accountSection() {
    const cur = h('input', { type: 'password', class: 'text-input', autocomplete: 'current-password', placeholder: 'Senha atual' });
    const nova = h('input', { type: 'password', class: 'text-input', autocomplete: 'new-password', placeholder: 'Nova senha (mínimo 6 caracteres)' });
    const nova2 = h('input', { type: 'password', class: 'text-input', autocomplete: 'new-password', placeholder: 'Confirmar nova senha' });
    const msg = h('div', { class: 'form-msg' });
    const btn = h('button', { class: 'primary', text: 'Trocar senha' });
    const say = (text, ok) => { msg.textContent = text; msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
    btn.addEventListener('click', () => {
      if (!cur.value) return say('Digite a senha atual.');
      if (nova.value.length < 6) return say('A nova senha precisa ter pelo menos 6 caracteres.');
      if (nova.value !== nova2.value) return say('A confirmação não bate com a nova senha.');
      btn.disabled = true;
      state.onPasswordResult = (r) => {
        btn.disabled = false;
        say(r.message, r.ok);
        if (r.ok) { cur.value = ''; nova.value = ''; nova2.value = ''; }
      };
      send({ type: 'change-password', oldPassword: cur.value, newPassword: nova.value });
    });
    const logout = h('button', { class: 'danger-btn', text: 'Sair da conta', onclick: () => {
      modal({
        title: 'Sair da conta', desc: 'Você vai precisar do usuário e da senha para entrar de novo neste aparelho.',
        buttons: [{ label: 'Cancelar', cls: 'link-btn' }, { label: 'Sair', cls: 'danger-btn', fn: () => {
          state.loggingOut = true;
          if (voice.active) leaveVoice();
          send({ type: 'logout' });
          setTimeout(() => { unstore('dl-session'); location.reload(); }, 1500);
        } }],
      });
    } });
    return [h('h2', { text: 'Minha conta' }),
      h('div', { class: 'account-card' }, avatar(state.me), h('div', {},
        h('div', { class: 'ac-name', text: state.me.name }), h('div', { class: 'ac-user', text: '@' + (state.username || '') }))),
      h('h3', { text: 'Trocar senha' }),
      h('div', { class: 'pw-form' }, cur, nova, nova2, msg, btn),
      h('div', { class: 'sep-line' }),
      h('h3', { text: 'Sair', style: { marginTop: '0' } }),
      h('p', { class: 'sr-desc', style: { color: 'var(--text-muted)', marginTop: '0' }, text: 'Desconecta esta conta deste aparelho.' }), logout];
  }

  // ----- atividade -----
  function activitySection() {
    const kind = h('select', { class: 'select act-kind' }, ...[['jogando', 'Jogando'], ['ouvindo', 'Ouvindo'], ['assistindo', 'Assistindo'], ['status', 'Status livre']]
      .map(([v, l]) => h('option', { value: v, text: l })));
    const text = h('input', { class: 'text-input', maxlength: 60, placeholder: 'ex.: Minecraft, estudando, de boa…' });
    if (settings.activity) { kind.value = settings.activity.kind; text.value = settings.activity.name; }
    const now = h('div', { class: 'sr-desc' });
    const drawNow = () => { const a = currentActivity(); now.textContent = a ? 'Aparecendo agora: ' + actText(a) : 'Nada aparecendo agora.'; };
    drawNow();
    const saveAct = () => { settings.activity = text.value.trim() ? { kind: kind.value, name: text.value.trim() } : null; saveSettings(); sendActivity(); drawNow(); toast('Atividade atualizada.'); };
    const out = [h('h2', { text: 'Atividade' }),
      h('p', { class: 'sr-desc', text: 'O que aparece embaixo do seu nome para a galera (lista de membros, perfil e chamada).' }),
      h('h3', { text: 'Status manual' }), h('div', { class: 'act-row' }, kind, text),
      h('div', { class: 'btn-row' }, h('button', { class: 'primary', text: 'Salvar', onclick: saveAct }), h('button', { class: 'link-btn', text: 'Limpar', onclick: () => { text.value = ''; saveAct(); } })), now];
    out.push(h('div', { class: 'sep-line' }), h('h3', { text: 'Jogo detectado automaticamente', style: { marginTop: '0' } }));
    if (!desk || !desk.onGame) {
      out.push(h('p', { class: 'sr-desc', text: 'Só funciona no app (.exe): o navegador não consegue ver quais programas estão abertos. Aqui, use o status manual.' }));
      return out;
    }
    const auto = h('button', { class: 'switch' + (settings.autoGame ? ' on' : ''), onclick: () => { settings.autoGame = !settings.autoGame; auto.classList.toggle('on', settings.autoGame); saveSettings(); sendActivity(); drawNow(); } });
    out.push(h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'sr-title', text: 'Mostrar o jogo que estou jogando' }),
      h('div', { class: 'sr-desc', text: state.detectedGame ? `Detectado agora: ${state.detectedGame}` : 'Nenhum jogo conhecido aberto agora. Enquanto um jogo estiver aberto, ele substitui o status manual.' })), auto));
    const listBox = h('div', { class: 'member-table' });
    const exe = h('input', { class: 'text-input', placeholder: 'Programa (ex.: MeuJogo.exe)' });
    const nm = h('input', { class: 'text-input', placeholder: 'Nome que aparece (ex.: Meu Jogo)' });
    const drawList = () => listBox.replaceChildren(...(settings.customGames.length ? settings.customGames.map((gm, i) => h('div', { class: 'mt-row' },
      h('code', { class: 'inv-code', text: gm.exe }), h('div', { class: 'mt-info' }, h('div', { class: 'sr-title', text: gm.name })),
      h('button', { class: 'danger-btn', text: 'Tirar', onclick: () => { settings.customGames.splice(i, 1); saveSettings(); desk.setCustomGames(settings.customGames); drawList(); } }))) : [h('p', { class: 'sr-desc', text: 'Nenhum jogo personalizado.' })]));
    drawList();
    out.push(h('h3', { text: 'Meus jogos' }),
      h('p', { class: 'sr-desc', text: 'O app já reconhece os jogos mais populares. Se o seu não aparece, adicione o nome do programa (veja no Gerenciador de Tarefas → Detalhes).' }),
      h('div', { class: 'act-row' }, exe, nm, h('button', { class: 'primary', text: 'Adicionar', onclick: () => {
        const e = exe.value.trim().toLowerCase();
        if (!e || !nm.value.trim()) return toast('Preencha o programa e o nome.');
        settings.customGames.push({ exe: e.endsWith('.exe') ? e : e + '.exe', name: nm.value.trim().slice(0, 60) });
        saveSettings(); desk.setCustomGames(settings.customGames); exe.value = ''; nm.value = ''; drawList();
      } })), listBox);
    return out;
  }

  // ----- perfil -----
  function profileSection() {
    const draft = { name: state.me.name, color: state.me.color, avatar: state.me.avatar };
    const preview = h('div', { class: 'profile-preview' });
    const drawPreview = () => preview.replaceChildren(h('div', { class: 'pc-banner', style: { height: '60px', background: draft.color } }),
      avatar(draft, { cls: 'pc-avatar', presence: true }),
      h('div', { class: 'pc-body' }, h('div', { class: 'pc-name', text: draft.name || '…' }), h('div', { class: 'pc-sub', text: 'Online' })));
    preview.classList.add('profile-card');
    drawPreview();
    const name = h('input', { class: 'text-input', maxlength: 32, value: draft.name });
    name.addEventListener('input', () => { draft.name = name.value; drawPreview(); });
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      try {
        draft.avatar = (await uploadFile(await squareImage(f))).url;
        drawPreview();
      } catch (e) { toast('Falha ao enviar o avatar: ' + e.message); }
    });
    const colors = ['#5865F2', '#3BA55C', '#FAA61A', '#EB459E', '#ED4245', '#00A8FC', '#9B59B6', '#E67E22', '#1ABC9C', '#F47FFF', '#747F8D'];
    const sw = h('div', { class: 'swatches' });
    const drawSw = () => {
      const custom = h('input', { type: 'color', value: draft.color });
      custom.addEventListener('input', () => { draft.color = custom.value; drawPreview(); });
      custom.addEventListener('change', drawSw);
      sw.replaceChildren(...colors.map((c) => h('button', { type: 'button', class: 'swatch' + (draft.color.toLowerCase() === c.toLowerCase() ? ' on' : ''), style: { background: c },
        onclick: () => { draft.color = c; drawSw(); drawPreview(); } })),
      h('label', { class: 'swatch custom' + (colors.some((c) => c.toLowerCase() === draft.color.toLowerCase()) ? '' : ' on'), title: 'Cor personalizada' }, custom));
    };
    drawSw();
    const saveBtn = h('button', { class: 'primary', text: 'Salvar alterações', onclick: () => {
      const n = name.value.trim();
      if (!n) return toast('O nome não pode ficar vazio.');
      send({ type: 'profile', name: n, color: draft.color, avatar: draft.avatar });
      toast('Perfil salvo!');
    } });
    return [h('h2', { text: 'Meu perfil' }), h('div', { class: 'profile-edit' },
      h('div', { class: 'fields' },
        h('h3', { text: 'Nome de exibição' }), name,
        h('h3', { text: 'Avatar' }),
        h('div', { class: 'btn-row' }, h('button', { class: 'primary', text: 'Trocar avatar', onclick: () => file.click() }),
          h('button', { class: 'link-btn', text: 'Remover avatar', onclick: () => { draft.avatar = null; drawPreview(); } }), file),
        h('h3', { text: 'Cor do perfil' }), sw,
        h('div', { class: 'sep-line' }), saveBtn),
      h('div', {}, h('h3', { text: 'Prévia', style: { marginTop: '0' } }), preview))];
  }

  // ----- aparência -----
  function appearanceSection() {
    const themes = [['concord', 'Concord', '#171a2b', '#0b0d17'], ['escuro', 'Escuro', '#313338', '#1e1f22'], ['claro', 'Claro', '#ffffff', '#e3e5e8'], ['meia-noite', 'Meia-noite', '#000000', '#18191c'],
      ['ardosia', 'Ardósia', '#2a2f3b', '#1a1d24'], ['floresta', 'Floresta', '#212d27', '#141c18'], ['rosa', 'Rosa', '#fff6fa', '#f4c4d8']];
    const box = h('div', { class: 'themes' });
    const drawThemes = () => box.replaceChildren(...themes.map(([k, label, a, b]) => h('button', { class: 'theme-card' + (settings.theme === k ? ' on' : ''),
      onclick: () => {
        settings.theme = k;
        // o tema rosa combina com destaque rosa (só troca se ainda estiver no azul padrão)
        if (k === 'rosa' && settings.accent === '#5865f2') { settings.accent = '#eb459e'; drawAccents(); }
        saveSettings(); applyTheme(); drawThemes();
      } },
    h('span', { class: 'tc-swatch', style: { background: a, '--half': b } }), h('span', { text: label }))));
    drawThemes();
    const accents = ['#5865f2', '#3ba55c', '#eb459e', '#ed4245', '#faa61a', '#00a8fc', '#9b59b6', '#1abc9c', '#e67e22', '#ff6b81'];
    const sw = h('div', { class: 'swatches' });
    const drawAccents = () => {
      const custom = h('input', { type: 'color', value: settings.accent });
      custom.addEventListener('input', () => { settings.accent = custom.value; applyTheme(); });
      custom.addEventListener('change', () => { saveSettings(); drawAccents(); });
      sw.replaceChildren(...accents.map((c) => h('button', { class: 'swatch' + (settings.accent === c ? ' on' : ''), style: { background: c },
        onclick: () => { settings.accent = c; saveSettings(); applyTheme(); drawAccents(); } })),
      h('label', { class: 'swatch custom' + (accents.includes(settings.accent) ? '' : ' on'), title: 'Cor personalizada' }, custom));
    };
    drawAccents();
    const size = h('input', { type: 'range', class: 'range', min: 12, max: 20, step: 1, value: settings.fontSize });
    const sizeVal = h('span', { text: settings.fontSize + 'px' });
    size.addEventListener('input', () => { settings.fontSize = Number(size.value); sizeVal.textContent = size.value + 'px'; applyTheme(); });
    size.addEventListener('change', saveSettings);
    const sample = { id: 'x', uid: state.me.id, name: state.me.name, color: state.me.color, avatar: state.me.avatar, ts: Date.now(),
      text: 'Olha só como fica o **novo tema**! @todos', reactions: {} };
    return [h('h2', { text: 'Aparência' }),
      h('div', { class: 'preview-box', style: { maxHeight: 'none', fontSize: 'var(--font-size)' } }, buildWrap(sample, null, { preview: true })),
      h('h3', { text: 'Tema' }), box,
      h('h3', { text: 'Cor de destaque' }), sw,
      h('h3', {}, 'Tamanho da fonte do chat: ', sizeVal), size, h('div', { class: 'range-labels' }, h('span', { text: '12px' }), h('span', { text: '20px' }))];
  }

  // ----- voz e vídeo -----
  function voiceSection() {
    const mic = h('select', { class: 'select' });
    const spk = h('select', { class: 'select' });
    const cam = h('select', { class: 'select' });
    const meter = h('i');
    const camBox = h('div', { class: 'cam-preview', text: 'Câmera desligada' });
    const fill = async () => {
      let devs = [];
      try { devs = await navigator.mediaDevices.enumerateDevices(); } catch { /* sem acesso */ }
      const opts = (sel, kind, cur) => {
        sel.replaceChildren(h('option', { value: '', text: 'Padrão do sistema' }),
          ...devs.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'default').map((d, i) => h('option', { value: d.deviceId, text: d.label || `${kind} ${i + 1}` })));
        sel.value = cur || '';
      };
      opts(mic, 'audioinput', settings.mic);
      opts(spk, 'audiooutput', settings.speaker);
      opts(cam, 'videoinput', settings.cam);
    };
    fill();
    mic.addEventListener('change', () => { settings.mic = mic.value; saveSettings(); voice.setMicDevice(mic.value); });
    spk.addEventListener('change', () => {
      settings.speaker = spk.value; saveSettings();
      voice.setOutput(spk.value);
      if (testOut && testOut.setSinkId) testOut.setSinkId(spk.value || '').catch(() => {});
    });
    cam.addEventListener('change', () => { settings.cam = cam.value; voice.devices.cam = cam.value; saveSettings(); });
    const testCam = h('button', { class: 'secondary', text: 'Testar câmera', onclick: async () => {
      stopTests();
      try {
        testStream = await navigator.mediaDevices.getUserMedia({ video: settings.cam ? { deviceId: { exact: settings.cam } } : true });
        fill();
        const v = h('video', { autoplay: true, playsinline: true });
        v.muted = true;
        v.srcObject = testStream;
        camBox.replaceChildren(v);
      } catch (e) { toast('Não consegui abrir a câmera: ' + e.name); }
    } });
    // ----- eliminador de ruído e sensibilidade -----
    const noiseSel = h('select', { class: 'select' },
      h('option', { value: 'forte', text: 'Forte (recomendado): filtros + supressão do navegador' }),
      h('option', { value: 'padrao', text: 'Padrão: só a supressão do navegador' }),
      h('option', { value: 'off', text: 'Desligado (som "cru", para música/instrumento)' }));
    noiseSel.value = settings.noise;
    const gateSel = h('div', { class: 'seg' }, ...[['auto', 'Automática'], ['manual', 'Manual'], ['off', 'Desligada']].map(([v, l]) =>
      h('button', { type: 'button', class: settings.gate === v ? 'on' : '', 'data-v': v, text: l })));
    const gateRange = h('input', { type: 'range', class: 'range', min: -80, max: -20, step: 1, value: settings.gateDb });
    const gateVal = h('span', { text: settings.gateDb + ' dB' });
    const gateRow = h('div', { class: 'gate-manual' }, h('div', { class: 'range-labels' }, h('span', { text: 'mais sensível' }), gateVal, h('span', { text: 'menos sensível' })), gateRange);
    const lvl = h('i', { class: 'lvl' });
    const thr = h('i', { class: 'thr' });
    const gateMeter = h('div', { class: 'gate-meter' }, lvl, thr);
    const gateHint = h('div', { class: 'sr-desc' });
    const applyNoise = () => {
      saveSettings();
      voice.setNoise({ noise: settings.noise, gate: settings.gate, gateDb: settings.gateDb });
      if (testProc) testProc.setGate(settings.gate, settings.gateDb);
      gateRow.hidden = settings.gate !== 'manual';
      $$('button', gateSel).forEach((b) => b.classList.toggle('on', b.dataset.v === settings.gate));
    };
    noiseSel.addEventListener('change', () => { settings.noise = noiseSel.value; applyNoise(); if (testProc) startMicTest(); });
    gateSel.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings.gate = b.dataset.v; applyNoise(); });
    gateRange.addEventListener('input', () => { settings.gateDb = Number(gateRange.value); gateVal.textContent = gateRange.value + ' dB'; applyNoise(); });
    gateRow.hidden = settings.gate !== 'manual';
    let testProc = null;
    let testCtx = null;
    const pct = (db) => Math.max(0, Math.min(100, ((db + 90) / 80) * 100));
    const gateTimer = setInterval(() => {
      if (!root.isConnected) { clearInterval(gateTimer); return; }
      const p = testProc || voice.proc;
      if (!p) { gateHint.textContent = 'Clique em "Testar microfone" (ou entre numa chamada) para ver o nível e o corte da porta de ruído.'; lvl.style.width = '0'; return; }
      lvl.style.width = pct(p.level) + '%';
      thr.style.left = pct(p.threshold) + '%';
      thr.hidden = settings.gate === 'off';
      gateMeter.classList.toggle('open', p.open);
      gateHint.textContent = settings.gate === 'off' ? 'Porta de ruído desligada: tudo o que o microfone capta é enviado.' : p.open ? 'Passando voz' : 'Silêncio: o microfone está cortado (ruído de fundo não vai)';
      gateHint.classList.toggle('gate-open', settings.gate !== 'off' && p.open);
      gateHint.classList.toggle('gate-closed', settings.gate !== 'off' && !p.open);
    }, 60);
    const oldStop = stopTests;
    let testMic = null;
    let testOut = null; // <audio> que toca a sua voz de volta
    const setTestBtn = (on) => { testMic.innerHTML = lu(on ? 'square' : 'mic') + `<span>${on ? 'Parar teste' : 'Testar microfone'}</span>`; testMic.classList.toggle('testing', on); };
    stopTests = () => {
      oldStop();
      if (testOut) { testOut.pause(); testOut.srcObject = null; testOut = null; }
      if (testProc) { testProc.stop(); testProc = null; }
      if (testCtx) { testCtx.close().catch(() => {}); testCtx = null; }
      if (testMic) setTestBtn(false);
      meter.style.width = '0';
    };
    const startMicTest = async () => {
      stopTests();
      setTestBtn(true);
      try {
        const n = settings.noise;
        testStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, autoGainControl: true, noiseSuppression: n !== 'off', ...(settings.mic ? { deviceId: { exact: settings.mic } } : {}) } });
        fill();
        testCtx = new AudioContext();
        testProc = new MicProcessor(testCtx, testStream, { noise: n, gate: settings.gate, gateDb: settings.gateDb });
        const an = testCtx.createAnalyser();
        testCtx.createMediaStreamSource(testProc.stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        meterTimer = setInterval(() => {
          if (!testStream) return;
          an.getFloatTimeDomainData(buf);
          let sm = 0; for (const v of buf) sm += v * v;
          meter.style.width = Math.min(100, Math.sqrt(sm / buf.length) * 400) + '%';
        }, 60);
        // toca a sua voz (já com o eliminador de ruído) na saída escolhida, para você se ouvir
        testOut = new Audio();
        testOut.srcObject = testProc.stream;
        if (testOut.setSinkId && settings.speaker) await testOut.setSinkId(settings.speaker).catch(() => {});
        await testOut.play().catch(() => {});
        if (voice.active) toast('Você está numa chamada: o pessoal não ouve o teste, só você.');
      } catch (e) { stopTests(); toast('Não consegui abrir o microfone: ' + (e.name === 'NotAllowedError' ? 'permissão negada.' : e.name === 'NotFoundError' ? 'nenhum microfone encontrado.' : e.name)); }
    };
    testMic = h('button', { class: 'secondary mic-test-btn', onclick: () => (testProc ? stopTests() : startMicTest()) });
    setTestBtn(false);
    return [h('h2', { text: 'Voz e vídeo' }),
      h('h3', { text: 'Microfone' }), mic, h('div', { class: 'btn-row' }, testMic, h('span', { class: 'sr-desc', text: 'Fale e você vai se ouvir (use fone para não dar eco). Nível depois do eliminador de ruído:' })), h('div', { class: 'mic-meter' }, meter),
      h('h3', { text: 'Eliminador de ruído' }), noiseSel,
      h('h3', { text: 'Sensibilidade do microfone (porta de ruído)' }),
      h('p', { class: 'sr-desc', text: 'Corta o microfone quando você não está falando, para teclado, ventilador e barulho de fundo não chegarem na galera.' }),
      gateSel, gateRow, gateMeter, gateHint,
      h('h3', { text: 'Saída de áudio' }), spk,
      h('h3', { text: 'Câmera' }), cam, h('div', { class: 'btn-row' }, testCam), camBox];
  }

  // ----- notificações -----
  function notifySection() {
    const sw = (key, title, desc, after) => {
      const s = h('button', { class: 'switch' + (settings[key] ? ' on' : ''), onclick: async () => {
        settings[key] = !settings[key];
        if (after) await after(settings[key]);
        s.classList.toggle('on', settings[key]);
        saveSettings();
      } });
      return h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'sr-title', text: title }), h('div', { class: 'sr-desc', text: desc })), s);
    };
    const mode = h('select', { class: 'select' },
      h('option', { value: 'all', text: 'Todas as mensagens' }), h('option', { value: 'mentions', text: 'Só quando me mencionarem ou responderem' }), h('option', { value: 'none', text: 'Nada' }));
    mode.value = settings.notifyMode;
    mode.addEventListener('change', () => { settings.notifyMode = mode.value; saveSettings(); });
    return [h('h2', { text: 'Notificações' }),
      h('h3', { text: 'Avisar quando chegar' }), mode,
      h('p', { class: 'sr-desc', text: 'Isto é o padrão. Cada servidor e cada sala pode ter a sua: clique com o botão direito no servidor ou na sala → Notificações. Lá também dá para silenciar e ignorar @todos.' }),
      sw('popups', 'Popup de mensagem', 'Mostra um aviso no canto da tela quando chega mensagem em outra sala.'),
      sw('sound', 'Som de mensagem', 'Toca um som curto quando chega mensagem.'),
      sw('serverSounds', 'Sons personalizados dos servidores', 'Usa os sons que o servidor escolheu (entrar e sair da chamada, mensagem, live). Desligado, toca sempre os sons padrão.'),
      sw('voiceNotify', 'Avisar quando alguém entrar em chamada', 'Mostra um aviso, com botão para entrar junto, quando alguém entra numa sala de voz em que você não está.'),
      sw('systemNotify', 'Notificações do Windows', 'Mostra a notificação do sistema quando o app está minimizado ou em segundo plano.', async (on) => {
        if (on && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      }),
      h('div', { class: 'test-row' }, h('button', { class: 'secondary', text: 'Testar notificação', onclick: (e) => {
        const b = e.currentTarget;
        if (!settings.systemNotify) return toast('Ligue "Notificações do Windows" primeiro.');
        b.disabled = true; b.textContent = 'Minimize o app… chega em 5 s';
        setTimeout(() => { sysNotify('Concord', 'É assim que as notificações aparecem quando o app está em segundo plano.', null, 'teste'); b.disabled = false; b.textContent = 'Testar notificação'; }, 5000);
      } }), h('span', { class: 'sr-desc', text: desk && !desk.notify ? 'Este app é de uma versão antiga: gere o exe novo para as notificações do Windows funcionarem.' : 'Se não aparecer nada, veja se as notificações do Concord estão ligadas em Configurações do Windows → Sistema → Notificações.' }))];
  }

  // ----- sobreposição -----
  function overlaySection() {
    const o = settings.overlay = { enabled: true, pos: 'top-left', showMsgs: true, scale: 1, ...(settings.overlay || {}) };
    const save = () => { saveSettings(); overlaySig = ''; updateOverlay(); };
    const toggle = (key, label, desc) => {
      const b = h('button', { class: 'switch' + (o[key] ? ' on' : ''), onclick: () => { o[key] = !o[key]; b.classList.toggle('on', o[key]); save(); } });
      return h('div', { class: 'setting-row' }, h('div', {}, h('div', { class: 'sr-title', text: label }), h('div', { class: 'sr-desc', text: desc })), b);
    };
    const pos = h('select', { class: 'select' }, ...[['custom', 'Personalizada (arrastando)'], ['top-left', 'Canto de cima à esquerda'], ['top-right', 'Canto de cima à direita'], ['bottom-left', 'Canto de baixo à esquerda'], ['bottom-right', 'Canto de baixo à direita']].map(([v, l]) => h('option', { value: v, text: l })));
    pos.value = o.pos;
    pos.addEventListener('change', () => { o.pos = pos.value; save(); });
    const size = h('select', { class: 'select' }, ...[[0.8, 'Pequeno'], [1, 'Normal'], [1.2, 'Grande']].map(([v, l]) => h('option', { value: v, text: l })));
    size.value = String(o.scale);
    size.addEventListener('change', () => { o.scale = Number(size.value); save(); });
    if (!desk || !desk.overlay) return [h('h2', { text: 'Sobreposição no jogo' }), h('p', { class: 'sr-desc', text: 'Só existe no app (.exe), não funciona no navegador. Se você já usa o app, gere o exe novo.' })];
    return [h('h2', { text: 'Sobreposição no jogo' }),
      h('p', { class: 'sr-desc', text: 'Enquanto você está numa chamada e usa outro programa (o jogo), aparece no canto da tela quem está na chamada, quem está falando e as mensagens que chegam no chat da chamada. Some sozinha quando você volta para o Concord.' }),
      toggle('enabled', 'Mostrar a sobreposição', 'Lista da chamada por cima do jogo.'),
      toggle('showMsgs', 'Mostrar mensagens do chat da chamada', 'Cada mensagem fica uns 12 segundos na tela.'),
      h('label', { text: 'Posição' }), h('div', { class: 'ov-pos-row' }, pos, desk.overlayEdit ? h('button', { class: 'secondary', text: 'Ajustar arrastando', onclick: () => { desk.overlayEdit(); toast('Arraste a sobreposição e clique em "Pronto, salvar posição".', 6000); } }) : null),
      h('label', { text: 'Tamanho' }), size,
      h('label', { text: 'Transparência' }), (() => {
        const val = h('span', { class: 'ov-op-val' });
        const r = h('input', { type: 'range', min: 20, max: 100, step: 5, class: 'range' });
        r.value = Math.round((o.opacity ?? 1) * 100);
        const show = () => { val.textContent = r.value + '% visível'; };
        show();
        r.addEventListener('input', () => { o.opacity = Number(r.value) / 100; show(); save(); });
        return h('div', { class: 'ov-op-row' }, r, val);
      })(),
      h('p', { class: 'sr-desc', text: `Atalho para esconder/mostrar: ${(settings.globalKeys.overlay || 'nenhum').replace('CommandOrControl', 'Ctrl')} (muda em Atalhos do teclado). Funciona com jogos em janela ou "tela cheia sem bordas"; em tela cheia exclusiva o Windows não deixa nada aparecer por cima do jogo.` })];
  }

  // ----- atalhos -----
  function shortcutsSection() {
    const rows = SHORTCUTS.map(([keys, what]) => h('div', { class: 'kb-row' }, h('span', { text: what }), h('span', { class: 'kb-keys' }, ...keys.split(' ou ').flatMap((k, i) => [i ? h('span', { class: 'kb-or', text: 'ou' }) : null, ...k.split('+').map((x) => h('kbd', { text: x }))]))));
    const globalRow = (name, label) => {
      const keyEl = h('span', { class: 'kb-keys' });
      const draw = () => keyEl.replaceChildren(...(settings.globalKeys[name] ? settings.globalKeys[name].split('+').map((x) => h('kbd', { text: x === 'CommandOrControl' ? 'Ctrl' : x })) : [h('span', { class: 'sr-desc', text: 'Nenhum' })]));
      draw();
      const rec = h('button', { class: 'secondary small-btn', text: 'Mudar' });
      rec.addEventListener('click', () => {
        rec.textContent = 'Aperte as teclas…';
        const onKey = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (e.key === 'Escape') { done(); return; }
          const acc = accelFromEvent(e, true);
          if (!acc) return; // só modificadores ainda
          settings.globalKeys = { ...settings.globalKeys, [name]: acc };
          saveSettings(); applyGlobalKeys(); done();
          if (typingKey(acc)) toast(`Atenção: com "${acc}" sozinha, enquanto você estiver em chamada essa tecla fica só para o atalho e não digita em outros programas (nem no chat do jogo). Teclas como F8, F9 ou as do teclado numérico são melhores.`, 9000);
        };
        const done = () => { document.removeEventListener('keydown', onKey, true); rec.textContent = 'Mudar'; draw(); };
        document.addEventListener('keydown', onKey, true);
      });
      const clear = h('button', { class: 'link-btn small-btn', text: 'Remover', onclick: () => { settings.globalKeys = { ...settings.globalKeys, [name]: '' }; saveSettings(); applyGlobalKeys(); draw(); } });
      return h('div', { class: 'kb-row' }, h('span', { text: label }), h('span', { class: 'kb-edit' }, keyEl, rec, clear));
    };
    return [h('h2', { text: 'Atalhos do teclado' }),
      h('h3', { text: 'Funcionam até com o jogo aberto' }),
      h('p', { class: 'sr-desc', text: desk && desk.setGlobalKeys ? 'Só valem enquanto você está numa chamada, para não atrapalhar outros programas.' : 'Atalhos globais só funcionam no app (.exe). No navegador eles valem só com o Concord aberto na frente.' }),
      globalRow('mute', 'Silenciar / ativar microfone'), globalRow('deafen', 'Silenciar / ativar fone'), globalRow('overlay', 'Esconder / mostrar a sobreposição'),
      h('h3', { text: 'Dentro do Concord' }), h('div', { class: 'kb-list' }, ...rows)];
  }
}
els.settingsBtn.addEventListener('click', () => openSettings());

// recorta a imagem do avatar em quadrado 256x256
async function squareImage(file) {
  if (file.type === 'image/gif' && file.size < 2 * 1024 * 1024) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
    return await new Promise((res) => c.toBlob((b) => res(new File([b], 'avatar.png', { type: 'image/png' })), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

// =====================================================================
// início
// =====================================================================
if (!window.isSecureContext) els.secureHint.hidden = false;

let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  const reg = mode === 'register';
  els.authTitle.textContent = reg ? 'Criar uma conta' : 'Boas-vindas de volta!';
  els.authSub.textContent = reg
    ? (legacy ? 'Agora o Concord tem contas. Crie a sua para manter seu perfil e suas mensagens.' : 'Escolha um usuário e uma senha para entrar.')
    : 'Que bom te ver de novo!';
  els.nameField.hidden = !reg;
  els.pass2Field.hidden = !reg;
  els.passInput.autocomplete = reg ? 'new-password' : 'current-password';
  els.authBtn.textContent = reg ? 'Criar conta' : 'Entrar';
  els.authSwitchText.textContent = reg ? 'Já tem uma conta?' : 'Precisa de uma conta?';
  els.authSwitch.textContent = reg ? 'Entrar' : 'Criar conta';
  els.authError.hidden = true;
  if (reg && !els.nameInput.value && legacy && legacy.name) els.nameInput.value = legacy.name;
}
function showAuth(error) {
  els.login.hidden = false;
  els.authBtn.disabled = false;
  els.authError.hidden = !error;
  if (error) els.authError.textContent = error;
  setTimeout(() => (els.userInput.value ? els.passInput : els.userInput).focus(), 0);
}
els.authSwitch.addEventListener('click', (e) => { e.preventDefault(); setAuthMode(authMode === 'login' ? 'register' : 'login'); });
els.userInput.addEventListener('input', () => {
  const v = els.userInput.value.toLowerCase().replace(/\s+/g, '_');
  if (v !== els.userInput.value) els.userInput.value = v;
});
els.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = els.userInput.value.trim().toLowerCase();
  const password = els.passInput.value;
  const err = (t) => { els.authError.textContent = t; els.authError.hidden = false; };
  if (!username) return err('Digite o nome de usuário.');
  if (!password) return err('Digite a senha.');
  if (authMode === 'register') {
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) return err('O usuário deve ter de 3 a 20 caracteres: letras minúsculas, números, _ ou ponto.');
    if (password.length < 6) return err('A senha precisa ter pelo menos 6 caracteres.');
    if (password !== els.pass2Input.value) return err('As senhas não são iguais.');
  }
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) { err('Ainda conectando ao servidor… tente de novo em um instante.'); return; }
  els.authError.hidden = true;
  els.authBtn.disabled = true;
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  state.justAuthed = true;
  const msg = { type: authMode, username, password };
  if (authMode === 'register') {
    Object.assign(msg, { name: els.nameInput.value.trim() || username });
    if (legacy) Object.assign(msg, { secret: legacy.secret, color: legacy.color, avatar: legacy.avatar });
  }
  send(msg);
});
setAuthMode(legacy && !state.session ? 'register' : 'login');
applyLayout();
connect();

window.addEventListener('beforeunload', () => { if (voice.active) send({ type: 'voice-leave' }); });
