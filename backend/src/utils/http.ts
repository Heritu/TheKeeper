import type { Request } from "express";

import type {
  ApiError,
  AuthenticatedRequest,
  StatusCompromisso,
  TipoCategoria,
  TipoCompromisso,
  TipoContaUsuario,
} from "../types";

export function normalizarTexto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export function normalizarEmail(valor: unknown): string {
  return normalizarTexto(valor).toLowerCase();
}

export function normalizarTipoContaUsuario(valor: unknown): TipoContaUsuario {
  return valor === "empresarial" ? "empresarial" : "pessoal";
}

export function normalizarTipoCategoria(valor: unknown): TipoCategoria {
  return valor === "receita" || valor === "despesa" ? valor : "ambos";
}

export function normalizarTipoCompromisso(valor: unknown): TipoCompromisso | null {
  return valor === "pagar" || valor === "receber" ? valor : null;
}

export function normalizarStatusCompromisso(valor: unknown): StatusCompromisso {
  return valor === "pago" || valor === "cancelado" ? valor : "aberto";
}

export function normalizarBooleano(valor: unknown): 0 | 1 {
  return valor === true || valor === "true" || valor === 1 || valor === "1" ? 1 : 0;
}

export function lerInteiro(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export function lerUsuarioId(req: Request): number | null {
  const usuarioAutenticadoId = (req as AuthenticatedRequest).usuarioAutenticadoId;
  return usuarioAutenticadoId ?? lerInteiro(req.method === "GET" ? req.query.usuario_id : req.body?.usuario_id);
}

export function lerLimite(valor: unknown, padrao = 50, maximo = 200): number {
  const limite = Number(valor);
  return !Number.isInteger(limite) || limite <= 0 ? padrao : Math.min(limite, maximo);
}

export function lerDiaCartao(valor: unknown, padrao: number): number {
  const dia = Number(valor);
  return !Number.isInteger(dia) || dia < 1 || dia > 31 ? padrao : dia;
}

export function normalizarDataIso(valor: unknown): string | null {
  const texto = normalizarTexto(valor);

  if (!texto) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw criarErro(400, "Informe a data no formato YYYY-MM-DD.", "DATA_INVALIDA");
  }

  return texto;
}

export function criarErro(statusCode: number, message: string, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
