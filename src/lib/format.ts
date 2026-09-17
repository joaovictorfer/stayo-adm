export function formatMoney(value: number | null | undefined, currency: string | null = "BRL") {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency ?? "BRL",
  }).format(value);
}
