import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BedDouble, Brush, Building2, CalendarDays, ChevronRight, LayoutGrid, List, LogIn, LogOut, Sparkles, Users } from "lucide-react";
import { AdminEmptyState, AdminPageHeader, AdminStatusBadge } from "./AdminPrimitives";
import { CompactSearch, ModuleTabs, PortfolioMetric } from "./PhaseOnePatterns";
import { ReservationPreparation } from "./ReservationPreparation";
import { ReservationArrivalSheet } from "./ReservationArrivalSheet";
import { CleanPropertyDialog } from "./CleanPropertyDialog";
import { OpTaskDialog } from "./OpTaskDialog";
import { SyncUpcomingButton } from "./SyncUpcomingButton";
import { useBoardTasks } from "./TaskBoard";
import { operationalCalendarQuery } from "@/lib/api/op-calendar-api";
import { cleaningBoardQuery, type CleaningRow } from "@/lib/api/op-cleaning-api";
import { listImplementationCoverUrls } from "@/lib/api/implementation-covers";
import { opStaffQuery } from "@/lib/api/op-execution";
import type { BoardTask } from "@/lib/api/op-tasks";
import { addDaysISO, formatBrasiliaDateTime, formatCalendarDate, localISODate, longDayLabel } from "@/lib/local-date";
import { cleaningWindow, type CalendarStay } from "@/lib/op-calendar";
import { staysForDay, type StayDayTab } from "@/lib/op-day-summary";
import type { Movement } from "@/lib/op-movements";
import { BrazilianDateInput } from "@/components/ui/brazilian-date-input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OperationalPropertyFacts } from "./OperationalPropertyFacts";

type Tab = StayDayTab | "pronto" | "sujo" | "todos";
const stateInfo = {
  pronto: { label: "Limpo · pronto", tone: "success" },
  sujo: { label: "Sujo · limpar", tone: "danger" },
  ocupado: { label: "Ocupado", tone: "info" },
  sem_registro: { label: "Sem registro", tone: "neutral" },
} as const;
const dm = (date: string | null) => date ? formatCalendarDate(date) : "—";

