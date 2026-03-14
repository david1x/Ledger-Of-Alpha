"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function MarketOverviewWidget() {
  const [data, setData] = useState<IndexData[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/market-overview");
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-xs dark:text-slate-500 text-slate-400">
        Unable to load market data
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-xs dark:text-slate-500 text-slate-400">
        Loading...
      </div>
    );
  }

  // Overall sentiment based on majority direction
  const upCount = data.filter(d => d.changePercent > 0.1).length;
  const downCount = data.filter(d => d.changePercent < -0.1).length;
  const sentiment = upCount > downCount ? "Bullish" : downCount > upCount ? "Bearish" : "Mixed";
  const sentimentColor = sentiment === "Bullish" ? "text-emerald-400" : sentiment === "Bearish" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Sentiment header */}
      <div className="flex items-center justify-center gap-2 pb-1.5 border-b dark:border-slate-700/50 border-slate-200">
        {sentiment === "Bullish" ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : sentiment === "Bearish" ? (
          <TrendingDown className="w-4 h-4 text-red-400" />
        ) : (
          <Minus className="w-4 h-4 text-yellow-400" />
        )}
        <span className={`text-sm font-bold ${sentimentColor}`}>{sentiment}</span>
      </div>

      {/* Index rows */}
      {data.map((idx) => {
        const isUp = idx.change >= 0;
        return (
          <div key={idx.symbol} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold dark:text-slate-200 text-slate-800 truncate">
                {idx.name}
              </div>
              <div className="text-[11px] dark:text-slate-500 text-slate-400">
                {idx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-xs font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                {isUp ? "+" : ""}{idx.changePercent.toFixed(2)}%
              </div>
              <div className={`text-[11px] ${isUp ? "text-emerald-400/70" : "text-red-400/70"}`}>
                {isUp ? "+" : ""}{idx.change.toFixed(2)}
              </div>
            </div>
          </div>
        );
      })}

      <div className="text-[10px] dark:text-slate-600 text-slate-400 text-center mt-0.5">
        Major US Indices
      </div>
    </div>
  );
}
