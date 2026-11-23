import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LogIn, LogOut, UserRound } from "lucide-react";
import { AdminStatusBadge } from "./AdminPrimitives";
import { operationalCalendarQuery } from "@/lib/api/op-calendar-api";
import { cleaningWindow } from "@/lib/op-calendar";
import { opTasksQuery, type BoardTask } from "@/lib/api/op-tasks";
import { formatCalendarDate, formatBrasiliaDateTime } from "@/lib/local-date";
const dateLabel = formatCalendarDate;
export function CleaningStayContext({ task: initialTask }: { task: BoardTask }) {
  const current = useQuery(opTasksQuery());
  const task = current.data?.find((t) => t.id === initialTask.id) ?? initialTask;
  const data = useQuery(operationalCalendarQuery());
  const stay = data.data?.stays.find((s) => s.id === task.reservationId);
  if (data.isPending) return <p className="text-sm text-muted-foreground">Carregando hospedagem…</p>;
  if (data.isError) return <p role="alert" className="text-sm text-destructive">Não foi possível conferir a hospedagem vinculada.</p>;
  const window = stay ? cleaningWindow(stay, data.data?.stays ?? []) : null;
  return <div className="space-y-4">
    {stay ? <section className="space-y-3 border-y border-border py-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><CalendarDays className="size-4" />Hospedagem de origem</h3>
      <p className="flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4" />{stay.guest}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><LogIn className="size-3" />Check-in</dt><dd className="mt-1 font-medium">{dateLabel(stay.checkin)}</dd></div><div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><LogOut className="size-3" />Check-out</dt><dd className="mt-1 font-medium">{dateLabel(stay.checkout)}</dd></div></dl>
      <p className="text-xs text-muted-foreground">Limpeza após esta hospedagem{window?.next ? ", para preparar a próxima entrada." : ", para deixar o apartamento pronto."}</p>
    </section> : <p className="text-sm text-muted-foreground">Rotina avulsa · sem hospedagem vinculada.</p>}
    {window && <section className="space-y-2 border-l-2 border-primary bg-muted/40 p-3"><AdminStatusBadge tone={window.kind === "out_in" ? "danger" : "info"}>{window.kind === "out_in" ? "Out-in · virada crítica" : window.kind === "flexivel" ? "Limpeza flexível" : "Sem próxima hospedagem"}</AdminStatusBadge>{window.next ? <><p className="text-sm font-medium">Próxima hospedagem · {window.next.guest}</p><p className="text-xs text-muted-foreground">Entrada {dateLabel(window.next.checkin)} · limpeza entre {dateLabel(window.start)} e {dateLabel(window.next.checkin)}.</p></> : <p className="text-xs text-muted-foreground">Não há outra entrada nas reservas importadas.</p>}</section>}
    <dl className="grid grid-cols-2 gap-3 border-b border-border pb-4 text-sm"><div><dt className="text-xs text-muted-foreground">Quem fez / equipe</dt><dd className="mt-1 font-medium">{task.responsibleName || "Sem profissional vinculado"}</dd></div><div><dt className="text-xs text-muted-foreground">Quando foi concluída</dt><dd className="mt-1 font-medium">{task.completedAt ? formatBrasiliaDateTime(task.completedAt) : "Ainda não concluída"}</dd></div></dl>
  </div>;
}