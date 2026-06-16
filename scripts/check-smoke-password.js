const path = require("node:path");
const { createRequire } = require("node:module");

const [backendRoot, dbPath, email, plainPassword] = process.argv.slice(2);

if (!backendRoot || !dbPath || !email || !plainPassword) {
  console.error("Uso: node check-smoke-password.js <backendRoot> <dbPath> <email> <plainPassword>");
  process.exit(1);
}

const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const sqlite3 = backendRequire("sqlite3");
const { open } = backendRequire("sqlite");

(async () => {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const row = await db.get("SELECT senha FROM usuarios WHERE email = ?", [email]);
  await db.close();

  if (!row) {
    throw new Error("Usuário smoke não foi encontrado no banco.");
  }

  if (row.senha === plainPassword) {
    throw new Error("Senha foi salva em texto puro.");
  }

  if (!String(row.senha).startsWith("scrypt$")) {
    throw new Error("Senha não foi salva com hash scrypt.");
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
