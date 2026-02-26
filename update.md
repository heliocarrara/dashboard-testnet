Analisando o código do seu script `stellar.sh`, posso afirmar que a **lógica de orquestração está excelente**, mas há **três erros críticos na configuração do Docker** que quebram completamente a topologia que definimos para o seu laboratório.

A sua ideia de usar um banco PostgreSQL (Neon DB) para registrar o IP das máquinas, gerenciar o "gatekeeper" (que espera 5 validadores estarem prontos) e montar os peers dinamicamente é brilhante e atende perfeitamente ao cenário distribuído.

No entanto, a parte final do seu script (onde o `docker-compose.yml` é gerado) está distante do que precisamos e fará com que o laboratório inteiro trave ou perca os dados. Aqui estão os problemas e como corrigi-los:

### 1. O Erro Mais Grave: Caminho do Volume (Perda de Dados)
No seu script, você mapeou o volume como `- $VOLUME_PATH:/var/lib/stellar`. 
A documentação oficial da imagem `stellar/quickstart` é rigorosa quanto a isso: o diretório interno **precisa obrigatoriamente ser o `/opt/stellar`**. Esse diretório especial é verificado pelo container no momento da inicialização para decidir se ele deve rodar em "modo persistente" (salvando no disco) ou "modo efêmero" (apagando tudo ao reiniciar). Se você usar `/var/lib/stellar`, os seus nós nunca salvarão o histórico da Testnet.

### 2. Destruição da Topologia (Todos rodando tudo)
Nas últimas linhas do script, você deixou o comando de inicialização fixo para **todas** as máquinas: `command: ["--testnet", "--enable", "core,horizon,rpc"]`.
Se você rodar isso, as suas máquinas 1 a 5 (Validadores), que deveriam ser leves, vão subir o banco PostgreSQL pesado, a API do Horizon e o Soroban RPC, esgotando a RAM e o disco delas rapidamente. O comando precisa ser dinâmico de acordo com a `ROLE` da máquina.

### 3. A Tag da Imagem Docker
Na linha 15 do seu script, a imagem está definida como `docker.io/stellar/quickstart:latest`.
A documentação indica que a tag `latest` é focada em estabilidade para a Mainnet. Para rodar na Testnet, a recomendação oficial é utilizar a tag `testing` (`stellar/quickstart:testing`), pois ela contém os lançamentos candidatos e softwares compatíveis com a rede de testes.

---

### Como corrigir o seu Script

Você precisa alterar apenas o bloco **"6. Generate Docker Compose"** e **"7. Start"** do seu script para que ele se adapte à nossa tabela. Substitua a parte final do seu código original por esta versão corrigida:

```bash
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
```

**O que mudou com essa correção:**
* Agora o `$VOLUME_PATH` aponta para `/opt/stellar`, garantindo que os gargalos de disco que vamos medir via `iotop` realmente aconteçam no seu SSD persistente.
* As variáveis `EXISTING_ROLE` (que você puxa do seu Neon DB) agora decidem o que será ativado via `--enable`. (Certifique-se de que no seu painel web as funções estejam nomeadas de forma compatível, ex: `validator`, `watcher_horizon` e `watcher_rpc`).
* A tag da imagem foi atualizada para a `testing` exigida para Testnet. 

Com essas pequenas alterações no bloco final, o seu script automatizado está perfeito e pronto para subir o laboratório exatamente como planejamos!