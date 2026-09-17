/** Código sequencial humano (ex: IMP-00001, COB-00001) — gerado sempre no adapter, nunca no componente. */
export function nextSequentialCode(prefix: string, existingCodes: string[]): string {
  const numbers = existingCodes
    .map((c) => Number.parseInt(c.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}
