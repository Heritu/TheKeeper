import type { KeeperDatabase } from "../database";
import type { CategoriaRow, ContaRow } from "../types";
import { criarErro } from "../utils/http";

export async function usuarioExiste(db: KeeperDatabase, usuarioId: number): Promise<boolean> {
  const usuario = await db.get<{ id: number }>("SELECT id FROM usuarios WHERE id = ?", [usuarioId]);
  return Boolean(usuario);
}

export async function obterContaDoUsuario(
  db: KeeperDatabase,
  usuarioId: number,
  contaId?: number | null,
): Promise<ContaRow> {
  const conta = await db.get<ContaRow>(
    contaId
      ? "SELECT * FROM contas WHERE id = ? AND usuario_id = ?"
      : "SELECT * FROM contas WHERE usuario_id = ? ORDER BY id ASC LIMIT 1",
    contaId ? [contaId, usuarioId] : [usuarioId],
  );

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

export async function obterCategoriaDoUsuario(
  db: KeeperDatabase,
  usuarioId: number,
  categoriaId?: number | null,
): Promise<CategoriaRow> {
  const categoria = await db.get<CategoriaRow>(
    categoriaId
      ? "SELECT * FROM categorias WHERE id = ? AND usuario_id = ?"
      : "SELECT * FROM categorias WHERE usuario_id = ? AND nome = 'Geral' ORDER BY id ASC LIMIT 1",
    categoriaId ? [categoriaId, usuarioId] : [usuarioId],
  );

  if (categoria) {
    return categoria;
  }

  if (categoriaId) {
    throw criarErro(404, "Categoria não encontrada.", "CATEGORIA_NAO_ENCONTRADA");
  }

  if (!(await usuarioExiste(db, usuarioId))) {
    throw criarErro(404, "Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO");
  }

  const result = await db.run(
    "INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, 'Geral', 'ambos')",
    [usuarioId],
  );

  if (!result.lastID) {
    throw criarErro(500, "Não foi possível criar a categoria padrão.");
  }

  return { id: result.lastID, usuario_id: usuarioId, nome: "Geral", tipo: "ambos" };
}
