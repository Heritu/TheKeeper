# Possíveis perguntas da apresentação

## Projeto

### Qual e o nome do projeto?

O projeto se chama **The Keeper**.

### O que o The Keeper faz?

É um sistema de gestão financeira pessoal e empresarial. Ele permite controlar entradas, despesas, saldo, cartões, compromissos, investimentos e simular metas financeiras.

### Qual problema o sistema resolve?

Ele ajuda o usuário a organizar sua vida financeira em um só lugar, evitando controle espalhado em planilhas, anotações ou memória.

### Qual e o publico-alvo?

O sistema atende dois perfis: usuários pessoais e usuários empresariais. No cadastro, o usuário escolhe o tipo de conta.

### Qual o diferencial do projeto?

O diferencial é juntar controle diário, dashboard, agenda financeira, investimentos e simulador em uma interface única, com separação entre perfil pessoal e empresarial.

## Tecnologias

### Quais tecnologias foram usadas?

No frontend usamos **React**, **TypeScript**, **Vite**, **React Router** e **CSS**. No backend usamos **Node.js**, **Express** e **TypeScript**. O banco de dados e **SQLite**.

### Por que usar React?

React facilita criar uma interface dividida em componentes, com telas reutilizaveis, atualizacao dinamica e melhor organizacao do frontend.

### Por que usar TypeScript?

TypeScript ajuda a evitar erros durante o desenvolvimento, porque permite tipar dados, respostas da API e propriedades usadas nas telas.

### Por que usar SQLite?

SQLite é leve, local e simples para demonstração. Ele não exige servidor de banco separado, então facilita executar o projeto em outro computador.

### Por que usar Express?

Express foi usado para criar a API HTTP, organizar rotas e conectar o frontend com o banco SQLite.

## Frontend

### Quais telas existem no sistema?

As principais telas são: início, login/cadastro, dashboard, lançamentos, cartões, compromissos, investimentos e simulador.

### Onde ficam as rotas do frontend?

As rotas ficam em `frontend-novo/src/App.tsx`.

### Onde fica o layout principal?

O layout autenticado fica em `frontend-novo/src/components/AppLayout.tsx`.

### Onde o frontend chama o backend?

As chamadas para a API ficam centralizadas em `frontend-novo/src/api.ts`.

### Como o sistema protege as telas internas?

O frontend verifica se existe uma sessão com token salva no `localStorage`. Se não existir, o usuário é redirecionado para `/auth`. No backend, as rotas financeiras exigem esse token.

### O que fica salvo no navegador?

O sistema salva dados basicos da sessao no `localStorage`, como `keeper_session`, `keeper_user` e `keeper_tipo`. Dentro da sessao fica o token usado nas chamadas autenticadas.

### Qual e a funcao do dashboard?

O dashboard resume o saldo, entradas, despesas, patrimônio investido, últimas movimentações, próximos compromissos e fluxo de caixa.

### O que a tela de lançamentos faz?

Ela permite cadastrar receitas e despesas, consultar o histórico por mês, filtrar por busca ou tipo e gerar um histórico mensal em PDF. Receitas entram como valor positivo e despesas entram como valor negativo.

### O que a tela de cartões faz?

Ela permite cadastrar cartões, controlar limite total, limite usado, limite disponível, fechamento, vencimento e status.

### O que a tela de compromissos faz?

Ela controla contas a pagar e valores a receber. Também permite marcar como pago, cancelar ou remover.

### O que a tela de investimentos faz?

Ela registra investimentos pessoais ou reservas/aplicações da empresa, calculando valor atual, custo total e resultado.

### O que o simulador faz?

O simulador projeta uma meta financeira usando saldo inicial, aporte mensal, prazo, crescimento mensal e cenarios conservador, base e otimista.

### Como o PDF e gerado?

O PDF é gerado no navegador. O sistema abre uma nova janela com o relatório formatado e chama `window.print()`.

### O sistema gera PDF por mês?

Sim. Na tela de lançamentos, o usuário escolhe o mês do histórico e clica em `Histórico Mensal`. O relatório sai com entradas, despesas, resultado e movimentações daquele período.

## Backend

### Onde fica o backend?

O backend fica na pasta `backend`.

### Quais são os arquivos principais do backend?

`backend/src/server.ts` inicia o processo, enquanto `backend/src/app.ts` monta o Express e conecta as rotas.

### O que tem no `server.ts`?

