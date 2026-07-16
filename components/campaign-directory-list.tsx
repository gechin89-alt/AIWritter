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
    prizeCountLabel?: string | null;
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
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {c.name}
            </h3>
            {c.prizeCountLabel && (
              <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                {c.prizeCountLabel}
              </span>
            )}
          </div>
          <p className="mt-2 flex-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
            {c.prizeInfo}
          </p>
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
