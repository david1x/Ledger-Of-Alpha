"use client";
import { useEffect, useState } from "react";
import { Cable, Wallet, RefreshCw, CheckCircle, Save, X, AlertTriangle, SkipForward } from "lucide-react";
import clsx from "clsx";
import { INPUT, LABEL, HINT } from "@/components/settings/types";
import { useAccounts } from "@/lib/account-context";

interface SyncResult {
  ibkrAccountId: string;
  ledgerAccountId: string;
  newCount: number;
  dupCount: number;
  errCount: number;
  error?: string;
}

export default function BrokerTab() {
  const { accounts } = useAccounts();

  const [ibkrHost, setIbkrHost] = useState("127.0.0.1");
  const [ibkrPort, setIbkrPort] = useState("4001");
  const [ibkrClientId, setIbkrClientId] = useState("0");
  const [ibkrConnectionStatus, setIbkrConnectionStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [ibkrConnectionError, setIbkrConnectionError] = useState<string | null>(null);
  const [ibkrDiscoveredAccounts, setIbkrDiscoveredAccounts] = useState<Array<{ id: string; type: string }>>([]);
  const [ibkrAccountMappings, setIbkrAccountMappings] = useState<Array<{ ibkrAccountId: string; ledgerAccountId: string }>>([]);
  const [ibkrLastSync, setIbkrLastSync] = useState<string | null>(null);
  const [ibkrLastSyncStatus, setIbkrLastSyncStatus] = useState<string | null>(null);
  const [ibkrSyncing, setIbkrSyncing] = useState(false);
  const [ibkrSyncResults, setIbkrSyncResults] = useState<SyncResult[] | null>(null);
  const [ibkrSyncDateRange, setIbkrSyncDateRange] = useState<"7d" | "30d" | "custom">("7d");
  const [ibkrSyncCustomStart, setIbkrSyncCustomStart] = useState("");
  const [ibkrSyncCustomEnd, setIbkrSyncCustomEnd] = useState("");
  const [ibkrTesting, setIbkrTesting] = useState(false);
  const [ibkrMappingsSaving, setIbkrMappingsSaving] = useState(false);
  const [ibkrMappingsSaved, setIbkrMappingsSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.ibkr_host) setIbkrHost(data.ibkr_host);
        if (data.ibkr_port) setIbkrPort(data.ibkr_port);
        if (data.ibkr_client_id) setIbkrClientId(data.ibkr_client_id);
        if (data.ibkr_account_mappings) {
          try {
            setIbkrAccountMappings(JSON.parse(data.ibkr_account_mappings));
          } catch {
            /* ignore */
          }
        }
        if (data.ibkr_last_sync) setIbkrLastSync(data.ibkr_last_sync);
        if (data.ibkr_last_sync_status) setIbkrLastSyncStatus(data.ibkr_last_sync_status);
      });
  }, []);

  return (
    <>
      {/* Sync Results Modal */}
      {ibkrSyncResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold dark:text-white text-slate-900 text-lg">Sync Results</h2>
              <button
                onClick={() => setIbkrSyncResults(null)}
                className="p-1.5 rounded-lg hover:dark:bg-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 dark:text-slate-400 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3">
              {ibkrSyncResults.map((r, i) => {
                const acct = accounts.find((a) => a.id === r.ledgerAccountId);
                const acctName = acct?.name ?? r.ibkrAccountId;
                return (
                  <div
                    key={i}
                    className="rounded-xl border dark:border-slate-700 border-slate-200 p-4 space-y-2"
                  >
                    <div className="font-medium dark:text-white text-slate-900 text-sm">
                      {acctName}
                    </div>
                    {r.error ? (
                      <p className="text-xs text-red-400">{r.error}</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {r.newCount} new trade{r.newCount !== 1 ? "s" : ""} imported
                          </span>
                        </div>
                        {r.dupCount > 0 && (
                          <div className="flex items-center gap-2 text-xs dark:text-slate-400 text-slate-500">
                            <SkipForward className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {r.dupCount} duplicate{r.dupCount !== 1 ? "s" : ""} skipped
                            </span>
                          </div>
                        )}
                        {r.errCount > 0 && (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {r.errCount} error{r.errCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t dark:border-slate-700 border-slate-200 text-xs dark:text-slate-400 text-slate-500">
              Total: {ibkrSyncResults.reduce((s, r) => s + r.newCount, 0)} new trades imported,{" "}
              {ibkrSyncResults.reduce((s, r) => s + r.dupCount, 0)} duplicates skipped
            </div>
            <button
              onClick={() => setIbkrSyncResults(null)}
              className="w-full px-4 py-2 rounded-lg dark:bg-slate-800 bg-slate-100 dark:text-slate-200 text-slate-700 text-sm font-medium hover:dark:bg-slate-700 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Section A: TWS / IB Gateway Connection */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <Cable className="w-4 h-4 text-blue-400" /> TWS / IB Gateway Connection
        </h2>
        <p className="text-xs dark:text-slate-400 text-slate-500">
          Connect to TWS or IB Gateway running on your machine via the socket API.
        </p>

        {/* Setup Guide - collapsible */}
        <details className="rounded-lg border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50">
          <summary className="px-4 py-2.5 text-sm font-medium dark:text-slate-300 text-slate-700 cursor-pointer hover:dark:text-white hover:text-slate-900 transition-colors select-none">
            How to enable the API in TWS / IB Gateway
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-3 text-xs dark:text-slate-400 text-slate-500 leading-relaxed">
            <p className="font-medium dark:text-slate-300 text-slate-600">
              In TWS (Trader Workstation):
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Open{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">
                  Edit &rarr; Global Configuration
                </span>{" "}
                (or{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">
                  File &rarr; Global Configuration
                </span>{" "}
                on some versions).
              </li>
              <li>
                Navigate to{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">
                  API &rarr; Settings
                </span>{" "}
                in the left sidebar.
              </li>
              <li>
                Check{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">
                  &quot;Enable ActiveX and Socket Clients&quot;
                </span>{" "}
                (if not already checked).
              </li>
              <li>
                Note the{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">Socket port</span>{" "}
                number (default:{" "}
                <code className="px-1.5 py-0.5 rounded dark:bg-slate-700 bg-slate-200 dark:text-slate-300 text-slate-600 font-mono text-[11px]">
                  7496
                </code>{" "}
                for TWS live,{" "}
                <code className="px-1.5 py-0.5 rounded dark:bg-slate-700 bg-slate-200 dark:text-slate-300 text-slate-600 font-mono text-[11px]">
                  7497
                </code>{" "}
                for TWS paper).
              </li>
              <li>
                Click{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">Apply</span> and{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">OK</span>.
              </li>
            </ol>
            <p className="font-medium dark:text-slate-300 text-slate-600 mt-2">
              In IB Gateway (headless):
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Open{" "}
                <span className="font-medium dark:text-slate-300 text-slate-700">
                  Configure &rarr; Settings &rarr; API &rarr; Settings
                </span>
                .
              </li>
              <li>
                The default port is{" "}
                <code className="px-1.5 py-0.5 rounded dark:bg-slate-700 bg-slate-200 dark:text-slate-300 text-slate-600 font-mono text-[11px]">
                  4001
                </code>{" "}
                (live) or{" "}
                <code className="px-1.5 py-0.5 rounded dark:bg-slate-700 bg-slate-200 dark:text-slate-300 text-slate-600 font-mono text-[11px]">
                  4002
                </code>{" "}
                (paper).
              </li>
            </ol>
            <div className="rounded-md dark:bg-slate-700/50 bg-slate-200/50 px-3 py-2 mt-1">
              <p className="font-medium dark:text-slate-300 text-slate-600 mb-1">Good to know:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>TWS or IB Gateway must be running for the connection to work.</li>
                <li>
                  The{" "}
                  <span className="font-medium dark:text-slate-300 text-slate-700">
                    Master API client ID
                  </span>{" "}
                  field in TWS can be left at default &mdash; use Client ID{" "}
                  <code className="px-1 py-0.5 rounded dark:bg-slate-700 bg-slate-200 font-mono text-[11px]">
                    0
                  </code>{" "}
                  below to receive all order updates.
                </li>
                <li>
                  If{" "}
                  <span className="font-medium dark:text-slate-300 text-slate-700">
                    &quot;Read-Only API&quot;
                  </span>{" "}
                  is checked, the connection will work but order placement will be blocked (fine for
                  syncing trades and viewing positions).
                </li>
                <li>
                  Execution history via the socket API is limited to the current day (up to 7 days
                  with TWS settings). For older trades, import via CSV.
                </li>
              </ul>
            </div>
          </div>
        </details>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={LABEL}>Host</label>
              <input
                type="text"
                value={ibkrHost}
                onChange={(e) => setIbkrHost(e.target.value)}
                placeholder="127.0.0.1"
                className={INPUT}
              />
            </div>
            <div className="col-span-1">
              <label className={LABEL}>Port</label>
              <input
                type="number"
                value={ibkrPort}
                onChange={(e) => setIbkrPort(e.target.value)}
                placeholder="4001"
                className={INPUT}
              />
            </div>
            <div className="col-span-1">
              <label className={LABEL}>Client ID</label>
              <input
                type="number"
                value={ibkrClientId}
                onChange={(e) => setIbkrClientId(e.target.value)}
                placeholder="0"
                className={INPUT}
              />
            </div>
          </div>
          <p className={HINT}>
            Default ports: IB Gateway live <strong>4001</strong> / paper <strong>4002</strong>{" "}
            &bull; TWS live <strong>7496</strong> / paper <strong>7497</strong>
          </p>
          <div className="flex items-center gap-3">
            {ibkrConnectionStatus === "connected" && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Connected
              </span>
            )}
            {ibkrConnectionStatus === "disconnected" && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 shrink-0">
                <span className="w-2 h-2 rounded-full bg-red-400" /> Disconnected
              </span>
            )}
          </div>
          {ibkrConnectionError && (
            <p className="text-xs text-red-400">{ibkrConnectionError}</p>
          )}
          <button
            onClick={async () => {
              setIbkrTesting(true);
              setIbkrConnectionStatus("unknown");
              setIbkrConnectionError(null);
              await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ibkr_host: ibkrHost,
                  ibkr_port: ibkrPort,
                  ibkr_client_id: ibkrClientId,
                }),
              });
              const res = await fetch("/api/broker/ibkr/status").catch(() => null);
              if (!res || !res.ok) {
                setIbkrConnectionStatus("disconnected");
                setIbkrConnectionError(
                  "Could not connect. Check that TWS or IB Gateway is running and API connections are enabled."
                );
                setIbkrTesting(false);
                return;
              }
              const data = await res.json();
              if (data.connected) {
                setIbkrConnectionStatus("connected");
                if (data.accounts) {
                  const discovered = data.accounts.map((id: string) => ({
                    id,
                    type: "account",
                  }));
                  setIbkrDiscoveredAccounts(discovered);
                  setIbkrAccountMappings((prev) => {
                    const existing = new Set(prev.map((m) => m.ibkrAccountId));
                    const news = discovered
                      .filter((a: { id: string }) => !existing.has(a.id))
                      .map((a: { id: string }) => ({
                        ibkrAccountId: a.id,
                        ledgerAccountId: "",
                      }));
                    return [...prev, ...news];
                  });
                }
              } else {
                setIbkrConnectionStatus("disconnected");
                setIbkrConnectionError(data.error ?? "Connection failed.");
              }
              setIbkrTesting(false);
            }}
            disabled={ibkrTesting || !ibkrHost || !ibkrPort}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 text-sm font-medium hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${ibkrTesting ? "animate-spin" : ""}`} />
            {ibkrTesting ? "Testing..." : "Test Connection"}
          </button>
        </div>
      </section>

      {/* Section B: Account Mapping */}
      {ibkrDiscoveredAccounts.length > 0 && (
        <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-400" /> Account Mapping
          </h2>
          <p className="text-xs dark:text-slate-400 text-slate-500">
            Link each IBKR sub-account to a Ledger of Alpha account. Only mapped accounts will sync
            trades.
          </p>
          <div className="border dark:border-slate-700 border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700 border-slate-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">
                    IBKR Account
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">
                    Ledger Account
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700/50 divide-slate-100">
                {ibkrDiscoveredAccounts.map((ibkrAcct) => {
                  const mapping = ibkrAccountMappings.find(
                    (m) => m.ibkrAccountId === ibkrAcct.id
                  );
                  return (
                    <tr key={ibkrAcct.id}>
                      <td className="px-4 py-3 font-mono text-xs dark:text-slate-300 text-slate-700">
                        {ibkrAcct.id}
                      </td>
                      <td className="px-4 py-3 text-xs dark:text-slate-400 text-slate-500 capitalize">
                        {ibkrAcct.type}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={mapping?.ledgerAccountId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setIbkrAccountMappings((prev) => {
                              const filtered = prev.filter(
                                (m) => m.ibkrAccountId !== ibkrAcct.id
                              );
                              if (val)
                                return [
                                  ...filtered,
                                  { ibkrAccountId: ibkrAcct.id, ledgerAccountId: val },
                                ];
                              return filtered;
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— Not mapped —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {mapping?.ledgerAccountId && (
                          <button
                            onClick={() =>
                              setIbkrAccountMappings((prev) =>
                                prev.filter((m) => m.ibkrAccountId !== ibkrAcct.id)
                              )
                            }
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            title="Unlink"
                          >
                            Unlink
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setIbkrMappingsSaving(true);
                await fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ibkr_account_mappings: JSON.stringify(ibkrAccountMappings),
                  }),
                });
                setIbkrMappingsSaving(false);
                setIbkrMappingsSaved(true);
                setTimeout(() => setIbkrMappingsSaved(false), 2500);
              }}
              disabled={ibkrMappingsSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {ibkrMappingsSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {ibkrMappingsSaved
                ? "Saved!"
                : ibkrMappingsSaving
                ? "Saving..."
                : "Save Mappings"}
            </button>
          </div>
        </section>
      )}

      {/* Section C: Trade Sync */}
      {ibkrAccountMappings.some((m) => m.ledgerAccountId) && (
        <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-4">
          <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400" /> Trade Sync
          </h2>
          <div className="space-y-3">
            <div>
              <label className={LABEL}>Date Range</label>
              <div className="flex items-center gap-2 flex-wrap">
                {(["7d", "30d", "custom"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setIbkrSyncDateRange(range)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      ibkrSyncDateRange === range
                        ? "bg-blue-600 text-white"
                        : "border dark:border-slate-600 border-slate-300 dark:text-slate-300 text-slate-700 hover:dark:bg-slate-800 hover:bg-slate-50"
                    )}
                  >
                    {range === "7d" ? "Last 7 Days" : range === "30d" ? "Last 30 Days" : "Custom"}
                  </button>
                ))}
              </div>
            </div>
            {ibkrSyncDateRange === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Start Date</label>
                  <input
                    type="date"
                    value={ibkrSyncCustomStart}
                    onChange={(e) => setIbkrSyncCustomStart(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>End Date</label>
                  <input
                    type="date"
                    value={ibkrSyncCustomEnd}
                    onChange={(e) => setIbkrSyncCustomEnd(e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>
            )}
            <button
              onClick={async () => {
                setIbkrSyncing(true);
                const body: Record<string, string> = { dateRange: ibkrSyncDateRange };
                if (ibkrSyncDateRange === "custom") {
                  if (ibkrSyncCustomStart) body.startDate = ibkrSyncCustomStart;
                  if (ibkrSyncCustomEnd) body.endDate = ibkrSyncCustomEnd;
                }
                const res = await fetch("/api/broker/ibkr/sync", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }).catch(() => null);
                setIbkrSyncing(false);
                if (!res || !res.ok) {
                  const errData = res ? await res.json().catch(() => ({})) : {};
                  setIbkrLastSyncStatus("error: " + (errData.error ?? "Sync failed"));
                  setIbkrLastSync(new Date().toISOString());
                  return;
                }
                const data = await res.json();
                setIbkrSyncResults(data.results ?? []);
                setIbkrLastSync(data.syncedAt ?? new Date().toISOString());
                setIbkrLastSyncStatus("success");
              }}
              disabled={ibkrSyncing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${ibkrSyncing ? "animate-spin" : ""}`} />
              {ibkrSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </section>
      )}

      {/* Section D: Sync Status */}
      <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-3">
        <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-blue-400" /> Sync Status
        </h2>
        {ibkrLastSync ? (
          <div className="space-y-2">
            <p className="text-sm dark:text-slate-300 text-slate-700">
              Last synced:{" "}
              <span className="font-medium">
                {new Date(ibkrLastSync).toLocaleString()}
              </span>
            </p>
            {ibkrLastSyncStatus && (
              <p
                className={clsx(
                  "text-xs font-medium",
                  ibkrLastSyncStatus === "success" ? "text-emerald-400" : "text-red-400"
                )}
              >
                {ibkrLastSyncStatus === "success" ? "Success" : ibkrLastSyncStatus}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm dark:text-slate-400 text-slate-500">No sync performed yet.</p>
        )}
      </section>
    </>
  );
}
