import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ErrorRows, PageHeader, Panel } from "../components/data/ListStates";
import { adminApi, commercialTermDefaultsQuery } from "../lib/api/queries";
import type { ChargeType, CommercialTermDefault, CommercialTermDefaultInput } from "../types/admin";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const chargeTypeLabels: Record<ChargeType, string> = {
  percentage: "Percentual",
  fixed_once: "Valor fixo (uma vez)",
  per_reservation: "Por reserva",
  monthly: "Mensal",
  optional: "Opcional",
  informational: "Informativo",
};

const emptyForm: CommercialTermDefaultInput = {
  label: "",
  chargeType: "fixed_once",
  value: 0,
  optional: false,
  displayOrder: 1,
  notes: null,
};

export const Route = createFileRoute("/configuracoes/comercial")({
  head: () => ({
    meta: [
      { title: "Condições comerciais — Stayo Admin" },
      {
        name: "description",
        content: "Taxas e valores padrão usados em novas implantações e propostas.",
      },
      { property: "og:title", content: "Condições comerciais — Stayo Admin" },
      {
        property: "og:description",
        content: "Taxas e valores padrão usados em novas implantações e propostas.",
      },
    ],
  }),
  component: CommercialTermsSettingsPage,
});

function CommercialTermsSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery(commercialTermDefaultsQuery());
  const [form, setForm] = useState<CommercialTermDefaultInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["commercial-term-defaults"] });

  const save = useMutation({
    mutationFn: async (input: CommercialTermDefaultInput) =>
      editingId
        ? adminApi.commercialTermDefaults.update(editingId, input)
        : adminApi.commercialTermDefaults.create(input),
    onSuccess: async () => {
      setForm(emptyForm);
      setEditingId(null);
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.commercialTermDefaults.remove(id),
    onSuccess: async () => invalidate(),
  });

  const items = query.data ?? [];
  const canSave = form.label.trim() !== "";

  const startEdit = (item: CommercialTermDefault) => {
    setEditingId(item.id);
    setForm({
      label: item.label,
      chargeType: item.chargeType,
      value: item.value,
      optional: item.optional,
      displayOrder: item.displayOrder,
      notes: item.notes,
    });
  };

  return (
    <>
      <PageHeader title="Condições comerciais">
        <Link
          to="/configuracoes"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para configurações
        </Link>
      </PageHeader>

      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Taxas e valores padrão (taxa de administração, limpeza, implantação, etc.). Toda nova
        implantação copia esta lista no momento da criação — mudar um valor aqui depois nunca altera
        implantações já criadas.
      </p>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        <form
          className="rounded-[var(--radius-card)] border p-4"
          style={surface}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate(form);
          }}
        >
          <h2
            className="text-sm"
            style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
          >
            {editingId ? "Editar condição" : "Nova condição"}
          </h2>

          <div className="mt-3 flex flex-col gap-3">
            <TextField
              label="Nome"
              value={form.label}
              onChange={(v) => setForm({ ...form, label: v })}
            />

            <label
              className="flex flex-col gap-1 text-xs"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Tipo de cobrança
              <select
                value={form.chargeType}
                onChange={(e) => setForm({ ...form, chargeType: e.target.value as ChargeType })}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ ...surface, color: "var(--stayo-ink)" }}
              >
                {(Object.keys(chargeTypeLabels) as ChargeType[]).map((t) => (
                  <option key={t} value={t}>
                    {chargeTypeLabels[t]}
                  </option>
                ))}
              </select>
            </label>

            <label
              className="flex flex-col gap-1 text-xs"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              {form.chargeType === "percentage" ? "Percentual (ex: 20 = 20%)" : "Valor (R$)"}
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ ...surface, color: "var(--stayo-ink)" }}
              />
            </label>

            <label
              className="flex flex-col gap-1 text-xs"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Ordem
              <input
                type="number"
                min={1}
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) || 1 })}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ ...surface, color: "var(--stayo-ink)" }}
              />
            </label>

            <label
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--stayo-ink)" }}
            >
              <input
                type="checkbox"
                checked={form.optional}
                onChange={(e) => setForm({ ...form, optional: e.target.checked })}
              />
              Item opcional (não entra por padrão na proposta)
            </label>

            <label
              className="flex flex-col gap-1 text-xs"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Notas
              <textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value === "" ? null : e.target.value })
                }
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ ...surface, color: "var(--stayo-ink)" }}
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={!canSave || save.isPending}
              className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
            >
              {editingId ? "Salvar alterações" : "Adicionar condição"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                style={{ ...surface, color: "var(--stayo-ink-muted)" }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <Panel>
          {query.isPending ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-5 w-full animate-pulse rounded"
                  style={{ backgroundColor: "var(--stayo-border)" }}
                />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorRows onRetry={() => void query.refetch()} />
          ) : items.length === 0 ? (
            <div
              className="px-4 py-16 text-center text-sm"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Nenhuma condição comercial cadastrada ainda
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    #{item.displayOrder}
                  </span>
                  <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                    {item.label}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: "var(--stayo-forest-soft)",
                      color: "var(--stayo-forest)",
                    }}
                  >
                    {chargeTypeLabels[item.chargeType]}
                  </span>
                  <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                    {item.chargeType === "percentage"
                      ? `${item.value}%`
                      : item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  {item.optional && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: "var(--stayo-gold-soft)",
                        color: "var(--stayo-warning)",
                      }}
                    >
                      Opcional
                    </span>
                  )}
                  <span className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-xs underline"
                      style={{ color: "var(--stayo-forest)" }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(item.id)}
                      className="text-xs underline"
                      style={{ color: "var(--stayo-danger)" }}
                    >
                      Excluir
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}
