"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface PrivacyContextValue {
  hidden: boolean;
  toggleHidden: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  hidden: false,
  toggleHidden: () => {},
});

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage synchronously to avoid flash of unmasked content
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("privacy_hidden");
    if (saved === "true") return true;
    if (saved === "false") return false;
    return false;
  });

  useEffect(() => {
    // Backward-compat fallback: if privacy_hidden was never set in localStorage,
    // check the server settings for a previously saved privacy_mode value.
    if (localStorage.getItem("privacy_hidden") === null) {
      fetch("/api/settings")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.privacy_mode) {
            setHidden(data.privacy_mode === "hidden");
          }
        })
        .catch(() => { /* silent */ });
    }

    // Cross-tab sync via StorageEvent
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "privacy_hidden") {
        setHidden(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden(prev => {
      const next = !prev;
      localStorage.setItem("privacy_hidden", String(next));
      return next;
    });
  }, []);

  return (
    <PrivacyContext.Provider value={{ hidden, toggleHidden }}>
      {children}
    </PrivacyContext.Provider>
  );
}
