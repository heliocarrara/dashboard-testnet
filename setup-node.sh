#!/bin/bash

# ==============================================================================
# 🌌 STELLAR TESTNET NODE SETUP
# ==============================================================================
# - Auto-configuration via Neon DB
# - Roles: validator, watcher
# - Gatekeeper: Waits for 5 validators before starting
# ==============================================================================

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config DB
DB_URL="postgresql://neondb_owner:npg_QBCYNh9m3Uvc@ep-rapid-snow-ac6jntdp-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
TABLE_IDENTITY="testnet_node_identity"

IMAGE="docker.io/stellar/quickstart:testing"
VOLUME_PATH="/srv/stellar_testnet_data"

# SDF Testnet Nodes (for Quorum & Peers)
SDF_PEERS="core-testnet1.stellar.org:11625,core-testnet2.stellar.org:11625,core-testnet3.stellar.org:11625"

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
run_sql_cmd() {
    docker run --rm \
      --entrypoint /bin/bash \
      "$IMAGE" \
      -c "psql \"$DB_URL\" -t -c \"$1\""
}

# ------------------------------------------------------------------------------
# 1. Prepare Environment
# ------------------------------------------------------------------------------
command -v docker >/dev/null || {
    echo -e "${RED}Docker não encontrado! Instale o Docker primeiro.${NC}"
    exit 1
}

# Verifica se o Docker Daemon está acessível (WSL integration check)
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}Erro: Não foi possível conectar ao Docker Daemon.${NC}"
    echo -e "${YELLOW}Se você está usando WSL 2, verifique se a integração está ativada no Docker Desktop:${NC}"
    echo -e "1. Abra o Docker Desktop"
    echo -e "2. Vá em Settings > Resources > WSL Integration"
    echo -e "3. Ative a integração para a sua distro (Ubuntu/Debian/etc)"
    echo -e "4. Clique em Apply & Restart"
    exit 1
fi

echo -e "${BLUE}🔄 Preparando ambiente...${NC}"
sudo mkdir -p $VOLUME_PATH
sudo chown $(whoami):$(whoami) $VOLUME_PATH

# ------------------------------------------------------------------------------
# 1.1 Firewall Configuration
# ------------------------------------------------------------------------------
echo -e "${BLUE}🛡️ Configurando Firewall...${NC}"

# Check for UFW (Ubuntu/Debian)
if command -v ufw >/dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        echo -e "${YELLOW}🔒 UFW detectado e ativo. Configurando regras...${NC}"
        sudo ufw allow 11625/tcp
        sudo ufw allow 11626/tcp
        sudo ufw allow 8000/tcp
        echo -e "${GREEN}✅ Regras UFW aplicadas (11625, 11626, 8000).${NC}"
    else
        echo -e "${YELLOW}⚠️ UFW instalado mas INATIVO. Tentando ativar...${NC}"
        # We don't force enable it as it might lock user out of SSH if not configured properly
        echo -e "${YELLOW}ℹ️  Se desejar ativar, rode: sudo ufw allow ssh && sudo ufw enable${NC}"
    fi

# Check for firewalld (CentOS/RHEL/Fedora/OpenSUSE)
elif command -v firewall-cmd >/dev/null; then
    if sudo firewall-cmd --state | grep -q "running"; then
        echo -e "${YELLOW}🔒 Firewalld detectado e ativo. Configurando regras...${NC}"
        sudo firewall-cmd --permanent --add-port=11625/tcp
        sudo firewall-cmd --permanent --add-port=11626/tcp
        sudo firewall-cmd --permanent --add-port=8000/tcp
        sudo firewall-cmd --reload
        echo -e "${GREEN}✅ Regras Firewalld aplicadas (11625, 11626, 8000).${NC}"
    else
        echo -e "${YELLOW}⚠️ Firewalld instalado mas inativo.${NC}"
    fi

