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

echo -e "${BLUE}🔄 Preparando ambiente...${NC}"
sudo mkdir -p $VOLUME_PATH
sudo chown $(whoami):$(whoami) $VOLUME_PATH

# ------------------------------------------------------------------------------
# 2. Check Identity & Register
# ------------------------------------------------------------------------------
MY_HOSTNAME=$(hostname)
MY_IP=$(curl -s ifconfig.me)

echo -e "${BLUE}🔑 Hostname: $MY_HOSTNAME | IP: $MY_IP${NC}"

# Check if exists
EXISTING=$(run_sql_cmd "SELECT node_seed || '|' || public_key || '|' || COALESCE(role, 'none') || '|' || COALESCE(quorum_group, 0)::text FROM $TABLE_IDENTITY WHERE hostname = '$MY_HOSTNAME';" | xargs)

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
    # Update IP if changed
    run_sql_cmd "UPDATE $TABLE_IDENTITY SET ip_address = '$MY_IP', status = 'pending' WHERE hostname = '$MY_HOSTNAME';" > /dev/null
    
    SECRET_SEED=$(echo "$EXISTING" | cut -d'|' -f1)
    PUBLIC_KEY=$(echo "$EXISTING" | cut -d'|' -f2)
    EXISTING_ROLE=$(echo "$EXISTING" | cut -d'|' -f3)
    QUORUM_GROUP=$(echo "$EXISTING" | cut -d'|' -f4)
    
    echo -e "${GREEN}   -> Identidade carregada.${NC}"
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

# Fetch Validator IPs for Peers
VALIDATOR_IPS=$(run_sql_cmd "SELECT ip_address FROM $TABLE_IDENTITY WHERE role = 'validator' AND hostname != '$MY_HOSTNAME' AND ip_address IS NOT NULL;" | awk 'NF')
VALIDATOR_PEERS=""
for IP in $VALIDATOR_IPS; do
    VALIDATOR_PEERS+="${IP}:11625,"
done

# Build PREFERRED_PEERS
if [ "$EXISTING_ROLE" == "validator" ]; then
    # Validators connect to other validators + SDF
    PREFERRED_PEERS="${VALIDATOR_PEERS}${SDF_PEERS}"
else
    # Watchers connect primarily to local validators
    PREFERRED_PEERS="${VALIDATOR_PEERS%,}" # Remove trailing comma if any
    # If no local validators yet (shouldn't happen due to gatekeeper), fallback to SDF
    if [ -z "$PREFERRED_PEERS" ]; then
        PREFERRED_PEERS="$SDF_PEERS"
    fi
fi

echo -e "🔗 Peers Preferenciais: ${BLUE}$PREFERRED_PEERS${NC}"

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
      - NODE_SEED=$SECRET_SEED
      - PREFERRED_PEERS=$PREFERRED_PEERS
      - ENABLE_HAYSTACK=false
      - NETWORK=TESTNET
      - KNOWN_PEERS=$SDF_PEERS
      - NODE_IS_VALIDATOR=$IS_VALIDATOR
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
docker logs -f stellar-node
