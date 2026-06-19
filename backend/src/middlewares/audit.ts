import type { RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import type { AuthenticatedRequest } from "../types";

export function criarAuditoria(db: KeeperDatabase): RequestHandler {
  return (req, res, next) => {
    res.on("finish", () => {
      if (res.statusCode >= 400 || !["POST", "PUT", "DELETE"].includes(req.method)) {
        return;
      }

      const usuarioId = (req as AuthenticatedRequest).usuarioAutenticadoId ?? null;
      const entidade = req.path.split("/").filter(Boolean)[0] ?? "api";
      const detalhes = JSON.stringify({ params: req.params, query: req.query });

      db.run(
        `INSERT INTO auditoria (usuario_id, acao, entidade, metodo, rota, ip, detalhes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [usuarioId, `${req.method} ${req.path}`, entidade, req.method, req.originalUrl, req.ip, detalhes],
      ).catch((error) => console.error("Falha ao registrar auditoria:", error));
    });

    next();
  };
}
