import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import { usuarioExiste } from "../services/financeiro";
import type { CartaoRow } from "../types";
import {
  criarErro,
  lerDiaCartao,
  lerInteiro,
  lerUsuarioId,
  normalizarBooleano,
  normalizarTexto,
} from "../utils/http";

export function criarRotasCartoes(db: KeeperDatabase): Router {
  const router = Router();

  const listar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));

    try {
      const cartoes = await db.all<CartaoRow[]>(
        `SELECT id, usuario_id, nome, bandeira, limite_total, limite_usado,
                fechamento, vencimento, ativo, criado_em
         FROM cartoes WHERE usuario_id = ?
         ORDER BY ativo DESC, vencimento ASC, nome ASC`,
        [usuarioId],
      );
      const resumo = cartoes.reduce(
        (total, cartao) => ({
          limiteTotal: total.limiteTotal + Number(cartao.limite_total),
          limiteUsado: total.limiteUsado + Number(cartao.limite_usado),
        }),
        { limiteTotal: 0, limiteUsado: 0 },
      );
      res.json({
        success: true,
        cartoes,
        resumo: { ...resumo, limiteDisponivel: resumo.limiteTotal - resumo.limiteUsado },
      });
    } catch (error) {
      next(error);
    }
  };

  const lerDados = (body: Record<string, unknown>) => ({
    nome: normalizarTexto(body.nome),
    bandeira: normalizarTexto(body.bandeira) || "Outro",
    limiteTotal: Number(body.limite_total),
    limiteUsado: Number(body.limite_usado ?? 0),
    fechamento: lerDiaCartao(body.fechamento, 1),
    vencimento: lerDiaCartao(body.vencimento, 10),
    ativo: normalizarBooleano(body.ativo ?? true),
  });

  const criar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const dados = lerDados(req.body ?? {});

    if (
      !usuarioId ||
      !dados.nome ||
      !Number.isFinite(dados.limiteTotal) ||
      dados.limiteTotal < 0 ||
      !Number.isFinite(dados.limiteUsado) ||
      dados.limiteUsado < 0
    ) {
      return next(criarErro(400, "Informe usuario_id, nome e limites válidos.", "DADOS_INVALIDOS"));
    }

    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }
      const result = await db.run(
        `INSERT INTO cartoes
          (usuario_id, nome, bandeira, limite_total, limite_usado, fechamento, vencimento, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuarioId,
          dados.nome,
          dados.bandeira,
          dados.limiteTotal,
          Math.min(dados.limiteUsado, dados.limiteTotal),
          dados.fechamento,
          dados.vencimento,
          dados.ativo,
        ],
      );
      res.status(201).json({ success: true, cartaoId: result.lastID });
    } catch (error) {
      next(error);
    }
  };

  const atualizar: RequestHandler = async (req, res, next) => {
    const cartaoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const dados = lerDados(req.body ?? {});

    if (
      !cartaoId ||
      !usuarioId ||
      !dados.nome ||
      !Number.isFinite(dados.limiteTotal) ||
      dados.limiteTotal < 0 ||
      !Number.isFinite(dados.limiteUsado) ||
      dados.limiteUsado < 0
    ) {
      return next(criarErro(400, "Dados inválidos para atualizar cartão.", "DADOS_INVALIDOS"));
    }

    try {
      const result = await db.run(
        `UPDATE cartoes SET nome = ?, bandeira = ?, limite_total = ?, limite_usado = ?,
          fechamento = ?, vencimento = ?, ativo = ? WHERE id = ? AND usuario_id = ?`,
        [
          dados.nome,
          dados.bandeira,
          dados.limiteTotal,
          Math.min(dados.limiteUsado, dados.limiteTotal),
          dados.fechamento,
          dados.vencimento,
          dados.ativo,
          cartaoId,
          usuarioId,
        ],
      );
      if (!result.changes) throw criarErro(404, "Cartão não encontrado.", "CARTAO_NAO_ENCONTRADO");
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  const remover: RequestHandler = async (req, res, next) => {
    const cartaoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    if (!cartaoId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id do cartão.", "DADOS_INVALIDOS"));
    }
    try {
      const result = await db.run("DELETE FROM cartoes WHERE id = ? AND usuario_id = ?", [cartaoId, usuarioId]);
      if (!result.changes) throw criarErro(404, "Cartão não encontrado.", "CARTAO_NAO_ENCONTRADO");
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
