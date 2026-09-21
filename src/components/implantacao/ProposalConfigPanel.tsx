import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Panel } from "../data/ListStates";
import { Button } from "../ui/button";
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

function commercialDescription(term: CommercialTerm) {
  const amount = currency.format(term.value);
  switch (term.chargeType) {
    case "percentage":
      return `${term.value}% sobre reservas${term.optional ? " · opcional" : ""}`;
    case "fixed_once":
      return `${amount} · pagamento único${term.optional ? " · opcional" : ""}`;
    case "per_reservation":
      return `${amount} por reserva${term.optional ? " · opcional" : ""}`;
    case "monthly":
      return `${amount} por mês${term.optional ? " · opcional" : ""}`;
    case "optional":
      return term.value > 0 ? `${amount} · opcional` : "Opcional";
    case "informational":
      return term.value > 0 ? amount : "Incluso";
  }
}

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
      setShowTermForm(false);
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
  const [showTermForm, setShowTermForm] = useState(false);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Heading
            title="Condições comerciais"
            hint="Valores e serviços apresentados ao proprietário."
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cloneDefaults.mutate()}
              disabled={cloneDefaults.isPending || terms.length > 0}
            >
              Aplicar padrão
            </Button>
            <Button type="button" size="sm" onClick={() => setShowTermForm((open) => !open)}>
              <Plus /> Nova condição
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {terms.map((term) => (
            <div key={term.id} className="rounded-[var(--radius-control)] border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{term.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{commercialDescription(term)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${term.label}`}
                    onClick={() => setEditingTermId(editingTermId === term.id ? null : term.id)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir ${term.label}`}
                    onClick={() => removeTerm.mutate(term.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              {editingTermId === term.id && (
                <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                  <TermLabel label="Descrição">
                    <input
                      defaultValue={term.label}
                      onBlur={(event) => {
                        const label = event.target.value.trim();
                        if (label && label !== term.label) updateTerm.mutate({ id: term.id, patch: { label } });
                      }}
                      className={`w-full ${control}`}
                    />
                  </TermLabel>
                  <TermLabel label="Como é cobrado">
                    <select
                      value={term.chargeType}
                      onChange={(event) => updateTerm.mutate({ id: term.id, patch: { chargeType: event.target.value as ChargeType } })}
                      className={`w-full ${control}`}
                    >
                      {Object.entries(chargeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </TermLabel>
                  <TermLabel label={term.chargeType === "percentage" ? "Percentual" : "Valor"}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={term.value}
                      onBlur={(event) => updateTerm.mutate({ id: term.id, patch: { value: Number(event.target.value) } })}
                      className={`w-full ${control}`}
                    />
                  </TermLabel>
                  <label className="flex items-center gap-2 self-end py-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={term.optional}
                      onChange={(event) => updateTerm.mutate({ id: term.id, patch: { optional: event.target.checked } })}
                    />
                    Contratação opcional
                  </label>
                </div>
              )}
            </div>
          ))}
          {terms.length === 0 && (
            <div className="rounded-[var(--radius-control)] border border-dashed border-border p-5 text-sm text-muted-foreground sm:col-span-2">
              Nenhuma condição cadastrada. Adicione uma condição ou aplique o padrão comercial.
            </div>
          )}
        </div>

        {showTermForm && (
          <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-muted/40 p-3">
            <p className="mb-3 text-sm font-medium text-foreground">Nova condição comercial</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TermLabel label="Descrição">
                <input
                  value={termDraft.label}
                  onChange={(event) => setTermDraft({ ...termDraft, label: event.target.value })}
                  placeholder="Ex.: Limpeza"
                  className={`w-full ${control}`}
                />
              </TermLabel>
              <TermLabel label="Como é cobrado">
                <select
                  value={termDraft.chargeType}
                  onChange={(event) => setTermDraft({ ...termDraft, chargeType: event.target.value as ChargeType })}
                  className={`w-full ${control}`}
                >
                  {Object.entries(chargeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </TermLabel>
              <TermLabel label={termDraft.chargeType === "percentage" ? "Percentual" : "Valor"}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={termDraft.value}
                  onChange={(event) => setTermDraft({ ...termDraft, value: Number(event.target.value) })}
                  className={`w-full ${control}`}
                />
              </TermLabel>
              <label className="flex items-center gap-2 self-end py-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={termDraft.optional}
                  onChange={(event) => setTermDraft({ ...termDraft, optional: event.target.checked })}
                />
                Contratação opcional
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowTermForm(false)}>Cancelar</Button>
              <Button
                type="button"
                disabled={termDraft.label.trim() === "" || addTerm.isPending}
                onClick={() => addTerm.mutate({ ...termDraft, label: termDraft.label.trim(), displayOrder: terms.length })}
              >
                {addTerm.isPending ? "Adicionando..." : "Adicionar condição"}
              </Button>
            </div>
          </div>
        )}
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
