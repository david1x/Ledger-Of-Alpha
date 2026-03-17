"use client";
import { useState, useRef, useEffect } from "react";
import { Send, BrainCircuit } from "lucide-react";
import { AnalysisResult, QAEntry } from "@/lib/ai-vision";

const QUICK_CHIPS = [
  "Supply/Demand Zones",
  "Support/Resistance Levels",
  "Trend Direction",
];

interface Props {
  filename: string;
  priorAnalysis: AnalysisResult;
  qaHistory: QAEntry[];
  onQAUpdate: (history: QAEntry[]) => void;
}

export default function FollowUpChat({ filename, priorAnalysis, qaHistory, onQAUpdate }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qaHistory]);

  const sendQuestion = async (question: string) => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setInput("");

    try {
      const res = await fetch("/api/ai/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, question: question.trim(), priorAnalysis }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to get answer.");
        return;
      }

      const entry: QAEntry = {
        question: question.trim(),
        answer: data.answer,
        ts: new Date().toISOString(),
        screenshotFilename: filename,
      };

      onQAUpdate([...qaHistory, entry]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(input);
    }
  };

  return (
    <div className="space-y-3">
      {/* Quick chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => sendQuestion(chip)}
            disabled={loading}
            className="rounded-full px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 dark:text-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Q&A history */}
      {qaHistory.length > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {qaHistory.map((entry, idx) => (
            <div key={idx} className="space-y-1.5">
              {/* Question - right aligned */}
              <div className="flex justify-end">
                <div className="max-w-[85%] px-3 py-2 rounded-lg bg-emerald-900/30 dark:text-emerald-200 text-emerald-800 text-xs leading-relaxed">
                  {entry.question}
                </div>
              </div>
              {/* Answer - left aligned */}
              <div className="flex items-start gap-2">
                <BrainCircuit className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs dark:text-slate-300 text-slate-600 leading-relaxed">
                  {entry.answer}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-2">
              <BrainCircuit className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex gap-1 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Loading spinner when no history yet */}
      {loading && qaHistory.length === 0 && (
        <div className="flex items-center gap-2 py-2">
          <BrainCircuit className="w-3.5 h-3.5 dark:text-slate-500 text-slate-400 animate-pulse" />
          <span className="text-xs dark:text-slate-400 text-slate-500">Thinking...</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Freeform input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this chart..."
          disabled={loading}
          className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50"
        />
        <button
          onClick={() => sendQuestion(input)}
          disabled={loading || !input.trim()}
          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