export function CheckinPreparationPanel() {
  const today = localISODate();
  const tomorrow = addDaysISO(today, 1);
  const qc = useQueryClient();
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<Tab>("todos");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [movement, setMovement] = useState<Movement | null>(null);
  const [routine, setRoutine] = useState<BoardTask | null>(null);
  const [cleaning, setCleaning] = useState<CleaningRow | null>(null);
  const data = useQuery(operationalCalendarQuery());
  const board = useQuery(cleaningBoardQuery(today));
  const staff = useQuery(opStaffQuery());
  const tasks = useBoardTasks();
  const properties = new Map((board.data?.rows ?? []).map((p) => [p.id, p]));
  const ids = [...properties.keys()].sort();
  const parking = useQuery({ queryKey: ["operational-parking", ids], enabled: ids.length > 0, queryFn: async () => {
    const result = await supabase.from("implementation_property_details").select("implementation_id, parking_box, parking_spots").in("implementation_id", ids);
    if (result.error) throw result.error;
    return result.data;
  } });
  const covers = useQuery({ queryKey: ["implementation-covers", "operational-summary", ids], queryFn: () => listImplementationCoverUrls(ids), enabled: ids.length > 0, staleTime: 3_000_000 });
  const stays = (data.data?.stays ?? []).filter((s) => properties.has(s.implementationId));
  const counts = { chegadas: staysForDay(stays, date, "chegadas").length, saidas: staysForDay(stays, date, "saidas").length, em_casa: staysForDay(stays, date, "em_casa").length,
    pronto: [...properties.values()].filter(p => p.status.state === "pronto").length, sujo: [...properties.values()].filter(p => p.status.state === "sujo").length, todos: properties.size };
  const propertyTab = tab === "pronto" || tab === "sujo" || tab === "todos";
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const matches = (value: string) => value.toLocaleLowerCase("pt-BR").includes(term);
  const shownStays = propertyTab ? [] : staysForDay(stays, date, tab).filter(s => matches(`${properties.get(s.implementationId)?.property} ${s.guest}`));
  const shownProperties = [...properties.values()].filter(p => (tab === "todos" || p.status.state === tab) && matches(`${p.property} ${p.code}`));
  const loading = data.isPending || board.isPending;
  const failed = data.isError || board.isError;
  const refresh = () => { for (const key of ["op-cleaning", "op-tasks", "op-movements", "op-costs"]) void qc.invalidateQueries({ queryKey: [key] }); };
  const openReservation = (stay: CalendarStay) => {
    const type = tab === "saidas" ? "checkout" : "checkin";
    setMovement({ id: `${stay.id}:${type === "checkout" ? "out" : "in"}`, date: type === "checkout" ? stay.checkout : stay.checkin,
      type, implementationId: stay.implementationId, property: properties.get(stay.implementationId)?.property ?? "Imóvel", guest: stay.guest, channel: stay.channel ?? null, turnover: null });
  };
  const photo = (id: string, name: string) => <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-muted text-muted-foreground sm:h-24 sm:w-28">{covers.data?.[id] ? <img src={covers.data[id]} alt={name} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Building2 className="size-7" /></div>}</div>;
  const facts = (id: string) => {
    const row = parking.data?.find(p => p.implementation_id === id);
    return parking.isError ? <p role="alert" className="text-xs text-destructive">Vaga indisponível<Button variant="link" size="sm" onClick={() => void parking.refetch()}>Tentar novamente</Button></p> : parking.isPending ? <p className="text-xs text-muted-foreground">Consultando vaga…</p> : <OperationalPropertyFacts box={row?.parking_box ?? null} spots={row?.parking_spots ?? null} stays={staysForDay(stays, date, "em_casa").filter(s => s.implementationId === id)} />;
  };
  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação · STAYO" title="Resumo operacional" description={longDayLabel(date)} actions={<SyncUpcomingButton />} />
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
      <div className="flex flex-wrap items-center gap-2"><div className="flex gap-1 rounded-md bg-muted p-1"><Button size="sm" variant={date === today ? "default" : "ghost"} onClick={() => setDate(today)}>Hoje</Button><Button size="sm" variant={date === tomorrow ? "default" : "ghost"} onClick={() => setDate(tomorrow)}>Amanhã</Button></div><BrazilianDateInput aria-label="Dia da preparação" className="admin-input h-9 w-36 px-2 text-sm" value={date} onValueChange={(value) => { if (value) setDate(value); }} /></div>
      <div className="flex w-full items-center gap-2 sm:w-auto"><div className="min-w-0 flex-1 sm:w-64"><CompactSearch value={search} onChange={setSearch} placeholder="Buscar imóvel ou hóspede" /></div><div className="flex shrink-0 gap-1"><Button size="icon" variant={layout === "grid" ? "secondary" : "ghost"} aria-label="Visualização em cartões" aria-pressed={layout === "grid"} title="Cartões" onClick={() => setLayout("grid")}><LayoutGrid className="size-4" /></Button><Button size="icon" variant={layout === "list" ? "secondary" : "ghost"} aria-label="Visualização em lista" aria-pressed={layout === "list"} title="Lista" onClick={() => setLayout("list")}><List className="size-4" /></Button></div></div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <PortfolioMetric icon={LogIn} value={loading || failed ? "—" : counts.chegadas} label="Chegadas no dia" tone="success" />
      <PortfolioMetric icon={LogOut} value={loading || failed ? "—" : counts.saidas} label="Saídas no dia" tone="warning" />
      <PortfolioMetric icon={BedDouble} value={loading || failed ? "—" : counts.em_casa} label="Hospedagens no dia" tone="info" />
      <PortfolioMetric icon={Sparkles} value={board.isPending || board.isError ? "—" : counts.pronto} label="Limpos · hoje" tone="success" />
      <PortfolioMetric icon={Brush} value={board.isPending || board.isError ? "—" : counts.sujo} label="Sujos · hoje" tone="warning" />
    </div>
    <ModuleTabs value={tab} onChange={setTab} options={[{ value: "chegadas", label: "Chegadas", count: counts.chegadas }, { value: "saidas", label: "Saídas", count: counts.saidas }, { value: "em_casa", label: "Em casa", count: counts.em_casa }, { value: "pronto", label: "Limpos", count: counts.pronto }, { value: "sujo", label: "Sujos", count: counts.sujo }, { value: "todos", label: "Todos os imóveis", count: counts.todos }]} />
    <p className="text-xs text-muted-foreground">{propertyTab ? `Situação de limpeza em ${dm(today)} · ${shownProperties.length} imóveis` : `Hospedagens previstas · ${shownStays.length} reservas · chegadas e saídas incluídas em “Em casa”`}</p>
    {loading ? <p role="status" className="py-10 text-sm text-muted-foreground">Carregando operação…</p> : failed ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar a operação.<Button variant="link" onClick={() => { void data.refetch(); void board.refetch(); }}>Tentar novamente</Button></p> : (propertyTab ? !shownProperties.length : !shownStays.length) ? <AdminEmptyState icon={propertyTab ? Brush : BedDouble} title={propertyTab ? "Nenhum imóvel neste filtro" : "Nenhuma reserva neste dia"} description="" /> : <div className={layout === "grid" ? "grid items-start gap-4 xl:grid-cols-2" : "grid gap-3"}>
      {layout === "list" ? (propertyTab ? shownProperties.map(p => ({ p, stay: null as CalendarStay | null })) : shownStays.flatMap(stay => { const p = properties.get(stay.implementationId); return p ? [{ p, stay }] : []; })).map(({ p, stay }) => {
        const current = stay ?? staysForDay(stays, date, "em_casa").find(s => s.implementationId === p.id);
        return <article key={stay?.id ?? p.id} data-reservation-id={stay?.id} className="grid items-center gap-3 border-b border-border py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="min-w-0"><h2 className="break-words font-[var(--stayo-font-display)] text-base font-semibold">{p.property}</h2><div className="mt-2">{facts(p.id)}</div></div>
          <div className="space-y-2"><AdminStatusBadge tone={stateInfo[p.status.state].tone}>{stateInfo[p.status.state].label} · hoje</AdminStatusBadge><p className="text-xs text-muted-foreground">{current ? `${dm(current.checkin)} → ${dm(current.checkout)}` : `Próxima chegada: ${dm(p.status.nextCheckin)}`}</p></div>
          <div className="min-w-0 text-xs"><p className="font-medium">{p.next ? p.next.staffName ?? "Sem profissional" : "Sem limpeza em aberto"}</p><p className="mt-1 text-muted-foreground">{p.next ? `Limpeza prevista: ${dm(p.next.dueDate)}` : `Última limpeza: ${dm(p.status.lastCleaning)}`}</p></div>
          <div className="flex flex-wrap gap-1">{current && <Button size="sm" variant="outline" onClick={() => openReservation(current)}>Reserva<ChevronRight className="size-4" /></Button>}<Button size="sm" variant="ghost" onClick={() => setCleaning(p)}><Sparkles className="size-4" />Marcar limpo</Button>{p.next && <Button size="sm" variant="ghost" disabled={!tasks.rows.some(t => t.id === p.next?.id)} onClick={() => setRoutine(tasks.rows.find(t => t.id === p.next?.id) ?? null)}>Rotina</Button>}</div>
        </article>;
      }) : propertyTab ? shownProperties.map(p => <article key={p.id} className="rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40 sm:p-5">
        <header className="flex items-start gap-3">{photo(p.id, p.property)}<div className="min-w-0 flex-1"><h2 className="break-words font-[var(--stayo-font-display)] text-lg font-semibold">{p.property}</h2><p className="mb-2 text-xs text-muted-foreground">{p.code}</p><AdminStatusBadge tone={stateInfo[p.status.state].tone}>{stateInfo[p.status.state].label}</AdminStatusBadge></div></header>
        <div className="mt-3">{facts(p.id)}</div>
        <dl className="my-4 grid grid-cols-2 gap-3 border-y border-border py-3 text-sm"><div><dt className="text-xs text-muted-foreground">Última limpeza</dt><dd className="mt-1 font-medium">{dm(p.status.lastCleaning)}</dd></div><div><dt className="text-xs text-muted-foreground">Próxima chegada</dt><dd className="mt-1 font-medium">{dm(p.status.nextCheckin)}</dd></div></dl>
        <p className="flex items-center gap-2 text-sm"><Users className="size-4 shrink-0 text-muted-foreground" /><span>{p.next ? p.next.staffName ?? "Limpeza sem profissional" : "Sem limpeza em aberto"}</span></p>
        <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setCleaning(p)}><Sparkles className="size-4" />Marcar limpo</Button>{staysForDay(stays, date, "em_casa").filter(s => s.implementationId === p.id).map(s => <Button key={s.id} size="sm" variant="ghost" onClick={() => openReservation(s)}>Reserva<ChevronRight className="size-4" /></Button>)}{p.next && <Button size="sm" variant="ghost" disabled={!tasks.rows.some(t => t.id === p.next?.id)} onClick={() => setRoutine(tasks.rows.find(t => t.id === p.next?.id) ?? null)}>Abrir rotina<ChevronRight className="size-4" /></Button>}</div>
      </article>) : shownStays.map(s => {
        const p = properties.get(s.implementationId);
        if (!p) return null;
        const window = cleaningWindow(s, stays);
        const previous = stays.filter(other => other.implementationId === s.implementationId && other.id !== s.id && other.checkout <= s.checkin).sort((a,b) => b.checkout.localeCompare(a.checkout))[0];
        const linked = tasks.rows.find(t => t.source === "admin" && t.kind === "limpeza" && t.reservationId === (tab === "chegadas" ? previous?.id : s.id));
        const status = stateInfo[p.status.state];
        return <article key={s.id} data-reservation-id={s.id} className="rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40 sm:p-5">
          <header className="flex items-start gap-3">{photo(p.id, p.property)}<div className="min-w-0 flex-1"><h2 className="break-words font-[var(--stayo-font-display)] text-lg font-semibold">{p.property}</h2><p className="mt-1 break-words text-sm font-medium">{s.guest}</p><div className="mt-2 flex flex-wrap gap-2"><AdminStatusBadge tone="neutral">{s.channel || "Canal não informado"}</AdminStatusBadge><AdminStatusBadge tone={status.tone}>{status.label} · hoje</AdminStatusBadge></div></div></header>
          <div className="mt-3">{facts(p.id)}</div>
          <div className="my-4 grid grid-cols-2 gap-3"><div className="rounded-md bg-[var(--admin-success-soft)] p-3 text-[var(--admin-success)]"><p className="flex items-center gap-1.5 text-xs"><LogIn className="size-4" />Check-in</p><p className="mt-1 font-semibold">{dm(s.checkin)}</p></div><div className="rounded-md bg-[var(--admin-warning-soft)] p-3 text-[var(--admin-warning)]"><p className="flex items-center gap-1.5 text-xs"><LogOut className="size-4" />Check-out</p><p className="mt-1 font-semibold">{dm(s.checkout)}</p></div></div>
          <div className="space-y-2 border-y border-border py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 font-medium"><Brush className="size-4 text-primary" />{tab === "chegadas" ? "Limpeza de preparação" : "Limpeza após esta hospedagem"}</p>{tab !== "chegadas" && <AdminStatusBadge tone={window.kind === "out_in" ? "danger" : "neutral"}>{window.kind === "out_in" ? "Out-in · mesmo dia" : window.kind === "flexivel" ? "Janela flexível" : "Sem próxima chegada"}</AdminStatusBadge>}</div><p className="text-xs text-muted-foreground">{linked ? `${linked.responsibleName || "Sem profissional"} · ${linked.completedAt ? `Concluída · ${formatBrasiliaDateTime(linked.completedAt)}` : `Prevista · ${dm(linked.dueDate?.slice(0,10) ?? null)}`}` : "Nenhuma rotina vinculada encontrada"}</p>{tab !== "chegadas" && window.next && <p className="text-xs text-muted-foreground"><CalendarDays className="mr-1 inline size-3" />Próxima chegada: {dm(window.next.checkin)} · {window.next.guest}</p>}</div>
          {tab === "chegadas" && <div className="pt-4"><ReservationPreparation reservationId={s.id} /></div>}
          <footer className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => openReservation(s)}>Detalhes da reserva<ChevronRight className="size-4" /></Button>{linked && <Button variant="ghost" size="sm" onClick={() => setRoutine(linked)}><Brush className="size-4" />Abrir rotina</Button>}</footer>
        </article>;
      })}
    </div>}
    {tasks.adminError && <p role="alert" className="text-sm text-destructive">Rotinas indisponíveis. As reservas continuam visíveis.</p>}
    <ReservationArrivalSheet movement={movement} onClose={() => setMovement(null)} tasks={tasks.rows} onRoutine={t => { setMovement(null); setRoutine(t); }} />
    <OpTaskDialog open={!!routine} onOpenChange={value => { if (!value) { setRoutine(null); refresh(); } }} task={routine} defaultDate={date} />
    <CleanPropertyDialog row={cleaning} staff={(staff.data ?? []).filter(s => s.active)} today={today} onClose={() => setCleaning(null)} onDone={refresh} />
  </div>;
}
