# Guia técnico do The Keeper

## Visão geral

The Keeper é uma aplicação de gestão financeira pessoal e empresarial. O frontend atual está em `frontend-novo`; o diretório `frontend` é legado.

## Componentes

- `backend`: API Express modular, autenticação, regras financeiras e SQLite.
- `frontend-novo`: SPA React com páginas públicas e autenticadas.
- `scripts`: smoke test, auditoria do banco e verificações auxiliares.
- `docs`: arquitetura, API e material histórico da apresentação.

## Backend

O ponto de entrada `backend/src/server.ts` abre o banco, cria a aplicação e inicia a porta HTTP. A composição de middlewares e rotas fica em `backend/src/app.ts`.

As regras foram separadas por domínio em `backend/src/routes`. Essa organização permite localizar uma funcionalidade sem percorrer um arquivo monolítico:

- autenticação;
- contas e categorias;
- movimentações e dashboard;
- cartões;
- compromissos;
- investimentos;
- funcionários do perfil empresarial.

Detalhes: [ARQUITETURA_BACKEND.md](ARQUITETURA_BACKEND.md).

## Banco de dados

`backend/src/database.ts` abre o SQLite, habilita chaves estrangeiras, WAL e timeout de concorrência, cria tabelas e índices e aplica pequenas migrações de colunas.

Tabelas:

- `usuarios`
- `contas`
- `categorias`
- `movimentacoes`
- `cartoes`
- `compromissos`
- `investimentos`
- `funcionarios`
- `auditoria`

No cadastro são criadas automaticamente uma conta `Principal` e uma categoria `Geral`.

## Segurança

- Senhas novas usam `crypto.scrypt`, salt aleatório e comparação segura.
- Hashes legados são atualizados após um login válido.
- O login gera um token assinado com validade de oito horas.
- Rotas privadas exigem `Authorization: Bearer <token>`.
- O usuário do token prevalece sobre o `usuario_id` do corpo ou da query.
- Escritas bem-sucedidas são registradas em `auditoria`.

Para ambiente de produção, configure `KEEPER_TOKEN_SECRET`, HTTPS, política de senhas, recuperação de conta, rotação de tokens, backup e logs centralizados.

## Regras financeiras

- Receitas são movimentações positivas; despesas, negativas.
- Criar, editar ou remover uma movimentação ajusta o saldo dentro de uma transação.
- Compromissos são previsões e não alteram saldo.
- Cartões controlam limite, mas não geram fatura automaticamente.
- Investimentos compõem o patrimônio, mas não movimentam contas automaticamente.

## Frontend

Arquivos centrais:

- `src/App.tsx`: roteamento.
- `src/api.ts`: cliente HTTP e sessão.
- `src/components/AppLayout.tsx`: layout autenticado.
- `src/pages/`: páginas do produto.
- `src/pdfReport.ts`: relatórios imprimíveis.
- `src/types.ts`: tipos usados pela interface.

## Comandos

```bash
npm run dev:backend
npm run dev:frontend
npm run build
npm run check
npm run smoke
npm start
```

A referência dos endpoints está em [API.md](API.md).