# Check for iptables (Universal Linux fallback)
elif command -v iptables >/dev/null; then
    echo -e "${YELLOW}🔒 Iptables detectado. Tentando adicionar regras...${NC}"
    # Check if rules already exist to avoid duplicates
    if ! sudo iptables -C INPUT -p tcp --dport 11625 -j ACCEPT 2>/dev/null; then
        sudo iptables -I INPUT -p tcp --dport 11625 -j ACCEPT
        echo -e "${GREEN}✅ Iptables: Porta 11625 liberada.${NC}"
    fi
    if ! sudo iptables -C INPUT -p tcp --dport 11626 -j ACCEPT 2>/dev/null; then
        sudo iptables -I INPUT -p tcp --dport 11626 -j ACCEPT
        echo -e "${GREEN}✅ Iptables: Porta 11626 liberada.${NC}"
    fi
    if ! sudo iptables -C INPUT -p tcp --dport 8000 -j ACCEPT 2>/dev/null; then
        sudo iptables -I INPUT -p tcp --dport 8000 -j ACCEPT
        echo -e "${GREEN}✅ Iptables: Porta 8000 liberada.${NC}"
    fi
    
    # Save rules (this part varies by distro, so we just warn)
    echo -e "${YELLOW}⚠️ Regras iptables aplicadas em memória. Para persistir após reboot, use 'iptables-save' ou 'netfilter-persistent'.${NC}"

else
    echo -e "${RED}⚠️ Nenhum gerenciador de firewall conhecido encontrado (ufw, firewalld, iptables).${NC}"
    echo -e "${YELLOW}Certifique-se manualmente de que as portas 11625, 11626 e 8000 TCP estão acessíveis externamente.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Check Identity & Register
# ------------------------------------------------------------------------------
MY_HOSTNAME=$(hostname)
MY_IP=$(curl -s ifconfig.me)

echo -e "${BLUE}🔑 Hostname: $MY_HOSTNAME | IP: $MY_IP${NC}"

# Check if exists
EXISTING=$(run_sql_cmd "SELECT node_seed || '|' || public_key || '|' || COALESCE(role, 'none') || '|' || COALESCE(quorum_group, 0)::text FROM $TABLE_IDENTITY WHERE hostname = '$MY_HOSTNAME' OR ip_address = '$MY_IP' ORDER BY id ASC LIMIT 1;" | xargs)

if [ -z "$EXISTING" ]; then
    echo -e "${YELLOW}   -> Novo nó detectado. Gerando chaves...${NC}"
    
    KEYPAIR=$(docker run --rm --entrypoint /bin/bash "$IMAGE" -c "stellar-core gen-seed")
    SECRET_SEED=$(echo "$KEYPAIR" | grep "Secret seed:" | awk '{print $3}')
    PUBLIC_KEY=$(echo "$KEYPAIR" | grep "Public:" | awk '{print $2}')
    
    # Register in DB
    run_sql_cmd "INSERT INTO $TABLE_IDENTITY (hostname, ip_address, node_seed, public_key, role, quorum_group, status, config_status) VALUES ('$MY_HOSTNAME', '$MY_IP', '$SECRET_SEED', '$PUBLIC_KEY', 'none', 0, 'pending', 'unconfigured');" > /dev/null
    
    echo -e "${GREEN}   -> Registrado no Dashboard! Aguardando configuração de Role...${NC}"
    EXISTING_ROLE="none"
else
    SECRET_SEED=$(echo "$EXISTING" | cut -d'|' -f1)
    PUBLIC_KEY=$(echo "$EXISTING" | cut -d'|' -f2)
    EXISTING_ROLE=$(echo "$EXISTING" | cut -d'|' -f3)
    QUORUM_GROUP=$(echo "$EXISTING" | cut -d'|' -f4)

    # Update Hostname and IP to ensure they match current machine (recovering identity)
    run_sql_cmd "UPDATE $TABLE_IDENTITY SET hostname = '$MY_HOSTNAME', ip_address = '$MY_IP', status = 'pending' WHERE public_key = '$PUBLIC_KEY';" > /dev/null
    
    echo -e "${GREEN}   -> Identidade carregada (Recuperada via Hostname/IP).${NC}"
fi

