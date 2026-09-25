const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Sempre "R$ 0,00", "R$ 200,00", "R$ 1.000,00" (espaço normal, não NBSP). */
export function formatBRL(value: number | null | undefined): string {
  const safe = Number.isFinite(value) ? (value as number) : 0;
  return brl.format(roundCents(safe)).replace(/\u00a0/g, " ");
}

/** Arredonda para centavos exatos, evitando 0.1 + 0.2. */
export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
