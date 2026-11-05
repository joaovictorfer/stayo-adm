import { formatDateTime } from "@/lib/format-datetime";
import {
  AlertCircle,
  Check,
  Clock3,
  ChevronRight,
  FileText,
  ListChecks,
  UserRound,
  UsersRound,
  House,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../ui/button";
import type { TimelineEntry } from "../../patterns/Timeline";

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
    <section className="rounded-xl border bg-white" style={surface}>
      <header className="mx-4 flex items-center gap-3 border-b py-3.5 sm:mx-5" style={{ borderColor: "var(--stayo-border)" }}>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full"
          style={{
            backgroundColor: tone === "warn" ? "var(--ficha-pending-bg)" : "var(--ficha-icon-bg)",
            color: tone === "warn" ? "var(--stayo-warning, #c27a12)" : "var(--ficha-icon-fg)",
          }}
        >
          <Icon className="size-4" />
        </span>
        <h2 className="text-lg font-semibold" style={{ color: "var(--stayo-navy)", fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "0" }}>
          {title}
        </h2>
      </header>
      <div className="px-4 pb-4 pt-3 sm:px-5">{children}</div>
    </section>
  );
}

/**
 * Três números independentes — nunca somados: inventário conferido,
 * envios do proprietário aguardando revisão e bloqueios reais de prontidão.
 */
export function ReadinessCountersCard({
  loading,
  error,
  onRetry,
  answered,
  total,
  submissionsPending,
  blockers,
  onInventory,
  onSubmissions,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  answered: number;
  total: number;
  submissionsPending: number;
  blockers: number;
  onInventory: () => void;
  onSubmissions: () => void;
}) {
  if (loading)
    return (
      <section className="rounded-xl border bg-white p-5" style={surface} role="status" aria-label="Carregando inventário">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-10 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-2 w-full animate-pulse rounded bg-muted" />
        <div className="mt-5 h-12 w-full animate-pulse rounded bg-muted" />
      </section>
    );
  if (error)
    return (
      <section className="rounded-xl border bg-white p-5" style={surface} role="alert">
        <p className="font-medium" style={{ color: "var(--stayo-navy)" }}>Não foi possível carregar o inventário.</p>
        <Button variant="outline" className="mt-3" onClick={onRetry}>Tentar de novo</Button>
      </section>
    );
  const allDone = total > 0 && answered >= total;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <section className="rounded-xl border bg-white" style={surface}>
      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={muted}>Inventário</p>
          {total === 0 ? (
            <p className="mt-2 text-lg font-medium" style={{ color: "var(--stayo-navy)" }}>Inventário ainda não carregado</p>
          ) : (
            <p className="mt-1 flex items-baseline gap-2" style={{ color: "var(--stayo-navy)" }}>
              <span className="text-5xl font-semibold tabular-nums" style={{ fontFamily: "Outfit, var(--stayo-font-ui), sans-serif" }}>{answered}</span>
              <span className="text-2xl tabular-nums" style={muted}>/ {total}</span>
              <span className="text-sm" style={muted}>itens conferidos</span>
            </p>
          )}
          {total > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--stayo-border)" }} aria-hidden>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "var(--stayo-navy)" }} />
            </div>
          )}
          {allDone && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--stayo-success, #1f7a4d)" }}>
              <Check className="size-4" /> Tudo o que se aplica foi conferido
            </p>
          )}
        </div>
        {!allDone && (
          <Button onClick={onInventory} className="h-12">
            {total === 0 ? "Abrir inventário" : "Continuar conferência"} <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
      <ul className="border-t" style={{ borderColor: "var(--stayo-border)" }}>
        <li>
          <button type="button" onClick={onSubmissions} className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left">
            <AlertCircle className="size-5 shrink-0" style={{ color: submissionsPending ? "var(--stayo-warning, #c27a12)" : "var(--stayo-ink-muted)" }} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium" style={{ color: "var(--stayo-navy)" }}>Envios do proprietário</span>
              <span className="block text-sm" style={muted}>{submissionsPending ? `${submissionsPending} aguardando revisão` : "Nada para revisar"}</span>
            </span>
            <ChevronRight className="size-4" style={muted} />
          </button>
        </li>
        <li className="flex min-h-14 items-center gap-3 border-t px-5 py-3" style={{ borderColor: "var(--stayo-border)" }}>
          <ListChecks className="size-5 shrink-0" style={{ color: blockers ? "var(--stayo-danger, #b42318)" : "var(--stayo-ink-muted)" }} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium" style={{ color: "var(--stayo-navy)" }}>Bloqueios de prontidão</span>
            <span className="block text-sm" style={muted}>{blockers ? `${blockers} ${blockers === 1 ? "bloqueio" : "bloqueios"} impedem a entrega` : "Nenhum"}</span>
          </span>
        </li>
      </ul>
    </section>
  );
}

