"use client";
import { AnalysisResult } from "@/lib/ai-vision";

interface Props {
  result: AnalysisResult;
}

export default function PatternResults({ result }: Props) {
  const getBarColor = (confidence: number) => {
    if (confidence >= 0.7) return "bg-emerald-500";
    if (confidence >= 0.4) return "bg-yellow-500";
    return "bg-amber-600";
  };

  return (
    <div className="space-y-3">
      {result.summary && (
        <p className="text-xs italic dark:text-slate-400 text-slate-500 leading-relaxed">
          {result.summary}
        </p>
      )}

      <div className="space-y-3">
        {result.patterns.map((pattern, idx) => {
          const isPrimary = pattern.name === result.primary_pattern;
          return (
            <div
              key={idx}
              className={`rounded-lg p-3 dark:bg-slate-800/50 bg-slate-100/50 ${
                isPrimary ? "border-l-2 border-emerald-500 pl-2.5" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold dark:text-white text-slate-900">
                  {pattern.name}
                  {isPrimary && (
                    <span className="ml-2 text-[10px] font-normal text-emerald-500 uppercase tracking-wider">
                      Primary
                    </span>
                  )}
                </span>
                <span className="text-xs font-mono dark:text-slate-300 text-slate-600">
                  {Math.round(pattern.confidence * 100)}%
                </span>
              </div>

              {/* Confidence bar */}
              <div className="w-full h-1.5 rounded-full dark:bg-slate-700 bg-slate-200 mb-2">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(pattern.confidence)}`}
                  style={{ width: `${Math.round(pattern.confidence * 100)}%` }}
                />
              </div>

              {pattern.description && (
                <p className="text-xs dark:text-slate-400 text-slate-500 leading-relaxed">
                  {pattern.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
