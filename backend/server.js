const express = require("express");
const setupDatabase = require("./database");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 3000;

// ROTA DE REGISTRO
app.post("/registrar", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const db = await setupDatabase();
    const result = await db.run(
      `INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`,
      [nome, email, senha],
    );
    await db.run(
      `INSERT INTO contas (usuario_id, nome_conta, saldo_atual) VALUES (?, ?, ?)`,
      [result.lastID, "Carteira Principal", 0],
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Email já cadastrado" });
  }
});

// ROTA PARA CATEGORIAS
app.post("/categorias", async (req, res) => {
  try {
    const { nome } = req.body;
    const db = await setupDatabase();
    await db.run(`INSERT INTO categorias (nome) VALUES (?)`, [nome]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ROTA DE MOVIMENTAÇÃO
app.post("/movimentar", async (req, res) => {
  try {
    const { usuario_id, categoria_id, valor, descricao } = req.body;
    const db = await setupDatabase();
    const conta = await db.get("SELECT id FROM contas WHERE usuario_id = ?", [
      usuario_id,
    ]);

    await db.run(
      `INSERT INTO movimentacoes (usuario_id, conta_id, categoria_id, valor, descricao) VALUES (?, ?, ?, ?, ?)`,
      [usuario_id, conta.id, categoria_id, valor, descricao],
    );

    await db.run(
      `UPDATE contas SET saldo_atual = saldo_atual + ? WHERE id = ?`,
      [valor, conta.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ROTA DE EXCLUSÃO COM ESTORNO DE SALDO (O DIFERENCIAL TÉCNICO)
app.delete("/deletar/movimentacoes/:id", async (req, res) => {
  try {
    const db = await setupDatabase();
    const mov = await db.get(
      "SELECT valor, conta_id FROM movimentacoes WHERE id = ?",
      [req.params.id],
    );

    if (mov) {
      // Estorna o valor: se era um gasto (-50), ele subtrai o negativo (vira +50)
      await db.run(
        "UPDATE contas SET saldo_atual = saldo_atual - ? WHERE id = ?",
        [mov.valor, mov.conta_id],
      );
      await db.run("DELETE FROM movimentacoes WHERE id = ?", [req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INTERFACE DO ADMIN
app.get("/admin", async (req, res) => {
  try {
    const db = await setupDatabase();
    const usuarios = (await db.all("SELECT * FROM usuarios")) || [];
    const categorias = (await db.all("SELECT * FROM categorias")) || [];
    const totalSistemas = await db.get(
      "SELECT SUM(saldo_atual) as total FROM contas",
    );

    const resumoCategorias =
      (await db.all(`
        SELECT c.nome, SUM(m.valor) as total 
        FROM movimentacoes m
        JOIN categorias c ON m.categoria_id = c.id
        GROUP BY c.id
    `)) || [];

    const ultimasMovimentacoes =
      (await db.all(`
        SELECT m.*, u.nome as usuario_nome, cat.nome as categoria_nome 
        FROM movimentacoes m
        JOIN usuarios u ON m.usuario_id = u.id
        JOIN categorias cat ON m.categoria_id = cat.id
        ORDER BY m.id DESC LIMIT 8
    `)) || [];

    res.send(`
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <title>The Keeper | Gestão</title>
                <style>
                    :root { --primary: #10b981; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --danger: #ef4444; }
                    body { font-family: 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 20px; margin: 0; }
                    .container { max-width: 1200px; margin: auto; }
                    .header-stats { background: var(--primary); color: #0f172a; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; justify-content: space-between; font-weight: 800; }
                    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 40px; }
                    .card { background: var(--card); padding: 25px; border-radius: 16px; border: 1px solid #334155; }
                    h3 { color: var(--primary); margin: 0 0 20px 0; font-size: 1.1rem; }
                    input, select { width: 100%; padding: 12px; margin-bottom: 15px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 8px; box-sizing: border-box; }
                    button { width: 100%; padding: 12px; background: var(--primary); border: none; color: #0f172a; font-weight: bold; border-radius: 8px; cursor: pointer; }
                    .btn-blue { background: #3b82f6; color: white; }
                    .btn-x { background: var(--danger); color: white; padding: 5px 10px; width: auto; font-size: 11px; }
                    table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 12px; overflow: hidden; }
                    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #334155; }
                    th { background: #334155; color: var(--primary); font-size: 0.75rem; text-transform: uppercase; }
                    .badge { background: #334155; padding: 4px 8px; border-radius: 6px; font-size: 11px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header-stats">
                        <span>THE KEEPER </span>
                        <span>SALDO TOTAL: R$ ${totalSistemas.total ? totalSistemas.total.toFixed(2) : "0.00"}</span>
                    </div>

                    <div class="grid">
                        <div class="card">
                            <h3>👤 1. Usuários</h3>
                            <input type="text" id="nome" placeholder="Nome">
                            <input type="email" id="email" placeholder="E-mail">
                            <input type="password" id="senha" placeholder="Senha">
                            <button onclick="registrar()">CADASTRAR</button>
                        </div>

                        <div class="card">
                            <h3>📁 2. Categorias</h3>
                            <input type="text" id="nome_cat" placeholder="Nova Categoria">
                            <button onclick="addCategoria()">CRIAR</button>
                            <div style="margin-top:15px; font-size:0.8rem;">
                                ${resumoCategorias
                                  .map(
                                    (
                                      r,
                                    ) => `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #334155;">
                                    <span>${r.nome}</span><span style="color:${r.total < 0 ? "var(--danger)" : "var(--primary)"}">R$ ${r.total.toFixed(2)}</span>
                                </div>`,
                                  )
                                  .join("")}
                            </div>
                        </div>

                        <div class="card">
                            <h3>💸 3. Lançamento</h3>
                            <select id="sel_user">
                                <option value="">Usuário</option>
                                ${usuarios.map((u) => `<option value="${u.id}">${u.nome}</option>`).join("")}
                            </select>
                            <select id="sel_cat">
                                <option value="">Categoria</option>
                                ${categorias.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("")}
                            </select>
                            <input type="number" id="valor" placeholder="Valor (ex: -50)">
                            <input type="text" id="desc" placeholder="Descrição">
                            <button onclick="movimentar()" class="btn-blue">CONFIRMAR</button>
                        </div>
                    </div>

                    <h3>📜 Histórico Recente</h3>
                    <table>
                        <thead>
                            <tr><th>Usuário</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            ${ultimasMovimentacoes
                              .map(
                                (m) => `
                                <tr>
                                    <td><b>${m.usuario_nome}</b></td>
                                    <td><span class="badge">${m.categoria_nome}</span></td>
                                    <td>${m.descricao}</td>
                                    <td style="color: ${m.valor < 0 ? "var(--danger)" : "var(--primary)"}">R$ ${m.valor.toFixed(2)}</td>
                                    <td><button class="btn-x" onclick="deletar(${m.id})">EXCLUIR</button></td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>

                <script>
                    async function registrar() {
                        const data = { nome: document.getElementById('nome').value, email: document.getElementById('email').value, senha: document.getElementById('senha').value };
                        await fetch('/registrar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
                        location.reload();
                    }
                    async function addCategoria() {
                        const nome = document.getElementById('nome_cat').value;
                        await fetch('/categorias', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ nome }) });
                        location.reload();
                    }
                    async function movimentar() {
                        const data = { usuario_id: document.getElementById('sel_user').value, categoria_id: document.getElementById('sel_cat').value, valor: document.getElementById('valor').value, descricao: document.getElementById('desc').value };
                        await fetch('/movimentar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
                        location.reload();
                    }
                    async function deletar(id) {
                        if(confirm('Excluir lançamento e estornar saldo?')) {
                            await fetch('/deletar/movimentacoes/' + id, { method: 'DELETE' });
                            location.reload();
                        }
                    }
                </script>
            </body>
            </html>
        `);
  } catch (err) {
    res.send(err.message);
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Servidor pronto em http://localhost:${PORT}/admin`),
);
