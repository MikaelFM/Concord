'use strict';
// App desktop do Concord (Electron).
// Tela inicial: hospedar o servidor neste PC ou entrar no servidor de um amigo.
const { app, BrowserWindow, ipcMain, session, desktopCapturer, shell, Menu, net, dialog, powerMonitor, Notification, globalShortcut, screen } = require('electron');
const { execFile } = require('child_process');
const KNOWN_GAMES = require('./games');
const path = require('path');
const fs = require('fs');

// O nome mudou de "Discord Local" para "Concord", mas os dados (contas, mensagens, config)
// continuam na pasta antiga para ninguém perder nada.
app.setPath('userData', path.join(app.getPath('appData'), 'Discord Local'));
app.setAppUserModelId('Concord');
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let allowedHost = null; // servidor escolhido (aceitamos o certificado autoassinado dele)
let pendingSource = null; // { id, audio } escolhido no seletor de tela

const CONFIG = path.join(app.getPath('userData'), 'config.json');
const readConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; } };
const writeConfig = (c) => { try { fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2)); } catch { /* ignora */ } };

// Log de diagnóstico: na pasta do projeto (npm start) ou em %APPDATA%\Discord Local (exe; pasta antiga mantida).
const LOG = path.join(app.isPackaged ? app.getPath('userData') : path.join(__dirname, '..'), 'debug.log');
try { fs.writeFileSync(LOG, `--- ${new Date().toISOString()} Electron ${process.versions.electron}\n`); } catch { /* ignora */ }
function log(...a) {
  const line = `[${new Date().toISOString().slice(11, 23)}] ` + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n';
  try { fs.appendFileSync(LOG, line); } catch { /* ignora */ }
}
process.on('uncaughtException', (e) => log('MAIN ERRO', e && e.stack || String(e)));

function createWindow() {
  const cfg = readConfig();
  win = new BrowserWindow({
    width: cfg.width || 1280, height: cfg.height || 800, minWidth: 800, minHeight: 500,
    backgroundColor: '#0b0d17', title: 'Concord', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  if (process.platform === 'win32') {
    try { win.setAppDetails({ appId: 'Concord', appIconPath: taskbarIcon(), appIconIndex: 0 }); } catch { /* ok */ }
  }
  win.once('ready-to-show', () => { if (cfg.maximized) win.maximize(); win.show(); });
  win.on('close', () => {
    const b = win.getNormalBounds();
    writeConfig({ ...readConfig(), width: b.width, height: b.height, maximized: win.isMaximized() });
  });
  win.on('focus', () => { win.flashFrame(false); refreshOverlay(); });
  win.on('blur', () => refreshOverlay());
  win.on('closed', () => { if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy(); });
  win.on('minimize', () => refreshOverlay());

  // links externos abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) win.webContents.reload();
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) win.webContents.toggleDevTools();
  });
  win.webContents.on('console-message', (e, ...args) => {
    const d = e && typeof e.message === 'string' ? e : { level: args[0], message: args[1], lineNumber: args[2], sourceId: args[3] };
    log('PAGINA', d.level, d.message, (d.sourceId || '').split('/').pop() + ':' + d.lineNumber);
  });
  win.webContents.on('render-process-gone', (e, d) => log('RENDER CAIU', d));
  win.webContents.on('did-navigate', (e, url) => log('NAVEGOU', url));
  win.webContents.on('did-finish-load', () => { if (currentGame) win.webContents.send('game', currentGame); setTimeout(detectGame, 1500); });
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    log('FALHA AO CARREGAR', code, desc, url, isMain);
    if (!isMain || code === -3) return;
    goHome(`Não consegui conectar ao servidor do Concord (${desc}). Confira sua internet e tente de novo em instantes.`);
  });
  autoStart(cfg);
}

