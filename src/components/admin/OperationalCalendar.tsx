import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brush, CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AdminPageHeader, AdminStatusBadge } from "./AdminPrimitives";
import { CompactSearch } from "./PhaseOnePatterns";
import { SyncUpcomingButton } from "./SyncUpcomingButton";
import { OpTaskExecution } from "./OpTaskExecution";
import { ReservationPreparation } from "./ReservationPreparation";
import { preparationQuery } from "@/lib/api/reservation-preparation-api";
import { preparationState } from "@/lib/reservation-preparation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { operationalCalendarQuery } from "@/lib/api/op-calendar-api";
import { scheduleCleaning } from "@/lib/api/core-client";
import { cleaningBoardQuery } from "@/lib/api/op-cleaning-api";
import { addDaysISO, localISODate } from "@/lib/local-date";
import { cleaningWindow, suggestedCleaningDate, validCleaningDate, type CalendarStay } from "@/lib/op-calendar";

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dateValue = (iso: string) => new Date(`${iso}T12:00:00`);
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function OperationalCalendar() {
  const today = localISODate();
  const [start, setStart] = useState(addDaysISO(today, -1));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CalendarStay | null>(null);
  const [cleaningDate, setCleaningDate] = useState(today);
  const [picker, setPicker] = useState(false);
  const [periodPicker, setPeriodPicker] = useState(false);
  const qc = useQueryClient();
  const data = useQuery(operationalCalendarQuery());
  const board = useQuery(cleaningBoardQuery(today));
  const preparation = useQuery(preparationQuery());
  const days = Array.from({ length: 21 }, (_, i) => addDaysISO(start, i));
  const end = addDaysISO(start, 21);
  const stays = data.data?.stays ?? [];
  const tasks = data.data?.tasks ?? [];
  const props = (board.data?.rows ?? []).filter((p) => `${p.property} ${p.code}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const window = selected ? cleaningWindow(selected, stays) : null;
  const task = selected ? tasks.find((t) => t.reservationId === selected.id) : null;
  useEffect(() => {
    if (!selected) return;
    const w = cleaningWindow(selected, stays);
    setCleaningDate(task?.date ?? suggestedCleaningDate(w, today));
  }, [selected, task?.date, data.data, today]);
  const save = useMutation({
    mutationFn: () => {
      if (!task || !window || !validCleaningDate(window, cleaningDate)) throw new Error("Escolha um dia entre a saída e a próxima entrada.");
      return scheduleCleaning(task.id, cleaningDate);
    },
    onSuccess: () => { toast.success("Limpeza reorganizada."); for (const k of ["op-movements", "op-tasks", "op-cleaning"]) void qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(dateValue(start));
  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Operação" title="Calendário operacional" actions={<SyncUpcomingButton />} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => setStart(addDaysISO(start, -14))}><ChevronLeft className="size-4" /></Button>
        <Popover open={periodPicker} onOpenChange={setPeriodPicker}><PopoverTrigger asChild><Button variant="outline" className="capitalize"><CalendarDays className="size-4" />{month}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar locale={ptBR} mode="single" selected={dateValue(start)} onSelect={(d) => { if (d) { setStart(toISO(d)); setPeriodPicker(false); } }} className="pointer-events-auto" /></PopoverContent></Popover>
        <Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => setStart(addDaysISO(start, 14))}><ChevronRight className="size-4" /></Button>
        <Button variant="ghost" onClick={() => setStart(addDaysISO(today, -1))}>Hoje</Button>
      </div>
      <div className="w-full sm:w-72"><CompactSearch value={search} onChange={setSearch} placeholder="Buscar imóvel" /></div>
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{props.length} imóveis</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Reserva</span><span className="inline-flex items-center gap-1.5"><Brush className="size-3 text-[var(--admin-warning)]" />Limpeza</span><span className="text-[var(--admin-danger)]">Out-in · saída e entrada no mesmo dia</span><span>Flexível · intervalo livre entre reservas</span></div>
    {(data.isError || board.isError) && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o calendário.<Button variant="link" onClick={() => { void data.refetch(); void board.refetch(); }}>Tentar novamente</Button></p>}
    {data.isPending || board.isPending ? <p className="py-10 text-sm text-muted-foreground">Carregando calendário…</p> : <div className="op-calendar"><div className="op-calendar-scroll" tabIndex={0} aria-label="Calendário de reservas por imóvel"><div className="op-calendar-grid" style={{ "--op-days": days.length } as React.CSSProperties}>
      <div className="op-calendar-heading op-calendar-corner">Imóveis · {dm(start)} a {dm(days[days.length - 1] ?? start)}</div>
      {days.map((d) => <div key={d} className={`op-calendar-heading ${d === today ? "is-today" : ""}`}><span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(dateValue(d))}</span><strong>{d.slice(8, 10)}</strong></div>)}
      {props.map((p, idx) => {
        const row = idx + 2;
        const mine = stays.filter((s) => s.implementationId === p.id);
        const visible = mine.filter((s) => s.checkin < end && s.checkout >= start);
        return <div key={p.id} className="contents">
          <div className="op-calendar-property" style={{ gridRow: row, gridColumn: 1 }}><strong className="break-words">{p.property}</strong><small>{p.code}</small><AdminStatusBadge tone={p.status.state === "pronto" ? "success" : p.status.state === "sujo" ? "danger" : p.status.state === "ocupado" ? "info" : "neutral"}>{p.status.state === "pronto" ? "Pronto" : p.status.state === "sujo" ? "Sujo" : p.status.state === "ocupado" ? "Ocupado" : "Sem registro"}</AdminStatusBadge></div>
          {days.map((d, i) => <div key={d} className={`op-calendar-cell ${[0, 6].includes(dateValue(d).getDay()) ? "is-weekend" : ""} ${d === today ? "is-today" : ""}`} style={{ gridRow: row, gridColumn: i + 2 }} />)}
          {visible.map((s) => {
            const from = Math.max(0, days.findIndex((d) => d >= s.checkin));
            const last = s.checkout >= end ? 21 : Math.max(from + 1, days.findIndex((d) => d >= s.checkout));
            const ready = preparationState(preparation.data ?? [], s.id);
            return <div key={s.id} className="op-calendar-event" style={{ "--op-row": row, gridColumn: `${from + 2} / ${last + 2}` } as React.CSSProperties}><Button variant="ghost" title={`${s.guest} · ${dm(s.checkin)} a ${dm(s.checkout)} · Preparação ${preparation.isSuccess ? `${ready.count}/5` : "indisponível"}`} aria-label={`Reserva ${s.guest}, ${p.property}, ${dm(s.checkin)} a ${dm(s.checkout)}`} onClick={() => setSelected(s)}><span className="truncate">{s.guest}{preparation.isSuccess ? ` · ${ready.count}/5` : ""}</span></Button></div>;
          })}
          {tasks.filter((t) => t.propertyId === p.id && t.status !== "cancelada" && t.date >= start && t.date < end).map((t) => {
            const stay = mine.find((s) => s.id === t.reservationId);
            const w = stay ? cleaningWindow(stay, stays) : null;
            const conflict = w && !validCleaningDate(w, t.date);
            const label = conflict ? "Rever" : w?.kind === "out_in" ? "Out-in" : w?.kind === "flexivel" ? "Flexível" : "Limpeza";
            return <div key={t.id} className={`op-calendar-event op-calendar-routine ${conflict || w?.kind === "out_in" ? "is-critical" : ""} ${t.status === "concluida" ? "is-done" : ""}`} style={{ "--op-row": row, gridColumn: days.indexOf(t.date) + 2 } as React.CSSProperties}><Button variant="ghost" aria-label={`${label}, ${p.property}, ${dm(t.date)}`} title={`${label} · ${t.staff.join(", ") || "Sem profissional"}`} onClick={() => { if (stay) setSelected(stay); }} disabled={!stay}><Brush className="size-3 shrink-0" /><span className="truncate">{t.status === "concluida" ? "Feita" : label}</span></Button></div>;
          })}
        </div>;
      })}
    </div></div>{!props.length && <p className="p-6 text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>}</div>}
    <Dialog open={!!selected} onOpenChange={(v) => { if (!v) { setSelected(null); setPicker(false); } }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{selected?.guest}</DialogTitle></DialogHeader>{selected && window && <div className="space-y-4">
      <p className="text-sm font-medium">{board.data?.rows.find((p) => p.id === selected.implementationId)?.property}</p>
      <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-sm"><div><dt className="text-xs text-muted-foreground">Check-in</dt><dd className="mt-1 font-semibold">{dm(selected.checkin)}</dd></div><div><dt className="text-xs text-muted-foreground">Check-out</dt><dd className="mt-1 font-semibold">{dm(selected.checkout)}</dd></div></dl>
      <ReservationPreparation reservationId={selected.id} />
      <div className="space-y-2"><AdminStatusBadge tone={window.kind === "out_in" ? "danger" : "info"}>{window.kind === "out_in" ? "Out-in" : window.kind === "flexivel" ? "Limpeza flexível" : "Sem próxima entrada"}</AdminStatusBadge><p className="text-sm">{window.kind === "out_in" ? `Saída e próxima entrada em ${dm(window.start)}. Limpeza obrigatória no intervalo entre hóspedes.` : window.end ? `Limpeza entre ${dm(window.start)} e ${dm(window.end)}. Próxima reserva: ${window.next?.guest}.` : `Limpeza a partir de ${dm(window.start)}. Não há outra entrada nas reservas importadas.`}</p></div>
      {task ? <div className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Brush className="size-4" />Rotina de limpeza</h3><p className="text-xs text-muted-foreground">{task.staff.length ? task.staff.join(", ") : "Sem profissional vinculado"}</p>
        {task.status !== "concluida" && task.status !== "cancelada" && <div className="flex flex-wrap items-center gap-2"><Popover open={picker} onOpenChange={setPicker}><PopoverTrigger asChild><Button variant="outline"><CalendarDays className="size-4" />{dm(cleaningDate)}</Button></PopoverTrigger><PopoverContent className="pointer-events-auto w-auto p-0"><Calendar locale={ptBR} mode="single" selected={dateValue(cleaningDate)} defaultMonth={dateValue(cleaningDate)} disabled={(d) => !validCleaningDate(window, toISO(d))} onSelect={(d) => { if (d) { setCleaningDate(toISO(d)); setPicker(false); } }} className="pointer-events-auto" /></PopoverContent></Popover><Button disabled={save.isPending || !validCleaningDate(window, cleaningDate)} onClick={() => save.mutate()}>{save.isPending ? "Salvando…" : "Salvar dia da limpeza"}</Button></div>}
        {!validCleaningDate(window, task.date) && <p className="text-sm text-destructive">A data da limpeza precisa ser revista: está fora do intervalo disponível.</p>}
        <OpTaskExecution taskId={task.id} />
      </div> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />Não há rotina vinculada a esta saída.</p>}
    </div>}</DialogContent></Dialog>
  </div>;
}