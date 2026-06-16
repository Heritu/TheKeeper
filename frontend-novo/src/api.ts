import type {
  Categoria,
  Cartao,
  Compromisso,
  Conta,
  DashboardResumo,
  FluxoCaixaMes,
  Funcionario,
  Investimento,
  Movimentacao,
  ResumoCartoes,
  ResumoFuncionarios,
  ResumoInvestimentos,
  SessaoUsuario,
  StatusCompromisso,
  TipoCompromisso,
  TipoUsuario,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const STORAGE_KEY = "keeper_session";
const REQUEST_TIMEOUT_MS = 10_000;

interface ApiResponse {
  success: boolean;
  error?: string;
}

interface LoginResponse extends ApiResponse {
  userId: number;
  nome: string;
  email?: string;
  tipoConta: TipoUsuario;
  token: string;
}

interface ListaContasResponse extends ApiResponse {
  contas: Conta[];
}

interface ListaCartoesResponse extends ApiResponse {
  cartoes: Cartao[];
  resumo: ResumoCartoes;
}

interface ListaFuncionariosResponse extends ApiResponse {
  funcionarios: Funcionario[];
  resumo: ResumoFuncionarios;
}

interface ListaCategoriasResponse extends ApiResponse {
  categorias: Categoria[];
}

interface ListaMovimentacoesResponse extends ApiResponse {
  movimentacoes: Movimentacao[];
}

interface FluxoCaixaResponse extends ApiResponse {
  fluxoCaixa: FluxoCaixaMes[];
}

interface InvestimentosResponse extends ApiResponse {
  investimentos: Investimento[];
  resumo: ResumoInvestimentos;
}

interface ListaCompromissosResponse extends ApiResponse {
  compromissos: Compromisso[];
}

export interface CadastroPayload {
  nome: string;
  email: string;
  senha: string;
  tipo_conta: TipoUsuario;
}

export interface LoginPayload {
  email: string;
  senha: string;
}

export interface MovimentacaoPayload {
  usuario_id: number;
  conta_id?: number;
  categoria_id?: number;
  valor: number;
  descricao: string;
  data_movimentacao: string;
}

export interface InvestimentoPayload {
  usuario_id: number;
  nome: string;
  tipo: string;
  instituicao?: string;
  quantidade: number;
  preco_medio: number;
  valor_atual: number;
}

export interface CartaoPayload {
  usuario_id: number;
  nome: string;
  bandeira: string;
  limite_total: number;
  limite_usado: number;
  fechamento: number;
  vencimento: number;
  ativo: boolean;
}

export interface FuncionarioPayload {
  usuario_id: number;
  nome: string;
  funcao: string;
  salario: number;
  beneficios: number;
  ativo: boolean;
}

export interface CompromissoPayload {
  usuario_id: number;
  tipo: TipoCompromisso;
  descricao: string;
  valor: number;
  vencimento: string;
  status?: StatusCompromisso;
  recorrente: boolean;
}

function getStoredToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return (JSON.parse(raw) as SessaoUsuario).token ?? null;
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const metodo = options?.method ?? "GET";
  const tentativas = metodo === "GET" ? 2 : 1;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers = new Headers(options?.headers);
    const token = getStoredToken();

    // Centraliza token, timeout e tratamento de erro de todas as chamadas da API.
    headers.set("Content-Type", "application/json");

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      const data = (await response.json()) as T & ApiResponse;

      if (response.status === 401) {
        clearSession();
        throw new Error("Sessão expirada. Entre novamente.");
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível concluir a operação.");
      }

      return data;
    } catch (error) {
      if (tentativa < tentativas) {
        continue;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("O servidor demorou para responder. Recarregue a página ou tente novamente.", {
          cause: error,
        });
      }

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw new Error("Não foi possível concluir a operação.");
}

export function getSession(): SessaoUsuario | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as SessaoUsuario;

    if (!session.token) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: SessaoUsuario): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem("keeper_user", String(session.userId));
  localStorage.setItem("keeper_tipo", session.tipoConta);
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("keeper_user");
  localStorage.removeItem("keeper_tipo");
}