// Servidor oficial do Concord (fica em desktop/servidor.json e chega pelas atualizações).
function officialServer() {
  try {
    const a = String(JSON.parse(fs.readFileSync(path.join(__dirname, 'servidor.json'), 'utf8')).address || '').trim();
    return a ? normalizeAddress(a) : null;
  } catch { return null; }
}
function normalizeAddress(address) {
  let a = String(address || '').trim();
  if (!a) return null;
  if (!/^https?:\/\//i.test(a)) a = 'https://' + a;
  try {
    const u = new URL(a.replace(/^http:/i, 'https:'));
    if (!u.port && !/[a-z]/i.test(u.hostname.replace(/\./g, ''))) u.port = '3000'; // IP sem porta: 3000; domínio: 443
    return u.toString();
  } catch { return null; }
}

// Abre direto o servidor oficial. Se a pessoa escolheu outro endereço na tela de erro, usa esse.
function autoStart(cfg) {
  const custom = cfg.auto && cfg.auto.mode === 'join' && cfg.auto.custom && cfg.auto.url;
  const url = custom || officialServer() || (cfg.auto && cfg.auto.mode === 'join' && cfg.auto.url);
  if (!url) return goHome();
  log('entrada automática', url);
  openServer(url);
}

function goHome(error) {
  const q = error ? '?erro=' + encodeURIComponent(error) : '';
  win.loadFile(path.join(__dirname, 'launcher.html'), { search: q });
}

// downloads: salvam direto na pasta Downloads (sem perguntar) e avisam o app quando terminam
const downloaded = new Set();
function uniquePath(dir, name) {
  const clean = String(name || 'arquivo').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150) || 'arquivo';
  const ext = path.extname(clean);
  const base = clean.slice(0, clean.length - ext.length);
  let p = path.join(dir, clean);
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
}
function setupSession() {
  const ses = session.defaultSession;
  ses.on('will-download', (e, item) => {
    const dest = uniquePath(app.getPath('downloads'), item.getFilename());
    item.setSavePath(dest);
    const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };
    send('download', { state: 'started', name: path.basename(dest) });
    item.once('done', (ev, st) => {
      if (st === 'completed') downloaded.add(dest);
      log('download', st, dest);
      send('download', { state: st, name: path.basename(dest), path: st === 'completed' ? dest : null });
    });
  });
  // Aceita o certificado autoassinado só do servidor escolhido.
  ses.setCertificateVerifyProc((req, cb) => {
    const okHost = allowedHost && req.hostname === allowedHost;
    log('CERTIFICADO', req.hostname, okHost ? 'aceito' : 'padrão', req.verificationResult);
    cb(okHost ? 0 : -3);
  });
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'display-capture', 'notifications', 'fullscreen', 'clipboard-sanitized-write', 'clipboard-read'].includes(perm)));
  ses.setPermissionCheckHandler((wc, perm) => ['media', 'notifications', 'fullscreen', 'clipboard-sanitized-write', 'clipboard-read'].includes(perm));
  // Compartilhamento de tela: usa a tela/janela escolhida no seletor do app.
  ses.setDisplayMediaRequestHandler(async (req, cb) => {
    const pick = pendingSource;
    pendingSource = null;
    if (!pick) return cb({});
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
      const src = sources.find((s) => s.id === pick.id);
      if (!src) return cb({});
      cb({ video: src, ...(pick.audio && process.platform === 'win32' ? { audio: 'loopback' } : {}) });
    } catch { cb({}); }
  });
}

function openServer(url) {
  const u = new URL(url);
  allowedHost = u.hostname;
  if (!updateSource() && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) setTimeout(() => checkUpdate(u.origin), 3000);
  // links de convite (…/convite/codigo) abrem direto no convite
  win.loadURL(u.origin + (/^\/convite\/[a-z0-9]+$/i.test(u.pathname) ? u.pathname : '/'));
}

