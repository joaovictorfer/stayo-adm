import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Panel } from "../data/ListStates";
import {
  adminApi,
  commercialTermsQuery,
  implementationTemplatesQuery,
  proposalBlocksQuery,
  proposalSettingsQuery,
  supplyItemsQuery,
} from "../../lib/api/queries";
import { emptyTemplatePayload } from "../../types/proposal-config";
import type { ImplementationTemplatePayload } from "../../types/proposal-config";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const control = "rounded-[var(--radius-control)] border px-2 py-1 text-sm outline-none";

/**
 * Modelo é snapshot: ao salvar copiamos apenas configuração
 * (condições, blocos, enxoval/faltantes) — nunca nome, telefone, e-mail,
 * documento ou qualquer dado pessoal do proprietário.
 */
export function ImplementationTemplatesPanel({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const templatesQ = useQuery(implementationTemplatesQuery());
  const termsQ = useQuery(commercialTermsQuery(implementationId));
  const blocksQ = useQuery(proposalBlocksQuery(implementationId));
  const settingsQ = useQuery(proposalSettingsQuery(implementationId));
  const suppliesQ = useQuery(supplyItemsQuery(implementationId));

  const [name, setName] = useState("");
  const [includeTerms, setIncludeTerms] = useState(true);
  const [includeBlocks, setIncludeBlocks] = useState(true);
  const [includeSupplies, setIncludeSupplies] = useState(true);

  const saveTemplate = useMutation({
    mutationFn: () => {
      const payload: ImplementationTemplatePayload = {
        ...emptyTemplatePayload,
        commercialTerms: includeTerms
          ? (termsQ.data ?? []).map((t) => ({
              label: t.label,
              chargeType: t.chargeType,
              value: t.value,
              optional: t.optional,
              displayOrder: t.displayOrder,
              notes: t.notes,
            }))
          : [],
        blocks: includeBlocks
          ? (blocksQ.data ?? []).map((b) => ({
              title: b.title,
              body: b.body,
              visibility: b.visibility,
              displayOrder: b.displayOrder,
            }))
          : [],
        supplies: includeSupplies
          ? (suppliesQ.data ?? []).map((s, index) => ({
              module: s.module,
              name: s.name,
              room: s.room,
              size: s.size,
              requiredQty: s.requiredQty,
              displayOrder: s.displayOrder ?? index,
            }))
          : [],
        validityDays: settingsQ.data?.validityDays ?? null,
        paymentNotes: settingsQ.data?.paymentNotes ?? null,
      };
      return adminApi.implementationTemplates.create({ name: name.trim(), payload });
    },
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["implementation-templates"] });
    },
  });

  const removeTemplate = useMutation({
    mutationFn: (id: string) => adminApi.implementationTemplates.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["implementation-templates"] });
    },
  });

  const templates = templatesQ.data ?? [];

  return (
    <Panel>
      <h3
        className="text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Modelos de implantação
      </h3>
      <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Ao aplicar, o modelo é copiado — a implantação segue independente dele. Nenhum dado pessoal
        do proprietário entra no modelo.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Salvar esta implantação como modelo
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Padrão apartamento 2 quartos"
            className={control}
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>
        {(
          [
            ["Condições comerciais", includeTerms, setIncludeTerms],
            ["Regras e observações", includeBlocks, setIncludeBlocks],
            ["Enxoval e itens faltantes", includeSupplies, setIncludeSupplies],
          ] as const
        ).map(([label, checked, set]) => (
          <label
            key={label}
            className="flex items-center gap-2 py-2 text-xs"
            style={{ color: "var(--stayo-ink-muted)" }}
          >
            <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
            {label}
          </label>
        ))}
        <button
          type="button"
          disabled={name.trim() === "" || saveTemplate.isPending}
          onClick={() => saveTemplate.mutate()}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
        >
          {saveTemplate.isPending ? "Salvando..." : "Salvar como modelo"}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm"
            style={surface}
          >
            <span style={{ color: "var(--stayo-ink)" }}>{template.name}</span>
            <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {template.payload.commercialTerms.length} condições ·{" "}
              {template.payload.blocks.length} blocos · {template.payload.supplies.length} itens
            </span>
            <button
              type="button"
              onClick={() => removeTemplate.mutate(template.id)}
              className="text-xs underline"
              style={{ color: "var(--stayo-danger)" }}
            >
              Excluir
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Nenhum modelo salvo ainda.
          </p>
        )}
      </div>
    </Panel>
  );
}
