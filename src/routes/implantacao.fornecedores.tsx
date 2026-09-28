import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Handshake } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { supabase } from "@/integrations/supabase/client";
import { implementationsListQuery } from "@/lib/api/queries";
import { opportunityTitle } from "@/lib/opportunity-state";

export const Route = createFileRoute("/implantacao/fornecedores")({
  head: () => ({ meta: [
    { title: "Fornecedores — Stayo Admin" },
    { name: "description", content: "Fornecedores e instalações informados em todas as implantações." },
    { property: "og:title", content: "Fornecedores — Stayo Admin" },
    { property: "og:description", content: "Fornecedores e instalações informados em todas as implantações." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SuppliersPortfolio,
});

type Tab = "revisar" | "revisados" | "todos";

function SuppliersPortfolio() {
  const impls = useQuery(implementationsListQuery());
  // Telefone fica fora da carteira; detalhe completo continua na ficha da implantação.
  const entries = useQuery({
    queryKey: ["portfolio_supplier_entries"],
    queryFn: async () => {
      const [e, c] = await Promise.all([
        supabase.from("property_supplier_entries").select("id, implementation_id, category_key, other_name, service, answer, source, reviewed_at").is("deleted_at", null),
        supabase.from("property_supplier_categories").select("key, label"),
      ]);
      if (e.error) throw e.error;
      return { rows: e.data, cats: new Map((c.data ?? []).map((x: { key: string; label: string }) => [x.key, x.label])) };
    },
  });
  const [tab, setTab] = useState<Tab>("revisar");
  const [q, setQ] = useState("");
  const names = useMemo(() => new Map((impls.data?.data ?? []).map((p) => [p.id, opportunityTitle(p)] as [string, string])), [impls.data]);
  const all = (entries.data?.rows ?? []).map((r) => ({ ...r, cat: entries.data?.cats.get(r.category_key) ?? r.category_key, place: names.get(r.implementation_id) ?? "Implantação" }));
  const rows = all.filter((r) => {
    const term = q.trim().toLowerCase();
    const okTab = tab === "todos" || (tab === "revisar" ? !r.reviewed_at : !!r.reviewed_at);
    return okTab && (!term || [r.cat, r.place, r.other_name, r.service].some((v) => v?.toLowerCase().includes(term)));
  });
  const ok = entries.isSuccess;

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Implantação" title="Fornecedores" description="O que cada proprietário informou sobre instalações e prestadores. Revisão continua na ficha." />
      <div className="portfolio-metrics">
        <PortfolioMetric icon={Handshake} value={ok ? all.length : "—"} label="Respostas" tone="info" />
        <PortfolioMetric icon={Clock3} value={ok ? all.filter((r) => !r.reviewed_at).length : "—"} label="Para revisar" tone="warning" />
        <PortfolioMetric icon={CheckCircle2} value={ok ? all.filter((r) => r.reviewed_at).length : "—"} label="Revisadas" tone="success" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <ModuleTabs value={tab} onChange={setTab} options={[{ value: "revisar", label: "Para revisar" }, { value: "revisados", label: "Revisados" }, { value: "todos", label: "Todos" }]} />
        <CompactSearch value={q} onChange={setQ} placeholder="Buscar categoria, imóvel ou fornecedor" />
      </div>
      {entries.isPending ? <div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Atualizando fornecedores…</div>
        : entries.isError ? <div className="admin-panel"><AdminEmptyState title="Fornecedores indisponíveis" description="Não foi possível ler as respostas agora." /></div>
        : rows.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Handshake} title="Nada neste recorte" description="Altere o filtro ou a busca." /></div>
        : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((r) => (
            <Link key={r.id} to="/implantacao/$id" params={{ id: r.implementation_id }} search={{ etapa: undefined } as never} className="admin-panel space-y-1 p-4 transition hover:-translate-y-0.5">
              <small className="block truncate text-[var(--admin-muted)]">{r.place}</small>
              <b className="block truncate text-sm">{r.cat}</b>
              <small className="block truncate">{r.other_name ?? r.service ?? r.answer}</small>
              <AdminStatusBadge tone={r.reviewed_at ? "success" : "warning"}>{r.reviewed_at ? "Revisado" : "Para revisar"}</AdminStatusBadge>
            </Link>
          ))}</div>}
    </div>
  );
}
