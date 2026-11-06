/** Nome completo = pelo menos dois nomes com 2+ letras cada. */
export function isFullName(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter((p) => p.replace(/[^\p{L}]/gu, "").length >= 2);
  return parts.length >= 2;
}
