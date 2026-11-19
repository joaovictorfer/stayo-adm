import { addDaysISO } from "./local-date";

export type CalendarStay = { id: string; implementationId: string; guest: string; checkin: string; checkout: string };
export type CleaningWindow = { start: string; end: string | null; kind: "out_in" | "flexivel" | "sem_entrada"; next: CalendarStay | null };

export function cleaningWindow(stay: CalendarStay, stays: CalendarStay[]): CleaningWindow {
  const next = stays.filter((s) => s.id !== stay.id && s.implementationId === stay.implementationId && s.checkin >= stay.checkout)
    .sort((a, b) => a.checkin.localeCompare(b.checkin))[0] ?? null;
  return { start: stay.checkout, end: next?.checkin ?? null, next,
    kind: !next ? "sem_entrada" : next.checkin === stay.checkout ? "out_in" : "flexivel" };
}

export function validCleaningDate(window: CleaningWindow, date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= window.start && (!window.end || date <= window.end);
}

export function suggestedCleaningDate(window: CleaningWindow, today: string): string {
  const before = window.end && window.end > window.start ? addDaysISO(window.end, -1) : window.start;
  return before < today && (!window.end || today <= window.end) ? today : before;
}