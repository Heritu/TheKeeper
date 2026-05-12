const express = require("express");
const path = require("path");
const crypto = require("crypto");
const setupDatabase = require("./database");

const app = express();
app.use(express.json());

let db;
const hashSenha = (senha) =>
  crypto.createHash("sha256").update(senha).digest("hex");
const pastaFrontend = path.join(__dirname, "..", "frontend");

app.use(express.static(pastaFrontend));
app.use("/assets", express.static(path.join(pastaFrontend, "assets")));

// Navegação
app.get("/", (req, res) =>
  res.sendFile(path.join(pastaFrontend, "welcome.html")),
);
app.get("/auth", (req, res) =>
  res.sendFile(path.join(pastaFrontend, "auth.html")),
);
app.get("/dashboard", (req, res) =>
  res.sendFile(path.join(pastaFrontend, "dashboard.html")),
);

// Auth
app.post("/registrar", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const result = await db.run(
      "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
      [nome, email, hashSenha(senha)],
    );
    await db.run(
      "INSERT INTO contas (usuario_id, nome_conta, saldo_atual) VALUES (?, 'Principal', 0)",
      [result.lastID],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const user = await db.get(
    "SELECT * FROM usuarios WHERE email = ? AND senha = ?",
    [email, hashSenha(senha)],
  );
  user
    ? res.json({ success: true, userId: user.id })
    : res.json({ success: false });
});

// Movimentação (SEM TRAVAS)
app.post("/movimentar", async (req, res) => {
  try {
    const { usuario_id, valor, descricao } = req.body;
    await db.run("PRAGMA foreign_keys = OFF");

    const conta = await db.get("SELECT id FROM contas WHERE usuario_id = ?", [
      usuario_id,
    ]);
    const contaId = conta ? conta.id : 1;

    await db.run(
      "INSERT INTO movimentacoes (usuario_id, conta_id, categoria_id, valor, descricao) VALUES (?, ?, 1, ?, ?)",
      [usuario_id, contaId, valor, descricao],
    );
    await db.run(
      "UPDATE contas SET saldo_atual = saldo_atual + ? WHERE usuario_id = ?",
      [valor, usuario_id],
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/dashboard-dados", async (req, res) => {
  try {
    const { usuario_id } = req.query;
    const conta = await db.get(
      "SELECT saldo_atual FROM contas WHERE usuario_id = ?",
      [usuario_id],
    );
    const logs = await db.all(
      "SELECT * FROM movimentacoes WHERE usuario_id = ? ORDER BY id DESC LIMIT 10",
      [usuario_id],
    );
    res.json({
      saldo: conta ? conta.saldo_atual : 0,
      ultimasMovimentacoes: logs || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, async () => {
  db = await setupDatabase();
  console.log(`🚀 THE KEEPER OPERACIONAL: http://localhost:${PORT}`);
});
