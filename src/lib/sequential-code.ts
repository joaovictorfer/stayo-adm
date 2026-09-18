/** Código sequencial humano (ex: IMP-00001, COB-00001) — gerado sempre no adapter, nunca no componente. */
export function nextSequentialCode(prefix: string, existingCodes: string[]): string {
  const numbers = existingCodes
    .map((c) => Number.parseInt(c.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

/**
 * `nextSequentialCode` calcula o próximo número em memória — sozinho,
 * NUNCA é concorrência-segura (duas chamadas simultâneas podem calcular o
 * mesmo "próximo" número). Quem garante que duas criações simultâneas
 * nunca colidem de verdade é sempre a constraint `unique` do banco; estes
 * dois helpers só classificam o erro que ela retorna, para o adapter
 * decidir entre "tentar de novo com um número novo" (colisão em `code`) e
 * "essa criação já aconteceu, devolve o registro existente" (colisão numa
 * coluna de identidade de negócio, ex: `proposal_id`).
 */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

export function constraintTargetsColumn(
  error: { message?: string } | null | undefined,
  column: string,
): boolean {
  return Boolean(error?.message?.includes(column));
}