// ---------- atualização automática ----------
// Ao entrar no servidor de um amigo, compara os arquivos do app com os dele e,
// se o dele for igual ou mais novo e tiver mudanças, oferece atualizar e reinicia.
const crypto = require('crypto');
let updateAsked = false;
const verNum = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0).reduce((a, x) => a * 1000 + x, 0);
// Duas fontes:
//  - GitHub (fonte fixa, configurada em desktop/update-source.json): checada ao abrir o app,
//    vale para todo mundo, inclusive quem hospeda.
//  - o servidor em que você entrou (se ele tiver uma versão igual ou mais nova).
const UPDATABLE = /^(server\.js|ws\.js|package\.json|desktop\/[\w.-]+|public\/[\w./-]+)$/;
function updateSource() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'update-source.json'), 'utf8'));
    return s && /^[\w.-]+\/[\w.-]+$/.test(s.repo || '') ? { repo: s.repo, branch: s.branch || 'main', token: s.token || '' } : null;
  } catch { return null; }
}
function githubSource(src) {
  const url = (rel) => src.token
    ? `https://api.github.com/repos/${src.repo}/contents/${rel.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(src.branch)}`
    : `https://raw.githubusercontent.com/${src.repo}/${encodeURIComponent(src.branch)}/${rel}?t=${Date.now()}`;
  const headers = src.token ? { Authorization: 'Bearer ' + src.token, Accept: 'application/vnd.github.raw', 'User-Agent': 'Concord' } : { 'User-Agent': 'Concord' };
  return {
    label: 'na internet (GitHub)',
    manifest: async () => { const r = await net.fetch(url('atualizacao.json'), { headers, cache: 'no-store' }); if (!r.ok) throw new Error('GitHub respondeu ' + r.status); return r.json(); },
    file: (rel) => net.fetch(url(rel), { headers, cache: 'no-store' }),
  };
}
function serverSource(origin) {
  return {
    label: 'no servidor',
    manifest: async () => { const r = await net.fetch(origin + '/atualizacao', { cache: 'no-store' }); if (!r.ok) throw new Error('servidor respondeu ' + r.status); return r.json(); },
    file: (rel) => net.fetch(origin + '/atualizacao/arquivo?p=' + encodeURIComponent(rel), { cache: 'no-store' }),
  };
}
let updating = false;
// interactive: veio do botão "Procurar atualizações" (avisa até quando não tem nada)
async function runUpdate(source, { interactive = false } = {}) {
  if (!app.isPackaged) return { status: 'dev' };
  if (updating || (updateAsked && !interactive)) return { status: 'busy' };
  updating = true;
  try {
    const remote = await source.manifest();
    const root = app.getAppPath();
    const local = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (verNum(remote.version) < verNum(local.version)) { log('atualização: fonte tem versão mais antiga', remote.version); return { status: 'older', version: remote.version }; }
    const changed = Object.entries(remote.files || {}).filter(([rel, sha]) => {
      if (!UPDATABLE.test(rel) || rel.includes('..') || rel === 'desktop/update-source.json') return false;
      try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex') !== sha; } catch { return true; }
    }).map(([rel]) => rel);
    log('atualização', source.label, remote.version, 'arquivos diferentes:', changed.length);
    if (!changed.length) return { status: 'latest', version: local.version };
    if (!win || win.isDestroyed()) return { status: 'busy' };
    updateAsked = true;
    const { response } = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Atualizar agora', 'Depois'], defaultId: 0, cancelId: 1, noLink: true,
      title: 'Atualização do Concord',
      message: `Tem uma versão nova do Concord (${remote.version}) ${source.label}.`,
      detail: ((remote.notes || []).length ? 'O que mudou:\n' + remote.notes.slice(0, 8).map((x) => '• ' + x).join('\n') + '\n\n' : '') + 'O app baixa os arquivos novos e reinicia sozinho em alguns segundos.',
    });
    if (response !== 0) return { status: 'later' };
    const tmp = [];
    for (const rel of changed) { // baixa tudo primeiro; só troca os arquivos se todos chegarem certinhos
      const f = await source.file(rel);
      if (!f.ok) throw new Error('falha ao baixar ' + rel + ' (' + f.status + ')');
      const buf = Buffer.from(await f.arrayBuffer());
      if (crypto.createHash('sha256').update(buf).digest('hex') !== remote.files[rel]) throw new Error('arquivo diferente do esperado: ' + rel + ' (tente de novo em alguns minutos)');
      tmp.push([rel, buf]);
    }
    for (const [rel, buf] of tmp) {
      const dest = path.join(root, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest + '.novo', buf);
      fs.renameSync(dest + '.novo', dest);
    }
    log('atualização aplicada:', tmp.length, 'arquivos');
    app.relaunch();
    app.exit(0);
    return { status: 'updated' };
  } catch (e) {
    log('atualização falhou', e && e.message);
    if ((updateAsked || interactive) && win && !win.isDestroyed()) dialog.showMessageBox(win, { type: 'warning', title: 'Atualização do Concord', message: 'Não deu para atualizar agora.', detail: String(e && e.message || e) });
    return { status: 'error', error: String(e && e.message || e) };
  } finally { updating = false; }
}
async function checkUpdate(origin) { return runUpdate(serverSource(origin)); }
async function checkGithubUpdate(interactive) {
  const src = updateSource();
  if (!src) return { status: 'no-source' };
  return runUpdate(githubSource(src), { interactive });
}
ipcMain.handle('check-update', async () => {
  updateAsked = false;
  const r = await checkGithubUpdate(true);
  if (r.status === 'no-source' && allowedHost && !/^(localhost|127\.0\.0\.1)$/.test(allowedHost) && win) {
    try { return await runUpdate(serverSource(new URL(win.webContents.getURL()).origin), { interactive: true }); } catch { /* ignora */ }
  }
  return r;
});

