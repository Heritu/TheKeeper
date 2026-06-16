import crypto from "node:crypto";
import path from "node:path";

import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

export type KeeperDatabase = Database<sqlite3.Database, sqlite3.Statement>;

const databasePath = process.env.KEEPER_DB_PATH
  ? path.resolve(process.env.KEEPER_DB_PATH)
  : path.join(__dirname, "..", "database.sqlite");
const PASSWORD_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;

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

export async function setupDatabase(): Promise<KeeperDatabase> {
  const db = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  await db.run("PRAGMA foreign_keys = ON");

  // Ajustes para deixar o SQLite mais estável durante a apresentação.
  await db.run("PRAGMA journal_mode = WAL");
  await db.run("PRAGMA busy_timeout = 5000");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo_conta TEXT NOT NULL DEFAULT 'pessoal',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'ambos',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome_conta TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'corrente',
      instituicao TEXT,
      saldo_atual REAL NOT NULL DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      conta_id INTEGER NOT NULL,
      categoria_id INTEGER NOT NULL,
      valor REAL NOT NULL,
      descricao TEXT,
      data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
      FOREIGN KEY (conta_id) REFERENCES contas (id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS compromissos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('pagar', 'receber')),
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      vencimento DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto',
      recorrente INTEGER NOT NULL DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS investimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      instituicao TEXT,
      quantidade REAL NOT NULL DEFAULT 0,
      preco_medio REAL NOT NULL DEFAULT 0,
      valor_atual REAL NOT NULL DEFAULT 0,
      data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cartoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      bandeira TEXT NOT NULL DEFAULT 'Outro',
      limite_total REAL NOT NULL DEFAULT 0,
      limite_usado REAL NOT NULL DEFAULT 0,
      fechamento INTEGER NOT NULL DEFAULT 1,
      vencimento INTEGER NOT NULL DEFAULT 10,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    -- Estrutura usada pela tela empresarial para controlar equipe e folha.
    CREATE TABLE IF NOT EXISTS funcionarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      funcao TEXT NOT NULL,
      salario REAL NOT NULL DEFAULT 0,
      beneficios REAL NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    -- Registro de ações sensíveis para rastreabilidade do sistema.
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      acao TEXT NOT NULL,
      entidade TEXT NOT NULL,
      metodo TEXT,
      rota TEXT,
      ip TEXT,
      detalhes TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);
    CREATE INDEX IF NOT EXISTS idx_contas_usuario ON contas (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON categorias (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuario_data
      ON movimentacoes (usuario_id, data_movimentacao DESC);
    CREATE INDEX IF NOT EXISTS idx_compromissos_usuario_vencimento
      ON compromissos (usuario_id, vencimento);
    CREATE INDEX IF NOT EXISTS idx_investimentos_usuario
      ON investimentos (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_cartoes_usuario
      ON cartoes (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_funcionarios_usuario
      ON funcionarios (usuario_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_data
      ON auditoria (usuario_id, criado_em DESC);
  `);

  await ensureColumn(db, "usuarios", "tipo_conta", "TEXT NOT NULL DEFAULT 'pessoal'");
  await ensureColumn(db, "usuarios", "criado_em", "DATETIME DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn(db, "categorias", "tipo", "TEXT NOT NULL DEFAULT 'ambos'");
  await ensureColumn(db, "categorias", "criado_em", "DATETIME DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn(db, "contas", "tipo", "TEXT NOT NULL DEFAULT 'corrente'");
  await ensureColumn(db, "contas", "instituicao", "TEXT");
  await ensureColumn(db, "contas", "criado_em", "DATETIME DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn(db, "cartoes", "bandeira", "TEXT NOT NULL DEFAULT 'Outro'");
  await ensureColumn(db, "cartoes", "limite_usado", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "cartoes", "fechamento", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "cartoes", "vencimento", "INTEGER NOT NULL DEFAULT 10");
  await ensureColumn(db, "cartoes", "ativo", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "cartoes", "criado_em", "DATETIME DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn(db, "funcionarios", "funcao", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "funcionarios", "salario", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "funcionarios", "beneficios", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "funcionarios", "ativo", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "funcionarios", "criado_em", "DATETIME DEFAULT CURRENT_TIMESTAMP");

  await seedSystemRecords(db);

  console.log("Banco de dados SQLite operacional.");
  return db;
}

async function ensureColumn(
  db: KeeperDatabase,
  tableName: string,
  columnName: string,
  definition: string,
): Promise<void> {
  const columns = await db.all<Array<{ name: string }>>(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function seedSystemRecords(db: KeeperDatabase): Promise<void> {
  const senhaSistema = await hashSenha("admin123");

  await db.run(
    `
      INSERT OR IGNORE INTO usuarios (id, nome, email, senha, tipo_conta)
      VALUES (1, 'Sistema The Keeper', 'sistema@keeper.com', ?, 'admin')
    `,
    [senhaSistema],
  );

  await db.run("UPDATE usuarios SET senha = ? WHERE id = 1 AND senha = 'admin123'", [senhaSistema]);

  await db.run(
    `
      INSERT OR IGNORE INTO categorias (id, usuario_id, nome)
      VALUES (1, 1, 'Geral')
    `,
  );
}
