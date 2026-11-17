import { addDaysISO } from "@/lib/local-date";

export type MovementReservation = { id: string; implementationId: string; property: string; guest: string | null; checkin: string; checkout: string; channel: string | null };
export type Turnover = "mesmo_dia" | "dia_seguinte" | null;
export type Movement = { id: string; date: string; type: "checkin" | "checkout"; implementationId: string; property: string; guest: string | null; channel: string | null; turnover: Turnover };

/**
 * Entradas e saídas de hóspedes no período. Check-out é o evento que suja o imóvel:
 * próxima entrada no mesmo dia = virada crítica; no dia seguinte = janela curta.
 */
export function buildMovements(rows: MovementReservation[], from: string, to: string): Movement[] {
  const checkinsByProperty = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = checkinsByProperty.get(r.implementationId) ?? new Set<string>();
    set.add(r.checkin); checkinsByProperty.set(r.implementationId, set);
  }
  const out: Movement[] = [];
  for (const r of rows) {
    const base = { implementationId: r.implementationId, property: r.property, guest: r.guest, channel: r.channel };
    if (r.checkin >= from && r.checkin <= to) out.push({ ...base, id: `${r.id}:in`, date: r.checkin, type: "checkin", turnover: null });
    if (r.checkout >= from && r.checkout <= to) {
      const next = checkinsByProperty.get(r.implementationId);
      const turnover: Turnover = next?.has(r.checkout) ? "mesmo_dia" : next?.has(addDaysISO(r.checkout, 1)) ? "dia_seguinte" : null;
      out.push({ ...base, id: `${r.id}:out`, date: r.checkout, type: "checkout", turnover });
    }
  }
  // Saídas antes das entradas no mesmo dia (o imóvel precisa ser liberado primeiro).
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? a.property.localeCompare(b.property) : a.type === "checkout" ? -1 : 1));
}
