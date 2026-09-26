import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Loader,
  PlugZap,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEmptyState, AdminPageHeader, AdminStatusBadge, type AdminTone } from "@/components/admin/AdminPrimitives";
import { OperacaoPrototypeNav } from "@/components/admin/OperacaoPrototypeNav";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/operacao/vistorias-links-prototipo")({
  head: () => ({
    meta: [
      { title: "Vistorias e links (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual da central de instâncias de vistoria e seus links externos." },
      { property: "og:title", content: "Vistorias e links (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Acompanhe execução, revisão e acesso de cada vistoria — dados demonstrativos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinksPrototype,
});

/* ---------- Dados demonstrativos em memória. Sem hóspedes, contatos ou tokens. ---------- */
type Origin = "reserva" | "implantacao" | "extra" | "manutencao" | "rotina";
type IStatus = "aguardando" | "andamento" | "enviada" | "em_revisao" | "concluida" | "reaberta" | "cancelada";
type LStatus = "nao_enviado" | "ativo" | "aberto" | "expirado" | "revogado";
interface Inst {
  code: string;
  property: string;
  origin: Origin;
  ref: string;
  type: string;
  model: string;
  owner: string;
  due: string;
  status: IStatus;
  link: LStatus;
  tail: string;
  expires: string;
  progress: [number, number];
  updated: string;
  timeline: [string, string][];
}

const ORIGIN: Record<Origin, string> = { reserva: "Reserva", implantacao: "Implantação", extra: "Vistoria extra", manutencao: "Manutenção", rotina: "Rotina" };
const ISTATUS: Record<IStatus, { label: string; tone: AdminTone }> = {
  aguardando: { label: "Aguardando início", tone: "neutral" },
  andamento: { label: "Em andamento", tone: "info" },
  enviada: { label: "Enviada para revisão", tone: "warning" },
  em_revisao: { label: "Em revisão", tone: "warning" },
  concluida: { label: "Concluída", tone: "success" },
  reaberta: { label: "Reaberta", tone: "danger" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};
const LSTATUS: Record<LStatus, { label: string; tone: AdminTone; icon: typeof Link2 }> = {
  nao_enviado: { label: "Não enviado", tone: "neutral", icon: Send },
  ativo: { label: "Ativo", tone: "info", icon: Link2 },
  aberto: { label: "Aberto", tone: "success", icon: Eye },
  expirado: { label: "Expirado", tone: "danger", icon: AlertTriangle },
  revogado: { label: "Revogado", tone: "neutral", icon: Ban },
};

const T = (...e: [string, string][]) => e;
const DATA: Inst[] = [
  { code: "VST-1024", property: "Apartamento 101", origin: "reserva", ref: "Reserva R-58", type: "Pré-check-in", model: "Pré-check-in · v3", owner: "Equipe de campo 1", due: "Hoje, 14h", status: "andamento", link: "aberto", tail: "8K2F", expires: "Hoje, 20h", progress: [7, 12], updated: "Há 6 min", timeline: T(["Instância criada", "Ontem, 18h02"], ["Link gerado", "Ontem, 18h02"], ["Link compartilhado", "Hoje, 08h10"], ["Link aberto", "Hoje, 11h40"], ["Progresso salvo", "Hoje, 12h04"]) },
  { code: "VST-1025", property: "Apartamento 101", origin: "reserva", ref: "Reserva R-58", type: "Pós-check-out", model: "Pós-check-out · v2", owner: "Equipe de campo 1", due: "Em 3 dias, 12h", status: "aguardando", link: "nao_enviado", tail: "Q7LM", expires: "Definida ao enviar", progress: [0, 14], updated: "Ontem, 18h02", timeline: T(["Instância criada", "Ontem, 18h02"], ["Link gerado", "Ontem, 18h02"]) },
  { code: "VST-1018", property: "Casa 7", origin: "reserva", ref: "Reserva R-51", type: "Pós-check-out", model: "Pós-check-out · v2", owner: "Equipe de campo 2", due: "Hoje, 11h", status: "enviada", link: "ativo", tail: "3ZPA", expires: "Amanhã, 11h", progress: [14, 14], updated: "Há 32 min", timeline: T(["Instância criada", "Seg, 09h"], ["Link gerado", "Seg, 09h"], ["Link compartilhado", "Hoje, 07h30"], ["Link aberto", "Hoje, 09h12"], ["Progresso salvo", "Hoje, 10h20"], ["Vistoria enviada para revisão", "Hoje, 10h48"]) },
  { code: "VST-1011", property: "Studio 12", origin: "implantacao", ref: "Criação manual", type: "Implantação", model: "Implantação · v1", owner: "Implantação", due: "Ontem, 17h", status: "andamento", link: "expirado", tail: "M4TR", expires: "Ontem, 18h", progress: [21, 38], updated: "Ontem, 16h", timeline: T(["Instância criada", "Sex, 10h"], ["Link gerado", "Sex, 10h"], ["Link compartilhado", "Sex, 10h05"], ["Link aberto", "Ontem, 13h"], ["Progresso salvo", "Ontem, 16h"], ["Link expirado", "Ontem, 18h"]) },
  { code: "VST-1009", property: "Casa 7", origin: "extra", ref: "Criação manual", type: "Vistoria extra", model: "Vistoria extra · v1", owner: "Equipe de campo 2", due: "Ter, 10h", status: "reaberta", link: "ativo", tail: "H9WD", expires: "Em 2 dias", progress: [9, 11], updated: "Há 2 h", timeline: T(["Instância criada", "Seg, 08h"], ["Link gerado", "Seg, 08h"], ["Link compartilhado", "Seg, 08h03"], ["Link aberto", "Seg, 09h"], ["Vistoria enviada para revisão", "Seg, 10h"], ["Vistoria reaberta", "Hoje, 09h"]) },
  { code: "VST-1003", property: "Apartamento 204", origin: "manutencao", ref: "Criação manual", type: "Manutenção", model: "Manutenção · v1", owner: "Manutenção", due: "Seg, 16h", status: "em_revisao", link: "revogado", tail: "B2CX", expires: "Revogado", progress: [6, 6], updated: "Seg, 17h", timeline: T(["Instância criada", "Seg, 08h"], ["Link gerado", "Seg, 08h"], ["Link compartilhado", "Seg, 08h01"], ["Link aberto", "Seg, 14h"], ["Vistoria enviada para revisão", "Seg, 16h"], ["Link revogado", "Seg, 16h30"]) },
  { code: "VST-0998", property: "Studio 12", origin: "rotina", ref: "Recorrência mensal", type: "Rotina", model: "Rotina · v2", owner: "Operação", due: "Sáb passado", status: "concluida", link: "expirado", tail: "K1NE", expires: "Expirado", progress: [18, 18], updated: "Dom passado", timeline: T(["Instância criada", "Sex"], ["Link gerado", "Sex"], ["Link aberto", "Sáb"], ["Vistoria enviada para revisão", "Sáb"], ["Link expirado", "Dom"]) },
  { code: "VST-0990", property: "Apartamento 204", origin: "reserva", ref: "Reserva R-44", type: "Pré-check-in", model: "Pré-check-in · v2", owner: "Equipe de campo 1", due: "Reserva cancelada", status: "cancelada", link: "revogado", tail: "P0SV", expires: "Revogado", progress: [0, 12], updated: "Qua passada", timeline: T(["Instância criada", "Ter"], ["Link gerado", "Ter"], ["Link revogado", "Qua"]) },
];
const PROPS = [...new Set(DATA.map((d) => d.property))];
const OWNERS = [...new Set(DATA.map((d) => d.owner))];
const TYPES = [...new Set(DATA.map((d) => d.type))];

type Demo = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const demoOptions: { value: Demo; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "parcial", label: "Parcial" },
  { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" },
  { value: "indisponivel", label: "Indisponível" },
];
type Action = "copiar" | "compartilhar" | "revogar" | "reabrir";
const ACTION_TEXT: Record<Action, { title: string; body: string; cta: string }> = {
  copiar: { title: "Copiar link", body: "No protótipo nenhum link é copiado. Na versão integrada, o link completo só é gerado no momento da cópia.", cta: "Entendi" },
  compartilhar: { title: "Compartilhar link", body: "No protótipo nada é enviado por WhatsApp, e-mail ou outro canal.", cta: "Entendi" },
  revogar: { title: "Revogar link?", body: "Na versão integrada, o link deixaria de funcionar imediatamente. Neste protótipo nenhum dado é alterado.", cta: "Revogar (demonstração)" },
  reabrir: { title: "Reabrir vistoria?", body: "Na versão integrada, a vistoria voltaria para execução com um novo ciclo registrado. Neste protótipo nenhum dado é alterado.", cta: "Reabrir (demonstração)" },
};

const masked = (i: Inst) => `stayo.app/v/...${i.tail}`;

function LinksPrototype() {
  const isMobile = useIsMobile();
  const [demo, setDemo] = useState<Demo>("normal");
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ prop: "todos", origin: "todos", type: "todos", status: "todos", owner: "todos", period: "todos" });
  const [selected, setSelected] = useState<Inst | null>(null);
  const [action, setAction] = useState<{ a: Action; i: Inst } | null>(null);
  const [creating, setCreating] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const hasData = demo === "normal" || demo === "parcial";
  const partial = demo === "parcial";
  const source = hasData ? DATA : [];
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return source
      .filter((i) => !s || `${i.code} ${i.property} ${i.owner}`.toLowerCase().includes(s))
      .filter((i) => f.prop === "todos" || i.property === f.prop)
      .filter((i) => f.origin === "todos" || i.origin === f.origin)
      .filter((i) => f.type === "todos" || i.type === f.type)
      .filter((i) => f.status === "todos" || i.status === f.status)
      .filter((i) => f.owner === "todos" || i.owner === f.owner)
      .filter((i) => f.period === "todos" || (f.period === "hoje" ? i.due.startsWith("Hoje") : !["concluida", "cancelada"].includes(i.status)));
  }, [source, f, q]);

  // Parcial: status de link e progresso atualizados; retorno da revisão indisponível.
  const affected = new Set(["revisao", "pendencia"]);
  const indicators = [
    { key: "envio", label: "Aguardando envio", icon: Send, value: source.filter((i) => i.link === "nao_enviado").length },
    { key: "ativos", label: "Links ativos", icon: Link2, value: source.filter((i) => i.link === "ativo" || i.link === "aberto").length },
    { key: "exec", label: "Em execução", icon: Loader, value: source.filter((i) => i.status === "andamento" || i.status === "reaberta").length },
    { key: "revisao", label: "Enviadas para revisão", icon: Eye, value: source.filter((i) => i.status === "enviada" || i.status === "em_revisao").length },
    { key: "pendencia", label: "Com pendência ou expiradas", icon: AlertTriangle, value: source.filter((i) => i.status === "reaberta" || (i.link === "expirado" && i.status !== "concluida")).length },
  ];
  const activeFilters = Object.values(f).filter((v) => v !== "todos").length;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
        <span className="font-medium">Ferramenta de protótipo · estado da tela</span>
        <div className="ml-auto hidden sm:block">
          <PeriodFilter value={demo} onChange={setDemo} options={demoOptions} />
        </div>
        <select aria-label="Estado da tela" value={demo} onChange={(e) => setDemo(e.target.value as Demo)} className="admin-input h-10 w-full px-2 text-sm sm:hidden">
          {demoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <OperacaoPrototypeNav />
      <Link to="/operacao/vistorias-prototipo" className="mb-2 inline-flex min-h-10 items-center text-sm text-[var(--admin-muted)] hover:text-[var(--admin-text)]">← Vistorias</Link>

      <AdminPageHeader
        title="Vistorias e links"
        description="Acompanhe a execução, revisão e acesso de cada vistoria."
        meta={<AdminStatusBadge tone="info">Dados demonstrativos</AdminStatusBadge>}
        actions={
          <button type="button" onClick={() => setCreating(true)} className="admin-button-primary inline-flex min-h-11 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-primary-foreground,white)]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Nova vistoria externa
          </button>
        }
      />

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState icon={PlugZap} title="Central de vistorias indisponível" description="Não foi possível obter as instâncias e seus links. Indicadores e lista ficam ocultos para não parecer que não há vistorias. Tente novamente em alguns minutos." />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            {indicators.map((i) => {
              const hit = partial && affected.has(i.key);
              return (
                <div key={i.key} className="admin-panel flex min-h-16 items-center gap-3 px-3 py-2.5 last:col-span-2 md:last:col-span-1">
                  <i.icon className="h-5 w-5 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--admin-muted)]">{i.label}</p>
                    {demo === "carregando" ? (
                      <span className="admin-skeleton mt-1 inline-block h-5 w-6 rounded" />
                    ) : (
                      <p className="text-xl font-semibold tabular-nums text-[var(--admin-text)]">
                        {i.value}{hit ? "*" : ""}
                        {hit && <span className="ml-1.5 block text-[11px] font-medium text-[var(--admin-muted)] sm:inline">pode estar incompleto</span>}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <label className="relative min-w-0 flex-1 basis-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, imóvel ou responsável" aria-label="Buscar" className="admin-input h-11 w-full pl-9 pr-3 text-sm" />
            </label>
            <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)} className="admin-input inline-flex h-11 items-center gap-2 px-3 text-sm lg:hidden">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </button>
          </div>
          <div className={`${showFilters ? "grid" : "hidden"} mb-4 grid-cols-2 gap-2 lg:grid lg:grid-cols-6`}>
            <Filter label="Imóvel" value={f.prop} onChange={set("prop")} all="Todos os imóveis" options={PROPS.map((p) => [p, p])} />
            <Filter label="Origem" value={f.origin} onChange={set("origin")} all="Todas as origens" options={Object.entries(ORIGIN)} />
            <Filter label="Tipo" value={f.type} onChange={set("type")} all="Todos os tipos" options={TYPES.map((t) => [t, t])} />
            <Filter label="Status" value={f.status} onChange={set("status")} all="Todos os status" options={Object.entries(ISTATUS).map(([k, v]) => [k, v.label])} />
            <Filter label="Responsável" value={f.owner} onChange={set("owner")} all="Todos responsáveis" options={OWNERS.map((o) => [o, o])} />
            <Filter label="Período" value={f.period} onChange={set("period")} all="Todo o período" options={[["hoje", "Prazo hoje"], ["abertas", "Em aberto"]]} />
          </div>

          {partial && (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-muted)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span><strong className="text-[var(--admin-text)]">Dados parciais:</strong> o retorno da revisão não foi atualizado. Status do link e progresso seguem atualizados. Os indicadores marcados com * (Enviadas para revisão e Com pendência ou expiradas) podem estar incompletos.</span>
            </p>
          )}

          {demo === "carregando" ? (
            <div className="admin-panel" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-4 last:border-0">
                  <div className="flex-1 space-y-2"><div className="admin-skeleton h-3.5 w-1/2 rounded" /><div className="admin-skeleton h-3 w-1/3 rounded" /></div>
                  <div className="admin-skeleton h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="admin-panel">
              <AdminEmptyState
                icon={ClipboardCheck}
                title={demo === "vazio" ? "Nenhuma vistoria gerada no período" : "Nenhuma vistoria com esses filtros"}
                description={demo === "vazio" ? "Quando reservas ou criações manuais gerarem vistorias, elas aparecem aqui." : "Ajuste a busca ou os filtros."}
              />
            </div>
          ) : (
            <div className="admin-panel overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_auto] gap-4 border-b border-[var(--admin-border)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--admin-muted)] lg:grid">
                <span>Vistoria</span><span>Origem e modelo</span><span>Responsável e prazo</span><span>Status</span><span className="w-[168px]">Ações</span>
              </div>
              <ul className="divide-y divide-[var(--admin-border)]">
                {list.map((i) => (
                  <li key={i.code}><Row i={i} partial={partial} onOpen={setSelected} onAction={(a) => setAction({ a, i })} /></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[88vh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-md"}>
          {selected && <Detail i={selected} partial={partial} onAction={(a) => setAction({ a, i: selected })} />}
        </SheetContent>
      </Sheet>

      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          {action && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_TEXT[action.a].title}</DialogTitle>
                <DialogDescription>{action.i.code} · {action.i.property} · {masked(action.i)}</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-[var(--admin-text)]">{ACTION_TEXT[action.a].body}</p>
              <p className="text-xs text-[var(--admin-muted)]">Protótipo visual — nenhuma ação real é executada.</p>
              <DialogFooter className="gap-2">
                {(action.a === "revogar" || action.a === "reabrir") && (
                  <button type="button" onClick={() => setAction(null)} className="admin-input min-h-11 px-4 text-sm">Cancelar</button>
                )}
                <button type="button" onClick={() => setAction(null)} className="min-h-11 rounded-[var(--admin-radius)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-primary-foreground,white)]">{ACTION_TEXT[action.a].cta}</button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Filter({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; all: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="admin-input h-11 w-full min-w-0 px-2 text-sm">
      <option value="todos">{all}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function StatusBadges({ i, partial }: { i: Inst; partial: boolean }) {
  const L = LSTATUS[i.link];
  const reviewUnknown = partial && (i.status === "enviada" || i.status === "em_revisao");
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <AdminStatusBadge tone={reviewUnknown ? "neutral" : ISTATUS[i.status].tone}>
        {i.status === "reaberta" && <RotateCcw className="mr-1 inline h-3 w-3" aria-hidden="true" />}
        {reviewUnknown ? "Revisão não atualizada" : ISTATUS[i.status].label}
      </AdminStatusBadge>
      <AdminStatusBadge tone={L.tone}>
        <L.icon className="mr-1 inline h-3 w-3" aria-hidden="true" />Link: {L.label}
      </AdminStatusBadge>
    </span>
  );
}

function Actions({ i, onAction, full }: { i: Inst; onAction: (a: Action) => void; full?: boolean }) {
  const linkUsable = i.link === "ativo" || i.link === "aberto" || i.link === "nao_enviado";
  const canReopen = ["enviada", "em_revisao", "concluida"].includes(i.status);
  const btn = "admin-input rounded-md border border-border inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 text-sm disabled:opacity-40";
  const items: { a: Action | "previa"; label: string; icon: typeof Copy; disabled: boolean }[] = [
    { a: "copiar", label: "Copiar link", icon: Copy, disabled: !linkUsable },
    { a: "compartilhar", label: "Compartilhar link", icon: Share2, disabled: !linkUsable },
    { a: "previa", label: "Abrir prévia externa", icon: ExternalLink, disabled: false },
    { a: "revogar", label: "Revogar link", icon: Ban, disabled: !linkUsable },
    { a: "reabrir", label: "Reabrir vistoria", icon: RotateCcw, disabled: !canReopen },
  ];
  return (
    <span className={full ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex gap-1"} onClick={(e) => e.stopPropagation()}>
      {items.map((it) =>
        it.a === "previa" ? (
          <Link key={it.a} to="/vistoria/prototipo/link" search={{} as never} target="_blank" aria-label={it.label} title={it.label} className={btn}>
            <it.icon className="h-4 w-4" aria-hidden="true" />{full && it.label}
          </Link>
        ) : (
          <button key={it.a} type="button" disabled={it.disabled} aria-label={it.label} title={it.label} onClick={() => onAction(it.a as Action)} className={btn}>
            <it.icon className="h-4 w-4" aria-hidden="true" />{full && it.label}
          </button>
        ),
      )}
    </span>
  );
}

function Row({ i, partial, onOpen, onAction }: { i: Inst; partial: boolean; onOpen: (i: Inst) => void; onAction: (a: Action) => void }) {
  const alert = i.status === "reaberta" || (i.link === "expirado" && i.status !== "concluida");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(i)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(i))}
      className={`grid w-full cursor-pointer gap-x-4 gap-y-2 border-l-4 px-4 py-3 text-left hover:bg-[var(--admin-surface-muted,transparent)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_auto] lg:items-center ${alert ? "border-l-[var(--admin-danger,currentColor)]" : "border-l-transparent"}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--admin-text)]">{i.code} · {i.property}</span>
        <span className="block break-all text-xs text-[var(--admin-muted)]">{masked(i)}</span>
      </span>
      <span className="min-w-0 text-sm text-[var(--admin-text)]">
        <span className="block">{ORIGIN[i.origin]} · {i.type}</span>
        <span className="block text-xs text-[var(--admin-muted)]">{i.model}</span>
      </span>
      <span className="min-w-0 text-sm text-[var(--admin-text)]">
        <span className="block">{i.owner}</span>
        <span className="block text-xs text-[var(--admin-muted)]">Prazo: {i.due}</span>
      </span>
      <StatusBadges i={i} partial={partial} />
      <Actions i={i} onAction={onAction} />
    </div>
  );
}

function Detail({ i, partial, onAction }: { i: Inst; partial: boolean; onAction: (a: Action) => void }) {
  const [done, total] = i.progress;
  const rows: [string, string][] = [
    ["Código", i.code],
    ["Imóvel", i.property],
    ["Origem", `${ORIGIN[i.origin]} · ${i.ref}`],
    ["Tipo", i.type],
    ["Modelo e versão", i.model],
    ["Responsável", i.owner],
    ["Prazo", i.due],
    ["Link", `${masked(i)} · expira: ${i.expires}`],
    ["Última atualização", i.updated],
  ];
  return (
    <>
      <SheetHeader>
        <SheetTitle>{i.code} · {i.type}</SheetTitle>
        <SheetDescription>Dados demonstrativos · somente leitura</SheetDescription>
      </SheetHeader>
      <div className="mt-3"><StatusBadges i={i} partial={partial} /></div>
      <div className="mt-4">
        <p className="mb-1 text-xs text-[var(--admin-muted)]">Progresso</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemax={total} aria-label="Progresso">
          <div className="h-full bg-primary" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-sm text-[var(--admin-text)]">{done} de {total} itens</p>
      </div>
      <dl className="mt-3 divide-y divide-[var(--admin-border)]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 py-2.5">
            <dt className="text-xs text-[var(--admin-muted)]">{k}</dt>
            <dd className="break-words text-sm text-[var(--admin-text)]">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-4 text-sm font-semibold text-[var(--admin-text)]">Linha do tempo</h3>
      <ol className="mt-2 border-l border-[var(--admin-border)] pl-4">
        {i.timeline.map(([ev, when]) => (
          <li key={ev + when} className="relative pb-3">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
            <p className="text-sm text-[var(--admin-text)]">{ev}</p>
            <p className="text-xs text-[var(--admin-muted)]">{when}</p>
          </li>
        ))}
        {partial && <li className="pb-1 text-xs text-[var(--admin-muted)]">Eventos de revisão podem não aparecer — atualização indisponível.</li>}
      </ol>
      <h3 className="mb-2 mt-4 text-sm font-semibold text-[var(--admin-text)]">Ações (demonstração)</h3>
      <Actions i={i} onAction={onAction} full />
      <p className="mt-4 flex items-start gap-1.5 rounded-md border border-[var(--admin-border)] p-2 text-xs text-[var(--admin-muted)]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        O link completo nunca é exibido. Esta central não mostra dados de hóspedes, contatos, senhas, códigos de acesso, dados bancários ou notas administrativas sensíveis.
      </p>
    </>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [origin, setOrigin] = useState<Origin>("extra");
  const [done, setDone] = useState(false);
  const close = () => { setDone(false); onClose(); };
  const field = "admin-input h-11 w-full min-w-0 px-2 text-sm";
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--admin-muted)]">{t}{children}</label>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova vistoria externa</DialogTitle>
          <DialogDescription>Criação manual visual — nenhuma instância ou link é criado.</DialogDescription>
        </DialogHeader>
        {done ? (
          <p role="status" className="rounded-md border border-dashed border-[var(--admin-border)] p-3 text-sm text-[var(--admin-text)]">Confirmação de protótipo: na versão integrada, a instância e seu link próprio seriam gerados aqui. Nada foi criado.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Origem">
              <select className={field} value={origin} onChange={(e) => setOrigin(e.target.value as Origin)}>
                {Object.entries(ORIGIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </L>
            {origin === "reserva" ? (
              <p className="rounded-md border border-[var(--admin-border)] p-3 text-sm text-[var(--admin-text)] sm:col-span-2">
                Instâncias de pré-check-in e pós-check-out serão geradas pelo gatilho da reserva na versão integrada.
              </p>
            ) : (
              <>
                <L t="Imóvel"><select className={field}>{PROPS.map((p) => <option key={p}>{p}</option>)}</select></L>
                <L t="Tipo"><select className={field} defaultValue={ORIGIN[origin]} key={origin}>{["Vistoria extra", "Implantação", "Manutenção", "Rotina"].map((t) => <option key={t}>{t}</option>)}</select></L>
                <L t="Modelo"><select className={field} key={`m${origin}`} defaultValue={ORIGIN[origin]}>{["Vistoria extra", "Implantação", "Manutenção", "Rotina"].map((t) => <option key={t}>{t}</option>)}</select></L>
                <L t="Versão"><select className={field}><option>v1 · ativa</option></select></L>
                <L t="Responsável demonstrativo"><select className={field}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select></L>
                <L t="Prazo"><input className={field} defaultValue="Amanhã, 10h" /></L>
                <L t="Expiração do link"><select className={field}><option>24 horas após o prazo</option><option>48 horas após o prazo</option><option>No prazo</option></select></L>
              </>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <button type="button" onClick={close} className="admin-input min-h-11 px-4 text-sm">{done ? "Fechar" : "Cancelar"}</button>
          {!done && origin !== "reserva" && (
            <button type="button" onClick={() => setDone(true)} className="min-h-11 rounded-[var(--admin-radius)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-primary-foreground,white)]">Gerar (demonstração)</button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
