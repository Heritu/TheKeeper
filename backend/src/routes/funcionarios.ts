import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import { usuarioExiste } from "../services/financeiro";
import type { FuncionarioRow } from "../types";
import { criarErro, lerInteiro, lerUsuarioId, normalizarBooleano, normalizarTexto } from "../utils/http";

export function criarRotasFuncionarios(db: KeeperDatabase): Router {
  const router = Router();

  const listar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    if (!usuarioId) return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    try {
      const funcionarios = await db.all<FuncionarioRow[]>(
        `SELECT id, usuario_id, nome, funcao, salario, beneficios, ativo, criado_em
         FROM funcionarios WHERE usuario_id = ? ORDER BY ativo DESC, nome ASC`,
        [usuarioId],
      );
      const ativos = funcionarios.filter((funcionario) => funcionario.ativo === 1);
      const resumo = ativos.reduce(
        (total, funcionario) => ({
          salario: total.salario + Number(funcionario.salario),
          beneficios: total.beneficios + Number(funcionario.beneficios),
        }),
        { salario: 0, beneficios: 0 },
      );
      res.json({
        success: true,
        funcionarios,
        resumo: { ...resumo, total: resumo.salario + resumo.beneficios, ativos: ativos.length },
      });
    } catch (error) {
      next(error);
    }
  };

  const lerDados = (body: Record<string, unknown>) => ({
    nome: normalizarTexto(body.nome),
    funcao: normalizarTexto(body.funcao),
    salario: Number(body.salario),
    beneficios: Number(body.beneficios ?? 0),
    ativo: normalizarBooleano(body.ativo ?? true),
  });

  const criar: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const dados = lerDados(req.body ?? {});
    if (
      !usuarioId ||
      !dados.nome ||
      !dados.funcao ||
      !Number.isFinite(dados.salario) ||
      dados.salario < 0 ||
      !Number.isFinite(dados.beneficios) ||
      dados.beneficios < 0
    ) {
      return next(criarErro(400, "Informe nome, função, salário e benefícios válidos.", "DADOS_INVALIDOS"));
    }
    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }
      const result = await db.run(
        `INSERT INTO funcionarios (usuario_id, nome, funcao, salario, beneficios, ativo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [usuarioId, dados.nome, dados.funcao, dados.salario, dados.beneficios, dados.ativo],
      );
      res.status(201).json({ success: true, funcionarioId: result.lastID });
    } catch (error) {
      next(error);
    }
  };

  const atualizar: RequestHandler = async (req, res, next) => {
    const funcionarioId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const dados = lerDados(req.body ?? {});
    if (
      !funcionarioId ||
      !usuarioId ||
      !dados.nome ||
      !dados.funcao ||
      !Number.isFinite(dados.salario) ||
      dados.salario < 0 ||
      !Number.isFinite(dados.beneficios) ||
      dados.beneficios < 0
    ) {
      return next(criarErro(400, "Dados inválidos para atualizar funcionário.", "DADOS_INVALIDOS"));
    }
    try {
      const result = await db.run(
        `UPDATE funcionarios SET nome = ?, funcao = ?, salario = ?, beneficios = ?, ativo = ?
         WHERE id = ? AND usuario_id = ?`,
        [dados.nome, dados.funcao, dados.salario, dados.beneficios, dados.ativo, funcionarioId, usuarioId],
      );
      if (!result.changes) {
        throw criarErro(404, "Funcionário não encontrado.", "FUNCIONARIO_NAO_ENCONTRADO");
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  const remover: RequestHandler = async (req, res, next) => {
    const funcionarioId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    if (!funcionarioId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id do funcionário.", "DADOS_INVALIDOS"));
    }
    try {
      const result = await db.run("DELETE FROM funcionarios WHERE id = ? AND usuario_id = ?", [
        funcionarioId,
        usuarioId,
      ]);
      if (!result.changes) {
        throw criarErro(404, "Funcionário não encontrado.", "FUNCIONARIO_NAO_ENCONTRADO");
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
