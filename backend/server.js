const express = require("express");
const setupDatabase = require("./database");

const app = express();
app.use(express.json());

const PORT = 3000;

app.get("/testar-banco", async (req, res) => {
  try {
    const db = await setupDatabase();

    // 1. Criar usuário de teste
    await db.run(`
        INSERT OR IGNORE INTO usuarios (id, nome, email, senha) 
        VALUES (1, "Hector Bernhardt", "hector@email.com", "123456")
    `);

    // 2. Criar uma conta de teste para o Hector
    await db.run(`
        INSERT OR IGNORE INTO contas (id, usuario_id, nome_conta, saldo_atual)
        VALUES (1, 1, "Nubank", 1000.00)
    `);

    const usuarios = await db.all("SELECT * FROM usuarios");
    const contas = await db.all("SELECT * FROM contas");

    res.json({
      mensagem: "The Keeper Online! Estrutura Relacional Ativa.",
      usuarios: usuarios,
      contas_registradas: contas,
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(
    `📡 Teste a nova estrutura em http://localhost:${PORT}/testar-banco`,
  );
});
