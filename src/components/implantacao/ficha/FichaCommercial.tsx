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
const border = { borderColor: "var(--stayo-border)" };
const TBD = "A definir";

type Row = { label: string; value: string | null | undefined; detail?: string | null | undefined };

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border bg-white px-4 py-3 sm:px-5" style={border}>
      <h3 className="flex items-center gap-3 pb-2 text-base font-semibold">
        <span className="grid size-8 place-items-center rounded-full" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-forest)" }}>
          {icon}
        </span>
        {title}
      </h3>
      <ul className="divide-y" style={border}>{children}</ul>
    </section>
  );
}

function ValueLine({ row, onEdit }: { row: Row; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(row.detail);
  const value = row.value ?? TBD;
  return (
    <li style={border}>
      <button
        type="button"
        aria-expanded={expandable ? open : undefined}
        onClick={() => (expandable ? setOpen((o) => !o) : onEdit())}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-left text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]"
      >
        <span className="font-medium">{row.label}</span>
        <span className="col-start-1 row-start-2 truncate sm:col-start-2 sm:row-start-1" style={{ color: row.value ? "var(--stayo-ink-muted)" : "var(--stayo-warning, var(--stayo-ink-muted))" }}>
          {value}
        </span>
        <span className="row-span-2 sm:row-span-1" style={muted} aria-label={expandable ? "Expandir" : `Editar ${row.label}`}>
          {expandable ? <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> : <Pencil className="size-4" />}
        </span>
      </button>
      {expandable && open && (
        <div className="mb-2.5 flex flex-col gap-2 rounded-md px-3 py-2 text-sm sm:flex-row sm:items-start sm:justify-between" style={{ backgroundColor: "var(--stayo-bg)" }}>
          <p style={muted}>{row.detail}</p>
          <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1 font-medium underline underline-offset-2">
            <Pencil className="size-3.5" /> Editar cláusula
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
}: {
  implementationId: string;
  proposal: { version: number; statusLabel: string } | null;
  onNewVersion: () => void;
  onHistory: () => void;
  extras?: ReactNode;
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--stayo-font-display)" }}>Condições comerciais</h2>
          <p className="text-sm" style={muted}>O que foi acordado com o proprietário.</p>
        </div>
        <Button className="min-h-11" onClick={onNewVersion}>
          <Plus /> Nova versão
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
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
        <aside className="order-1 lg:order-2">
          <section className="rounded-[var(--radius-card)] border bg-white px-4 py-3 sm:px-5" style={border}>
            <h3 className="flex items-center gap-2 pb-2 text-base font-semibold"><FileText className="size-4" /> Proposta</h3>
            <dl className="divide-y text-sm" style={border}>
              <div className="flex justify-between py-2" style={border}><dt style={muted}>Versão</dt><dd className="font-medium">{proposal ? `v${proposal.version}` : "—"}</dd></div>
              <div className="flex justify-between py-2" style={border}><dt style={muted}>Status</dt><dd className="font-medium">{proposal?.statusLabel ?? "Não criada"}</dd></div>
            </dl>
            <div className="mt-1 divide-y border-t text-sm" style={border}>
              <Link to="/portal/previa/$id" params={{ id: implementationId }} target="_blank" className="flex min-h-11 items-center gap-2 underline-offset-2 hover:underline" style={border}>
                <ExternalLink className="size-4" /> <span className="flex-1">Ver como proprietário</span> <ChevronRight className="size-4" style={muted} />
              </Link>
              <button type="button" onClick={onHistory} className="flex min-h-11 w-full items-center gap-2 text-left underline-offset-2 hover:underline" style={border}>
                <History className="size-4" /> <span className="flex-1">Ver histórico de versões</span> <ChevronRight className="size-4" style={muted} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
