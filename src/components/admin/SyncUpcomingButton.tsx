import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { localISODate } from "@/lib/local-date";
import { syncUpcomingReservations } from "@/lib/stayo-central/sync.functions";

/** Puxa do Guia STAYO as reservas do mês atual e dos próximos 2 meses; cada reserva gera sua limpeza uma única vez. */
export function SyncUpcomingButton() {
  const qc = useQueryClient();
  const silent = useRef(false);
  const run = useMutation({
    mutationFn: () => syncUpcomingReservations({ data: { today: localISODate(), months: 3 } }),
    onSuccess: (r) => {
      if (silent.current) { silent.current = false; for (const k of ["op-cleaning", "op-tasks", "op-movements"]) qc.invalidateQueries({ queryKey: [k] }); if (r.imported) toast.success(`${r.imported} reserva(s) nova(s) do Guia.`); return; }
      for (const k of ["op-cleaning", "op-tasks", "op-movements"]) qc.invalidateQueries({ queryKey: [k] });
      const parts = [`${r.imported} nova(s)`, `${r.updated} atualizada(s)`];
      if (r.removed) parts.push(`${r.removed} removida(s) por cancelamento`);
      toast.success(`Reservas de ${r.properties} imóvel(is): ${parts.join(", ")}.`);
      if (r.kept) toast.warning(`${r.kept} reserva(s) com valor ajustado não está(ão) mais no Guia; revise nos repasses.`);
      if (r.failed) toast.error(`${r.failed} imóvel(is) não puderam ser consultados agora.`);
    },
    onError: (e) => { if (silent.current) { silent.current = false; return; } toast.error((e as Error).message); },
  });
  // Busca sozinha ao abrir a tela (no máximo a cada 5 min por navegador); a recorrência de 15 min cobre o resto.
  useEffect(() => {
    const k = "stayo-sync-upcoming-at"; const last = Number(sessionStorage.getItem(k) || 0);
    if (Date.now() - last < 5 * 60_000) return;
    sessionStorage.setItem(k, String(Date.now())); silent.current = true; run.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
    <RefreshCw className={`size-4 ${run.isPending ? "animate-spin" : ""}`} />{run.isPending ? "Buscando reservas…" : "Puxar próximas reservas"}
  </Button>;
}
