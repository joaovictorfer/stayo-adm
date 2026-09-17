import type { ComponentType, ReactNode } from "react";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

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
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
          {label}
        </p>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}
        >
          <IconCmp size={15} />
        </span>
      </div>
      <p
        className="mt-2 text-3xl"
        style={{ fontFamily: "var(--stayo-font-display)", color: toneColor }}
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
            className="rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 transition-colors"
            style={{
              backgroundColor: active ? "var(--stayo-forest)" : "transparent",
              color: active ? "#fdfdfb" : "var(--stayo-ink-muted)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
