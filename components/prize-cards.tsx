import Image from "next/image";

export function PrizeCards({
  prizes,
  title,
}: {
  prizes: {
    id: string;
    name: string;
    description: string | null;
    imagePath: string | null;
    qty?: number | null;
  }[];
  title: string;
}) {
  if (prizes.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {prizes.map((p) => (
          <div
            key={p.id}
            className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="relative h-24 w-full">
              {p.imagePath ? (
                <Image
                  src={p.imagePath}
                  alt={p.name}
                  fill
                  sizes="150px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-brand/10 to-accent/10 text-2xl">
                  🏆
                </div>
              )}
              {Boolean(p.qty) && (
                <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  ×{p.qty}
                </span>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                {p.name}
              </p>
              {p.description && (
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {p.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
