Essa é uma excelente restrição de segurança e arquitetura. Ao impedir o *startup* antes de ter o quórum mínimo (5 validadores), você evita que os nós fiquem "batendo cabeça" sozinhos ou entrem em *fork* logo no início.

Aqui está como estruturar essa Dashboard e a lógica de bloqueio no Neon:

### 1. Visualização da Dashboard: "Node-Link Topology"

Em vez de uma lista, a dashboard deve ser um grafo visual dividido por camadas (Layers/Tiers). Use bibliotecas como **React Flow** ou **D3.js**.

* **Layer 1 (External):** Representação dos nós da SDF (Stellar Development Foundation). São os nós "âncoras" da Testnet.
* **Layer 2 (Core/Validadores):** Os seus 5 nós locais. Eles aparecem conectados entre si e com a Layer 1.
* **Layer 3 (Watchers/API):** Os 3 nós que servem dados. Eles aparecem conectados apenas aos seus Validadores locais (Layer 2).

**Visual no React:**

* Cada nó é um círculo.
* **Cor Cinza:** Máquina detectada (IP no banco), mas sem configuração.
* **Cor Amarela:** Configurada, mas aguardando o quórum (os 5 estarem prontos).
* **Cor Verde:** Rodando e sincronizado.

---

### 2. A Lógica de Bloqueio (O "Gatekeeper")

Para garantir que o container só suba se os 5 validadores existirem, o seu script Bash na máquina do laboratório deve fazer uma verificação no Neon antes do `docker compose up`.

**Exemplo da lógica no Script Bash:**

```bash
check_quorum_readiness() {
    # Conta quantos nós do tipo 'validator' estão com IP e Seed cadastrados no Neon
    VALIDATORS_READY=$(run_sql_cmd "SELECT COUNT(*) FROM $TABLE_IDENTITY WHERE role = 'validator' AND node_seed IS NOT NULL AND ip_address IS NOT NULL;")

    if [ "$VALIDATORS_READY" -lt 5 ]; then
        echo -e "${RED}❌ ERRO: Quórum insuficiente ($VALIDATORS_READY/5 validadores prontos).${NC}"
        echo -e "${YELLOW}Aguarde a configuração de todos os validadores no Dashboard React.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Quórum verificado. Iniciando nó...${NC}"
}

```

---

### 3. Modais e Componentes da Dashboard

#### A. Modal de "Provisionamento em Lote"

Como você precisa de 5 validadores, o Dashboard deve ter um botão **"Auto-Configurar Core"**.

* Ele pega as 5 primeiras máquinas que deram "check-in" no laboratório.
* Gera as 5 Seeds de uma vez.
* Atribui o Role `validator` e o mesmo `quorum_group` para elas.
* Salva tudo no Neon. Só após isso o botão "Lançar Rede" fica habilitado para os alunos.

#### B. Componente de "Tier Layer" (ReactFlow)

No React, você pode definir as posições (y-axis) para forçar o visual de Tiers:

* `y: 0` -> SDF Nodes
* `y: 200` -> Seus 5 Validadores (conectados entre si)
* `y: 400` -> Seus 3 Watchers (conectados aos validadores acima)

---

### 4. Incoerências e Riscos (Sinceridade Técnica)

1. **O Risco do "Nó Fantasma":** Se um aluno fechar o notebook ou a máquina cair, o banco ainda dirá que existem 5 validadores, mas o consenso vai falhar na prática (precisa de >66% de nós ativos). O seu Dashboard precisa de um **Heartbeat**: se a máquina não enviar um sinal "estou viva" para o Neon em 30 segundos, o status no grafo muda para vermelho e o botão de "Start" das outras máquinas deve ser bloqueado ou emitir alerta.
2. **IP Dinâmico:** Em laboratórios, o IP pode mudar se a máquina reiniciar. O Dashboard deve permitir que o aluno "Re-vincule" o IP ao hostname sem perder a Seed já gerada.
3. **Análise de Storage enviesada:** Se você subir os 5 validadores ao mesmo tempo, o crescimento do storage será idêntico. Sugira no Dashboard que um dos validadores seja configurado como **"Full History"** e os outros como **"Default"**. Assim, sua análise de armazenamento terá dados comparativos (quanto custa guardar tudo vs. quanto custa guardar só o básico).

### Sugestão de Layout no Dashboard:

