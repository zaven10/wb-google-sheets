import knex from "#postgres/knex.js";

import type { IWbTariffItem } from "#interfaces/index.js";

export class WbTariffService {
  url: string;

  constructor(opts?: { url?: string }) {
    this.url = opts?.url ?? process.env.WB_TARIFFS_URL ?? "https://common-api.wildberries.ru/api/v1/tariffs/box";
  }

  async fetchAndStore(forDate?: string): Promise<IWbTariffItem[]> {
    try {
      const apiKey = process.env.WB_API_KEY;

      const apiKeyHeader = process.env.WB_API_KEY_HEADER ?? "Authorization";

      const headers: Record<string, string> = { Accept: "application/json" };

      if (apiKey) {
        headers[apiKeyHeader] = `Bearer ${apiKey}`;
      }

      const dateToUse = forDate ?? new Date().toISOString().slice(0, 10);

      const url = `${this.url}?date=${dateToUse}`;

      const res: any = await fetch(url, { method: "GET", headers });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(`[WB API Error] [${res.status}]: ${json?.detail}`);
      }

      const { data } = json?.response;

      const items = Array.isArray(data?.warehouseList) ? data.warehouseList : [];

      await knex("tariff_snapshots")
        .insert({ day: dateToUse, data: JSON.stringify(items), updated_at: knex.fn.now() })
        .onConflict(["day"])
        .merge({ data: JSON.stringify(items), updated_at: knex.fn.now() });

      console.log(`WB tariffs fetched and stored for ${dateToUse}`);

      return items;
    } catch (err) {
      console.error("Failed to fetch or store WB tariffs:", err);

      throw err;
    }
  }
}
