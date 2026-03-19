"use client";
import { useEffect, useState } from "react";
import { Wallet, RefreshCw, Trash2, Plus } from "lucide-react";
import clsx from "clsx";
import { useAccounts } from "@/lib/account-context";
import type { Account } from "@/lib/types";

export default function AccountsTab() {
  const { accounts, refreshAccounts } = useAccounts();
  const [acctEdits, setAcctEdits] = useState<Record<string, Partial<Account>>>({});
  const [acctSaving, setAcctSaving] = useState<string | null>(null);
  const [acctDeleting, setAcctDeleting] = useState<string | null>(null);
  const [newAcctName, setNewAcctName] = useState("");
  const [acctPnls, setAcctPnls] = useState<Record<string, number>>({});

  // Load per-account P&L
  useEffect(() => {
    if (accounts.length === 0) return;
    Promise.all(
      accounts.map(async (acct) => {
        const res = await fetch(`/api/trades?account_id=${acct.id}`);
        if (!res.ok) return { id: acct.id, pnl: 0 };
        const trades = await res.json();
        const pnl = Array.isArray(trades)
          ? trades
              .filter((t: { status: string; pnl?: number }) => t.status === "closed")
              .reduce((s: number, t: { pnl?: number }) => s + (t.pnl ?? 0), 0)
          : 0;
        return { id: acct.id, pnl };
      })
    ).then((results) => {
      const map: Record<string, number> = {};
      for (const r of results) map[r.id] = r.pnl;
      setAcctPnls(map);
    });
  }, [accounts]);

  const addAccount = async () => {
    if (!newAcctName.trim()) return;
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAcctName.trim() }),
    });
    setNewAcctName("");
    await refreshAccounts();
  };

  return (
    <section className="rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white p-5 space-y-5">
      <h2 className="font-semibold dark:text-white text-slate-900 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-emerald-400" /> Manage Accounts
      </h2>
      <p className="text-sm dark:text-slate-400 text-slate-500">
        Create multiple accounts (e.g. Main, Paper Trading, Futures) with separate balances and
        trade histories.
      </p>

      {/* Existing accounts */}
      <div className="space-y-3">
        {accounts.map((acct) => {
          const edits = acctEdits[acct.id] ?? {};
          const name = edits.name ?? acct.name;
          const startBal = edits.starting_balance ?? acct.starting_balance;
          const risk = edits.risk_per_trade ?? acct.risk_per_trade;
          const comm = edits.commission_value ?? acct.commission_value;
          const pnl = acctPnls[acct.id] ?? 0;
          const currentBal = startBal + pnl;
          const hasChanges = Object.keys(edits).length > 0;

          return (
            <div
              key={acct.id}
              className="p-4 rounded-xl border dark:border-slate-700 border-slate-200 dark:bg-slate-800/50 bg-slate-50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setAcctEdits((prev) => ({
                        ...prev,
                        [acct.id]: { ...prev[acct.id], name: e.target.value },
                      }))
                    }
                    className="bg-transparent font-semibold dark:text-white text-slate-900 border-b border-transparent hover:border-slate-600 focus:border-emerald-500 outline-none text-sm"
                  />
                  {acct.is_default === 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <button
                      disabled={acctSaving === acct.id}
                      onClick={async () => {
                        setAcctSaving(acct.id);
                        await fetch(`/api/accounts/${acct.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(edits),
                        });
                        setAcctEdits((prev) => {
                          const n = { ...prev };
                          delete n[acct.id];
                          return n;
                        });
                        await refreshAccounts();
                        setAcctSaving(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {acctSaving === acct.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </button>
                  )}
                  {accounts.length > 1 && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${acct.name}" and all its trades?`)) return;
                        setAcctDeleting(acct.id);
                        await fetch(`/api/accounts/${acct.id}`, { method: "DELETE" });
                        await refreshAccounts();
                        setAcctDeleting(null);
                      }}
                      disabled={acctDeleting === acct.id}
                      className="p-1.5 rounded-lg hover:dark:bg-red-500/10 hover:bg-red-50 text-red-400 transition-colors disabled:opacity-50"
                      title="Delete account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-medium dark:text-slate-500 text-slate-400 mb-1 uppercase tracking-wider">
                    Starting Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={startBal}
                    onChange={(e) =>
                      setAcctEdits((prev) => ({
                        ...prev,
                        [acct.id]: {
                          ...prev[acct.id],
                          starting_balance: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:bg-slate-700 bg-white dark:text-white text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium dark:text-slate-500 text-slate-400 mb-1 uppercase tracking-wider">
                    Risk %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={risk}
                    onChange={(e) =>
                      setAcctEdits((prev) => ({
                        ...prev,
                        [acct.id]: {
                          ...prev[acct.id],
                          risk_per_trade: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:bg-slate-700 bg-white dark:text-white text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium dark:text-slate-500 text-slate-400 mb-1 uppercase tracking-wider">
                    Commission
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={comm}
                    onChange={(e) =>
                      setAcctEdits((prev) => ({
                        ...prev,
                        [acct.id]: {
                          ...prev[acct.id],
                          commission_value: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border dark:border-slate-600 border-slate-300 dark:bg-slate-700 bg-white dark:text-white text-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium dark:text-slate-500 text-slate-400 mb-1 uppercase tracking-wider">
                    Current Balance
                  </label>
                  <div
                    className={clsx(
                      "px-2.5 py-1.5 rounded-lg text-sm font-semibold",
                      currentBal >= startBal ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    $
                    {currentBal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new account */}
      <div className="flex items-center gap-3 pt-2 border-t dark:border-slate-700 border-slate-200">
        <input
          type="text"
          placeholder="New account name..."
          value={newAcctName}
          onChange={(e) => setNewAcctName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newAcctName.trim()) {
              addAccount();
            }
          }}
          className="flex-1 px-3 py-2 rounded-lg border dark:border-slate-600 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm"
        />
        <button
          onClick={addAccount}
          disabled={!newAcctName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>
    </section>
  );
}
