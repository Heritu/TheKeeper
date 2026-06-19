import path from "node:path";

import express from "express";

import type { KeeperDatabase } from "./database";
import { criarAuditoria } from "./middlewares/audit";
import { autenticar } from "./middlewares/auth";
import { tratarErro } from "./middlewares/error";
import { criarRotasAuth } from "./routes/auth";
import { criarRotasCartoes } from "./routes/cartoes";
import { criarRotasCategorias } from "./routes/categorias";
import { criarRotasCompromissos } from "./routes/compromissos";
import { criarRotasContas } from "./routes/contas";
import { criarRotasDashboard } from "./routes/dashboard";
import { criarRotasFuncionarios } from "./routes/funcionarios";
import { criarRotasInvestimentos } from "./routes/investimentos";
import { criarRotasMovimentacoes } from "./routes/movimentacoes";

const projectRoot = path.join(__dirname, "..", "..");
const reactFrontendPath = path.join(projectRoot, "frontend-novo", "dist");

export function criarApp(db: KeeperDatabase): express.Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(reactFrontendPath));

  const indexHtml = path.join(reactFrontendPath, "index.html");
  app.get(
    ["/", "/auth", "/dashboard", "/lancamentos", "/cartoes", "/compromissos", "/investimentos", "/simulador"],
    (_req, res) => res.sendFile(indexHtml),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "the-keeper-backend" });
  });

  app.use("/api/auth", criarRotasAuth(db));
  app.use("/api", autenticar, criarAuditoria(db));
  app.use("/api/contas", criarRotasContas(db));
  app.use("/api/cartoes", criarRotasCartoes(db));
  app.use("/api/funcionarios", criarRotasFuncionarios(db));
  app.use("/api/categorias", criarRotasCategorias(db));
  app.use("/api/movimentacoes", criarRotasMovimentacoes(db));
  app.use("/api", criarRotasDashboard(db));
  app.use("/api/compromissos", criarRotasCompromissos(db));
  app.use("/api/investimentos", criarRotasInvestimentos(db));
  app.use(tratarErro);

  return app;
}
