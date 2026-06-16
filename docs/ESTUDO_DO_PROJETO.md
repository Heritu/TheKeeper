# Estudo do projeto The Keeper

## Visao geral

The Keeper é uma aplicação de gestão financeira pessoal e empresarial. O usuário cria uma conta, escolhe o perfil pessoal ou empresarial, registra movimentações, acompanha saldo e fluxo de caixa, controla cartões, compromissos financeiros, investimentos e usa um simulador para planejar metas.

O projeto está dividido em três partes principais:

- `backend`: API Express em TypeScript, banco SQLite e servidor de produção.
- `frontend-novo`: aplicacao React/Vite usada como interface principal.
- `scripts`: automações de validação e apoio para apresentação.

## Como o sistema inicia

Na raiz, `package.json` concentra os comandos principais:

- `npm run build`: gera o build do frontend React e do backend.
- `npm run check`: compila backend, compila frontend e roda lint.
- `npm run smoke`: executa uma checagem completa para apresentação.
- `npm run start`: inicia o backend ja compilado.
- `npm run dev:backend`: sobe o backend em modo desenvolvimento.
- `npm run dev:frontend`: sobe o Vite do frontend React.

O arquivo `rodar-apresentacao.bat` é o caminho mais simples para demonstração no Windows. Ele verifica se existe build em `frontend-novo/dist` e `backend/dist`; se não existir, gera os builds e inicia `backend/dist/server.js` em `http://localhost:3000`.

## Backend

Arquivo principal: `backend/src/server.ts`.

Responsabilidades:

- criar o app Express;
- servir o build do frontend React em `frontend-novo/dist`;
- registrar rotas HTTP;
- validar dados de entrada;
- aplicar regras de negocio;
- retornar respostas JSON;
- tratar erros da API;
- iniciar o servidor na porta `3000` por padrao.

Arquivo de banco: `backend/src/database.ts`.

Responsabilidades:

- abrir o SQLite;
- definir pragmas de segurança e concorrência;
- criar tabelas, indices e colunas faltantes;
- criar registros padrao do sistema;
- permitir mudar o caminho do banco com `KEEPER_DB_PATH`.

Banco padrao:

- `backend/database.sqlite`
- `backend/database.sqlite-wal`
- `backend/database.sqlite-shm`

Esses arquivos são ignorados pelo Git, mas devem ser levados no pacote final se a apresentação depender de dados já cadastrados.

## Modelo de dados

Tabelas principais:

- `usuarios`: nome, email, senha com hash e tipo de conta.
- `contas`: contas financeiras do usuário e saldo atual.
- `categorias`: classificacao de receitas/despesas.
- `movimentacoes`: lançamentos financeiros, com valor positivo para entrada e negativo para saída.
- `cartoes`: cartões de crédito, limite, uso, fechamento, vencimento e status ativo.
- `compromissos`: contas a pagar ou valores a receber, com vencimento, status e recorrencia.
- `investimentos`: ativos, reservas ou aplicações, com custo médio e valor atual.
- `auditoria`: registro de login e alterações feitas em rotas protegidas.

Ao cadastrar um usuário, o backend cria automaticamente:

- uma conta `Principal`;
- uma categoria `Geral`.

## Rotas da API

Autenticacao:

- `POST /api/auth/register`: cria usuário.
- `POST /api/auth/login`: autentica usuário.

Contas:

- `GET /api/contas`
- `POST /api/contas`
- `PUT /api/contas/:id`
- `DELETE /api/contas/:id`

Cartões:

- `GET /api/cartoes`
- `POST /api/cartoes`
- `PUT /api/cartoes/:id`
- `DELETE /api/cartoes/:id`

Categorias:

- `GET /api/categorias`
- `POST /api/categorias`
- `PUT /api/categorias/:id`
- `DELETE /api/categorias/:id`

Movimentações:

- `GET /api/movimentacoes`
- `POST /api/movimentacoes`
- `PUT /api/movimentacoes/:id`
- `DELETE /api/movimentacoes/:id`

Dashboard e analise:

- `GET /api/dashboard`
- `GET /api/fluxo-caixa`

Compromissos:

- `GET /api/compromissos`
- `POST /api/compromissos`
- `PUT /api/compromissos/:id`
- `DELETE /api/compromissos/:id`

Investimentos:

- `GET /api/investimentos`
- `POST /api/investimentos`
- `PUT /api/investimentos/:id`
- `DELETE /api/investimentos/:id`

Saude:

- `GET /api/health`

As rotas financeiras exigem token no cabeçalho `Authorization: Bearer ...`. O token é gerado no login e permite que o backend identifique o usuário autenticado sem confiar apenas no `usuario_id` enviado pelo frontend.

## Frontend React atual

Pasta principal: `frontend-novo`.

Arquivos centrais:

- `src/main.tsx`: entrada do React.
- `src/App.tsx`: rotas publicas e protegidas.
- `src/api.ts`: cliente HTTP, payloads, chamadas da API, token de autenticacao e sessao no `localStorage`.
- `src/types.ts`: contratos TypeScript usados pelas telas.
- `src/components/AppLayout.tsx`: estrutura interna com menu lateral, topo e botao de sair.
- `src/pdfReport.ts`: gera relatório financeiro via nova janela do navegador e `window.print()`.
- `src/index.css`: identidade visual e layout responsivo.

