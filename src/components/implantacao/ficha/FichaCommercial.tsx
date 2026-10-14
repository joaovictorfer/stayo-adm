import { UserRound, House, ListChecks } from "lucide-react";
import type { PendingEntry } from "./FichaSummary";
import type { FichaSection } from "../../../lib/ficha-next-action";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Banknote, ChevronDown, ChevronRight, ExternalLink, FileText, History, Pencil, Plus, Settings2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MoneyInput } from "../MoneyInput";
import {
  ASSIGNMENT_LABELS,
  INITIAL_CLEANING_LABELS,
  LINEN_CHOICES,
  OWNER_USE_LIMIT_LABELS,
  TURNOVER_PAYER_LABELS,
  formatPercent,
  snapshotConditionsToRow,
  type AssignmentMode,
  type InitialCleaningOption,
  type OwnerUseLimitMode,
  type TurnoverPayer,
} from "../../../lib/contract-conditions";
import { formatBRL } from "../../../lib/money";
import { ContractConditionsPanel } from "../ContractConditionsPanel";
import { ImplementationDecisionsPanel } from "../ImplementationDecisionsPanel";
import { ProposalTab } from "../ProposalTab";
import type { CommercialProposalSnapshot } from "../../../types/commercial-proposal";

const muted = { color: "var(--stayo-ink-muted)" };
const navy = { color: "var(--stayo-navy)" };
const border = { borderColor: "var(--stayo-border)" };
const display = { fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "-0.01em", color: "var(--stayo-navy)" };
const TBD = "A definir";

type Row = { label: string; value: string | null | undefined; detail?: string | null | undefined; quick?: QuickKey; paid?: boolean | undefined; section?: number | undefined; open?: Pop };
type Pop = "decisions" | "services" | "terms";
const POP_TITLE: Record<Pop, [string, string]> = {
  decisions: ["Decisões da implantação", "Limpeza inicial, enxoval e escopo da assessoria. Salva sozinho."],
  services: ["Serviços e valores da implantação", "Ligue, edite ou adicione serviços. Itens desligados não entram no total."],
  terms: ["Objeto e responsabilidades", "O que a STAYO fará, quem faz o quê e quem participa do aceite."],
};

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(11,49,80,0.04),0_8px_24px_-16px_rgba(11,49,80,0.18)]" style={border}>
      <h3 className="flex items-center gap-3 border-b px-4 py-3 text-base font-semibold sm:px-5" style={{ ...border, ...display, backgroundColor: "var(--ficha-subtle)" }}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: "var(--ficha-icon-bg)", color: "var(--ficha-icon-fg)" }}>
          {icon}
        </span>
        {title}
      </h3>
      <ul className="px-2 py-1 sm:px-3">{children}</ul>
    </section>
  );
}

