import type { CalendarStay } from "./op-calendar";

export type StayDayTab = "chegadas" | "saidas" | "em_casa";

/** Day-level planning, not confirmation that a guest physically arrived or left. */
export function staysForDay(stays: CalendarStay[], date: string, tab: StayDayTab): CalendarStay[] {
  return stays.filter((stay) => tab === "chegadas" ? stay.checkin === date
    : tab === "saidas" ? stay.checkout === date
    : stay.checkin <= date && stay.checkout >= date);
}