import {
  AlertCircle,
  Check,
  ChevronRight,
  FileText,
  ListChecks,
  UserRound,
  UsersRound,
  House,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { FichaSection, NextAction } from "../../../lib/ficha-next-action";
import type { ImplementationStatus } from "../../../types/core";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };
const muted = { color: "var(--stayo-ink-muted)" };

export type Tone = "ok" | "warn" | "danger" | "progress" | "muted";

export interface SheetRow {
  section: FichaSection;
  label: string;
  status: string;
  tone: Tone;
}

export interface PendingEntry {
  id: string;
  section: FichaSection;
  icon: "owner" | "doc" | "home" | "list";
  title: string;
  detail: string;
  chip: "Aguardando" | "Pendente";
}

const JOURNEY: Array<{ label: string; statuses: ImplementationStatus[] }> = [
  { label: "Proposta", statuses: ["prospect", "proposta", "aguardando_aprovacao", "aprovado"] },
  { label: "Planejamento", statuses: ["planejamento"] },
  { label: "Implantação", statuses: ["em_implantacao"] },
  { label: "Validação", statuses: ["validacao", "pronto_para_operacao"] },
  { label: "Ativo", statuses: ["ativo"] },
];

const icons: Record<PendingEntry["icon"], LucideIcon> = {
  owner: UserRound,
  doc: FileText,
  home: House,
  list: ListChecks,
};

function Card({ icon: Icon, title, children, tone }: { icon: LucideIcon; title: string; children: ReactNode; tone?: "warn" }) {
  return (
    <section className="rounded-[var(--radius-card)] border bg-white" style={surface}>
      <header className="mx-4 flex items-center gap-3 border-b py-3.5 sm:mx-5" style={{ borderColor: "var(--stayo-border)" }}>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{
            backgroundColor: tone === "warn" ? "var(--stayo-warning-soft, #fdf3e3)" : "var(--stayo-forest-soft)",
            color: tone === "warn" ? "var(--stayo-warning, #c27a12)" : "var(--stayo-forest)",
          }}
        >
          <Icon className="size-4" />
        </span>
        <h2 className="text-base font-semibold" style={{ color: "var(--stayo-ink)" }}>
          {title}
        </h2>
      </header>
      <div className="px-4 pb-4 pt-3 sm:px-5">{children}</div>
    </section>
  );
}

function ToneDot({ tone }: { tone: Tone }) {
  if (tone === "ok")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "var(--stayo-success, #1f8a5b)", color: "white" }}>
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (tone === "warn" || tone === "danger")
    return (
      <span
        className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
        style={{ backgroundColor: tone === "danger" ? "var(--stayo-danger)" : "var(--stayo-warning, #e3a03a)", color: "white" }}
      >
        !
      </span>
    );
  if (tone === "progress")
    return <span className="size-5 shrink-0 rounded-full border-[3px]" style={{ borderColor: "var(--stayo-forest)", borderRightColor: "var(--stayo-border)" }} />;
  return <span className="size-5 shrink-0 rounded-full" style={{ backgroundColor: "var(--stayo-border)" }} />;
}

export function NextStepCard({
  action,
  onGo,
  onPortal,
}: {
  action: NextAction;
  onGo: (s: FichaSection) => void;
  onPortal: () => void;
}) {
  return (
    <Card icon={AlertCircle} title="Próximo passo" tone="warn">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:pl-11">
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: "var(--stayo-ink)" }}>
            {action.title}
          </p>
          <p className="text-sm" style={muted}>
            {action.detail}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {action.cta && action.section !== "visao" && (
            <button
              type="button"
              onClick={() => onGo(action.section)}
              className="min-h-11 rounded-[var(--radius-control)] px-5 text-sm font-semibold"
              style={{ backgroundColor: "var(--stayo-navy, #0b3150)", color: "white" }}
            >
              {action.cta}
            </button>
          )}
          <button type="button" onClick={onPortal} className="min-h-11 text-sm font-medium underline underline-offset-4" style={{ color: "var(--stayo-ink)" }}>
            Abrir Portal
          </button>
        </div>
      </div>
    </Card>
  );
}

