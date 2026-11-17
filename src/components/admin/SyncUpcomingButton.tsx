import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { localISODate } from "@/lib/local-date";
import { syncUpcomingReservations } from "@/lib/stayo-central/sync.functions";

/** Puxa do Guia STAYO as reservas do mês atual e dos próximos 2 meses; cada reserva gera sua limpeza uma única vez. */
export function SyncUpcomingButton() {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: () => syncUpcomingReservations({ data: { today: localISODate(), months: 3 } }),
    onSuccess: (r) => {
      for (const k of ["op-cleaning", "op-tasks", "op-movements"]) qc.invalidateQueries({ queryKey: [k] });
      const parts = [`${r.imported} nova(s)`, `${r.updated} atualizada(s)`];
      if (r.removed) parts.push(`${r.removed} removida(s) por cancelamento`);
      toast.success(`Reservas de ${r.properties} imóvel(is): ${parts.join(", ")}.`);
      if (r.kept) toast.warning(`${r.kept} reserva(s) com valor ajustado não está(ão) mais no Guia; revise nos repasses.`);
      if (r.failed) toast.error(`${r.failed} imóvel(is) não puderam ser consultados agora.`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
    <RefreshCw className={`size-4 ${run.isPending ? "animate-spin" : ""}`} />{run.isPending ? "Buscando reservas…" : "Puxar próximas reservas"}
  </Button>;
}