# ------------------------------------------------------------------------------
# Heartbeat Function (Background)
# ------------------------------------------------------------------------------
start_heartbeat() {
    while true; do
        run_sql_cmd "UPDATE $TABLE_IDENTITY SET last_seen = NOW(), status = 'online' WHERE hostname = '$MY_HOSTNAME';" > /dev/null 2>&1
        sleep 30
    done &
    HEARTBEAT_PID=$!
    echo -e "${BLUE}💓 Heartbeat iniciado (PID: $HEARTBEAT_PID)${NC}"
}

# Trap to kill heartbeat on exit
trap "kill $HEARTBEAT_PID 2>/dev/null; exit" INT TERM EXIT

# Start Heartbeat immediately so dashboard sees us
start_heartbeat

# ------------------------------------------------------------------------------
# 3. Wait for Configuration
# ------------------------------------------------------------------------------
while [ "$EXISTING_ROLE" == "none" ] || [ -z "$EXISTING_ROLE" ]; do
    echo -e "${YELLOW}⏳ Aguardando configuração de 'role' no Dashboard... (Verificando em 10s)${NC}"
    sleep 10
    EXISTING=$(run_sql_cmd "SELECT COALESCE(role, 'none') FROM $TABLE_IDENTITY WHERE hostname = '$MY_HOSTNAME';" | xargs)
    EXISTING_ROLE=$EXISTING
done

echo -e "${GREEN}✅ Configuração recebida: ROLE = $EXISTING_ROLE${NC}"

# Update config status
run_sql_cmd "UPDATE $TABLE_IDENTITY SET config_status = 'configured' WHERE hostname = '$MY_HOSTNAME';" > /dev/null

# ------------------------------------------------------------------------------
# 4. Gatekeeper Logic (Quorum Check)
# ------------------------------------------------------------------------------
check_quorum_readiness() {
    # Conta quantos nós do tipo 'validator' estão com IP e Seed cadastrados no Neon
    VALIDATORS_READY=$(run_sql_cmd "SELECT COUNT(*) FROM $TABLE_IDENTITY WHERE role = 'validator' AND node_seed IS NOT NULL AND ip_address IS NOT NULL;" | xargs)

    if [ "$VALIDATORS_READY" -lt 5 ]; then
        echo -e "${RED}❌ ERRO: Quórum insuficiente ($VALIDATORS_READY/5 validadores prontos).${NC}"
        echo -e "${YELLOW}Aguarde a configuração de todos os validadores no Dashboard React.${NC}"
        return 1
    fi
    echo -e "${GREEN}✅ Quórum verificado ($VALIDATORS_READY/5 validadores). Iniciando nó...${NC}"
    return 0
}

# Wait for 5 validators ONLY if I am going to be part of the network (technically everyone should wait)
while ! check_quorum_readiness; do
    sleep 10
done

# ------------------------------------------------------------------------------
# 5. Configure Network Topology
# ------------------------------------------------------------------------------

