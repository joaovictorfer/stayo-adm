/** Datas de calendário da operação sempre no fuso de Gramado (America/Sao_Paulo), nunca em UTC. */
export const OPERATION_TIME_ZONE = "America/Sao_Paulo";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: OPERATION_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

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

/** Calendar days are not instants: never shift a reservation/planning day by timezone. */
export function parseCalendarDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined || year < 1000) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.toISOString().slice(0, 10) === iso ? date : null;
}

export function formatCalendarDate(iso: string | null, fallback = "Não informado"): string {
  if (!iso || !parseCalendarDate(iso)) return fallback;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function brazilianDateToISO(text: string): string | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return null;
  const iso = `${text.slice(6)}-${text.slice(3, 5)}-${text.slice(0, 2)}`;
  return parseCalendarDate(iso) ? iso : null;
}

/** Persisted instants must include an offset, so the browser cannot reinterpret them. */
function instant(value: string | null): Date | null {
  if (!value || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatBrasiliaDateTime(value: string | null, fallback = "Não informado"): string {
  const date = instant(value);
  if (!date) return fallback;
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: OPERATION_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: OPERATION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${day} às ${time}`;
}

export function formatBrasiliaDate(value: string | null, fallback = "Não informado"): string {
  const date = instant(value);
  return date ? formatCalendarDate(localISODate(date), fallback) : fallback;
}

export function validTime24(text: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}
