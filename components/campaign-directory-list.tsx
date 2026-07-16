import Image from "next/image";
import { Link } from "@/i18n/navigation";

export function CampaignDirectoryList({
  campaigns,
  joinLabel,
  emptyLabel,
}: {
  campaigns: {
    slug: string;
    name: string;
    prizeInfo: string;
    prizes: { id: string; name: string; imagePath: string | null }[];
  }[];
  joinLabel: string;
  emptyLabel: string;
}) {
  if (campaigns.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {campaigns.map((c) => (
        <div
          key={c.slug}
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {c.name}
          </h3>
          <p className="mt-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
            {c.prizeInfo}
          </p>

          {c.prizes.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {c.prizes.map((p) => (
                <div
                  key={p.id}
                  className="flex w-16 shrink-0 flex-col items-center text-center"
                >
                  {p.imagePath ? (
                    <Image
                      src={p.imagePath}
                      alt={p.name}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-brand/10 to-accent/10 text-xl">
                      🏆
                    </div>
                  )}
                  <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-zinc-600 dark:text-zinc-400">
                    {p.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Link
            href={`/commercial/${c.slug}`}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            {joinLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}
