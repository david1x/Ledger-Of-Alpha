"use client";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import clsx from "clsx";
import DrawdownCalculator from "@/components/tools/DrawdownCalculator";
import KellyCalculator from "@/components/tools/KellyCalculator";
import FibCalculator from "@/components/tools/FibCalculator";
import RRCalculator from "@/components/tools/RRCalculator";
import GrowthCalculator from "@/components/tools/GrowthCalculator";
import CorrelationMatrix from "@/components/tools/CorrelationMatrix";

const TABS = [
  { id: "rr",          label: "Risk / Reward" },
  { id: "growth",      label: "Compound Growth" },
  { id: "drawdown",    label: "Drawdown Recovery" },
  { id: "kelly",       label: "Kelly Criterion" },
  { id: "fibonacci",   label: "Fibonacci Levels" },
  { id: "correlation", label: "Correlation Matrix" },
];

function ToolsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") ?? "rr";

  const setTab = (id: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("tab", id);
    router.push(`/tools?${params.toString()}`);
  };

  return (
    <div className="flex-1 min-h-screen dark:bg-slate-950 bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold dark:text-white text-slate-900 mb-6">Trading Tools</h1>

        {/* Tab bar */}
        <div className="border-b dark:border-slate-800 border-slate-200 mb-6">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  tab === id
                    ? "border-emerald-400 text-emerald-400"
                    : "border-transparent dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="dark:bg-slate-900 bg-white rounded-xl border dark:border-slate-800 border-slate-200 p-6">
          {tab === "rr"          && <RRCalculator />}
          {tab === "growth"      && <GrowthCalculator />}
          {tab === "drawdown"    && <DrawdownCalculator />}
          {tab === "kelly"       && <KellyCalculator />}
          {tab === "fibonacci"   && <FibCalculator />}
          {tab === "correlation" && <CorrelationMatrix />}
        </div>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  return (
    <Suspense fallback={<div className="p-6 dark:text-slate-400 text-slate-500">Loading...</div>}>
      <ToolsContent />
    </Suspense>
  );
}