Ele abre o banco, inicia o servidor HTTP e trata o encerramento. As rotas ficam separadas por domínio em `backend/src/routes`.

### Onde o banco e configurado?

O banco e configurado em `backend/src/database.ts`.

### O que tem no `database.ts`?

Ele abre o SQLite, cria tabelas, indices, colunas faltantes e registros padrao do sistema.

### Qual porta o backend usa?

Por padrao, o backend usa a porta `3000`.

### O backend também serve o frontend?

Sim. Em produção, o backend serve somente o build do React em `frontend-novo/dist`.

### Onde está o frontend usado na apresentação?

O frontend usado na apresentação está em `frontend-novo`. Ele é a interface atual do sistema, feita com React, TypeScript e Vite.

## Banco de dados

### Qual banco de dados foi usado?

Foi usado SQLite.

### Onde fica o arquivo do banco?

Por padrao, fica em `backend/database.sqlite`.

### Quais tabelas principais existem?

As principais tabelas são `usuarios`, `contas`, `categorias`, `movimentacoes`, `cartoes`, `compromissos` e `investimentos`.

### O que acontece quando um usuário é cadastrado?

O sistema cria o usuário, salva a senha com hash, cria uma conta `Principal` e uma categoria `Geral`.

### Como o sistema impede email duplicado?

O campo `email` da tabela `usuarios` tem restrição `UNIQUE`. Além disso, o backend trata o erro e retorna uma resposta informando que o email já está em uso.

### Como mostrar a não duplicidade no banco?

Abra a tabela `usuarios` e mostre que o campo `email` é único. Depois, tente cadastrar o mesmo email novamente e mostre que o sistema rejeita.

### O que acontece se tentar cadastrar o mesmo email?

O backend retorna erro `409` com a mensagem de que ja existe uma conta usando aquele email.

## Criptografia e segurança

### A senha fica salva em texto puro?

Não. A senha é salva com hash usando `crypto.scrypt`.

### Como mostrar a criptografia no banco?

Abra a tabela `usuarios` e mostre a coluna `senha`. Ela aparece com formato parecido com `scrypt$...$...`, não com a senha digitada.

### O que significa `scrypt$...$...`?

Significa que a senha foi processada com o algoritmo `scrypt`, usando salt e hash. O sistema não guarda a senha original.

### Onde a senha é criptografada?

No backend, em `backend/src/utils/security.ts`, nas funções relacionadas a `hashSenha`, `scryptAsync` e `verificarSenha`.

### O sistema usa JWT?

Ele usa um token assinado no backend, enviado no cabeçalho `Authorization: Bearer ...`. A estrutura é semelhante a uma autenticação por token; em uma produção maior, poderia ser substituída por JWT padronizado ou sessão segura com rotação e refresh token.

### O sistema está pronto para produção?

Ele está adequado para apresentação e MVP. Para produção, ainda seria importante adicionar HTTPS, rotação de token, recuperação de senha, políticas de senha, backups automatizados, logs centralizados e testes automatizados mais completos.

### O usuário consegue acessar dados de outro usuário?

O backend usa o usuário identificado pelo token nas rotas protegidas. Mesmo que alguém altere manualmente o `usuario_id` enviado pelo navegador, o backend prioriza o usuário autenticado no token.

### O sistema registra auditoria?

Sim. O banco possui uma tabela `auditoria` para registrar login e alterações bem-sucedidas em rotas protegidas, como cadastros, edições e remoções feitas pelo usuário.

## Regras de negocio

### Como o saldo e calculado?

O saldo vem das contas cadastradas. Quando uma movimentacao e criada, editada ou removida, o backend atualiza o saldo da conta.

### Por que despesas sao negativas?

Porque isso facilita calcular saldo e fluxo de caixa. Entradas somam e despesas subtraem.

### O que acontece ao cadastrar uma despesa?

O frontend envia o valor negativo para o backend, o backend cria a movimentacao e subtrai esse valor do saldo da conta.

### O que acontece ao excluir uma movimentacao?

O backend remove a movimentacao e desfaz o impacto dela no saldo da conta.

### O que acontece se editar uma movimentacao?

O backend ajusta o saldo considerando a diferenca entre o valor antigo e o novo. Se a conta mudar, ele remove o valor da conta antiga e aplica na nova.

### Compromissos alteram o saldo?

