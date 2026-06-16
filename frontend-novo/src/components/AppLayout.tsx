import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../api";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/lancamentos", label: "Lançamentos" },
  { to: "/cartoes", label: "Cartões" },
  { to: "/compromissos", label: "Compromissos" },
  { to: "/investimentos", label: "Investimentos" },
  { to: "/simulador", label: "Simulador" },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const session = getSession();
  const tipoLabel = session?.tipoConta === "empresarial" ? "Negócios" : "Pessoal";

  function sair() {
    clearSession();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">TK</span>
          <div>
            <strong>The Keeper</strong>
            <span>{tipoLabel}</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="eyebrow">Modo ativo</span>
          <strong>{tipoLabel}</strong>
          <p>
            {session?.tipoConta === "empresarial"
              ? "Controle de caixa, despesas e operação."
              : "Controle de gastos, renda e objetivos pessoais."}
          </p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Workspace {tipoLabel.toLowerCase()}</span>
            <h1>
              {session?.tipoConta === "empresarial"
                ? "Gestão financeira de negócios"
                : "Gestão financeira pessoal"}
            </h1>
          </div>
          <div className="user-pill">
            <span>{session?.nome ?? "Usuário"}</span>
            <button onClick={sair} type="button">
              Sair
            </button>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
