"use client";
import { useEffect, useRef, useState, memo } from "react";
import { useTheme } from "next-themes";

interface Props {
  symbol?: string;
  interval?: string;
}

function TradingViewWidget({ symbol = "SPY", interval = "D" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";

    const isDark = resolvedTheme !== "light";
    const toolbarBg = isDark ? "#020617" : "#ffffff"; // Matches slate-950 and white

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    let studies = [];
    try {
      if (settings?.tv_studies) studies = JSON.parse(settings.tv_studies);
    } catch { /* ignore */ }

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: isDark ? "dark" : "light",
      style: "1",
      locale: "en",
      toolbar_bg: toolbarBg,
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: settings?.tv_hide_side_toolbar === "true",
      withdateranges: settings?.tv_withdateranges !== "false",
      details: settings?.tv_details === "true",
      hotlist: settings?.tv_hotlist === "true",
      calendar: settings?.tv_calendar === "true",
      studies: studies.length > 0 ? studies : undefined,
      support_host: "https://www.tradingview.com",
      save_image: true,
      enabled_features: [
        "use_localstorage_for_settings",
        "side_toolbar_in_fullscreen_mode",
        "countdown_visible",
        "display_market_status",
        "scales_context_menu",
        "legend_context_menu",
      ],
      disabled_features: [],
    });

    container.current.appendChild(script);
  }, [symbol, interval, resolvedTheme, settings]);

  return (
    <div
      className="tradingview-widget-container w-full h-full"
      ref={container}
      style={{ height: "100%" }}
    >
      <div
        className="tradingview-widget-container__widget"
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}

export default memo(TradingViewWidget);
