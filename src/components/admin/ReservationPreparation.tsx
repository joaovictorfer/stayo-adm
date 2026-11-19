import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brush, Check, ClipboardCheck, DoorOpen, PackageCheck, BedDouble } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { preparationQuery } from "@/lib/api/reservation-preparation-api";
import { toggleReservationPreparation } from "@/lib/api/core-client";
import { preparationItems, preparationState, type PreparationItem } from "@/lib/reservation-preparation";
const icons = { limpeza: Brush, kit: PackageCheck, enxoval: BedDouble, vistoria: ClipboardCheck, condominio: DoorOpen };
export function ReservationPreparation({ reservationId }: { reservationId: string }) {
  const qc = useQueryClient();
  const data = useQuery(preparationQuery());
  const state = preparationState(data.data ?? [], reservationId);
  const save = useMutation({
    mutationFn: (item: PreparationItem) => toggleReservationPreparation(reservationId, item, !state.checked.has(item), state.checked.has(item)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservation-preparation"] }),
    onError: (e) => { toast.error((e as Error).message); void qc.invalidateQueries({ queryKey: ["reservation-preparation"] }); },
  });
  if (data.isError) return <p role="alert" className="text-sm text-destructive">Preparação indisponível.<Button variant="link" onClick={() => void data.refetch()}>Tentar novamente</Button></p>;
  return <section className="space-y-3" aria-label="Preparação da reserva">
    <div className="flex items-center justify-between gap-2 text-sm"><h3 className="font-semibold">Checklist de check-in</h3><span className="text-muted-foreground">{data.isPending ? "…" : `${state.count}/5`}</span></div>
    <div role="progressbar" aria-label="Preparação concluída" aria-valuemin={0} aria-valuemax={5} aria-valuenow={state.count} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-[var(--admin-success)] transition-all motion-reduce:transition-none" style={{ width: `${state.count * 20}%` }} /></div>
    <div className="grid grid-cols-5 gap-1.5">{preparationItems.map((i) => {
      const checked = state.checked.has(i.key); const Icon = checked ? Check : icons[i.key];
      return <Button key={i.key} variant="outline" aria-label={i.label} aria-pressed={checked} disabled={save.isPending || data.isPending} onClick={() => save.mutate(i.key)} className={`h-auto min-h-16 flex-col gap-2 px-1 py-3 text-[10px] sm:text-xs ${checked ? "border-[var(--admin-success)] bg-[var(--admin-success-soft)] text-[var(--admin-success)]" : "text-muted-foreground"}`}><Icon className="size-4 shrink-0" /><span>{i.label}</span></Button>;
    })}</div>
    <p role="status" className={`text-xs ${state.ready ? "text-[var(--admin-success)]" : "text-muted-foreground"}`}>{save.isPending ? "Salvando…" : state.ready ? "Preparação concluída · 5/5" : "Preparação pendente"}</p>
  </section>;
}