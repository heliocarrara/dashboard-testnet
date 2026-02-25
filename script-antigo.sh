#!/bin/bash

# ==============================================================================
# 🌌 STELLAR TESTNET MANAGER
# ==============================================================================
# - Gerencia nó Stellar na TESTNET
# - Identidade e peers manuais no Postgres (Neon)
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
TABLE_PEERS="testnet_manual_peers"

IMAGE="docker.io/stellar/quickstart:latest"
VOLUME_PATH="/srv/stellar_testnet_data"  # Caminho local para armazenar dados persistentes

# ------------------------------------------------------------------------------
# Criar diretório para persistência de dados
# ------------------------------------------------------------------------------
echo -e "${BLUE}🔄 Criando diretório de dados persistentes...${NC}"
sudo mkdir -p $VOLUME_PATH
sudo chown $(whoami):$(whoami) $VOLUME_PATH
echo -e "${GREEN}✅ Diretório de dados criado em $VOLUME_PATH${NC}"

# ------------------------------------------------------------------------------
# Função Auxiliar SQL
# ------------------------------------------------------------------------------
run_sql_cmd() {
    docker run --rm \
      --entrypoint /bin/bash \
      "$IMAGE" \
      -c "psql \"$DB_URL\" -t -c \"$1\""
}

# ------------------------------------------------------------------------------
# Inicialização do Banco
# ------------------------------------------------------------------------------
bootstrap_db() {
    echo -e "${BLUE}🔄 Verificando banco de dados...${NC}"

    SQL="
    CREATE TABLE IF NOT EXISTS $TABLE_IDENTITY (
        id SERIAL PRIMARY KEY,
        hostname TEXT UNIQUE,
        node_seed TEXT NOT NULL,
        public_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS $TABLE_PEERS (
        ip_address TEXT PRIMARY KEY,
        added_at TIMESTAMP DEFAULT NOW()
    );
    "

    run_sql_cmd "$SQL" > /dev/null
}

# ------------------------------------------------------------------------------
# Identidade do Nó
# ------------------------------------------------------------------------------
check_identity() {
    echo -e "${BLUE}🔑 Verificando identidade...${NC}"

    MY_HOSTNAME=$(hostname)

    EXISTING=$(run_sql_cmd \
      "SELECT node_seed || '|' || public_key FROM $TABLE_IDENTITY WHERE hostname = '$MY_HOSTNAME';" \
    | xargs)

    if [ -z "$EXISTING" ]; then
        echo -e "${YELLOW}   -> Nenhuma identidade encontrada para $MY_HOSTNAME. Gerando nova...${NC}"

        KEYPAIR=$(docker run --rm \
          --entrypoint /bin/bash \
          "$IMAGE" \
          -c "stellar-core gen-seed")

        SECRET_SEED=$(echo "$KEYPAIR" | grep "Secret seed:" | awk '{print $3}')
        PUBLIC_KEY=$(echo "$KEYPAIR" | grep "Public:" | awk '{print $2}')

        run_sql_cmd \
          "INSERT INTO $TABLE_IDENTITY (hostname, node_seed, public_key)
           VALUES ('$MY_HOSTNAME', '$SECRET_SEED', '$PUBLIC_KEY');" \
          > /dev/null

        echo -e "${GREEN}   -> Nova identidade salva para $MY_HOSTNAME!${NC}"
    else
        SECRET_SEED=$(echo "$EXISTING" | cut -d'|' -f1)
        PUBLIC_KEY=$(echo "$EXISTING" | cut -d'|' -f2)

        echo -e "${GREEN}   -> Identidade carregada: $PUBLIC_KEY${NC}"
    fi
}

# ------------------------------------------------------------------------------
# Gerenciar Peers
# ------------------------------------------------------------------------------
manage_peers() {
    while true; do
        echo -e "\n--- 🌐 Gerenciar Peers Manuais ---"
        echo "Peers atuais no banco:"

        PEERS=$(run_sql_cmd "SELECT ip_address FROM $TABLE_PEERS;" | awk 'NF')

        if [ -z "$PEERS" ]; then
            echo "   (Nenhum peer cadastrado)"
        else
            echo "$PEERS" | sed 's/^/   - /'
        fi

        echo -e "\n1) Adicionar Peer (IP)"
        echo "2) Remover Peer (IP)"
        echo "0) Voltar"
        read -p "Opção: " PEER_OPT

        case $PEER_OPT in
            1)
                read -p "Digite o IP do Peer: " NEW_IP
                [ -n "$NEW_IP" ] && \
                  run_sql_cmd \
                    "INSERT INTO $TABLE_PEERS (ip_address)
                     VALUES ('$NEW_IP') ON CONFLICT DO NOTHING;" \
                    > /dev/null
                ;;
            2)
                read -p "Digite o IP para remover: " DEL_IP
                run_sql_cmd \
                  "DELETE FROM $TABLE_PEERS WHERE ip_address = '$DEL_IP';" \
                  > /dev/null
                ;;
            0) return ;;
        esac
    done
}

# ------------------------------------------------------------------------------
# Iniciar Nó
# ------------------------------------------------------------------------------
start_node() {
    echo -e "${GREEN}🚀 Preparando nó na TESTNET...${NC}"

    MANUAL_PEERS=$(run_sql_cmd "SELECT ip_address FROM $TABLE_PEERS;" | xargs)

    PREFERRED_PEERS=""
    for IP in $MANUAL_PEERS; do
        PREFERRED_PEERS+="${IP}:11625,"
    done
    PREFERRED_PEERS="${PREFERRED_PEERS%,}"

    echo -e "Peers Manuais: ${YELLOW}${PREFERRED_PEERS:-Nenhum}${NC}"

    cat > docker-compose.yml <<EOF
services:
  stellar-testnet:
    image: $IMAGE
    container_name: stellar-testnetmo
    restart: unless-stopped
    ports:
      - "8000:8000"
      - "11625:11625"
      - "11626:11626"
      - "8003:8003"
    environment:
      - NODE_SEED=$SECRET_SEED
      - PREFERRED_PEERS=$PREFERRED_PEERS
      - ENABLE_HAYSTACK=false
    volumes:
      - $VOLUME_PATH:/mnt/stellar  # Mapeando o volume persistente
    command: ["--testnet", "--enable", "core,horizon,rpc"]
EOF

    docker compose up -d
    echo -e "${GREEN}✅ Nó iniciado na Testnet!${NC}"
}

# ------------------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------------------
echo -e "${YELLOW}--- 🌌 Stellar Testnet Manager ---${NC}"

command -v docker >/dev/null || {
    echo -e "${RED}Docker não encontrado!${NC}"
    exit 1
}

bootstrap_db
check_identity

while true; do
    echo -e "\n--- Menu Principal ---"
    echo "1) 🚀 INICIAR / REINICIAR Nó Testnet"
    echo "2) 🛑 PARAR Nó"
    echo "3) 🌐 Configurar Peers Manuais"
    echo "4) 📊 Ver Status (Logs)"
    echo "0) Sair"

    read -p "Opção: " OPTION

    case $OPTION in
        1) start_node ;;
        2) docker compose stop ;;
        3) manage_peers ;;
        4) docker logs --tail 50 stellar-testnet ;;
        0) exit 0 ;;
        *) echo "Opção inválida" ;;
    esac
done
