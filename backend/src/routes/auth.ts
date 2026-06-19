import { Router, type RequestHandler } from "express";

import type { KeeperDatabase } from "../database";
import type { ApiError, UsuarioRow } from "../types";
import { criarErro, normalizarEmail, normalizarTexto, normalizarTipoContaUsuario } from "../utils/http";
import { criarToken, hashSenha, precisaAtualizarHash, verificarSenha } from "../utils/security";

export function criarRotasAuth(db: KeeperDatabase): Router {
  const router = Router();

  const registrar: RequestHandler = async (req, res, next) => {
    const nome = normalizarTexto(req.body?.nome);
    const email = normalizarEmail(req.body?.email);
    const senha = normalizarTexto(req.body?.senha);
    const tipoConta = normalizarTipoContaUsuario(req.body?.tipo_conta);

    if (!nome || !email || senha.length < 6) {
      return next(
        criarErro(400, "Informe nome, email e senha com pelo menos 6 caracteres.", "DADOS_INVALIDOS"),
      );
    }

    try {
      await db.exec("BEGIN IMMEDIATE TRANSACTION");
      const result = await db.run(
        "INSERT INTO usuarios (nome, email, senha, tipo_conta) VALUES (?, ?, ?, ?)",
        [nome, email, await hashSenha(senha), tipoConta],
      );

      if (!result.lastID) {
        throw criarErro(500, "Não foi possível criar o usuário.");
      }

      await db.run(
        "INSERT INTO contas (usuario_id, nome_conta, saldo_atual) VALUES (?, 'Principal', 0)",
        [result.lastID],
      );
      await db.run(
        "INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, 'Geral', 'ambos')",
        [result.lastID],
      );
      await db.exec("COMMIT");
      res.status(201).json({ success: true, userId: result.lastID, tipoConta });
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => undefined);
      const apiError = error as ApiError;

      if (apiError.message?.includes("UNIQUE") || apiError.code === "SQLITE_CONSTRAINT") {
        return next(criarErro(409, "Já existe uma conta usando este email.", "EMAIL_EM_USO"));
      }

      return next(error);
    }
  };

  const login: RequestHandler = async (req, res, next) => {
    const email = normalizarEmail(req.body?.email);
    const senha = normalizarTexto(req.body?.senha);

    if (!email || !senha) {
      return next(criarErro(400, "Informe email e senha.", "DADOS_INVALIDOS"));
    }

    try {
      const usuario = await db.get<UsuarioRow>(
        "SELECT id, nome, email, senha, tipo_conta FROM usuarios WHERE email = ?",
        [email],
      );

      if (!usuario || !(await verificarSenha(senha, usuario.senha))) {
        return res.status(401).json({ success: false, error: "Credenciais inválidas." });
      }

      if (precisaAtualizarHash(usuario.senha)) {
        await db.run("UPDATE usuarios SET senha = ? WHERE id = ?", [await hashSenha(senha), usuario.id]);
      }

      await db
        .run(
          `INSERT INTO auditoria (usuario_id, acao, entidade, metodo, rota, ip)
           VALUES (?, 'LOGIN', 'auth', 'POST', '/api/auth/login', ?)`,
          [usuario.id, req.ip],
        )
        .catch(() => undefined);

      return res.json({
        success: true,
        userId: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipoConta: usuario.tipo_conta,
        token: criarToken(usuario),
      });
    } catch (error) {
      return next(error);
    }
  };

  router.post("/register", registrar);
  router.post("/login", login);
  return router;
}
