import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Panel } from "../data/ListStates";
import {
  adminApi,
  commercialTermsQuery,
  proposalBlocksQuery,
  proposalSettingsQuery,
} from "../../lib/api/queries";
import type { ChargeType, CommercialTerm } from "../../types/admin";
import type { ProposalBlockVisibility } from "../../types/proposal-config";
import { proposalBlockVisibilityLabels } from "../../types/proposal-config";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const control = "rounded-[var(--radius-control)] border px-2 py-1 text-sm outline-none";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const chargeTypeLabels: Record<ChargeType, string> = {
  percentage: "Percentual",
  fixed_once: "Valor fixo (único)",
  per_reservation: "Por reserva",
  monthly: "Mensal",
  optional: "Opcional",
  informational: "Informativo",
};

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3
        className="text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        {title}
      </h3>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function ProposalConfigPanel({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const termsQ = useQuery(commercialTermsQuery(implementationId));
  const settingsQ = useQuery(proposalSettingsQuery(implementationId));
  const blocksQ = useQuery(proposalBlocksQuery(implementationId));

  const terms = termsQ.data ?? [];
  const blocks = blocksQ.data ?? [];

  const invalidateTerms = () =>
    queryClient.invalidateQueries({ queryKey: ["commercial-terms", implementationId] });

  const addTerm = useMutation({
    mutationFn: (input: Omit<CommercialTerm, "id">) => adminApi.commercialTerms.add(input),
    onSuccess: async () => {
      await invalidateTerms();
      setTermDraft({ ...emptyTerm });
    },
  });

  const updateTerm = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CommercialTerm> }) =>
      adminApi.commercialTerms.update(id, patch),
    onSuccess: invalidateTerms,
  });

  const removeTerm = useMutation({
    mutationFn: (id: string) => adminApi.commercialTerms.remove(id),
    onSuccess: invalidateTerms,
  });

  const cloneDefaults = useMutation({
    mutationFn: () => adminApi.commercialTerms.cloneDefaults(implementationId),
    onSuccess: invalidateTerms,
  });

  const emptyTerm: Omit<CommercialTerm, "id"> = {
    implementationId,
    label: "",
    chargeType: "percentage",
    value: 0,
    optional: false,
    displayOrder: terms.length,
    notes: null,
  };
  const [termDraft, setTermDraft] = useState<Omit<CommercialTerm, "id">>({ ...emptyTerm });

  // Prazo de validade e observações de pagamento
  const [validityDays, setValidityDays] = useState(30);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (settingsQ.data && !settingsLoaded) {
      setValidityDays(settingsQ.data.validityDays);
      setPaymentNotes(settingsQ.data.paymentNotes ?? "");
      setSettingsLoaded(true);
    }
  }, [settingsQ.data, settingsLoaded]);

  const saveSettings = useMutation({
    mutationFn: () =>
      adminApi.proposalSettings.save(implementationId, {
        validityDays,
        paymentNotes: paymentNotes.trim() === "" ? null : paymentNotes.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposal-settings", implementationId] });
    },
  });

  // Blocos de regras e observações
  const invalidateBlocks = () =>
    queryClient.invalidateQueries({ queryKey: ["proposal-blocks", implementationId] });

  const [blockTitle, setBlockTitle] = useState("");
  const [blockBody, setBlockBody] = useState("");
  const [blockVisibility, setBlockVisibility] = useState<ProposalBlockVisibility>("proposta");

  const addBlock = useMutation({
    mutationFn: () =>
      adminApi.proposalBlocks.add({
        implementationId,
        title: blockTitle.trim(),
        body: blockBody.trim(),
        visibility: blockVisibility,
        displayOrder: blocks.length,
      }),
    onSuccess: async () => {
      setBlockTitle("");
      setBlockBody("");
      await invalidateBlocks();
    },
  });

  const updateBlock = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string; body?: string; visibility?: ProposalBlockVisibility };
    }) => adminApi.proposalBlocks.update(id, patch),
    onSuccess: invalidateBlocks,
  });

  const removeBlock = useMutation({
    mutationFn: (id: string) => adminApi.proposalBlocks.remove(id),
    onSuccess: invalidateBlocks,
  });

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <Heading
          title="Condições comerciais"
          hint="Percentual, valor fixo único, por reserva, mensal, opcional ou informativo. Só o valor fixo único entra no total da proposta."
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr style={{ color: "var(--stayo-ink-muted)" }}>
                <th className="py-2 text-left text-xs font-normal">Condição</th>
                <th className="py-2 text-left text-xs font-normal">Tipo</th>
                <th className="py-2 text-right text-xs font-normal">Valor</th>
                <th className="py-2 text-center text-xs font-normal">Opcional</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
              {terms.map((term) => (
                <tr key={term.id}>
                  <td className="py-2 pr-2">
                    <input
                      defaultValue={term.label}
                      onBlur={(e) =>
                        e.target.value !== term.label &&
                        updateTerm.mutate({ id: term.id, patch: { label: e.target.value } })
                      }
                      className={`w-full ${control}`}
                      style={{ ...surface, color: "var(--stayo-ink)" }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={term.chargeType}
                      onChange={(e) =>
                        updateTerm.mutate({
                          id: term.id,
                          patch: { chargeType: e.target.value as ChargeType },
                        })
                      }
                      className={control}
                      style={{ ...surface, color: "var(--stayo-ink)" }}
                    >
                      {Object.entries(chargeTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={term.value}
                      onBlur={(e) =>
                        updateTerm.mutate({ id: term.id, patch: { value: Number(e.target.value) } })
                      }
                      className={`w-28 text-right ${control}`}
                      style={{ ...surface, color: "var(--stayo-ink)" }}
                    />
                    <span className="ml-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      {term.chargeType === "percentage" ? "%" : currency.format(term.value)}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      checked={term.optional}
                      onChange={(e) =>
                        updateTerm.mutate({ id: term.id, patch: { optional: e.target.checked } })
                      }
                    />
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeTerm.mutate(term.id)}
                      className="text-xs underline"
                      style={{ color: "var(--stayo-danger)" }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {terms.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                    Nenhuma condição cadastrada nesta implantação.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Nova condição
            <input
              value={termDraft.label}
              onChange={(e) => setTermDraft({ ...termDraft, label: e.target.value })}
              placeholder="Taxa de administração"
              className={control}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Tipo
            <select
              value={termDraft.chargeType}
              onChange={(e) =>
                setTermDraft({ ...termDraft, chargeType: e.target.value as ChargeType })
              }
              className={control}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            >
              {Object.entries(chargeTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Valor
            <input
              type="number"
              step="0.01"
              value={termDraft.value}
              onChange={(e) => setTermDraft({ ...termDraft, value: Number(e.target.value) })}
              className={`w-28 text-right ${control}`}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            />
          </label>
          <label className="flex items-center gap-2 py-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            <input
              type="checkbox"
              checked={termDraft.optional}
              onChange={(e) => setTermDraft({ ...termDraft, optional: e.target.checked })}
            />
            Opcional
          </label>
          <button
            type="button"
            disabled={termDraft.label.trim() === "" || addTerm.isPending}
            onClick={() =>
              addTerm.mutate({ ...termDraft, label: termDraft.label.trim(), displayOrder: terms.length })
            }
            className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => cloneDefaults.mutate()}
            disabled={cloneDefaults.isPending || terms.length > 0}
            className={`${control} px-3 py-2 disabled:opacity-50`}
            style={{ ...surface, color: "var(--stayo-forest)" }}
          >
            Aplicar condições padrão
          </button>
        </div>
      </Panel>

      <Panel>
        <Heading title="Prazo e pagamento" hint="Validade da proposta contada a partir do envio." />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Validade (dias)
            <input
              type="number"
              min={1}
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value))}
              className={`w-24 ${control}`}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            />
          </label>
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Observações de pagamento
            <input
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Forma de pagamento, parcelamento, vencimento"
              className={control}
              style={{ ...surface, color: "var(--stayo-ink)" }}
            />
          </label>
          <button
            type="button"
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
            className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
            style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
          >
            {saveSettings.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </Panel>

      <Panel>
        <Heading
          title="Regras e observações"
          hint="Cada bloco aparece somente onde você escolher: uso interno, proposta/PDF ou portal do proprietário."
        />

        <div className="flex flex-col gap-3">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="rounded-[var(--radius-control)] border p-3"
              style={surface}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  defaultValue={block.title}
                  onBlur={(e) =>
                    e.target.value !== block.title &&
                    updateBlock.mutate({ id: block.id, patch: { title: e.target.value } })
                  }
                  className={`flex-1 ${control}`}
                  style={{ ...surface, color: "var(--stayo-ink)" }}
                />
                <select
                  value={block.visibility}
                  onChange={(e) =>
                    updateBlock.mutate({
                      id: block.id,
                      patch: { visibility: e.target.value as ProposalBlockVisibility },
                    })
                  }
                  className={control}
                  style={{ ...surface, color: "var(--stayo-ink)" }}
                >
                  {Object.entries(proposalBlockVisibilityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeBlock.mutate(block.id)}
                  className="text-xs underline"
                  style={{ color: "var(--stayo-danger)" }}
                >
                  Remover
                </button>
              </div>
              <textarea
                defaultValue={block.body}
                onBlur={(e) =>
                  e.target.value !== block.body &&
                  updateBlock.mutate({ id: block.id, patch: { body: e.target.value } })
                }
                rows={3}
                className={`mt-2 w-full ${control}`}
                style={{ ...surface, color: "var(--stayo-ink)" }}
              />
            </div>
          ))}
          {blocks.length === 0 && (
            <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              Nenhum bloco cadastrado.
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Novo bloco
              <input
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                placeholder="Regras de cancelamento"
                className={control}
                style={{ ...surface, color: "var(--stayo-ink)" }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Onde aparece
              <select
                value={blockVisibility}
                onChange={(e) => setBlockVisibility(e.target.value as ProposalBlockVisibility)}
                className={control}
                style={{ ...surface, color: "var(--stayo-ink)" }}
              >
                {Object.entries(proposalBlockVisibilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            value={blockBody}
            onChange={(e) => setBlockBody(e.target.value)}
            rows={3}
            placeholder="Texto do bloco"
            className={`w-full ${control}`}
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
          <div>
            <button
              type="button"
              disabled={blockTitle.trim() === "" || addBlock.isPending}
              onClick={() => addBlock.mutate()}
              className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
            >
              Adicionar bloco
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
