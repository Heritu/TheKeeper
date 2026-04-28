const express = require("express");
const setupDatabase = require("./database");

const app = express();
app.use(express.json());

const PORT = 3000;

// ROTA 1: REGISTRAR (Simulando o cadastro)
app.post("/registrar", async (req, res) => {
  const { nome, email, senha } = req.body;
  const db = await setupDatabase();
  try {
    const result = await db.run(
      `INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`,
      [nome, email, senha],
    );
    // Cria automaticamente uma conta "Carteira" para o novo usuário
    await db.run(
      `INSERT INTO contas (usuario_id, nome_conta, saldo_atual) VALUES (?, ?, ?)`,
      [result.lastID, "Carteira Principal", 0],
    );
    res
      .status(201)
      .json({ mensagem: "Usuário e Carteira criados com sucesso!" });
  } catch (err) {
    res.status(400).json({ erro: "Email já cadastrado ou erro no banco." });
  }
});

// ROTA 2: LOGAR (Simulando verificação)
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  const db = await setupDatabase();
  const usuario = await db.get(
    "SELECT id, nome FROM usuarios WHERE email = ? AND senha = ?",
    [email, senha],
  );

  if (usuario) {
    res.json({ mensagem: `Bem-vindo, ${usuario.nome}!`, id: usuario.id });
  } else {
    res.status(401).json({ erro: "Credenciais inválidas." });
  }
});

// ROTA 3: MOVIMENTAÇÃO (Registrar um gasto/ganho)
app.post("/movimentar", async (req, res) => {
  const { usuario_id, conta_id, categoria_id, valor, descricao } = req.body;
  const db = await setupDatabase();
  try {
    await db.run(
      `INSERT INTO movimentacoes (usuario_id, conta_id, categoria_id, valor, descricao) VALUES (?, ?, ?, ?, ?)`,
      [usuario_id, conta_id, categoria_id, valor, descricao],
    );
    // Lógica básica: Atualiza o saldo da conta
    await db.run(
      `UPDATE contas SET saldo_atual = saldo_atual + ? WHERE id = ?`,
      [valor, conta_id],
    );
    res.json({ mensagem: "Movimentação registrada e saldo atualizado!" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 The Keeper rodando em http://localhost:${PORT}`);
});
