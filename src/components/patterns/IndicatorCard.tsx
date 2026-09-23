import type { ComponentType, ReactNode } from "react";
import { AdminStatCard } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";

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
  return <AdminStatCard icon={IconCmp} label={label} value={value} tone={tone} />;
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
    <div className="inline-flex rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0.5 text-sm">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Button
            key={o.value}
            type="button"
            variant="ghost"
            onClick={() => onChange(o.value)}
            className={`h-7 rounded-[calc(var(--admin-radius)-2px)] px-3 text-xs ${active ? "bg-[var(--admin-primary)] text-[var(--primary-foreground)] hover:bg-[var(--admin-primary-hover)] hover:text-[var(--primary-foreground)]" : "text-[var(--admin-muted)]"}`}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}
