import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Bot, MailWarning, MessageCircle, Send, Sparkles, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "@/components/admin/PhaseOnePatterns";
import { Button } from "@/components/ui/button";
import { conversationMessagesQuery, conversationsListQuery } from "@/lib/api/queries";
import type { Conversation } from "@/types/core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mensagens/")({
  head: () => ({
    meta: [
      { title: "Mensagens e IA — Stayo Admin" },
      { name: "description", content: "Caixa de entrada da Central de Mensagens do STAYO APP, em leitura." },
      { property: "og:title", content: "Mensagens e IA — Stayo Admin" },
      { property: "og:description", content: "Caixa de entrada da Central de Mensagens do STAYO APP, em leitura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

type Filter = "todas" | "naolidas" | "atencao" | "auto";
const automations = ["Boas-vindas na confirmação", "Lembrete de web check-in", "Instruções de chegada", "Pedido de avaliação"];
const isAttention = (c: Conversation) => /aten|pend|urg/i.test(c.status);
const isAuto = (c: Conversation) => /auto|sistema/i.test(c.channel ?? "") || /auto/i.test(c.status);

function InboxPage() {
  const query = useQuery(conversationsListQuery());
  const [filter, setFilter] = useState<Filter>("todas");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const data = query.data?.data ?? [];
  const rows = useMemo(() => data.filter((c) => {
    const term = q.trim().toLowerCase();
    const okTerm = !term || [c.participantName, c.subject, c.propertyName, c.reservationCode].some((v) => v?.toLowerCase().includes(term));
    const okFilter = filter === "todas" || (filter === "naolidas" && c.unreadCount > 0) || (filter === "atencao" && isAttention(c)) || (filter === "auto" && isAuto(c));
    return okTerm && okFilter;
  }), [data, q, filter]);
  const current = data.find((c) => c.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow="Comunicação" title="Mensagens e IA" description="Conversas da Central do STAYO APP. Envio disponível após integração com o Core." />
      <div className="portfolio-metrics">
        <PortfolioMetric icon={MessageCircle} value={query.isSuccess ? data.length : "—"} label="Conversas" tone="info" />
        <PortfolioMetric icon={MailWarning} value={query.isSuccess ? data.filter((c) => c.unreadCount > 0).length : "—"} label="Não lidas" tone="warning" />
        <PortfolioMetric icon={Zap} value={automations.length} label="Automações (demonstração)" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <ModuleTabs value={filter} onChange={setFilter} options={[{ value: "todas", label: "Todas" }, { value: "naolidas", label: "Não lidas" }, { value: "atencao", label: "Precisam de atenção" }, { value: "auto", label: "Automáticas" }]} />
        <CompactSearch value={q} onChange={setQ} placeholder="Buscar hóspede, imóvel ou reserva" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <section className={cn("admin-panel overflow-hidden", current && "hidden lg:block")}>
          {query.isPending ? <p className="p-6 text-sm text-[var(--admin-muted)]">Atualizando conversas…</p>
            : query.isError ? <AdminEmptyState title="Central indisponível" description="A integração não respondeu." />
            : rows.length === 0 ? <AdminEmptyState icon={MessageCircle} title="Nenhuma conversa" description="As conversas chegam do STAYO APP após a integração." />
            : <ul className="divide-y divide-[var(--stayo-border)]">{rows.map((c) => <li key={c.id}>
                <button type="button" onClick={() => setSelected(c.id)} className={cn("flex w-full items-start gap-3 p-4 text-left transition hover:bg-[var(--stayo-forest-soft)]/40", selected === c.id && "bg-[var(--stayo-forest-soft)]/60")}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--stayo-forest-soft)] font-display text-[var(--stayo-forest)]">{(c.participantName ?? "?").slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><b className="truncate text-sm">{c.participantName ?? c.subject ?? "Conversa"}</b>{c.unreadCount > 0 && <span className="ml-auto rounded-full bg-[var(--stayo-gold)] px-2 text-[11px] text-[var(--stayo-surface)]">{c.unreadCount}</span>}</span>
                    <small className="block truncate text-[var(--admin-muted)]">{c.propertyName ?? "Sem imóvel"}{c.reservationCode ? ` · ${c.reservationCode}` : ""}</small>
                    <small className="block truncate text-[var(--admin-muted)]">{c.lastMessagePreview ?? "—"}</small>
                  </span>
                </button>
              </li>)}</ul>}
        </section>

        <section className={cn("admin-panel flex min-h-[26rem] flex-col", !current && "hidden lg:flex")}>
          {current ? <Thread conversation={current} onBack={() => setSelected(null)} />
            : <div className="m-auto p-6"><AdminEmptyState icon={MessageCircle} title="Selecione uma conversa" description="O histórico aparece aqui, em leitura." /></div>}
        </section>
      </div>

      <section className="admin-panel p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium"><Zap className="h-4 w-4 text-[var(--stayo-gold)]" />Automações <span className="text-xs text-[var(--admin-muted)]">· demonstração, controladas pelo Core</span></p>
        <div className="grid gap-2 sm:grid-cols-2">{automations.map((a) => <div key={a} className="flex items-center justify-between rounded-lg border border-[var(--stayo-border)] px-3 py-2 text-sm"><span>{a}</span><span className="text-xs text-[var(--admin-muted)]">Somente leitura</span></div>)}</div>
      </section>
    </div>
  );
}

function Thread({ conversation: c, onBack }: { conversation: Conversation; onBack: () => void }) {
  const msgs = useQuery(conversationMessagesQuery(c.id));
  const list = msgs.data ?? [];
  return <>
    <header className="flex items-center gap-2 border-b border-[var(--stayo-border)] p-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Voltar"><ArrowLeft /></Button>
      <div className="min-w-0 flex-1"><b className="block truncate text-sm">{c.participantName ?? "Conversa"}</b><small className="text-[var(--admin-muted)]">{c.propertyName ?? "Sem imóvel"}{c.channel ? ` · ${c.channel}` : ""}</small></div>
      <Link to="/mensagens/$id" params={{ id: c.id }} className="text-xs text-[var(--stayo-forest)] underline">Abrir ficha</Link>
    </header>
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      {msgs.isPending ? <p className="text-sm text-[var(--admin-muted)]">Carregando histórico…</p>
        : list.length === 0 ? <p className="text-sm text-[var(--admin-muted)]">Sem mensagens disponíveis.</p>
        : list.map((m) => <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.sender === "equipe" ? "ml-auto bg-[var(--stayo-forest)] text-[var(--stayo-surface)]" : m.sender === "sistema" ? "mx-auto bg-[var(--stayo-gold-soft)] text-xs" : "bg-[var(--stayo-forest-soft)]")}>{m.body}</div>)}
    </div>
    <div className="m-4 rounded-xl border border-dashed border-[var(--stayo-gold)] bg-[var(--stayo-gold-soft)]/40 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-[var(--stayo-gold)]" />Sugestão da IA <span className="text-xs text-[var(--admin-muted)]">· demonstração</span></p>
      <p className="mt-1 text-[var(--admin-muted)]">A IA sugerirá respostas com base no guia do imóvel e na reserva.</p>
    </div>
    <footer className="flex items-center gap-2 border-t border-[var(--stayo-border)] p-3">
      <Bot className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" />
      <input disabled placeholder="Envio disponível após integração com o Core" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--admin-muted)]" />
      <Button size="icon" disabled aria-label="Enviar"><Send /></Button>
    </footer>
  </>;
}
