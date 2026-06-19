import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import { obterCategoriaDoUsuario, obterContaDoUsuario } from "../services/financeiro";
import type { MovimentacaoRow } from "../types";
import {
  criarErro,
  lerInteiro,
  lerLimite,
  lerUsuarioId,
  normalizarDataIso,
  normalizarTexto,
} from "../utils/http";

export function criarRotasMovimentacoes(db: KeeperDatabase): Router {
  const router = Router();

  const listar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const limite = lerLimite(req.query.limit);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));

    try {
      const movimentacoes = await db.all(
        `SELECT m.id, m.usuario_id, m.conta_id, c.nome_conta, m.categoria_id,
                cat.nome AS categoria_nome, m.valor, m.descricao, m.data_movimentacao
         FROM movimentacoes m
         JOIN contas c ON c.id = m.conta_id
         JOIN categorias cat ON cat.id = m.categoria_id
         WHERE m.usuario_id = ?
         ORDER BY m.data_movimentacao DESC, m.id DESC LIMIT ?`,
        [usuarioId, limite],
      );
      res.json({ success: true, movimentacoes });
    } catch (error) {
      next(error);
    }
  };

  const criar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const contaId = lerInteiro(req.body?.conta_id);
    const categoriaId = lerInteiro(req.body?.categoria_id);
    const valor = Number(req.body?.valor);
    const descricao = normalizarTexto(req.body?.descricao);
    const dataMovimentacao = normalizarDataIso(req.body?.data_movimentacao ?? req.body?.data);

    if (!usuarioId || !Number.isFinite(valor) || valor === 0) {
      return next(criarErro(400, "Informe usuario_id e valor diferente de zero.", "DADOS_INVALIDOS"));
    }

    try {
      await db.exec("BEGIN IMMEDIATE TRANSACTION");
      const conta = await obterContaDoUsuario(db, usuarioId, contaId);
      const categoria = await obterCategoriaDoUsuario(db, usuarioId, categoriaId);
      const result = dataMovimentacao
        ? await db.run(
            `INSERT INTO movimentacoes
              (usuario_id, conta_id, categoria_id, valor, descricao, data_movimentacao)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [usuarioId, conta.id, categoria.id, valor, descricao || null, dataMovimentacao],
          )
        : await db.run(
            `INSERT INTO movimentacoes (usuario_id, conta_id, categoria_id, valor, descricao)
             VALUES (?, ?, ?, ?, ?)`,
            [usuarioId, conta.id, categoria.id, valor, descricao || null],
          );

      await db.run("UPDATE contas SET saldo_atual = saldo_atual + ? WHERE id = ?", [valor, conta.id]);
      await db.exec("COMMIT");
      res.status(201).json({ success: true, movimentacaoId: result.lastID });
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => undefined);
      next(error);
    }
  };

  const atualizar: RequestHandler = async (req, res, next) => {
    const movimentacaoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const contaId = lerInteiro(req.body?.conta_id);
    const categoriaId = lerInteiro(req.body?.categoria_id);
    const valor = Number(req.body?.valor);
    const descricao = normalizarTexto(req.body?.descricao);
    const dataMovimentacao = normalizarDataIso(req.body?.data_movimentacao ?? req.body?.data);

    if (!movimentacaoId || !usuarioId || !Number.isFinite(valor) || valor === 0) {
      return next(criarErro(400, "Informe usuario_id, id e valor diferente de zero.", "DADOS_INVALIDOS"));
    }

    try {
      await db.exec("BEGIN IMMEDIATE TRANSACTION");
      const atual = await db.get<MovimentacaoRow>(
        "SELECT * FROM movimentacoes WHERE id = ? AND usuario_id = ?",
        [movimentacaoId, usuarioId],
      );
      if (!atual) {
        throw criarErro(404, "Movimentação não encontrada.", "MOVIMENTACAO_NAO_ENCONTRADA");
      }

      const novaConta = await obterContaDoUsuario(db, usuarioId, contaId ?? atual.conta_id);
      const novaCategoria = await obterCategoriaDoUsuario(db, usuarioId, categoriaId ?? atual.categoria_id);

      if (atual.conta_id === novaConta.id) {
        await db.run("UPDATE contas SET saldo_atual = saldo_atual + ? WHERE id = ?", [
          valor - atual.valor,
          atual.conta_id,
        ]);
      } else {
        await db.run("UPDATE contas SET saldo_atual = saldo_atual - ? WHERE id = ?", [atual.valor, atual.conta_id]);
        await db.run("UPDATE contas SET saldo_atual = saldo_atual + ? WHERE id = ?", [valor, novaConta.id]);
      }

      await db.run(
        `UPDATE movimentacoes
         SET conta_id = ?, categoria_id = ?, valor = ?, descricao = ?,
             data_movimentacao = COALESCE(?, data_movimentacao)
         WHERE id = ? AND usuario_id = ?`,
        [novaConta.id, novaCategoria.id, valor, descricao || null, dataMovimentacao, movimentacaoId, usuarioId],
      );
      await db.exec("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => undefined);
      next(error);
    }
  };

  const remover: RequestHandler = async (req, res, next) => {
    const movimentacaoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    if (!movimentacaoId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id da movimentação.", "DADOS_INVALIDOS"));
    }

    try {
      await db.exec("BEGIN IMMEDIATE TRANSACTION");
      const atual = await db.get<MovimentacaoRow>(
        "SELECT * FROM movimentacoes WHERE id = ? AND usuario_id = ?",
        [movimentacaoId, usuarioId],
      );
      if (!atual) {
        throw criarErro(404, "Movimentação não encontrada.", "MOVIMENTACAO_NAO_ENCONTRADA");
      }
      await db.run("DELETE FROM movimentacoes WHERE id = ? AND usuario_id = ?", [movimentacaoId, usuarioId]);
      await db.run("UPDATE contas SET saldo_atual = saldo_atual - ? WHERE id = ?", [atual.valor, atual.conta_id]);
      await db.exec("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => undefined);
      next(error);
    }
  };

  router.get("/", listar);
  router.post("/", criar);
  router.put("/:id", atualizar);
  router.delete("/:id", remover);
  return router;
}