# Fetch Peers (IP and Public Key) based on node_relationships
PEER_DATA=$(run_sql_cmd "
  SELECT t.ip_address || '|' || t.public_key 
  FROM $TABLE_IDENTITY t 
  JOIN node_relationships r ON t.id = r.target_node_id 
  WHERE r.source_node_id = (SELECT id FROM $TABLE_IDENTITY WHERE hostname = '$MY_HOSTNAME')
  AND t.ip_address IS NOT NULL;
" | awk 'NF')

PREFERRED_PEERS=""
VALIDATORS_JSON=""

# Process Peers
for PEER in $PEER_DATA; do
  IP=$(echo "$PEER" | cut -d'|' -f1)
  PUBKEY=$(echo "$PEER" | cut -d'|' -f2)
  
  # Add to PREFERRED_PEERS (format: ip:port)
  PREFERRED_PEERS+="${IP}:11625,"
  
  # Add to VALIDATORS list for Quorum Set
  if [ -n "$PUBKEY" ]; then
      VALIDATORS_JSON+="\"$PUBKEY\","
  fi
done

# Remove trailing comma
PREFERRED_PEERS=${PREFERRED_PEERS%,}
VALIDATORS_JSON=${VALIDATORS_JSON%,}

# Build QUORUM_SET JSON
# Threshold: 66% (2/3 majority)
if [ -n "$VALIDATORS_JSON" ]; then
    QUORUM_SET="[{\"threshold_percent\": 66, \"validators\": [\"\$SELF\", $VALIDATORS_JSON]}]"
else
    QUORUM_SET="[{\"threshold_percent\": 66, \"validators\": [\"\$SELF\"]}]"
fi

# Escape double quotes for YAML compatibility
# We need to ensure that the JSON string inside the YAML is properly escaped
# Example: [{"key": "value"}] -> "[{\"key\": \"value\"}]"
# Also we need to escape $ so docker-compose doesn't try to interpolate $SELF
QUORUM_SET_SAFE=$(echo "$QUORUM_SET" | sed 's/"/\\"/g' | sed 's/\$SELF/$$SELF/g')

echo -e "🔗 Peers Preferenciais: ${BLUE}$PREFERRED_PEERS${NC}"
echo -e "🗳️ Quorum Set Configurado: ${BLUE}$QUORUM_SET${NC}"

# ------------------------------------------------------------------------------
# 6. Generate Docker Compose
# ------------------------------------------------------------------------------

# Define os serviços baseados na Role (A nossa tabela da topologia)
if [ "$EXISTING_ROLE" == "validator" ]; then
  SERVICES_TO_ENABLE="core"
  IS_VALIDATOR="true"
elif [ "$EXISTING_ROLE" == "watcher_horizon" ]; then
  SERVICES_TO_ENABLE="core,horizon"
  IS_VALIDATOR="false"
elif [ "$EXISTING_ROLE" == "watcher_rpc" ]; then
  SERVICES_TO_ENABLE="core,rpc"
  IS_VALIDATOR="false"
else
  # Fallback de segurança
  SERVICES_TO_ENABLE="core"
  IS_VALIDATOR="false"
fi

# Corrigindo a imagem para testnet
IMAGE="docker.io/stellar/quickstart:testing"

cat > docker-compose.yml <<EOF
version: '3.8'
services:
  stellar-node:
    image: $IMAGE
    container_name: stellar-node
    restart: unless-stopped
    ports:
      - "8000:8000"
      - "11625:11625"
      - "11626:11626"
    environment:
      - NODE_SEED="$SECRET_SEED"
      - PREFERRED_PEERS="$PREFERRED_PEERS"
      - "QUORUM_SET=$QUORUM_SET_SAFE"
      - ENABLE_HAYSTACK=false
      - NETWORK=TESTNET
      - KNOWN_PEERS="$SDF_PEERS"
      - NODE_IS_VALIDATOR="$IS_VALIDATOR"
      - POSTGRES_PASSWORD=stellar
    volumes:
      # CORREÇÃO CRÍTICA DO DIRETÓRIO INTERNO:
      - $VOLUME_PATH:/opt/stellar
    # COMANDO DINÂMICO BASEADO NA ROLE DA MÁQUINA:
    command: ["--testnet", "--enable", "$SERVICES_TO_ENABLE"]
EOF

# ------------------------------------------------------------------------------
# 7. Start
# ------------------------------------------------------------------------------
echo -e "${GREEN}🚀 Iniciando nó Stellar ($EXISTING_ROLE) com serviços: $SERVICES_TO_ENABLE...${NC}"
docker compose up -d

# Check if port is open locally
echo -e "${BLUE}🔍 Verificando se a porta 11626 está acessível localmente (aguardando 10s)...${NC}"
sleep 10
if curl -s http://localhost:11626/info >/dev/null; then
    echo -e "${GREEN}✅ Porta 11626 está respondendo localmente!${NC}"
    echo -e "${BLUE}ℹ️  Se o Dashboard ainda mostrar 'Offline', verifique o firewall da rede.${NC}"
else
    echo -e "${RED}❌ Porta 11626 NÃO está respondendo localmente.${NC}"
    echo -e "${YELLOW}Isso pode acontecer se o nó ainda estiver inicializando. Verifique os logs abaixo.${NC}"
fi

docker logs -f stellar-node
