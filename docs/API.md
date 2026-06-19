# API do The Keeper

Base local: `http://localhost:3000/api`

As respostas usam JSON. Com exceção de saúde, cadastro e login, os endpoints exigem:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

O `usuario_id` ainda é aceito por compatibilidade com o frontend, mas o backend prioriza o usuário contido no token.

## Endpoints públicos

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/health` | Verifica se o backend está ativo |
| `POST` | `/auth/register` | Cria usuário, conta Principal e categoria Geral |
| `POST` | `/auth/login` | Autentica e devolve o token |

Cadastro:

```json
{
  "nome": "Maria",
  "email": "maria@example.com",
  "senha": "senha-segura",
  "tipo_conta": "pessoal"
}
```

## Endpoints autenticados

Os recursos abaixo seguem o padrão:

| Método | Sufixo | Operação |
| --- | --- | --- |
| `GET` | `/` | Listar |
| `POST` | `/` | Criar |
| `PUT` | `/:id` | Atualizar |
| `DELETE` | `/:id` | Remover |

Recursos CRUD:

- `/contas`
- `/cartoes`
- `/funcionarios`
- `/categorias`
- `/movimentacoes`
- `/compromissos`
- `/investimentos`

Consultas consolidadas:

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/dashboard` | Saldo, entradas, saídas, patrimônio e itens recentes |
| `GET` | `/fluxo-caixa` | Entradas, saídas e resultado agrupados por mês |

## Convenções

- Movimentação positiva representa receita.
- Movimentação negativa representa despesa.
- Datas de movimentação usam `YYYY-MM-DD`.
- Erros de validação normalmente retornam `400`.
- Recurso inexistente retorna `404`.
- Conflitos, como email duplicado ou recurso em uso, retornam `409`.
- Token ausente ou inválido retorna `401`.

Exemplo de erro:

```json
{
  "success": false,
  "error": "Sessão inválida ou expirada.",
  "code": "NAO_AUTENTICADO"
}
```
