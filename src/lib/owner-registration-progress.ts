/**
 * Progresso real do cadastro do proprietário (Seus dados, Seu imóvel, Plataformas, Preparação).
 * Cada requisito obrigatório aplicável vale 1 unidade. 100% só quando não há pendência.
 * 100% de cadastro NÃO significa imóvel pronto.
 */
export type RegistrationStageKey = "owner" | "property" | "platforms" | "prep";

export interface RegistrationInput {
  owner: { done: number; total: number };
  property: { done: number; total: number };
  platformsDone: boolean;
  /** null = itens ainda não carregados (conta como 1 pendência, nunca 100%). */
  prepAnswers: Array<string | null> | null;
}

export const REGISTRATION_STAGE_LABEL: Record<RegistrationStageKey, string> = {
  owner: "Seus dados",
  property: "Seu imóvel",
  platforms: "Plataformas",
  prep: "Preparação",
};

export function computeRegistrationProgress(input: RegistrationInput) {
  const prepTotal = input.prepAnswers ? input.prepAnswers.length : 1;
  // Qualquer resposta (inclusive N/A) conta, conforme a regra atual de aplicabilidade.
  const prepDone = input.prepAnswers ? input.prepAnswers.filter(Boolean).length : 0;
  const total = input.owner.total + input.property.total + 1 + prepTotal;
  const done = input.owner.done + input.property.done + (input.platformsDone ? 1 : 0) + prepDone;
  const pending: Array<{ key: RegistrationStageKey; label: string }> = [];
  const push = (key: RegistrationStageKey) => pending.push({ key, label: REGISTRATION_STAGE_LABEL[key] });
  if (input.owner.done < input.owner.total) push("owner");
  if (input.property.done < input.property.total) push("property");
  if (!input.platformsDone) push("platforms");
  if (prepDone < prepTotal) push("prep");
  const percent = pending.length ? Math.min(99, Math.floor((done / total) * 100)) : 100;
  return { percent, pending };
}
