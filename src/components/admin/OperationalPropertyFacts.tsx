import { BedDouble, CarFront } from "lucide-react";
import type { CalendarStay } from "@/lib/op-calendar";

export function OperationalPropertyFacts({ box, spots, stays }: { box: string | null; spots: number | null; stays: CalendarStay[] }) {
  return <div className="space-y-1.5 text-xs text-muted-foreground">
    <p className="flex items-start gap-1.5"><CarFront className="size-3.5 shrink-0" /><span className="break-words">{box?.trim() ? `Vaga / box: ${box}` : spots === 0 ? "Sem vaga" : "Vaga não informada"}{spots !== null && spots > 0 ? ` · ${spots} ${spots === 1 ? "vaga" : "vagas"}` : ""}</span></p>
    <p className="flex items-start gap-1.5"><BedDouble className="size-3.5 shrink-0" /><span className="break-words">{stays.length ? stays.map(s => s.guest).join(" · ") : "Sem hospedagem prevista no dia"}</span></p>
  </div>;
}