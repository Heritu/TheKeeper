// Verifica quem está ligado
const userId = localStorage.getItem("keeper_user");
const tipoConta = localStorage.getItem("keeper_tipo");

if (!userId) {
  window.location.href = "/auth";
}

// 1. O Porteiro: Ajusta a interface dependendo se é Empresa ou Pessoal
function configurarTela() {
  if (tipoConta === "empresarial") {
    document.getElementById("user-greeting").innerText =
      "THE KEEPER // VISÃO GERAL: EMPRESA";
    document
      .querySelectorAll(".box-empresa")
      .forEach((c) => c.classList.remove("hidden"));
  } else {
    document.getElementById("user-greeting").innerText =
      "THE KEEPER // VISÃO GERAL: PESSOAL";
    document
      .querySelectorAll(".box-pessoal")
      .forEach((c) => c.classList.remove("hidden"));
  }
}

// 2. Busca o teu saldo real na Base de Dados
async function carregarDados() {
  try {
    const res = await fetch(`/api/dashboard-dados?usuario_id=${userId}`);
    const data = await res.json();

    // Atualiza o número grande no ecrã
    const saldo = Number(data.saldo) || 0;
    document.getElementById("saldo-total").innerText =
      `R$ ${saldo.toFixed(2).replace(".", ",")}`;
  } catch (err) {
    console.error("Erro ao carregar os dados:", err);
  }
}

// 3. Abrir e Fechar a Janela (Modal)
function abrirModal() {
  document.getElementById("modal-lancamento").classList.remove("hidden");
}

function fecharModal() {
  document.getElementById("modal-lancamento").classList.add("hidden");
  // Limpa o que estava escrito para a próxima vez
  document.getElementById("desc-input").value = "";
  document.getElementById("valor-input").value = "";
}

// 4. Guardar o dinheiro na Base de Dados (O coração do sistema)
async function salvarLancamento() {
  const descricao = document.getElementById("desc-input").value;
  let valor = parseFloat(document.getElementById("valor-input").value);
  const tipo = document.getElementById("tipo-input").value;

  // Verifica se o utilizador não deixou nada em branco
  if (!descricao || isNaN(valor)) {
    alert("Por favor, preenche a descrição e o valor!");
    return;
  }

  // Se for uma despesa, transforma o número num valor negativo
  if (tipo === "saida") {
    valor = -Math.abs(valor);
  }

  try {
    // Comunica com o teu server.js
    const response = await fetch("/movimentar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario_id: userId,
        valor: valor,
        descricao: descricao,
      }),
    });

    if (response.ok) {
      fecharModal();
      carregarDados(); // <--- MÁGICA: Pede ao sistema para atualizar o ecrã na hora!
    } else {
      alert("Erro ao guardar na base de dados.");
    }
  } catch (err) {
    console.error("Erro no sistema:", err);
  }
}

// 5. Botão de sair
function logout() {
  localStorage.clear();
  window.location.href = "/";
}

// Inicia o sistema mal a página é aberta
configurarTela();
carregarDados();
