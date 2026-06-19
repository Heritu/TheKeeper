import type { RequestHandler } from "express";

import type { AuthenticatedRequest } from "../types";
import { criarErro } from "../utils/http";
import { verificarToken } from "../utils/security";

export const autenticar: RequestHandler = (req, _res, next) => {
  const [tipo, token] = String(req.headers.authorization ?? "").split(" ");

  if (tipo !== "Bearer" || !token) {
    return next(criarErro(401, "Sessão inválida ou expirada.", "NAO_AUTENTICADO"));
  }

  const payload = verificarToken(token);

  if (!payload) {
    return next(criarErro(401, "Sessão inválida ou expirada.", "NAO_AUTENTICADO"));
  }

  (req as AuthenticatedRequest).usuarioAutenticadoId = payload.sub;
  return next();
};
