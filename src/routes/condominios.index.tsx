import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, CheckCircle2, CircleDashed, MapPin, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminEmptyState, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric, PropertyVisual } from "@/components/admin/PhaseOnePatterns";
import {
  CondominiumForm,
  emptyCondominiumForm,
  inputFromForm,
  type CondominiumFormValues,
} from "@/components/condominios/CondominiumForm";
import {
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
} from "@/components/data/ListStates";
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
  const [filter, setFilter] = useState<"todos" | "completos" | "pendentes">("todos");
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
    const byStatus = data.filter((c) => filter === "todos" || (filter === "completos" ? c.status === "complete" : c.status !== "complete"));
    if (!term) return byStatus;
    const digits = term.replace(/\D/g, "");
    return byStatus.filter(
      (c) =>
        [c.name, c.city, c.neighborhood].some((v) =>
          v?.toLocaleLowerCase("pt-BR").includes(term),
        ) ||
        (digits.length > 0 && (c.conciergePhone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }, [query.data, q, filter]);

  return (
    <>
      <PageHeader title="Condomínios" count={query.isSuccess ? rows.length : undefined}>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo condomínio
        </Button>
      </PageHeader>
      <p className="mb-4 text-xs text-[var(--admin-muted)]">Central de condomínios e seus imóveis vinculados.</p>
      <div className="portfolio-metrics mb-4">
        <PortfolioMetric icon={Building2} value={(query.data ?? []).length} label="Condomínios" />
        <PortfolioMetric icon={CheckCircle2} value={(query.data ?? []).filter((c) => c.status === "complete").length} label="Completos" tone="success" />
        <PortfolioMetric icon={CircleDashed} value={(query.data ?? []).filter((c) => c.status !== "complete").length} label="Pendentes" tone="warning" />
      </div>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <ModuleTabs value={filter} onChange={setFilter} options={[{value:"todos",label:"Todos"},{value:"completos",label:"Completos"},{value:"pendentes",label:"Pendentes"}]} />
        <CompactSearch value={q} onChange={setQ} placeholder="Buscar nome, cidade ou bairro" />
      </div>
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
    <div className="portfolio-grid p-3">
        {rows.map((c) => (
          <div
            key={c.id}
            role="link"
            tabIndex={0}
            onClick={() => go(c.id)}
            onKeyDown={(e) => e.key === "Enter" && go(c.id)}
            className="portfolio-card cursor-pointer"
          >
            <PropertyVisual label={`${counts.get(c.id) ?? 0} imóveis`} />
            <div className="portfolio-card-body"><h3>{c.name}</h3><p className="flex items-center gap-1"><MapPin className="size-3" />{[c.city,c.neighborhood].filter(Boolean).join(" · ")||"Local não informado"}</p><div className="portfolio-card-footer"><span className="text-xs text-[var(--admin-muted)]">{c.hasConcierge?"Com portaria":"Sem portaria"}</span><AdminStatusBadge tone={c.status==="complete"?"success":"warning"}>{c.status==="complete"?"Completo":"Pendente"}</AdminStatusBadge></div></div>
          </div>
        ))}
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
          <DialogDescription>Endereço e cidade podem ser completados depois.</DialogDescription>
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
