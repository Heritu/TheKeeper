import { useEffect, useMemo, useState, type FormEvent } from "react";
import { criarInvestimento, getSession, listarInvestimentos } from "../api";
import type { Investimento, ResumoInvestimentos } from "../types";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const opcoesPessoais = ["Renda fixa", "Ações", "Fundos imobiliários", "Previdência", "Cripto"];
const opcoesNegocios = ["Reserva de caixa", "CDB PJ", "Fundo DI", "Capital de giro", "Expansão"];

export default function Investimentos() {
  const session = useMemo(() => getSession(), []);
  const empresarial = session?.tipoConta === "empresarial";
  const tipos = empresarial ? opcoesNegocios : opcoesPessoais;
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [resumo, setResumo] = useState<ResumoInvestimentos>({
    valorAtual: 0,
    custoTotal: 0,
    resultado: 0,
  });
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState(tipos[0]);
  const [instituicao, setInstituicao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [precoMedio, setPrecoMedio] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  async function atualizarInvestimentos() {
    if (!session) {
      return;
    }

    setErro("");

    try {
      const data = await listarInvestimentos(session.userId);
      setInvestimentos(data.investimentos);
      setResumo(data.resumo);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar investimentos.");
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
        const data = await listarInvestimentos(usuarioId);

        if (!ativo) {
          return;
        }

        setInvestimentos(data.investimentos);
        setResumo(data.resumo);
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar investimentos.");
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

  const alocacao = useMemo(() => {
    const porTipo = investimentos.reduce<Record<string, number>>((total, item) => {
      total[item.tipo] = (total[item.tipo] ?? 0) + Number(item.valor_atual);
      return total;
    }, {});

    return Object.entries(porTipo)
      .map(([nomeTipo, valor]) => ({
        nomeTipo,
        valor,
        percentual: resumo.valorAtual > 0 ? (valor / resumo.valorAtual) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [investimentos, resumo.valorAtual]);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    const quantidadeNumero = Number(quantidade);
    const precoMedioNumero = Number(precoMedio);
    const valorAtualNumero = Number(valorAtual);

    if (
      !nome.trim() ||
      !Number.isFinite(quantidadeNumero) ||
      !Number.isFinite(precoMedioNumero) ||
      !Number.isFinite(valorAtualNumero)
    ) {
      setErro("Preencha nome, quantidade, custo médio e valor atual.");
      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      await criarInvestimento({
        usuario_id: session.userId,
        nome,
        tipo,
        instituicao,
        quantidade: quantidadeNumero,
        preco_medio: precoMedioNumero,
        valor_atual: valorAtualNumero,
      });

      setNome("");
      setInstituicao("");
      setQuantidade("1");
      setPrecoMedio("");
      setValorAtual("");
      setSucesso(empresarial ? "Aplicação da empresa registrada." : "Investimento pessoal registrado.");
      await atualizarInvestimentos();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar investimento.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="empty-state">Carregando investimentos...</p>;
  }

  return (
    <section className="page-stack">
      <section className={empresarial ? "investment-hero business" : "investment-hero personal"}>
        <div>
          <span className="eyebrow">{empresarial ? "Capital da empresa" : "Patrimônio pessoal"}</span>
          <h2>{empresarial ? "Investimentos e reservas do negócio" : "Carteira pessoal consolidada"}</h2>
          <p>
            {empresarial
              ? "Acompanhe caixa aplicado, liquidez e recursos separados para operação, impostos e expansão."
              : "Organize ativos, acompanhe evolução patrimonial e veja o resultado da sua carteira."}
          </p>
        </div>
        <strong>{moeda.format(resumo.valorAtual)}</strong>
      </section>

      <div className="kpi-grid">
        <article className="kpi-card">
          <span>{empresarial ? "Capital aplicado" : "Valor atual"}</span>
          <strong>{moeda.format(resumo.valorAtual)}</strong>
          <p>{empresarial ? "Reservas e aplicações da empresa." : "Patrimônio marcado no cadastro."}</p>
        </article>
        <article className="kpi-card">
          <span>{empresarial ? "Base de custo" : "Total investido"}</span>
          <strong>{moeda.format(resumo.custoTotal)}</strong>
          <p>{empresarial ? "Referência contábil dos aportes." : "Quantidade vezes preço médio."}</p>
        </article>
        <article className="kpi-card">
          <span>Resultado</span>
          <strong className={resumo.resultado >= 0 ? "entrada" : "saida"}>
            {moeda.format(resumo.resultado)}
          </strong>
          <p>{empresarial ? "Ganho ou perda sobre recursos aplicados." : "Evolução estimada da carteira."}</p>
        </article>
      </div>

      <section className="allocation-panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Alocação</span>
            <h2>{empresarial ? "Onde o capital está parado" : "Distribuição da carteira"}</h2>
          </div>
        </div>
        <div className="allocation-list">
          {alocacao.map((item) => (
            <div className="allocation-item" key={item.nomeTipo}>
              <div>
                <strong>{item.nomeTipo}</strong>
                <span>{moeda.format(item.valor)}</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${item.percentual}%` }} />
              </div>
              <small>{item.percentual.toFixed(0)}%</small>
            </div>
          ))}
          {alocacao.length === 0 && <p className="empty-state">A alocação aparece depois do primeiro cadastro.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Novo investimento</span>
            <h2>{empresarial ? "Registrar aplicação do negócio" : "Adicionar ativo pessoal"}</h2>
          </div>
        </div>

        <form className="investment-form" onSubmit={salvar}>
          <label>
            {empresarial ? "Destino do recurso" : "Nome do ativo"}
            <input
              onChange={(event) => setNome(event.target.value)}
              placeholder={empresarial ? "Ex: Reserva de impostos" : "Ex: Tesouro Selic"}
              required
              value={nome}
            />
          </label>
          <label>
            Tipo
            <select onChange={(event) => setTipo(event.target.value)} value={tipo}>
              {tipos.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            {empresarial ? "Banco ou corretora PJ" : "Instituição"}
            <input
              onChange={(event) => setInstituicao(event.target.value)}
              placeholder={empresarial ? "Ex: Banco da empresa" : "Ex: Corretora"}
              value={instituicao}
            />
          </label>
          <label>
            Quantidade
            <input
              min="0"
              onChange={(event) => setQuantidade(event.target.value)}
              step="0.0001"
              type="number"
              value={quantidade}
            />
          </label>
          <label>
            {empresarial ? "Custo médio" : "Preço médio"}
            <input
              min="0"
              onChange={(event) => setPrecoMedio(event.target.value)}
              required
              step="0.01"
              type="number"
              value={precoMedio}
            />
          </label>
          <label>
            Valor atual
            <input
              min="0"
              onChange={(event) => setValorAtual(event.target.value)}
              required
              step="0.01"
              type="number"
              value={valorAtual}
            />
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
              <th>{empresarial ? "Recurso" : "Ativo"}</th>
              <th>Tipo</th>
              <th>Instituição</th>
              <th>Quantidade</th>
              <th>Custo</th>
              <th>Valor atual</th>
            </tr>
          </thead>
          <tbody>
            {investimentos.map((item) => (
              <tr key={item.id}>
                <td data-label={empresarial ? "Recurso" : "Ativo"}>{item.nome}</td>
                <td data-label="Tipo">{item.tipo}</td>
                <td data-label="Instituição">{item.instituicao || "-"}</td>
                <td data-label="Quantidade">{item.quantidade}</td>
                <td data-label="Custo">{moeda.format(item.quantidade * item.preco_medio)}</td>
                <td data-label="Valor atual">{moeda.format(item.valor_atual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {investimentos.length === 0 && (
          <p className="empty-state">
            {empresarial
              ? "Nenhuma aplicação empresarial cadastrada ainda."
              : "Nenhum investimento pessoal cadastrado ainda."}
          </p>
        )}
      </section>
    </section>
  );
}
