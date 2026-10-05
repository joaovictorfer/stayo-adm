import { UserRound, House, ListChecks } from "lucide-react";
import type { PendingEntry } from "./FichaSummary";
import type { FichaSection } from "../../../lib/ficha-next-action";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Banknote, ChevronDown, ChevronRight, ExternalLink, FileText, History, Pencil, Plus, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  ASSIGNMENT_LABELS,
  INITIAL_CLEANING_LABELS,
  LINEN_CHOICES,
  OWNER_USE_LIMIT_LABELS,
  TURNOVER_PAYER_LABELS,
  formatPercent,
  type AssignmentMode,
  type InitialCleaningOption,
  type OwnerUseLimitMode,
  type TurnoverPayer,
} from "../../../lib/contract-conditions";
import { formatBRL } from "../../../lib/money";
import { ContractConditionsPanel } from "../ContractConditionsPanel";

const muted = { color: "var(--stayo-ink-muted)" };
const navy = { color: "var(--stayo-navy)" };
const border = { borderColor: "var(--stayo-border)" };
const display = { fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "-0.01em", color: "var(--stayo-navy)" };
const TBD = "A definir";

type Row = { label: string; value: string | null | undefined; detail?: string | null | undefined };

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white px-4 pb-2 pt-3 sm:px-5" style={border}>
      <h3 className="flex items-center gap-3 border-b pb-2.5 text-lg font-semibold" style={{ ...border, ...display }}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "var(--ficha-icon-bg)", color: "var(--ficha-icon-fg)" }}>
          {icon}
        </span>
        {title}
      </h3>
      <ul>{children}</ul>
    </section>
  );
}

