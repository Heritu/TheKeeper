import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import { obterContaDoUsuario, usuarioExiste } from "../services/financeiro";
import type { ContaRow } from "../types";
import { criarErro, lerInteiro, lerUsuarioId, normalizarTexto } from "../utils/http";

export function criarRotasContas(db: KeeperDatabase): Router {
  const router = Router();

  const listar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));

    try {
      const contas = await db.all<ContaRow[]>(
        `SELECT id, usuario_id, nome_conta, tipo, instituicao, saldo_atual, criado_em
         FROM contas WHERE usuario_id = ? ORDER BY id ASC`,
        [usuarioId],
      );
      res.json({ success: true, contas });
    } catch (error) {
      next(error);
    }
  };

  const criar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const nomeConta = normalizarTexto(req.body?.nome_conta ?? req.body?.nome);
    const tipo = normalizarTexto(req.body?.tipo) || "corrente";
    const instituicao = normalizarTexto(req.body?.instituicao) || null;
    const saldoInicial = Number(req.body?.saldo_atual ?? req.body?.saldo_inicial ?? 0);

    if (!usuarioId || !nomeConta || !Number.isFinite(saldoInicial)) {
      return next(criarErro(400, "Informe usuario_id, nome_conta e saldo inicial válido.", "DADOS_INVALIDOS"));
    }

    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }
      const result = await db.run(
        `INSERT INTO contas (usuario_id, nome_conta, tipo, instituicao, saldo_atual)
         VALUES (?, ?, ?, ?, ?)`,
        [usuarioId, nomeConta, tipo, instituicao, saldoInicial],
      );
      res.status(201).json({ success: true, contaId: result.lastID });
    } catch (error) {
      next(error);
    }
  };

  const atualizar: RequestHandler = async (req, res, next) => {
    const contaId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const nomeConta = normalizarTexto(req.body?.nome_conta ?? req.body?.nome);
    const tipo = normalizarTexto(req.body?.tipo) || "corrente";
    const instituicao = normalizarTexto(req.body?.instituicao) || null;

    if (!contaId || !usuarioId || !nomeConta) {
      return next(criarErro(400, "Informe usuario_id, id da conta e nome_conta.", "DADOS_INVALIDOS"));
    }

    try {
      await obterContaDoUsuario(db, usuarioId, contaId);
      await db.run(
        "UPDATE contas SET nome_conta = ?, tipo = ?, instituicao = ? WHERE id = ? AND usuario_id = ?",
        [nomeConta, tipo, instituicao, contaId, usuarioId],
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  const remover: RequestHandler = async (req, res, next) => {
    const contaId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    if (!contaId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id da conta.", "DADOS_INVALIDOS"));
    }

    try {
      await obterContaDoUsuario(db, usuarioId, contaId);
      const uso = await db.get<{ total: number }>(
        "SELECT COUNT(*) AS total FROM movimentacoes WHERE conta_id = ? AND usuario_id = ?",
        [contaId, usuarioId],
      );
      if ((uso?.total ?? 0) > 0) {
        throw criarErro(409, "Esta conta possui movimentações e não pode ser removida.", "CONTA_EM_USO");
      }
      await db.run("DELETE FROM contas WHERE id = ? AND usuario_id = ?", [contaId, usuarioId]);
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
