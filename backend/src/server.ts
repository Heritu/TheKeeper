import crypto from "node:crypto";
import path from "node:path";

import express, { type ErrorRequestHandler, type Request, type RequestHandler } from "express";

import { setupDatabase, type KeeperDatabase } from "./database";

type TipoContaUsuario = "pessoal" | "empresarial";
type TipoCategoria = "receita" | "despesa" | "ambos";
type TipoCompromisso = "pagar" | "receber";
type StatusCompromisso = "aberto" | "pago" | "cancelado";

interface UsuarioRow {
  id: number;
  nome: string;
  email: string;
  senha: string;
  tipo_conta: TipoContaUsuario | "admin";
}

interface ContaRow {
  id: number;
  usuario_id: number;
  nome_conta: string;
  tipo: string;
  instituicao: string | null;
  saldo_atual: number;
  criado_em?: string;
}

interface CartaoRow {
  id: number;
  usuario_id: number;
  nome: string;
  bandeira: string;
  limite_total: number;
  limite_usado: number;
  fechamento: number;
  vencimento: number;
  ativo: number;
  criado_em?: string;
}

interface FuncionarioRow {
  id: number;
  usuario_id: number;
  nome: string;
  funcao: string;
  salario: number;
  beneficios: number;
  ativo: number;
  criado_em?: string;
}

interface CategoriaRow {
  id: number;
  usuario_id: number;
  nome: string;
  tipo: TipoCategoria;
}

interface MovimentacaoRow {
  id: number;
  usuario_id: number;
  conta_id: number;
  categoria_id: number;
  valor: number;
  descricao: string | null;
  data_movimentacao: string;
}

interface CompromissoRow {
  id: number;
  usuario_id: number;
  tipo: TipoCompromisso;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusCompromisso;
  recorrente: number;
  criado_em: string;
}

interface InvestimentoRow {
  id: number;
  usuario_id: number;
  nome: string;
  tipo: string;
  instituicao: string | null;
  quantidade: number;
  preco_medio: number;
  valor_atual: number;
  data_atualizacao: string;
  criado_em: string;
}

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

interface AuthenticatedRequest extends Request {
  usuarioAutenticadoId?: number;
}

interface TokenPayload {
  sub: number;
  nome: string;
  tipoConta: TipoContaUsuario | "admin";
  exp: number;
}

const PORT = Number(process.env.PORT) || 3000;
const backendRoot = path.join(__dirname, "..");
const projectRoot = path.join(backendRoot, "..");
const reactFrontendPath = path.join(projectRoot, "frontend-novo", "dist");
const PASSWORD_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;
const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const TOKEN_SECRET =
  process.env.KEEPER_TOKEN_SECRET ??
  crypto.createHash("sha256").update(`${projectRoot}:the-keeper-token`).digest("hex");

function hashSenhaLegada(senha: string): string {
  return crypto.createHash("sha256").update(senha).digest("hex");
}

