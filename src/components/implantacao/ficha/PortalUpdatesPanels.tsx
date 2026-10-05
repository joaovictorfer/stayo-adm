import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Megaphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { Collapsible } from "./FichaParts";
import { createInspection, createTimelineUpdate, listPortalInspections, listPortalTimeline } from "../../../lib/api/owner-portal-data";

const muted = { color: "var(--stayo-ink-muted)" };
const border = { borderColor: "var(--stayo-border)" };
const input = "rounded-[var(--radius-control)] border px-3 py-2 text-sm";

/** Linha do tempo pública: pertence ao Portal (o que o proprietário vê). */
export function PortalTimelinePanel({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["implementation-timeline", implementationId], queryFn: () => listPortalTimeline(implementationId) });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const publish = useMutation({
    mutationFn: () => createTimelineUpdate({ implementationId, title, description, kind: "update", ownerVisible: true }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      await qc.invalidateQueries({ queryKey: ["implementation-timeline", implementationId] });
      toast.success("Atualização publicada no portal");
    },
  });
  return (
    <Collapsible title="Linha do tempo pública" summary="Atualizações visíveis no Portal do Proprietário">
      <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da atualização" className={input} style={border} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mensagem para o proprietário" className={input} style={border} />
        <Button size="sm" onClick={() => publish.mutate()} disabled={!title.trim() || publish.isPending}><Megaphone /> Publicar</Button>
      </div>
      <div className="mt-4 space-y-2">
        {(q.data ?? []).slice(0, 5).map((event) => (
          <div key={event.id} className="flex items-start justify-between gap-3 border-t pt-3 text-sm" style={border}>
            <div>
              <strong>{event.title}</strong>
              {event.description && <p className="text-xs" style={muted}>{event.description}</p>}
            </div>
            <span className="shrink-0 text-xs" style={muted}>{new Intl.DateTimeFormat("pt-BR").format(new Date(event.date))}</span>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}

/** Vistorias: acompanhadas na Implantação. */
export function InspectionsPanel({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["implementation-inspections", implementationId], queryFn: () => listPortalInspections(implementationId) });
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const schedule = useMutation({
    mutationFn: () =>
      createInspection({ implementationId, type: "implantacao", scheduledFor: date ? new Date(date).toISOString() : null, publicNotes: notes, ownerVisible: true }),
    onSuccess: async () => {
      setDate("");
      setNotes("");
      await qc.invalidateQueries({ queryKey: ["implementation-inspections", implementationId] });
      toast.success("Vistoria adicionada ao portal");
    },
  });
  return (
    <Collapsible title="Vistorias" summary="Agendamento e resumo liberados no portal">
      <div className="grid gap-3 sm:grid-cols-[13rem_1fr_auto]">
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={input} style={border} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Resumo para o proprietário" className={input} style={border} />
        <Button size="sm" onClick={() => schedule.mutate()} disabled={!date || schedule.isPending}><CalendarPlus /> Agendar</Button>
      </div>
      <div className="mt-4 space-y-2">
        {(q.data ?? []).map((i) => (
          <div key={i.id} className="flex items-center justify-between border-t pt-3 text-sm" style={border}>
            <span>{i.publicNotes || "Vistoria do imóvel"}</span>
            <strong>{i.status === "completed" ? "Concluída" : "Agendada"}</strong>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}
