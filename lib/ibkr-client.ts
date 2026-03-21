import Database from "better-sqlite3";
import { IBApiNext, ConnectionState, ExecutionFilter } from "@stoqey/ib";
import type { Position } from "@stoqey/ib";
import { firstValueFrom, filter, take, timeout, catchError, of } from "rxjs";

// ── Singleton IB connection ──────────────────────────────────────────────

let ibClient: IBApiNext | null = null;
let currentHost = "";
let currentPort = 0;
let currentClientId = 0;

/**
 * Get or create the singleton IB API connection.
 * Reconnects if host/port/clientId changed.
 */
export function getIBClient(host: string, port: number, clientId = 0): IBApiNext {
  if (ibClient && (currentHost !== host || currentPort !== port || currentClientId !== clientId)) {
    ibClient.disconnect();
    ibClient = null;
  }

  if (!ibClient) {
    ibClient = new IBApiNext({ host, port });
    ibClient.connect(clientId);
    currentHost = host;
    currentPort = port;
    currentClientId = clientId;
  }

  return ibClient;
}

/**
 * Wait for the connection to be established (up to timeoutMs).
 * Returns true if connected, false if timed out.
 */
export async function waitForConnection(ib: IBApiNext, timeoutMs = 5000): Promise<boolean> {
  if (ib.isConnected) return true;

  try {
    await firstValueFrom(
      ib.connectionState.pipe(
        filter(s => s === ConnectionState.Connected),
        take(1),
        timeout(timeoutMs),
      )
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Disconnect and clear the singleton.
 */
export function disconnectIB(): void {
  if (ibClient) {
    ibClient.disconnect();
    ibClient = null;
  }
}

// ── Execution interface (mapped from IB response) ────────────────────────

export interface MappedExecution {
  execId: string;
  symbol: string;
  side: "long" | "short";
  shares: number;
  price: number;
  time: string;
  commission: number;
  account: string;
  exchange: string;
}

// ── Position interface ───────────────────────────────────────────────────

export interface MappedPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  account: string;
  conId: number;
}

// ── Settings helper ──────────────────────────────────────────────────────

export interface IbkrAccountMapping {
  ibkrAccountId: string;
  ledgerAccountId: string;
}

export interface IbkrSettings {
  host: string;
  port: number;
  clientId: number;
  accountMappings: IbkrAccountMapping[];
}

/**
 * Read IBKR settings from the per-user settings table.
 */
export function getIbkrSettings(db: Database.Database, userId: string): IbkrSettings {
  const getSetting = db.prepare(
    "SELECT value FROM settings WHERE user_id = ? AND key = ?"
  );

  const hostRow = getSetting.get(userId, "ibkr_host") as { value: string } | undefined;
  const portRow = getSetting.get(userId, "ibkr_port") as { value: string } | undefined;
  const clientIdRow = getSetting.get(userId, "ibkr_client_id") as { value: string } | undefined;
  const mappingsRow = getSetting.get(userId, "ibkr_account_mappings") as { value: string } | undefined;

  const host = hostRow?.value || "127.0.0.1";
  const port = portRow?.value ? parseInt(portRow.value, 10) : 4001;
  const clientId = clientIdRow?.value ? parseInt(clientIdRow.value, 10) : 0;

  let accountMappings: IbkrAccountMapping[] = [];
  if (mappingsRow?.value) {
    try {
      accountMappings = JSON.parse(mappingsRow.value);
    } catch {
      accountMappings = [];
    }
  }

  return { host, port, clientId, accountMappings };
}

// ── Side normalization ───────────────────────────────────────────────────

export function mapSide(side: string): "long" | "short" {
  const normalized = side.toUpperCase();
  if (["B", "BOT", "BUY"].includes(normalized)) return "long";
  if (["S", "SLD", "SELL"].includes(normalized)) return "short";
  return "long";
}

// ── Helper: get executions ───────────────────────────────────────────────

export async function getExecutions(
  ib: IBApiNext,
  acctCode: string,
  sinceTime?: string,
): Promise<MappedExecution[]> {
  const execFilter: ExecutionFilter = {
    clientId: "",
    acctCode,
    time: sinceTime ?? "",
    symbol: "",
    exchange: "",
    side: "",
  };

  const details = await Promise.race([
    ib.getExecutionDetails(execFilter),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Execution request timed out after 15s")), 15000)
    ),
  ]);

  return details.map(d => ({
    execId: d.execution.execId ?? "",
    symbol: d.contract.symbol ?? "",
    side: mapSide(d.execution.side ?? ""),
    shares: d.execution.shares ?? 0,
    price: d.execution.price ?? 0,
    time: d.execution.time ?? "",
    commission: 0,
    account: d.execution.acctNumber ?? acctCode,
    exchange: d.execution.exchange ?? "",
  }));
}

// ── Helper: get positions ────────────────────────────────────────────────

export async function getPositions(ib: IBApiNext): Promise<MappedPosition[]> {
  const posUpdate = await firstValueFrom(
    ib.getPositions().pipe(
      take(1),
      timeout(10000),
      catchError(() => of(undefined)),
    )
  );

  if (!posUpdate) return [];

  const result: MappedPosition[] = [];
  if (posUpdate.all) {
    posUpdate.all.forEach((positions: Position[], account: string) => {
      positions.forEach((pos: Position) => {
        result.push({
          symbol: pos.contract.symbol ?? "",
          quantity: pos.pos,
          avgCost: pos.avgCost ?? 0,
          account,
          conId: pos.contract.conId ?? 0,
        });
      });
    });
  }

  return result;
}

// ── Helper: get managed accounts ─────────────────────────────────────────

export async function getManagedAccounts(ib: IBApiNext): Promise<string[]> {
  return ib.getManagedAccounts();
}
