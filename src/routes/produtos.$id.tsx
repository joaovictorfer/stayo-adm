import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { Drawer } from "../components/patterns/Drawer";
import { coreApi, productQuery } from "../lib/api/queries";
import type { UpsellProduct } from "../types/core";
import { formatMoney } from "./produtos.index";

export const Route = createFileRoute("/produtos/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do produto — Stayo Admin" },
      { name: "description", content: "Dados de um produto ou serviço de upsell." },
      { property: "og:title", content: "Detalhe do produto — Stayo Admin" },
      { property: "og:description", content: "Dados de um produto ou serviço de upsell." },
    ],
  }),
  component: ProductDetailPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery(productQuery(id));
  const product = query.data;
  const [editOpen, setEditOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => coreApi.products.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      void navigate({ to: "/produtos" });
    },
  });

  return (
    <>
      <PageHeader title={product?.name ?? "Produto"}>
        <Link
          to="/produtos"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para produtos
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !product ? (
        <NotFoundPanel message="Produto não encontrado" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID" value={product.id} />
            <Field label="Nome" value={product.name} />
            <Field label="Categoria" value={product.category} />
            <Field label="Descrição" value={product.description} />
            <Field label="Preço" value={formatMoney(product.price, product.currency)} />
            <Field label="Unidade" value={product.unit} />
            <Field label="Ativo" value={product.active ? "Sim" : "Não"} />
            <Field label="Criado em" value={product.createdAt} />
            <Field label="Atualizado em" value={product.updatedAt} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
              style={{ ...surface, color: "var(--stayo-forest)" }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Excluir este produto?")) remove.mutate();
              }}
              disabled={remove.isPending}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
              style={{ ...surface, color: "var(--stayo-danger)" }}
            >
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </button>
          </div>

          <EditProductDrawer open={editOpen} product={product} onClose={() => setEditOpen(false)} />
        </div>
      )}
    </>
  );
}

function EditProductDrawer({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: UpsellProduct;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: product.name,
    category: product.category ?? "",
    description: product.description ?? "",
    price: product.price !== null ? String(product.price) : "",
    unit: product.unit ?? "",
    active: product.active,
  });

  useEffect(() => {
    setForm({
      name: product.name,
      category: product.category ?? "",
      description: product.description ?? "",
      price: product.price !== null ? String(product.price) : "",
      unit: product.unit ?? "",
      active: product.active,
    });
  }, [product]);

  const update = useMutation({
    mutationFn: () =>
      coreApi.products.update(product.id, {
        name: form.name,
        category: form.category || null,
        description: form.description || null,
        price: form.price ? Number(form.price) : null,
        currency: form.price ? (product.currency ?? "BRL") : null,
        unit: form.unit || null,
        active: form.active,
      }),
    onSuccess: async () => {
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const set = (key: "name" | "category" | "description" | "price" | "unit") => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Produtos e serviços"
      title="Editar produto"
      footer={
        <button
          type="button"
          onClick={() => update.mutate()}
          disabled={update.isPending || form.name.trim() === ""}
          className="w-full rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {update.isPending ? "Salvando..." : "Salvar"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Nome" value={form.name} onChange={set("name")} />
        <TextField label="Categoria" value={form.category} onChange={set("category")} />
        <TextField label="Descrição" value={form.description} onChange={set("description")} />
        <TextField label="Preço" type="number" value={form.price} onChange={set("price")} />
        <TextField label="Unidade" value={form.unit} onChange={set("unit")} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Ativo
        </label>
        {update.isError && (
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
