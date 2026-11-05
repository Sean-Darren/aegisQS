import type { ReactNode } from "react";
export function SummaryCard({
  label,
  value,
  context,
  children,
}: {
  label: string;
  value: ReactNode;
  context?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <h2 className="text-sm text-muted-ink">{label}</h2>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      {context && <p className="mt-2 text-xs text-muted-ink">{context}</p>}
      {children}
    </section>
  );
}
