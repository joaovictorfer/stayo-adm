import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, House, MapPin, Users } from "lucide-react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SearchInput,
} from "../components/data/ListStates";
import { propertiesListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/imoveis/")({
  head: () => ({
    meta: [
      { title: "Imóveis — Stayo Admin" },
      { name: "description", content: "Lista de imóveis da operação Stayo." },
      { property: "og:title", content: "Imóveis — Stayo Admin" },
      { property: "og:description", content: "Lista de imóveis da operação Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const [q, setQ] = useState("");
  const query = useQuery(propertiesListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (p) => p.name.toLowerCase().includes(term) || p.externalCode.toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Imóveis" count={query.isSuccess ? rows.length : undefined} subtitle="Portfólio sob gestão e seu contexto operacional" stackOnMobile>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nome ou código" />
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q ? "Nenhum imóvel encontrado para esta busca" : "Nenhum imóvel cadastrado ainda"
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to="/imoveis/$id"
                  params={{ id: p.id }}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-sm hover:bg-muted/60 sm:px-5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><House size={18} /></span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2"><strong className="truncate font-semibold text-foreground">{p.name}</strong><span className="hidden rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">{p.externalCode}</span></span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin size={12} />{p.city ?? "Cidade não informada"}</span>
                      <span className="flex items-center gap-1"><Users size={12} />{p.capacity ?? "—"} hóspedes</span>
                      <span>{p.status}</span>
                    </span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
