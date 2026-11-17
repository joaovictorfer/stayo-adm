/**
 * Situação de limpeza por imóvel. Regra: a saída do hóspede suja o imóvel; uma limpeza concluída
 * na data da saída ou depois deixa o imóvel pronto até a próxima saída. Datas em calendário local (YYYY-MM-DD).
 */
export type CleaningState = "ocupado" | "sujo" | "pronto" | "sem_registro";
export type CleaningReservation = { checkin: string; checkout: string };
export type CleaningTask = { dueDate: string; status: string };
export type CleaningStatus = { state: CleaningState; lastCheckout: string | null; lastCleaning: string | null; nextCheckout: string | null; nextCheckin: string | null };

export function cleaningStatus(reservations: CleaningReservation[], tasks: CleaningTask[], today: string): CleaningStatus {
  const max = (xs: string[]) => xs.reduce<string | null>((a, b) => (a && a > b ? a : b), null);
  const min = (xs: string[]) => xs.reduce<string | null>((a, b) => (a && a < b ? a : b), null);
  const lastCheckout = max(reservations.map((r) => r.checkout).filter((d) => d <= today));
  const lastCleaning = max(tasks.filter((t) => t.status === "concluida" && t.dueDate <= today).map((t) => t.dueDate));
  const nextCheckout = min(reservations.map((r) => r.checkout).filter((d) => d > today));
  const nextCheckin = min(reservations.map((r) => r.checkin).filter((d) => d >= today));
  const occupied = reservations.some((r) => r.checkin <= today && today < r.checkout);
  const requested = tasks.some((t) => t.status !== "concluida" && t.status !== "cancelada" && t.dueDate <= today && (!lastCleaning || t.dueDate > lastCleaning));
  const dirtyByCheckout = !!lastCheckout && (!lastCleaning || lastCleaning < lastCheckout);
  const state: CleaningState = occupied ? "ocupado" : dirtyByCheckout || requested ? "sujo" : lastCleaning || lastCheckout ? "pronto" : "sem_registro";
  return { state, lastCheckout, lastCleaning, nextCheckout, nextCheckin };
}
