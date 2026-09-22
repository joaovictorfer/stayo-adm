import type { ReactNode } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function PortalBrand({ context = "Portal do proprietário" }: { context?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img src="/favicon.ico" alt="Stayo" className="h-11 w-11 shrink-0 object-contain" />
      <div className="min-w-0">
        <span className="block text-xl font-semibold leading-none text-[var(--portal-navy)]">STAYO</span>
        <span className="mt-1 block truncate text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--portal-muted)]">
          {context}
        </span>
      </div>
    </div>
  );
}

export function PortalShell({
  children,
  context,
  footer = "Cuidamos de cada etapa para você acompanhar tudo com tranquilidade.",
  width = "wide",
  framed = true,
  showBrand = true,
}: {
  children: ReactNode;
  context?: string;
  footer?: string;
  width?: "compact" | "medium" | "wide";
  framed?: boolean;
  showBrand?: boolean;
}) {
  const widths = { compact: "max-w-md", medium: "max-w-2xl", wide: "max-w-5xl" };
  return (
    <div className="stayo-owner-theme min-h-screen bg-[var(--portal-bg)] px-4 py-5 text-[var(--portal-ink)] sm:px-7 sm:py-8">
      <div className={cn("mx-auto w-full", widths[width])}>
        {showBrand && <div className="mb-6 px-1 sm:mb-8"><PortalBrand {...(context ? { context } : {})} /></div>}
        <main className={cn(framed && "portal-shell-surface")}>{children}</main>
        <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-5 text-[var(--portal-muted)]">{footer}</p>
      </div>
    </div>
  );
}

export function PortalSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="portal-card space-y-5" aria-label="Carregando conteúdo" aria-busy="true">
      <div className="flex items-center gap-4">
        <div className="portal-skeleton h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="portal-skeleton h-4 w-2/5 rounded-full" />
          <div className="portal-skeleton h-3 w-3/5 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={cn("portal-skeleton h-3 rounded-full", index === rows - 1 ? "w-3/4" : "w-full")} />
        ))}
      </div>
      <span className="sr-only">Preparando suas informações</span>
    </div>
  );
}

export function PortalEmptyState({
  icon,
  title,
  description,
  positive = false,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  positive?: boolean;
}) {
  return (
    <div className="portal-empty">
      <div className={cn("portal-empty-icon", positive && "portal-empty-icon-success")}>
        {icon ?? (positive ? <CheckCircle2 /> : <Sparkles />)}
      </div>
      <div>
        <h3 className="text-base font-semibold text-[var(--portal-navy)]">{title}</h3>
        <p className="mt-1 max-w-lg text-sm leading-6 text-[var(--portal-muted)]">{description}</p>
      </div>
    </div>
  );
}