export default function TradingViewIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 52 32"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* T — top bar + vertical stem */}
      <path d="M0 0h20v7H13v25H7V7H0z" />
      {/* Dot between T and V */}
      <circle cx="26" cy="4" r="3.5" />
      {/* V slash */}
      <path d="M32 0h10L29 32h-2z" />
    </svg>
  );
}
