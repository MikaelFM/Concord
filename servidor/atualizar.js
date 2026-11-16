'use strict';
// Atualiza o servidor do Concord a partir do GitHub (roda sozinho a cada 5 minutos, pelo systemd).
// Baixa só o que mudou, confere o sha256 de cada arquivo e troca tudo de uma vez.
// Sai com código 10 quando o código do servidor mudou (aí o systemd reinicia o Concord).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const REPO = process.env.CONCORD_REPO || 'MikaelFM/Concord';
const BRANCH = process.env.CONCORD_BRANCH || 'main';
const OK = /^(server\.js|ws\.js|package\.json|public\/[\w./-]+|servidor\/[\w.-]+)$/;
const RESTART = /^(server\.js|ws\.js|package\.json)$/;
const RAW = process.env.CONCORD_RAW || 'https://raw.githubusercontent.com';
const raw = (rel) => `${RAW}/${REPO}/${BRANCH}/${rel}?t=${Date.now()}`;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

(async () => {
  const r = await fetch(raw('atualizacao.json'), { cache: 'no-store' });
  if (!r.ok) throw new Error('GitHub respondeu ' + r.status);
  const man = await r.json();
  const changed = Object.entries(man.files || {}).filter(([rel, h]) => {
    if (!OK.test(rel) || rel.includes('..')) return false;
    try { return sha(fs.readFileSync(path.join(ROOT, rel))) !== h; } catch { return true; }
  });
  if (!changed.length) return process.exit(0);
  const got = [];
  for (const [rel, h] of changed) {
    const f = await fetch(raw(rel), { cache: 'no-store' });
    if (!f.ok) throw new Error(`${rel}: GitHub respondeu ${f.status}`);
    const buf = Buffer.from(await f.arrayBuffer());
    if (sha(buf) !== h) throw new Error(`${rel}: arquivo diferente do esperado (tente de novo daqui a pouco)`);
    got.push([rel, buf]);
  }
  for (const [rel, buf] of got) {
    const dest = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest + '.novo', buf);
    fs.renameSync(dest + '.novo', dest);
  }
  console.log(`Concord ${man.version}: ${got.length} arquivo(s) atualizado(s): ${got.map(([r]) => r).join(', ')}`);
  process.exit(got.some(([rel]) => RESTART.test(rel)) ? 10 : 0);
})().catch((e) => { console.error('Falha ao atualizar:', e.message); process.exit(1); });
