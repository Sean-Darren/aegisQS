import { Link } from "@/i18n/navigation";
export function SectionPlaceholder({
  label,
  message,
  action,
  href,
}: {
  label: string;
  message: string;
  action: string;
  href: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel p-8">
      <h1 className="text-2xl font-semibold">{label}</h1>
      <p className="mt-3 text-muted-ink">{message}</p>
      <Link
        href={href}
        className="mt-6 inline-block rounded-sm text-clay-800 underline focus-visible:outline-2 focus-visible:outline-clay-600"
      >
        {action}
      </Link>
    </section>
  );
}