function ToneDot({ tone }: { tone: Tone }) {
  if (tone === "ok")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "var(--ficha-ok)", color: "white" }}>
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (tone === "warn" || tone === "danger")
    return (
      <span
        className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
        style={{ backgroundColor: tone === "danger" ? "var(--stayo-danger)" : "var(--ficha-pending-fg)", color: "white" }}
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
}: {
  action: NextAction;
  onGo: (s: FichaSection) => void;
}) {
  return (
    <Card icon={AlertCircle} title="Próximo passo" tone="warn">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:pl-11">
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: "var(--stayo-navy)" }}>
            {action.title}
          </p>
          <p className="text-sm" style={muted}>
            {action.detail}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {action.cta && action.section !== "visao" && (
            <Button
              onClick={() => onGo(action.section)}
              className="min-h-11 bg-[var(--stayo-navy)] text-primary-foreground hover:bg-[var(--stayo-navy)]/90"
            >
              {action.cta}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function JourneyCard({ status }: { status: ImplementationStatus }) {
  const current = JOURNEY.findIndex((s) => s.statuses.includes(status));
  return (
    <Card icon={ListChecks} title="Jornada da implantação">
      {current < 0 && (
        <p className="mb-3 text-sm" style={muted}>
          Implantação fora do fluxo principal.
        </p>
      )}
      {current >= 0 && (
        <div className="sm:hidden">
          <p className="text-sm font-semibold" style={{ color: "var(--stayo-navy)" }}>
            {JOURNEY[current]!.label}
            <span className="ml-1 font-normal" style={muted}>· Etapa {current + 1} de {JOURNEY.length}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--stayo-border)" }}>
            <span className="block h-full rounded-full" style={{ width: `${((current + 1) / JOURNEY.length) * 100}%`, backgroundColor: "var(--stayo-forest)" }} />
          </div>
          {JOURNEY[current + 1] && (
            <p className="mt-2 text-xs" style={muted}>Próxima: {JOURNEY[current + 1]!.label}</p>
          )}
        </div>
      )}
      <ol className={`${current >= 0 ? "hidden sm:flex" : "flex"} pb-1`}>
        {JOURNEY.map((step, i) => {
          const done = current >= 0 && i < current;
          const active = i === current;
          return (
            <li key={step.label} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
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
                  borderColor: done ? "var(--ficha-ok)" : active ? "var(--stayo-navy, #0b3150)" : "var(--stayo-border)",
                  backgroundColor: done ? "var(--ficha-ok)" : "white",
                }}
              >
                {done && <Check className="size-3.5" strokeWidth={3} style={{ color: "white" }} />}
                {active && <span className="size-3 rounded-full" style={{ backgroundColor: "var(--stayo-navy, #0b3150)" }} />}
              </span>
              <span className="mt-2 w-full px-1 text-[10px] font-medium leading-tight sm:text-sm" style={{ color: "var(--stayo-navy)" }}>
                {step.label}
              </span>
              <span className="hidden text-xs sm:block" style={active ? { color: "var(--stayo-navy)" } : muted}>
                {done ? "Concluído" : active ? "Em andamento" : "Pendente"}
              </span>
            </li>
          );
        })}
      </ol>
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
              <span className="truncate font-medium" style={{ color: "var(--stayo-navy)" }}>
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
                  <Icon className="size-5 shrink-0" style={{ color: "var(--stayo-navy)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium" style={{ color: "var(--stayo-navy)" }}>
                      {e.title}
                    </span>
                    <span className="block truncate text-xs" style={muted}>
                      {e.detail}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: waiting ? "var(--ficha-pending-bg)" : "var(--stayo-danger-soft, #fde8e8)",
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
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return (
    <Card icon={UsersRound} title="Responsável">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-navy)" }}>
          {initials || "—"}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium" style={{ color: "var(--stayo-navy)" }}>
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

export function LastActivityCard({ entry, onHistory }: { entry: TimelineEntry | undefined; onHistory: () => void }) {
  return (
    <Card icon={Clock3} title="Última atividade">
      {entry ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--stayo-navy)]">{entry.label}</p>
          <p className="text-xs" style={muted}>{formatDateTime(entry.timestamp)}</p>
          {entry.actor && <p className="text-xs" style={muted}>{entry.actor}</p>}
        </div>
      ) : <p className="text-sm" style={muted}>Nenhuma atividade registrada.</p>}
      <Button variant="link" className="mt-2 h-auto min-h-10 p-0 text-[var(--stayo-navy)]" onClick={onHistory}>
        Ver histórico <ChevronRight className="size-4" />
      </Button>
    </Card>
  );
}
