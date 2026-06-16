export interface Usuario {
  id: number;
  nome: string;
  email: string;
  tipoConta: TipoUsuario;
}

export type TipoUsuario = "pessoal" | "empresarial";
export type TipoMovimentacao = "entrada" | "saida";
export type TipoCompromisso = "pagar" | "receber";
export type StatusCompromisso = "aberto" | "pago" | "cancelado";

export interface SessaoUsuario {
  userId: number;
  nome: string;
  email?: string;
  tipoConta: TipoUsuario;
  token: string;
}

export interface Conta {
  id: number;
  usuario_id: number;
  nome_conta: string;
  tipo: string;
  instituicao: string | null;
  saldo_atual: number;
}

export interface Cartao {
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

export interface Funcionario {
  id: number;
  usuario_id: number;
  nome: string;
  funcao: string;
  salario: number;
  beneficios: number;
  ativo: number;
  criado_em?: string;
}

export interface ResumoFuncionarios {
  salario: number;
  beneficios: number;
  total: number;
  ativos: number;
}

export interface ResumoCartoes {
  limiteTotal: number;
  limiteUsado: number;
  limiteDisponivel: number;
}

export interface Categoria {
  id: number;
  usuario_id: number;
  nome: string;
  tipo: "receita" | "despesa" | "ambos";
}

export interface Movimentacao {
  id: number;
  usuario_id: number;
  conta_id: number;
  categoria_id: number;
  valor: number;
  descricao: string | null;
  data_movimentacao: string;
  nome_conta?: string;
  categoria_nome?: string;
}

export interface DashboardResumo {
  success: boolean;
  saldo: number;
  entradas: number;
  saidas: number;
  patrimonioInvestido: number;
  ultimasMovimentacoes: Movimentacao[];
  proximosCompromissos: Compromisso[];
}

export interface FluxoCaixaMes {
  mes: string;
  entradas: number;
  saidas: number;
  resultado: number;
}

export interface Compromisso {
  id: number;
  usuario_id: number;
  tipo: TipoCompromisso;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusCompromisso;
  recorrente: number;
}

export interface Investimento {
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

export interface ResumoInvestimentos {
  valorAtual: number;
  custoTotal: number;
  resultado: number;
}

export interface Lancamento {
  id: number;
  descricao: string;
  categoria: string;
  tipo: TipoMovimentacao;
  valor: number;
  data: string;
  conta: string;
  status: "confirmado" | "pendente";
}

export interface MetaFinanceira {
  id: number;
  nome: string;
  atual: number;
  objetivo: number;
  prazo: string;
}

export interface InsightFinanceiro {
  titulo: string;
  descricao: string;
  nivel: "positivo" | "atencao" | "critico";
}
