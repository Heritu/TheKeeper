import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  criarFuncionario,
  criarMovimentacao,
  getSession,
  listarCategorias,
  listarContas,
  listarFuncionarios,
  listarMovimentacoes,
  removerFuncionario,
} from "../api";
import { gerarRelatorioMovimentacoesMensalPdf } from "../pdfReport";
import type { Categoria, Conta, Funcionario, Movimentacao, TipoMovimentacao } from "../types";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type TipoFiltro = "todos" | TipoMovimentacao;
type ModeloLancamento = {
  label: string;
  descricao: string;
  valor: string;
  tipo: TipoMovimentacao;
};

const hoje = new Date().toISOString().slice(0, 10);
const modelosPessoais: ModeloLancamento[] = [
  { label: "Salário", descricao: "Salário", valor: "3500", tipo: "entrada" },
  { label: "Mercado", descricao: "Mercado", valor: "180", tipo: "saida" },
  { label: "Aluguel", descricao: "Aluguel", valor: "1200", tipo: "saida" },
  { label: "Cliente", descricao: "Pagamento de cliente", valor: "2500", tipo: "entrada" },
];
const modelosNegocios: ModeloLancamento[] = [
  { label: "Cliente PJ", descricao: "Recebimento de cliente", valor: "4200", tipo: "entrada" },
  { label: "Salários", descricao: "Salário dos funcionários", valor: "8600", tipo: "saida" },
  { label: "Benefícios", descricao: "Benefícios dos funcionários", valor: "1650", tipo: "saida" },
  { label: "Reforma", descricao: "Reforma do espaço comercial", valor: "3200", tipo: "saida" },
];

function tipoPorValor(valor: number): TipoMovimentacao {
  return valor < 0 ? "saida" : "entrada";
}

