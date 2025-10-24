import knex from "#postgres/knex.js";

import { GoogleAuthService } from "#/services/index.js";

import type { sheets_v4 } from "googleapis";

import type { IWbTariffItem, ITariffSnapshotRow } from "#/interfaces/index.js";

export class SheetsSyncService {
  authService: GoogleAuthService;

  constructor(authService: GoogleAuthService) {
    this.authService = authService;
  }

  private parseNumberMaybe(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      // replace comma decimal separators and trim
      const normalized = value.replace(/,/g, ".").replace(/[\s\u00A0]/g, "");
      const num = Number(normalized);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }

  private findCoefficient(obj: any): number | null {
    if (!obj || typeof obj !== "object") return null;

    // Prefer explicit coef fields from WB response
    const preferKeys = ["boxDeliveryCoefExpr", "boxStorageCoefExpr", "boxDeliveryMarketplaceCoefExpr", "coef", "coefficient", "k"];

    for (const k of preferKeys) {
      if (k in obj) {
        const parsed = this.parseNumberMaybe((obj as any)[k]);
        if (parsed != null) return parsed;
      }
    }

    // fallback: search any numeric-like string field
    for (const k of Object.keys(obj)) {
      const parsed = this.parseNumberMaybe((obj as any)[k]);
      if (parsed != null) return parsed;
    }

    return null;
  }

  async syncLatestSnapshot(): Promise<void> {
    const row: ITariffSnapshotRow | undefined = await knex("tariff_snapshots").orderBy("day", "desc").first();

    if (!row) {
      console.log("No tariff snapshot available to sync");

      return;
    }

    const mapped = row.data.map((it: IWbTariffItem, idx: number) => {
      const coeff = this.findCoefficient(it);

      const warehouse = it?.warehouseName ?? `item_${idx}`;
      const geo = it?.geoName ?? "";

      return { warehouse, geo, coeff, raw: it };
    });

    mapped.sort((a: any, b: any) => {
      if (a.coeff == null && b.coeff == null) return 0;
      if (a.coeff == null) return 1;
      if (b.coeff == null) return -1;
      return a.coeff - b.coeff;
    });

    const header = ["warehouse", "geo", "coefficient", "raw_json"];

    const values = [header, ...mapped.map((m: any) => [m.warehouse, m.geo, m.coeff ?? "", JSON.stringify(m.raw)])];

    const sheets = await knex("spreadsheets").select("spreadsheet_id");

    if (!sheets || !sheets.length) {
      console.log("No spreadsheets configured in DB to sync");

      return;
    }

    const isFast = process.env.TEST_FAST === "1";

    if (isFast) {
      for (const s of sheets) {
        const spreadsheetId = s.spreadsheet_id;

        console.log(`[TEST_FAST] Would sync to spreadsheet ${spreadsheetId}. Preview rows:`);

        console.log(values.slice(0, 5));
      }

      return;
    }

    const client: sheets_v4.Sheets = await this.authService.getSheetsClient();

    for (const s of sheets) {
      let spreadsheetId = s.spreadsheet_id;

      try {
        await client.spreadsheets.values.clear({ spreadsheetId, range: "stocks_coefs" });
      } catch (err: any) {
        const msg = String(err?.message || err);

        if (msg.includes("Requested entity was not found") || err?.code === 404 || err?.response?.status === 404) {
          console.warn(`Spreadsheet ${spreadsheetId} not found. Creating a new spreadsheet and replacing DB entry.`);

          try {
            const title = `tariffs_${new Date().toISOString()}`;

            const createRes = await client.spreadsheets.create({
              requestBody: {
                properties: { title },
                sheets: [{ properties: { title: "stocks_coefs" } }],
              },
            });

            const newId = createRes.data.spreadsheetId;

            if (!newId) {
              console.error(`Failed to create replacement spreadsheet for ${spreadsheetId}: no id returned`);

              continue;
            }

            try {
              await knex.transaction(async (trx) => {
                await trx("spreadsheets").where({ spreadsheet_id: spreadsheetId }).del();

                await trx("spreadsheets").insert({ spreadsheet_id: newId });
              });

              console.log(`Replaced spreadsheet id ${spreadsheetId} -> ${newId} in DB`);

              spreadsheetId = newId;
            } catch (dbErr) {
              console.error(`Failed to replace spreadsheet id in DB for ${spreadsheetId}:`, dbErr);

              spreadsheetId = newId;
            }
          } catch (createErr) {
            console.error(`Failed to create a new spreadsheet to replace ${spreadsheetId}:`, createErr);

            console.error("Make sure the service account has permission to create spreadsheets and your Google quota is not exceeded.");

            continue;
          }
        } else {
          try {
            await client.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: { requests: [{ addSheet: { properties: { title: "stocks_coefs" } } }] },
            });
          } catch (e: any) {
            console.error(`Failed to ensure sheet 'stocks_coefs' in ${spreadsheetId}:`, e);

            if (
              String(e?.message || "")
                .toLowerCase()
                .includes("requested entity was not found") ||
              e?.response?.status === 404
            ) {
              console.error("Spreadsheet not found or access denied. Verify the spreadsheet id and share the sheet with the service account email.");
            }

            continue;
          }
        }
      }

      try {
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: "stocks_coefs!A1",
          valueInputOption: "RAW",
          requestBody: { values },
        });

        console.log(`Synced tariffs to spreadsheet ${spreadsheetId}`);
      } catch (err) {
        console.error(`Failed to update spreadsheet ${spreadsheetId}:`, err);
      }
    }
  }
}
