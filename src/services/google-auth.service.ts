import { google, sheets_v4 } from "googleapis";

import fs from "fs";
import path from "path";

export class GoogleAuthService {
  scopes: string[];

  constructor(opts?: { scopes?: string[]; credentialsJson?: string }) {
    this.scopes = opts?.scopes ?? ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"];
  }

  private loadCredentials(): string {
    const credsPath = process.env.GOOGLE_CREDENTIALS_PATH;

    if (!credsPath) {
      throw new Error("Google credentials not provided. Set GOOGLE_CREDENTIALS_PATH env var.");
    }

    const expanded = credsPath.startsWith("~") ? `${process.env.HOME}${credsPath.slice(1)}` : credsPath;

    const resolved = path.resolve(expanded);

    if (fs.existsSync(resolved)) {
      return fs.readFileSync(resolved, "utf8");
    }

    throw new Error(`Google credentials file not found at GOOGLE_CREDENTIALS_PATH=${credsPath}`);
  }

  async getSheetsClient(): Promise<sheets_v4.Sheets> {
    const credentials = JSON.parse(this.loadCredentials());
    console.log(this.scopes);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: this.scopes,
    });

    return google.sheets({ version: "v4", auth });
  }
}
