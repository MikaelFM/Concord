#!/bin/bash
# Copia os dados do servidor antigo (contas, mensagens, salas, arquivos) para a VM.
# Uso: sudo bash /opt/concord/servidor/importar-dados.sh ~/servidor
set -euo pipefail
SRC="${1:-}"
DATA=/var/lib/concord
[ "$(id -u)" = 0 ] || { echo "Rode com sudo."; exit 1; }
[ -d "$SRC" ] || { echo "Pasta não encontrada: $SRC"; exit 1; }
ls "$SRC" | grep -q '\.json' || { echo "Essa pasta não parece ter os dados do Concord (nenhum .json)."; exit 1; }
systemctl stop concord
if [ -n "$(ls -A "$DATA" 2>/dev/null)" ]; then
  BK="/var/lib/concord-antes-da-importacao-$(date +%Y%m%d-%H%M%S)"
  cp -a "$DATA" "$BK"; echo "Backup do que já estava na VM: $BK"
fi
find "$DATA" -mindepth 1 -delete
cp -a "$SRC"/. "$DATA"/
rm -rf "$DATA/certs"   # certificado novo, gerado para este servidor
chown -R concord:concord "$DATA"
systemctl start concord
sleep 2
systemctl is-active -q concord && echo "Dados importados e Concord rodando." || { echo "O Concord não subiu: sudo journalctl -u concord -n 50"; exit 1; }
