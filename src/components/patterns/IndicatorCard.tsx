import type { ComponentType, ReactNode } from "react";

export function IndicatorCard({
  icon: IconCmp,
  label,
  value,
  tone = "neutral",
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: ReactNode;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneColor = {
    neutral: "var(--stayo-ink)",
    warning: "var(--stayo-warning)",
    danger: "var(--stayo-danger)",
    success: "var(--stayo-success)",
  }[tone];

  return (
    <div className="rounded-[var(--radius-card)] border bg-card p-4 shadow-[var(--shadow-card)]" style={{ borderColor: "var(--stayo-border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase text-muted-foreground">
          {label}
        </p>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
        >
          <IconCmp size={15} />
        </span>
      </div>
      <p
        className="mt-2 font-display text-3xl font-semibold"
        style={{ color: toneColor }}
      >
        {value}
      </p>
    </div>
  );
}

/** Grupo de botões tipo pílula para filtro de período (7d/14d/30d). */
export function PeriodFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="inline-flex rounded-[var(--radius-control)] border p-0.5 text-sm"
      style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-surface)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 font-medium transition-colors ${active ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
