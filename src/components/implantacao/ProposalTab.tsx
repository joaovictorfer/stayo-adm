import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Save,
  Settings2,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";

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
  const total = draft.reduce((sum, item) => sum + proposalItemTotal(item), 0);

  const save = useMutation({
    mutationFn: async () => {
      const items: ProposalItem[] = draft
        .filter((item) => item.description.trim() !== "")
        .map((item) => ({ ...item, total: proposalItemTotal(item) }));
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
          Proposta (versão {latest.version}) aceita
          {latest.acceptedName ? ` por ${latest.acceptedName}` : " pelo proprietário"} em{" "}
          {new Date(latest.acceptedAt).toLocaleString("pt-BR")}.
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--stayo-forest)" }}>
              Proposta comercial
            </p>
            <h2
              className="mt-1 text-xl"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              {latest ? `Editando a partir da versão ${latest.version}` : "Primeira versão"}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              Organize os valores, condições e termos antes de compartilhar com o proprietário.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {latest && (
              <button
                type="button"
                onClick={() => createPreviewLink.mutate()}
                disabled={createPreviewLink.isPending}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
                style={{ ...surface, color: "var(--stayo-forest)" }}
              >
                <Eye size={16} />
                {createPreviewLink.isPending ? "Abrindo..." : "Visualizar"}
              </button>
            )}
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || draft.every((item) => item.description.trim() === "")}
              className="flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
            >
              <Save size={16} />
              {save.isPending ? "Salvando..." : "Salvar nova versão"}
            </button>
            {latest && (
              <button
                type="button"
                onClick={() => downloadPdf.mutate()}
                disabled={downloadPdf.isPending || !implementationQ.data}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
                style={{ ...surface, color: "var(--stayo-forest)" }}
              >
                <FileText size={16} />
                {downloadPdf.isPending ? "Gerando..." : "Gerar documento"}
              </button>
            )}
            {latest && (
              <button
                type="button"
                onClick={() => prepareWhatsapp.mutate()}
                disabled={prepareWhatsapp.isPending}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
                style={{ ...surface, color: "var(--stayo-forest)" }}
              >
                <Share2 size={16} />
                {prepareWhatsapp.isPending ? "Preparando..." : "Compartilhar"}
              </button>
            )}
            <details className="relative">
              <summary
                className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                style={{ ...surface, color: "var(--stayo-ink-muted)" }}
              >
                <Settings2 size={16} />
                Mais opções
                <ChevronDown size={14} />
              </summary>
              <div
                className="absolute right-0 z-10 mt-2 w-56 rounded-[var(--radius-control)] border p-2 shadow-lg"
                style={surface}
              >
                <a
                  href="#historico-propostas"
                  className="block rounded px-3 py-2 text-sm hover:bg-[var(--stayo-forest-soft)]"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  Histórico de versões
                </a>
                <a
                  href="/implantacao/templates"
                  className="block rounded px-3 py-2 text-sm hover:bg-[var(--stayo-forest-soft)]"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  Modelos e blocos
                </a>
                <a
                  href="#configuracoes-avancadas"
                  className="block rounded px-3 py-2 text-sm hover:bg-[var(--stayo-forest-soft)]"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  Configurações avançadas
                </a>
              </div>
            </details>
          </div>
        </div>
      </div>

      <section className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <SectionHeading title="Serviços e valores" subtitle="Defina os itens que compõem esta proposta." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr style={{ color: "var(--stayo-ink-muted)" }}>
                <th className="py-2 text-left text-xs font-normal">Descrição</th>
                <th className="py-2 text-right text-xs font-normal">Qtd.</th>
                <th className="py-2 text-right text-xs font-normal">Valor unitário</th>
                <th className="py-2 text-right text-xs font-normal">Desconto</th>
                <th className="py-2 text-right text-xs font-normal">Total</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
              {draft.map((item, index) => (
                <tr key={index}>
                  <td className="py-2 pr-2">
                    <input
                      value={item.description}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder="Serviço"
                      className="w-full rounded-[var(--radius-control)] border px-2 py-2 text-sm outline-none"
                      style={{ ...surface, color: "var(--stayo-ink)" }}
                    />
                  </td>
                  <td className="py-2 pr-2"><NumberCell value={item.quantity} onChange={(value) => update(index, { quantity: value })} /></td>
                  <td className="py-2 pr-2"><NumberCell value={item.unitValue} onChange={(value) => update(index, { unitValue: value })} /></td>
                  <td className="py-2 pr-2"><NumberCell value={item.discount} onChange={(value) => update(index, { discount: value })} /></td>
                  <td className="py-2 text-right" style={{ color: "var(--stayo-ink)" }}>{currency.format(proposalItemTotal(item))}</td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-xs underline"
                      style={{ color: "var(--stayo-danger)" }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft((current) => [...current, { ...emptyDraftItem }])}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
              style={{ ...surface, color: "var(--stayo-forest)" }}
            >
              Adicionar serviço
            </button>
            <button
              type="button"
              onClick={() => {
                const fixedTerms = (commercialTermsQ.data ?? []).filter((term) => term.chargeType === "fixed_once");
                const existingLabels = new Set(draft.map((item) => item.description));
                const newItems = fixedTerms
                  .filter((term) => !existingLabels.has(term.label))
                  .map((term) => ({ description: term.label, quantity: 1, unitValue: term.value, discount: 0 }));
                if (newItems.length > 0) setDraft((current) => [...current.filter((item) => item.description.trim() !== ""), ...newItems]);
              }}
              disabled={commercialTermsQ.isPending}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
              style={{ ...surface, color: "var(--stayo-forest)" }}
            >
              Adicionar condições fixas
            </button>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Total da proposta</p>
            <p className="text-2xl" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>{currency.format(total)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <InfoSection title="Condições comerciais" subtitle="Valores recorrentes e regras comerciais aplicadas à implantação.">
          {recurringTerms.length > 0 ? (
            <ul className="space-y-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
              {recurringTerms.map((term) => (
                <li key={term.id} className="flex justify-between gap-3 border-b pb-2 last:border-0 last:pb-0" style={{ borderColor: "var(--stayo-border)" }}>
                  <span>{term.label}</span>
                  <strong>{term.chargeType === "percentage" ? `${term.value}%` : currency.format(term.value)}</strong>
                </li>
              ))}
            </ul>
          ) : <EmptySection text="Nenhuma condição recorrente cadastrada." />}
        </InfoSection>
        <InfoSection title="Responsabilidades/inclusos" subtitle="Serviços fixos selecionados para compor a proposta.">
          {draft.filter((item) => item.description.trim() !== "").length > 0 ? (
            <ul className="space-y-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
              {draft.filter((item) => item.description.trim() !== "").map((item, index) => <li key={`${item.description}-${index}`}>• {item.description}</li>)}
            </ul>
          ) : <EmptySection text="Adicione serviços para definir os inclusos." />}
        </InfoSection>
        <InfoSection title="Prazo e pagamento" subtitle="Resumo operacional para orientar a negociação.">
          <div className="space-y-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
            <p>Início estimado: {implementationQ.data?.startDateEstimate ?? "Não informado"}</p>
            <p>Conclusão estimada: {implementationQ.data?.completionDateEstimate ?? "Não informado"}</p>
            <p>Condições de pagamento: consulte as condições comerciais acima.</p>
          </div>
        </InfoSection>
        <InfoSection title="Termos" subtitle="Controle de validade e observações da proposta.">
          <div className="space-y-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
            <p>Cada salvamento cria uma nova versão; versões anteriores não são sobrescritas.</p>
            <p>Os termos recorrentes não entram no total dos serviços fixos.</p>
          </div>
        </InfoSection>
      </section>

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
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>{title}</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{subtitle}</p>
    </div>
  );
}

function InfoSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptySection({ text }: { text: string }) {
  return <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{text}</p>;
}

function ShareLinkPanel({ implementationId, proposalId }: { implementationId: EntityId; proposalId: EntityId }) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery(proposalShareLinkQuery(proposalId));
  const [copied, setCopied] = useState(false);
  const createLink = useMutation({
    mutationFn: () => proposalShareStore.createLinkForProposal(proposalId, implementationId),
    onSuccess: (link) => queryClient.setQueryData(proposalShareLinkQuery(proposalId).queryKey, link),
  });
  const url = linkQuery.data ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/proposta/${linkQuery.data.token}` : null;
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* Link visível para cópia manual. */ }
  };
  return (
    <div className="mt-4 rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2 className="mb-3 text-sm" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>Link para o proprietário</h2>
      {url ? <div className="flex flex-wrap items-center gap-2"><code className="flex-1 break-all rounded-[var(--radius-control)] border px-3 py-2 text-xs" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}>{url}</code><button type="button" onClick={() => void copy()} className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-2 text-sm" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar"}</button></div> : <button type="button" onClick={() => createLink.mutate()} disabled={createLink.isPending} className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>{createLink.isPending ? "Gerando..." : "Gerar link para o proprietário"}</button>}
      <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>O link é fixo para esta versão da proposta.</p>
    </div>
  );
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input type="number" min={0} step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="w-24 rounded-[var(--radius-control)] border px-2 py-2 text-right text-sm outline-none" style={{ ...surface, color: "var(--stayo-ink)" }} />;
}

function WhatsappSendPanel({ message }: { message: OutboundMessage }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.body); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* Texto visível para cópia manual. */ }
  };
  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2 className="mb-3 text-sm" style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}>Mensagem para o proprietário</h2>
      <pre className="mb-3 whitespace-pre-wrap rounded-[var(--radius-control)] border p-3 text-xs" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}>{message.body}</pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-2 text-sm" style={{ ...surface, color: "var(--stayo-forest)" }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar mensagem"}</button>
        {message.destination && <a href={buildWhatsappDeepLink(message.destination, message.body)} target="_blank" rel="noreferrer" className="rounded-[var(--radius-control)] px-3 py-2 text-sm" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>Abrir WhatsApp</a>}
      </div>
    </div>
  );
}