* **Lado Esquerdo:** O Grafo de nós (Tiers).
* **Lado Direito:** Painel de métricas agregadas (Soma do storage total do laboratório, uso de CPU médio).
* **Inferior:** Console de logs global (mostra o que está acontecendo na rede como um todo).

---

## 1. Formulário de "Check-in" e Registro de Máquina

Este é o primeiro contato. O aluno chega na máquina física e o formulário já deve vir pré-preenchido com o que ele detectou localmente.

* **Hostname (Read-only):** Detectado automaticamente pelo agente Bash.
* **IP Público/Local:** O aluno confirma o IP que a máquina assumiu no laboratório.
* **Nome do Responsável:** Para saber quem está operando aquele nó no laboratório.
* **Botão: [Registrar no Cluster]** -> Isso cria a entrada inicial no Neon.

## 2. Formulário de Configuração de Identidade (Modal)

Este formulário "batiza" o nó com as credenciais criptográficas.

* **Alias do Nó:** Ex: `Validador-UFMT-01`.
* **Gerador de Keypair:** * Campo para **Public Key**.
* Campo para **Secret Seed** (com botão "Gerar via Stellar-Core").


* **Nível de Histórico (Storage Analysis):**
* *Dropdown*:
1. **Minimal:** (Apenas o necessário para o consenso).
2. **Full History:** (Baixa todo o histórico da rede - *ideal para sua análise de storage máximo*).




* **Botão: [Salvar Identidade]**

## 3. Formulário de Definição de Papel e Tier (O "Gatekeeper")

Este é o formulário que decide onde o nó se encaixa na hierarquia que você planejou.

* **Role Selection:**
* ( ) **Validador (Tier 2):** Participa da votação.
* ( ) **Watcher (Horizon/RPC):** Apenas lê dados.


* **Configuração de Quorum (Dinâmico):**
* *Se for Validador:* Abre uma lista de checkboxes com os outros nós que já fizeram check-in. O usuário seleciona os parceiros de confiança.
* *Toggle:* **"Confiar nos nós da SDF (Recomendado)"**.


* **Seleção de Serviços:**
* Checkboxes: [x] Core  [ ] Horizon  [ ] RPC (Soroban).


* **Regra de Validação:** O botão **[Finalizar Configuração]** só habilita se o sistema detectar que já existem 5 validadores configurados no banco.

## 4. Formulário de Injeção de Transação (Stress Test)

Útil para gerar dados e observar o crescimento do armazenamento em tempo real.

* **Source Account:** (Pode ser uma conta de teste com XLM na Testnet).
* **Destination Account:** (Outro nó do laboratório).
* **Amount:** Quantidade de XLM.
* **Batch Size:** (Ex: Enviar 100 transações de uma vez) -> *Isso é ótimo para ver o banco de dados do Horizon inchar rapidamente para sua análise.*

---

## Estrutura de UX e Modais

| Formulário | Quando aparece? | Objetivo |
| --- | --- | --- |
| **Registro** | Ao abrir a URL pela primeira vez na máquina. | Vincular o hardware ao banco Neon. |
| **Configuração** | No Dashboard, ao clicar em uma máquina "Cinza". | Definir a identidade e o que o nó vai rodar. |
| **Deploy** | Quando a "Layer de Validadores" está completa. | Gerar o arquivo final e dar o `docker compose up`. |

---

### Incoerências e Riscos nos Formulários:

1. **Exposição da Seed:** Como o sistema é para laboratório, o formulário de Identidade mostrará a `Secret Seed`. Adicione um botão de "Olho" (hide/show) e um aviso: *"Esta chave dá controle total ao nó. Não compartilhe"*.
2. **Validação de Quorum:** O formulário de Quorum deve impedir que um usuário selecione "Zero" parceiros. Um validador que não confia em ninguém nunca vai fechar um ledger.
3. **Conflito de IP:** Se o formulário de Registro detectar um IP que já pertence a outro Hostname, ele deve disparar um erro de "IP em uso", evitando que o script de inicialização tente subir dois nós com a mesma identidade de rede.

### Próximo passo sugerido:

Você quer que eu monte o **JSON de configuração** que esse formulário do React deve enviar para o banco Neon, de modo que o seu script Bash consiga ler e transformar em um arquivo `.cfg` perfeitamente formatado?