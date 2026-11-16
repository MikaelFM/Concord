'use strict';
// Gera o app para Windows em dist\Concord-win32-x64\Concord.exe
const path = require('path');
const pkgr = require('@electron/packager');
const packager = pkgr.packager || pkgr.default || pkgr;

const root = path.join(__dirname, '..');

packager({
  dir: root,
  name: 'Concord',
  executableName: 'Concord',
  platform: 'win32',
  arch: 'x64',
  out: path.join(root, 'dist'),
  overwrite: true,
  asar: false,
  prune: true,
  icon: path.join(__dirname, 'icon.ico'),
  appCopyright: 'Concord',
  win32metadata: { CompanyName: 'Concord', FileDescription: 'Concord', ProductName: 'Concord', InternalName: 'Concord' },
  ignore: [/^\/dist($|\/)/, /^\/data($|\/)/, /^\/gerar-exe\.bat$/, /^\/iniciar\.bat$/, /^\/LEIA-ME\.md$/, /^\/\.git($|\/)/, /^\/debug\.log$/, /^\/publicar(-token\.txt|-atualizacao\.bat|\.js)$/],
}).then((paths) => {
  console.log('\n  Pronto! O app foi gerado em:\n');
  for (const p of paths) console.log('    ' + path.join(p, 'Concord.exe'));
  console.log('\n  Para mandar para os amigos, compacte a pasta inteira (não só o .exe).\n');
}).catch((e) => {
  console.error('\n  Falha ao gerar o app:', e.message || e);
  process.exit(1);
});
