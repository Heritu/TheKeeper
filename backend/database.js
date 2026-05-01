const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function setupDatabase() {
  const db = await open({
    filename: __dirname + "/database.sqlite", // O __dirname garante que o banco fique dentro da pasta backend
    driver: sqlite3.Database,
  });

  // Ativa o suporte a chaves estrangeiras no SQLite
  await db.run("PRAGMA foreign_keys = ON");

  // Tabela de Usuários
  await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        )
    `);

  // Tabela de Categorias
  await db.exec(`
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL
        )
    `);

  // Tabela de Contas (Relacionada ao Usuário)
  await db.exec(`
        CREATE TABLE IF NOT EXISTS contas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            nome_conta TEXT NOT NULL,
            saldo_atual REAL DEFAULT 0,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
        )
    `);

  // Tabela de Movimentações (Relacionada a Usuário, Conta e Categoria)
  await db.exec(`
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
            FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE RESTRICT
        )
    `);

  console.log("✅ Banco de dados preparado para o funcionamento!");
  return db;
}

module.exports = setupDatabase;
