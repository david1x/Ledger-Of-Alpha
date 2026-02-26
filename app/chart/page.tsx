"use client";
import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Camera, Send, CheckCircle, AlertCircle } from "lucide-react";

const TradingViewWidget = dynamic(() => import("@/components/TradingViewWidget"), { ssr: false });

const INTERVALS = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

export default function ChartPage() {
  const [interval, setChartInterval] = useState("D");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "capturing" | "sending" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [countdown, setCountdown] = useState<null | 3 | 2 | 1>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureAndSend = useCallback(async () => {
    if (!chartRef.current) return;
    setStatus("capturing");
    setStatusMsg("Grant screen access…");

    // Step 1: ask for permission first — browser popup appears here, before countdown.
    // After the user clicks "Share", the popup closes and we start the countdown
    // so they have time to move the mouse off the chart before grabFrame() fires.
    let stream: MediaStream;
    try {
      stream = await (navigator.mediaDevices.getDisplayMedia as (
        opts: MediaStreamConstraints & { preferCurrentTab?: boolean }
      ) => Promise<MediaStream>)({
        video: true,
        audio: false,
        preferCurrentTab: true,
      });
    } catch (e: unknown) {
      setStatus("error");
      setStatusMsg(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Permission denied."
          : String(e),
      );
      return;
    }

    const [track] = stream.getVideoTracks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageCapture = new (window as any).ImageCapture(track);

    // Step 2: countdown — user moves mouse away from chart area
    await new Promise<void>((resolve) => {
      setCountdown(3);
      let tick = 3;
      countdownRef.current = setInterval(() => {
        tick--;
        if (tick === 0) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setCountdown(null);
          resolve();
        } else {
          setCountdown(tick as 3 | 2 | 1);
        }
      }, 1000);
    });

    // Step 3: grab frame — cursor should be off the chart by now
    setStatusMsg("Capturing…");
    try {
      const bitmap: ImageBitmap = await imageCapture.grabFrame();
      track.stop();
      stream.getTracks().forEach((t) => t.stop());

      const rect = chartRef.current!.getBoundingClientRect();
      const scaleX = bitmap.width  / document.documentElement.clientWidth;
      const scaleY = bitmap.height / document.documentElement.clientHeight;

      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(rect.width  * scaleX);
      canvas.height = Math.round(rect.height * scaleY);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        bitmap,
        Math.round(rect.left  * scaleX), Math.round(rect.top    * scaleY),
        Math.round(rect.width * scaleX), Math.round(rect.height * scaleY),
        0, 0, canvas.width, canvas.height,
      );

      const imageData = canvas.toDataURL("image/png");
      setStatus("sending");
      setStatusMsg("Sending to Discord…");

      const res = await fetch("/api/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, message }),
      });

      if (res.ok) {
        setStatus("success");
        setStatusMsg("Sent!");
        setTimeout(() => { setStatus("idle"); setStatusMsg(""); }, 3000);
      } else {
        const data = await res.json();
        setStatus("error");
        setStatusMsg(data.error ?? "Failed to send.");
      }
    } catch (e: unknown) {
      track.stop();
      stream.getTracks().forEach((t) => t.stop());
      setStatus("error");
      setStatusMsg(String(e));
    }
  }, [message]);

  return (
    <div className="fixed left-0 right-0 bottom-0 flex flex-col" style={{ top: "56px" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-950 bg-white shrink-0">
        {/* Intervals */}
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setChartInterval(iv.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                interval === iv.value
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "dark:text-slate-400 text-slate-600 hover:dark:bg-slate-800 hover:bg-slate-100 border dark:border-slate-700 border-slate-200"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Status */}
        {statusMsg && (
          <span className={`text-xs ${
            status === "error"   ? "text-red-400" :
            status === "success" ? "text-emerald-400" : "dark:text-slate-400 text-slate-500"
          }`}>
            {statusMsg}
          </span>
        )}

        {/* Optional Discord note */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Note for Discord…"
          className="px-2.5 py-1 text-xs rounded border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-40"
        />

        {/* Snapshot button */}
        <button
          onClick={captureAndSend}
          disabled={countdown !== null || status === "capturing" || status === "sending"}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {countdown !== null       && <span className="w-4 h-4 flex items-center justify-center font-bold text-sm">{countdown}</span>}
          {countdown === null && status === "capturing" && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {countdown === null && status === "sending"   && <Send className="w-3.5 h-3.5" />}
          {countdown === null && status === "success"   && <CheckCircle className="w-3.5 h-3.5" />}
          {countdown === null && status === "error"     && <AlertCircle className="w-3.5 h-3.5" />}
          {countdown === null && status === "idle"      && <Camera className="w-3.5 h-3.5" />}
          <span>{countdown !== null ? `${countdown}… move mouse away` : "Snapshot → Discord"}</span>
        </button>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="flex-1 min-h-0">
        <TradingViewWidget interval={interval} />
      </div>
    </div>
  );
}
