"use client";
import { useEffect, useRef, memo } from "react";
import { useTheme } from "next-themes";

interface Props {
  symbol?: string;
  interval?: string;
}

function TradingViewWidget({ symbol = "NASDAQ:AAPL", interval = "D" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "America/New_York",
      theme: resolvedTheme === "light" ? "light" : "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
      withdateranges: true,
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
  }, [symbol, interval, resolvedTheme]);

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
