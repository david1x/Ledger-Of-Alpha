"use client";

import { useMemo } from "react";
import { Trade } from "@/lib/types";
import { discoverInsights, Insight } from "@/lib/insight-engine";
import { Sparkles, TrendingUp, TrendingDown, AlertCircle, Info } from "lucide-react";

interface Props {
  trades: Trade[];
}

export default function AIInsightsWidget({ trades }: Props) {
  const insights = useMemo(() => discoverInsights(trades), [trades]);

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-center p-4">
        <Sparkles className="w-8 h-8 dark:text-slate-600 text-slate-400 mb-2" />
        <p className="text-sm dark:text-slate-500 text-slate-400">
          Analyze more trades to unlock AI-driven insights. 
          <br />
          <span className="text-[10px] mt-1 block opacity-70">(Minimum 10 closed trades required)</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      {insights.map((insight, i) => (
        <InsightCard key={i} insight={insight} />
      ))}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const config = {
    success: {
      bg: "dark:bg-emerald-500/10 bg-emerald-50",
      border: "dark:border-emerald-500/20 border-emerald-200",
      icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
      text: "text-emerald-500",
      titleColor: "dark:text-emerald-400 text-emerald-600"
    },
    danger: {
      bg: "dark:bg-red-500/10 bg-red-50",
      border: "dark:border-red-500/20 border-red-200",
      icon: <TrendingDown className="w-4 h-4 text-red-500" />,
      text: "text-red-500",
      titleColor: "dark:text-red-400 text-red-600"
    },
    warning: {
      bg: "dark:bg-amber-500/10 bg-amber-50",
      border: "dark:border-amber-500/20 border-amber-200",
      icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
      text: "text-amber-500",
      titleColor: "dark:text-amber-400 text-amber-600"
    },
    info: {
      bg: "dark:bg-blue-500/10 bg-blue-50",
      border: "dark:border-blue-500/20 border-blue-200",
      icon: <Info className="w-4 h-4 text-blue-500" />,
      text: "text-blue-500",
      titleColor: "dark:text-blue-400 text-blue-600"
    }
  }[insight.type];

  return (
    <div className={`p-3 rounded-xl border ${config.bg} ${config.border} flex gap-3 transition-all hover:scale-[1.01]`}>
      <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center dark:bg-slate-900/50 bg-white shadow-sm`}>
        {config.icon}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={`text-xs font-bold ${config.titleColor}`}>{insight.title}</h4>
          <span className="text-[10px] uppercase font-black dark:text-slate-500 text-slate-400 px-1.5 py-0.5 rounded bg-white/10 border border-current opacity-30">
            {insight.category}
          </span>
        </div>
        <p className="text-xs dark:text-slate-300 text-slate-600 leading-relaxed">
          {insight.description}
        </p>
      </div>
    </div>
  );
}
