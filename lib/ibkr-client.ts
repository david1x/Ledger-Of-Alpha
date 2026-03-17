import Database from "better-sqlite3";
import { Agent } from "undici";

// ── IBKR Data Interfaces ─────────────────────────────────────────────────

export interface IbkrExecution {
  execution_id: string;
  symbol: string;
  side: string;
  size: number;
  price: number;
  trade_time: string;
  commission: number;
  account: string;
  exchange: string;
  net_amount: number;
}

export interface IbkrPosition {
  ticker: string;
  position: number;
  unrealizedPnl: number;
  realizedPnl: number;
  mktPrice: number;
  mktValue: number;
  currency: string;
  avgPrice: number;
  conid: number;
}

// ── Gateway HTTP wrapper ─────────────────────────────────────────────────

/**
 * Fetch from the IBKR Client Portal gateway.
 * Prepends /v1/api to all paths.
 * When sslVerify is false, uses undici Agent with rejectUnauthorized: false
 * (needed for self-signed gateway certs in local environments).
 */
export async function ibkrFetch(
  gatewayUrl: string,
  path: string,
  sslVerify: boolean,
  init?: RequestInit
): Promise<Response> {
  const url = `${gatewayUrl.replace(/\/$/, "")}/v1/api${path}`;

  if (!sslVerify) {
    const agent = new Agent({ connect: { rejectUnauthorized: false } });
    // @ts-expect-error — dispatcher is undici-specific
    return fetch(url, { ...init, dispatcher: agent });
  }

  return fetch(url, init);
}

// ── Settings helper ──────────────────────────────────────────────────────

export interface IbkrAccountMapping {
  ibkrAccountId: string;
  ledgerAccountId: string;
}

export interface IbkrSettings {
  gatewayUrl: string;
  sslVerify: boolean;
  accountMappings: IbkrAccountMapping[];
}

/**
 * Read IBKR settings from the per-user settings table.
 * Returns safe defaults when settings are not configured.
 */
export function getIbkrSettings(db: Database.Database, userId: string): IbkrSettings {
  const getSetting = db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = ?"
  );

  const urlRow = getSetting.get(userId, "ibkr_gateway_url") as { value: string } | undefined;
  const sslRow = getSetting.get(userId, "ibkr_ssl_verify") as { value: string } | undefined;
  const mappingsRow = getSetting.get(userId, "ibkr_account_mappings") as { value: string } | undefined;

  const gatewayUrl = urlRow?.value ?? "";
  const sslVerify = sslRow?.value === "true";

  let accountMappings: IbkrAccountMapping[] = [];
  if (mappingsRow?.value) {
    try {
      accountMappings = JSON.parse(mappingsRow.value);
    } catch {
      accountMappings = [];
    }
  }

  return { gatewayUrl, sslVerify, accountMappings };
}

// ── Side normalization ───────────────────────────────────────────────────

/**
 * Normalize IBKR side codes to "long" | "short".
 * BOT/BUY/B = long; SLD/SELL/S = short.
 */
export function mapSide(side: string): "long" | "short" {
  const normalized = side.toUpperCase();
  if (["B", "BOT", "BUY"].includes(normalized)) return "long";
  if (["S", "SLD", "SELL"].includes(normalized)) return "short";
  return "long";
}
