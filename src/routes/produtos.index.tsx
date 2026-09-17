import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SearchInput,
} from "../components/data/ListStates";
import { Drawer } from "../components/patterns/Drawer";
import { coreApi, productsListQuery } from "../lib/api/queries";
import type { UpsellProduct } from "../types/core";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos e serviços — Stayo Admin" },
      { name: "description", content: "Produtos e serviços de upsell oferecidos aos hóspedes." },
      { property: "og:title", content: "Produtos e serviços — Stayo Admin" },
      {
        property: "og:description",
        content: "Produtos e serviços de upsell oferecidos aos hóspedes.",
      },
    ],
  }),
  component: ProductsPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

export function formatMoney(value: number | null, currency: string | null) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
  }).format(value);
}

function ProductsPage() {
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const query = useQuery(productsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (p) => p.name.toLowerCase().includes(term) || (p.category ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Produtos e serviços" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nome ou categoria" />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Novo produto
        </button>
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q ? "Nenhum produto encontrado para esta busca" : "Nenhum produto cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/produtos/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{p.name}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {p.category ?? "Sem categoria"}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {formatMoney(p.price, p.currency) ?? "—"}
                    {p.active ? "" : " · inativo"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <NewProductDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const emptyForm = { name: "", category: "", description: "", price: "", unit: "" };

function NewProductDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const create = useMutation({
    mutationFn: (): Promise<UpsellProduct> =>
      coreApi.products.create({
        name: form.name,
        category: form.category || null,
        description: form.description || null,
        price: form.price ? Number(form.price) : null,
        currency: form.price ? "BRL" : null,
        unit: form.unit || null,
        active: true,
      }),
    onSuccess: async () => {
      setForm(emptyForm);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Drawer
      open={open}
      onClose={() => {
        setForm(emptyForm);
        onClose();
      }}
      eyebrow="Produtos e serviços"
      title="Novo produto"
      footer={
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending || form.name.trim() === ""}
          className="w-full rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {create.isPending ? "Salvando..." : "Salvar"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Nome" value={form.name} onChange={set("name")} />
        <TextField label="Categoria" value={form.category} onChange={set("category")} />
        <TextField label="Descrição" value={form.description} onChange={set("description")} />
        <TextField label="Preço" type="number" value={form.price} onChange={set("price")} />
        <TextField label="Unidade" value={form.unit} onChange={set("unit")} />
        {create.isError && (
          <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            Não foi possível salvar.
          </span>
        )}
      </div>
    </Drawer>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}
