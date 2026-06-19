# Arquitetura do backend

O backend é um monólito modular em Express. Há um único processo e um único banco SQLite, mas cada domínio possui seu próprio arquivo de rotas.

## Fluxo de uma requisição

```text
HTTP
  -> app.ts
  -> autenticação
  -> auditoria
  -> rota do domínio
  -> serviço compartilhado, quando necessário
  -> SQLite
  -> tratamento central de erros
```

As rotas de cadastro e login são públicas. As demais rotas de negócio passam pelo middleware de autenticação e usam o usuário identificado pelo token.

## Pastas

### `routes/`

Cada arquivo concentra os endpoints e regras do seu domínio:

- `auth.ts`: cadastro, login, atualização de hash legado e geração de token.
- `contas.ts`: contas financeiras e saldo inicial.
- `categorias.ts`: categorias de receita e despesa.
- `movimentacoes.ts`: lançamentos e atualização transacional dos saldos.
- `cartoes.ts`: cartões, limites e vencimentos.
- `compromissos.ts`: contas a pagar e valores a receber.
- `investimentos.ts`: carteira, custo e valor atual.
- `funcionarios.ts`: equipe e folha do perfil empresarial.
- `dashboard.ts`: consolidação financeira e fluxo de caixa.

### `middlewares/`

- `auth.ts`: valida o token Bearer e adiciona o ID do usuário à requisição.
- `audit.ts`: registra operações de escrita concluídas com sucesso.
- `error.ts`: padroniza as respostas de erro.

### `services/`

`financeiro.ts` contém operações compartilhadas por mais de um domínio, como localizar ou criar a conta e a categoria padrão do usuário.

### `utils/`

- `http.ts`: normalização e validação de entradas.
- `security.ts`: hash de senha com scrypt e assinatura de tokens.

## Decisões importantes

- Movimentações usam transações SQLite para manter lançamento e saldo consistentes.
- O ID vindo do token tem prioridade sobre qualquer `usuario_id` enviado pelo cliente.
- Compromissos, cartões e investimentos não alteram automaticamente o saldo.
- O frontend compilado é servido pelo próprio Express.
- O formato e os caminhos públicos da API foram preservados durante a modularização.

## Adicionando um novo domínio

1. Crie um arquivo em `backend/src/routes`.
2. Exporte uma função que receba `KeeperDatabase` e devolva um `Router`.
3. Reutilize validações de `utils/http.ts`.
4. Coloque regras compartilhadas em `services/`.
5. Registre o router em `backend/src/app.ts`.
6. Atualize `docs/API.md` e o smoke test.