function ValueLine({ row, onEdit }: { row: Row; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(row.detail);
  const value = row.value ?? TBD;
  return (
    <li className="border-b last:border-b-0" style={border}>
      <button
        type="button"
        aria-expanded={expandable ? open : undefined}
        onClick={() => (expandable ? setOpen((o) => !o) : onEdit())}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-1 py-2 text-left text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
      >
        <span className="font-medium" style={navy}>{row.label}</span>
        <span className="col-start-1 row-start-2 truncate sm:col-start-2 sm:row-start-1" style={muted}>{value}</span>
        <span className="row-span-2 sm:row-span-1" style={navy} aria-label={expandable ? "Expandir" : `Editar ${row.label}`}>
          {expandable ? <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> : <Pencil className="size-4" />}
        </span>
      </button>
      {expandable && open && (
        <div className="mb-2 flex flex-col gap-2 rounded-md px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: "var(--ficha-subtle)" }}>
          <p style={muted}>{row.detail}</p>
          <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1.5 underline underline-offset-2" style={navy}>
            <Pencil className="size-4" /> Editar cláusula
          </button>
        </div>
      )}
    </li>
  );
}


const days = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export function FichaCommercial({
  implementationId,
  proposal,
  onNewVersion,
  onHistory,
  extras,
  nextSteps = [],
  onGoSection,
}: {
  implementationId: string;
  proposal: { version: number; statusLabel: string } | null;
  onNewVersion: () => void;
  onHistory: () => void;
  extras?: ReactNode;
  nextSteps?: PendingEntry[];
  onGoSection: (s: FichaSection) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const q = useQuery({
    queryKey: ["implementation-contract-conditions", implementationId, "commercial-view"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("implementation_contract_conditions").select("*").eq("implementation_id", implementationId).maybeSingle();
      return data;
    },
  });

  if (editing)
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            void qc.invalidateQueries({ queryKey: ["implementation-contract-conditions", implementationId] });
          }}
          className="flex min-h-11 items-center gap-1 self-start text-sm font-medium"
          style={{ color: "var(--stayo-forest)" }}
        >
          <ArrowLeft className="size-4" /> Voltar às condições
        </button>
        <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5" style={border}>
          <ContractConditionsPanel implementationId={implementationId} />
        </section>
      </div>
    );

  const c = q.data;
  const edit = () => setEditing(true);
  const cleaningFee = c?.turnover_cleaning_fee != null ? formatBRL(Number(c.turnover_cleaning_fee)) : null;
  const initialOpt = c?.initial_cleaning_option as InitialCleaningOption | null | undefined;
  const initial = initialOpt ? (initialOpt === "other" ? c?.initial_cleaning_other || "Outra condição" : INITIAL_CLEANING_LABELS[initialOpt]) : null;

  const ownerUseMode = c?.owner_use_limit_mode as OwnerUseLimitMode | null | undefined;
  const ownerUse =
    ownerUseMode === "limited" && c?.owner_use_limit_days != null
      ? `Até ${days(c.owner_use_limit_days)}${c.owner_use_limit_period ? ` ${c.owner_use_limit_period}` : ""}`
      : ownerUseMode
        ? OWNER_USE_LIMIT_LABELS[ownerUseMode]
        : null;
  const ownerUseDetail = [c?.owner_use_notice_days != null ? `Pedido com ${days(c.owner_use_notice_days)} de antecedência.` : null, c?.owner_use_notes].filter(Boolean).join(" ");
  const payer = c?.turnover_cleaning_payer as TurnoverPayer | null | undefined;
  const assignment = c?.assignment_mode as AssignmentMode | null | undefined;
  const linen = LINEN_CHOICES.find((o) => o.value === c?.linen_mode)?.label ?? null;

  const values: Row[] = [
    { label: "Taxa de administração", value: formatPercent(c?.administration_fee) },
    { label: "Taxa de limpeza", value: cleaningFee },
    { label: "Preparação inicial", value: initial },
    { label: "Vigência", value: c?.duration_months ? `${c.duration_months} meses` : null },
  ];
  const clauses: Row[] = [
    { label: "Uso do imóvel pelo proprietário", value: ownerUse, detail: ownerUseDetail || null },
    { label: "Repasse", value: c?.payout_rule ? c.payout_rule.split(/[.;]/)[0] : null, detail: c?.payout_rule },
    { label: "Limpeza das hospedagens", value: c?.turnover_cleaning_team || c?.cleaning_responsibility || null, detail: payer ? TURNOVER_PAYER_LABELS[payer] : null },
    { label: "Exclusividade", value: c?.exclusivity == null ? null : c.exclusivity ? "Sim" : "Não" },
    ...(assignment ? ([{ label: "Cessão a terceiros", value: ASSIGNMENT_LABELS[assignment], detail: [c?.assignment_who, c?.assignment_procedure].filter(Boolean).join(" ") || null }] as Row[]) : []),
    ...(c?.notice_period_days ? ([{ label: "Aviso prévio", value: days(c.notice_period_days) }] as Row[]) : []),
    ...(c?.maintenance_limit != null ? ([{ label: "Manutenção sem autorização", value: `até ${formatBRL(Number(c.maintenance_limit))}` }] as Row[]) : []),
  ];
  const services: Row[] = [
    { label: "Limpeza de implantação", value: !initialOpt || initialOpt === "tbd" ? null : initialOpt === "owner_delivers" ? "Não" : "Sim", detail: c?.initial_cleaning_notes },
    { label: "Limpeza comercial", value: cleaningFee ? `Sim · ${cleaningFee}` : null },
    { label: "Enxoval", value: linen, detail: c?.linen_notes },
  ];

  const stepIcon = { owner: UserRound, doc: FileText, home: House, list: ListChecks } as Record<string, typeof FileText>;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-4">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold sm:text-[1.75rem]" style={display}>Condições comerciais</h2>
            <p className="text-sm sm:text-base" style={muted}>O que foi acordado com o proprietário.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onHistory} className="flex h-10 flex-1 items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm sm:flex-none" style={{ ...border, ...navy }}>
              {proposal ? `Proposta v${proposal.version} · ${proposal.statusLabel}` : "Sem proposta"} <ChevronDown className="ml-3 size-4" />
            </button>
            <button type="button" onClick={onNewVersion} className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium" style={{ backgroundColor: "var(--stayo-navy)", color: "var(--admin-surface, #fff)" }}>
              <Plus className="size-4" /> Nova versão
            </button>
          </div>
        </div>
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-none">
          {q.isLoading ? (
            <p className="text-sm" style={muted}>Carregando condições…</p>
          ) : (
            <>
              <Block icon={<Banknote className="size-4" />} title="Valores e vigência">
                {values.map((r) => <ValueLine key={r.label} row={r} onEdit={edit} />)}
              </Block>
              <Block icon={<FileText className="size-4" />} title="Condições do contrato">
                {clauses.map((r) => <ValueLine key={r.label} row={r} onEdit={edit} />)}
              </Block>
              <Block icon={<Settings2 className="size-4" />} title="Preparação e serviços">
                {services.map((r) => <ValueLine key={r.label} row={r} onEdit={edit} />)}
              </Block>
            </>
          )}
          {extras}
        </div>
      </div>
      <aside className="lg:pt-0">
        <section className="rounded-xl border bg-white px-4 py-3 sm:px-5" style={border}>
          <div className="flex items-center gap-3 border-b pb-3 pt-1" style={border}>
            <span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: "var(--ficha-icon-bg)", color: "var(--ficha-icon-fg)" }}>
              <ListChecks className="size-4" />
            </span>
            <h3 className="text-lg font-semibold" style={display}>Próximos passos</h3>
          </div>
          {nextSteps.length === 0 ? (
            <p className="border-b py-4 text-sm" style={{ ...border, ...muted }}>Nenhuma pendência no momento.</p>
          ) : (
            nextSteps.map((p) => {
              const Icon = stepIcon[p.icon] ?? FileText;
              return (
                <button key={p.id} type="button" onClick={() => onGoSection(p.section)} className="flex min-h-[4.5rem] w-full items-center gap-3 border-b py-3 text-left" style={border}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "var(--ficha-subtle)", ...navy }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold" style={navy}>{p.title}</span>
                      {p.chip ? (
                        <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ backgroundColor: "var(--ficha-pending-bg)", color: "var(--ficha-pending-fg)" }}>{p.chip}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs" style={muted}>{p.detail}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0" style={navy} />
                </button>
              );
            })
          )}
          <button type="button" onClick={onHistory} className="flex min-h-12 w-full items-center gap-3 text-left text-sm" style={navy}>
            <History className="size-4" /> <span className="underline underline-offset-2">Ver histórico de alterações</span>
          </button>
          <Link to="/portal/previa/$id" params={{ id: implementationId }} target="_blank" className="flex min-h-10 items-center gap-3 text-sm" style={muted}>
            <ExternalLink className="size-4" /> <span className="underline underline-offset-2">Ver como proprietário</span>
          </Link>
        </section>
      </aside>
    </div>
  );
}
