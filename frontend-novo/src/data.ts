import type { InsightFinanceiro, Lancamento, MetaFinanceira } from "./types";

export const lancamentos: Lancamento[] = [
  {
    id: 1,
    descricao: "Pagamento de cliente - pacote mensal",
    categoria: "Receita",
    tipo: "entrada",
    valor: 8200,
    data: "2026-05-15",
    conta: "Conta principal",
    status: "confirmado",
  },
  {
    id: 2,
    descricao: "Assinaturas de ferramentas",
    categoria: "Operacional",
    tipo: "saida",
    valor: 680,
    data: "2026-05-14",
    conta: "Cartao corporativo",
    status: "confirmado",
  },
  {
    id: 3,
    descricao: "Reserva para impostos",
    categoria: "Planejamento",
    tipo: "saida",
    valor: 1260,
    data: "2026-05-12",
    conta: "Reserva",
    status: "pendente",
  },
  {
    id: 4,
    descricao: "Consultoria avulsa",
    categoria: "Receita",
    tipo: "entrada",
    valor: 2400,
    data: "2026-05-10",
    conta: "Conta principal",
    status: "confirmado",
  },
  {
    id: 5,
    descricao: "Marketing e anúncios",
    categoria: "Crescimento",
    tipo: "saida",
    valor: 920,
    data: "2026-05-08",
    conta: "Cartao corporativo",
    status: "confirmado",
  },
  {
    id: 6,
    descricao: "Reembolso fornecedor",
    categoria: "Receita",
    tipo: "entrada",
    valor: 560,
    data: "2026-05-05",
    conta: "Conta principal",
    status: "confirmado",
  },
];

export const metas: MetaFinanceira[] = [
  {
    id: 1,
    nome: "Reserva operacional",
    atual: 14800,
    objetivo: 24000,
    prazo: "Ago/2026",
  },
  {
    id: 2,
    nome: "Quitacao de custos fixos",
    atual: 6200,
    objetivo: 9000,
    prazo: "Jun/2026",
  },
  {
    id: 3,
    nome: "Investimento em produto",
    atual: 4100,
    objetivo: 12000,
    prazo: "Out/2026",
  },
];

export const insights: InsightFinanceiro[] = [
  {
    titulo: "Fluxo de caixa saudável",
    descricao: "As entradas do mês superam as saídas em 62%, mantendo margem para reserva.",
    nivel: "positivo",
  },
  {
    titulo: "Custos operacionais subindo",
    descricao: "Ferramentas e marketing concentram os maiores aumentos da semana.",
    nivel: "atencao",
  },
  {
    titulo: "Reserva abaixo da meta",
    descricao: "Faltam R$ 9.200 para atingir a cobertura planejada de três meses.",
    nivel: "critico",
  },
];
