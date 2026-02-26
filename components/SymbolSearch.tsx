"use client";
import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (symbol: string) => void;
  placeholder?: string;
}

interface SymbolOption {
  symbol: string;
  name: string;
  market_cap: number;
}

function fmtCap(cap: number) {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  return `$${(cap / 1e6).toFixed(0)}M`;
}

export default function SymbolSearch({ value, onChange, placeholder = "Search symbol..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SymbolOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = (q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setResults(data);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const select = (s: SymbolOption) => {
    setQuery(s.symbol);
    onChange(s.symbol);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setQuery(v);
            onChange(v);
            search(v);
          }}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 rounded-lg border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-60 overflow-y-auto rounded-lg border dark:border-slate-700 border-slate-200 dark:bg-slate-900 bg-white shadow-xl">
          {results.map((s) => (
            <button
              key={s.symbol}
              onClick={() => select(s)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:dark:bg-slate-800 hover:bg-slate-50 transition-colors"
            >
              <div>
                <span className="font-bold text-emerald-400 text-sm">{s.symbol}</span>
                <span className="ml-2 text-xs dark:text-slate-400 text-slate-500 truncate max-w-[180px] inline-block align-bottom">{s.name}</span>
              </div>
              <span className="text-xs dark:text-slate-500 text-slate-400 ml-2 shrink-0">{fmtCap(s.market_cap)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
