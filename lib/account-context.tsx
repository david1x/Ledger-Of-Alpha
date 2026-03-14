"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Account } from "./types";

interface AccountContextValue {
  accounts: Account[];
  activeAccountId: string | null; // null = "All Accounts"
  activeAccount: Account | null;
  setActiveAccountId: (id: string | null) => void;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue>({
  accounts: [],
  activeAccountId: null,
  activeAccount: null,
  setActiveAccountId: () => {},
  refreshAccounts: async () => {},
});

export function useAccounts() {
  return useContext(AccountContext);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAccounts(data);
      }
    } catch { /* silent */ }
  }, []);

  // Load from localStorage + fetch accounts on mount
  useEffect(() => {
    const saved = localStorage.getItem("active_account_id");
    if (saved && saved !== "null") {
      setActiveAccountIdState(saved);
    }
    setLoaded(true);
    refreshAccounts();
  }, [refreshAccounts]);

  // Validate that the saved active account still exists
  useEffect(() => {
    if (!loaded || accounts.length === 0) return;
    if (activeAccountId && !accounts.find(a => a.id === activeAccountId)) {
      // Account was deleted or doesn't exist — reset to All
      setActiveAccountIdState(null);
      localStorage.removeItem("active_account_id");
    }
  }, [accounts, activeAccountId, loaded]);

  const setActiveAccountId = useCallback((id: string | null) => {
    setActiveAccountIdState(id);
    if (id) {
      localStorage.setItem("active_account_id", id);
    } else {
      localStorage.removeItem("active_account_id");
    }
  }, []);

  const activeAccount = activeAccountId ? accounts.find(a => a.id === activeAccountId) ?? null : null;

  return (
    <AccountContext.Provider value={{ accounts, activeAccountId, activeAccount, setActiveAccountId, refreshAccounts }}>
      {children}
    </AccountContext.Provider>
  );
}
