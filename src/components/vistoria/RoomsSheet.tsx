import { AlertTriangle, Check, ChevronRight, X } from "lucide-react";
import { useState } from "react";

export type RoomStatus = "nao_iniciado" | "em_andamento" | "concluido" | "pendencia";
export interface RoomSummary { room: string; firstIndex: number; done: number; total: number; status: RoomStatus }
export interface PendingItem { index: number; room: string; name: string; reason: string }

/** Ordem canônica; só entram os ambientes presentes no snapshot ("quando aplicável"). */
const ORDER = ["entrada", "sala", "cozinha", "varanda", "servi", "área externa", "dormit", "quarto", "suíte", "banheiro", "lavabo"];
export function roomRank(room: string): number {
  const r = room.toLowerCase();
  const i = ORDER.findIndex((k) => r.includes(k));
  return i === -1 ? ORDER.length : i;
}

const LABEL: Record<RoomStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  pendencia: "Com pendência",
};

function StatusIcon({ s, done, total }: { s: RoomStatus; done: number; total: number }) {
  if (s === "concluido") return <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-5" /></span>;
  if (s === "pendencia") return <span className="grid size-10 place-items-center rounded-full bg-[oklch(0.95_0.05_60)] text-[oklch(0.6_0.16_55)]"><AlertTriangle className="size-5" /></span>;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span
      className="size-10 rounded-full border-2 border-border"
      style={s === "em_andamento" ? { background: `conic-gradient(oklch(0.75 0.14 70) ${pct}%, transparent 0)`, borderColor: "oklch(0.75 0.14 70)" } : undefined}
    />
  );
}

export function RoomsSheet({
  rooms, pending, onClose, onOpen,
}: { rooms: RoomSummary[]; pending: PendingItem[]; onClose: () => void; onOpen: (index: number) => void }) {
  const [review, setReview] = useState(false);
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[oklch(0_0_0/0.45)]" onClick={onClose}>
      <section
        role="dialog" aria-modal="true" aria-labelledby="rooms-title" onClick={(e) => e.stopPropagation()}
        className="max-h-[86dvh] overflow-y-auto rounded-t-3xl bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-foreground"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <h2 id="rooms-title" className="text-xl font-bold">{review ? "Revisão final" : "Ambientes da vistoria"}</h2>
          <button onClick={review ? () => setReview(false) : onClose} aria-label={review ? "Voltar aos ambientes" : "Fechar ambientes"} className="grid size-10 place-items-center rounded-full">
            <X className="size-6" />
          </button>
        </div>

        {!review ? (
          <ul className="mt-2 divide-y divide-border">
            {rooms.map((r) => (
              <li key={r.room}>
                <button onClick={() => onOpen(r.firstIndex)} className="flex w-full items-center gap-4 py-4 text-left" aria-label={`${r.room}: ${LABEL[r.status]}, ${r.done} de ${r.total} itens`}>
                  <StatusIcon s={r.status} done={r.done} total={r.total} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">{r.room}</span>
                    <span className="block text-sm text-muted-foreground">{r.done}/{r.total} itens · {LABEL[r.status]}</span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => setReview(true)} className="flex w-full items-center gap-4 py-4 text-left">
                <span className={`size-10 rounded-full border-2 ${pending.length ? "border-[oklch(0.75_0.14_70)]" : "border-primary bg-primary"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold">Revisão final</span>
                  <span className="block text-sm text-muted-foreground">{pending.length ? `${pending.length} ${pending.length === 1 ? "item pendente" : "itens pendentes"}` : "Tudo respondido"}</span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            </li>
          </ul>
        ) : (
          <div className="mt-3">
            {pending.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Todos os itens foram respondidos. As respostas guardadas neste aparelho ainda precisam ser enviadas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pending.map((p) => (
                  <li key={p.index}>
                    <button onClick={() => onOpen(p.index)} className="flex w-full items-center gap-3 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.room} · {p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.reason}</span>
                      </span>
                      <ChevronRight className="size-5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pending.length > 0 && (
              <button onClick={onClose} className="mt-4 h-12 w-full text-sm font-medium text-muted-foreground underline-offset-4 hover:underline">
                Pular por enquanto
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
