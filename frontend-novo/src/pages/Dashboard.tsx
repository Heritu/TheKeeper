import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buscarDashboard, buscarFluxoCaixa, getSession } from "../api";
import { gerarRelatorioFinanceiroPdf } from "../pdfReport";
import type { DashboardResumo, FluxoCaixaMes } from "../types";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

interface ProximaAcao {
  titulo: string;
  descricao: string;
  to: string;
  label: string;
  nivel: "positivo" | "atencao" | "critico";
}

function mesCurto(mes: string) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return new Date(ano, numeroMes - 1).toLocaleDateString("pt-BR", {
    month: "short",
  });
}

function diasAte(data: string) {
  const hoje = new Date();
  const vencimento = new Date(`${data.slice(0, 10)}T00:00:00`);
  hoje.setHours(0, 0, 0, 0);

  return Math.ceil((vencimento.getTime() - hoje.getTime()) / 86_400_000);
}

function formatarDataLocal(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);

  if (ano && mes && dia) {
    return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
  }

  return new Date(data).toLocaleDateString("pt-BR");
}

export default function Dashboard() {
  const session = useMemo(() => getSession(), []);
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [fluxo, setFluxo] = useState<FluxoCaixaMes[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!session) {
      return;
    }

    const usuarioId = session.userId;

    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
        const [dashboard, fluxoCaixa] = await Promise.all([
          buscarDashboard(usuarioId),
          buscarFluxoCaixa(usuarioId),
        ]);
        setResumo(dashboard);
        setFluxo(fluxoCaixa);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível carregar o dashboard.");
      } finally {
        setCarregando(false);
      }
    }

    void carregar();
  }, [session]);

  const maiorFluxo = useMemo(() => {
    const valores = fluxo.flatMap((item) => [Number(item.entradas), Number(item.saidas)]);
    return Math.max(...valores, 1);
  }, [fluxo]);

  const proximasAcoes = useMemo<ProximaAcao[]>(() => {
    const acoes: ProximaAcao[] = [];
    const totalMovimentos = resumo?.ultimasMovimentacoes.length ?? 0;
    const compromissosAbertos = resumo?.proximosCompromissos ?? [];
    const proximoCompromisso = compromissosAbertos[0];
    const resultadoMes = fluxo.at(-1)?.resultado ?? 0;

    if (totalMovimentos === 0) {
      acoes.push({
        titulo: "Comece pelo primeiro lançamento",
        descricao: "Registre uma entrada ou despesa para o painel passar a responder com dados reais.",
        to: "/lancamentos",
        label: "Registrar agora",
        nivel: "atencao",
      });
    }

    if (proximoCompromisso) {
      const dias = diasAte(proximoCompromisso.vencimento);
      const prazo =
        dias < 0 ? `venceu há ${Math.abs(dias)} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`;

      acoes.push({
        titulo: `${proximoCompromisso.descricao} ${prazo}`,
        descricao: `${proximoCompromisso.tipo === "pagar" ? "Pagamento" : "Recebimento"} de ${moeda.format(
          Number(proximoCompromisso.valor),
        )}.`,
        to: "/compromissos",
        label: "Ver agenda",
        nivel: dias <= 2 ? "critico" : "atencao",
      });
    } else {
      acoes.push({
        titulo: "Monte sua agenda financeira",
        descricao: "Inclua contas a pagar e valores a receber para antecipar aperto de caixa.",
        to: "/compromissos",
        label: "Criar compromisso",
        nivel: "positivo",
      });
    }

    if ((resumo?.patrimonioInvestido ?? 0) === 0) {
      acoes.push({
        titulo: "Separe reserva ou patrimônio",
        descricao:
          session?.tipoConta === "empresarial"
            ? "Cadastre reservas do negócio para enxergar o capital fora da conta corrente."
            : "Cadastre investimentos para acompanhar sua evolução patrimonial.",
        to: "/investimentos",
        label: "Adicionar investimento",
        nivel: "positivo",
      });
    }

    if (fluxo.length > 0 && resultadoMes < 0) {
      acoes.unshift({
        titulo: "Resultado do mês ficou negativo",
        descricao: `O último período fechou em ${moeda.format(Number(resultadoMes))}. Revise despesas recentes.`,
        to: "/lancamentos",
        label: "Analisar lançamentos",
        nivel: "critico",
      });
    }

    return acoes.slice(0, 3);
  }, [fluxo, resumo, session?.tipoConta]);

  function gerarPdf() {
    if (!session || !resumo) {
      return;
    }

    const gerado = gerarRelatorioFinanceiroPdf(session, resumo, fluxo);

    if (!gerado) {
      setErro("Permita pop-ups no navegador para gerar o relatório em PDF.");
    }
  }

  if (carregando) {
    return <p className="empty-state">Carregando painel financeiro...</p>;
  }

  return (
    <section className="page-stack">
      {erro && <p className="form-error">{erro}</p>}

      <div className="kpi-grid">
        <article className="kpi-card featured">
          <span>Saldo atual</span>
          <strong>{moeda.format(resumo?.saldo ?? 0)}</strong>
          <p>Saldo consolidado das contas cadastradas.</p>
        </article>
        <article className="kpi-card">
          <span>Entradas</span>
          <strong>{moeda.format(resumo?.entradas ?? 0)}</strong>
          <p>Receitas registradas no sistema.</p>
        </article>
        <article className="kpi-card">
          <span>Despesas</span>
          <strong>{moeda.format(resumo?.saidas ?? 0)}</strong>
          <p>Gastos confirmados pelos lançamentos.</p>
        </article>
      </div>

      <section className="action-strip" aria-label="Próximas ações recomendadas">
        {proximasAcoes.map((acao) => (
          <article className={`action-card ${acao.nivel}`} key={acao.titulo}>
            <div>
              <span className="eyebrow">Próxima ação</span>
              <h2>{acao.titulo}</h2>
              <p>{acao.descricao}</p>
            </div>
            <Link className="button secondary" to={acao.to}>
              {acao.label}
            </Link>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Fluxo de caixa</span>
              <h2>Entradas e despesas</h2>
            </div>
            <Link className="text-link" to="/lancamentos">
              Novo lançamento
            </Link>
            <button className="text-button" onClick={gerarPdf} type="button">
              Gerar PDF
            </button>
          </div>

          {fluxo.length > 0 ? (
            <div className="cashflow-chart">
              {fluxo.map((item) => (
                <div className="cashflow-month" key={item.mes}>
                  <div className="cashflow-bars">
                    <span
                      className="bar entrada-bg"
                      style={{ height: `${Math.max((Number(item.entradas) / maiorFluxo) * 100, 6)}%` }}
                    />
                    <span
                      className="bar saida-bg"
                      style={{ height: `${Math.max((Number(item.saidas) / maiorFluxo) * 100, 6)}%` }}
                    />
                  </div>
                  <strong>{mesCurto(item.mes)}</strong>
                  <small>{moeda.format(Number(item.resultado))}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state action-empty">
              <strong>Seu fluxo ainda está em branco.</strong>
              <p>Depois do primeiro lançamento, este gráfico mostra entradas, despesas e resultado por mês.</p>
              <Link className="button primary" to="/lancamentos">
                Registrar primeiro lançamento
              </Link>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Últimos movimentos</span>
              <h2>Extrato recente</h2>
            </div>
          </div>

          <div className="transaction-list">
            {(resumo?.ultimasMovimentacoes ?? []).map((item) => (
              <article className="transaction-row" key={item.id}>
                <div>
                  <strong>{item.descricao ?? "Lançamento sem descrição"}</strong>
                  <span>{formatarDataLocal(item.data_movimentacao)}</span>
                </div>
                <strong className={item.valor < 0 ? "saida" : "entrada"}>
                  {item.valor < 0 ? "-" : "+"}
                  {moeda.format(Math.abs(item.valor))}
                </strong>
              </article>
            ))}
            {(resumo?.ultimasMovimentacoes.length ?? 0) === 0 && (
              <div className="empty-state action-empty">
                <strong>Nenhum movimento ainda.</strong>
                <p>Comece por uma receita, uma despesa fixa ou o saldo inicial da conta.</p>
                <Link className="button secondary" to="/lancamentos">
                  Abrir lançamentos
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="insight-grid">
        <article className="insight-card positivo">
          <span className="eyebrow">Perfil</span>
          <h2>{session?.tipoConta === "empresarial" ? "Tela de negócios" : "Tela pessoal"}</h2>
          <p>
            {session?.tipoConta === "empresarial"
              ? "Use esta área para acompanhar custos, despesas, caixa e compromissos da empresa."
              : "Use esta área para acompanhar gastos pessoais, renda, metas e reserva financeira."}
          </p>
        </article>
        <article className="insight-card atencao">
          <span className="eyebrow">Investimentos</span>
          <h2>Patrimônio consolidado</h2>
          <p>{moeda.format(resumo?.patrimonioInvestido ?? 0)} cadastrados em investimentos.</p>
        </article>
        <article className="insight-card critico">
          <span className="eyebrow">Agenda</span>
          <h2>Compromissos abertos</h2>
          <p>{resumo?.proximosCompromissos.length ?? 0} compromissos financeiros em aberto.</p>
        </article>
      </section>
    </section>
  );
}
