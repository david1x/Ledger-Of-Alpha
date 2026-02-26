interface Props {
  className?: string;
}

export default function Logo({ className = "w-7 h-7" }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Candle 1 — short bullish */}
      <line x1="7" y1="19.5" x2="7" y2="21.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="21.5" width="6" height="5" rx="1" fill="#10b981" />
      <line x1="7" y1="26.5" x2="7" y2="28.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />

      {/* Candle 2 — medium bullish */}
      <line x1="16" y1="12.5" x2="16" y2="14.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="13" y="14.5" width="6" height="8.5" rx="1" fill="#10b981" />
      <line x1="16" y1="23" x2="16" y2="25" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />

      {/* Candle 3 — tall bullish, brighter green */}
      <line x1="25" y1="4.5" x2="25" y2="6.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="22" y="6.5" width="6" height="13" rx="1" fill="#34d399" />
      <line x1="25" y1="19.5" x2="25" y2="21.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />

      {/* Trend line connecting candle tops */}
      <line x1="4" y1="24" x2="28" y2="8" stroke="#6ee7b7" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 2" opacity="0.5" />
    </svg>
  );
}
