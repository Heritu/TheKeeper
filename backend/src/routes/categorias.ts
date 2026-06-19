import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import { obterCategoriaDoUsuario, usuarioExiste } from "../services/financeiro";
import type { CategoriaRow } from "../types";
import {
  criarErro,
  lerInteiro,
  lerUsuarioId,
  normalizarTexto,
  normalizarTipoCategoria,
} from "../utils/http";

export function criarRotasCategorias(db: KeeperDatabase): Router {
  const router = Router();

  const listar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    try {
      const categorias = await db.all<CategoriaRow[]>(
        "SELECT id, usuario_id, nome, tipo FROM categorias WHERE usuario_id = ? ORDER BY nome ASC",
        [usuarioId],
      );
      res.json({ success: true, categorias });
    } catch (error) {
      next(error);
    }
  };

  const criar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const tipo = normalizarTipoCategoria(req.body?.tipo);
    if (!usuarioId || !nome) {
      return next(criarErro(400, "Informe usuario_id e nome da categoria.", "DADOS_INVALIDOS"));
    }
    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }
      const result = await db.run("INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, ?, ?)", [
        usuarioId,
        nome,
        tipo,
      ]);
      res.status(201).json({ success: true, categoriaId: result.lastID });
    } catch (error) {
      next(error);
    }
  };

  const atualizar: RequestHandler = async (req, res, next) => {
    const categoriaId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const tipo = normalizarTipoCategoria(req.body?.tipo);
    if (!categoriaId || !usuarioId || !nome) {
      return next(criarErro(400, "Informe usuario_id, id e nome da categoria.", "DADOS_INVALIDOS"));
    }
    try {
      await obterCategoriaDoUsuario(db, usuarioId, categoriaId);
      await db.run("UPDATE categorias SET nome = ?, tipo = ? WHERE id = ? AND usuario_id = ?", [
        nome,
        tipo,
        categoriaId,
        usuarioId,
      ]);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  const remover: RequestHandler = async (req, res, next) => {
    const categoriaId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    if (!categoriaId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id da categoria.", "DADOS_INVALIDOS"));
    }
    try {
      await obterCategoriaDoUsuario(db, usuarioId, categoriaId);
      const uso = await db.get<{ total: number }>(
        "SELECT COUNT(*) AS total FROM movimentacoes WHERE categoria_id = ? AND usuario_id = ?",
        [categoriaId, usuarioId],
      );
      if ((uso?.total ?? 0) > 0) {
        throw criarErro(
          409,
          "Esta categoria possui movimentações e não pode ser removida.",
          "CATEGORIA_EM_USO",
        );
      }
      await db.run("DELETE FROM categorias WHERE id = ? AND usuario_id = ?", [categoriaId, usuarioId]);
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
