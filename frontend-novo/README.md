# The Keeper Frontend

Interface React do The Keeper, uma aplicação de gestão financeira pessoal e empresarial.

O objetivo do frontend é ajudar o usuário a agir rápido: registrar movimentações, acompanhar fluxo de caixa, controlar cartões, compromissos, investimentos e simular metas antes de comprometer dinheiro.

## Funcionalidades

- Login e cadastro com perfil pessoal ou empresarial.
- Dashboard com saldo, entradas, despesas, fluxo de caixa e próximas ações.
- Lançamentos com modelos rápidos para receitas e despesas comuns.
- Cartões com limite total, limite usado, vencimento e estado de uso.
- Compromissos financeiros com contas a pagar, valores a receber e status.
- Investimentos e reservas com resumo de patrimônio e alocação.
- Simulador de metas com cenários conservador, base e otimista.
- Geração de relatório financeiro em PDF pelo navegador.

## Stack

- React
- TypeScript
- Vite
- React Router
- ESLint

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

No Windows com PowerShell restritivo, use `npm.cmd`:

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```

## Variáveis de ambiente

Por padrão, o frontend chama a API no mesmo host. Para apontar para outro backend:

```bash
VITE_API_URL=http://localhost:3000
```

## Estrutura

- `src/App.tsx`: rotas públicas e protegidas.
- `src/components/AppLayout.tsx`: layout principal com menu lateral.
- `src/pages`: telas do produto.
- `src/api.ts`: cliente HTTP e sessão local.
- `src/types.ts`: contratos usados pela interface.
- `src/pdfReport.ts`: geração do relatório financeiro.
- `src/index.css`: sistema visual da aplicação.

## Verificação local

```bash
npm.cmd run build
npm.cmd run lint
```
