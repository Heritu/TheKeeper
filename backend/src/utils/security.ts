import crypto from "node:crypto";
import path from "node:path";

import type { TokenPayload, UsuarioRow } from "../types";

const PASSWORD_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;
const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const projectRoot = path.join(__dirname, "..", "..", "..");
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

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scryptAsync(senha, salt);
  return `${PASSWORD_PREFIX}$${salt}$${hash.toString("hex")}`;
}

export async function verificarSenha(senha: string, senhaArmazenada: string): Promise<boolean> {
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

export function precisaAtualizarHash(senhaArmazenada: string): boolean {
  return !senhaArmazenada.startsWith(`${PASSWORD_PREFIX}$`);
}

function criarAssinaturaToken(payloadBase64: string): string {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(payloadBase64).digest("base64url");
}

export function criarToken(usuario: Pick<UsuarioRow, "id" | "nome" | "tipo_conta">): string {
  const payload: TokenPayload = {
    sub: usuario.id,
    nome: usuario.nome,
    tipoConta: usuario.tipo_conta,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadBase64}.${criarAssinaturaToken(payloadBase64)}`;
}

export function verificarToken(token: string): TokenPayload | null {
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
    return payload.sub && payload.exp >= Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
