import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { FICHA_SECTIONS, type FichaSection } from "../../../lib/ficha-next-action";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };
const muted = { color: "var(--stayo-ink-muted)" };

/** Abas horizontais da ficha (rolagem lateral no celular). */
export function FichaNav({
  current,
  onChange,
  badges = {},
}: {
  current: FichaSection;
  onChange: (s: FichaSection) => void;
  badges?: Partial<Record<FichaSection, string>>;
}) {
  const idx = FICHA_SECTIONS.findIndex((s) => s.id === current);
  // Rola só a barra de abas (horizontal); nunca a página, para não pular ao salvar.
  function centerTabHorizontally(el: HTMLButtonElement | null) {
    const nav = el?.closest("nav");
    if (!el || !nav) return;
    const target = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
    if (Math.abs(nav.scrollLeft - target) > 4) nav.scrollLeft = target;
  }
  return (
    <div className="relative">
      <nav
        aria-label="Seções da ficha"
        className="-mx-4 overflow-x-auto scroll-smooth border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        <ul className="flex min-w-max gap-1 pr-10 sm:gap-4 sm:pr-0">
          {FICHA_SECTIONS.map((s) => {
            const active = s.id === current;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  ref={active ? centerTabHorizontally : undefined}
                  onClick={() => onChange(s.id)}
                  className="relative flex min-h-11 items-center gap-1.5 whitespace-nowrap px-2 text-sm transition"
                  style={{ color: active ? "var(--stayo-ink)" : "var(--stayo-ink-muted)", fontWeight: active ? 600 : 500 }}
                >
                  {s.label}
                  {badges[s.id] && (
                    <span className="rounded-full px-1.5 text-[11px]" style={{ backgroundColor: "var(--stayo-bg)" }}>
                      {badges[s.id]}
                    </span>
                  )}
                  {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[3px] rounded-full" style={{ backgroundColor: "var(--stayo-forest)" }} />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -right-4 flex w-14 items-center justify-end pr-3 sm:hidden"
        style={{ background: "linear-gradient(to right, transparent, var(--stayo-bg) 60%)" }}
      >
        <ChevronRight className="size-4" style={{ color: "var(--stayo-ink-muted)" }} />
      </div>
      <p className="sr-only">Seção {idx + 1} de {FICHA_SECTIONS.length}</p>
    </div>
  );
}

export interface HubRow {
  id: string;
  label: string;
  summary: ReactNode;
  tone?: "danger" | "ok" | "muted";
  content: ReactNode;
}

/** Linhas-resumo que abrem uma subárea por vez (progressive disclosure). */
export function DomainHub({ rows, intro }: { rows: HubRow[]; intro?: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId);
  if (open)
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="flex min-h-11 items-center gap-1 self-start text-sm font-medium"
          style={{ color: "var(--stayo-forest)" }}
        >
          <ChevronLeft className="size-4" /> Voltar
        </button>
        <h2 className="text-lg font-semibold">{open.label}</h2>
        {open.content}
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      {intro}
      <ul className="divide-y overflow-hidden rounded-[var(--radius-card)] border" style={surface}>
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setOpenId(r.id)}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--stayo-bg)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.label}</span>
                <span
                  className="block truncate text-sm"
                  style={{
                    color:
                      r.tone === "danger" ? "var(--stayo-danger)" : r.tone === "ok" ? "var(--stayo-forest)" : "var(--stayo-ink-muted)",
                  }}
                >
                  {r.summary}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0" style={muted} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bloco recolhível — fechado por padrão. */
export function Collapsible({ title, summary, children, defaultOpen = false }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border" style={surface}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {summary && (
            <span className="block truncate text-xs" style={muted}>
              {summary}
            </span>
          )}
        </span>
        <ChevronDown className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} style={muted} />
      </button>
      {open && (
        <div className="border-t p-4" style={{ borderColor: "var(--stayo-border)" }}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Bloco compacto clicável da Visão geral. */
export function OverviewCard({ title, lines, onOpen }: { title: string; lines: Array<string | null | undefined>; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex flex-col gap-1 rounded-[var(--radius-card)] border p-4 text-left transition hover:border-[var(--stayo-forest)]" style={surface}>
      <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em]" style={muted}>
        {title} <ChevronRight className="size-4" />
      </span>
      {lines.filter(Boolean).map((l, i) => (
        <span key={i} className={i === 0 ? "font-semibold" : "text-sm"} style={i === 0 ? undefined : muted}>
          {l}
        </span>
      ))}
    </button>
  );
}
