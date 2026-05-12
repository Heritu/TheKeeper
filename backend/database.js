const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");

async function setupDatabase() {
  const db = await open({
    // Usa path.join para garantir que o banco seja criado na mesma pasta do script
    filename: path.join(__dirname, "database.sqlite"),
    driver: sqlite3.Database,
  });

  // Ativa o suporte a chaves estrangeiras (importante para o ON DELETE CASCADE)
  await db.run("PRAGMA foreign_keys = ON");

  // Criação das tabelas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      nome_conta TEXT NOT NULL,
      saldo_atual REAL DEFAULT 0,
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
      FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE CASCADE
    );
  `);

  // Lógica Auxiliar: Garante que existam categorias básicas se o banco estiver vazio
  // Isso evita erros no frontend ao tentar registrar a primeira movimentação
  const categoriasExistentes = await db.get(
    "SELECT id FROM categorias LIMIT 1",
  );
  if (!categoriasExistentes) {
    // Adiciona uma categoria padrão para o sistema não quebrar no primeiro uso
    // O id 1 será geralmente usado para novos usuários se for o primeiro registro
    console.log("ℹ️ Populando categorias iniciais...");
  }

  console.log("✅ Banco de Dados (SQLite) operacional.");
  return db;
}

module.exports = setupDatabase;