Não. Compromissos funcionam como agenda financeira e previsão. Eles não alteram saldo automaticamente.

### Cartões alteram o saldo?

Não diretamente. A tela de cartões controla limite e uso, mas não gera fatura nem movimentação automática.

### Investimentos alteram o saldo?

Não diretamente. Eles entram no patrimônio consolidado, mas não movimentam automaticamente uma conta.

### Como o fluxo de caixa e montado?

O backend agrupa as movimentações por mês, separando entradas, saídas e resultado.

## Demonstracao

### Qual ordem seguir na apresentação?

1. Falar o nome do projeto.
2. Explicar o objetivo.
3. Falar as tecnologias.
4. Navegar pelo frontend.
5. Fazer ou mostrar cadastro/login.
6. Mostrar dashboard e funcionalidades.
7. Mostrar no banco a senha com hash.
8. Mostrar que email duplicado não é aceito.
9. Abrir o backend se o professor pedir.

### Quais arquivos abrir se o professor pedir backend?

Abra primeiro:

- `backend/src/app.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/movimentacoes.ts`
- `backend/src/database.ts`
- `frontend-novo/src/api.ts`

### Onde mostrar as rotas da API?

Em `backend/src/app.ts` é possível ver os grupos; os métodos de cada endpoint ficam nos arquivos de `backend/src/routes`.

### Onde mostrar as tabelas do banco?

Em `backend/src/database.ts`, na funcao `setupDatabase`, onde aparecem os comandos `CREATE TABLE IF NOT EXISTS`.

### Onde mostrar o email único?

Em `backend/src/database.ts`, na criação da tabela `usuarios`, onde o campo `email` aparece como `TEXT UNIQUE NOT NULL`.

### Onde mostrar o cadastro?

No backend, mostre `backend/src/routes/auth.ts`. No frontend, mostre `Login.tsx`, que chama `cadastrar`.

### Onde mostrar o login?

No backend, mostre `backend/src/routes/auth.ts`. No frontend, mostre a função `login` em `frontend-novo/src/api.ts`.

## Testes

### Como vocês testaram o sistema?

Usamos comandos de build, lint e smoke test. O smoke test sobe o servidor real, testa rotas, cadastro, login e fluxos principais da API.

### Qual comando valida tudo antes da apresentação?

Use:

```powershell
npm.cmd run smoke
```

### O que o smoke test verifica?

Ele verifica build, lint, servidor, rotas principais, cadastro, login com token, rejeição de rota protegida sem token, chamadas autenticadas, lançamentos, cartões, compromissos, investimentos, senha com hash e rejeição de email duplicado.

### Como auditar o banco real antes da apresentação?

Use:

```powershell
node scripts\audit-database-security.js
```

Esse comando mostra usuários, emails duplicados, quantidade de registros de auditoria e se as senhas estão com prefixo `scrypt`.

## Melhorias futuras

### O que poderia melhorar no projeto?

Algumas melhorias seriam: recuperação de senha, permissões mais fortes por usuário, integração entre cartão e lançamentos, exportação mais completa, testes automatizados de frontend, rotação de token e deploy em nuvem.

### O que ainda não está automatizado?

Cartões não geram faturas automaticamente, compromissos não alteram saldo automaticamente e investimentos não criam movimentações automáticas.

### Por que isso não foi feito agora?

Porque o foco do MVP foi entregar os principais fluxos financeiros funcionando bem: cadastro, login, dashboard, lançamentos, cartões, compromissos, investimentos e simulador.

## Respostas curtas para momentos de pressao

### Se perguntarem onde está o backend

O backend inicia em `backend/src/server.ts`, monta a aplicação em `backend/src/app.ts`, separa as regras em `backend/src/routes` e define o banco em `backend/src/database.ts`.

### Se perguntarem onde está o frontend

O frontend atual está em `frontend-novo/src`, usando React, TypeScript e Vite.

### Se perguntarem onde está a criptografia

A criptografia está no backend, nas funções de hash de senha com `crypto.scrypt`.

### Se perguntarem como o email duplicado e bloqueado

Ele é bloqueado pelo `UNIQUE` no banco e pelo tratamento de erro no backend.

### Se perguntarem se a senha aparece no banco

Não aparece a senha original. Aparece apenas o hash no formato `scrypt$...$...`.

### Se perguntarem como provar que está funcionando

Podemos rodar `npm.cmd run smoke`, que testa o sistema de ponta a ponta.
