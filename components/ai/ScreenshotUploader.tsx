"use client";
import { useState, useRef, useCallback } from "react";
import { BrainCircuit, X, RefreshCw, Link as LinkIcon } from "lucide-react";
import { Trade } from "@/lib/types";
import { AnalysisResult, QAEntry } from "@/lib/ai-vision";
import PatternResults from "./PatternResults";
import FollowUpChat from "./FollowUpChat";

interface Props {
  trades: Trade[];
  onTradeLinked?: (tradeId: number, analysis: AnalysisResult, screenshots: string[], qaHistory: QAEntry[]) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ScreenshotUploader({ trades, onTradeLinked }: Props) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [qaHistory, setQaHistory] = useState<QAEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [linkedTradeId, setLinkedTradeId] = useState<number | null>(null);
  const [linkingTradeId, setLinkingTradeId] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [patternHint, setPatternHint] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearState = useCallback((revokePreview = true) => {
    if (revokePreview && preview) URL.revokeObjectURL(preview);
    setPendingFile(null);
    setPreview(null);
    setUploadedFilename(null);
    setAnalysisResult(null);
    setQaHistory([]);
    setLinkedTradeId(null);
    setLinkingTradeId("");
    setLinkSuccess(null);
    setPatternHint(null);
    setError(null);
  }, [preview]);

