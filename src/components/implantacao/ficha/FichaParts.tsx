import { Building2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, FileText, Globe, History, LayoutDashboard, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";

import { FICHA_SECTIONS, type FichaSection } from "../../../lib/ficha-next-action";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };
const muted = { color: "var(--stayo-ink-muted)" };

const SECTION_ICONS: Record<FichaSection, typeof LayoutDashboard> = {
  visao: LayoutDashboard,
  proposta: FileText,
  proprietario: UserRound,
  imovel: Building2,
  implantacao: ClipboardCheck,
  portal: Globe,
  historico: History,
};

/** Navegação da ficha em cartões com ícone, no mesmo padrão visual do cadastro e vistoria (tablet). */
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
  const Icon = SECTION_ICONS[current];
  function centerTabHorizontally(el: HTMLButtonElement | null) {
    const nav = el?.closest("nav");
    if (!el || !nav) return;
    const target = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
    if (Math.abs(nav.scrollLeft - target) > 4) nav.scrollLeft = target;
  }
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Seções da ficha" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0">
        <ul className="flex min-w-max gap-1 rounded-xl border bg-white p-1 lg:min-w-0" style={{ borderColor: "var(--stayo-border)" }}>
          {FICHA_SECTIONS.map((s) => {
            const active = s.id === current;
            const I = SECTION_ICONS[s.id];
            return (
              <li key={s.id} className="lg:flex-1">
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  ref={active ? centerTabHorizontally : undefined}
                  onClick={() => onChange(s.id)}
                  className="relative flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm transition hover:bg-[var(--stayo-bg)]"
                  style={active ? { backgroundColor: "var(--stayo-navy)", color: "var(--stayo-surface)", fontWeight: 600 } : { color: "var(--stayo-ink-muted)", fontWeight: 500 }}
                >
                  <I className="size-4 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{s.label}</span>
                  {badges[s.id] && (
                    <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-navy)" }}>
                      {badges[s.id]}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-navy)" }}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs" style={muted}>Etapa {idx + 1} de {FICHA_SECTIONS.length}</p>
          <p className="truncate font-[Outfit] text-2xl font-semibold" style={{ color: "var(--stayo-navy)" }}>{FICHA_SECTIONS[idx]?.label}</p>
        </div>
      </div>
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
