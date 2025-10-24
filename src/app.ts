import knex, { migrate, seed } from "#postgres/knex.js";

import { GoogleAuthService, WbTariffService, SheetsSyncService, SchedulerService } from "#services/index.js";

async function boot() {
  await migrate.latest();
  await seed.run();

  console.log("All migrations and seeds have been run");

  const authService = new GoogleAuthService();
  const wbService = new WbTariffService();
  const sheetsService = new SheetsSyncService(authService);

  const scheduler = new SchedulerService({ wbService, sheetsService });
  scheduler.start();

  process.on("SIGINT", async () => {
    console.log("Shutting down...");

    scheduler.stop();

    await knex.destroy();

    process.exit(0);
  });
}

boot().catch((err) => {
  console.error("Failed to start application:", err);

  process.exit(1);
});