Rotas de tela:

- `/`: tela inicial.
- `/auth`: login e cadastro.
- `/dashboard`: painel financeiro.
- `/lancamentos`: registro e consulta de receitas/despesas.
- `/cartoes`: cadastro, edição, remoção e resumo de cartões.
- `/compromissos`: contas a pagar/receber e status.
- `/investimentos`: carteira pessoal ou reservas/aplicações do negócio.
- `/simulador`: simulador de metas e cenarios.

## Telas e responsabilidades

`Home.tsx`:

- apresenta o produto;
- leva para login/cadastro.

`Login.tsx`:

- alterna entre login e cadastro;
- valida confirmação de senha no cadastro;
- envia perfil `pessoal` ou `empresarial`;
- salva sessao apos login.

`Dashboard.tsx`:

- busca resumo financeiro e fluxo de caixa;
- mostra saldo, entradas, despesas, patrimônio investido e últimas movimentações;
- gera próximas ações conforme dados do usuário;
- permite gerar PDF.

`Lancamentos.tsx`:

- lista contas, categorias e movimentações;
- registra entrada ou despesa;
- usa modelos rapidos como salario, mercado, aluguel e cliente;
- atualiza saldo da conta no backend;
- permite busca e filtro por tipo.

`Cartoes.tsx`:

- lista cartões;
- calcula limite total, limite usado e disponivel;
- cadastra, edita e remove cartões;
- mostra status visual por uso: saudavel, atencao, critico ou inativo.

`Compromissos.tsx`:

- cadastra contas a pagar e valores a receber;
- calcula total a pagar, total a receber e saldo previsto;
- marca compromissos como pagos ou cancelados;
- destaca vencidos e próximos compromissos.

`Investimentos.tsx`:

- muda textos e categorias conforme perfil pessoal ou empresarial;
- cadastra investimentos, reservas ou aplicações;
- calcula valor atual, custo total e resultado;
- mostra distribuicao por tipo.

`Simulador.tsx`:

- simula meta financeira por prazo, aporte e crescimento mensal;
- compara cenarios conservador, base e otimista;
- pode usar saldo real vindo do dashboard como saldo inicial.

## Fluxo principal do usuário

1. Usuário entra em `/`.
2. Clica para acessar `/auth`.
3. Cria conta pessoal ou empresarial.
4. Faz login.
5. Sessao e salva no `localStorage` como `keeper_session`, `keeper_user` e `keeper_tipo`.
6. O token salvo em `keeper_session` e enviado nas chamadas para rotas protegidas.
7. Rotas protegidas passam a abrir dentro do `AppLayout`.
8. Usuário registra movimentações, cartões, compromissos e investimentos.
9. Dashboard consolida dados reais do banco.
10. Simulador usa dados do dashboard como apoio para planejamento.

## Pontos importantes para roteiro

- O sistema mostra dois perfis: pessoal e empresarial.
- A diferenca entre perfis aparece principalmente nos textos, categorias de investimento e posicionamento da interface.
- O frontend usado na apresentação fica em `frontend-novo`.
- O backend usa token para identificar o usuário nas rotas financeiras.
- A tabela `auditoria` registra login e alterações bem-sucedidas.
- Movimentações são o centro financeiro: elas alteram saldo de contas e alimentam dashboard e fluxo de caixa.
- Compromissos não alteram saldo automaticamente; eles funcionam como agenda/previsão.
- Cartões controlam limite e vencimento, mas não geram fatura automaticamente.
- Investimentos entram no patrimônio consolidado, mas não movimentam conta automaticamente.
- O PDF é gerado no navegador, não no backend.

## Validação atual

Comando executado:

```powershell
npm.cmd run check
```

Resultado:

- build TypeScript do backend: OK;
- build de produção do frontend React: OK;
- lint do frontend React: OK.

Para validação completa antes de apresentar, usar:

```powershell
npm.cmd run smoke
```

Esse smoke test cria um banco temporário, sobe o servidor real, testa rotas de tela, cadastro, login com token, rejeição de rota protegida sem token, chamadas autenticadas, movimentações, cartões, compromissos e investimentos.

## Estrutura resumida

```text
TheKeeper/
  backend/
    src/
      server.ts        API, rotas e regras de negocio
      database.ts      SQLite, tabelas, indices e seed
    package.json       scripts e dependencias do backend
    tsconfig.json      configuracao TypeScript do backend

  frontend-novo/
    src/
      App.tsx          roteamento
      api.ts           chamadas HTTP, token e sessao local
      types.ts         contratos TypeScript
      pdfReport.ts     relatório imprimível
      components/
        AppLayout.tsx  layout autenticado
      pages/           telas da aplicacao
      index.css        visual do produto
    package.json       scripts e dependencias do frontend

  scripts/
    smoke-apresentacao.ps1

  CHECAGEM_APRESENTACAO.md
  rodar-apresentacao.bat
  package.json
```
