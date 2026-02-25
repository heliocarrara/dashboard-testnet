#!/bin/bash

# ==============================================================================
# 🌌 STELLAR TESTNET NODE SETUP
# ==============================================================================
# - Auto-configuration via Neon DB
# - Roles: validator, watcher
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

IMAGE="docker.io/stellar/quickstart:latest"
VOLUME_PATH="/srv/stellar_testnet_data"

# SDF Testnet Nodes (for Quorum & Peers)
SDF_PEERS="core-testnet1.stellar.org:11625,core-testnet2.stellar.org:11625,core-testnet3.stellar.org:11625"
# SDF Validator Keys (Testnet)
SDF_KEYS='["GDKXE2OZMJIPOM4F6TPQ7YVB2BEUYC6UZ4P2GMYHI2G2BBVM37IF7776","GCUCJTIYXQEKARJXWAJEVJDTS2XP3NOQSCAPJNZQQ9F7T27KLRD2ADB6","GABMKJM6I25XI4K7U6XWMULOUQIQ27BCTMLS6BYYSOWKTBUIS6JI7HYE"]'

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
    run_sql_cmd "INSERT INTO $TABLE_IDENTITY (hostname, ip_address, node_seed, public_key, role, quorum_group) VALUES ('$MY_HOSTNAME', '$MY_IP', '$SECRET_SEED', '$PUBLIC_KEY', NULL, 0);" > /dev/null
    
    echo -e "${GREEN}   -> Registrado no Dashboard! Aguardando configuração de Role...${NC}"
    EXISTING_ROLE="none"
else
    # Update IP if changed
    run_sql_cmd "UPDATE $TABLE_IDENTITY SET ip_address = '$MY_IP' WHERE hostname = '$MY_HOSTNAME';" > /dev/null
    
    SECRET_SEED=$(echo "$EXISTING" | cut -d'|' -f1)
    PUBLIC_KEY=$(echo "$EXISTING" | cut -d'|' -f2)
    EXISTING_ROLE=$(echo "$EXISTING" | cut -d'|' -f3)
    QUORUM_GROUP=$(echo "$EXISTING" | cut -d'|' -f4)
    
    echo -e "${GREEN}   -> Identidade carregada.${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Wait for Configuration
# ------------------------------------------------------------------------------
while [ "$EXISTING_ROLE" == "none" ]; do
    echo -e "${YELLOW}⏳ Aguardando configuração de 'role' no Dashboard... (Verificando em 10s)${NC}"
    sleep 10
    EXISTING=$(run_sql_cmd "SELECT COALESCE(role, 'none') FROM $TABLE_IDENTITY WHERE hostname = '$MY_HOSTNAME';" | xargs)
    EXISTING_ROLE=$EXISTING
done

echo -e "${GREEN}✅ Configuração recebida: ROLE = $EXISTING_ROLE${NC}"

# ------------------------------------------------------------------------------
# 4. Configure Network Topology
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
    # If no local validators yet, fallback to SDF to at least boot
    if [ -z "$PREFERRED_PEERS" ]; then
        PREFERRED_PEERS="$SDF_PEERS"
    fi
fi

echo -e "🔗 Peers Preferenciais: ${BLUE}$PREFERRED_PEERS${NC}"

# ------------------------------------------------------------------------------
# 5. Generate Docker Compose
# ------------------------------------------------------------------------------
cat > docker-compose.yml <<EOF
services:
  stellar-core:
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
      # Simple Quorum Config: Trust SDF nodes always (critical for Testnet sync)
      - KNOWN_PEERS=$SDF_PEERS
EOF

# Add specific configs
if [ "$EXISTING_ROLE" == "validator" ]; then
    echo "      - NODE_IS_VALIDATOR=true" >> docker-compose.yml
else
    echo "      - NODE_IS_VALIDATOR=false" >> docker-compose.yml
fi

# Volumes
cat >> docker-compose.yml <<EOF
    volumes:
      - $VOLUME_PATH:/var/lib/stellar
    command: ["--testnet", "--enable", "core,horizon,rpc"]
EOF

# ------------------------------------------------------------------------------
# 6. Start
# ------------------------------------------------------------------------------
echo -e "${GREEN}🚀 Iniciando nó Stellar ($EXISTING_ROLE)...${NC}"
docker compose up -d
docker logs -f stellar-node
