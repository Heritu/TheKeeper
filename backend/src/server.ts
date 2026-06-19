import { criarApp } from "./app";
import { setupDatabase } from "./database";

const PORT = Number(process.env.PORT) || 3000;

async function iniciarServidor(): Promise<void> {
  const db = await setupDatabase();
  const app = criarApp(db);

  const server = app.listen(PORT, () => {
    console.log(`THE KEEPER operacional: http://localhost:${PORT}`);
  });

  const encerrar = async () => {
    console.log("\nEncerrando o The Keeper...");
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

iniciarServidor().catch((error) => {
  console.error("Falha ao iniciar o backend The Keeper:", error);
  process.exit(1);
});
