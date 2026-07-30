/**
 * Small inline spinner for "AI is working" states — a plain CSS animation
 * (Tailwind's built-in animate-spin), not a static "..." label or an
 * external GIF asset, so it visibly keeps moving while a request is in
 * flight instead of looking like the page might have stalled.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-3px] ${className}`}
      aria-hidden
    />
  );
}
