/**
 * Abas "Enxoval" e "Itens faltantes" da implantação (Fase 4).
 *
 * Nenhum item é fixo no código: tudo é cadastrado aqui e pode virar template
 * reaplicável. Aplicar um template COPIA os itens (snapshot) — nunca cria
 * vínculo com o template de origem.
 *
 * O faltante é sempre derivado (necessário − existente), nunca digitado.
 * Itens em aberto marcados como bloqueio afetam a prontidão operacional,
 * que continua separada do percentual de progresso.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { adminApi, supplyItemsQuery, supplyTemplatesQuery } from "../../lib/api/queries";
import {
  blockingSupplyItems,
  missingQty,
  supplyPriorityLabels,
  supplyStatusLabels,
  type SupplyItem,
  type SupplyModule,
  type SupplyPriority,
  type SupplyStatus,
} from "../../types/implementation-supply";
import { Panel } from "../data/ListStates";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const inputClass = "w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none";
const labelClass = "text-xs uppercase tracking-wide";

function Heading({ children }: { children: string }) {
  return (
    <h3
      className="mb-4 text-lg"
      style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
    >
      {children}
    </h3>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={labelClass} style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

type FormState = {
  name: string;
  room: string;
  size: string;
  requiredQty: string;
  existingQty: string;
  priority: SupplyPriority;
  responsible: string;
  blocksReadiness: boolean;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  room: "",
  size: "",
  requiredQty: "1",
  existingQty: "0",
  priority: "media",
  responsible: "",
  blocksReadiness: false,
  notes: "",
};

function toText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toQty(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function SuppliesPanel({
  implementationId,
  module,
}: {
  implementationId: string;
  module: SupplyModule;
}) {
  const queryClient = useQueryClient();
  const items = useQuery(supplyItemsQuery(implementationId, module));
  const templates = useQuery(supplyTemplatesQuery(module));

  const [form, setForm] = useState<FormState>(emptyForm);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementation-supplies", implementationId] });
  };

  const addItem = useMutation({
    mutationFn: () =>
      adminApi.supplies.add({
        implementationId,
        module,
        name: form.name.trim(),
        room: toText(form.room),
        size: toText(form.size),
        requiredQty: toQty(form.requiredQty),
        existingQty: toQty(form.existingQty),
        priority: form.priority,
        responsible: toText(form.responsible),
        blocksReadiness: form.blocksReadiness,
        notes: toText(form.notes),
        displayOrder: (items.data?.length ?? 0) + 1,
      }),
    onSuccess: () => {
      setForm(emptyForm);
      invalidate();
    },
  });

  const updateItem = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof adminApi.supplies.update>[1] }) =>
      adminApi.supplies.update(input.id, input.patch),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => adminApi.supplies.remove(id),
    onSuccess: invalidate,
  });

  const applyTemplate = useMutation({
    mutationFn: async () => {
      if (!templateId) return;
      const templateItems = await adminApi.supplyTemplates.items(templateId);
      const base = items.data?.length ?? 0;
      // Cópia (snapshot): o item passa a pertencer à implantação.
      for (const [index, item] of templateItems.entries()) {
        await adminApi.supplies.add({
          implementationId,
          module,
          name: item.name,
          room: item.room,
          size: item.size,
          requiredQty: item.requiredQty,
          existingQty: 0,
          displayOrder: base + index + 1,
        });
      }
    },
    onSuccess: () => {
      setFeedback("Itens do modelo copiados para esta implantação.");
      invalidate();
    },
  });

  const saveTemplate = useMutation({
    mutationFn: () =>
      adminApi.supplyTemplates.create({
        name: templateName.trim(),
        module,
        items: (items.data ?? []).map((item, index) => ({
          name: item.name,
          room: item.room,
          size: item.size,
          requiredQty: item.requiredQty,
          displayOrder: index,
        })),
      }),
    onSuccess: () => {
      setTemplateName("");
      setFeedback("Lista salva como modelo reaplicável.");
      void queryClient.invalidateQueries({ queryKey: ["supply-templates"] });
    },
  });

  const list = items.data ?? [];
  const blocking = blockingSupplyItems(list);
  const totalMissing = list.reduce((sum, item) => sum + missingQty(item), 0);

  return (
    <div className="space-y-4">
      <Panel>
        <Heading>{module === "enxoval" ? "Resumo do enxoval" : "Resumo dos faltantes"}</Heading>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Itens cadastrados" value={String(list.length)} />
          <Metric label="Unidades faltantes" value={String(totalMissing)} />
          <Metric
            label="Bloqueios em aberto"
            value={String(blocking.length)}
            tone={blocking.length > 0 ? "danger" : "ok"}
          />
        </div>
        {blocking.length > 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--stayo-danger)" }}>
            {blocking.length} item(ns) marcados como bloqueio impedem a prontidão operacional,
            mesmo que o checklist esteja avançado.
          </p>
        ) : null}
      </Panel>

      <Panel>
        <Heading>Adicionar item</Heading>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.name.trim() === "") return;
            addItem.mutate();
          }}
        >
          <Labeled label="Item">
            <input
              className={inputClass}
              style={surface}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: jogo de lençol"
              required
            />
          </Labeled>
          <Labeled label="Ambiente">
            <input
              className={inputClass}
              style={surface}
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
            />
          </Labeled>
          <Labeled label="Tamanho / especificação">
            <input
              className={inputClass}
              style={surface}
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </Labeled>
          <Labeled label="Quantidade necessária">
            <input
              className={inputClass}
              style={surface}
              type="number"
              min={0}
              value={form.requiredQty}
              onChange={(e) => setForm({ ...form, requiredQty: e.target.value })}
            />
          </Labeled>
          <Labeled label="Quantidade existente">
            <input
              className={inputClass}
              style={surface}
              type="number"
              min={0}
              value={form.existingQty}
              onChange={(e) => setForm({ ...form, existingQty: e.target.value })}
            />
          </Labeled>
          <Labeled label="Prioridade">
            <select
              className={inputClass}
              style={surface}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as SupplyPriority })}
            >
              {Object.entries(supplyPriorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Responsável">
            <input
              className={inputClass}
              style={surface}
              value={form.responsible}
              onChange={(e) => setForm({ ...form, responsible: e.target.value })}
            />
          </Labeled>
          <Labeled label="Observação">
            <input
              className={inputClass}
              style={surface}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Labeled>
          <label className="flex items-end gap-2 pb-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
            <input
              type="checkbox"
              checked={form.blocksReadiness}
              onChange={(e) => setForm({ ...form, blocksReadiness: e.target.checked })}
            />
            Bloqueia a prontidão
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="rounded-[var(--radius-control)] px-4 py-2 text-sm"
              style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
              disabled={addItem.isPending}
            >
              {addItem.isPending ? "Adicionando…" : "Adicionar item"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        <Heading>Itens</Heading>
        {items.isLoading ? (
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Carregando itens…
          </p>
        ) : items.isError ? (
          <p className="text-sm" style={{ color: "var(--stayo-danger)" }}>
            Não foi possível carregar os itens.
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Nenhum item cadastrado. Adicione manualmente ou aplique um modelo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr style={{ color: "var(--stayo-ink-muted)" }}>
                  <th className="px-2 py-2 text-left font-normal">Item</th>
                  <th className="px-2 py-2 text-left font-normal">Ambiente</th>
                  <th className="px-2 py-2 text-left font-normal">Tamanho</th>
                  <th className="px-2 py-2 text-right font-normal">Necessário</th>
                  <th className="px-2 py-2 text-right font-normal">Existente</th>
                  <th className="px-2 py-2 text-right font-normal">Faltante</th>
                  <th className="px-2 py-2 text-left font-normal">Status</th>
                  <th className="px-2 py-2 text-left font-normal">Prioridade</th>
                  <th className="px-2 py-2 text-left font-normal">Responsável</th>
                  <th className="px-2 py-2 text-center font-normal">Bloqueia</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onPatch={(patch) => updateItem.mutate({ id: item.id, patch })}
                    onRemove={() => removeItem.mutate(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <Heading>Modelos</Heading>
        <p className="mb-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Aplicar um modelo copia os itens para esta implantação. A partir daí a lista é
          independente: editar aqui não altera o modelo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Labeled label="Aplicar modelo">
              <select
                className={inputClass}
                style={surface}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Selecione um modelo</option>
                {(templates.data ?? []).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </Labeled>
            <button
              type="button"
              className="rounded-[var(--radius-control)] border px-4 py-2 text-sm"
              style={surface}
              disabled={!templateId || applyTemplate.isPending}
              onClick={() => applyTemplate.mutate()}
            >
              {applyTemplate.isPending ? "Copiando…" : "Aplicar modelo"}
            </button>
          </div>
          <div className="space-y-2">
            <Labeled label="Salvar lista atual como modelo">
              <input
                className={inputClass}
                style={surface}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nome do modelo"
              />
            </Labeled>
            <button
              type="button"
              className="rounded-[var(--radius-control)] border px-4 py-2 text-sm"
              style={surface}
              disabled={templateName.trim() === "" || list.length === 0 || saveTemplate.isPending}
              onClick={() => saveTemplate.mutate()}
            >
              {saveTemplate.isPending ? "Salvando…" : "Salvar como modelo"}
            </button>
          </div>
        </div>
        {feedback ? (
          <p className="mt-3 text-sm" style={{ color: "var(--stayo-success)" }}>
            {feedback}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "danger";
}) {
  return (
    <div
      className="rounded-[var(--radius-control)] border px-3 py-2"
      style={surface}
    >
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </p>
      <p
        className="text-xl"
        style={{
          fontFamily: "var(--stayo-font-display)",
          color:
            tone === "danger"
              ? "var(--stayo-danger)"
              : tone === "ok"
                ? "var(--stayo-success)"
                : "var(--stayo-ink)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function ItemRow({
  item,
  onPatch,
  onRemove,
}: {
  item: SupplyItem;
  onPatch: (patch: { [key: string]: unknown }) => void;
  onRemove: () => void;
}) {
  const missing = missingQty(item);
  return (
    <tr style={{ borderTop: "1px solid var(--stayo-border)" }}>
      <td className="px-2 py-2" style={{ color: "var(--stayo-ink)" }}>
        {item.name}
      </td>
      <td className="px-2 py-2" style={{ color: "var(--stayo-ink-muted)" }}>
        {item.room ?? "—"}
      </td>
      <td className="px-2 py-2" style={{ color: "var(--stayo-ink-muted)" }}>
        {item.size ?? "—"}
      </td>
      <td className="px-2 py-2 text-right">
        <input
          className="w-16 rounded-[var(--radius-control)] border px-2 py-1 text-right text-sm"
          style={surface}
          type="number"
          min={0}
          defaultValue={item.requiredQty}
          onBlur={(e) => {
            const value = toQty(e.target.value);
            if (value !== item.requiredQty) onPatch({ requiredQty: value });
          }}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <input
          className="w-16 rounded-[var(--radius-control)] border px-2 py-1 text-right text-sm"
          style={surface}
          type="number"
          min={0}
          defaultValue={item.existingQty}
          onBlur={(e) => {
            const value = toQty(e.target.value);
            if (value !== item.existingQty) onPatch({ existingQty: value });
          }}
        />
      </td>
      <td
        className="px-2 py-2 text-right"
        style={{ color: missing > 0 ? "var(--stayo-danger)" : "var(--stayo-success)" }}
      >
        {missing}
      </td>
      <td className="px-2 py-2">
        <select
          className="rounded-[var(--radius-control)] border px-2 py-1 text-sm"
          style={surface}
          value={item.status}
          onChange={(e) => onPatch({ status: e.target.value as SupplyStatus })}
        >
          {Object.entries(supplyStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          className="rounded-[var(--radius-control)] border px-2 py-1 text-sm"
          style={surface}
          value={item.priority}
          onChange={(e) => onPatch({ priority: e.target.value as SupplyPriority })}
        >
          {Object.entries(supplyPriorityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2" style={{ color: "var(--stayo-ink-muted)" }}>
        {item.responsible ?? "—"}
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={item.blocksReadiness}
          onChange={(e) => onPatch({ blocksReadiness: e.target.checked })}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          aria-label={`Remover ${item.name}`}
          onClick={onRemove}
          style={{ color: "var(--stayo-danger)" }}
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}
