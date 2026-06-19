import type { ErrorRequestHandler } from "express";

import type { ApiError } from "../types";

export const tratarErro: ErrorRequestHandler = (error: ApiError, _req, res, _next) => {
  const statusCode = error.statusCode ?? 500;

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? "Erro interno do servidor." : error.message,
    code: error.code,
  });
};
