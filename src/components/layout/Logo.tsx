/** FloorFlow mark: a home inside a 360° orbit ring. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="FloorFlow 360 logo">
      <defs>
        <linearGradient id="n360g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f5fd0" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#n360g)" />
      <ellipse cx="24" cy="26" rx="17" ry="7" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" transform="rotate(-18 24 26)" />
      <path d="M13.5 24.5 24 14l10.5 10.5V34a1.5 1.5 0 0 1-1.5 1.5H15a1.5 1.5 0 0 1-1.5-1.5Z" fill="#fff" />
      <path d="M21 35.5v-7a3 3 0 0 1 6 0v7Z" fill="#5b6fe0" />
      <circle cx="39.5" cy="19.5" r="2.6" fill="#fbbf24" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      Floor<span className="bg-gradient-to-r from-accent to-violet-500 bg-clip-text font-bold text-transparent">Flow</span><span className="ml-1 font-bold text-amber-500">360</span>
    </span>
  );
}
