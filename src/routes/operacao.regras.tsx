import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, ListChecks, Users } from "lucide-react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/operacao/regras")({
  head: () => ({ meta: [
    { title: "Regras e checklists — Stayo Admin" },
    { name: "description", content: "Regras operacionais, equipe padrão e checklists de limpeza, vistoria e manutenção." },
    { property: "og:title", content: "Regras e checklists — Stayo Admin" },
    { property: "og:description", content: "Regras operacionais, equipe padrão e checklists da operação Stayo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RegrasPage,
});

const scopeLabel: Record<string, string> = { global: "Global", condominium: "Condomínio", property: "Imóvel" };
const typeLabel: Record<string, string> = { cleaning: "Limpeza", inspection: "Vistoria", maintenance: "Manutenção" };
const brl = (v: number | null) => v == null ? "Não informado" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RegrasPage() {
  const rules = useQuery({ queryKey: ["op-rules"], queryFn: async () => {
    const { data, error } = await supabase.from("op_routine_rules").select("*, op_rule_team(*)").order("name");
    if (error) throw error; return data;
  } });
  const templates = useQuery({ queryKey: ["op-checklists"], queryFn: async () => {
    const { data, error } = await supabase.from("op_checklist_templates").select("*, op_checklist_template_items(*)").order("name");
    if (error) throw error; return data;
  } });

  return <div className="space-y-6">
    <AdminPageHeader eyebrow="Operação" title="Regras e checklists" description="Padrões aplicados às rotinas: equipe, valor acordado e exigência de vistoria, foto e checklist." />

    <section className="admin-panel overflow-hidden">
      <header className="border-b border-[var(--admin-border)] px-4 py-3"><h2 className="font-[var(--stayo-font-display)] text-lg">Regras operacionais</h2></header>
      {rules.isPending ? <p className="p-4 text-sm text-[var(--admin-muted)]">Carregando…</p>
        : rules.isError ? <AdminEmptyState title="Regras indisponíveis" description="Não foi possível carregar as regras." />
        : rules.data.length === 0 ? <AdminEmptyState title="Nenhuma regra cadastrada" description="As rotinas seguem sem padrão definido." />
        : <div className="divide-y divide-[var(--admin-border)]">{rules.data.map((r) => <div key={r.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2"><strong>{r.name}</strong><AdminStatusBadge tone={r.active ? "success" : "neutral"}>{r.active ? "Ativa" : "Inativa"}</AdminStatusBadge><span className="text-xs text-[var(--admin-muted)]">{scopeLabel[r.scope_type] ?? r.scope_type}</span></div>
              <p className="text-sm text-[var(--admin-muted)]">
                Vistoria {r.default_requires_inspection ? "exigida" : "não exigida"} · Foto {r.default_requires_photo ? "exigida" : "não exigida"} · Checklist {r.default_requires_checklist ? "exigido" : "não exigido"}
              </p>
              <p className="flex items-center gap-1.5 text-sm"><Users className="size-4 text-[var(--admin-primary)]" />{r.op_rule_team.length === 0 ? "Sem equipe padrão" : r.op_rule_team.map((t) => `${t.provider_label}${t.is_lead ? " (responsável)" : ""}${t.percentage != null ? ` · ${t.percentage}%` : ""}`).join(", ")}</p>
            </div>
            <div className="text-right"><span className="text-xs text-[var(--admin-muted)]">Valor acordado</span><p className="font-semibold tabular-nums">{brl(r.default_total_amount)}</p></div>
          </div>)}</div>}
    </section>

    <section className="space-y-3">
      <h2 className="font-[var(--stayo-font-display)] text-lg">Checklists</h2>
      {templates.isPending ? <p className="text-sm text-[var(--admin-muted)]">Carregando…</p>
        : templates.isError ? <AdminEmptyState title="Checklists indisponíveis" description="Não foi possível carregar os checklists." />
        : <div className="grid gap-4 lg:grid-cols-3">{templates.data.map((t) => {
          const items = [...t.op_checklist_template_items].sort((a, b) => a.sort_order - b.sort_order);
          return <article key={t.id} className="admin-panel overflow-hidden">
            <header className="border-b border-[var(--admin-border)] px-4 py-3">
              <div className="flex items-center gap-2"><ListChecks className="size-4 text-[var(--admin-primary)]" /><strong>{t.name}</strong></div>
              <p className="text-xs text-[var(--admin-muted)]">{typeLabel[t.task_type] ?? t.task_type} · {items.length} itens</p>
            </header>
            <ol className="divide-y divide-[var(--admin-border)] text-sm">{items.map((i) => <li key={i.id} className="flex items-start gap-2 px-4 py-2">
              <span className="min-w-0 flex-1"><span className="block text-xs text-[var(--admin-muted)]">{i.area ?? "Geral"}</span>{i.label}</span>
              {i.requires_photo && <Camera aria-label="Exige foto" className="mt-1 size-4 shrink-0 text-[var(--admin-primary)]" />}
            </li>)}</ol>
          </article>;
        })}</div>}
    </section>
  </div>;
}
