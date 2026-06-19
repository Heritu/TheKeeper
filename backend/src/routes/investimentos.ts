import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import { usuarioExiste } from "../services/financeiro";
import type { InvestimentoRow } from "../types";
import { criarErro, lerInteiro, lerUsuarioId, normalizarTexto } from "../utils/http";

export function criarRotasInvestimentos(db: KeeperDatabase): Router {
  const router = Router();

  const listar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    try {
      const investimentos = await db.all<InvestimentoRow[]>(
        "SELECT * FROM investimentos WHERE usuario_id = ? ORDER BY nome ASC",
        [usuarioId],
      );
      const resumo = await db.get<{ total: number; custo: number }>(
        `SELECT COALESCE(SUM(valor_atual), 0) AS total,
                COALESCE(SUM(quantidade * preco_medio), 0) AS custo
         FROM investimentos WHERE usuario_id = ?`,
        [usuarioId],
      );
      res.json({
        success: true,
        investimentos,
        resumo: {
          valorAtual: resumo?.total ?? 0,
          custoTotal: resumo?.custo ?? 0,
          resultado: (resumo?.total ?? 0) - (resumo?.custo ?? 0),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  const lerDados = (body: Record<string, unknown>) => {
    const quantidade = Number(body.quantidade ?? 0);
    const precoMedio = Number(body.preco_medio ?? 0);
    return {
      nome: normalizarTexto(body.nome),
      tipo: normalizarTexto(body.tipo),
      instituicao: normalizarTexto(body.instituicao) || null,
      quantidade,
      precoMedio,
      valorAtual: Number(body.valor_atual ?? quantidade * precoMedio),
    };
  };

  const dadosInvalidos = (dados: ReturnType<typeof lerDados>) =>
    !dados.nome ||
    !dados.tipo ||
    !Number.isFinite(dados.quantidade) ||
    !Number.isFinite(dados.precoMedio) ||
    !Number.isFinite(dados.valorAtual);

  const criar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const dados = lerDados(req.body ?? {});
    if (!usuarioId || dadosInvalidos(dados)) {
      return next(criarErro(400, "Dados inválidos para investimento.", "DADOS_INVALIDOS"));
    }
    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }
      const result = await db.run(
        `INSERT INTO investimentos
          (usuario_id, nome, tipo, instituicao, quantidade, preco_medio, valor_atual)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          usuarioId,
          dados.nome,
          dados.tipo,
          dados.instituicao,
          dados.quantidade,
          dados.precoMedio,
          dados.valorAtual,
        ],
      );
      res.status(201).json({ success: true, investimentoId: result.lastID });
    } catch (error) {
      next(error);
    }
  };

  const atualizar: RequestHandler = async (req, res, next) => {
    const investimentoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const dados = lerDados(req.body ?? {});
    if (!investimentoId || !usuarioId || dadosInvalidos(dados)) {
      return next(criarErro(400, "Dados inválidos para atualizar investimento.", "DADOS_INVALIDOS"));
    }
    try {
      const result = await db.run(
        `UPDATE investimentos SET nome = ?, tipo = ?, instituicao = ?, quantidade = ?,
          preco_medio = ?, valor_atual = ?, data_atualizacao = CURRENT_TIMESTAMP
         WHERE id = ? AND usuario_id = ?`,
        [
          dados.nome,
          dados.tipo,
          dados.instituicao,
          dados.quantidade,
          dados.precoMedio,
          dados.valorAtual,
          investimentoId,
          usuarioId,
        ],
      );
      if (!result.changes) {
        throw criarErro(404, "Investimento não encontrado.", "INVESTIMENTO_NAO_ENCONTRADO");
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  const remover: RequestHandler = async (req, res, next) => {
    const investimentoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    if (!investimentoId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id do investimento.", "DADOS_INVALIDOS"));
    }
    try {
      const result = await db.run("DELETE FROM investimentos WHERE id = ? AND usuario_id = ?", [
        investimentoId,
        usuarioId,
      ]);
      if (!result.changes) {
        throw criarErro(404, "Investimento não encontrado.", "INVESTIMENTO_NAO_ENCONTRADO");
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
