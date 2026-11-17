/** Datas de calendário da operação sempre no fuso de Gramado (America/Sao_Paulo), nunca em UTC. */
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD de um instante no fuso de Gramado. */
export function localISODate(at: Date = new Date()): string {
  return fmt.format(at);
}

/** Soma dias a uma data YYYY-MM-DD sem passar por fuso. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** "terça-feira, 17 de novembro" para uma data YYYY-MM-DD. */
export function longDayLabel(iso: string): string {
  const t = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
}
