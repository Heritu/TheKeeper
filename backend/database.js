const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function setupDatabase() {
  const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  // ESSENCIAL: Ativa o suporte a chaves estrangeiras no SQLite
  await db.get("PRAGMA foreign_keys = ON");

  await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            tipo TEXT CHECK(tipo IN ('Entrada', 'Saída'))
        );

        CREATE TABLE IF NOT EXISTS contas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            nome_conta TEXT NOT NULL,
            saldo_atual REAL DEFAULT 0,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            categoria_id INTEGER,
            conta_id INTEGER,
            descricao TEXT,
            valor REAL NOT NULL,
            status_quitacao BOOLEAN DEFAULT 0,
            data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id),
            FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS metas_poupanca (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            objetivo TEXT NOT NULL,
            valor_alvo REAL NOT NULL,
            valor_poupado REAL DEFAULT 0,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
    `);

  console.log("✅ Banco de dados preparado para o funcionamento básico!");
  return db;
}

module.exports = setupDatabase;
