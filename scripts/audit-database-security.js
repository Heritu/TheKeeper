const path = require("node:path");
const { createRequire } = require("node:module");

const projectRoot = path.resolve(__dirname, "..");
const backendRoot = path.join(projectRoot, "backend");
const dbPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(backendRoot, "database.sqlite");

const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const sqlite3 = backendRequire("sqlite3");
const { open } = backendRequire("sqlite");

function senhaResumo(senha) {
  const valor = String(senha);

  return {
    prefixo: valor.split("$")[0],
    scrypt: valor.startsWith("scrypt$"),
    tamanho: valor.length,
  };
}

(async () => {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const usuarios = await db.all(
    "SELECT id, nome, email, senha, tipo_conta FROM usuarios ORDER BY id",
  );
  const duplicados = await db.all(
    "SELECT email, COUNT(*) AS total FROM usuarios GROUP BY email HAVING COUNT(*) > 1",
  );
  const auditoriaExiste = await db.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auditoria'",
  );
  const auditoriaResumo = auditoriaExiste
    ? await db.get("SELECT COUNT(*) AS total FROM auditoria")
    : { total: 0 };
  await db.close();

  console.log(`Banco analisado: ${dbPath}`);
  console.log(`Usuários encontrados: ${usuarios.length}`);
  console.log(`Emails duplicados: ${duplicados.length}`);
  console.log(`Registros de auditoria: ${auditoriaResumo.total}`);
  console.log("");

  for (const usuario of usuarios) {
    const senha = senhaResumo(usuario.senha);
    console.log(
      [
        `#${usuario.id}`,
        usuario.email,
        `tipo=${usuario.tipo_conta}`,
        `senha_prefixo=${senha.prefixo}`,
        `scrypt=${senha.scrypt}`,
        `tamanho=${senha.tamanho}`,
      ].join(" | "),
    );
  }

  if (duplicados.length > 0) {
    console.log("");
    console.log("Duplicados:");

    for (const item of duplicados) {
      console.log(`${item.email}: ${item.total}`);
    }
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
