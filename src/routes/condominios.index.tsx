import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  CondominiumForm,
  emptyCondominiumForm,
  inputFromForm,
  type CondominiumFormValues,
} from "@/components/condominios/CondominiumForm";
import { ErrorRows, ListSkeleton, PageHeader, Panel, SearchInput } from "@/components/data/ListStates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminApi, adminCondominiumsListQuery, implementationsListQuery } from "@/lib/api/queries";
import type { AdminCondominium } from "@/types/admin";

export const Route = createFileRoute("/condominios/")({
  head: () => ({
    meta: [
      { title: "Condomínios — Stayo Admin" },
      { name: "description", content: "Cadastro mestre de condomínios da operação Stayo." },
      { property: "og:title", content: "Condomínios — Stayo Admin" },
      { property: "og:description", content: "Cadastro mestre de condomínios da operação Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CondominiumsPage,
});

function CondominiumsPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const query = useQuery(adminCondominiumsListQuery());
  const impls = useQuery(implementationsListQuery());

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of impls.data?.data ?? []) {
      if (i.condominiumId) map.set(i.condominiumId, (map.get(i.condominiumId) ?? 0) + 1);
    }
    return map;
  }, [impls.data]);

  const rows = useMemo(() => {
    const data = query.data ?? [];
    const term = q.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data;
    const digits = term.replace(/\D/g, "");
    return data.filter((c) =>
      [c.name, c.city, c.neighborhood].some((v) => v?.toLocaleLowerCase("pt-BR").includes(term)) ||
      (digits.length > 0 && (c.conciergePhone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Condomínios" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar nome, cidade, bairro, telefone" />
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo condomínio
        </Button>
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : (query.data ?? []).length === 0 ? (
          <AdminEmptyState
            icon={Building2}
            title="Nenhum condomínio cadastrado"
            description="Condomínios concentram os dados-base usados pelos apartamentos."
            action={<Button onClick={() => setOpen(true)}>Cadastrar primeiro condomínio</Button>}
          />
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--admin-muted)]">
            Nenhum condomínio encontrado para esta busca.
          </p>
        ) : (
          <CondoList rows={rows} counts={counts} />
        )}
      </Panel>
      <NewCondominiumDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function CondoList({ rows, counts }: { rows: AdminCondominium[]; counts: Map<string, number> }) {
  const navigate = useNavigate();
  const go = (id: string) => void navigate({ to: "/condominios/$id", params: { id } });
  return (
    <div>
      <div className="hidden grid-cols-[2fr_1.5fr_1.4fr_0.8fr_0.8fr_auto] gap-4 border-b border-[var(--admin-border)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)] md:grid">
        <span>Nome</span>
        <span>Cidade / Bairro</span>
        <span>Portaria</span>
        <span>Aptos</span>
        <span>Status</span>
        <span className="w-14" />
      </div>
      <ul className="divide-y divide-[var(--admin-border)]">
        {rows.map((c) => (
          <li
            key={c.id}
            role="link"
            tabIndex={0}
            onClick={() => go(c.id)}
            onKeyDown={(e) => e.key === "Enter" && go(c.id)}
            className="grid cursor-pointer grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-[var(--admin-surface-muted,rgba(0,0,0,0.02))] md:grid-cols-[2fr_1.5fr_1.4fr_0.8fr_0.8fr_auto] md:items-center"
          >
            <span className="font-medium text-[var(--admin-text)]">{c.name}</span>
            <span className="text-[var(--admin-muted)] md:text-[var(--admin-text)]">
              {[c.city, c.neighborhood].filter(Boolean).join(" · ") || "—"}
            </span>
            <span className="col-span-2 text-[var(--admin-muted)] md:col-span-1">
              {c.hasConcierge ? `Sim${c.conciergePhone ? ` · ${c.conciergePhone}` : ""}` : "Não"}
            </span>
            <span className="text-[var(--admin-muted)] md:text-[var(--admin-text)]">
              <span className="md:hidden">Apartamentos: </span>
              {counts.get(c.id) ?? 0}
            </span>
            <span>
              <AdminStatusBadge tone={c.status === "complete" ? "success" : "warning"}>
                {c.status === "complete" ? "Completo" : "Pendente"}
              </AdminStatusBadge>
            </span>
            <span className="hidden w-14 items-center justify-end gap-1 text-xs text-[var(--admin-muted)] md:flex">
              Abrir <ChevronRight className="size-3.5" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewCondominiumDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [values, setValues] = useState<CondominiumFormValues>(emptyCondominiumForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => adminApi.condominiums.create(inputFromForm(values)),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["admin", "condominiums"] });
      qc.setQueryData(["admin", "condominiums", "detail", created.id], created);
      toast.success("Condomínio cadastrado.");
      onOpenChange(false);
      setValues(emptyCondominiumForm);
      void navigate({ to: "/condominios/$id", params: { id: created.id } });
    },
    onError: (e) =>
      toast.error("Não foi possível cadastrar.", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const submit = () => {
    if (!values.name.trim()) {
      setNameError("Informe o nome do condomínio.");
      return;
    }
    setNameError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo condomínio</DialogTitle>
          <DialogDescription>
            Endereço e cidade podem ser completados depois.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <CondominiumForm values={values} onChange={setValues} nameError={nameError} />
          <DialogFooter className="mt-5 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Cadastrar condomínio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
