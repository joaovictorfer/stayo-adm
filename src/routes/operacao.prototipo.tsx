import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardCheck,
  LogIn,
  LogOut,
  PlugZap,
  RefreshCw,
  Sparkles,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatCard,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { PeriodFilter } from "@/components/patterns/IndicatorCard";

export const Route = createFileRoute("/operacao/prototipo")({
  head: () => ({
    meta: [
      { title: "Central Operacional (protótipo) — Stayo Admin" },
      { name: "description", content: "Protótipo visual da Central Operacional do Stayo Admin." },
      { property: "og:title", content: "Central Operacional (protótipo) — Stayo Admin" },
      { property: "og:description", content: "Protótipo visual somente leitura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CentralPrototype,
});

/* Dados ilustrativos apenas em memória — sem hóspedes, sem persistência. */
type Kind = "checkin" | "checkout" | "limpeza" | "vistoria" | "tarefa";
type Priority = "critica" | "alta" | "media";
interface Attention {
  id: string;
  kind: Kind;
  label: string;
  property: string;
  when: string;
  priority: Priority;
  owner: string | null;
}
interface AgendaItem {
  id: string;
  time: string;
  kind: Kind;
  label: string;
  property: string;
}

const PROPERTIES = ["Imóvel A · 101", "Imóvel B · 204", "Imóvel C · 12"];

const ATTENTION: Attention[] = [
  { id: "a1", kind: "limpeza", label: "Limpeza atrasada", property: PROPERTIES[1]!, when: "SLA vencido há 40 min", priority: "critica", owner: null },
  { id: "a2", kind: "checkin", label: "Check-in às 15h sem limpeza concluída", property: PROPERTIES[1]!, when: "Em 2h10", priority: "critica", owner: "Equipe limpeza" },
  { id: "a3", kind: "tarefa", label: "Manutenção de chuveiro", property: PROPERTIES[0]!, when: "Prazo hoje 18h", priority: "alta", owner: null },
  { id: "a4", kind: "vistoria", label: "Vistoria pendente", property: PROPERTIES[2]!, when: "Até 17h", priority: "media", owner: "Operação" },
];

const AGENDA: AgendaItem[] = [
  { id: "g1", time: "10:00", kind: "checkout", label: "Check-out", property: PROPERTIES[0]! },
  { id: "g2", time: "11:00", kind: "limpeza", label: "Limpeza de saída", property: PROPERTIES[0]! },
  { id: "g3", time: "14:00", kind: "vistoria", label: "Vistoria de entrada", property: PROPERTIES[0]! },
  { id: "g4", time: "11:00", kind: "checkout", label: "Check-out", property: PROPERTIES[1]! },
  { id: "g5", time: "16:30", kind: "checkin", label: "Check-in", property: PROPERTIES[2]! },
];

const KIND_ICON = { checkin: LogIn, checkout: LogOut, limpeza: Sparkles, vistoria: ClipboardCheck, tarefa: AlertTriangle };
const PRIORITY: Record<Priority, { label: string; tone: AdminTone }> = {
  critica: { label: "Crítica", tone: "danger" },
  alta: { label: "Alta", tone: "warning" },
  media: { label: "Média", tone: "neutral" },
};

type DemoState = "normal" | "parcial" | "carregando" | "vazio" | "indisponivel";
const stateOptions: { value: DemoState; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "parcial", label: "Parcial" },
  { value: "carregando", label: "Carregando" },
  { value: "vazio", label: "Vazio" },
  { value: "indisponivel", label: "Indisponível" },
];

function CentralPrototype() {
  const [demo, setDemo] = useState<DemoState>("normal");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [property, setProperty] = useState("todos");

  const attention = useMemo(
    () => ATTENTION.filter((a) => property === "todos" || a.property === property),
    [property],
  );
  const agenda = useMemo(
    () => AGENDA.filter((a) => property === "todos" || a.property === property),
    [property],
  );
  const grouped = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const a of agenda) m.set(a.property, [...(m.get(a.property) ?? []), a]);
    for (const [, list] of m) list.sort((x, y) => x.time.localeCompare(y.time));
    return [...m.entries()];
  }, [agenda]);

  const hasData = demo === "normal" || demo === "parcial";
  const count = (k: Kind) => agenda.filter((a) => a.kind === k).length;
  const stats = [
    { icon: LogIn, label: "Check-ins", value: count("checkin") },
    { icon: LogOut, label: "Check-outs", value: count("checkout") },
    { icon: Sparkles, label: "Limpezas pendentes", value: count("limpeza") + attention.filter((a) => a.kind === "limpeza").length },
    { icon: AlertTriangle, label: "Tarefas críticas", value: attention.filter((a) => a.priority === "critica").length, tone: "danger" as AdminTone },
    { icon: UserX, label: "Sem responsável", value: attention.filter((a) => !a.owner).length, tone: "warning" as AdminTone },
    { icon: CalendarCheck, label: "Vistorias pendentes", value: count("vistoria") },
  ];

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
        <span className="font-medium">Protótipo visual · dados ilustrativos, somente leitura</span>
        <div className="ml-auto overflow-x-auto">
          <PeriodFilter value={demo} onChange={setDemo} options={stateOptions} />
        </div>
      </div>

      <AdminPageHeader
        title="Operação"
        description="Visão do dia e prioridades operacionais."
        meta={
          <span className="inline-flex items-center gap-1 text-xs">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {demo === "carregando"
              ? "Atualizando…"
              : demo === "indisponivel"
                ? "Sem atualização"
                : "Atualizado às 09:42"}
          </span>
        }
        actions={
          <>
            <input
              type="date"
              aria-label="Data"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="admin-input h-10 px-3 text-sm"
            />
            <select
              aria-label="Filtrar por imóvel"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              className="admin-input h-10 max-w-full px-3 text-sm"
            >
              <option value="todos">Todos os imóveis</option>
              {PROPERTIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </>
        }
      />

      {demo === "parcial" && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Dados parciais: vistorias não foram carregadas. Os demais números podem estar incompletos.
        </p>
      )}

      {demo === "indisponivel" ? (
        <div className="admin-panel" role="alert">
          <AdminEmptyState
            icon={PlugZap}
            title="Integração operacional indisponível"
            description="Não foi possível obter os dados do dia. Nenhum número é exibido para não induzir a erro. Tente novamente em alguns minutos."
          />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {stats.map((s) => (
              <AdminStatCard
                key={s.label}
                icon={s.icon}
                label={s.label}
                tone={hasData && s.value > 0 ? (s.tone ?? "neutral") : "neutral"}
                value={
                  demo === "carregando" ? (
                    <span className="admin-skeleton inline-block h-6 w-8 rounded" />
                  ) : demo === "parcial" && s.label === "Vistorias pendentes" ? (
                    "—"
                  ) : hasData ? (
                    s.value
                  ) : (
                    0
                  )
                }
              />
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <AdminSection title="O que exige atenção agora" description="Ordenado por criticidade.">
              <div className="admin-panel">
                {demo === "carregando" ? (
                  <SkeletonRows />
                ) : !hasData || attention.length === 0 ? (
                  <AdminEmptyState title="Nada exige atenção agora" description="Novas pendências aparecem aqui assim que surgirem." />
                ) : (
                  <ul className="divide-y divide-[var(--admin-border)]">
                    {attention.map((a) => {
                      const Icon = KIND_ICON[a.kind];
                      return (
                        <li key={a.id} className="flex min-h-14 items-start gap-3 px-4 py-3">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--admin-text)]">{a.label}</p>
                            <p className="text-xs text-[var(--admin-muted)]">
                              {a.property} · {a.when} · {a.owner ?? "Sem responsável"}
                            </p>
                          </div>
                          <AdminStatusBadge tone={PRIORITY[a.priority].tone}>{PRIORITY[a.priority].label}</AdminStatusBadge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </AdminSection>

            <AdminSection
              title="Agenda do dia"
              description="Por imóvel, em ordem de horário."
              action={
                <Link to="/operacao/agenda-prototipo" className="text-sm font-medium text-[var(--admin-primary)] hover:underline">
                  Ver agenda completa
                </Link>
              }
            >
              <div className="admin-panel">
                {demo === "carregando" ? (
                  <SkeletonRows />
                ) : !hasData || grouped.length === 0 ? (
                  <AdminEmptyState title="Sem eventos nesta data" description="Escolha outra data ou outro imóvel para ver a agenda." />
                ) : (
                  <div className="divide-y divide-[var(--admin-border)]">
                    {grouped.map(([prop, items]) => (
                      <div key={prop} className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">{prop}</p>
                        <ol className="border-l border-[var(--admin-border)] pl-3">
                          {items
                            .filter((i) => !(demo === "parcial" && i.kind === "vistoria"))
                            .map((i) => {
                              const Icon = KIND_ICON[i.kind];
                              return (
                                <li key={i.id} className="flex items-center gap-3 py-1.5 text-sm">
                                  <span className="w-11 shrink-0 tabular-nums text-[var(--admin-muted)]">{i.time}</span>
                                  <Icon className="h-4 w-4 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
                                  <span className="text-[var(--admin-text)]">{i.label}</span>
                                </li>
                              );
                            })}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AdminSection>
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-[var(--admin-border)]" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="admin-skeleton h-4 w-4 rounded" />
          <div className="flex-1 space-y-2">
            <div className="admin-skeleton h-3.5 w-2/3 rounded" />
            <div className="admin-skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