function ValueLine({ row, onEdit }: { row: Row; onEdit: () => void }) {
  const value = row.value ?? TBD;
  return (
    <li className="border-b last:border-b-0" style={border}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${row.label}`}
        className="group grid min-h-14 w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-[var(--ficha-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stayo-navy)]/30 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
      >
        <span className="text-xs font-medium uppercase tracking-wide sm:text-sm sm:normal-case sm:tracking-normal" style={muted}>{row.label}</span>
        <span className="col-start-1 row-start-2 flex min-w-0 flex-col sm:col-start-2 sm:row-start-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[0.95rem] font-semibold tabular-nums" style={row.value ? navy : { color: "var(--ficha-pending-fg)" }}>{value}</span>
            {row.paid && (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}>Pago</span>
            )}
          </span>
          {row.detail && row.detail !== row.value && <span className="truncate text-xs" style={muted}>{row.detail}</span>}
        </span>
        <span className="row-span-2 grid size-9 place-items-center rounded-full opacity-60 transition group-hover:bg-white group-hover:opacity-100 sm:row-span-1" style={navy} aria-hidden>
          <Pencil className="size-4" />
        </span>
      </button>
    </li>
  );
}


type QuickKey = "administration_fee" | "turnover_cleaning_fee" | "initial_cleaning_fee" | "duration_months" | "implementation";
type PaidMap = Record<string, { paid: boolean; paid_at?: string | null }>;

const QUICK: Record<QuickKey, { title: string; kind: "percent" | "money" | "months" | "none"; payable: boolean }> = {
  administration_fee: { title: "Taxa de administração", kind: "percent", payable: false },
  turnover_cleaning_fee: { title: "Taxa de limpeza", kind: "money", payable: true },
  initial_cleaning_fee: { title: "Preparação inicial", kind: "money", payable: true },
  duration_months: { title: "Vigência", kind: "months", payable: false },
  implementation: { title: "Valor de implantação", kind: "none", payable: true },
};

function QuickEditDialog({
  implementationId,
  field,
  row,
  onClose,
  onFullEdit,
  onNewVersion,
}: {
  implementationId: string;
  field: QuickKey | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any;
  onClose: () => void;
  onFullEdit: () => void;
  onNewVersion: () => void;
}) {
  const qc = useQueryClient();
  const cfg = field ? QUICK[field] : null;
  const paidMap: PaidMap = (row?.["paid_items"] as PaidMap) ?? {};
  const [num, setNum] = useState<number>(0);
  const [text, setText] = useState("");
  const [paid, setPaid] = useState(false);
  const [paidAt, setPaidAt] = useState("");
  const [lastField, setLastField] = useState<QuickKey | null>(null);
  if (field !== lastField) {
    setLastField(field);
    if (field) {
      const raw = field === "implementation" ? null : row?.[field];
      setNum(raw == null ? 0 : Number(raw));
      setText(raw == null ? "" : String(raw).replace(".", ","));
      setPaid(Boolean(paidMap[field]?.paid));
      setPaidAt(paidMap[field]?.paid_at ?? "");
    }
  }
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const touch = <T,>(fn: (v: T) => void) => (v: T) => { dirty.current = true; fn(v); };
  const save = async () => {
    if (!field || !cfg) return;
    const patch: Record<string, unknown> = {};
    if (cfg.kind === "money") patch[field] = num > 0 ? num : null;
    if (cfg.kind === "percent" || cfg.kind === "months") {
      const n = text.trim() === "" ? null : Number(text.replace(",", "."));
      if (n != null && (!Number.isFinite(n) || n < 0 || (cfg.kind === "percent" && n > 100))) {
        setStatus("error");
        return;
      }
      patch[field] = cfg.kind === "months" && n != null ? Math.round(n) : n;
    }
    if (cfg.payable) patch["paid_items"] = { ...paidMap, [field]: { paid, paid_at: paid ? paidAt || null : null } };
    setStatus("saving");
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("implementation_contract_conditions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ implementation_id: implementationId, ...patch } as any, { onConflict: "implementation_id" });
    if (error) {
      setStatus("error");
      toast.error("Não foi possível salvar.");
      return;
    }
    setStatus("saved");
    await qc.invalidateQueries({ queryKey: ["implementation-contract-conditions", implementationId] });
  };
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => { dirty.current = false; void save(); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num, text, paid, paidAt]);
  const close = () => {
    if (dirty.current) { dirty.current = false; void save(); }
    setStatus("idle");
    onClose();
  };
  return (
    <Dialog open={field != null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{cfg?.title}</DialogTitle>
          <DialogDescription>Salva automaticamente e já passa a valer.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {cfg?.kind === "money" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qe-value">Valor</Label>
              <MoneyInput id="qe-value" value={num} onValueChange={touch(setNum)} />
            </div>
          )}
          {(cfg?.kind === "percent" || cfg?.kind === "months") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qe-value">{cfg.kind === "percent" ? "Percentual (%)" : "Meses"}</Label>
              <Input id="qe-value" inputMode="decimal" value={text} onChange={(e) => touch(setText)(e.target.value.replace(/[^\d,.]/g, ""))} />
            </div>
          )}
          {cfg?.kind === "none" && (
            <p className="text-sm" style={muted}>
              O valor é a soma dos serviços da implantação.{" "}
              <button type="button" className="underline" style={navy} onClick={() => { close(); onNewVersion(); }}>Editar serviços</button>
            </p>
          )}
          {cfg?.payable && (
            <div className="flex flex-col gap-3 rounded-lg border p-3" style={border}>
              <label className="flex items-center justify-between gap-3 text-sm font-medium" style={navy}>
                Já foi pago pelo proprietário
                <Switch checked={paid} onCheckedChange={touch(setPaid)} />
              </label>
              {paid && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qe-date">Data do pagamento (opcional)</Label>
                  <Input id="qe-date" type="date" value={paidAt} onChange={(e) => touch(setPaidAt)(e.target.value)} />
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={() => { close(); onFullEdit(); }} className="self-start text-sm underline underline-offset-2" style={muted}>
            Ver todas as condições
          </button>
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-xs" style={muted}>
            {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : status === "error" ? "Valor inválido" : ""}
          </span>
          <Button onClick={close}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  proposal: { version: number; statusLabel: string; snapshot?: CommercialProposalSnapshot | null; total?: number | null } | null;
  onNewVersion: () => void;
  onHistory: () => void;
  extras?: ReactNode;
  nextSteps?: PendingEntry[];
  onGoSection: (s: FichaSection) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editFocus, setEditFocus] = useState<number | null>(null);
  const [quick, setQuick] = useState<QuickKey | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const q = useQuery({
    queryKey: ["implementation-contract-conditions", implementationId, "commercial-view"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("implementation_contract_conditions").select("*").eq("implementation_id", implementationId).maybeSingle();
      return data;
    },
  });

  // Proposta publicada/aceita: mostra exatamente o snapshot (o mesmo do link e do PDF).
  const snap = proposal?.snapshot ?? null;
  const snapRow = snap ? snapshotConditionsToRow(snap.contractConditions ?? {}) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (q.data ?? snapRow) as any;
    const implTotal = snap ? snap.total : proposal?.total ?? null;
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

  const paidMap = ((q.data as { paid_items?: PaidMap } | null)?.paid_items ?? {}) as PaidMap;
  const initialFee = c?.initial_cleaning_fee != null && Number(c.initial_cleaning_fee) > 0 ? formatBRL(Number(c.initial_cleaning_fee)) : null;
  const values: Row[] = [
    { label: "Taxa de administração", value: formatPercent(c?.administration_fee), quick: "administration_fee" },
    { label: "Taxa de limpeza", value: cleaningFee, quick: "turnover_cleaning_fee", paid: paidMap["turnover_cleaning_fee"]?.paid },
    { label: "Preparação inicial", value: [initial, initialFee].filter(Boolean).join(" · ") || null, quick: "initial_cleaning_fee", paid: paidMap["initial_cleaning_fee"]?.paid },
    { label: "Vigência", value: c?.duration_months ? `${c.duration_months} meses` : null, quick: "duration_months" },
    { label: "Valor de implantação", value: implTotal != null && implTotal > 0 ? formatBRL(Number(implTotal)) : null, quick: "implementation", paid: paidMap["implementation"]?.paid },
  ];
  const clauses: Row[] = [
    { label: "Uso do imóvel pelo proprietário", value: ownerUse, detail: ownerUseDetail || null, section: 5 },
    { label: "Repasse", value: c?.payout_rule ? c.payout_rule.split(/[.;]/)[0] : null, detail: c?.payout_rule, section: 7 },
    { label: "Limpeza das hospedagens", value: c?.turnover_cleaning_team || c?.cleaning_responsibility || null, detail: payer ? TURNOVER_PAYER_LABELS[payer] : null, section: 3 },
    { label: "Exclusividade", value: c?.exclusivity == null ? null : c.exclusivity ? "Sim" : "Não", section: 8 },
    ...(assignment ? ([{ label: "Cessão a terceiros", value: ASSIGNMENT_LABELS[assignment], detail: [c?.assignment_who, c?.assignment_procedure].filter(Boolean).join(" ") || null, section: 6 }] as Row[]) : []),
    ...(c?.notice_period_days ? ([{ label: "Aviso prévio", value: days(c.notice_period_days), section: 8 }] as Row[]) : []),
    ...(c?.maintenance_limit != null ? ([{ label: "Manutenção sem autorização", value: `até ${formatBRL(Number(c.maintenance_limit))}`, section: 1 }] as Row[]) : []),
  ];
  const services: Row[] = [
    { label: "Serviços da implantação", value: implTotal != null && implTotal > 0 ? formatBRL(Number(implTotal)) : null, open: "services" },
    { label: "Limpeza de implantação", value: !initialOpt || initialOpt === "tbd" ? null : initialOpt === "owner_delivers" ? "Não" : "Sim", detail: c?.initial_cleaning_notes, open: "decisions" },
    { label: "Enxoval", value: linen, detail: c?.linen_notes, open: "decisions" },
    { label: "Escopo da assessoria", value: c?.advisory_mode === "implementation_only" ? "Apenas implantação" : c?.advisory_mode === "full" ? "Assessoria completa" : null, open: "decisions" },
    { label: "Limpeza comercial", value: cleaningFee ? `Sim · ${cleaningFee}` : null, section: 2 },
    { label: "Objeto e responsabilidades", value: snap?.partnershipObject ? "Definido" : null, detail: snap?.partnershipObject, open: "terms" },
  ];

  const stepIcon = { owner: UserRound, doc: FileText, home: House, list: ListChecks } as Record<string, typeof FileText>;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-4">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold sm:text-[1.75rem]" style={display}>Condições comerciais</h2>
            <p className="hidden text-sm sm:block sm:text-base" style={muted}>O que foi acordado com o proprietário.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onHistory} className="flex h-10 flex-1 items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm sm:flex-none" style={{ ...border, ...navy }}>
              Histórico <ChevronDown className="ml-3 size-4" />
            </button>
          </div>
        </div>
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-none">
          {q.isLoading ? (
            <p className="text-sm" style={muted}>Carregando condições…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { l: "Administração", v: formatPercent(c?.administration_fee) },
                  { l: "Limpeza", v: cleaningFee },
                  { l: "Vigência", v: c?.duration_months ? `${c.duration_months} meses` : null },
                  { l: "Implantação", v: implTotal != null && implTotal > 0 ? formatBRL(Number(implTotal)) : null, paid: paidMap["implementation"]?.paid },
                ].map((k) => (
                  <div key={k.l} className="rounded-xl border bg-white px-3 py-2.5" style={border}>
                    <p className="text-[11px] font-medium uppercase tracking-wide" style={muted}>{k.l}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-lg font-semibold tabular-nums" style={k.v ? display : { ...display, color: "var(--ficha-pending-fg)" }}>
                      {k.v ?? TBD}
                      {k.paid && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}>Pago</span>}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={muted}>Alterações salvam sozinhas e já passam a valer.</p>
              <Block icon={<Banknote className="size-4" />} title="Valores e vigência">
                {values.map((r) => <ValueLine key={r.label} row={r} onEdit={() => (r.quick ? setQuick(r.quick) : edit())} />)}
              </Block>
              <Block icon={<FileText className="size-4" />} title="Condições do contrato">
                {clauses.map((r) => <ValueLine key={r.label} row={r} onEdit={() => { setEditFocus(r.section ?? null); edit(); }} />)}
              </Block>
              <Block icon={<Settings2 className="size-4" />} title="Preparação e serviços">
                {services.map((r) => <ValueLine key={r.label} row={r} onEdit={() => { if (r.open) { setPop(r.open); return; } setEditFocus(r.section ?? null); edit(); }} />)}
              </Block>
            </>
          )}
          {extras}
        </div>
        <QuickEditDialog implementationId={implementationId} field={quick} row={q.data} onClose={() => setQuick(null)} onFullEdit={edit} onNewVersion={() => { setQuick(null); setPop("services"); }} />
        <Dialog open={pop != null} onOpenChange={(o) => { if (!o) { setPop(null); void qc.invalidateQueries(); } }}>
          <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{pop ? POP_TITLE[pop][0] : ""}</DialogTitle>
              <DialogDescription>{pop ? POP_TITLE[pop][1] : ""}</DialogDescription>
            </DialogHeader>
            {pop === "decisions" && <ImplementationDecisionsPanel implementationId={implementationId} />}
            {(pop === "services" || pop === "terms") && <ProposalTab implementationId={implementationId} only={pop} />}
          </DialogContent>
        </Dialog>
        {editing && (
          <div className="hidden">
            <ContractConditionsPanel
              implementationId={implementationId}
              initialOpen
              focusSection={editFocus}
              onEditorClose={() => {
                setEditing(false);
                void qc.invalidateQueries({ queryKey: ["implementation-contract-conditions", implementationId] });
              }}
            />
          </div>
        )}
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
