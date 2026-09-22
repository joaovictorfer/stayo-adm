import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Plus,
  Save,
  Settings2,
  Share2,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { ErrorRows, Panel } from "../data/ListStates";
import {
  adminApi,
  commercialTermsQuery,
  implementationQuery,
  outboxQuery,
  proposalShareLinkQuery,
  proposalsByImplementationQuery,
} from "../../lib/api/queries";
import { proposalItemTotal, proposalShareStore, proposalsStore } from "../../lib/api/local-store";
import { generateProposalPdf } from "../../lib/pdf/proposal-pdf";
import { buildWhatsappDeepLink } from "../../lib/whatsapp/gateway";
import { proposalReadyMessage } from "../../lib/whatsapp/templates";
import type { OutboundMessage } from "../../types/admin";
import type { EntityId, ProposalItem } from "../../types/core";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface DraftItem {
  description: string;
  quantity: number;
  unitValue: number;
  discount: number;
}

const emptyDraftItem: DraftItem = { description: "", quantity: 1, unitValue: 0, discount: 0 };
type SectionKey = "services" | "conditions" | "responsibilities" | "schedule" | "terms";

export function ProposalTab({ implementationId }: { implementationId: EntityId }) {
  const queryClient = useQueryClient();
  const query = useQuery(proposalsByImplementationQuery(implementationId));
  const commercialTermsQ = useQuery(commercialTermsQuery(implementationId));
  const implementationQ = useQuery(implementationQuery(implementationId));
  const versions = query.data ?? [];
  const latest = versions[0];
  const shareLinkQ = useQuery({
    ...proposalShareLinkQuery(latest?.id ?? ""),
    enabled: Boolean(latest),
  });
  const outboxQ = useQuery(outboxQuery(implementationId));
  const lastMessage = (outboxQ.data ?? [])[0];

  const [draft, setDraft] = useState<DraftItem[]>([{ ...emptyDraftItem }]);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [modal, setModal] = useState<"items" | "settings" | null>(null);

  useEffect(() => {
    if (latest && latest.version !== loadedVersion) {
      setLoadedVersion(latest.version);
      setDraft(
        latest.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitValue: item.unitValue,
          discount: item.discount,
        })),
      );
    }
  }, [latest, loadedVersion]);

  const recurringTerms = (commercialTermsQ.data ?? []).filter(
    (term) => term.chargeType !== "fixed_once",
  );
  const fixedTerms = (commercialTermsQ.data ?? []).filter(
    (term) => term.chargeType === "fixed_once",
  );
  const filledItems = draft.filter((item) => item.description.trim() !== "");
  const total = draft.reduce((sum, item) => sum + proposalItemTotal(item), 0);
  const administrationTerm = recurringTerms.find((term) =>
    term.chargeType === "percentage" && term.label.toLocaleLowerCase("pt-BR").includes("administra"),
  );
  const conditionsSummary = administrationTerm
    ? `Administração ${administrationTerm.value}%${recurringTerms.length > 1 ? " + demais condições" : ""}`
    : recurringTerms.length > 0
      ? `${recurringTerms.length} condições definidas`
      : "Condições ainda não definidas";

  const save = useMutation({
    mutationFn: async () => {
      const items: ProposalItem[] = filledItems.map((item) => ({
        ...item,
        total: proposalItemTotal(item),
      }));
      return proposalsStore.createVersion(implementationId, items);
    },
    onSuccess: async (proposal) => {
      setLoadedVersion(proposal.version);
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  const createPreviewLink = useMutation({
    mutationFn: async () => {
      if (!latest) throw new Error("Proposta ausente");
      if (shareLinkQ.data) return shareLinkQ.data;
      const link = await proposalShareStore.createLinkForProposal(latest.id, implementationId);
      await queryClient.invalidateQueries({ queryKey: ["proposal-share", "link", latest.id] });
      return link;
    },
    onSuccess: (link) => {
      window.open(`${window.location.origin}/portal/proposta/${link.token}`, "_blank", "noopener,noreferrer");
    },
  });

  const downloadPdf = useMutation({
    mutationFn: async () => {
      if (!latest || !implementationQ.data) throw new Error("Proposta ou implantação ausente");
      const portalUrl = shareLinkQ.data
        ? `${window.location.origin}/portal/proposta/${shareLinkQ.data.token}`
        : null;
      const bytes = await generateProposalPdf({
        implementation: implementationQ.data,
        proposal: latest,
        recurringTerms,
        portalUrl,
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `proposta-${implementationQ.data.code}-v${latest.version}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const prepareWhatsapp = useMutation({
    mutationFn: async () => {
      if (!implementationQ.data) throw new Error("Implantação ausente");
      const owner = implementationQ.data;
      let portalUrl: string | null = shareLinkQ.data
        ? `${window.location.origin}/portal/proposta/${shareLinkQ.data.token}`
        : null;
      if (!portalUrl && latest) {
        const link = await proposalShareStore.createLinkForProposal(latest.id, implementationId);
        portalUrl = `${window.location.origin}/portal/proposta/${link.token}`;
        await queryClient.invalidateQueries({ queryKey: ["proposal-share", "link", latest.id] });
      }
      const body = proposalReadyMessage({
        ownerFirstName: owner.ownerName ?? "proprietário",
        portalUrl,
      });
      const message = await adminApi.outbox.enqueue({
        implementationId,
        ownerId: owner.ownerId,
        destination: owner.ownerPhone ?? "",
        template: "proposal_ready",
        body,
      });
      await adminApi.audit.log({
        actorId: null,
        event: "proposal.sent",
        entityType: "proposal",
        entityId: latest?.id ?? null,
        metadata: { implementationId, channel: "whatsapp" },
      });
      return message;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["outbox", implementationId] });
    },
  });

  const update = (index: number, patch: Partial<DraftItem>) =>
    setDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );

  const addFixedTerms = () => {
    const existingLabels = new Set(draft.map((item) => item.description));
    const newItems = fixedTerms
      .filter((term) => !existingLabels.has(term.label))
      .map((term) => ({
        description: term.label,
        quantity: 1,
        unitValue: term.value,
        discount: 0,
      }));
    if (newItems.length > 0) {
      setDraft((current) => [
        ...current.filter((item) => item.description.trim() !== ""),
        ...newItems,
      ]);
    }
  };

  if (query.isError) {
    return (
      <Panel>
        <ErrorRows onRetry={() => void query.refetch()} />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {latest?.acceptedAt && (
        <div
          className="rounded-[var(--radius-card)] border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--stayo-success)",
            backgroundColor: "var(--stayo-forest-soft)",
            color: "var(--stayo-success)",
          }}
        >
          Proposta versão {latest.version} aceita
          {latest.acceptedName ? ` por ${latest.acceptedName}` : " pelo proprietário"} em {" "}
          {new Date(latest.acceptedAt).toLocaleString("pt-BR")}.
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--stayo-forest)" }}>
              Proposta comercial
            </p>
            <h2 className="mt-1 text-xl" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>
              {latest ? `Versão ${latest.version} em edição` : "Primeira versão"}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              Revise os principais pontos e abra apenas o bloco que deseja alterar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {latest && (
              <ActionButton onClick={() => createPreviewLink.mutate()} disabled={createPreviewLink.isPending}>
                <Eye size={16} />
                {createPreviewLink.isPending ? "Abrindo..." : "Visualizar"}
              </ActionButton>
            )}
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || filledItems.length === 0}
              className="flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
            >
              <Save size={16} />
              {save.isPending ? "Salvando..." : "Salvar versão"}
            </button>
            {latest && (
              <ActionButton onClick={() => downloadPdf.mutate()} disabled={downloadPdf.isPending || !implementationQ.data}>
                <FileText size={16} />
                {downloadPdf.isPending ? "Gerando..." : "Gerar documento"}
              </ActionButton>
            )}
            {latest && (
              <ActionButton onClick={() => prepareWhatsapp.mutate()} disabled={prepareWhatsapp.isPending}>
                <Share2 size={16} />
                {prepareWhatsapp.isPending ? "Preparando..." : "Compartilhar"}
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <ProposalSection
          title="Serviços e valores"
          summary={currency.format(total)}
          description="Itens que compõem o valor desta proposta."
          open={openSection === "services"}
          onToggle={() => setOpenSection(openSection === "services" ? null : "services")}
          onEdit={() => setModal("items")}
        >
          <div className="flex flex-col gap-3">
            {filledItems.length === 0 ? (
              <EmptySection text="Nenhum serviço adicionado ainda." />
            ) : (
              <div className="divide-y rounded-[var(--radius-control)] border" style={{ borderColor: "var(--stayo-border)" }}>
                {filledItems.map((item, index) => (
                  <div key={`${item.description}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
                    <div>
                      <p style={{ color: "var(--stayo-ink)" }}>{item.description}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                        {item.quantity} × {currency.format(item.unitValue)}{item.discount > 0 ? ` · desconto de ${currency.format(item.discount)}` : ""}
                      </p>
                    </div>
                    <strong style={{ color: "var(--stayo-ink)" }}>{currency.format(proposalItemTotal(item))}</strong>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setModal("items")} className="self-start text-xs font-medium underline" style={{ color: "var(--stayo-forest)" }}>
              Editar serviços e valores
            </button>
          </div>
        </ProposalSection>

        <ProposalSection
          title="Condições comerciais"
          summary={conditionsSummary}
          description="Taxas, repasses e demais regras aplicadas à implantação."
          open={openSection === "conditions"}
          onToggle={() => setOpenSection(openSection === "conditions" ? null : "conditions")}
          onEdit={() => setModal("settings")}
        >
          {recurringTerms.length > 0 ? (
            <ul className="divide-y rounded-[var(--radius-control)] border" style={{ borderColor: "var(--stayo-border)" }}>
              {recurringTerms.map((term) => (
                <li key={term.id} className="flex justify-between gap-3 px-3 py-3 text-sm" style={{ borderColor: "var(--stayo-border)" }}>
                  <span style={{ color: "var(--stayo-ink)" }}>{term.label}</span>
                  <strong style={{ color: "var(--stayo-ink)" }}>{term.chargeType === "percentage" ? `${term.value}%` : currency.format(term.value)}</strong>
                </li>
              ))}
            </ul>
          ) : <EmptySection text="Nenhuma condição recorrente cadastrada." />}
          <EditLink onClick={() => setModal("settings")}>Abrir configurações comerciais</EditLink>
        </ProposalSection>

        <ProposalSection
          title="Responsabilidades"
          summary={`${filledItems.length} ${filledItems.length === 1 ? "item definido" : "itens definidos"}`}
          description="Serviços e entregas considerados no escopo comercial."
          open={openSection === "responsibilities"}
          onToggle={() => setOpenSection(openSection === "responsibilities" ? null : "responsibilities")}
          onEdit={() => setModal("items")}
        >
          {filledItems.length > 0 ? (
            <ul className="space-y-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
              {filledItems.map((item, index) => <li key={`${item.description}-${index}`} className="flex gap-2"><span style={{ color: "var(--stayo-forest)" }}>•</span><span>{item.description}</span></li>)}
            </ul>
          ) : <EmptySection text="Adicione serviços para definir as responsabilidades e inclusos." />}
          <EditLink onClick={() => setModal("items")}>Editar inclusos</EditLink>
        </ProposalSection>

        <ProposalSection
          title="Prazo e pagamento"
          summary={implementationQ.data?.completionDateEstimate ? `Até ${new Date(implementationQ.data.completionDateEstimate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : "Prazo a definir"}
          description="Prazos conhecidos e orientação para a negociação."
          open={openSection === "schedule"}
          onToggle={() => setOpenSection(openSection === "schedule" ? null : "schedule")}
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2" style={{ color: "var(--stayo-ink)" }}>
            <SummaryField label="Início estimado" value={implementationQ.data?.startDateEstimate ?? "Não informado"} />
            <SummaryField label="Conclusão estimada" value={implementationQ.data?.completionDateEstimate ?? "Não informado"} />
            <div className="sm:col-span-2 rounded-[var(--radius-control)] border p-3" style={{ borderColor: "var(--stayo-border)" }}>
              <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Pagamento</p>
              <p className="mt-1">Consulte as condições comerciais acima para os valores recorrentes e fixos.</p>
            </div>
          </div>
        </ProposalSection>

        <ProposalSection
          title="Termos"
          summary="Padrão Stayo"
          description="Informações importantes para leitura da proposta."
          open={openSection === "terms"}
          onToggle={() => setOpenSection(openSection === "terms" ? null : "terms")}
        >
          <ul className="space-y-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
            <li className="flex gap-2"><span style={{ color: "var(--stayo-forest)" }}>•</span><span>Cada salvamento cria uma nova versão; versões anteriores não são sobrescritas.</span></li>
            <li className="flex gap-2"><span style={{ color: "var(--stayo-forest)" }}>•</span><span>Os termos recorrentes não entram no total dos serviços fixos.</span></li>
          </ul>
        </ProposalSection>
      </div>

      <div id="configuracoes-avancadas">
        {lastMessage && <WhatsappSendPanel message={lastMessage} />}
        {latest && <ShareLinkPanel implementationId={implementationId} proposalId={latest.id} />}
      </div>

      <section id="historico-propostas" className="rounded-[var(--radius-card)] border" style={surface}>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--stayo-border)" }}>
          <SectionHeading title="Histórico de versões" subtitle="Consulte as versões salvas desta proposta." />
        </div>
        {query.isPending ? (
          <div className="space-y-3 p-4">{Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-5 w-full animate-pulse rounded" style={{ backgroundColor: "var(--stayo-border)" }} />)}</div>
        ) : versions.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--stayo-ink-muted)" }}>Nenhuma versão de proposta salva ainda.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {versions.map((proposal) => (
              <li key={proposal.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>Versão {proposal.version}</span>
                  <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{new Date(proposal.createdAt).toLocaleString("pt-BR")}</span>
                  {proposal.acceptedAt && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-success)" }}>Aceita</span>}
                  <span className="ml-auto text-sm" style={{ color: "var(--stayo-ink)" }}>{currency.format(proposal.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{modal === "settings" ? "Configurações da proposta" : "Serviços e valores"}</DialogTitle>
            <DialogDescription>
              {modal === "settings" ? "Adicione condições fixas à proposta e consulte as configurações comerciais cadastradas." : "Crie, ajuste ou remova os itens que compõem esta versão."}
            </DialogDescription>
          </DialogHeader>
          {modal === "settings" ? (
            <SettingsModal fixedTerms={fixedTerms} onAddFixedTerms={addFixedTerms} onClose={() => setModal(null)} />
          ) : (
            <ItemsModal draft={draft} update={update} onAdd={() => setDraft((current) => [...current, { ...emptyDraftItem }])} onRemove={(index) => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} onClose={() => setModal(null)} total={total} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60" style={{ ...surface, color: "var(--stayo-forest)" }}>{children}</button>;
}

function ProposalSection({ title, summary, description, open, onToggle, onEdit, children }: { title: string; summary: string; description: string; open: boolean; onToggle: () => void; onEdit?: () => void; children: ReactNode }) {
  return <section className="overflow-hidden rounded-[var(--radius-card)] border" style={surface}>
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-[var(--stayo-bg)]">
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>{title}</span><span className="mt-1 block text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{summary}</span></span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}><ChevronDown size={16} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></span>
    </button>
    {open && <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: "var(--stayo-border)" }}><p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{description}</p>{children}{onEdit && <button type="button" onClick={onEdit} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium underline" style={{ color: "var(--stayo-forest)" }}><Settings2 size={13} />Editar bloco</button>}</div>}
  </section>;
}

function ItemsModal({ draft, update, onAdd, onRemove, onClose, total }: { draft: DraftItem[]; update: (index: number, patch: Partial<DraftItem>) => void; onAdd: () => void; onRemove: (index: number) => void; onClose: () => void; total: number }) {
  return <div className="flex flex-col gap-4"><div className="overflow-x-auto rounded-[var(--radius-control)] border" style={{ borderColor: "var(--stayo-border)" }}><table className="w-full min-w-[ fortyrem] text-sm"><thead><tr className="border-b text-left text-xs" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}><th className="px-3 py-2">Descrição</th><th className="px-3 py-2 text-right">Qtd.</th><th className="px-3 py-2 text-right">Unitário</th><th className="px-3 py-2 text-right">Desconto</th><th className="px-3 py-2 text-right">Total</th><th /></tr></thead><tbody className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>{draft.map((item, index) => <tr key={index}><td className="px-3 py-2"><input value={item.description} onChange={(event) => update(index, { description: event.target.value })} placeholder="Serviço" className="w-full rounded-[var(--radius-control)] border px-2 py-2 text-sm outline-none" style={{ ...surface, color: "var(--stayo-ink)" }} /></td><td className="px-3 py-2"><NumberCell value={item.quantity} onChange={(value) => update(index, { quantity: value })} /></td><td className="px-3 py-2"><NumberCell value={item.unitValue} onChange={(value) => update(index, { unitValue: value })} /></td><td className="px-3 py-2"><NumberCell value={item.discount} onChange={(value) => update(index, { discount: value })} /></td><td className="px-3 py-2 text-right" style={{ color: "var(--stayo-ink)" }}>{currency.format(proposalItemTotal(item))}</td><td className="px-3 py-2"><button type="button" onClick={() => onRemove(index)} className="p-1" style={{ color: "var(--stayo-danger)" }} aria-label="Remover item"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onAdd} className="flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={{ ...surface, color: "var(--stayo-forest)" }}><Plus size={15} />Adicionar serviço</button><div className="text-right"><p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Total da proposta</p><p className="text-xl" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>{currency.format(total)}</p></div></div><button type="button" onClick={onClose} className="self-end rounded-[var(--radius-control)] px-4 py-2 text-sm" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>Concluir edição</button></div>;
}

function SettingsModal({ fixedTerms, onAddFixedTerms, onClose }: { fixedTerms: Array<{ id: string; label: string; value: number }>; onAddFixedTerms: () => void; onClose: () => void }) {
  return <div className="flex flex-col gap-4"><div className="rounded-[var(--radius-control)] border p-4" style={{ borderColor: "var(--stayo-border)" }}><p className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>Condições fixas disponíveis</p><p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Use as condições cadastradas para preencher rapidamente os serviços de valor único.</p>{fixedTerms.length > 0 ? <ul className="mt-3 space-y-2">{fixedTerms.map((term) => <li key={term.id} className="flex justify-between gap-3 text-sm" style={{ color: "var(--stayo-ink)" }}><span>{term.label}</span><strong>{currency.format(term.value)}</strong></li>)}</ul> : <p className="mt-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>Nenhuma condição fixa cadastrada.</p>}</div><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} className="rounded-[var(--radius-control)] border px-4 py-2 text-sm" style={{ ...surface, color: "var(--stayo-ink-muted)" }}>Fechar</button>{fixedTerms.length > 0 && <button type="button" onClick={() => { onAddFixedTerms(); onClose(); }} className="rounded-[var(--radius-control)] px-4 py-2 text-sm" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>Adicionar condições fixas</button>}</div></div>;
}

function SummaryField({ label, value }: { label: string; value: string }) { return <div className="rounded-[var(--radius-control)] border p-3" style={{ borderColor: "var(--stayo-border)" }}><p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{label}</p><p className="mt-1">{value}</p></div>; }
function EditLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="mt-4 text-xs font-medium underline" style={{ color: "var(--stayo-forest)" }}>{children}</button>; }
function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-base" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>{title}</h2><p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{subtitle}</p></div>; }
function EmptySection({ text }: { text: string }) { return <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{text}</p>; }
function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <input type="number" min={0} step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="w-20 rounded-[var(--radius-control)] border px-2 py-2 text-right text-sm outline-none" style={{ ...surface, color: "var(--stayo-ink)" }} />; }

function ShareLinkPanel({ implementationId, proposalId }: { implementationId: EntityId; proposalId: EntityId }) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery(proposalShareLinkQuery(proposalId));
  const [copied, setCopied] = useState(false);
  const createLink = useMutation({ mutationFn: () => proposalShareStore.createLinkForProposal(proposalId, implementationId), onSuccess: (link) => queryClient.setQueryData(proposalShareLinkQuery(proposalId).queryKey, link) });
  const url = linkQuery.data ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/proposta/${linkQuery.data.token}` : null;
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* Link visível para cópia manual. */ } };
  return <div className="mt-4 rounded-[var(--radius-card)] border p-4" style={surface}><h2 className="mb-3 text-sm" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>Link para o proprietário</h2>{url ? <div className="flex flex-wrap items-center gap-2"><code className="flex-1 break-all rounded-[var(--radius-control)] border px-3 py-2 text-xs" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}>{url}</code><button type="button" onClick={() => void copy()} className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-2 text-sm" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar"}</button></div> : <button type="button" onClick={() => createLink.mutate()} disabled={createLink.isPending} className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>{createLink.isPending ? "Gerando..." : "Gerar link para o proprietário"}</button>}<p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>O link é fixo para esta versão da proposta.</p></div>;
}

function WhatsappSendPanel({ message }: { message: OutboundMessage }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(message.body); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* Texto visível para cópia manual. */ } };
  return <div className="rounded-[var(--radius-card)] border p-4" style={surface}><h2 className="mb-3 text-sm" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>Mensagem para o proprietário</h2><pre className="mb-3 whitespace-pre-wrap rounded-[var(--radius-control)] border p-3 text-xs" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}>{message.body}</pre><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copy()} className="flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={{ ...surface, color: "var(--stayo-forest)" }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar mensagem"}</button>{message.destination && <a href={buildWhatsappDeepLink(message.destination, message.body)} target="_blank" rel="noreferrer" className="rounded-[var(--radius-control)] px-3 py-2 text-sm" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>Abrir WhatsApp</a>}</div></div>;
}