  const validateFile = (file: File): string | null => {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) return "Only PNG, JPEG, or WebP images are allowed.";
    if (file.size > 5 * 1024 * 1024) return "File size must be under 5 MB.";
    return null;
  };

  const handleFileSelect = (file: File) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    const objectUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPreview(objectUrl);
    setUploadedFilename(null);
    setAnalysisResult(null);
    setQaHistory([]);
    setLinkedTradeId(null);
    setLinkingTradeId("");
    setLinkSuccess(null);
    setPatternHint(null);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  const handleRemove = async () => {
    if (uploadedFilename) {
      try {
        await fetch(`/api/screenshots/${encodeURIComponent(uploadedFilename)}`, { method: "DELETE" });
      } catch { /* ignore - best effort */ }
    }
    clearState();
  };

  const handleAnalyze = async () => {
    if (!pendingFile) return;
    setError(null);
    setAnalysisResult(null);
    setQaHistory([]);
    setPatternHint(null);

    // Step 1: Upload file
    setUploading(true);
    let filename: string;
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const uploadRes = await fetch("/api/screenshots", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error ?? "Upload failed.");
        setUploading(false);
        return;
      }
      filename = uploadData.filename;
      setUploadedFilename(filename);
    } catch {
      setError("Upload failed. Please try again.");
      setUploading(false);
      return;
    } finally {
      setUploading(false);
    }

    // Step 2: Analyze
    setAnalyzing(true);
    try {
      const analyzeRes = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        if (analyzeData.code === "NO_API_KEY") {
          setError("NO_API_KEY");
        } else {
          setError(analyzeData.details ? `${analyzeData.error}: ${analyzeData.details}` : (analyzeData.error ?? "Analysis failed."));
        }
        return;
      }

      const result: AnalysisResult = analyzeData;
      setAnalysisResult(result);

      // Fetch pattern history hint
      if (result.primary_pattern) {
        try {
          const hintRes = await fetch(`/api/trades?ai_pattern=${encodeURIComponent(result.primary_pattern)}`);
          if (hintRes.ok) {
            const hintData = await hintRes.json();
            const matchingTrades: Trade[] = hintData.trades ?? hintData ?? [];
            if (Array.isArray(matchingTrades) && matchingTrades.length > 0) {
              const wins = matchingTrades.filter(t => (t.pnl ?? 0) > 0).length;
              const winRate = Math.round((wins / matchingTrades.length) * 100);
              setPatternHint(`You've traded ${result.primary_pattern} ${matchingTrades.length} time${matchingTrades.length !== 1 ? "s" : ""} (${winRate}% win rate).`);
            }
          }
        } catch { /* pattern hint is best-effort */ }
      }
    } catch {
      setError("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLinkTrade = async () => {
    if (!linkingTradeId || !analysisResult || !uploadedFilename) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${linkingTradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_patterns: JSON.stringify(analysisResult),
          ai_screenshots: JSON.stringify([uploadedFilename]),
          ai_qa_history: JSON.stringify(qaHistory),
          ai_primary_pattern: analysisResult.primary_pattern,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to link trade.");
        return;
      }
      const tradeId = parseInt(linkingTradeId);
      setLinkedTradeId(tradeId);
      const trade = trades.find(t => t.id === tradeId);
      setLinkSuccess(`Linked to ${trade?.symbol ?? "trade"}`);
      onTradeLinked?.(tradeId, analysisResult, [uploadedFilename], qaHistory);
    } catch {
      setError("Failed to link trade. Please try again.");
    } finally {
      setLinking(false);
    }
  };

  const isAnalyzed = analysisResult !== null;

  return (
    <div className="space-y-3">
      {/* Upload zone or preview */}
      {!pendingFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? "dark:border-emerald-500 border-emerald-400 dark:bg-emerald-900/10 bg-emerald-50"
              : "dark:border-slate-600 border-slate-300 hover:dark:border-slate-500 hover:border-slate-400 dark:bg-slate-800/30 bg-slate-50"
          }`}
        >
          <BrainCircuit className="w-8 h-8 mx-auto mb-2 dark:text-slate-500 text-slate-400" />
          <p className="text-xs dark:text-slate-400 text-slate-500">
            Drop chart screenshot or click to upload
          </p>
          <p className="text-[10px] dark:text-slate-600 text-slate-400 mt-1">
            PNG, JPEG, WebP — max 5 MB
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Thumbnail + file info */}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Chart screenshot preview"
              className="w-full max-h-48 object-contain rounded-lg dark:bg-slate-800 bg-slate-100"
            />
          )}
          <div className="flex items-center justify-between text-xs dark:text-slate-400 text-slate-500">
            <span className="truncate max-w-[60%]">{pendingFile.name}</span>
            <span>{formatFileSize(pendingFile.size)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!isAnalyzed ? (
              <button
                onClick={handleAnalyze}
                disabled={uploading || analyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
              >
                {(uploading || analyzing) ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BrainCircuit className="w-3.5 h-3.5" />
                )}
                {uploading ? "Uploading..." : analyzing ? "Analyzing..." : "Analyze"}
              </button>
            ) : (
              <button
                onClick={() => {
                  setAnalysisResult(null);
                  setQaHistory([]);
                  setUploadedFilename(null);
                  setLinkedTradeId(null);
                  setLinkSuccess(null);
                  setPatternHint(null);
                  handleAnalyze();
                }}
                disabled={uploading || analyzing}
                title="Re-analyzing clears Q&A history"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg dark:bg-slate-700 bg-slate-200 dark:text-slate-200 text-slate-700 hover:dark:bg-slate-600 hover:bg-slate-300 text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? "animate-spin" : ""}`} />
                Re-analyze
              </button>
            )}
            <button
              onClick={handleRemove}
              disabled={uploading || analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:dark:bg-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Error messages */}
      {error && error !== "NO_API_KEY" && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {error === "NO_API_KEY" && (
        <p className="text-xs text-amber-400">
          Gemini API key not configured.{" "}
          <a href="/settings?tab=integrations" className="underline hover:text-amber-300">
            Add it in Settings
          </a>
          .
        </p>
      )}

      {/* Pattern results */}
      {analysisResult && (
        <div className="space-y-3 pt-1 border-t dark:border-slate-700 border-slate-200">
          <PatternResults result={analysisResult} />

          {/* Pattern history hint */}
          {patternHint && (
            <div className="px-3 py-2 rounded-lg dark:bg-slate-800/50 bg-slate-100/50 text-xs dark:text-slate-400 text-slate-500">
              {patternHint}{" "}
              <a href="/analytics" className="text-emerald-500 hover:text-emerald-400 underline">
                View analytics
              </a>
            </div>
          )}

          {/* Follow-up chat */}
          {uploadedFilename && (
            <div className="pt-2 border-t dark:border-slate-700 border-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-500 text-slate-400 mb-2">
                Ask Follow-up
              </p>
              <FollowUpChat
                filename={uploadedFilename}
                priorAnalysis={analysisResult}
                qaHistory={qaHistory}
                onQAUpdate={setQaHistory}
              />
            </div>
          )}

          {/* Trade linking */}
          {trades.length > 0 && (
            <div className="pt-2 border-t dark:border-slate-700 border-slate-200 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider dark:text-slate-500 text-slate-400">
                Link to Trade
              </p>
              {linkedTradeId ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                  <LinkIcon className="w-3.5 h-3.5" />
                  {linkSuccess ?? "Linked"}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={linkingTradeId}
                    onChange={(e) => setLinkingTradeId(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg border dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="">Select a trade...</option>
                    {trades.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.symbol} — {t.entry_date ?? t.created_at?.slice(0, 10) ?? "Unknown date"}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleLinkTrade}
                    disabled={!linkingTradeId || linking}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-40 shrink-0"
                  >
                    {linking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                    Link
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
