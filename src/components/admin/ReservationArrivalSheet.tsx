import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut, UsersRound } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AdminStatusBadge } from "./AdminPrimitives";
import { ReservationPreparation } from "./ReservationPreparation";
import { operationalCalendarQuery } from "@/lib/api/op-calendar-api";
import { readOperationalReservation } from "@/lib/stayo-central/operational-reservation.functions";
import type { Movement } from "@/lib/op-movements";
import type { BoardTask } from "@/lib/api/op-tasks";
const day = (d: string) => `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}`;
const webStatus = (value: string | null | undefined) => ({ not_sent: "Não enviado", pending: "Pendente", completed: "Concluído", submitted: "Enviado", approved: "Aprovado", reviewed: "Revisado", rejected: "Recusado" })[value ?? ""] ?? "Não informado";
export function ReservationArrivalSheet({ movement, onClose, tasks, onRoutine }: { movement: Movement | null; onClose: () => void; tasks: BoardTask[]; onRoutine: (task: BoardTask) => void }) {
  const id = movement?.id.replace(/:(in|out)$/, "") ?? "";
  const calendar = useQuery({ ...operationalCalendarQuery(), enabled: !!movement });
  const detail = useQuery({ queryKey: ["operational-reservation", id], queryFn: () => readOperationalReservation({ data: { id } }), enabled: !!id, staleTime: 60_000, retry: false });
  const stay = calendar.data?.stays.find((s) => s.id === id);
  const previous = calendar.data?.stays.filter((s) => s.implementationId === stay?.implementationId && s.id !== id && stay && s.checkout <= stay.checkin).sort((a,b) => b.checkout.localeCompare(a.checkout))[0];
  const routine = tasks.find((t) => t.source === "admin" && t.kind === "limpeza" && t.reservationId === previous?.id);
  const departureRoutine = tasks.find((t) => t.source === "admin" && t.kind === "limpeza" && t.reservationId === id);
  const selectedRoutine = movement?.type === "checkout" ? departureRoutine : routine;
  return <Sheet open={!!movement} onOpenChange={(v) => { if (!v) onClose(); }}><SheetContent className="flex w-full flex-col gap-0 p-0 sm:w-[600px] sm:max-w-[600px]">
    <SheetHeader className="shrink-0 bg-primary p-5 pr-10 text-left text-primary-foreground [&_h2]:text-primary-foreground"><p className="text-xs font-semibold uppercase">{movement?.type === "checkout" ? "Check-out" : "Check-in"}</p><SheetTitle className="break-words text-xl">{movement?.guest || "Hóspede não informado"}</SheetTitle><p className="text-sm">{movement?.property}</p><div className="flex flex-wrap gap-2 pt-2"><AdminStatusBadge tone="info">{movement?.channel || "Canal não informado"}</AdminStatusBadge>{detail.data?.code && <AdminStatusBadge>{detail.data.code}</AdminStatusBadge>}</div>{stay && <div className="grid grid-cols-2 gap-3 border-t border-primary-foreground/20 pt-3 text-sm"><p><LogIn className="mr-1 inline size-4" />Check-in<br /><strong>{day(stay.checkin)}</strong></p><p><LogOut className="mr-1 inline size-4" />Check-out<br /><strong>{day(stay.checkout)}</strong></p></div>}</SheetHeader>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      <section className="space-y-3"><h3 className="flex items-center gap-2 font-semibold"><UsersRound className="size-4" />Hóspedes e reserva</h3>{detail.isPending ? <p className="text-sm text-muted-foreground">Consultando detalhes…</p> : detail.isError ? <p role="alert" className="text-sm text-destructive">{(detail.error as Error).message}<Button variant="link" onClick={() => void detail.refetch()}>Tentar novamente</Button></p> : <><dl className="grid grid-cols-3 gap-3 text-sm">{[["Adultos", detail.data?.adults],["Crianças", detail.data?.children],["Bebês", detail.data?.infants]].map(([label,value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value ?? "Não informado"}</dd></div>)}</dl><p className="text-xs text-muted-foreground">Web check-in: {webStatus(detail.data?.webCheckin)} · Horário de chegada: não informado</p></>}</section>
      <section className="space-y-3 border-y border-border py-4"><h3 className="font-semibold">Preparação do imóvel</h3><p className="text-sm">{previous ? `Saída anterior · ${previous.guest} · ${day(previous.checkout)}` : "Nenhuma saída anterior encontrada nas reservas importadas."}</p>{selectedRoutine ? <><p className="text-sm">{selectedRoutine.title} · {selectedRoutine.responsibleName || "Sem profissional"}</p><p className="text-xs text-muted-foreground">{selectedRoutine.completedAt ? `Concluída em ${new Date(selectedRoutine.completedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : `Prevista para ${selectedRoutine.dueDate ? day(selectedRoutine.dueDate) : "data não informada"}`}</p></> : <p className="text-xs text-muted-foreground">Não há rotina de limpeza vinculada a este preparo.</p>}</section>
      {id && <ReservationPreparation reservationId={id} />}
    </div><SheetFooter className="shrink-0 border-t border-border p-4"><Button variant="outline" onClick={onClose}>Fechar</Button>{selectedRoutine && <Button onClick={() => onRoutine(selectedRoutine)}>Abrir rotina</Button>}</SheetFooter>
  </SheetContent></Sheet>;
}