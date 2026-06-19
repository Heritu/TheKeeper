import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import { usuarioExiste } from "../services/financeiro";
import type { CompromissoRow } from "../types";
import {
  criarErro,
  lerInteiro,
  lerUsuarioId,
  normalizarBooleano,
  normalizarStatusCompromisso,
  normalizarTexto,
  normalizarTipoCompromisso,
} from "../utils/http";

export function criarRotasCompromissos(db: KeeperDatabase): Router {
  const router = Router();

  const listar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    try {
      const compromissos = await db.all<CompromissoRow[]>(
        "SELECT * FROM compromissos WHERE usuario_id = ? ORDER BY vencimento ASC, id ASC",
        [usuarioId],
      );
      res.json({ success: true, compromissos });
    } catch (error) {
      next(error);
    }
  };

  const criar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const tipo = normalizarTipoCompromisso(req.body?.tipo);
    const descricao = normalizarTexto(req.body?.descricao);
    const valor = Number(req.body?.valor);
    const vencimento = normalizarTexto(req.body?.vencimento);
    const recorrente = normalizarBooleano(req.body?.recorrente);

    if (!usuarioId || !tipo || !descricao || !Number.isFinite(valor) || valor <= 0 || !vencimento) {
      return next(
        criarErro(400, "Informe usuario_id, tipo, descricao, valor positivo e vencimento.", "DADOS_INVALIDOS"),
      );
    }
    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }
      const result = await db.run(
        `INSERT INTO compromissos (usuario_id, tipo, descricao, valor, vencimento, recorrente)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [usuarioId, tipo, descricao, valor, vencimento, recorrente],
      );
      res.status(201).json({ success: true, compromissoId: result.lastID });
    } catch (error) {
      next(error);
    }
  };

  const atualizar: RequestHandler = async (req, res, next) => {
    const compromissoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const tipo = normalizarTipoCompromisso(req.body?.tipo);
    const descricao = normalizarTexto(req.body?.descricao);
    const valor = Number(req.body?.valor);
    const vencimento = normalizarTexto(req.body?.vencimento);
    const status = normalizarStatusCompromisso(req.body?.status);
    const recorrente = normalizarBooleano(req.body?.recorrente);

    if (!compromissoId || !usuarioId || !tipo || !descricao || !Number.isFinite(valor) || valor <= 0 || !vencimento) {
      return next(criarErro(400, "Dados inválidos para atualizar compromisso.", "DADOS_INVALIDOS"));
    }
    try {
      const result = await db.run(
        `UPDATE compromissos SET tipo = ?, descricao = ?, valor = ?, vencimento = ?, status = ?, recorrente = ?
         WHERE id = ? AND usuario_id = ?`,
        [tipo, descricao, valor, vencimento, status, recorrente, compromissoId, usuarioId],
      );
      if (!result.changes) {
        throw criarErro(404, "Compromisso não encontrado.", "COMPROMISSO_NAO_ENCONTRADO");
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  const remover: RequestHandler = async (req, res, next) => {
    const compromissoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    if (!compromissoId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id do compromisso.", "DADOS_INVALIDOS"));
    }
    try {
      const result = await db.run("DELETE FROM compromissos WHERE id = ? AND usuario_id = ?", [
        compromissoId,
        usuarioId,
      ]);
      if (!result.changes) {
        throw criarErro(404, "Compromisso não encontrado.", "COMPROMISSO_NAO_ENCONTRADO");
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  router.get("/", listar);
  router.post("/", criar);
  router.put("/:id", atualizar);
  router.delete("/:id", remover);
  return router;
}
