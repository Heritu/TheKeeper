import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import type { CompromissoRow, MovimentacaoRow } from "../types";
import { criarErro, lerUsuarioId } from "../utils/http";

export function criarRotasDashboard(db: KeeperDatabase): Router {
  const router = Router();

  const dashboard: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));

    try {
      const totais = await db.get<{
        saldo: number;
        entradas: number;
        saidas: number;
        patrimonio_investido: number;
      }>(
        `SELECT
          COALESCE((SELECT SUM(saldo_atual) FROM contas WHERE usuario_id = ?), 0) AS saldo,
          COALESCE((SELECT SUM(valor) FROM movimentacoes WHERE usuario_id = ? AND valor > 0), 0) AS entradas,
          COALESCE((SELECT SUM(valor) FROM movimentacoes WHERE usuario_id = ? AND valor < 0), 0) AS saidas,
          COALESCE((SELECT SUM(valor_atual) FROM investimentos WHERE usuario_id = ?), 0) AS patrimonio_investido`,
        [usuarioId, usuarioId, usuarioId, usuarioId],
      );
      const movimentacoes = await db.all<MovimentacaoRow[]>(
        `SELECT id, usuario_id, conta_id, categoria_id, valor, descricao, data_movimentacao
         FROM movimentacoes WHERE usuario_id = ?
         ORDER BY data_movimentacao DESC, id DESC LIMIT 10`,
        [usuarioId],
      );
      const compromissos = await db.all<CompromissoRow[]>(
        `SELECT * FROM compromissos WHERE usuario_id = ? AND status = 'aberto'
         ORDER BY vencimento ASC LIMIT 10`,
        [usuarioId],
      );
      res.json({
        success: true,
        saldo: totais?.saldo ?? 0,
        entradas: totais?.entradas ?? 0,
        saidas: Math.abs(totais?.saidas ?? 0),
        patrimonioInvestido: totais?.patrimonio_investido ?? 0,
        ultimasMovimentacoes: movimentacoes,
        proximosCompromissos: compromissos,
      });
    } catch (error) {
      next(error);
    }
  };

  const fluxoCaixa: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    try {
      const meses = await db.all(
        `SELECT strftime('%Y-%m', data_movimentacao) AS mes,
          COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS entradas,
          COALESCE(SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END), 0) AS saidas,
          COALESCE(SUM(valor), 0) AS resultado
         FROM movimentacoes WHERE usuario_id = ?
         GROUP BY strftime('%Y-%m', data_movimentacao)
         ORDER BY mes DESC LIMIT 12`,
        [usuarioId],
      );
      res.json({ success: true, fluxoCaixa: meses.reverse() });
    } catch (error) {
      next(error);
    }
  };

  router.get("/dashboard", dashboard);
  router.get("/fluxo-caixa", fluxoCaixa);
  return router;
}
