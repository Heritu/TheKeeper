import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { cadastrar, login } from "../api";
import type { TipoUsuario } from "../types";

type ModoAuth = "login" | "cadastro";

export default function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<ModoAuth>("login");
  const [tipoConta, setTipoConta] = useState<TipoUsuario>("pessoal");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setMensagem("");

    if (modo === "cadastro" && senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    try {
      if (modo === "login") {
        await login({ email, senha });
      } else {
        await cadastrar({
          nome,
          email,
          senha,
          tipo_conta: tipoConta,
        });

        setModo("login");
        setSenha("");
        setConfirmarSenha("");
        setMensagem("Conta criada com sucesso. Agora entre com email e senha.");
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível acessar a conta.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          <span className="brand-mark">TK</span>
          <span className="eyebrow">The Keeper</span>
          <h1>Entre para cuidar do seu dinheiro com mais clareza.</h1>
          <p>
            Use uma conta pessoal para organizar custos do dia a dia ou uma conta
            de negócios para acompanhar caixa, despesas e operação.
          </p>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="auth-tabs" role="tablist" aria-label="Acesso">
            <button
              className={modo === "login" ? "active" : ""}
              onClick={() => {
                setModo("login");
                setErro("");
                setMensagem("");
              }}
              type="button"
            >
              Login
            </button>
            <button
              className={modo === "cadastro" ? "active" : ""}
              onClick={() => {
                setModo("cadastro");
                setErro("");
                setMensagem("");
              }}
              type="button"
            >
              Cadastro
            </button>
          </div>

          <div>
            <span className="eyebrow">{modo === "login" ? "Acesso seguro" : "Nova conta"}</span>
            <h2>{modo === "login" ? "Entrar" : "Criar acesso"}</h2>
          </div>

          {modo === "cadastro" && (
            <>
              <fieldset className="segmented-control">
                <legend>Tipo de usuário</legend>
                <label>
                  <input
                    checked={tipoConta === "pessoal"}
                    name="tipoConta"
                    onChange={() => setTipoConta("pessoal")}
                    type="radio"
                  />
                  Pessoal
                </label>
                <label>
                  <input
                    checked={tipoConta === "empresarial"}
                    name="tipoConta"
                    onChange={() => setTipoConta("empresarial")}
                    type="radio"
                  />
                  Negócios
                </label>
              </fieldset>

              <label>
                Nome
                <input
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Seu nome ou empresa"
                  required
                  value={nome}
                />
              </label>
            </>
          )}

          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            Senha
            <div className="password-field">
              <input
                autoComplete={modo === "login" ? "current-password" : "new-password"}
                minLength={6}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Sua senha"
                required
                type={mostrarSenha ? "text" : "password"}
                value={senha}
              />
              <button onClick={() => setMostrarSenha((value) => !value)} type="button">
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          {modo === "cadastro" && (
            <label>
              Confirmar senha
              <div className="password-field">
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                  placeholder="Repita sua senha"
                  required
                  type={mostrarConfirmacao ? "text" : "password"}
                  value={confirmarSenha}
                />
                <button onClick={() => setMostrarConfirmacao((value) => !value)} type="button">
                  {mostrarConfirmacao ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
          )}

          {erro && <p className="form-error">{erro}</p>}
          {mensagem && <p className="form-success">{mensagem}</p>}

          <button className="button primary" disabled={carregando} type="submit">
            {carregando ? "Processando..." : modo === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}
