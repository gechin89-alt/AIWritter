export function SplashScreen({
  onEnter,
  closing,
  ctaLabel,
  brand,
  tagline,
}: {
  onEnter: () => void;
  closing?: boolean;
  ctaLabel: string;
  brand: string;
  tagline: string;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        closing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div
        className="animate-gradient-flow absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(120deg, var(--brand), var(--accent), var(--brand-dark), var(--accent-dark))",
        }}
      />
      <div className="animate-float-slow absolute -left-16 top-10 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
      <div
        className="animate-float-slower absolute right-0 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="animate-float-slow absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-white/15 blur-3xl"
        style={{ animationDelay: "2s" }}
      />

      <div className="relative z-10 flex flex-col items-center px-6 text-center text-white">
        <p className="animate-fade-in-up text-4xl font-bold tracking-tight sm:text-5xl">
          ✨ {brand} ✨
        </p>
        <p
          className="animate-fade-in-up mt-4 max-w-md text-base text-white/90 sm:text-lg"
          style={{ animationDelay: "0.15s" }}
        >
          {tagline}
        </p>
        <button
          onClick={onEnter}
          className="animate-enter-button mt-8 rounded-full bg-white px-8 py-3 text-sm font-semibold text-brand shadow-lg transition-transform hover:scale-105"
        >
          {ctaLabel} →
        </button>
      </div>
    </div>
  );
}
