import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BarChart3, ChevronDown, ChevronRight, Eye, FileText, History, Pencil, Plus, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  ASSIGNMENT_LABELS,
  OWNER_USE_LIMIT_LABELS,
  TURNOVER_PAYER_LABELS,
  formatPercent,
  type AssignmentMode,
  type OwnerUseLimitMode,
  type TurnoverPayer,
} from "../../../lib/contract-conditions";
import { ContractConditionsPanel } from "../ContractConditionsPanel";
import type { CommercialProposalVersion } from "../../../types/commercial-proposal";

const muted = { color: "var(--stayo-ink-muted)" };
const border = { borderColor: "var(--stayo-border)" };
const days = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
const TBD = "A definir";

type Row = { label: string; value: string | null | undefined; detail?: string | null };

function Block({ icon, title, subtitle, action, children }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border bg-white px-4 py-3 sm:px-5" style={border}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-forest)" }}>{icon}</span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{title}</h3>
            {subtitle && <p className="truncate text-xs" style={muted}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Line({ row, onEdit }: { row: Row; onEdit?: () => void }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(row.detail);
  const clickable = expandable || Boolean(onEdit);
  return (
    <li style={border}>
      <button
        type="button"
        disabled={!clickable}
        aria-expanded={expandable ? open : undefined}
        onClick={() => (expandable ? setOpen((o) => !o) : onEdit?.())}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-2.5 text-left text-sm disabled:cursor-default sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]"
      >
        <span className="font-medium">{row.label}</span>
        <span className="col-start-1 row-start-2 truncate sm:col-start-2 sm:row-start-1" style={{ color: row.value ? "var(--stayo-ink-muted)" : "var(--stayo-warning, var(--stayo-ink-muted))" }}>
          {row.value ?? TBD}
        </span>
        <span className="row-span-2 sm:row-span-1" style={muted}>
          {expandable ? <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> : onEdit ? <ChevronRight className="size-4" /> : null}
        </span>
      </button>
      {expandable && open && (
        <div className="mb-2.5 flex flex-col gap-2 rounded-md px-3 py-2 text-sm sm:flex-row sm:items-start sm:justify-between" style={{ backgroundColor: "var(--stayo-bg)" }}>
          <p style={muted}>{row.detail}</p>
          {onEdit && (
            <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1 font-medium underline underline-offset-2">
              <Pencil className="size-3.5" /> Editar cláusula
            </button>
          )}
        </div>
      )}
    </li>
  );
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

function Party({ name, role, onClick }: { name: string; role: string; onClick?: () => void }) {
  return (
    <li style={border}>
      <button type="button" disabled={!onClick} onClick={onClick} className="flex w-full items-center gap-3 py-2 text-left disabled:cursor-default">
        <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-navy)" }}>{initials(name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs" style={muted}>{role}</span>
        </span>
        {onClick && <ChevronRight className="size-4" style={muted} />}
      </button>
    </li>
  );
}

type Stage = { key: string; label: string; detail: string; done: boolean; next: { title: string; detail: string; cta: string } };

