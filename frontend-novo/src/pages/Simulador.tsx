import { useEffect, useMemo, useState } from "react";
import { buscarDashboard, getSession } from "../api";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Cenario = "conservador" | "base" | "otimista";

const ajustesCenario: Record<Cenario, number> = {
  conservador: -0.35,
  base: 0,
  otimista: 0.35,
};

function calcularAporteNecessario(meta: number, saldo: number, taxaMensal: number, meses: number) {
  const restante = meta - saldo * (1 + taxaMensal) ** meses;

  if (restante <= 0) {
    return 0;
  }

  if (taxaMensal === 0) {
    return restante / meses;
  }

  return (restante * taxaMensal) / ((1 + taxaMensal) ** meses - 1);
}

export default function Simulador() {
  const session = useMemo(() => getSession(), []);
  const [objetivo, setObjetivo] = useState("Reserva de segurança");
  const [meta, setMeta] = useState(30000);
  const [saldoInicial, setSaldoInicial] = useState(8000);
  const [aporteMensal, setAporteMensal] = useState(1800);
  const [crescimento, setCrescimento] = useState(0.8);
  const [meses, setMeses] = useState(12);
  const [cenario, setCenario] = useState<Cenario>("base");
  const [saldoAtual, setSaldoAtual] = useState<number | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    const usuarioId = session.userId;
    let ativo = true;

    async function carregarResumo() {
      try {
        const data = await buscarDashboard(usuarioId);

        if (ativo) {
          setSaldoAtual(Number(data.saldo) + Number(data.patrimonioInvestido));
        }
      } catch {
        if (ativo) {
          setSaldoAtual(null);
        }
      }
    }

    void carregarResumo();

    return () => {
      ativo = false;
    };
  }, [session]);

  const taxaAjustada = Math.max(crescimento + ajustesCenario[cenario], 0) / 100;
  const projecao = useMemo(() => {
    const valores: number[] = [];
    let saldo = saldoInicial;

    for (let mes = 1; mes <= meses; mes += 1) {
      saldo = saldo * (1 + taxaAjustada) + aporteMensal;
      valores.push(Math.round(saldo));
    }

    return valores;
  }, [aporteMensal, meses, saldoInicial, taxaAjustada]);

  const resultado = projecao.at(-1) ?? saldoInicial;
  const maiorValor = Math.max(...projecao, meta, 1);
  const totalAportes = aporteMensal * meses;
  const rendimento = resultado - saldoInicial - totalAportes;
  const mesAlcance = projecao.findIndex((valor) => valor >= meta) + 1;
  const aporteNecessario = calcularAporteNecessario(meta, saldoInicial, taxaAjustada, meses);
  const diferencaAporte = aporteMensal - aporteNecessario;
  const progresso = Math.min((resultado / meta) * 100, 100);

  const cenarios = (Object.keys(ajustesCenario) as Cenario[]).map((item) => {
    const taxa = Math.max(crescimento + ajustesCenario[item], 0) / 100;
    let saldo = saldoInicial;

    for (let mes = 1; mes <= meses; mes += 1) {
      saldo = saldo * (1 + taxa) + aporteMensal;
    }

    return {
      cenario: item,
      valor: saldo,
      bateMeta: saldo >= meta,
    };
  });

  function usarSaldoAtual() {
    if (saldoAtual !== null) {
      setSaldoInicial(Math.max(Math.round(saldoAtual), 0));
    }
  }

  return (
    <section className="page-stack">
      <section className="simulator-hero">
        <div>
          <span className="eyebrow">Simulador com propósito</span>
          <h2>Planejar uma decisão antes de comprometer dinheiro</h2>
          <p>
            Defina uma meta, veja se o aporte atual chega no prazo e compare cenários
            antes de assumir uma compra, reserva ou investimento.
          </p>
        </div>
        <div className="goal-meter" aria-label={`Progresso projetado de ${progresso.toFixed(0)}%`}>
          <span style={{ width: `${progresso}%` }} />
        </div>
      </section>

      <div className="simulator-grid">
        <section className="panel">
          <form className="simulator-form">
            <label>
              Objetivo
              <input onChange={(event) => setObjetivo(event.target.value)} value={objetivo} />
            </label>
            <label>
              Valor da meta
              <input min="1" onChange={(event) => setMeta(Number(event.target.value))} type="number" value={meta} />
            </label>
            <label>
              Saldo inicial
              <input
                min="0"
                onChange={(event) => setSaldoInicial(Number(event.target.value))}
                type="number"
                value={saldoInicial}
              />
            </label>
            <label>
              Aporte mensal
              <input
                min="0"
                onChange={(event) => setAporteMensal(Number(event.target.value))}
                type="number"
                value={aporteMensal}
              />
            </label>
            <label>
              Crescimento esperado ao mês
              <input
                min="0"
                onChange={(event) => setCrescimento(Number(event.target.value))}
                step="0.1"
                type="number"
                value={crescimento}
              />
            </label>
            <label>
              Prazo
              <select onChange={(event) => setMeses(Number(event.target.value))} value={meses}>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
                <option value="18">18 meses</option>
                <option value="24">24 meses</option>
              </select>
            </label>
            <label>
              Cenário
              <select onChange={(event) => setCenario(event.target.value as Cenario)} value={cenario}>
                <option value="conservador">Conservador</option>
                <option value="base">Base</option>
                <option value="otimista">Otimista</option>
              </select>
            </label>
            <button
              className="button secondary"
              disabled={saldoAtual === null}
              onClick={usarSaldoAtual}
              type="button"
            >
              Usar saldo real
            </button>
          </form>
        </section>

        <section className="panel projection-panel">
          <span className="eyebrow">Resultado para {objetivo || "sua meta"}</span>
          <strong>{moeda.format(resultado)}</strong>
          <p>
            {mesAlcance > 0
              ? `A meta é alcançada no mês ${mesAlcance}.`
              : `Faltam ${moeda.format(Math.max(meta - resultado, 0))} para fechar a meta no prazo.`}
          </p>
          <div className="projection-bars">
            {projecao.map((valor, index) => (
              <span
                key={`${valor}-${index}`}
                className={valor >= meta ? "hit-goal" : ""}
                style={{ height: `${Math.max((valor / maiorValor) * 100, 12)}%` }}
                title={`Mês ${index + 1}: ${moeda.format(valor)}`}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="scenario-grid">
        <article className="scenario-card">
          <span className="eyebrow">Aporte ideal</span>
          <h2>{moeda.format(aporteNecessario)}</h2>
          <p>
            {diferencaAporte >= 0
              ? `Seu plano tem folga mensal de ${moeda.format(diferencaAporte)}.`
              : `Ajuste o aporte em ${moeda.format(Math.abs(diferencaAporte))} ou aumente o prazo.`}
          </p>
        </article>
        <article className="scenario-card">
          <span className="eyebrow">Aportes</span>
          <h2>{moeda.format(totalAportes)}</h2>
          <p>Total separado durante o período escolhido.</p>
        </article>
        <article className="scenario-card">
          <span className="eyebrow">Rendimento</span>
          <h2>{moeda.format(Math.max(rendimento, 0))}</h2>
          <p>Valor estimado gerado pelo crescimento mensal.</p>
        </article>
      </section>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Cenário</th>
              <th>Taxa usada</th>
              <th>Resultado</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {cenarios.map((item) => (
              <tr key={item.cenario}>
                <td data-label="Cenário">{item.cenario}</td>
                <td data-label="Taxa usada">
                  {Math.max(crescimento + ajustesCenario[item.cenario], 0).toFixed(2)}% ao mês
                </td>
                <td data-label="Resultado">{moeda.format(item.valor)}</td>
                <td data-label="Meta">
                  <span className={`status ${item.bateMeta ? "pago" : "vencido"}`}>
                    {item.bateMeta ? "Alcança" : "Não alcança"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}
