import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  atualizarCompromisso,
  criarCompromisso,
  getSession,
  listarCompromissos,
  removerCompromisso,
} from "../api";
import type { Compromisso, StatusCompromisso, TipoCompromisso } from "../types";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const hoje = new Date().toISOString().slice(0, 10);

function statusVisual(compromisso: Compromisso): StatusCompromisso | "vencido" {
  if (compromisso.status === "aberto" && compromisso.vencimento < hoje) {
    return "vencido";
  }

  return compromisso.status;
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Compromissos() {
  const session = useMemo(() => getSession(), []);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [tipo, setTipo] = useState<TipoCompromisso>("pagar");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [recorrente, setRecorrente] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  async function atualizarLista() {
    if (!session) {
      return;
    }

    setErro("");

    try {
      setCompromissos(await listarCompromissos(session.userId));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar compromissos.");
    }
  }

  useEffect(() => {
    if (!session) {
      return;
    }

    const usuarioId = session.userId;
    let ativo = true;

    async function carregarInicial() {
      setCarregando(true);
      setErro("");

      try {
        const data = await listarCompromissos(usuarioId);

        if (ativo) {
          setCompromissos(data);
        }
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar compromissos.");
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void carregarInicial();

    return () => {
      ativo = false;
    };
  }, [session]);

  const resumo = useMemo(() => {
    const abertos = compromissos.filter((item) => item.status === "aberto");
    const pagar = abertos
      .filter((item) => item.tipo === "pagar")
      .reduce((total, item) => total + Number(item.valor), 0);
    const receber = abertos
      .filter((item) => item.tipo === "receber")
      .reduce((total, item) => total + Number(item.valor), 0);
    const vencidos = abertos.filter((item) => item.vencimento < hoje).length;

    return { pagar, receber, saldoPrevisto: receber - pagar, vencidos };
  }, [compromissos]);

  const listaOrdenada = useMemo(
    () =>
      [...compromissos].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "aberto" ? -1 : 1;
        }

        return a.vencimento.localeCompare(b.vencimento);
      }),
    [compromissos],
  );

  const proximosAbertos = useMemo(
    () =>
      compromissos
        .filter((item) => item.status === "aberto")
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
        .slice(0, 3),
    [compromissos],
  );

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    const valorNumerico = Number(valor);

    if (!descricao.trim() || !Number.isFinite(valorNumerico) || valorNumerico <= 0 || !vencimento) {
      setErro("Informe descrição, valor positivo e vencimento.");
      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      await criarCompromisso({
        usuario_id: session.userId,
        tipo,
        descricao,
        valor: valorNumerico,
        vencimento,
        recorrente,
      });

      setDescricao("");
      setValor("");
      setVencimento(hoje);
      setRecorrente(false);
      setSucesso(tipo === "pagar" ? "Conta a pagar registrada." : "Recebimento registrado.");
      await atualizarLista();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar compromisso.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(compromisso: Compromisso, status: StatusCompromisso) {
    if (!session) {
      return;
    }

    setErro("");
    setSucesso("");

    try {
      await atualizarCompromisso(compromisso.id, {
        usuario_id: session.userId,
        tipo: compromisso.tipo,
        descricao: compromisso.descricao,
        valor: Number(compromisso.valor),
        vencimento: compromisso.vencimento.slice(0, 10),
        status,
        recorrente: Boolean(compromisso.recorrente),
      });
      setSucesso(status === "pago" ? "Compromisso marcado como pago." : "Compromisso cancelado.");
      await atualizarLista();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível atualizar compromisso.");
    }
  }

  async function excluir(compromissoId: number) {
    if (!session) {
      return;
    }

    setErro("");
    setSucesso("");

    try {
      await removerCompromisso(compromissoId, session.userId);
      setSucesso("Compromisso removido.");
      await atualizarLista();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível remover compromisso.");
    }
  }

  if (carregando) {
    return <p className="empty-state">Carregando compromissos...</p>;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Planejamento mensal</span>
          <h2>Compromissos financeiros</h2>
        </div>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <span>A pagar</span>
          <strong className="saida">{moeda.format(resumo.pagar)}</strong>
          <p>Compromissos abertos de despesa.</p>
        </article>
        <article className="kpi-card">
          <span>A receber</span>
          <strong className="entrada">{moeda.format(resumo.receber)}</strong>
          <p>Entradas previstas ainda em aberto.</p>
        </article>
        <article className="kpi-card">
          <span>Saldo previsto</span>
          <strong className={resumo.saldoPrevisto >= 0 ? "entrada" : "saida"}>
            {moeda.format(resumo.saldoPrevisto)}
          </strong>
          <p>{resumo.vencidos} compromisso(s) vencido(s).</p>
        </article>
      </div>

      <section className="priority-strip">
        {proximosAbertos.map((item) => (
          <article className="priority-item" key={item.id}>
            <span className={item.tipo === "pagar" ? "saida" : "entrada"}>
              {item.tipo === "pagar" ? "Pagar" : "Receber"}
            </span>
            <strong>{item.descricao}</strong>
            <p>
              {formatarData(item.vencimento)} - {moeda.format(Number(item.valor))}
            </p>
          </article>
        ))}
        {proximosAbertos.length === 0 && (
          <article className="priority-item">
            <span className="entrada">Agenda limpa</span>
            <strong>Nenhum compromisso aberto</strong>
            <p>Novos vencimentos aparecem aqui por prioridade.</p>
          </article>
        )}
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Novo compromisso</span>
            <h2>{tipo === "pagar" ? "Conta a pagar" : "Valor a receber"}</h2>
          </div>
        </div>

        <form className="commitment-form" onSubmit={salvar}>
          <label>
            Tipo
            <select onChange={(event) => setTipo(event.target.value as TipoCompromisso)} value={tipo}>
              <option value="pagar">Pagar</option>
              <option value="receber">Receber</option>
            </select>
          </label>
          <label>
            Descrição
            <input
              onChange={(event) => setDescricao(event.target.value)}
              placeholder={tipo === "pagar" ? "Ex: Aluguel, escola, fornecedor" : "Ex: Cliente, salário, repasse"}
              required
              value={descricao}
            />
          </label>
          <label>
            Valor
            <input
              min="0.01"
              onChange={(event) => setValor(event.target.value)}
              required
              step="0.01"
              type="number"
              value={valor}
            />
          </label>
          <label>
            Vencimento
            <input onChange={(event) => setVencimento(event.target.value)} required type="date" value={vencimento} />
          </label>
          <label className="checkbox-field">
            <input checked={recorrente} onChange={(event) => setRecorrente(event.target.checked)} type="checkbox" />
            Recorrente
          </label>
          <button className="button primary" disabled={salvando} type="submit">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </form>

        {erro && <p className="form-error">{erro}</p>}
        {sucesso && <p className="form-success">{sucesso}</p>}
      </section>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Valor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaOrdenada.map((item) => {
              const visual = statusVisual(item);

              return (
                <tr key={item.id}>
                  <td data-label="Descrição">
                    {item.descricao}
                    {item.recorrente ? <span className="row-note">Recorrente</span> : null}
                  </td>
                  <td data-label="Tipo">{item.tipo === "pagar" ? "Pagar" : "Receber"}</td>
                  <td data-label="Vencimento">{formatarData(item.vencimento)}</td>
                  <td data-label="Status">
                    <span className={`status ${visual}`}>{visual}</span>
                  </td>
                  <td className={item.tipo === "pagar" ? "saida" : "entrada"} data-label="Valor">
                    {moeda.format(Number(item.valor))}
                  </td>
                  <td data-label="Ações">
                    <div className="table-actions">
                      {item.status === "aberto" && (
                        <>
                          <button className="text-button" onClick={() => void alterarStatus(item, "pago")} type="button">
                            Pago
                          </button>
                          <button
                            className="text-button danger"
                            onClick={() => void alterarStatus(item, "cancelado")}
                            type="button"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                      <button className="text-button danger" onClick={() => void excluir(item.id)} type="button">
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {listaOrdenada.length === 0 && <p className="empty-state">Nenhum compromisso cadastrado ainda.</p>}
      </section>
    </section>
  );
}
