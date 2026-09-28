import type { ComponentType, ReactNode } from "react";
import { ImageOff, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ModuleTabs<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div className="admin-module-tabs" role="tablist" aria-label="Filtros da página">
      {options.map((option) => (
        <Button key={option.value} type="button" variant="ghost" role="tab"
          aria-selected={value === option.value} onClick={() => onChange(option.value)}
          className={cn("admin-module-tab", value === option.value && "is-active")}
        >
          {option.label}{option.count !== undefined && <span>{option.count}</span>}
        </Button>
      ))}
    </div>
  );
}

export function PortfolioMetric({ icon: Icon, value, label, tone = "neutral" }: {
  icon: ComponentType<{ className?: string }>;
  value: ReactNode;
  label: string;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  return (
    <div className={cn("portfolio-metric", `is-${tone}`)}>
      <span className="portfolio-metric-icon"><Icon aria-hidden="true" /></span>
      <div className="min-w-0"><strong>{value}</strong><p>{label}</p></div>
    </div>
  );
}

export function CompactSearch({ value, onChange, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="phase-search">
      <Search aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" />
    </label>
  );
}

export function PropertyVisual({ label, image }: { label: string; image?: string | null }) {
  return (
    <div className="portfolio-visual">
      {image ? <img src={image} alt="" /> : <ImageOff aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}