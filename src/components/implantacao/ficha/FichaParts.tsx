import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { FICHA_SECTIONS, type FichaSection } from "../../../lib/ficha-next-action";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };
const muted = { color: "var(--stayo-ink-muted)" };

/** Menu da ficha: lateral fixo no desktop, seletor recolhível no celular. */
export function FichaNav({
  current,
  onChange,
  badges = {},
}: {
  current: FichaSection;
  onChange: (s: FichaSection) => void;
  badges?: Partial<Record<FichaSection, string>>;
}) {
  const [open, setOpen] = useState(false);
  const label = FICHA_SECTIONS.find((s) => s.id === current)?.label;
  const list = (
    <ul className="flex flex-col gap-0.5">
      {FICHA_SECTIONS.map((s) => {
        const active = s.id === current;
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-3 text-left text-sm transition"
              style={{
                backgroundColor: active ? "var(--stayo-forest-soft)" : "transparent",
                color: active ? "var(--stayo-forest)" : "var(--stayo-ink)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <span>{s.label}</span>
              {badges[s.id] && (
                <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: "var(--stayo-bg)", ...muted }}>
                  {badges[s.id]}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
  return (
    <>
      <nav aria-label="Seções da ficha" className="sticky top-4 hidden self-start lg:block">
        {list}
      </nav>
      <nav aria-label="Seções da ficha" className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-12 w-full items-center justify-between rounded-[var(--radius-control)] border px-4 text-sm font-semibold"
          style={surface}
        >
          <span>
            <span className="mr-2 font-normal" style={muted}>
              Seção
            </span>
            {label}
          </span>
          <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-2 rounded-[var(--radius-card)] border p-1.5 shadow-sm" style={surface}>
            {list}
          </div>
        )}
      </nav>
    </>
  );
}

export interface HubRow {
  id: string;
  label: string;
  summary: string;
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
export function Collapsible({ title, summary, children, defaultOpen = false }: { title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
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
