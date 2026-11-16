#!/bin/bash
# Instala o servidor do Concord numa VM Ubuntu (Oracle Cloud ou outra).
# Uso (na VM):  curl -fsSL https://raw.githubusercontent.com/MikaelFM/Concord/main/servidor/instalar.sh | sudo bash -s IP_PUBLICO
# Pode rodar de novo sem problema: só ajusta o que faltar.
set -euo pipefail
PUB="${1:-}"
REPO="${CONCORD_REPO:-MikaelFM/Concord}"
APP=/opt/concord
DATA=/var/lib/concord
[ "$(id -u)" = 0 ] || { echo "Rode com sudo."; exit 1; }
if ! [[ "$PUB" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then echo "Informe o IP público da VM. Ex.: sudo bash instalar.sh 157.151.7.123"; exit 1; fi
PRIV="$(hostname -I | awk '{print $1}')"
echo "==> IP público $PUB, IP interno $PRIV"

echo "==> Memória extra (swap de 2 GB), para a VM de 1 GB não ficar sem memória"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Instalando Node.js, coturn e openssl"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nodejs coturn openssl iptables-persistent >/dev/null
node -e 'if (+process.versions.node.split(".")[0] < 18) { console.error("Node 18+ necessário"); process.exit(1); }'

echo "==> Usuário e pastas"
id concord >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin concord
mkdir -p "$APP/servidor" "$DATA"
chown concord:concord "$DATA"; chmod 750 "$DATA"

echo "==> Baixando o Concord do GitHub ($REPO)"
curl -fsSL "https://raw.githubusercontent.com/$REPO/main/servidor/atualizar.js?t=$(date +%s)" -o "$APP/servidor/atualizar.js"
set +e; CONCORD_REPO="$REPO" node "$APP/servidor/atualizar.js"; rc=$?; set -e
[ $rc = 0 ] || [ $rc = 10 ] || { echo "Não consegui baixar o Concord."; exit 1; }

echo "==> Configuração"
if [ ! -f /etc/concord.env ]; then
  SECRET="$(openssl rand -hex 24)"
  cat > /etc/concord.env <<CFG
PORT=3000
DATA_DIR=$DATA
TURN_HOST=$PUB
TURN_SECRET=$SECRET
CONCORD_REPO=$REPO
CFG
  chmod 640 /etc/concord.env; chgrp concord /etc/concord.env
fi
SECRET="$(grep '^TURN_SECRET=' /etc/concord.env | cut -d= -f2)"
sed -i "s/^TURN_HOST=.*/TURN_HOST=$PUB/" /etc/concord.env

echo "==> Servidor de apoio das chamadas (coturn)"
cat > /etc/turnserver.conf <<CFG
listening-port=3478
listening-ip=$PRIV
relay-ip=$PRIV
external-ip=$PUB/$PRIV
min-port=49160
max-port=49200
realm=concord
use-auth-secret
static-auth-secret=$SECRET
fingerprint
no-tls
no-dtls
no-cli
no-multicast-peers
total-quota=60
user-quota=12
# não deixa o TURN alcançar a rede interna da nuvem
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
log-file=syslog
simple-log
CFG
sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true
systemctl enable -q coturn; systemctl restart coturn

echo "==> Serviços (Concord sempre ligado + atualização quando alguém abre o app)"
cat > /etc/systemd/system/concord.service <<CFG
[Unit]
Description=Concord
After=network-online.target
Wants=network-online.target
[Service]
User=concord
EnvironmentFile=/etc/concord.env
WorkingDirectory=$APP
ExecStart=/usr/bin/node $APP/server.js
Restart=always
RestartSec=3
AmbientCapabilities=
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
CFG
cat > /etc/systemd/system/concord-atualizar.service <<CFG
[Unit]
Description=Atualiza o Concord pelo GitHub
After=network-online.target
[Service]
Type=oneshot
EnvironmentFile=/etc/concord.env
ExecStart=/bin/sh -c 'node $APP/servidor/atualizar.js; rc=\$?; if [ \$rc -eq 10 ]; then systemctl restart concord; elif [ \$rc -ne 0 ]; then exit \$rc; fi'
CFG
# verifica quando alguém abre o app (o Concord mexe neste arquivo) e, por garantia, ao ligar e uma vez por dia
touch "$DATA/.verificar-atualizacao"; chown concord:concord "$DATA/.verificar-atualizacao"
cat > /etc/systemd/system/concord-atualizar.path <<CFG
[Unit]
Description=Verifica atualização do Concord quando alguém abre o app
[Path]
PathModified=$DATA/.verificar-atualizacao
Unit=concord-atualizar.service
[Install]
WantedBy=multi-user.target
CFG
cat > /etc/systemd/system/concord-atualizar.timer <<CFG
[Unit]
Description=Verifica atualização do Concord ao ligar e uma vez por dia
[Timer]
OnBootSec=1min
OnUnitActiveSec=1d
[Install]
WantedBy=timers.target
CFG
systemctl daemon-reload
systemctl enable -q --now concord concord-atualizar.path concord-atualizar.timer
systemctl restart concord

echo "==> Liberando as portas no firewall do Ubuntu"
# a imagem da Oracle termina a lista com um REJECT: as regras novas entram antes dele
open_port() {
  iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null && return
  local n; n="$(iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}')"
  if [ -n "$n" ]; then iptables -I INPUT "$n" -p "$1" --dport "$2" -j ACCEPT; else iptables -A INPUT -p "$1" --dport "$2" -j ACCEPT; fi
}
open_port tcp 3000; open_port tcp 80; open_port tcp 443; open_port tcp 3478; open_port udp 3478; open_port udp 49160:49200
netfilter-persistent save >/dev/null 2>&1 || true

sleep 3
if systemctl is-active -q concord; then
  echo
  echo "  PRONTO! O Concord está no ar em https://$PUB:3000"
  echo "  Ver o registro:   sudo journalctl -u concord -f"
else
  echo; echo "  O Concord não subiu. Veja o erro com: sudo journalctl -u concord -n 50"; exit 1
fi
