"use client";
import { X } from "lucide-react";
import { TradeFilterState, DEFAULT_FILTER } from "@/lib/types";

interface Props {
  filter: TradeFilterState;
  onClear: (field: keyof TradeFilterState) => void;
  onClearAll: () => void;
  accounts?: { id: string; name: string }[];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Chip {
  label: string;
  field: keyof TradeFilterState;
}

export default function TradeFilterChips({ filter, onClear, onClearAll, accounts }: Props) {
  const chips: Chip[] = [];

  if (filter.symbol !== DEFAULT_FILTER.symbol) {
    chips.push({ label: `Symbol: ${filter.symbol}`, field: "symbol" });
  }
  if (filter.status !== DEFAULT_FILTER.status) {
    chips.push({ label: `Status: ${capitalize(filter.status)}`, field: "status" });
  }
  if (filter.direction !== DEFAULT_FILTER.direction) {
    chips.push({ label: `Direction: ${capitalize(filter.direction)}`, field: "direction" });
  }
  if (filter.pnlFilter !== DEFAULT_FILTER.pnlFilter) {
    chips.push({
      label: filter.pnlFilter === "winners" ? "Winners only" : "Losers only",
      field: "pnlFilter",
    });
  }
  if (filter.dateFrom !== DEFAULT_FILTER.dateFrom) {
    chips.push({ label: `From: ${filter.dateFrom}`, field: "dateFrom" });
  }
  if (filter.dateTo !== DEFAULT_FILTER.dateTo) {
    chips.push({ label: `To: ${filter.dateTo}`, field: "dateTo" });
  }
  if (filter.mistakeId !== DEFAULT_FILTER.mistakeId) {
    chips.push({ label: "Mistake filter", field: "mistakeId" });
  }
  if (filter.tags.length > 0) {
    const label = filter.tags.length <= 3
      ? `Tags: ${filter.tags.join(", ")}`
      : `Tags: ${filter.tags.length} selected`;
    chips.push({ label, field: "tags" });
  }
  if (filter.accountId) {
    const acctName = accounts?.find(a => a.id === filter.accountId)?.name ?? "Account";
    chips.push({ label: `Account: ${acctName}`, field: "accountId" });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
      {chips.map((chip) => (
        <span
          key={chip.field}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        >
          {chip.label}
          <button
            onClick={() => onClear(chip.field)}
            className="hover:text-white transition-colors"
            aria-label={`Clear ${chip.field} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-slate-400 hover:text-white underline transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
