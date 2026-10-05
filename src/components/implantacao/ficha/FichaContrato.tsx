import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BarChart3, ChevronDown, ChevronRight, ExternalLink, Eye, FileText, History, Plus, Users } from "lucide-react";
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
const navy = { color: "var(--stayo-navy)" };
const border = { borderColor: "var(--stayo-border)" };
const display = { fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "-0.01em", color: "var(--stayo-navy)" };
const days = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
const TBD = "A definir";

type Row = { label: string; value: ReactNode; detail?: string | null | undefined };

function IconDot({ children }: { children: ReactNode }) {
  return <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "var(--ficha-icon-bg)", color: "var(--ficha-icon-fg)" }}>{children}</span>;
}

function Block({ icon, title, subtitle, action, children }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white px-4 pb-2 pt-3 sm:px-5" style={border}>
      <div className="flex items-center justify-between gap-2 border-b pb-2.5" style={border}>
        <div className="flex min-w-0 items-center gap-3">
          <IconDot>{icon}</IconDot>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold" style={display}>{title}</h3>
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
    <li className="border-b last:border-b-0" style={{ ...border, backgroundColor: open ? "var(--ficha-subtle)" : undefined }}>
      <button
        type="button"
        disabled={!clickable}
        aria-expanded={expandable ? open : undefined}
        onClick={() => (expandable ? setOpen((o) => !o) : onEdit?.())}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-1 py-2 text-left text-sm disabled:cursor-default sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
      >
        <span className="font-medium" style={navy}>{row.label}</span>
        <span className="col-start-1 row-start-2 truncate sm:col-start-2 sm:row-start-1" style={muted}>{row.value ?? TBD}</span>
        <span className="row-span-2 sm:row-span-1" style={navy}>
          {expandable ? <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /> : onEdit ? <ChevronRight className="size-4" /> : <span className="block size-4" />}
        </span>
      </button>
      {expandable && open && (
        <div className="flex flex-col gap-2 px-3 pb-2.5 text-sm sm:flex-row sm:items-end sm:justify-between">
          <p style={muted}>{row.detail}</p>
          {onEdit && (
            <button type="button" onClick={onEdit} className="flex shrink-0 items-center gap-1.5 underline underline-offset-2" style={navy}>
              Ver cláusula <ExternalLink className="size-4" />
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
    <li className="border-b last:border-b-0" style={border}>
      <button type="button" disabled={!onClick} onClick={onClick} className="flex w-full items-center gap-3 py-2 text-left disabled:cursor-default">
        <span className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ backgroundColor: "var(--ficha-subtle)", ...navy }}>{initials(name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" style={navy}>{name}</span>
          <span className="block truncate text-xs" style={muted}>{role}</span>
        </span>
        <ChevronRight className="size-4" style={navy} />
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
    { key: "minuta", label: "Minuta", detail: "Cláusulas e condições do contrato.", done: false, next: { title: "Definir cláusulas", detail: "Ainda não há contrato gerado. As condições ficam registradas na proposta.", cta: "Definir cláusulas" } },
    { key: "revisao", label: "Revisão", detail: "Revisão do contrato — sem registro no sistema.", done: false, next: { title: "Revisar minuta", detail: "Monte a proposta com as condições acordadas.", cta: "Revisar minuta" } },
    { key: "envio", label: "Envio", detail: "Envio do contrato — sem registro no sistema.", done: false, next: { title: "Enviar ao proprietário", detail: "Publique a proposta para envio.", cta: "Abrir proposta" } },
    { key: "assinatura", label: "Assinatura", detail: "Assinatura do contrato — sem integração no sistema.", done: false, next: { title: "Assinatura fora do sistema", detail: "Ainda não há assinatura eletrônica integrada. O aceite da proposta não substitui a assinatura.", cta: "" } },
  ];
  const nextIdx = stages.findIndex((s) => !s.done);
  const current = stages[nextIdx]!;
  const runNext = current.key === "minuta" ? edit : onEditProposal;
  // Proposta publicada não é contrato enviado: não há registro de contrato.
  const status = "Não gerado";

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

  const clauses = [
    { label: "Objeto do contrato", value: object ? object.split(/[.;\n]/)[0] : null, detail: object },
    { label: "Remuneração", value: fee ? `${fee} de administração` : null },
    { label: "Vigência e renovação", value: c?.duration_months ? `${c.duration_months} meses` : null, detail: c?.notice_period_days ? `Aviso prévio de ${days(c.notice_period_days)} para encerrar.` : null },
    { label: "Uso pelo proprietário", value: ownerUse, detail: ownerUseDetail || null },
    { label: "Repasse", value: c?.payout_rule ? c.payout_rule.split(/[.;]/)[0] : null, detail: c?.payout_rule },
    { label: "Exclusividade", value: c?.exclusivity == null ? null : c.exclusivity ? "Sim" : "Não" },
    ...(assignment ? [{ label: "Cessão a terceiros", value: ASSIGNMENT_LABELS[assignment], detail: [c?.assignment_who, c?.assignment_procedure].filter(Boolean).join(" ") || null }] : []),
    ...(c?.turnover_cleaning_team || payer ? [{ label: "Limpeza das hospedagens", value: c?.turnover_cleaning_team || null, detail: payer ? TURNOVER_PAYER_LABELS[payer] : null }] : []),
  ];

  const statusColor = "var(--ficha-pending-fg)";
  const statusDot = (
    <span className="inline-flex items-center gap-2" style={{ color: statusColor }}>
      <span className="size-2.5 rounded-full" style={{ backgroundColor: statusColor }} />
      {status}
    </span>
  );
  const primary = { backgroundColor: "var(--stayo-navy)", color: "var(--admin-surface, #fff)" };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold sm:text-3xl" style={display}>Contrato</h2>
          <p className="text-sm sm:text-base" style={muted}>Documento, partes e andamento do contrato.</p>
        </div>
        <div className="flex gap-2">
          <span className="flex h-11 min-w-36 flex-1 items-center gap-2 rounded-lg border bg-white px-4 text-sm sm:flex-none" style={{ ...border, ...navy }}>
            <span className="size-2.5 rounded-full" style={{ backgroundColor: statusColor }} /> {status}
          </span>
          {current.next.cta && (
            <button type="button" onClick={runNext} className="flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium" style={primary}>
              <FileText className="size-4" /> {current.next.cta}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(18rem,1fr)]">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          <Block
            icon={<FileText className="size-4" />}
            title="Contrato de gestão STAYO"
            subtitle="Versão disponível após a geração do contrato"
            action={
              <Button variant="outline" size="sm" className="h-9 bg-white" style={navy} disabled={!docVersion || pdf.isPending} onClick={() => docVersion && pdf.mutate(docVersion)}>
                <Eye /> {pdf.isPending ? "Gerando…" : "Visualizar"}
              </Button>
            }
          >
            <ul className="text-sm">
              <li className="grid grid-cols-[1fr_auto] border-b px-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]" style={border}>
                <span className="font-medium" style={navy}>Status</span><span>{statusDot}</span><span className="hidden size-4 sm:block" />
              </li>
              <Line row={{ label: "Vigência", value: c?.duration_months ? `${c.duration_months} meses` : null }} />
              <Line row={{ label: "Início", value: null }} />
              <Line row={{ label: "Término", value: null }} />
            </ul>
          </Block>

          <Block icon={<Users className="size-4" />} title="Partes">
            <ul>
              <Party name="STAYO" role="Administradora" />
              <Party name={ownerName || "Proprietário não informado"} role="Proprietário(a)" onClick={onGoOwner} />
              {(proposal?.requiredSignatories ?? []).map((s, i) => (
                <Party key={`${s.label}-${i}`} name={s.label} role={s.role || "Signatário"} onClick={onEditProposal} />
              ))}
            </ul>
            <button type="button" onClick={onEditProposal} className="mb-2 mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg border border-dashed px-3 text-sm" style={{ ...border, ...navy }}>
              <Plus className="size-4" /> Adicionar parte
            </button>
          </Block>

          <Block icon={<FileText className="size-4" />} title="Cláusulas">
            {q.isLoading ? (
              <p className="py-2 text-sm" style={muted}>Carregando…</p>
            ) : (
              <ul>
                {(clauses as Row[]).map((r) => <Line key={r.label} row={r} onEdit={r.label === "Objeto do contrato" ? onEditProposal : edit} />)}
              </ul>
            )}
          </Block>
        </div>

        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <section className="rounded-xl border bg-white px-4 py-3 sm:px-5" style={border}>
            <div className="flex items-center gap-3 border-b pb-2.5" style={border}>
              <span style={navy}><BarChart3 className="size-5" /></span>
              <h3 className="text-lg font-semibold" style={display}>Andamento</h3>
            </div>
            <ol className="flex flex-col pt-3">
              {stages.map((s, i) => {
                const isNext = i === nextIdx;
                const ring = s.done ? "var(--ficha-ok)" : isNext ? "var(--ficha-pending-fg)" : "var(--stayo-border)";
                return (
                  <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < stages.length - 1 && <span className="absolute left-[10px] top-6 h-[calc(100%-1rem)] w-0.5" style={{ backgroundColor: "var(--stayo-border)" }} />}
                    <span className="relative z-10 mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-2 bg-white" style={{ borderColor: ring }}>
                      {(s.done || isNext) && <span className="size-2.5 rounded-full" style={{ backgroundColor: ring }} />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold" style={navy}>{s.label}</p>
                      <p className="text-xs" style={muted}>{s.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg p-3" style={{ backgroundColor: "var(--ficha-pending-bg)" }}>
              <AlertCircle className="size-5" style={{ color: "var(--ficha-pending-fg)" }} />
              <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={navy}>Próximo passo</p>
                  <p className="text-xs" style={navy}>{current.next.detail}</p>
                </div>
                {current.next.cta && (
                  <button type="button" onClick={runNext} className="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium" style={primary}>
                    <FileText className="size-4" /> {current.next.cta}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white px-4 py-3 sm:px-5" style={border}>
            <div className="flex items-center gap-3 border-b pb-2.5" style={border}>
              <span style={navy}><FileText className="size-5" /></span>
              <h3 className="text-lg font-semibold" style={display}>Documentos</h3>
            </div>
            {docVersion ? (
              <button type="button" onClick={() => pdf.mutate(docVersion)} className="mt-3 grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 text-left text-sm" style={border}>
                <span className="truncate" style={navy}>Proposta · v{docVersion.version} (PDF)</span>
                <span style={{ color: "var(--ficha-ok)" }} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: "var(--ficha-ok)" }} />Proposta publicada</span>
              </button>
            ) : (
              <p className="mt-3 text-sm" style={muted}>Nenhum documento publicado ainda.</p>
            )}
            {pdf.isError && <p className="mt-1 text-xs" style={{ color: "var(--stayo-danger)" }}>Não foi possível gerar o documento.</p>}
            <button type="button" disabled={!docVersion} onClick={() => docVersion && pdf.mutate(docVersion)} className="mt-2 flex w-full items-center justify-between py-2.5 text-left disabled:opacity-50">
              <span className="flex items-center gap-3 text-sm underline underline-offset-2" style={navy}><ExternalLink className="size-4" /> Ver documentos</span>
              <ChevronRight className="size-4" style={navy} />
            </button>
          </section>

          <button type="button" onClick={onHistory} className="flex min-h-14 items-center gap-3 rounded-xl border bg-white px-4 text-left text-sm" style={border}>
            <History className="size-5" style={navy} /> <span className="flex-1 underline underline-offset-2" style={navy}>Ver histórico do contrato</span> <ChevronRight className="size-4" style={navy} />
          </button>
        </aside>
      </div>
    </div>
  );
}
