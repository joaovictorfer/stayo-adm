import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorRows, Panel } from "../data/ListStates";
import {
  commercialTermsQuery,
  proposalShareLinkQuery,
  proposalsByImplementationQuery,
} from "../../lib/api/queries";
import { proposalItemTotal, proposalShareStore, proposalsStore } from "../../lib/api/local-store";
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
  const versions = query.data ?? [];
  const latest = versions[0];

  const recurringTerms = (commercialTermsQ.data ?? []).filter((t) => t.chargeType !== "fixed_once");

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
          Proposta (versão {latest.version}) aceita pelo proprietário em{" "}
          {new Date(latest.acceptedAt).toLocaleString("pt-BR")}.
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className="text-sm"
            style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
          >
            {latest ? `Editando a partir da versão ${latest.version}` : "Primeira versão"}
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={save.isPending || draft.every((i) => i.description.trim() === "")}
            onClick={() => save.mutate()}
            className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
          >
            {latest ? `Salvar como versão ${latest.version + 1}` : "Salvar versão 1"}
          </button>
          <DisabledAction label="Gerar PDF" />
          <DisabledAction label="Enviar por WhatsApp" />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-warning)" }}>
          Gerar PDF e enviar por WhatsApp ficam disponíveis quando o Stayo Core estiver conectado.
        </p>
      </div>

      {latest && <ShareLinkPanel implementationId={implementationId} />}

      <div className="rounded-[var(--radius-card)] border" style={surface}>
        <h2
          className="border-b px-4 py-3 text-sm"
          style={{
            borderColor: "var(--stayo-border)",
            fontFamily: "var(--stayo-font-display)",
            color: "var(--stayo-ink)",
          }}
        >
          Versões
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
                      Aceita em {new Date(p.acceptedAt).toLocaleDateString("pt-BR")}
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
    </div>
  );
}

/** Link público (sem autenticação) pro proprietário ver e aceitar a proposta atual. */
function ShareLinkPanel({ implementationId }: { implementationId: EntityId }) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery(proposalShareLinkQuery(implementationId));
  const [copied, setCopied] = useState(false);

  const createLink = useMutation({
    mutationFn: () => proposalShareStore.createLink(implementationId),
    onSuccess: (link) => {
      queryClient.setQueryData(proposalShareLinkQuery(implementationId).queryKey, link);
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
        O link sempre mostra a versão mais recente da proposta salva.
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

function DisabledAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="disponível quando o Stayo Core estiver conectado"
      className="cursor-not-allowed rounded-[var(--radius-control)] border px-3 py-2 text-sm opacity-60"
      style={{ ...surface, color: "var(--stayo-ink-muted)" }}
    >
      {label}
    </button>
  );
}
