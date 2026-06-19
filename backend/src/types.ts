import type { Request } from "express";

export type TipoContaUsuario = "pessoal" | "empresarial";
export type TipoCategoria = "receita" | "despesa" | "ambos";
export type TipoCompromisso = "pagar" | "receber";
export type StatusCompromisso = "aberto" | "pago" | "cancelado";

export interface UsuarioRow {
  id: number;
  nome: string;
  email: string;
  senha: string;
  tipo_conta: TipoContaUsuario | "admin";
}

export interface ContaRow {
  id: number;
  usuario_id: number;
  nome_conta: string;
  tipo: string;
  instituicao: string | null;
  saldo_atual: number;
  criado_em?: string;
}

export interface CartaoRow {
  id: number;
  usuario_id: number;
  nome: string;
  bandeira: string;
  limite_total: number;
  limite_usado: number;
  fechamento: number;
  vencimento: number;
  ativo: number;
  criado_em?: string;
}

export interface FuncionarioRow {
  id: number;
  usuario_id: number;
  nome: string;
  funcao: string;
  salario: number;
  beneficios: number;
  ativo: number;
  criado_em?: string;
}

export interface CategoriaRow {
  id: number;
  usuario_id: number;
  nome: string;
  tipo: TipoCategoria;
}

export interface MovimentacaoRow {
  id: number;
  usuario_id: number;
  conta_id: number;
  categoria_id: number;
  valor: number;
  descricao: string | null;
  data_movimentacao: string;
}

export interface CompromissoRow {
  id: number;
  usuario_id: number;
  tipo: TipoCompromisso;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusCompromisso;
  recorrente: number;
  criado_em: string;
}

export interface InvestimentoRow {
  id: number;
  usuario_id: number;
  nome: string;
  tipo: string;
  instituicao: string | null;
  quantidade: number;
  preco_medio: number;
  valor_atual: number;
  data_atualizacao: string;
  criado_em: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export interface AuthenticatedRequest extends Request {
  usuarioAutenticadoId?: number;
}

export interface TokenPayload {
  sub: number;
  nome: string;
  tipoConta: TipoContaUsuario | "admin";
  exp: number;
}
