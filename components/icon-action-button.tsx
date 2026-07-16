"use client";

type Variant = "neutral" | "brand" | "danger";

const variantClass: Record<Variant, string> = {
  neutral:
    "text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  brand: "text-brand hover:border-brand/40 hover:bg-brand/10",
  danger:
    "text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40",
};

const activeVariantClass: Record<Variant, string> = {
  neutral: "border-zinc-400 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
  brand: "border-brand bg-brand/10 text-brand",
  danger: "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40",
};

const baseClass =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-sm transition-colors disabled:opacity-40 dark:border-zinc-700";

export function IconActionButton({
  icon,
  label,
  onClick,
  href,
  variant = "neutral",
  active = false,
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: Variant;
  active?: boolean;
  disabled?: boolean;
}) {
  const className = `${baseClass} ${active ? activeVariantClass[variant] : variantClass[variant]}`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        aria-label={label}
        className={className}
      >
        {icon}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={className}
    >
      {icon}
    </button>
  );
}
