import cron, { ScheduledTask } from "node-cron";

import { WbTariffService } from "./wb-tariffs.service.js";
import { SheetsSyncService } from "./sheets-sync.service.js";

/** SchedulerService - manages cron jobs for fetch and sync */
export class SchedulerService {
  wbService: WbTariffService;
  sheetsService: SheetsSyncService;
  fetchTask?: ScheduledTask;
  syncTask?: ScheduledTask;
  fetchCron: string;
  syncCron: string;

  constructor(opts: { wbService: WbTariffService; sheetsService: SheetsSyncService; fetchCron?: string; syncCron?: string }) {
    this.wbService = opts.wbService;
    this.sheetsService = opts.sheetsService;

    const isFast = process.env.TEST_FAST === "1";

    this.fetchCron = opts.fetchCron ?? (isFast ? "*/60 * * * * *" : "0 * * * *");

    this.syncCron = opts.syncCron ?? (isFast ? "*/1 * * * * *" : "5 * * * *");
  }

  start() {
    this.fetchTask = cron.schedule(this.fetchCron, async () => {
      console.log("[scheduler] Running hourly WB tariffs fetch");

      try {
        await this.wbService.fetchAndStore();
      } catch (err) {
        console.error("[scheduler] fetch failed:", err);
      }
    });

    this.syncTask = cron.schedule(this.syncCron, async () => {
      console.log("[scheduler] Running sheets sync");

      try {
        await this.sheetsService.syncLatestSnapshot();
      } catch (err) {
        console.error("[scheduler] sheets sync failed:", err);
      }
    });

    console.log("Scheduler started: hourly fetch and hourly sheets sync (offset by 5 minutes)");
  }

  stop() {
    this.fetchTask?.stop();

    this.syncTask?.stop();

    console.log("Scheduler stopped");
  }
}