// ---------- notificações do Windows ----------
// O Windows só mostra notificações de apps com atalho no Menu Iniciar com o mesmo AppUserModelId.
// O Windows guarda o ícone em cache pelo caminho do arquivo: copiamos o .ico com o hash no nome,
// assim quando o ícone muda o atalho e a barra de tarefas pegam o novo.
let iconCache = null;
function taskbarIcon() {
  if (iconCache) return iconCache;
  const src = path.join(__dirname, 'icon.ico');
  try {
    const hash = crypto.createHash('md5').update(fs.readFileSync(src)).digest('hex').slice(0, 10);
    const dir = path.join(app.getPath('userData'), 'icones');
    fs.mkdirSync(dir, { recursive: true });
    const dst = path.join(dir, `concord-${hash}.ico`);
    if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    iconCache = dst;
  } catch { iconCache = src; }
  return iconCache;
}
function ensureStartMenuShortcut() {
  if (process.platform !== 'win32') return;
  try {
    const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Concord.lnk');
    const want = { target: process.execPath, args: app.isPackaged ? '' : `"${app.getAppPath()}"`, appUserModelId: 'Concord',
      icon: taskbarIcon(), iconIndex: 0, description: 'Concord - chat, voz e tela com a galera' };
    let cur = null;
    try { cur = shell.readShortcutLink(lnk); } catch { /* não existe */ }
    if (cur && cur.target === want.target && cur.args === want.args && cur.appUserModelId === want.appUserModelId && cur.icon === want.icon) return;
    const ok = shell.writeShortcutLink(lnk, cur ? 'replace' : 'create', want);
    log('atalho do Menu Iniciar', ok ? 'criado' : 'falhou', lnk);
  } catch (e) { log('atalho do Menu Iniciar falhou', e && e.message); }
}
ipcMain.on('notify', (e, n) => {
  try {
    if (!Notification.isSupported() || !n || typeof n.title !== 'string') return;
    const note = new Notification({ title: n.title.slice(0, 120), body: String(n.body || '').slice(0, 300), silent: true, icon: path.join(__dirname, 'icon.png') });
    note.on('click', () => {
      if (!win || win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show(); win.focus();
      win.webContents.send('notify-click', n.data || null);
    });
    note.show();
    notes.push(note); // mantém referência senão o clique se perde
    if (notes.length > 20) notes.shift();
  } catch (err) { log('notificação falhou', err && err.message); }
});
const notes = [];

// ---------- sobreposição (lista da chamada e mensagens por cima do jogo) ----------
// Janela transparente, sempre no topo e que deixa o clique passar. Funciona com jogos em
// "tela cheia sem bordas"/janela; em tela cheia exclusiva o Windows não deixa nada por cima.
let overlayWin = null;
let overlayState = null;
let overlayHidden = false;
let overlayReady = false;
let overlayEditing = false;
function placeOverlay() {
  if (!overlayWin || overlayWin.isDestroyed() || overlayEditing) return;
  const area = screen.getPrimaryDisplay().workArea;
  const w = 360;
  const h = Math.min(720, area.height - 40);
  const pos = (overlayState && overlayState.pos) || 'top-left';
  const saved = readConfig().overlayPos;
  if (pos === 'custom' && saved) { // posição escolhida arrastando (garante que fica dentro de alguma tela)
    const d = screen.getDisplayNearestPoint({ x: saved.x, y: saved.y }).workArea;
    const x = Math.min(Math.max(saved.x, d.x), d.x + d.width - 80);
    const y = Math.min(Math.max(saved.y, d.y), d.y + d.height - 80);
    overlayWin.setBounds({ x, y, width: w, height: Math.min(h, d.y + d.height - y) });
    return;
  }
  const x = pos.endsWith('right') ? area.x + area.width - w - 8 : area.x + 8;
  const y = pos.startsWith('bottom') ? area.y + area.height - h - 8 : area.y + 8;
  overlayWin.setBounds({ x, y, width: w, height: h });
}
function ensureOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return;
  overlayReady = false;
  overlayWin = new BrowserWindow({
    width: 360, height: 600, frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, show: false, backgroundColor: '#00000000', title: 'Concord - sobreposição',
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWin.webContents.on('did-finish-load', () => { overlayReady = true; overlayWin.webContents.send('overlay-state', overlayState); refreshOverlay(); });
  overlayWin.on('closed', () => { overlayWin = null; });
}
function refreshOverlay() {
  if (overlayEditing) return;
  if (!overlayState) { if (overlayWin && !overlayWin.isDestroyed()) overlayWin.hide(); return; }
  ensureOverlay();
  placeOverlay();
  if (overlayReady) overlayWin.webContents.send('overlay-state', overlayState);
  // só aparece quando o Concord não está na frente (ou seja, enquanto você joga)
  const show = !overlayHidden && win && !win.isDestroyed() && !win.isFocused();
  if (show && !overlayWin.isVisible()) overlayWin.showInactive();
  if (!show && overlayWin.isVisible()) overlayWin.hide();
}
ipcMain.on('overlay', (e, st) => { overlayState = st && typeof st === 'object' ? st : null; refreshOverlay(); });
ipcMain.on('overlay-msg', (e, m) => { if (overlayState && overlayReady && overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('overlay-msg', m); });
ipcMain.on('overlay-toggle', () => { overlayHidden = !overlayHidden; refreshOverlay(); });
// modo de ajustar a posição: a sobreposição vira uma janela que dá para arrastar
ipcMain.on('overlay-edit', () => {
  ensureOverlay();
  overlayEditing = true;
  overlayWin.setIgnoreMouseEvents(false);
  overlayWin.setFocusable(true);
  overlayWin.setMovable(true);
  const send = () => overlayWin.webContents.send('overlay-edit', { on: true, state: overlayState });
  if (overlayReady) send(); else overlayWin.webContents.once('did-finish-load', send);
  overlayWin.show();
  overlayWin.focus();
});
ipcMain.on('overlay-edit-done', () => {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  const b = overlayWin.getBounds();
  writeConfig({ ...readConfig(), overlayPos: { x: b.x, y: b.y } });
  overlayEditing = false;
  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.setFocusable(false);
  overlayWin.setMovable(false);
  overlayWin.webContents.send('overlay-edit', { on: false });
  overlayWin.hide();
  if (win && !win.isDestroyed()) { win.webContents.send('overlay-pos-saved'); win.focus(); }
  refreshOverlay();
});

// ---------- atalhos globais (funcionam com o jogo em primeiro plano) ----------
ipcMain.handle('global-keys', (e, keys) => {
  globalShortcut.unregisterAll();
  const result = {};
  for (const [name, acc] of Object.entries(keys || {})) {
    if (!acc) continue;
    try { result[name] = globalShortcut.register(acc, () => { if (win && !win.isDestroyed()) win.webContents.send('global-key', name); }); }
    catch { result[name] = false; }
  }
  return result;
});
app.on('will-quit', () => globalShortcut.unregisterAll());

// ---------- detecção de jogos (lista de processos do Windows) ----------
let customGames = [];
let currentGame = null;
function detectGame() {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
    if (err || !win || win.isDestroyed()) return;
    const running = new Set(out.split(/\r?\n/).map((l) => (l.match(/^"([^"]+)"/) || [])[1]).filter(Boolean).map((x) => x.toLowerCase()));
    let game = null;
    for (const g of customGames) if (running.has(g.exe)) { game = g.name; break; }
    if (!game) for (const exe of running) if (KNOWN_GAMES[exe]) { game = KNOWN_GAMES[exe]; break; }
    if (!game && running.has('javaw.exe') && (running.has('minecraftlauncher.exe') || running.has('minecraft.exe'))) game = 'Minecraft';
    if (game !== currentGame) {
      currentGame = game;
      log('jogo detectado:', game || '(nenhum)');
      win.webContents.send('game', game);
    }
  });
}
setInterval(detectGame, 15000);

// ---------- IPC ----------
ipcMain.handle('config:get', () => ({ ...readConfig(), official: officialServer() }));
// tentar de novo no servidor oficial (esquece um endereço escolhido à mão)
ipcMain.handle('retry', () => {
  const cfg = readConfig();
  const url = officialServer() || (cfg.auto && cfg.auto.url);
  if (!url) return { ok: false, error: 'Nenhum servidor configurado.' };
  if (cfg.auto && cfg.auto.custom) writeConfig({ ...cfg, auto: null });
  openServer(url);
  return { ok: true };
});
// endereço escolhido à mão (para testes ou se o servidor oficial mudar)
ipcMain.handle('join', async (e, address) => {
  if (!String(address || '').trim()) return { ok: false, error: 'Digite o endereço do servidor.' };
  const url = normalizeAddress(address);
  if (!url) return { ok: false, error: 'Endereço inválido.' };
  const off = officialServer();
  writeConfig({ ...readConfig(), auto: { mode: 'join', url, custom: !off || url !== off } });
  openServer(url);
  return { ok: true };
});
ipcMain.handle('home', () => goHome());
ipcMain.handle('screen:sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
  return sources
    .filter((s) => !/^(Concord|Discord Local)$/.test(s.name))
    .map((s) => ({ id: s.id, name: s.name, type: s.id.startsWith('screen') ? 'screen' : 'window', thumbnail: s.thumbnail.toDataURL() }));
});
ipcMain.handle('screen:select', (e, id, audio) => { pendingSource = { id, audio: !!audio }; });
ipcMain.on('flash', () => { if (win && !win.isFocused()) win.flashFrame(true); });
ipcMain.on('open-external', (e, url) => { if (typeof url === 'string' && /^(https:\/\/mail\.google\.com\/|mailto:)/.test(url)) shell.openExternal(url); });
ipcMain.on('focus', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
ipcMain.on('games:set', (e, list) => {
  customGames = (Array.isArray(list) ? list : []).filter((g) => g && typeof g.exe === 'string' && typeof g.name === 'string')
    .slice(0, 100).map((g) => ({ exe: g.exe.toLowerCase().slice(0, 100), name: g.name.slice(0, 60) }));
  detectGame();
});
ipcMain.handle('game:get', () => currentGame);
ipcMain.handle('idle', () => powerMonitor.getSystemIdleTime());
ipcMain.handle('version', () => app.getVersion());
// só abre arquivos que o próprio app baixou
ipcMain.on('download-open', (e, p) => { if (downloaded.has(p)) shell.openPath(p); });
ipcMain.on('download-show', (e, p) => { if (downloaded.has(p)) shell.showItemInFolder(p); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { ensureStartMenuShortcut(); setupSession(); createWindow(); setTimeout(() => checkGithubUpdate(false), 1500); }); // verificada rápida ao abrir
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy(); });

