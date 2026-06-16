import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  atualizarCartao,
  criarCartao,
  getSession,
  listarCartoes,
  removerCartao,
} from "../api";
import type { Cartao, ResumoCartoes } from "../types";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const bandeiras = ["Visa", "Mastercard", "Elo", "American Express", "Outro"];

function percentualUso(cartao: Cartao) {
  if (cartao.limite_total <= 0) {
    return 0;
  }

  return Math.min((cartao.limite_usado / cartao.limite_total) * 100, 100);
}

function estadoDoCartao(cartao: Cartao) {
  if (!cartao.ativo) {
    return "inativo";
  }

  const uso = percentualUso(cartao);

  if (uso >= 85) {
    return "critico";
  }

  if (uso >= 60) {
    return "atencao";
  }

  return "saudavel";
}

function labelEstado(estado: string) {
  const labels: Record<string, string> = {
    atencao: "atenção",
    critico: "crítico",
    inativo: "inativo",
    saudavel: "saudável",
  };

  return labels[estado] ?? estado;
}

export default function Cartoes() {
  const session = useMemo(() => getSession(), []);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [resumo, setResumo] = useState<ResumoCartoes>({
    limiteTotal: 0,
    limiteUsado: 0,
    limiteDisponivel: 0,
  });
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [bandeira, setBandeira] = useState(bandeiras[0]);
  const [limiteTotal, setLimiteTotal] = useState("");
  const [limiteUsado, setLimiteUsado] = useState("");
  const [fechamento, setFechamento] = useState("1");
  const [vencimento, setVencimento] = useState("10");
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  async function carregarCartoes() {
    if (!session) {
      return;
    }

    setErro("");

    try {
      const data = await listarCartoes(session.userId);
      setCartoes(data.cartoes);
      setResumo(data.resumo);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar cartões.");
    }
  }

  useEffect(() => {
    if (!session) {
      return;
    }

    const usuarioId = session.userId;
    let ativoRequest = true;

    async function carregarInicial() {
      setCarregando(true);
      setErro("");

      try {
        const data = await listarCartoes(usuarioId);

        if (!ativoRequest) {
          return;
        }

        setCartoes(data.cartoes);
        setResumo(data.resumo);
      } catch (error) {
        if (ativoRequest) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar cartões.");
        }
      } finally {
        if (ativoRequest) {
          setCarregando(false);
        }
      }
    }

    void carregarInicial();

    return () => {
      ativoRequest = false;
    };
  }, [session]);

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setBandeira(bandeiras[0]);
    setLimiteTotal("");
    setLimiteUsado("");
    setFechamento("1");
    setVencimento("10");
    setAtivo(true);
  }

  function preencherEdicao(cartao: Cartao) {
    setEditandoId(cartao.id);
    setNome(cartao.nome);
    setBandeira(cartao.bandeira);
    setLimiteTotal(String(cartao.limite_total));
    setLimiteUsado(String(cartao.limite_usado));
    setFechamento(String(cartao.fechamento));
    setVencimento(String(cartao.vencimento));
    setAtivo(Boolean(cartao.ativo));
    setErro("");
    setSucesso("");
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    const limiteTotalNumero = Number(limiteTotal);
    const limiteUsadoNumero = Number(limiteUsado || 0);
    const fechamentoNumero = Number(fechamento);
    const vencimentoNumero = Number(vencimento);

    if (
      !nome.trim() ||
      !Number.isFinite(limiteTotalNumero) ||
      limiteTotalNumero < 0 ||
      !Number.isFinite(limiteUsadoNumero) ||
      limiteUsadoNumero < 0 ||
      !Number.isInteger(fechamentoNumero) ||
      !Number.isInteger(vencimentoNumero)
    ) {
      setErro("Informe nome, limite e dias válidos para o cartão.");
      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const payload = {
        usuario_id: session.userId,
        nome,
        bandeira,
        limite_total: limiteTotalNumero,
        limite_usado: Math.min(limiteUsadoNumero, limiteTotalNumero),
        fechamento: fechamentoNumero,
        vencimento: vencimentoNumero,
        ativo,
      };

      if (editandoId) {
        await atualizarCartao(editandoId, payload);
        setSucesso("Cartão atualizado.");
      } else {
        await criarCartao(payload);
        setSucesso("Cartão cadastrado.");
      }

      limparFormulario();
      await carregarCartoes();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o cartão.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(cartaoId: number) {
    if (!session) {
      return;
    }

    setErro("");
    setSucesso("");

    try {
      await removerCartao(cartaoId, session.userId);
      setSucesso("Cartão removido.");
      await carregarCartoes();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível remover o cartão.");
    }
  }

  const usoGeral = resumo.limiteTotal > 0 ? (resumo.limiteUsado / resumo.limiteTotal) * 100 : 0;

  if (carregando) {
    return <p className="empty-state">Carregando cartões...</p>;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">API de cartão</span>
          <h2>Cartões e limite disponível</h2>
        </div>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card featured">
          <span>Limite disponível</span>
          <strong>{moeda.format(resumo.limiteDisponivel)}</strong>
          <p>Limite livre considerando todos os cartões ativos e cadastrados.</p>
        </article>
        <article className="kpi-card">
          <span>Limite total</span>
          <strong>{moeda.format(resumo.limiteTotal)}</strong>
          <p>Capacidade total dos cartões cadastrados.</p>
        </article>
        <article className="kpi-card">
          <span>Uso geral</span>
          <strong>{usoGeral.toFixed(0)}%</strong>
          <p>{moeda.format(resumo.limiteUsado)} já comprometidos na fatura.</p>
        </article>
      </div>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">{editandoId ? "Editar cartão" : "Novo cartão"}</span>
            <h2>{editandoId ? "Atualizar limite e vencimento" : "Cadastrar cartão de crédito"}</h2>
          </div>
        </div>

        <form className="card-form" onSubmit={salvar}>
          <label>
            Nome
            <input
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex: Cartão principal"
              required
              value={nome}
            />
          </label>
          <label>
            Bandeira
            <select onChange={(event) => setBandeira(event.target.value)} value={bandeira}>
              {bandeiras.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Limite total
            <input
              min="0"
              onChange={(event) => setLimiteTotal(event.target.value)}
              required
              step="0.01"
              type="number"
              value={limiteTotal}
            />
          </label>
          <label>
            Usado na fatura
            <input
              min="0"
              onChange={(event) => setLimiteUsado(event.target.value)}
              step="0.01"
              type="number"
              value={limiteUsado}
            />
          </label>
          <label>
            Fecha dia
            <input
              max="31"
              min="1"
              onChange={(event) => setFechamento(event.target.value)}
              required
              type="number"
              value={fechamento}
            />
          </label>
          <label>
            Vence dia
            <input
              max="31"
              min="1"
              onChange={(event) => setVencimento(event.target.value)}
              required
              type="number"
              value={vencimento}
            />
          </label>
          <label className="checkbox-field">
            <input checked={ativo} onChange={(event) => setAtivo(event.target.checked)} type="checkbox" />
            Ativo
          </label>
          <div className="form-actions">
            <button className="button primary" disabled={salvando} type="submit">
              {salvando ? "Salvando..." : editandoId ? "Atualizar" : "Salvar"}
            </button>
            {editandoId && (
              <button className="button secondary" onClick={limparFormulario} type="button">
                Cancelar
              </button>
            )}
          </div>
        </form>

        {erro && <p className="form-error">{erro}</p>}
        {sucesso && <p className="form-success">{sucesso}</p>}
      </section>

      <section className="card-grid">
        {cartoes.map((cartao) => {
          const uso = percentualUso(cartao);
          const estado = estadoDoCartao(cartao);

          return (
            <article className={`credit-card ${estado}`} key={cartao.id}>
              <div className="credit-card-top">
                <div>
                  <span>{cartao.bandeira}</span>
                  <h3>{cartao.nome}</h3>
                </div>
                <span className={`status ${estado}`}>{labelEstado(estado)}</span>
              </div>
              <div className="credit-limit">
                <span style={{ width: `${uso}%` }} />
              </div>
              <div className="credit-card-numbers">
                <div>
                  <span>Usado</span>
                  <strong>{moeda.format(cartao.limite_usado)}</strong>
                </div>
                <div>
                  <span>Disponível</span>
                  <strong>{moeda.format(cartao.limite_total - cartao.limite_usado)}</strong>
                </div>
              </div>
              <p>
                Fecha dia {cartao.fechamento} e vence dia {cartao.vencimento}.
              </p>
              <div className="table-actions">
                <button className="text-button" onClick={() => preencherEdicao(cartao)} type="button">
                  Editar
                </button>
                <button className="text-button danger" onClick={() => void excluir(cartao.id)} type="button">
                  Remover
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {cartoes.length === 0 && <p className="empty-state">Nenhum cartão cadastrado ainda.</p>}
    </section>
  );
}
