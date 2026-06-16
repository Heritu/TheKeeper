import type { DashboardResumo, FluxoCaixaMes, Movimentacao, SessaoUsuario } from "./types";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function escaparHtml(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linha(label: string, valor: string) {
  return `
    <tr>
      <td>${escaparHtml(label)}</td>
      <td>${escaparHtml(valor)}</td>
    </tr>
  `;
}

function formatarMes(mes: string) {
  const [ano, numeroMes] = mes.split("-").map(Number);

  return new Date(ano, numeroMes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function formatarDataLocal(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);

  if (ano && mes && dia) {
    return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
  }

  return new Date(data).toLocaleDateString("pt-BR");
}

export function gerarRelatorioFinanceiroPdf(
  session: SessaoUsuario,
  resumo: DashboardResumo,
  fluxo: FluxoCaixaMes[],
) {
  const janela = window.open("", "_blank", "width=900,height=700");

  if (!janela) {
    return false;
  }

  const movimentacoes = resumo.ultimasMovimentacoes
    .map((item) =>
      linha(
        item.descricao ?? "Lançamento sem descrição",
        `${formatarDataLocal(item.data_movimentacao)} - ${moeda.format(Number(item.valor))}`,
      ),
    )
    .join("");
  const fluxoLinhas = fluxo
    .map((item) =>
      linha(
        item.mes,
        `Entradas ${moeda.format(Number(item.entradas))} | Saídas ${moeda.format(
          Number(item.saidas),
        )} | Resultado ${moeda.format(Number(item.resultado))}`,
      ),
    )
    .join("");
  const data = new Date().toLocaleDateString("pt-BR");

  janela.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório financeiro - The Keeper</title>
        <style>
          body {
            margin: 0;
            padding: 36px;
            color: #101828;
            font-family: Arial, sans-serif;
          }

          header {
            border-bottom: 3px solid #146c94;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }

          h1, h2 {
            margin: 0;
          }

          h1 {
            font-size: 30px;
          }

          h2 {
            margin-top: 28px;
            font-size: 18px;
          }

          p {
            color: #667085;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }

          .card {
            border: 1px solid #d9e2ec;
            border-radius: 8px;
            padding: 14px;
          }

          .card span {
            display: block;
            color: #667085;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .card strong {
            display: block;
            margin-top: 8px;
            color: #146c94;
            font-size: 18px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }

          td {
            border-bottom: 1px solid #d9e2ec;
            padding: 10px 0;
            vertical-align: top;
          }

          td:last-child {
            text-align: right;
          }

          @media print {
            body {
              padding: 22mm;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <h1>The Keeper</h1>
          <p>Relatório financeiro de ${escaparHtml(session.nome)} gerado em ${data}</p>
        </header>

        <section class="grid">
          <div class="card"><span>Saldo</span><strong>${moeda.format(resumo.saldo)}</strong></div>
          <div class="card"><span>Entradas</span><strong>${moeda.format(resumo.entradas)}</strong></div>
          <div class="card"><span>Despesas</span><strong>${moeda.format(resumo.saidas)}</strong></div>
          <div class="card"><span>Investimentos</span><strong>${moeda.format(resumo.patrimonioInvestido)}</strong></div>
        </section>

        <h2>Fluxo de caixa</h2>
        <table>${fluxoLinhas || linha("Sem dados", "Cadastre lançamentos para montar o fluxo.")}</table>

        <h2>Últimas movimentações</h2>
        <table>${movimentacoes || linha("Sem dados", "Nenhum lançamento registrado.")}</table>
      </body>
    </html>
  `);
  janela.document.close();
  janela.focus();
  janela.print();

  return true;
}

export function gerarRelatorioMovimentacoesMensalPdf(
  session: SessaoUsuario,
  mes: string,
  movimentacoes: Movimentacao[],
) {
  const janela = window.open("", "_blank", "width=900,height=700");

  if (!janela) {
    return false;
  }

  const entradas = movimentacoes
    .filter((item) => item.valor > 0)
    .reduce((total, item) => total + Number(item.valor), 0);
  const despesas = movimentacoes
    .filter((item) => item.valor < 0)
    .reduce((total, item) => total + Math.abs(Number(item.valor)), 0);
  const resultado = entradas - despesas;
  const periodo = formatarMes(mes);
  const data = new Date().toLocaleDateString("pt-BR");
  const linhas = movimentacoes
    .map((item) =>
      linha(
        `${item.descricao ?? "Lançamento sem descrição"} | ${item.categoria_nome ?? "Geral"} | ${
          item.nome_conta ?? "Principal"
        }`,
        `${formatarDataLocal(item.data_movimentacao)} - ${moeda.format(Number(item.valor))}`,
      ),
    )
    .join("");

  janela.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório mensal - The Keeper</title>
        <style>
          body {
            margin: 0;
            padding: 36px;
            color: #101828;
            font-family: Arial, sans-serif;
          }

          header {
            border-bottom: 3px solid #146c94;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }

          h1, h2 {
            margin: 0;
          }

          h1 {
            font-size: 30px;
          }

          h2 {
            margin-top: 28px;
            font-size: 18px;
          }

          p {
            color: #667085;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }

          .card {
            border: 1px solid #d9e2ec;
            border-radius: 8px;
            padding: 14px;
          }

          .card span {
            display: block;
            color: #667085;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .card strong {
            display: block;
            margin-top: 8px;
            color: #146c94;
            font-size: 18px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }

          td {
            border-bottom: 1px solid #d9e2ec;
            padding: 10px 0;
            vertical-align: top;
          }

          td:last-child {
            text-align: right;
          }

          @media print {
            body {
              padding: 22mm;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <h1>The Keeper</h1>
          <p>Relatório mensal de ${escaparHtml(session.nome)}</p>
          <p>Período: ${escaparHtml(periodo)} | Data de emissão: ${data}</p>
        </header>

        <section class="grid">
          <div class="card"><span>Entradas</span><strong>${moeda.format(entradas)}</strong></div>
          <div class="card"><span>Despesas</span><strong>${moeda.format(despesas)}</strong></div>
          <div class="card"><span>Resultado</span><strong>${moeda.format(resultado)}</strong></div>
        </section>

        <h2>Movimentações do mês</h2>
        <table>${linhas || linha("Sem dados", "Nenhum lançamento registrado neste mês.")}</table>
      </body>
    </html>
  `);
  janela.document.close();
  janela.focus();
  janela.print();

  return true;
}