function scryptAsync(senha: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(senha, salt, PASSWORD_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scryptAsync(senha, salt);
  return `${PASSWORD_PREFIX}$${salt}$${hash.toString("hex")}`;
}

async function verificarSenha(senha: string, senhaArmazenada: string): Promise<boolean> {
  const [prefix, salt, hashHex] = senhaArmazenada.split("$");

  if (prefix === PASSWORD_PREFIX && salt && hashHex) {
    const hashCalculado = await scryptAsync(senha, salt);
    const hashArmazenado = Buffer.from(hashHex, "hex");

    return (
      hashArmazenado.length === hashCalculado.length &&
      crypto.timingSafeEqual(hashCalculado, hashArmazenado)
    );
  }

  return senhaArmazenada === hashSenhaLegada(senha);
}

function precisaAtualizarHash(senhaArmazenada: string): boolean {
  return !senhaArmazenada.startsWith(`${PASSWORD_PREFIX}$`);
}

function criarAssinaturaToken(payloadBase64: string): string {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(payloadBase64).digest("base64url");
}

function criarToken(usuario: Pick<UsuarioRow, "id" | "nome" | "tipo_conta">): string {
  const payload: TokenPayload = {
    sub: usuario.id,
    nome: usuario.nome,
    tipoConta: usuario.tipo_conta,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return `${payloadBase64}.${criarAssinaturaToken(payloadBase64)}`;
}

function verificarToken(token: string): TokenPayload | null {
  const [payloadBase64, assinatura] = token.split(".");

  if (!payloadBase64 || !assinatura) {
    return null;
  }

  const assinaturaEsperada = criarAssinaturaToken(payloadBase64);
  const assinaturaRecebida = Buffer.from(assinatura);
  const assinaturaCalculada = Buffer.from(assinaturaEsperada);

  if (
    assinaturaRecebida.length !== assinaturaCalculada.length ||
    !crypto.timingSafeEqual(assinaturaRecebida, assinaturaCalculada)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as TokenPayload;

    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function normalizarTexto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizarEmail(valor: unknown): string {
  return normalizarTexto(valor).toLowerCase();
}

function normalizarTipoContaUsuario(valor: unknown): TipoContaUsuario {
  return valor === "empresarial" ? "empresarial" : "pessoal";
}

function normalizarTipoCategoria(valor: unknown): TipoCategoria {
  return valor === "receita" || valor === "despesa" ? valor : "ambos";
}

function normalizarTipoCompromisso(valor: unknown): TipoCompromisso | null {
  return valor === "pagar" || valor === "receber" ? valor : null;
}

function normalizarStatusCompromisso(valor: unknown): StatusCompromisso {
  return valor === "pago" || valor === "cancelado" ? valor : "aberto";
}

function normalizarBooleano(valor: unknown): 0 | 1 {
  return valor === true || valor === "true" || valor === 1 || valor === "1" ? 1 : 0;
}

function lerInteiro(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function lerUsuarioId(req: Request): number | null {
  const usuarioAutenticadoId = (req as AuthenticatedRequest).usuarioAutenticadoId;

  if (usuarioAutenticadoId) {
    return usuarioAutenticadoId;
  }

  return lerInteiro(req.method === "GET" ? req.query.usuario_id : req.body?.usuario_id);
}

function lerLimite(valor: unknown, padrao = 50, maximo = 200): number {
  const limite = Number(valor);

  if (!Number.isInteger(limite) || limite <= 0) {
    return padrao;
  }

  return Math.min(limite, maximo);
}

function lerDiaCartao(valor: unknown, padrao: number): number {
  const dia = Number(valor);

  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    return padrao;
  }

  return dia;
}

function normalizarDataIso(valor: unknown): string | null {
  const texto = normalizarTexto(valor);

  if (!texto) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw criarErro(400, "Informe a data no formato YYYY-MM-DD.", "DATA_INVALIDA");
  }

  return texto;
}

function criarErro(statusCode: number, message: string, code?: string): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function usuarioExiste(db: KeeperDatabase, usuarioId: number): Promise<boolean> {
  const usuario = await db.get<{ id: number }>("SELECT id FROM usuarios WHERE id = ?", [usuarioId]);
  return Boolean(usuario);
}

async function obterContaDoUsuario(
  db: KeeperDatabase,
  usuarioId: number,
  contaId?: number | null,
): Promise<ContaRow> {
  const params = contaId ? [contaId, usuarioId] : [usuarioId];
  const sql = contaId
    ? "SELECT * FROM contas WHERE id = ? AND usuario_id = ?"
    : "SELECT * FROM contas WHERE usuario_id = ? ORDER BY id ASC LIMIT 1";

  const conta = await db.get<ContaRow>(sql, params);

  if (conta) {
    return conta;
  }

  if (contaId) {
    throw criarErro(404, "Conta não encontrada.", "CONTA_NAO_ENCONTRADA");
  }

  if (!(await usuarioExiste(db, usuarioId))) {
    throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
  }

  const result = await db.run(
    "INSERT INTO contas (usuario_id, nome_conta, saldo_atual) VALUES (?, 'Principal', 0)",
    [usuarioId],
  );

  if (!result.lastID) {
    throw criarErro(500, "Não foi possível criar a conta principal.");
  }

  return {
    id: result.lastID,
    usuario_id: usuarioId,
    nome_conta: "Principal",
    tipo: "corrente",
    instituicao: null,
    saldo_atual: 0,
  };
}

async function obterCategoriaDoUsuario(
  db: KeeperDatabase,
  usuarioId: number,
  categoriaId?: number | null,
): Promise<CategoriaRow> {
  const params = categoriaId ? [categoriaId, usuarioId] : [usuarioId];
  const sql = categoriaId
    ? "SELECT * FROM categorias WHERE id = ? AND usuario_id = ?"
    : "SELECT * FROM categorias WHERE usuario_id = ? AND nome = 'Geral' ORDER BY id ASC LIMIT 1";

  const categoria = await db.get<CategoriaRow>(sql, params);

  if (categoria) {
    return categoria;
  }

  if (categoriaId) {
    throw criarErro(404, "Categoria não encontrada.", "CATEGORIA_NAO_ENCONTRADA");
  }

  if (!(await usuarioExiste(db, usuarioId))) {
    throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
  }

  const result = await db.run("INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, 'Geral', 'ambos')", [
    usuarioId,
  ]);

  if (!result.lastID) {
    throw criarErro(500, "Não foi possível criar a categoria padrão.");
  }

  return { id: result.lastID, usuario_id: usuarioId, nome: "Geral", tipo: "ambos" };
}

function criarApp(db: KeeperDatabase): express.Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(reactFrontendPath));

  const indexHtml = path.join(reactFrontendPath, "index.html");
  app.get(
    ["/", "/auth", "/dashboard", "/lancamentos", "/cartoes", "/compromissos", "/investimentos", "/simulador"],
    (_req, res) => {
      res.sendFile(indexHtml);
    },
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "the-keeper-backend" });
  });

  // Protege as rotas da API usando o token gerado no login.
  const autenticar: RequestHandler = (req, _res, next) => {
    const [tipo, token] = String(req.headers.authorization ?? "").split(" ");

    if (tipo !== "Bearer" || !token) {
      return next(criarErro(401, "Sessão inválida ou expirada.", "NAO_AUTENTICADO"));
    }

    const payload = verificarToken(token);

    if (!payload) {
      return next(criarErro(401, "Sessão inválida ou expirada.", "NAO_AUTENTICADO"));
    }

    (req as AuthenticatedRequest).usuarioAutenticadoId = payload.sub;
    return next();
  };

  // Registra ações de escrita para demonstrar rastreabilidade e segurança.
  const auditarAlteracao: RequestHandler = (req, res, next) => {
    res.on("finish", () => {
      if (res.statusCode >= 400 || !["POST", "PUT", "DELETE"].includes(req.method)) {
        return;
      }

      const usuarioId = (req as AuthenticatedRequest).usuarioAutenticadoId ?? null;
      const entidade = req.path.split("/").filter(Boolean)[0] ?? "api";
      const detalhes = JSON.stringify({
        params: req.params,
        query: req.query,
      });

      db.run(
        `
          INSERT INTO auditoria (usuario_id, acao, entidade, metodo, rota, ip, detalhes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [usuarioId, `${req.method} ${req.path}`, entidade, req.method, req.originalUrl, req.ip, detalhes],
      ).catch((error) => {
        console.error("Falha ao registrar auditoria:", error);
      });
    });

    next();
  };

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
      const senhaHash = await hashSenha(senha);
      const result = await db.run(
        "INSERT INTO usuarios (nome, email, senha, tipo_conta) VALUES (?, ?, ?, ?)",
        [nome, email, senhaHash, tipoConta],
      );

      if (!result.lastID) {
        throw criarErro(500, "Não foi possível criar o usuário.");
      }

      await db.run(
        "INSERT INTO contas (usuario_id, nome_conta, saldo_atual) VALUES (?, 'Principal', 0)",
        [result.lastID],
      );
      await db.run("INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, 'Geral', 'ambos')", [
        result.lastID,
      ]);
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
        `
          SELECT id, nome, email, senha, tipo_conta
          FROM usuarios
          WHERE email = ?
        `,
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
          `
            INSERT INTO auditoria (usuario_id, acao, entidade, metodo, rota, ip)
            VALUES (?, 'LOGIN', 'auth', 'POST', '/api/auth/login', ?)
          `,
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

  const listarContas: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const contas = await db.all<ContaRow[]>(
        `
          SELECT id, usuario_id, nome_conta, tipo, instituicao, saldo_atual, criado_em
          FROM contas
          WHERE usuario_id = ?
          ORDER BY id ASC
        `,
        [usuarioId],
      );

      res.json({ success: true, contas });
    } catch (error) {
      return next(error);
    }
  };

  const criarConta: RequestHandler = async (req, res, next) => {
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
        `
          INSERT INTO contas (usuario_id, nome_conta, tipo, instituicao, saldo_atual)
          VALUES (?, ?, ?, ?, ?)
        `,
        [usuarioId, nomeConta, tipo, instituicao, saldoInicial],
      );

      res.status(201).json({ success: true, contaId: result.lastID });
    } catch (error) {
      return next(error);
    }
  };

  const atualizarConta: RequestHandler = async (req, res, next) => {
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
        `
          UPDATE contas
          SET nome_conta = ?, tipo = ?, instituicao = ?
          WHERE id = ? AND usuario_id = ?
        `,
        [nomeConta, tipo, instituicao, contaId, usuarioId],
      );

      res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  };

  const removerConta: RequestHandler = async (req, res, next) => {
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
      return next(error);
    }
  };

  const listarCartoes: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const cartoes = await db.all<CartaoRow[]>(
        `
          SELECT id, usuario_id, nome, bandeira, limite_total, limite_usado,
                 fechamento, vencimento, ativo, criado_em
          FROM cartoes
          WHERE usuario_id = ?
          ORDER BY ativo DESC, vencimento ASC, nome ASC
        `,
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
        resumo: {
          ...resumo,
          limiteDisponivel: resumo.limiteTotal - resumo.limiteUsado,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  const criarCartao: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const bandeira = normalizarTexto(req.body?.bandeira) || "Outro";
    const limiteTotal = Number(req.body?.limite_total);
    const limiteUsado = Number(req.body?.limite_usado ?? 0);
    const fechamento = lerDiaCartao(req.body?.fechamento, 1);
    const vencimento = lerDiaCartao(req.body?.vencimento, 10);
    const ativo = normalizarBooleano(req.body?.ativo ?? true);

    if (
      !usuarioId ||
      !nome ||
      !Number.isFinite(limiteTotal) ||
      limiteTotal < 0 ||
      !Number.isFinite(limiteUsado) ||
      limiteUsado < 0
    ) {
      return next(criarErro(400, "Informe usuario_id, nome e limites válidos.", "DADOS_INVALIDOS"));
    }

    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }

      const result = await db.run(
        `
          INSERT INTO cartoes
            (usuario_id, nome, bandeira, limite_total, limite_usado, fechamento, vencimento, ativo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [usuarioId, nome, bandeira, limiteTotal, Math.min(limiteUsado, limiteTotal), fechamento, vencimento, ativo],
      );

      res.status(201).json({ success: true, cartaoId: result.lastID });
    } catch (error) {
      return next(error);
    }
  };

  const atualizarCartao: RequestHandler = async (req, res, next) => {
    const cartaoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const bandeira = normalizarTexto(req.body?.bandeira) || "Outro";
    const limiteTotal = Number(req.body?.limite_total);
    const limiteUsado = Number(req.body?.limite_usado ?? 0);
    const fechamento = lerDiaCartao(req.body?.fechamento, 1);
    const vencimento = lerDiaCartao(req.body?.vencimento, 10);
    const ativo = normalizarBooleano(req.body?.ativo ?? true);

    if (
      !cartaoId ||
      !usuarioId ||
      !nome ||
      !Number.isFinite(limiteTotal) ||
      limiteTotal < 0 ||
      !Number.isFinite(limiteUsado) ||
      limiteUsado < 0
    ) {
      return next(criarErro(400, "Dados inválidos para atualizar cartão.", "DADOS_INVALIDOS"));
    }

    try {
      const result = await db.run(
        `
          UPDATE cartoes
          SET nome = ?,
              bandeira = ?,
              limite_total = ?,
              limite_usado = ?,
              fechamento = ?,
              vencimento = ?,
              ativo = ?
          WHERE id = ? AND usuario_id = ?
        `,
        [
          nome,
          bandeira,
          limiteTotal,
          Math.min(limiteUsado, limiteTotal),
          fechamento,
          vencimento,
          ativo,
          cartaoId,
          usuarioId,
        ],
      );

      if (!result.changes) {
        throw criarErro(404, "Cartão não encontrado.", "CARTAO_NAO_ENCONTRADO");
      }

      res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  };

  const removerCartao: RequestHandler = async (req, res, next) => {
    const cartaoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);

    if (!cartaoId || !usuarioId) {
      return next(criarErro(400, "Informe usuario_id e id do cartão.", "DADOS_INVALIDOS"));
    }

    try {
      const result = await db.run("DELETE FROM cartoes WHERE id = ? AND usuario_id = ?", [cartaoId, usuarioId]);

      if (!result.changes) {
        throw criarErro(404, "Cartão não encontrado.", "CARTAO_NAO_ENCONTRADO");
      }

      res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  };

  // CRUD de funcionários usado apenas pela experiência empresarial.
  const listarFuncionarios: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const funcionarios = await db.all<FuncionarioRow[]>(
        `
          SELECT id, usuario_id, nome, funcao, salario, beneficios, ativo, criado_em
          FROM funcionarios
          WHERE usuario_id = ?
          ORDER BY ativo DESC, nome ASC
        `,
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
        resumo: {
          ...resumo,
          total: resumo.salario + resumo.beneficios,
          ativos: ativos.length,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  const criarFuncionario: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const funcao = normalizarTexto(req.body?.funcao);
    const salario = Number(req.body?.salario);
    const beneficios = Number(req.body?.beneficios ?? 0);
    const ativo = normalizarBooleano(req.body?.ativo ?? true);

    if (
      !usuarioId ||
      !nome ||
      !funcao ||
      !Number.isFinite(salario) ||
      salario < 0 ||
      !Number.isFinite(beneficios) ||
      beneficios < 0
    ) {
      return next(criarErro(400, "Informe nome, função, salário e benefícios válidos.", "DADOS_INVALIDOS"));
    }

    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }

      const result = await db.run(
        `
          INSERT INTO funcionarios (usuario_id, nome, funcao, salario, beneficios, ativo)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [usuarioId, nome, funcao, salario, beneficios, ativo],
      );

      res.status(201).json({ success: true, funcionarioId: result.lastID });
    } catch (error) {
      return next(error);
    }
  };

  const atualizarFuncionario: RequestHandler = async (req, res, next) => {
    const funcionarioId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const funcao = normalizarTexto(req.body?.funcao);
    const salario = Number(req.body?.salario);
    const beneficios = Number(req.body?.beneficios ?? 0);
    const ativo = normalizarBooleano(req.body?.ativo ?? true);

    if (
      !funcionarioId ||
      !usuarioId ||
      !nome ||
      !funcao ||
      !Number.isFinite(salario) ||
      salario < 0 ||
      !Number.isFinite(beneficios) ||
      beneficios < 0
    ) {
      return next(criarErro(400, "Dados inválidos para atualizar funcionário.", "DADOS_INVALIDOS"));
    }

    try {
      const result = await db.run(
        `
          UPDATE funcionarios
          SET nome = ?,
              funcao = ?,
              salario = ?,
              beneficios = ?,
              ativo = ?
          WHERE id = ? AND usuario_id = ?
        `,
        [nome, funcao, salario, beneficios, ativo, funcionarioId, usuarioId],
      );

      if (!result.changes) {
        throw criarErro(404, "Funcionário não encontrado.", "FUNCIONARIO_NAO_ENCONTRADO");
      }

      res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  };

  const removerFuncionario: RequestHandler = async (req, res, next) => {
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
      return next(error);
    }
  };

  const listarCategorias: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const categorias = await db.all<CategoriaRow[]>(
        "SELECT id, usuario_id, nome, tipo FROM categorias WHERE usuario_id = ? ORDER BY nome ASC",
        [usuarioId],
      );

      res.json({ success: true, categorias });
    } catch (error) {
      return next(error);
    }
  };

  const criarCategoria: RequestHandler = async (req, res, next) => {
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
      return next(error);
    }
  };

  const atualizarCategoria: RequestHandler = async (req, res, next) => {
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
      return next(error);
    }
  };

  const removerCategoria: RequestHandler = async (req, res, next) => {
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
        throw criarErro(409, "Esta categoria possui movimentações e não pode ser removida.", "CATEGORIA_EM_USO");
      }

      await db.run("DELETE FROM categorias WHERE id = ? AND usuario_id = ?", [categoriaId, usuarioId]);
      res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  };

  const listarMovimentacoes: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const limite = lerLimite(req.query.limit);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const movimentacoes = await db.all(
        `
          SELECT
            m.id,
            m.usuario_id,
            m.conta_id,
            c.nome_conta,
            m.categoria_id,
            cat.nome AS categoria_nome,
            m.valor,
            m.descricao,
            m.data_movimentacao
          FROM movimentacoes m
          JOIN contas c ON c.id = m.conta_id
          JOIN categorias cat ON cat.id = m.categoria_id
          WHERE m.usuario_id = ?
          ORDER BY m.data_movimentacao DESC, m.id DESC
          LIMIT ?
        `,
        [usuarioId, limite],
      );

      res.json({ success: true, movimentacoes });
    } catch (error) {
      return next(error);
    }
  };

  const criarMovimentacao: RequestHandler = async (req, res, next) => {
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
            `
              INSERT INTO movimentacoes
                (usuario_id, conta_id, categoria_id, valor, descricao, data_movimentacao)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [usuarioId, conta.id, categoria.id, valor, descricao || null, dataMovimentacao],
          )
        : await db.run(
            `
              INSERT INTO movimentacoes (usuario_id, conta_id, categoria_id, valor, descricao)
              VALUES (?, ?, ?, ?, ?)
            `,
            [usuarioId, conta.id, categoria.id, valor, descricao || null],
          );

      await db.run("UPDATE contas SET saldo_atual = saldo_atual + ? WHERE id = ?", [valor, conta.id]);
      await db.exec("COMMIT");

      res.status(201).json({ success: true, movimentacaoId: result.lastID });
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => undefined);
      return next(error);
    }
  };

  const atualizarMovimentacao: RequestHandler = async (req, res, next) => {
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
        `
          UPDATE movimentacoes
          SET conta_id = ?,
              categoria_id = ?,
              valor = ?,
              descricao = ?,
              data_movimentacao = COALESCE(?, data_movimentacao)
          WHERE id = ? AND usuario_id = ?
        `,
        [novaConta.id, novaCategoria.id, valor, descricao || null, dataMovimentacao, movimentacaoId, usuarioId],
      );
      await db.exec("COMMIT");

      res.json({ success: true });
    } catch (error) {
      await db.exec("ROLLBACK").catch(() => undefined);
      return next(error);
    }
  };

  const removerMovimentacao: RequestHandler = async (req, res, next) => {
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
      return next(error);
    }
  };

  const dashboard: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const totais = await db.get<{
        saldo: number;
        entradas: number;
        saidas: number;
        patrimonio_investido: number;
      }>(
        `
          SELECT
            COALESCE((SELECT SUM(saldo_atual) FROM contas WHERE usuario_id = ?), 0) AS saldo,
            COALESCE((SELECT SUM(valor) FROM movimentacoes WHERE usuario_id = ? AND valor > 0), 0) AS entradas,
            COALESCE((SELECT SUM(valor) FROM movimentacoes WHERE usuario_id = ? AND valor < 0), 0) AS saidas,
            COALESCE((SELECT SUM(valor_atual) FROM investimentos WHERE usuario_id = ?), 0) AS patrimonio_investido
        `,
        [usuarioId, usuarioId, usuarioId, usuarioId],
      );
      const movimentacoes = await db.all<MovimentacaoRow[]>(
        `
          SELECT id, usuario_id, conta_id, categoria_id, valor, descricao, data_movimentacao
          FROM movimentacoes
          WHERE usuario_id = ?
          ORDER BY data_movimentacao DESC, id DESC
          LIMIT 10
        `,
        [usuarioId],
      );
      const compromissos = await db.all<CompromissoRow[]>(
        `
          SELECT *
          FROM compromissos
          WHERE usuario_id = ? AND status = 'aberto'
          ORDER BY vencimento ASC
          LIMIT 10
        `,
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
      return next(error);
    }
  };

  const fluxoCaixa: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const meses = await db.all(
        `
          SELECT
            strftime('%Y-%m', data_movimentacao) AS mes,
            COALESCE(SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END), 0) AS saidas,
            COALESCE(SUM(valor), 0) AS resultado
          FROM movimentacoes
          WHERE usuario_id = ?
          GROUP BY strftime('%Y-%m', data_movimentacao)
          ORDER BY mes DESC
          LIMIT 12
        `,
        [usuarioId],
      );

      res.json({ success: true, fluxoCaixa: meses.reverse() });
    } catch (error) {
      return next(error);
    }
  };

  const listarCompromissos: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const compromissos = await db.all<CompromissoRow[]>(
        "SELECT * FROM compromissos WHERE usuario_id = ? ORDER BY vencimento ASC, id ASC",
        [usuarioId],
      );

      res.json({ success: true, compromissos });
    } catch (error) {
      return next(error);
    }
  };

  const criarCompromisso: RequestHandler = async (req, res, next) => {
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
        `
          INSERT INTO compromissos (usuario_id, tipo, descricao, valor, vencimento, recorrente)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [usuarioId, tipo, descricao, valor, vencimento, recorrente],
      );

      res.status(201).json({ success: true, compromissoId: result.lastID });
    } catch (error) {
      return next(error);
    }
  };

  const atualizarCompromisso: RequestHandler = async (req, res, next) => {
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
        `
          UPDATE compromissos
          SET tipo = ?, descricao = ?, valor = ?, vencimento = ?, status = ?, recorrente = ?
          WHERE id = ? AND usuario_id = ?
        `,
        [tipo, descricao, valor, vencimento, status, recorrente, compromissoId, usuarioId],
      );

      if (!result.changes) {
        throw criarErro(404, "Compromisso não encontrado.", "COMPROMISSO_NAO_ENCONTRADO");
      }

      res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  };

  const removerCompromisso: RequestHandler = async (req, res, next) => {
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
      return next(error);
    }
  };

  const listarInvestimentos: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);

    if (!usuarioId) {
      return next(criarErro(400, "Informe usuario_id.", "DADOS_INVALIDOS"));
    }

    try {
      const investimentos = await db.all<InvestimentoRow[]>(
        "SELECT * FROM investimentos WHERE usuario_id = ? ORDER BY nome ASC",
        [usuarioId],
      );
      const resumo = await db.get<{ total: number; custo: number }>(
        `
          SELECT
            COALESCE(SUM(valor_atual), 0) AS total,
            COALESCE(SUM(quantidade * preco_medio), 0) AS custo
          FROM investimentos
          WHERE usuario_id = ?
        `,
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
      return next(error);
    }
  };

  const criarInvestimento: RequestHandler = async (req, res, next) => {
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const tipo = normalizarTexto(req.body?.tipo);
    const instituicao = normalizarTexto(req.body?.instituicao) || null;
    const quantidade = Number(req.body?.quantidade ?? 0);
    const precoMedio = Number(req.body?.preco_medio ?? 0);
    const valorAtual = Number(req.body?.valor_atual ?? quantidade * precoMedio);

    if (
      !usuarioId ||
      !nome ||
      !tipo ||
      !Number.isFinite(quantidade) ||
      !Number.isFinite(precoMedio) ||
      !Number.isFinite(valorAtual)
    ) {
      return next(criarErro(400, "Dados inválidos para investimento.", "DADOS_INVALIDOS"));
    }

    try {
      if (!(await usuarioExiste(db, usuarioId))) {
        throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
      }

      const result = await db.run(
        `
          INSERT INTO investimentos (usuario_id, nome, tipo, instituicao, quantidade, preco_medio, valor_atual)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [usuarioId, nome, tipo, instituicao, quantidade, precoMedio, valorAtual],
      );

      res.status(201).json({ success: true, investimentoId: result.lastID });
    } catch (error) {
      return next(error);
    }
  };

  const atualizarInvestimento: RequestHandler = async (req, res, next) => {
    const investimentoId = lerInteiro(req.params.id);
    const usuarioId = lerUsuarioId(req);
    const nome = normalizarTexto(req.body?.nome);
    const tipo = normalizarTexto(req.body?.tipo);
    const instituicao = normalizarTexto(req.body?.instituicao) || null;
    const quantidade = Number(req.body?.quantidade ?? 0);
    const precoMedio = Number(req.body?.preco_medio ?? 0);
    const valorAtual = Number(req.body?.valor_atual ?? quantidade * precoMedio);

    if (
      !investimentoId ||
      !usuarioId ||
      !nome ||
      !tipo ||
      !Number.isFinite(quantidade) ||
      !Number.isFinite(precoMedio) ||
      !Number.isFinite(valorAtual)
    ) {
      return next(criarErro(400, "Dados inválidos para atualizar investimento.", "DADOS_INVALIDOS"));
    }

    try {
      const result = await db.run(
        `
          UPDATE investimentos
          SET nome = ?,
              tipo = ?,
              instituicao = ?,
              quantidade = ?,
              preco_medio = ?,
              valor_atual = ?,
              data_atualizacao = CURRENT_TIMESTAMP
          WHERE id = ? AND usuario_id = ?
        `,
        [nome, tipo, instituicao, quantidade, precoMedio, valorAtual, investimentoId, usuarioId],
      );

      if (!result.changes) {
        throw criarErro(404, "Investimento não encontrado.", "INVESTIMENTO_NAO_ENCONTRADO");
      }

      res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  };

  const removerInvestimento: RequestHandler = async (req, res, next) => {
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
      return next(error);
    }
  };

  app.post("/api/auth/register", registrar);
  app.post("/api/auth/login", login);

  app.use("/api", autenticar, auditarAlteracao);

  // Rotas agrupadas por recurso para manter o backend monolítico legível.
  app.get("/api/contas", listarContas);
  app.post("/api/contas", criarConta);
  app.put("/api/contas/:id", atualizarConta);
  app.delete("/api/contas/:id", removerConta);

  app.get("/api/cartoes", listarCartoes);
  app.post("/api/cartoes", criarCartao);
  app.put("/api/cartoes/:id", atualizarCartao);
  app.delete("/api/cartoes/:id", removerCartao);

  app.get("/api/funcionarios", listarFuncionarios);
  app.post("/api/funcionarios", criarFuncionario);
  app.put("/api/funcionarios/:id", atualizarFuncionario);
  app.delete("/api/funcionarios/:id", removerFuncionario);

  app.get("/api/categorias", listarCategorias);
  app.post("/api/categorias", criarCategoria);
  app.put("/api/categorias/:id", atualizarCategoria);
  app.delete("/api/categorias/:id", removerCategoria);

  app.get("/api/movimentacoes", listarMovimentacoes);
  app.post("/api/movimentacoes", criarMovimentacao);
  app.put("/api/movimentacoes/:id", atualizarMovimentacao);
  app.delete("/api/movimentacoes/:id", removerMovimentacao);

  app.get("/api/dashboard", dashboard);
  app.get("/api/fluxo-caixa", fluxoCaixa);

  app.get("/api/compromissos", listarCompromissos);
  app.post("/api/compromissos", criarCompromisso);
  app.put("/api/compromissos/:id", atualizarCompromisso);
  app.delete("/api/compromissos/:id", removerCompromisso);

  app.get("/api/investimentos", listarInvestimentos);
  app.post("/api/investimentos", criarInvestimento);
  app.put("/api/investimentos/:id", atualizarInvestimento);
  app.delete("/api/investimentos/:id", removerInvestimento);

  const errorHandler: ErrorRequestHandler = (error: ApiError, _req, res, _next) => {
    const statusCode = error.statusCode ?? 500;

    res.status(statusCode).json({
      success: false,
      error: statusCode === 500 ? "Erro interno do servidor." : error.message,
      code: error.code,
    });
  };

  app.use(errorHandler);
  return app;
}

async function iniciarServidor(): Promise<void> {
  const db = await setupDatabase();
  const app = criarApp(db);

  const server = app.listen(PORT, () => {
    console.log(`THE KEEPER operacional: http://localhost:${PORT}`);
  });

  const encerrar = async () => {
    console.log("\nEncerrando o The Keeper...");
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

iniciarServidor().catch((error) => {
  console.error("Falha ao iniciar o backend The Keeper:", error);
  process.exit(1);
});
