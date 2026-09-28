import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Boxes, CheckCircle2, PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { supabase } from "@/integrations/supabase/client";
import { implementationsListQuery } from "@/lib/api/queries";
import { opportunityTitle } from "@/lib/opportunity-state";

export const Route = createFileRoute("/implantacao/inventario")({
  head: () => ({ meta: [
    { title: "Inventário e estoque — Stayo Admin" },
    { name: "description", content: "Visão consolidada do inventário das implantações e do estoque operacional." },
    { property: "og:title", content: "Inventário e estoque — Stayo Admin" },
    { property: "og:description", content: "Visão consolidada do inventário das implantações e do estoque operacional." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InventoryPortfolio,
});

type Tab = "faltando" | "bloqueadores" | "completos" | "estoque";

function InventoryPortfolio() {
  const impls = useQuery(implementationsListQuery());
  // Somente colunas de leitura; dados de pagamento (Pix/favorecido) ficam de fora.
  const items = useQuery({
    queryKey: ["portfolio_supply_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("implementation_supply_items")
        .select("id, implementation_id, name, room, module, required_qty, existing_qty, blocks_readiness, status")
        .order("implementation_id");
      if (error) throw error;
      return data;
    },
  });
  const [tab, setTab] = useState<Tab>("faltando");
  const [q, setQ] = useState("");
  const names = useMemo(() => new Map((impls.data?.data ?? []).map((p) => [p.id, opportunityTitle(p)] as [string, string])), [impls.data]);
  const all = (items.data ?? []).map((i) => ({ ...i, missing: Math.max(0, i.required_qty - i.existing_qty), place: names.get(i.implementation_id) ?? "Implantação" }));
  const rows = all.filter((i) => {
    const term = q.trim().toLowerCase();
    const okTab = tab === "faltando" ? i.missing > 0 : tab === "bloqueadores" ? i.missing > 0 && i.blocks_readiness : i.missing === 0;
    return okTab && (!term || [i.name, i.place, i.room].some((v) => v?.toLowerCase().includes(term)));
  });
  const ok = items.isSuccess;

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Implantação" title="Inventário e estoque" description="Faltas derivadas das quantidades de cada implantação. Edição continua na ficha." />
      <div className="portfolio-metrics">
        <PortfolioMetric icon={Boxes} value={ok ? all.length : "—"} label="Itens registrados" tone="info" />
        <PortfolioMetric icon={AlertTriangle} value={ok ? all.filter((i) => i.missing > 0).length : "—"} label="Com falta" tone="warning" />
        <PortfolioMetric icon={CheckCircle2} value={ok ? all.filter((i) => i.missing === 0).length : "—"} label="Completos" tone="success" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <ModuleTabs value={tab} onChange={setTab} options={[{ value: "faltando", label: "Faltando" }, { value: "bloqueadores", label: "Bloqueiam entrega" }, { value: "completos", label: "Completos" }, { value: "estoque", label: "Estoque operacional" }]} />
        {tab !== "estoque" ? <CompactSearch value={q} onChange={setQ} placeholder="Buscar item, imóvel ou ambiente" /> : <span />}
      </div>
      {tab === "estoque" ? <div className="admin-panel"><AdminEmptyState icon={PackageSearch} title="Estoque operacional vem do STAYO APP" description="Amenities, enxoval em giro e reposição aparecem aqui após a integração com o Core. Nenhum saldo é exibido até lá." /></div>
        : items.isPending ? <div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Atualizando inventário…</div>
        : items.isError ? <div className="admin-panel"><AdminEmptyState title="Inventário indisponível" description="Não foi possível ler os itens agora." /></div>
        : rows.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Boxes} title="Nada neste recorte" description="Altere o filtro ou a busca." /></div>
        : <div className="space-y-2">{rows.map((i) => (
            <Link key={i.id} to="/implantacao/$id" params={{ id: i.implementation_id }} search={{ etapa: undefined } as never} className="reservation-card">
              <span className="reservation-date"><span><strong>{i.missing || "✓"}</strong>{i.missing ? "faltam" : "ok"}</span></span>
              <span className="min-w-0"><b className="block truncate text-sm">{i.name}</b><small className="block truncate text-[var(--admin-muted)]">{i.place}{i.room ? ` · ${i.room}` : ""} · {i.existing_qty} de {i.required_qty}</small></span>
              <span className="flex flex-wrap gap-2">{i.blocks_readiness && i.missing > 0 ? <AdminStatusBadge tone="warning">Bloqueia entrega</AdminStatusBadge> : <AdminStatusBadge tone={i.missing ? "info" : "success"}>{i.missing ? "Pendente" : "Completo"}</AdminStatusBadge>}</span>
            </Link>
          ))}</div>}
    </div>
  );
}
