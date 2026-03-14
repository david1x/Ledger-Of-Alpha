import { Trade } from "./types";

export interface Insight {
  title: string;
  description: string;
  type: "success" | "warning" | "info" | "danger";
  score: number;
  category: string;
}

interface GroupStats {
  count: number;
  wins: number;
  grossProfit: number;
  grossLoss: number;
  pnl: number;
}

function calculateStats(trades: Trade[]): GroupStats {
  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let pnl = 0;

  for (const t of trades) {
    const val = t.pnl ?? 0;
    pnl += val;
    if (val > 0) {
      wins++;
      grossProfit += val;
    } else {
      grossLoss += Math.abs(val);
    }
  }

  return {
    count: trades.length,
    wins,
    grossProfit,
    grossLoss,
    pnl,
  };
}

export function discoverInsights(trades: Trade[]): Insight[] {
  const closed = trades.filter(t => t.status === "closed" && t.pnl != null);
  if (closed.length < 10) return [];

  const insights: Insight[] = [];

  // Helper for win rate and profit factor checks
  const analyzeGroup = (name: string, groupTrades: Trade[], category: string) => {
    if (groupTrades.length < 8) return;

    const stats = calculateStats(groupTrades);
    const winRate = (stats.wins / stats.count) * 100;
    const profitFactor = stats.grossLoss > 0 ? stats.grossProfit / stats.grossLoss : stats.grossProfit > 0 ? 10 : 0;

    if (winRate >= 65 && profitFactor >= 2.0) {
      insights.push({
        title: `High Edge Found: ${name}`,
        description: `Your "${name}" ${category} has a ${winRate.toFixed(0)}% win rate and ${profitFactor.toFixed(1)} profit factor over ${stats.count} trades.`,
        type: "success",
        score: winRate * profitFactor,
        category,
      });
    } else if (winRate <= 35 || (profitFactor < 0.8 && stats.count >= 10)) {
       insights.push({
        title: `Negative Edge: ${name}`,
        description: `Performance on "${name}" is significantly below average (${winRate.toFixed(0)}% WR, ${profitFactor.toFixed(1)} PF). Consider avoiding this ${category}.`,
        type: "danger",
        score: (100 - winRate) * (2 - profitFactor),
        category,
      });
    }
  };

  // 1. Analyze by Symbol
  const bySymbol = new Map<string, Trade[]>();
  closed.forEach(t => {
    const list = bySymbol.get(t.symbol) ?? [];
    list.push(t);
    bySymbol.set(t.symbol, list);
  });
  bySymbol.forEach((list, symbol) => analyzeGroup(symbol, list, "Symbol"));

  // 2. Analyze by Day of Week
  const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byDow = new Map<string, Trade[]>();
  closed.forEach(t => {
    const dateStr = t.entry_date ?? t.created_at.slice(0, 10);
    const dow = DOW_NAMES[new Date(dateStr + "T00:00:00").getDay()];
    const list = byDow.get(dow) ?? [];
    list.push(t);
    byDow.set(dow, list);
  });
  byDow.forEach((list, dow) => analyzeGroup(dow, list, "Day"));

  // 3. Analyze by Session (Roughly NY, London, Asia based on UTC/EST)
  // NY: 13:30 - 20:00 UTC (9:30 - 16:00 EST)
  const bySession = new Map<string, Trade[]>();
  closed.forEach(t => {
    const hour = new Date(t.created_at).getUTCHours();
    let session = "Other";
    if (hour >= 13 && hour <= 20) session = "NY Session";
    else if (hour >= 7 && hour <= 12) session = "London Session";
    else if (hour >= 0 && hour <= 6) session = "Asia Session";
    
    const list = bySession.get(session) ?? [];
    list.push(t);
    bySession.set(session, list);
  });
  bySession.forEach((list, session) => analyzeGroup(session, list, "Session"));

  // 4. Analyze by Tag
  const byTag = new Map<string, Trade[]>();
  closed.forEach(t => {
    if (!t.tags) return;
    t.tags.split(",").forEach(rawTag => {
      const tag = rawTag.trim();
      if (!tag) return;
      const list = byTag.get(tag) ?? [];
      list.push(t);
      byTag.set(tag, list);
    });
  });
  byTag.forEach((list, tag) => analyzeGroup(tag, list, "Setup"));

  // 5. Analyze by Direction
  const byDirection = new Map<string, Trade[]>();
  closed.forEach(t => {
    const list = byDirection.get(t.direction) ?? [];
    list.push(t);
    byDirection.set(t.direction, list);
  });
  byDirection.forEach((list, dir) => analyzeGroup(dir === "long" ? "Longs" : "Shorts", list, "Direction"));

  // 6. Mistakes analysis
  const mistakeCounts = new Map<string, number>();
  closed.forEach(t => {
    if (!t.mistakes) return;
    t.mistakes.split(",").forEach(m => {
       const mistake = m.trim();
       if (!mistake) return;
       mistakeCounts.set(mistake, (mistakeCounts.get(mistake) ?? 0) + 1);
    });
  });

  mistakeCounts.forEach((count, mistake) => {
    if (count >= 5) {
      insights.push({
        title: `Recurring Leak: ${mistake}`,
        description: `You've identified "${mistake}" as a mistake in ${count} trades. Eliminating this could save significant capital.`,
        type: "warning",
        score: count * 10,
        category: "Habit",
      });
    }
  });

  // Sort by score descending
  return insights.sort((a, b) => b.score - a.score);
}
