# Stellar Testnet Manager

Este repositório contém o código fonte e scripts para gerenciar nós da Stellar Testnet.

## Estrutura do Projeto

- **dashboard/**: Aplicação Web (Next.js) para gerenciar a identidade e configuração dos nós.
- **setup-node.sh**: Script Bash para configurar automaticamente cada nó (validador ou watcher) baseado na configuração do Dashboard.
- **infos.txt**: Documentação sobre a topologia da rede.

## Como Usar

### 1. Iniciar o Dashboard
Navegue até a pasta `dashboard` e inicie o servidor:
```bash
cd dashboard
npm install
npm run build
npm start
```
Acesse `http://localhost:3000`.

### 2. Configurar os Nós
Em cada máquina que será um nó Stellar, execute o script de setup:
```bash
chmod +x setup-node.sh
./setup-node.sh
```
O script irá registrar a máquina no banco de dados. Em seguida, acesse o Dashboard para definir o papel (Role) e grupo de quórum da máquina. O script detectará a mudança e iniciará o nó automaticamente.

## Requisitos
- Docker e Docker Compose instalados nas máquinas dos nós.
- Node.js instalado no servidor do Dashboard.
- Banco de Dados PostgreSQL (Neon) configurado.