export async function login(payload: LoginPayload): Promise<SessaoUsuario> {
  const data = await requestJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const session = {
    userId: data.userId,
    nome: data.nome,
    email: data.email ?? payload.email,
    tipoConta: data.tipoConta,
    token: data.token,
  };

  saveSession(session);
  return session;
}

export async function cadastrar(payload: CadastroPayload): Promise<void> {
  await requestJson<ApiResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function buscarDashboard(usuarioId: number): Promise<DashboardResumo> {
  return requestJson<DashboardResumo>(`/api/dashboard?usuario_id=${usuarioId}`);
}

export async function buscarFluxoCaixa(usuarioId: number): Promise<FluxoCaixaMes[]> {
  const data = await requestJson<FluxoCaixaResponse>(`/api/fluxo-caixa?usuario_id=${usuarioId}`);
  return data.fluxoCaixa;
}

export async function listarContas(usuarioId: number): Promise<Conta[]> {
  const data = await requestJson<ListaContasResponse>(`/api/contas?usuario_id=${usuarioId}`);
  return data.contas;
}

export function listarCartoes(usuarioId: number): Promise<ListaCartoesResponse> {
  return requestJson<ListaCartoesResponse>(`/api/cartoes?usuario_id=${usuarioId}`);
}

export async function criarCartao(payload: CartaoPayload): Promise<void> {
  await requestJson<ApiResponse>("/api/cartoes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function atualizarCartao(id: number, payload: CartaoPayload): Promise<void> {
  await requestJson<ApiResponse>(`/api/cartoes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function removerCartao(id: number, usuarioId: number): Promise<void> {
  await requestJson<ApiResponse>(`/api/cartoes/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ usuario_id: usuarioId }),
  });
}

export function listarFuncionarios(usuarioId: number): Promise<ListaFuncionariosResponse> {
  return requestJson<ListaFuncionariosResponse>(`/api/funcionarios?usuario_id=${usuarioId}`);
}

export async function criarFuncionario(payload: FuncionarioPayload): Promise<void> {
  await requestJson<ApiResponse>("/api/funcionarios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function removerFuncionario(id: number, usuarioId: number): Promise<void> {
  await requestJson<ApiResponse>(`/api/funcionarios/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ usuario_id: usuarioId }),
  });
}

export async function listarCategorias(usuarioId: number): Promise<Categoria[]> {
  const data = await requestJson<ListaCategoriasResponse>(`/api/categorias?usuario_id=${usuarioId}`);
  return data.categorias;
}

export async function listarMovimentacoes(usuarioId: number): Promise<Movimentacao[]> {
  const data = await requestJson<ListaMovimentacoesResponse>(
    `/api/movimentacoes?usuario_id=${usuarioId}&limit=200`,
  );
  return data.movimentacoes;
}

export async function criarMovimentacao(payload: MovimentacaoPayload): Promise<void> {
  await requestJson<ApiResponse>("/api/movimentacoes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listarInvestimentos(usuarioId: number): Promise<InvestimentosResponse> {
  return requestJson<InvestimentosResponse>(`/api/investimentos?usuario_id=${usuarioId}`);
}

export async function criarInvestimento(payload: InvestimentoPayload): Promise<void> {
  await requestJson<ApiResponse>("/api/investimentos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listarCompromissos(usuarioId: number): Promise<Compromisso[]> {
  const data = await requestJson<ListaCompromissosResponse>(`/api/compromissos?usuario_id=${usuarioId}`);
  return data.compromissos;
}

export async function criarCompromisso(payload: CompromissoPayload): Promise<void> {
  await requestJson<ApiResponse>("/api/compromissos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function atualizarCompromisso(id: number, payload: CompromissoPayload): Promise<void> {
  await requestJson<ApiResponse>(`/api/compromissos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function removerCompromisso(id: number, usuarioId: number): Promise<void> {
  await requestJson<ApiResponse>(`/api/compromissos/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ usuario_id: usuarioId }),
  });
}
