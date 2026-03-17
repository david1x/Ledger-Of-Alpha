"use client";

import { useEffect, useState, useCallback } from "react";
import { Trade, TradeStrategy } from "@/lib/types";
import { useAccounts } from "@/lib/account-context";
import RiskSimulator from "@/components/dashboard/RiskSimulator";
import AIInsightsWidget from "@/components/dashboard/AIInsightsWidget";
import DistributionChart from "@/components/dashboard/DistributionChart";
import ComparisonWidget from "@/components/dashboard/ComparisonWidget";
import PatternPerformance from "@/components/ai/PatternPerformance";
import ScreenshotUploader from "@/components/ai/ScreenshotUploader";
import { TrendingUp, Shield, BarChart3, BrainCircuit, RefreshCw } from "lucide-react";
import clsx from "clsx";

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [strategies, setStrategies] = useState<TradeStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeAccountId, activeAccount, accounts } = useAccounts();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tradesUrl = activeAccountId ? `/api/trades?account_id=${activeAccountId}` : "/api/trades";
      const [tradesRes, settingsRes] = await Promise.all([
        fetch(tradesUrl),
        fetch("/api/settings"),
      ]);
      const tradesData = await tradesRes.json();
      const settingsData = await settingsRes.json();

      if (Array.isArray(tradesData)) setTrades(tradesData);
      if (settingsData.strategies) {
        try { setStrategies(JSON.parse(settingsData.strategies)); } catch {}
      }
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  const closed = trades.filter(t => t.status === "closed" && t.pnl != null);
  const startingBalance = activeAccount ? activeAccount.starting_balance : (accounts.reduce((sum, a) => sum + a.starting_balance, 0) || 10000);

  const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <div className="flex items-center gap-2 mb-6">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-emerald-500" />
      </div>
      <h2 className="text-lg font-bold dark:text-white text-slate-900">{title}</h2>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-8 md:space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h1 className="text-2xl md:text-3xl font-black dark:text-white text-slate-900 tracking-tight">Advanced Analytics</h1>
          <p className="dark:text-slate-400 text-slate-500 mt-1 text-sm md:text-base font-medium">Deep insights and risk modeling for your trading strategy.</p>
        </div>
        <button onClick={load} className="p-1.5 sm:p-2 rounded-xl hover:dark:bg-slate-800 hover:bg-slate-100 transition-colors shadow-sm border dark:border-slate-800 border-slate-200 shrink-0" aria-label="Refresh data">
          <RefreshCw className={clsx("w-4 h-4 sm:w-5 sm:h-5 dark:text-slate-400 text-slate-500", loading && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
        {/* Risk Simulation */}
        <section className="dark:bg-slate-900/50 bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-700 delay-150 fill-mode-both">
          <SectionHeader title="Monte Carlo Risk Simulator" icon={Shield} />
          <RiskSimulator trades={closed} startingBalance={startingBalance} />
        </section>

        {/* AI Insights */}
        <section className="dark:bg-slate-900/50 bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-700 delay-300 fill-mode-both">
          <SectionHeader title="AI Edge Discovery" icon={BrainCircuit} />
          <AIInsightsWidget trades={closed} />
        </section>
      </div>

      {/* Distribution Analysis */}
      <section className="dark:bg-slate-900/50 bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-700 delay-500 fill-mode-both">
        <SectionHeader title="Performance Distributions" icon={BarChart3} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-6 md:gap-8">
          <div className="h-[250px] sm:h-[280px]">
            <DistributionChart trades={closed} type="weekday" title="By Day of Week" />
          </div>
          <div className="h-[250px] sm:h-[280px]">
            <DistributionChart trades={closed} type="hour" title="By Hour of Day" />
          </div>
          <div className="h-[250px] sm:h-[280px]">
            <DistributionChart trades={closed} type="month" title="By Month" />
          </div>
        </div>
      </section>

      {/* Strategy Breakdown */}
      <section className="dark:bg-slate-900/50 bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-700 delay-700 fill-mode-both">
        <SectionHeader title="Strategy Deep Dive" icon={TrendingUp} />
        <div className="h-[400px]">
          <ComparisonWidget trades={closed} strategies={strategies} />
        </div>
      </section>

      {/* AI Pattern Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 animate-in fade-in slide-in-from-top-2 duration-700 delay-1000 fill-mode-both">
        {/* Pattern Performance */}
        <section className="dark:bg-slate-900/50 bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
          <SectionHeader title="Pattern Performance" icon={BrainCircuit} />
          <p className="text-xs dark:text-slate-400 text-slate-500 -mt-4 mb-5">
            Win rate and P&L stats grouped by AI-detected chart patterns
          </p>
          <PatternPerformance trades={trades} />
        </section>

        {/* Screenshot Upload */}
        <section className="dark:bg-slate-900/50 bg-white border dark:border-slate-800 border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
          <SectionHeader title="Analyze Chart Screenshot" icon={BrainCircuit} />
          <p className="text-xs dark:text-slate-400 text-slate-500 -mt-4 mb-5">
            Upload a chart screenshot to detect patterns and link to an existing trade
          </p>
          <ScreenshotUploader trades={trades} onTradeLinked={() => load()} />
        </section>
      </div>
    </div>
  );
}
