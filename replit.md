# NOTAG Bot - Documentação do Projeto

## Descrição
Bot Discord completo para gerenciamento de guild Albion Online. Sistema de auditoria, controle de saldos, vendas BAU, e muito mais.

## Dependências Instaladas
- **sqlite3** (^5.1.6) - Banco de dados SQLite
- **axios** (^1.13.6) - Cliente HTTP para requisições
- **winston** (^3.19.0) - Logger para o aplicativo
- **chart.js** (^4.5.1) - Visualização de gráficos
- **discord.js** (^14.25.1) - API Discord
- **dotenv** (^16.3.1) - Variáveis de ambiente

## Scripts Disponíveis
- `npm start` - Inicia o bot normalmente
- `npm run dev` - Inicia com nodemon (reload automático)
- `npm run db:migrate` - Executa migrations do banco de dados

## Estrutura do Projeto
- `/handlers` - Handlers de comandos Discord
- `/services` - Serviços de negócio
- `/utils` - Utilitários
- `/commands` - Definição de comandos
- `/data` - Arquivos de dados
- `index.js` - Arquivo principal

## Workflow
- Workflow "Start application" configurado para rodar `npm start` em modo console
- O bot está rodando em background automaticamente

## Status
✅ Dependências instaladas com sucesso
✅ Workflow configurado e rodando
✅ Pronto para desenvolvimento