export function FichaContrato({
  implementationId,
  implementationCode,
  ownerName,
  proposal,
  onGoOwner,
  onEditProposal,
  onHistory,
}: {
  implementationId: string;
  implementationCode: string | null | undefined;
  ownerName: string | null | undefined;
  proposal: CommercialProposalVersion | null;
  onGoOwner: () => void;
  onEditProposal: () => void;
  onHistory: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const q = useQuery({
    queryKey: ["implementation-contract-conditions", implementationId, "contrato-view"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("implementation_contract_conditions").select("*").eq("implementation_id", implementationId).maybeSingle();
      return data;
    },
  });

  const pdf = useMutation({
    mutationFn: async (version: CommercialProposalVersion) => {
      if (!version.snapshot) throw new Error("Versão sem documento publicado.");
      const { generatePublishedProposalPdf } = await import("../../../lib/pdf/proposal-pdf");
      const bytes = await generatePublishedProposalPdf({ snapshot: version.snapshot });
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
          <ArrowLeft className="size-4" /> Voltar ao contrato
        </button>
        <section className="rounded-[var(--radius-card)] border bg-white p-4 sm:p-5" style={border}>
          <ContractConditionsPanel implementationId={implementationId} showMeetings={false} />
        </section>
      </div>
    );

  const c = q.data;
  const edit = () => setEditing(true);
  const hasConditions = Boolean(c && (c.administration_fee != null || c.turnover_cleaning_fee != null || c.payout_rule || c.duration_months != null));
  const published = Boolean(proposal?.publishedAt);
  const docVersion = proposal?.snapshot ? proposal : null;

  // Somente estados reais. Assinatura nunca é marcada: não existe registro de assinatura no sistema.
  const stages: Stage[] = [
    { key: "minuta", label: "Minuta", detail: "Cláusulas e condições do contrato.", done: hasConditions, next: { title: "Definir cláusulas", detail: "Registre as condições antes de montar a proposta.", cta: "Definir cláusulas" } },
    { key: "revisao", label: "Revisão", detail: "Termos revisados na proposta.", done: Boolean(proposal), next: { title: "Revisar minuta", detail: "Monte a proposta com as condições acordadas.", cta: "Revisar minuta" } },
    { key: "envio", label: "Envio", detail: "Proposta publicada para o proprietário.", done: published, next: { title: "Enviar ao proprietário", detail: "Publique a proposta para envio.", cta: "Abrir proposta" } },
    { key: "assinatura", label: "Assinatura", detail: "Assinatura do contrato — sem integração no sistema.", done: false, next: { title: "Assinatura fora do sistema", detail: "Ainda não há assinatura eletrônica integrada. O aceite da proposta não substitui a assinatura.", cta: "" } },
  ];
  const nextIdx = stages.findIndex((s) => !s.done);
  const current = stages[nextIdx]!;
  const runNext = current.key === "minuta" ? edit : onEditProposal;
  const status = !hasConditions ? "Rascunho" : !proposal ? "Minuta" : !published ? "Em revisão" : "Enviado";

  const ownerUseMode = c?.owner_use_limit_mode as OwnerUseLimitMode | null | undefined;
  const ownerUse =
    ownerUseMode === "limited" && c?.owner_use_limit_days != null
      ? `Até ${days(c.owner_use_limit_days)}${c.owner_use_limit_period ? ` ${c.owner_use_limit_period}` : ""}`
      : ownerUseMode ? OWNER_USE_LIMIT_LABELS[ownerUseMode] : null;
  const ownerUseDetail = [c?.owner_use_notice_days != null ? `Pedido com ${days(c.owner_use_notice_days)} de antecedência.` : null, c?.owner_use_notes].filter(Boolean).join(" ");
  const payer = c?.turnover_cleaning_payer as TurnoverPayer | null | undefined;
  const assignment = c?.assignment_mode as AssignmentMode | null | undefined;
  const object = proposal?.snapshot?.partnershipObject?.trim() || proposal?.draftPartnershipObject?.trim() || null;
  const fee = formatPercent(c?.administration_fee);

  const clauses: Row[] = [
    { label: "Objeto do contrato", value: object ? object.split(/[.;\n]/)[0] : null, detail: object },
    { label: "Remuneração", value: fee ? `${fee} de administração` : null },
    { label: "Vigência e renovação", value: c?.duration_months ? `${c.duration_months} meses` : null, detail: c?.notice_period_days ? `Aviso prévio de ${days(c.notice_period_days)} para encerrar.` : null },
    { label: "Uso pelo proprietário", value: ownerUse, detail: ownerUseDetail || null },
    { label: "Repasse", value: c?.payout_rule ? c.payout_rule.split(/[.;]/)[0] : null, detail: c?.payout_rule },
    { label: "Exclusividade", value: c?.exclusivity == null ? null : c.exclusivity ? "Sim" : "Não" },
    ...(assignment ? [{ label: "Cessão a terceiros", value: ASSIGNMENT_LABELS[assignment], detail: [c?.assignment_who, c?.assignment_procedure].filter(Boolean).join(" ") || null }] : []),
    ...(c?.turnover_cleaning_team || payer ? [{ label: "Limpeza das hospedagens", value: c?.turnover_cleaning_team || null, detail: payer ? TURNOVER_PAYER_LABELS[payer] : null }] : []),
  ];

  const statusDot = (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ backgroundColor: published ? "var(--stayo-success)" : "var(--stayo-warning)" }} />
      {status}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--stayo-font-display)" }}>Contrato</h2>
          <p className="text-sm" style={muted}>Documento, partes e andamento do contrato.</p>
        </div>
        {current.cta && (
          <Button className="min-h-11" onClick={runNext}>
            <FileText /> {current.cta}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <Block
            icon={<FileText className="size-4" />}
            title="Contrato de gestão STAYO"
            subtitle={proposal ? `Versão ${proposal.version} · baseada na proposta` : "Sem versão"}
            action={
              <Button variant="outline" size="sm" disabled={!docVersion || pdf.isPending} onClick={() => docVersion && pdf.mutate(docVersion)}>
                <Eye /> {pdf.isPending ? "Gerando…" : "Visualizar"}
              </Button>
            }
          >
            <ul className="divide-y text-sm" style={border}>
              <li className="grid grid-cols-[1fr_auto] py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]" style={border}>
                <span className="font-medium">Status</span><span style={muted}>{statusDot}</span>
              </li>
              <Line row={{ label: "Vigência", value: c?.duration_months ? `${c.duration_months} meses` : null }} onEdit={edit} />
              <Line row={{ label: "Início", value: null }} />
              <Line row={{ label: "Término", value: null }} />
            </ul>
          </Block>

          <Block icon={<Users className="size-4" />} title="Partes">
            <ul className="divide-y" style={border}>
              <Party name="STAYO" role="Administradora" />
              <Party name={ownerName || "Proprietário não informado"} role="Proprietário" onClick={onGoOwner} />
              {(proposal?.requiredSignatories ?? []).map((s, i) => (
                <Party key={`${s.label}-${i}`} name={s.label} role={s.role || "Signatário"} onClick={onEditProposal} />
              ))}
            </ul>
            <button type="button" onClick={onEditProposal} className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-md border border-dashed px-3 text-sm" style={border}>
              <Plus className="size-4" /> Adicionar parte
            </button>
          </Block>

          <Block icon={<FileText className="size-4" />} title="Cláusulas">
            {q.isLoading ? (
              <p className="py-2 text-sm" style={muted}>Carregando…</p>
            ) : (
              <ul className="divide-y" style={border}>
                {clauses.map((r) => <Line key={r.label} row={r} onEdit={r.label === "Objeto do contrato" ? onEditProposal : edit} />)}
              </ul>
            )}
          </Block>
        </div>

        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <section className="rounded-[var(--radius-card)] border bg-white px-4 py-3 sm:px-5" style={border}>
            <h3 className="flex items-center gap-2 pb-3 text-base font-semibold"><BarChart3 className="size-4" style={{ color: "var(--stayo-forest)" }} /> Andamento</h3>
            <ol className="flex flex-col">
              {stages.map((s, i) => {
                const isNext = i === nextIdx;
                return (
                  <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < stages.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px" style={{ backgroundColor: "var(--stayo-border)" }} />}
                    <span
                      className="relative z-10 mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border-2 bg-white text-[10px]"
                      style={{ borderColor: s.done ? "var(--stayo-success)" : isNext ? "var(--stayo-warning)" : "var(--stayo-border)", backgroundColor: s.done ? "var(--stayo-success)" : "white", color: "white" }}
                    >
                      {s.done ? "✓" : isNext ? <span className="size-2 rounded-full" style={{ backgroundColor: "var(--stayo-warning)" }} /> : null}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={!s.done && !isNext ? muted : undefined}>{s.label}</p>
                      <p className="text-xs" style={muted}>{s.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex gap-2 rounded-md p-3" style={{ backgroundColor: "var(--stayo-warning-soft)" }}>
              <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--stayo-warning)" }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Próximo passo</p>
                <p className="text-xs" style={muted}>{current.next.detail}</p>
                {current.cta && (
                  <Button size="sm" className="mt-2" onClick={runNext}>{current.cta}</Button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-card)] border bg-white px-4 py-3 sm:px-5" style={border}>
            <h3 className="flex items-center gap-2 pb-2 text-base font-semibold"><FileText className="size-4" /> Documentos</h3>
            {docVersion ? (
              <button type="button" onClick={() => pdf.mutate(docVersion)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-sm" style={border}>
                <span className="truncate">Proposta · v{docVersion.version} (PDF)</span>
                <Eye className="size-4" style={muted} />
              </button>
            ) : (
              <p className="text-sm" style={muted}>Nenhum documento publicado ainda.</p>
            )}
            {pdf.isError && <p className="mt-1 text-xs" style={{ color: "var(--stayo-danger)" }}>Não foi possível gerar o documento.</p>}
          </section>

          <button type="button" onClick={onHistory} className="flex min-h-12 items-center gap-2 rounded-[var(--radius-card)] border bg-white px-4 text-left text-sm underline-offset-2 hover:underline" style={border}>
            <History className="size-4" /> <span className="flex-1">Ver histórico do contrato</span> <ChevronRight className="size-4" style={muted} />
          </button>
        </aside>
      </div>
    </div>
  );
}
