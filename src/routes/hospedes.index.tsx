import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { guestsListQuery } from "@/lib/api/queries";

export const Route = createFileRoute("/hospedes/")({
  head: () => ({
    meta: [
      { title: "Hóspedes — Stayo Admin" },
      { name: "description", content: "Carteira de hóspedes da operação Stayo, em leitura segura." },
      { property: "og:title", content: "Hóspedes — Stayo Admin" },
      { property: "og:description", content: "Carteira de hóspedes da operação Stayo, em leitura segura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestsPage,
});

type Tab = "todos" | "contato" | "sem-contato";

/** Mascaramento só na apresentação: nunca exibimos contato completo na carteira. */
export function maskPhone(v: string | null) {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length < 4 ? "••••" : `•••• ${d.slice(-4)}`;
}
export function maskEmail(v: string | null) {
  if (!v || !v.includes("@")) return null;
  const [user, domain] = v.split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}

function GuestsPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("todos");
  const query = useQuery(guestsListQuery());
  const data = query.data?.data ?? [];
  const withContact = data.filter((g) => g.phone || g.email).length;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((g) => {
      const hasContact = Boolean(g.phone || g.email);
      if (tab === "contato" && !hasContact) return false;
      if (tab === "sem-contato" && hasContact) return false;
      return !term || g.name.toLowerCase().includes(term) || g.id.toLowerCase().includes(term);
    });
  }, [data, q, tab]);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Hospedagens" title="Hóspedes" description="Quem se hospeda nos imóveis STAYO. Contatos aparecem mascarados." />
      <div className="portfolio-metrics">
        <PortfolioMetric icon={Users} value={query.isSuccess ? data.length : "—"} label="Hóspedes" tone="info" />
        <PortfolioMetric icon={Phone} value={query.isSuccess ? withContact : "—"} label="Com contato" tone="success" />
        <PortfolioMetric icon={UserRound} value={query.isSuccess ? data.length - withContact : "—"} label="Sem contato" tone="warning" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <ModuleTabs value={tab} onChange={setTab} options={[{ value: "todos", label: "Todos" }, { value: "contato", label: "Com contato" }, { value: "sem-contato", label: "Sem contato" }]} />
        <CompactSearch value={q} onChange={setQ} placeholder="Buscar hóspede ou código" />
      </div>
      {query.isPending ? <div className="admin-panel p-6 text-sm text-[var(--admin-muted)]">Atualizando hóspedes…</div>
        : query.isError ? <div className="admin-panel"><AdminEmptyState title="Hóspedes indisponíveis" description="A integração com o STAYO APP não respondeu." /></div>
        : rows.length === 0 ? <div className="admin-panel"><AdminEmptyState icon={Users} title={q ? "Nenhum hóspede nesta busca" : "Nenhum hóspede ainda"} description="Os hóspedes chegam do STAYO APP após a integração." /></div>
        : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((g) => {
            const phone = maskPhone(g.phone); const email = maskEmail(g.email);
            return <Link key={g.id} to="/hospedes/$id" params={{ id: g.id }} className="admin-panel flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--stayo-forest-soft)] font-serif text-lg text-[var(--stayo-forest)]">{g.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0">
                <b className="block truncate text-sm">{g.name}</b>
                <small className="flex flex-wrap gap-x-3 text-[var(--admin-muted)]">
                  {phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
                  {email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
                  {!phone && !email && "Sem contato"}
                </small>
              </span>
            </Link>;
          })}</div>}
    </div>
  );
}
