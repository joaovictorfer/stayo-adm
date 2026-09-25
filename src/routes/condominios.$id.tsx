import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminSection, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  CondominiumForm,
  formFromCondominium,
  inputFromForm,
  type CondominiumFormValues,
} from "@/components/condominios/CondominiumForm";
import { DetailSkeleton, ErrorRows, NotFoundPanel } from "@/components/data/ListStates";
import { Button } from "@/components/ui/button";
import { CondominiumCoverPanel } from "@/components/implantacao/CoverPicker";
import { adminApi, adminCondominiumQuery, implementationsListQuery } from "@/lib/api/queries";
import { statusLabels } from "@/lib/implementation-status";
import type { AdminCondominium } from "@/types/admin";

export const Route = createFileRoute("/condominios/$id")({
  head: () => ({
    meta: [
      { title: "Condomínio — Stayo Admin" },
      { name: "description", content: "Ficha do condomínio e apartamentos vinculados." },
      { property: "og:title", content: "Condomínio — Stayo Admin" },
      { property: "og:description", content: "Ficha do condomínio e apartamentos vinculados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CondominiumDetailPage,
});

function CondominiumDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(adminCondominiumQuery(id));
  const condo = query.data;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<CondominiumFormValues | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (v: CondominiumFormValues) => adminApi.condominiums.update(id, inputFromForm(v)),
    onSuccess: (updated) => {
      qc.setQueryData(adminCondominiumQuery(id).queryKey, updated);
      void qc.invalidateQueries({ queryKey: ["admin", "condominiums", "list"] });
      setEditing(false);
      toast.success("Condomínio atualizado.");
    },
    onError: (e) =>
      toast.error("Não foi possível salvar.", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const startEdit = () => {
    if (!condo) return;
    setValues(formFromCondominium(condo));
    setEditing(true);
  };
  const save = () => {
    if (!values) return;
    if (!values.name.trim()) {
      setNameError("Informe o nome do condomínio.");
      return;
    }
    setNameError(null);
    mutation.mutate(values);
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to="/condominios"
          aria-label="Voltar para condomínios"
          className="grid size-9 place-items-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-muted)] hover:text-[var(--admin-text)]"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-[var(--admin-text)]">
          {condo?.name ?? "Condomínio"}
        </h1>
        {condo && (
          <AdminStatusBadge tone={condo.status === "complete" ? "success" : "warning"}>
            {condo.status === "complete" ? "Completo" : "Pendente"}
          </AdminStatusBadge>
        )}
        {condo &&
          (editing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="size-4" /> Editar
            </Button>
          ))}
      </header>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !condo ? (
        <NotFoundPanel message="Condomínio não encontrado" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <AdminSection title="Dados do condomínio" className="admin-panel p-4">
            {editing && values ? (
              <CondominiumForm values={values} onChange={setValues} nameError={nameError} />
            ) : (
              <ReadView condo={condo} />
            )}
          </AdminSection>
          <AdminSection title="Foto do condomínio" className="admin-panel p-4">
            <CondominiumCoverPanel condominiumId={condo.id} condominiumName={condo.name} />
          </AdminSection>
          <LinkedApartments condominiumId={condo.id} />
        </div>
      )}
    </div>
  );
}

function ReadView({ condo }: { condo: AdminCondominium }) {
  const missingPhone = condo.hasConcierge && !condo.conciergePhone;
  const items: [string, string | null, boolean?][] = [
    ["Nome", condo.name],
    ["CEP", condo.postalCode],
    ["Endereço", condo.address, !condo.address],
    ["Bairro", condo.neighborhood],
    ["Cidade", condo.city, !condo.city],
    ["UF", condo.state],
    ["Possui portaria", condo.hasConcierge ? "Sim" : "Não"],
  ];
  if (condo.hasConcierge)
    items.push(["Telefone/WhatsApp da portaria", condo.conciergePhone, missingPhone]);
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value, pending]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-[var(--admin-muted)]">{label}</dt>
          <dd className="mt-0.5 break-words text-sm text-[var(--admin-text)]">
            {value || (
              <span className={pending ? "text-amber-700" : "text-[var(--admin-muted)]"}>
                {pending ? "Pendente" : "—"}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LinkedApartments({ condominiumId }: { condominiumId: string }) {
  const impls = useQuery(implementationsListQuery());
  const linked = useMemo(
    () => (impls.data?.data ?? []).filter((i) => i.condominiumId === condominiumId),
    [impls.data, condominiumId],
  );
  return (
    <AdminSection
      title="Apartamentos vinculados"
      action={<span className="text-sm text-[var(--admin-muted)]">{linked.length}</span>}
      className="admin-panel p-4"
    >
      {impls.isPending ? (
        <div className="admin-skeleton h-10 rounded" />
      ) : linked.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--admin-muted)]">
          Nenhum apartamento vinculado a este condomínio.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {linked.map((i) => (
            <li key={i.id}>
              <Link
                to="/implantacao/$id"
                params={{ id: i.id }}
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--admin-text)]">
                    {i.nickname ||
                      [i.tower && `Torre ${i.tower}`, i.unit && `Unidade ${i.unit}`]
                        .filter(Boolean)
                        .join(" · ") ||
                      i.code}
                  </p>
                  <p className="truncate text-xs text-[var(--admin-muted)]">
                    {[i.code, i.tower && `Torre ${i.tower}`, i.unit && `Un. ${i.unit}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <AdminStatusBadge>{statusLabels[i.status] ?? i.status}</AdminStatusBadge>
                <ChevronRight className="size-4 text-[var(--admin-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