export function JourneyCard({ status, pendingCount }: { status: ImplementationStatus; pendingCount: number }) {
  const current = JOURNEY.findIndex((s) => s.statuses.includes(status));
  return (
    <Card icon={ListChecks} title="Jornada da implantação">
      {current < 0 && (
        <p className="mb-3 text-sm" style={muted}>
          Implantação fora do fluxo principal.
        </p>
      )}
      <ol className="grid grid-cols-5">
        {JOURNEY.map((step, i) => {
          const done = current >= 0 && i < current;
          const active = i === current;
          return (
            <li key={step.label} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className="absolute right-1/2 top-[11px] h-0.5 w-full"
                  style={{ backgroundColor: done || active ? "var(--stayo-forest)" : "var(--stayo-border)" }}
                />
              )}
              <span
                className="relative z-10 grid size-6 place-items-center rounded-full border-2 bg-white"
                style={{
                  borderColor: done ? "var(--stayo-success, #1f8a5b)" : active ? "var(--stayo-navy, #0b3150)" : "var(--stayo-border)",
                  backgroundColor: done ? "var(--stayo-success, #1f8a5b)" : "white",
                }}
              >
                {done && <Check className="size-3.5" strokeWidth={3} style={{ color: "white" }} />}
                {active && <span className="size-3 rounded-full" style={{ backgroundColor: "var(--stayo-navy, #0b3150)" }} />}
              </span>
              <span className="mt-2 w-full truncate px-0.5 text-[10px] font-medium leading-tight sm:text-sm" style={{ color: "var(--stayo-ink)" }}>
                {step.label}
              </span>
              <span className="hidden text-xs sm:block" style={active ? { color: "var(--stayo-ink)" } : muted}>
                {done ? "Concluído" : active ? "Em andamento" : "Pendente"}
              </span>
            </li>
          );
        })}
      </ol>
      {pendingCount > 0 && (
        <p
          className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-warning-soft, #fdf3e3)", color: "var(--stayo-ink)" }}
        >
          <ToneDot tone="warn" /> {pendingCount} pendência{pendingCount > 1 ? "s" : ""} antes de avançar
        </p>
      )}
    </Card>
  );
}

export function SheetOverviewCard({ rows, onGo }: { rows: SheetRow[]; onGo: (s: FichaSection) => void }) {
  return (
    <Card icon={FileText} title="Visão da ficha">
      <ul className="-mt-1 divide-y" style={{ borderColor: "var(--stayo-border)" }}>
        {rows.map((r) => (
          <li key={r.label} style={{ borderColor: "var(--stayo-border)" }}>
            <button
              type="button"
              onClick={() => onGo(r.section)}
              className="grid min-h-11 w-full grid-cols-[5.5rem_auto_minmax(0,1fr)_auto] items-center gap-3 py-2 text-left text-sm transition hover:bg-[var(--stayo-bg)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)_auto]"
            >
              <span className="truncate font-medium" style={{ color: "var(--stayo-ink)" }}>
                {r.label}
              </span>
              <ToneDot tone={r.tone} />
              <span className="min-w-0 leading-snug sm:truncate" style={muted}>
                {r.status}
              </span>
              <ChevronRight className="size-4 shrink-0" style={muted} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PendingCard({ entries, onGo }: { entries: PendingEntry[]; onGo: (s: FichaSection) => void }) {
  return (
    <Card icon={ListChecks} title="Pendências">
      {entries.length === 0 ? (
        <p className="py-2 text-sm" style={muted}>
          Nenhuma pendência agora.
        </p>
      ) : (
        <ul className="-mt-1 divide-y" style={{ borderColor: "var(--stayo-border)" }}>
          {entries.map((e) => {
            const Icon = icons[e.icon];
            const waiting = e.chip === "Aguardando";
            return (
              <li key={e.id} style={{ borderColor: "var(--stayo-border)" }}>
                <button type="button" onClick={() => onGo(e.section)} className="flex min-h-14 w-full items-center gap-3 py-3 text-left">
                  <Icon className="size-5 shrink-0" style={{ color: "var(--stayo-ink)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                      {e.title}
                    </span>
                    <span className="block truncate text-xs" style={muted}>
                      {e.detail}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: waiting ? "var(--stayo-warning-soft, #fdf3e3)" : "var(--stayo-danger-soft, #fde8e8)",
                      color: waiting ? "var(--stayo-warning, #b26b0e)" : "var(--stayo-danger)",
                    }}
                  >
                    {e.chip}
                  </span>
                  <ChevronRight className="size-4 shrink-0" style={muted} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function ResponsibleCard({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ú]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <Card icon={UsersRound} title="Responsável">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-ink)" }}>
          {initials || "—"}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium" style={{ color: "var(--stayo-ink)" }}>
            {name}
          </span>
          <span className="block text-sm" style={muted}>
            Implantação
          </span>
        </span>
      </div>
    </Card>
  );
}
