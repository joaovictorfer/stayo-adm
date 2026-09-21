import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, FileDown, Save, Settings2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorRows, Panel } from "../data/ListStates";
import { Drawer } from "../patterns/Drawer";
import { Button } from "../ui/button";
import { ImplementationTemplatesPanel } from "./ImplementationTemplatesPanel";
import { ProposalConfigPanel } from "./ProposalConfigPanel";
import {
  adminApi,
  commercialTermsQuery,
  implementationQuery,
  outboxQuery,
  proposalBlocksQuery,
  proposalShareLinkQuery,
  proposalSettingsQuery,
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
  const settingsQ = useQuery(proposalSettingsQuery(implementationId));
  const blocksQ = useQuery(proposalBlocksQuery(implementationId));
  const lastMessage = (outboxQ.data ?? [])[0];
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  const downloadPdf = useMutation({
    mutationFn: async () => {
      if (!latest || !implementationQ.data) throw new Error("Proposta ou implantação ausente");
      const portalUrl = shareLinkQ.data
        ? `${window.location.origin}/portal/proposta/${shareLinkQ.data.token}`
        : null;
      const bytes = await generateProposalPdf({
        implementation: implementationQ.data,
        proposal: latest,
        recurringTerms: (commercialTermsQ.data ?? []).filter((t) => t.chargeType !== "fixed_once"),
        portalUrl,
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${implementationQ.data.code}-v${latest.version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const recurringTerms = (commercialTermsQ.data ?? []).filter((t) => t.chargeType !== "fixed_once");
  const proposalBlocks = (blocksQ.data ?? []).filter((block) => block.visibility !== "interno");

  const [draft, setDraft] = useState<DraftItem[]>([{ ...emptyDraftItem }]);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);

  // Ao abrir, a edição parte da última versão salva — salvar cria a próxima.
  useEffect(() => {
    if (latest && latest.version !== loadedVersion) {
      setLoadedVersion(latest.version);
      setDraft(
        latest.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitValue: i.unitValue,
          discount: i.discount,
        })),
      );
    }
  }, [latest, loadedVersion]);

  const total = draft.reduce((sum, i) => sum + proposalItemTotal(i), 0);

  const save = useMutation({
    mutationFn: async () => {
      const items: ProposalItem[] = draft
        .filter((i) => i.description.trim() !== "")
        .map((i) => ({ ...i, total: proposalItemTotal(i) }));
      return proposalsStore.createVersion(implementationId, items);
    },
    onSuccess: async (proposal) => {
      setLoadedVersion(proposal.version);
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  const update = (index: number, patch: Partial<DraftItem>) =>
    setDraft(draft.map((item, i) => (i === index ? { ...item, ...patch } : item)));

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-premium">Proposta comercial</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
              {latest ? `Versão atual ${latest.version}` : "Nova proposta"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {latest
                ? "As alterações serão salvas como uma nova versão, preservando o histórico."
                : "Organize os serviços e revise as condições antes de salvar a primeira versão."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!latest}
              onClick={() => {
                if (!latest) return;
                const existingToken = shareLinkQ.data?.token;
                if (existingToken) {
                  window.open(`/portal/proposta/${existingToken}`, "_blank", "noopener,noreferrer");
                  return;
                }
                void proposalShareStore.createLinkForProposal(latest.id, implementationId).then((link) => {
                  queryClient.setQueryData(proposalShareLinkQuery(latest.id).queryKey, link);
                  window.open(`/portal/proposta/${link.token}`, "_blank", "noopener,noreferrer");
                });
              }}
            >
              <Eye /> Visualizar
            </Button>
            <Button
              disabled={save.isPending || draft.every((item) => item.description.trim() === "")}
              onClick={() => save.mutate()}
            >
              <Save /> {save.isPending ? "Salvando..." : "Salvar nova versão"}
            </Button>
            <Button
              variant="outline"
              disabled={!latest || downloadPdf.isPending || !implementationQ.data}
              onClick={() => downloadPdf.mutate()}
            >
              <FileDown /> {downloadPdf.isPending ? "Gerando..." : "Gerar documento"}
            </Button>
            <Button
              variant="outline"
              disabled={!latest || prepareWhatsapp.isPending}
              onClick={() => prepareWhatsapp.mutate()}
            >
              <Share2 /> {prepareWhatsapp.isPending ? "Preparando..." : "Compartilhar"}
            </Button>
            <Button variant="ghost" onClick={() => setAdvancedOpen(true)}>
              <Settings2 /> Opções
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className="text-sm"
            style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
          >
            1. Serviços e valores
          </h2>
          <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Cada salvamento cria uma nova versão — a anterior nunca é sobrescrita.
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
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
                      onChange={(e) => update(index, { description: e.target.value })}
                      placeholder="Serviço"
                      className="w-full rounded-[var(--radius-control)] border px-2 py-1 text-sm outline-none"
                      style={{ ...surface, color: "var(--stayo-ink)" }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <NumberCell
                      value={item.quantity}
                      onChange={(v) => update(index, { quantity: v })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <NumberCell
                      value={item.unitValue}
                      onChange={(v) => update(index, { unitValue: v })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <NumberCell
                      value={item.discount}
                      onChange={(v) => update(index, { discount: v })}
                    />
                  </td>
                  <td className="py-2 text-right" style={{ color: "var(--stayo-ink)" }}>
                    {currency.format(proposalItemTotal(item))}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => setDraft(draft.filter((_, i) => i !== index))}
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft([...draft, { ...emptyDraftItem }])}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
              style={{ ...surface, color: "var(--stayo-forest)" }}
            >
              Adicionar item
            </button>
            <button
              type="button"
              onClick={() => {
                const fixedTerms = (commercialTermsQ.data ?? []).filter(
                  (t) => t.chargeType === "fixed_once",
                );
                const existingLabels = new Set(draft.map((i) => i.description));
                const newItems: DraftItem[] = fixedTerms
                  .filter((t) => !existingLabels.has(t.label))
                  .map((t) => ({
                    description: t.label,
                    quantity: 1,
                    unitValue: t.value,
                    discount: 0,
                  }));
                if (newItems.length === 0) return;
                setDraft([...draft.filter((i) => i.description.trim() !== ""), ...newItems]);
              }}
              disabled={commercialTermsQ.isPending}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
              style={{ ...surface, color: "var(--stayo-forest)" }}
            >
              Adicionar das condições comerciais
            </button>
          </div>
          <p style={{ color: "var(--stayo-ink-muted)" }} className="text-xs">
            Total geral
            <span
              className="ml-2 text-xl"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              {currency.format(total)}
            </span>
          </p>
        </div>

        {recurringTerms.length > 0 && (
          <div
            className="mt-3 rounded-[var(--radius-control)] border px-3 py-2 text-xs"
            style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
          >
            <span className="font-medium" style={{ color: "var(--stayo-ink)" }}>
              Condições recorrentes (não entram no total acima):
            </span>{" "}
            {recurringTerms
              .map(
                (t) =>
                  `${t.label} — ${t.chargeType === "percentage" ? `${t.value}%` : currency.format(t.value)}`,
              )
              .join(" · ")}
          </div>
        )}

      </div>

      {lastMessage && <WhatsappSendPanel message={lastMessage} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <ProposalSummarySection
          number="2"
          title="Condições comerciais"
          description={
            commercialTermsQ.isPending
              ? "Carregando condições..."
              : commercialTermsQ.data?.length
                ? `${commercialTermsQ.data.length} condição(ões) configurada(s), sendo ${recurringTerms.length} recorrente(s).`
                : "Nenhuma condição comercial configurada."
          }
          onEdit={() => setAdvancedOpen(true)}
        />
        <ProposalSummarySection
          number="3"
          title="Responsabilidades / inclusos"
          description={
            blocksQ.isPending
              ? "Carregando conteúdo..."
              : proposalBlocks.length
                ? `${proposalBlocks.length} bloco(s) incluído(s) na comunicação da proposta.`
                : "Nenhuma responsabilidade ou item incluso configurado."
          }
          onEdit={() => setAdvancedOpen(true)}
        />
        <ProposalSummarySection
          number="4"
          title="Prazo e pagamento"
          description={
            settingsQ.isPending
              ? "Carregando condições..."
              : `Validade de ${settingsQ.data?.validityDays ?? 30} dias${settingsQ.data?.paymentNotes ? ` · ${settingsQ.data.paymentNotes}` : " · sem observações de pagamento"}.`
          }
          onEdit={() => setAdvancedOpen(true)}
        />
        <ProposalSummarySection
          number="5"
          title="Termos"
          description={
            latest
              ? `${versions.length} versão(ões) preservada(s) no histórico. A versão ${latest.version} é a vigente.`
              : "Os termos serão registrados ao salvar a primeira versão."
          }
          onEdit={() => setAdvancedOpen(true)}
        />
      </div>

      <div className="rounded-[var(--radius-card)] border" style={surface}>
        <h2
          className="border-b px-4 py-3 text-sm"
          style={{
            borderColor: "var(--stayo-border)",
            fontFamily: "var(--stayo-font-display)",
            color: "var(--stayo-ink)",
          }}
        >
          Histórico de versões
        </h2>
        {query.isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-5 w-full animate-pulse rounded"
                style={{ backgroundColor: "var(--stayo-border)" }}
              />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Nenhuma versão de proposta salva ainda
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {versions.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                    Versão {p.version}
                  </span>
                  <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {new Date(p.createdAt).toLocaleString("pt-BR")}
                  </span>
                  {p.acceptedAt && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: "var(--stayo-forest-soft)",
                        color: "var(--stayo-success)",
                      }}
                    >
                      Aceita{p.acceptedName ? ` por ${p.acceptedName}` : ""} em{" "}
                      {new Date(p.acceptedAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span className="ml-auto text-sm" style={{ color: "var(--stayo-ink)" }}>
                    {currency.format(p.total)}
                  </span>
                </div>
                <ul className="mt-1">
                  {p.items.map((item, i) => (
                    <li key={i} className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      {item.quantity}× {item.description} — {currency.format(item.total)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Drawer
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        eyebrow="Proposta"
        title="Configurações e modelos"
      >
        <div className="flex flex-col gap-4">
          {latest && <ShareLinkPanel implementationId={implementationId} proposalId={latest.id} />}
          <ProposalConfigPanel implementationId={implementationId} />
          <ImplementationTemplatesPanel implementationId={implementationId} />
        </div>
      </Drawer>
    </div>
  );
}

function ProposalSummarySection({
  number,
  title,
  description,
  onEdit,
}: {
  number: string;
  title: string;
  description: string;
  onEdit: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-foreground">
            {number}. {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>
      </div>
    </section>
  );
}

/**
 * Link público (sem autenticação) pro proprietário ver e aceitar ESTA
 * versão da proposta — nunca a mais recente por implantação. Se uma nova
 * versão for criada depois, este link continua mostrando a mesma versão;
 * um novo link precisa ser gerado para compartilhar a versão nova.
 */
function ShareLinkPanel({
  implementationId,
  proposalId,
}: {
  implementationId: EntityId;
  proposalId: EntityId;
}) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery(proposalShareLinkQuery(proposalId));
  const [copied, setCopied] = useState(false);

  const createLink = useMutation({
    mutationFn: () => proposalShareStore.createLinkForProposal(proposalId, implementationId),
    onSuccess: (link) => {
      queryClient.setQueryData(proposalShareLinkQuery(proposalId).queryKey, link);
    },
  });

  const url = linkQuery.data
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/proposta/${linkQuery.data.token}`
    : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível — link já está visível pra copiar manualmente.
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Link para o proprietário
      </h2>
      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          <code
            className="flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-xs break-all"
            style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
          >
            {url}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => createLink.mutate()}
          disabled={createLink.isPending}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {createLink.isPending ? "Gerando..." : "Gerar link para o proprietário"}
        </button>
      )}
      <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Este link é fixo para esta versão da proposta — se uma nova versão for criada, gere um novo
        link para ela.
      </p>
    </div>
  );
}

function NumberCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-24 rounded-[var(--radius-control)] border px-2 py-1 text-right text-sm outline-none"
      style={{ ...surface, color: "var(--stayo-ink)" }}
    />
  );
}

/**
 * Mensagem pronta no outbox — sem provider real, o envio é sempre manual:
 * a pessoa copia o texto ou abre o WhatsApp já preenchido e aperta enviar
 * ela mesma. Nunca contata nenhum servidor de WhatsApp.
 */
function WhatsappSendPanel({ message }: { message: OutboundMessage }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível — texto já está visível pra copiar manualmente.
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Mensagem para o proprietário
      </h2>
      <pre
        className="mb-3 whitespace-pre-wrap rounded-[var(--radius-control)] border p-3 text-xs"
        style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
      >
        {message.body}
      </pre>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-2 text-sm"
          style={{ ...surface, color: "var(--stayo-forest)" }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar mensagem"}
        </button>
        {message.destination && (
          <a
            href={buildWhatsappDeepLink(message.destination, message.body)}
            target="_blank"
            rel="noreferrer"
            className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            Abrir WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