function mesDaMovimentacao(item: Movimentacao) {
  return item.data_movimentacao.slice(0, 7);
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

export default function Lancamentos() {
  const session = useMemo(() => getSession(), []);
  const empresarial = session?.tipoConta === "empresarial";
  const modelosLancamento = empresarial ? modelosNegocios : modelosPessoais;
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [mesSelecionado, setMesSelecionado] = useState(hoje.slice(0, 7));
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [tipo, setTipo] = useState<TipoMovimentacao>("saida");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [contaId, setContaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [funcionariosModalAberta, setFuncionariosModalAberta] = useState(false);
  const [nomeFuncionario, setNomeFuncionario] = useState("");
  const [funcaoFuncionario, setFuncaoFuncionario] = useState("");
  const [salarioFuncionario, setSalarioFuncionario] = useState("");
  const [beneficiosFuncionario, setBeneficiosFuncionario] = useState("");
  const [salvandoFuncionario, setSalvandoFuncionario] = useState(false);

  async function atualizarDados() {
    if (!session) {
      return;
    }

    setErro("");

    try {
      const [contasApi, categoriasApi, movimentacoesApi, funcionariosApi] = await Promise.all([
        listarContas(session.userId),
        listarCategorias(session.userId),
        listarMovimentacoes(session.userId),
        empresarial ? listarFuncionarios(session.userId) : Promise.resolve(null),
      ]);
      setContas(contasApi);
      setCategorias(categoriasApi);
      setMovimentacoes(movimentacoesApi);
      setFuncionarios(funcionariosApi?.funcionarios ?? []);
      setContaId((atual) => atual || String(contasApi[0]?.id ?? ""));
      setCategoriaId((atual) => atual || String(categoriasApi[0]?.id ?? ""));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar lançamentos.");
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
        const [contasApi, categoriasApi, movimentacoesApi, funcionariosApi] = await Promise.all([
          listarContas(usuarioId),
          listarCategorias(usuarioId),
          listarMovimentacoes(usuarioId),
          empresarial ? listarFuncionarios(usuarioId) : Promise.resolve(null),
        ]);

        if (!ativo) {
          return;
        }

        setContas(contasApi);
        setCategorias(categoriasApi);
        setMovimentacoes(movimentacoesApi);
        setFuncionarios(funcionariosApi?.funcionarios ?? []);
        setContaId((atual) => atual || String(contasApi[0]?.id ?? ""));
        setCategoriaId((atual) => atual || String(categoriasApi[0]?.id ?? ""));
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar lançamentos.");
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
  }, [session, empresarial]);

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>([hoje.slice(0, 7)]);

    movimentacoes.forEach((item) => {
      meses.add(mesDaMovimentacao(item));
    });

    return [...meses].sort((a, b) => b.localeCompare(a));
  }, [movimentacoes]);

  const movimentacoesDoMes = useMemo(
    () => movimentacoes.filter((item) => mesDaMovimentacao(item) === mesSelecionado),
    [mesSelecionado, movimentacoes],
  );

  const lancamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return movimentacoesDoMes.filter((item) => {
      const tipoItem = tipoPorValor(item.valor);
      const combinaBusca =
        termo.length === 0 ||
        (item.descricao ?? "").toLowerCase().includes(termo) ||
        (item.categoria_nome ?? "").toLowerCase().includes(termo) ||
        (item.nome_conta ?? "").toLowerCase().includes(termo);
      const combinaTipo = tipoFiltro === "todos" || tipoItem === tipoFiltro;

      return combinaBusca && combinaTipo;
    });
  }, [busca, movimentacoesDoMes, tipoFiltro]);

  const resumoLancamentos = useMemo(() => {
    const entradas = movimentacoesDoMes
      .filter((item) => item.valor > 0)
      .reduce((total, item) => total + Number(item.valor), 0);
    const despesas = movimentacoesDoMes
      .filter((item) => item.valor < 0)
      .reduce((total, item) => total + Math.abs(Number(item.valor)), 0);
    const porCategoria = movimentacoesDoMes.reduce<Record<string, number>>((total, item) => {
      if (item.valor >= 0) {
        return total;
      }

      const categoria = item.categoria_nome ?? "Geral";
      total[categoria] = (total[categoria] ?? 0) + Math.abs(Number(item.valor));
      return total;
    }, {});
    const categoriaDestaque = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];

    return {
      entradas,
      despesas,
      resultado: entradas - despesas,
      categoriaDestaque,
    };
  }, [movimentacoesDoMes]);

  const resumoFuncionarios = useMemo(() => {
    const ativos = funcionarios.filter((funcionario) => funcionario.ativo === 1);
    const salarios = ativos.reduce((total, funcionario) => total + Number(funcionario.salario), 0);
    const beneficios = ativos.reduce((total, funcionario) => total + Number(funcionario.beneficios), 0);

    return {
      ativos: ativos.length,
      salarios,
      beneficios,
      total: salarios + beneficios,
    };
  }, [funcionarios]);

  async function salvarLancamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    const valorNumerico = Number(valor);

    if (!descricao.trim() || !Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setErro("Informe descrição e valor positivo para registrar o lançamento.");
      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      await criarMovimentacao({
        usuario_id: session.userId,
        conta_id: contaId ? Number(contaId) : undefined,
        categoria_id: categoriaId ? Number(categoriaId) : undefined,
        valor: tipo === "saida" ? -Math.abs(valorNumerico) : Math.abs(valorNumerico),
        descricao,
        data_movimentacao: data,
      });

      setDescricao("");
      setValor("");
      setTipo("saida");
      setData(hoje);
      setSucesso(tipo === "saida" ? "Despesa registrada com sucesso." : "Entrada registrada com sucesso.");
      await atualizarDados();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  function usarModelo(modelo: ModeloLancamento) {
    setTipo(modelo.tipo);
    setDescricao(modelo.descricao);
    setValor(modelo.valor);
    setData(hoje);
    setErro("");
    setSucesso("");
  }

  async function salvarFuncionario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    const salario = Number(salarioFuncionario);
    const beneficios = Number(beneficiosFuncionario || 0);

    if (
      !nomeFuncionario.trim() ||
      !funcaoFuncionario.trim() ||
      !Number.isFinite(salario) ||
      salario < 0 ||
      !Number.isFinite(beneficios) ||
      beneficios < 0
    ) {
      setErro("Informe nome, função, salário e benefícios válidos.");
      return;
    }

    setSalvandoFuncionario(true);
    setErro("");
    setSucesso("");

    try {
      await criarFuncionario({
        usuario_id: session.userId,
        nome: nomeFuncionario,
        funcao: funcaoFuncionario,
        salario,
        beneficios,
        ativo: true,
      });
      setNomeFuncionario("");
      setFuncaoFuncionario("");
      setSalarioFuncionario("");
      setBeneficiosFuncionario("");
      setSucesso("Funcionário adicionado à folha.");
      await atualizarDados();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o funcionário.");
    } finally {
      setSalvandoFuncionario(false);
    }
  }

  async function removerFuncionarioDaLista(funcionarioId: number) {
    if (!session) {
      return;
    }

    setErro("");
    setSucesso("");

    try {
      await removerFuncionario(funcionarioId, session.userId);
      setSucesso("Funcionário removido da folha.");
      await atualizarDados();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível remover o funcionário.");
    }
  }

  function preencherFolha() {
    if (resumoFuncionarios.total <= 0) {
      setErro("Adicione funcionários à folha antes de preparar o lançamento.");
      return;
    }

    // A folha é preparada como despesa, mas o usuário ainda revisa antes de salvar.
    setTipo("saida");
    setDescricao("Folha de pagamento - salários e benefícios");
    setValor(resumoFuncionarios.total.toFixed(2));
    setData(hoje);
    setFuncionariosModalAberta(false);
    setErro("");
    setSucesso("Folha preenchida no formulário. Revise os dados e salve a despesa.");
  }

  function gerarPdfMensal() {
    if (!session) {
      return;
    }

    const gerado = gerarRelatorioMovimentacoesMensalPdf(session, mesSelecionado, movimentacoesDoMes);

    if (!gerado) {
      setErro("Permita pop-ups no navegador para gerar o relatório mensal em PDF.");
    }
  }

  if (carregando) {
    return <p className="empty-state">Carregando lançamentos...</p>;
  }

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Controle operacional</span>
          <h2>Lançamentos financeiros</h2>
        </div>
      </div>

      <section className="focus-panel">
        <div>
          <span className="eyebrow">{empresarial ? "Rotina do negócio" : "Entrada rápida"}</span>
          <h2>{empresarial ? "Registre movimentos da operação" : "Registre algo em menos de um minuto"}</h2>
          <p>
            {empresarial
              ? "Use exemplos de recebimento, folha, benefícios e manutenção para diferenciar a rotina empresarial."
              : "Use um modelo para preencher o formulário e ajuste apenas o valor ou a descrição."}
          </p>
          {empresarial && (
            <div className="employee-preview" aria-label="Resumo de funcionários">
              <span>Funcionários e folha</span>
              <strong>
                {resumoFuncionarios.ativos} ativos · {moeda.format(resumoFuncionarios.total)}
              </strong>
              {funcionarios.slice(0, 2).map((funcionario) => (
                <p key={funcionario.id}>
                  {funcionario.nome} ({funcionario.funcao}) - salário {moeda.format(funcionario.salario)} |
                  benefícios {moeda.format(funcionario.beneficios)}
                </p>
              ))}
              {funcionarios.length === 0 && <p>Nenhum funcionário cadastrado na folha.</p>}
              <div className="employee-actions">
                <button className="button secondary" onClick={() => setFuncionariosModalAberta(true)} type="button">
                  Ver funcionários
                </button>
                <button
                  className="button primary"
                  disabled={resumoFuncionarios.total <= 0}
                  onClick={preencherFolha}
                  type="button"
                >
                  Preencher folha
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="quick-actions" aria-label="Modelos de lançamento">
          {modelosLancamento.map((modelo) => (
            <button
              className={modelo.tipo === "entrada" ? "quick-chip entrada" : "quick-chip saida"}
              key={modelo.label}
              onClick={() => usarModelo(modelo)}
              type="button"
            >
              {modelo.tipo === "entrada" ? "+" : "-"} {modelo.label}
            </button>
          ))}
        </div>
      </section>

      <div className="kpi-grid">
        <article className="kpi-card">
          <span>Entradas do período</span>
          <strong className="entrada">{moeda.format(resumoLancamentos.entradas)}</strong>
          <p>Receitas registradas em {formatarMes(mesSelecionado)}.</p>
        </article>
        <article className="kpi-card">
          <span>Despesas do período</span>
          <strong className="saida">{moeda.format(resumoLancamentos.despesas)}</strong>
          <p>Saídas confirmadas em {formatarMes(mesSelecionado)}.</p>
        </article>
        <article className="kpi-card">
          <span>Categoria critica</span>
          <strong>{resumoLancamentos.categoriaDestaque?.[0] ?? "Sem despesas"}</strong>
          <p>{moeda.format(resumoLancamentos.categoriaDestaque?.[1] ?? 0)} concentrados nesta categoria.</p>
        </article>
      </div>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Novo registro</span>
            <h2>{tipo === "saida" ? "Registrar despesa" : "Registrar entrada"}</h2>
          </div>
        </div>

        <form className="entry-form" onSubmit={salvarLancamento}>
          <label>
            Tipo
            <select onChange={(event) => setTipo(event.target.value as TipoMovimentacao)} value={tipo}>
              <option value="saida">Despesa</option>
              <option value="entrada">Entrada</option>
            </select>
          </label>
          <label>
            Descrição
            <input
              onChange={(event) => setDescricao(event.target.value)}
              placeholder={tipo === "saida" ? "Ex: Aluguel, mercado, fornecedor" : "Ex: Salário, venda, cliente"}
              required
              value={descricao}
            />
          </label>
          <label>
            Valor
            <input
              min="0.01"
              onChange={(event) => setValor(event.target.value)}
              placeholder="0,00"
              required
              step="0.01"
              type="number"
              value={valor}
            />
          </label>
          <label>
            Data
            <input onChange={(event) => setData(event.target.value)} required type="date" value={data} />
          </label>
          <label>
            Conta
            <select onChange={(event) => setContaId(event.target.value)} value={contaId}>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome_conta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select onChange={(event) => setCategoriaId(event.target.value)} value={categoriaId}>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary" disabled={salvando} type="submit">
            {salvando ? "Salvando..." : tipo === "saida" ? "Salvar despesa" : "Salvar entrada"}
          </button>
        </form>

        {erro && <p className="form-error">{erro}</p>}
        {sucesso && <p className="form-success">{sucesso}</p>}
      </section>

      <section className="filters-panel">
        <label>
          Mês
          <select onChange={(event) => setMesSelecionado(event.target.value)} value={mesSelecionado}>
            {mesesDisponiveis.map((mes) => (
              <option key={mes} value={mes}>
                {formatarMes(mes)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Descrição, categoria ou conta"
            value={busca}
          />
        </label>
        <label>
          Tipo
          <select onChange={(event) => setTipoFiltro(event.target.value as TipoFiltro)} value={tipoFiltro}>
            <option value="todos">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Despesas</option>
          </select>
        </label>
        <div className="filter-actions">
          <button className="button secondary" onClick={gerarPdfMensal} type="button">
            Histórico Mensal
          </button>
        </div>
      </section>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {lancamentosFiltrados.map((item) => {
              const tipoItem = tipoPorValor(item.valor);

              return (
                <tr key={item.id}>
                  <td data-label="Descrição">{item.descricao ?? "Sem descrição"}</td>
                  <td data-label="Categoria">{item.categoria_nome ?? "Geral"}</td>
                  <td data-label="Conta">{item.nome_conta ?? "Principal"}</td>
                  <td data-label="Data">{formatarDataLocal(item.data_movimentacao)}</td>
                  <td data-label="Tipo">
                    <span className={`status ${tipoItem}`}>{tipoItem === "saida" ? "Despesa" : "Entrada"}</span>
                  </td>
                  <td className={tipoItem} data-label="Valor">
                    {tipoItem === "saida" ? "-" : "+"}
                    {moeda.format(Math.abs(item.valor))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lancamentosFiltrados.length === 0 && (
          <div className="empty-state action-empty">
            <strong>
              {movimentacoes.length === 0
                ? "Nenhum lançamento registrado ainda."
                : movimentacoesDoMes.length === 0
                  ? "Nenhum lançamento neste mês."
                  : "Nada encontrado com este filtro."}
            </strong>
            <p>
              {movimentacoes.length === 0
                ? "Use os modelos acima ou preencha o formulario para criar o primeiro registro."
                : movimentacoesDoMes.length === 0
                  ? "Escolha outro mês no histórico ou registre uma movimentação para este período."
                : "Limpe a busca ou altere o tipo para voltar a ver seus movimentos."}
            </p>
          </div>
        )}
      </section>

      {empresarial && funcionariosModalAberta && (
        <div className="modal-backdrop" role="presentation">
          <section aria-label="Funcionários e folha" className="modal-panel" role="dialog">
            <div className="modal-header">
              <div>
                <span className="eyebrow">Negócios</span>
                <h2>Funcionários e folha</h2>
              </div>
              <button className="text-button" onClick={() => setFuncionariosModalAberta(false)} type="button">
                Fechar
              </button>
            </div>

            <div className="payroll-summary">
              <div>
                <span>Funcionários ativos</span>
                <strong>{resumoFuncionarios.ativos}</strong>
              </div>
              <div>
                <span>Salários</span>
                <strong>{moeda.format(resumoFuncionarios.salarios)}</strong>
              </div>
              <div>
                <span>Benefícios</span>
                <strong>{moeda.format(resumoFuncionarios.beneficios)}</strong>
              </div>
              <div>
                <span>Total mensal</span>
                <strong>{moeda.format(resumoFuncionarios.total)}</strong>
              </div>
            </div>

            <form className="employee-form" onSubmit={salvarFuncionario}>
              <label>
                Nome
                <input
                  onChange={(event) => setNomeFuncionario(event.target.value)}
                  placeholder="Ex: Funcionário 1"
                  required
                  value={nomeFuncionario}
                />
              </label>
              <label>
                Função
                <input
                  onChange={(event) => setFuncaoFuncionario(event.target.value)}
                  placeholder="Ex: Atendimento"
                  required
                  value={funcaoFuncionario}
                />
              </label>
              <label>
                Salário
                <input
                  min="0"
                  onChange={(event) => setSalarioFuncionario(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={salarioFuncionario}
                />
              </label>
              <label>
                Benefícios
                <input
                  min="0"
                  onChange={(event) => setBeneficiosFuncionario(event.target.value)}
                  step="0.01"
                  type="number"
                  value={beneficiosFuncionario}
                />
              </label>
              <button className="button primary" disabled={salvandoFuncionario} type="submit">
                {salvandoFuncionario ? "Salvando..." : "Adicionar"}
              </button>
            </form>

            <div className="employee-list">
              {funcionarios.map((funcionario) => (
                <article className="employee-row" key={funcionario.id}>
                  <div>
                    <strong>{funcionario.nome}</strong>
                    <span>{funcionario.funcao}</span>
                  </div>
                  <div>
                    <span>Salário</span>
                    <strong>{moeda.format(funcionario.salario)}</strong>
                  </div>
                  <div>
                    <span>Benefícios</span>
                    <strong>{moeda.format(funcionario.beneficios)}</strong>
                  </div>
                  <button
                    className="text-button danger"
                    onClick={() => void removerFuncionarioDaLista(funcionario.id)}
                    type="button"
                  >
                    Remover
                  </button>
                </article>
              ))}
              {funcionarios.length === 0 && (
                <p className="empty-state">Cadastre a equipe para calcular a folha mensal da empresa.</p>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="button secondary"
                disabled={resumoFuncionarios.total <= 0}
                onClick={preencherFolha}
                type="button"
              >
                Preencher folha no lançamento
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
