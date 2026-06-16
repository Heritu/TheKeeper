import { Link } from "react-router-dom";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div>
          <span className="brand-mark">TK</span>
          <span className="eyebrow">The Keeper</span>
          <h1>Gestão financeira pessoal e empresarial em um único lugar.</h1>
          <p>
            Controle entradas, despesas, fluxo de caixa e patrimônio com uma
            visão clara para tomar decisões melhores todos os dias.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/auth">
              Login e cadastro
            </Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="Resumo financeiro ilustrativo">
          <span>Fluxo previsto</span>
          <strong>R$ 24.850,00</strong>
          <div className="mini-chart">
            <span style={{ height: "42%" }} />
            <span style={{ height: "64%" }} />
            <span style={{ height: "51%" }} />
            <span style={{ height: "78%" }} />
            <span style={{ height: "70%" }} />
          </div>
        </div>
      </section>
    </main>
  );
}
