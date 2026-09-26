export type GuideClassification = "essencial" | "recomendado" | "opcional";
export type GuideAnswer = "nao_informado" | "ja_tenho" | "ja_comprei";
export type GuideReview = "pendente" | "confirmado" | "corrigido" | "rejeitado";

export const classificationLabel: Record<GuideClassification, string> = {
  essencial: "Essencial",
  recomendado: "Recomendado",
  opcional: "Opcional",
};
export const answerLabel: Record<GuideAnswer, string> = {
  nao_informado: "Ainda não comprei",
  ja_tenho: "Já tenho",
  ja_comprei: "Já comprei",
};

export type GuideFilter = "todos" | "confirmar" | "faltando" | "concluidos" | "nao_informados";

export interface GuideRowState {
  recommended: number;
  answer: GuideAnswer | null;
  quantity: number | null;
  review: GuideReview | null;
  confirmedQuantity: number | null;
}

/** Situação de um item do guia do ponto de vista da equipe. */
export function rowStatus(r: GuideRowState): "confirmar" | "concluido" | "faltando" | "nao_informado" {
  if (!r.answer || r.answer === "nao_informado") return "nao_informado";
  if (r.review === "pendente" || r.review === null) return "confirmar";
  if (r.review === "rejeitado") return "nao_informado";
  const qty = r.confirmedQuantity ?? r.quantity ?? 0;
  return qty >= r.recommended ? "concluido" : "faltando";
}

export function matchesFilter(r: GuideRowState, f: GuideFilter): boolean {
  if (f === "todos") return true;
  const s = rowStatus(r);
  return (
    (f === "confirmar" && s === "confirmar") ||
    (f === "faltando" && s === "faltando") ||
    (f === "concluidos" && s === "concluido") ||
    (f === "nao_informados" && s === "nao_informado")
  );
}

export function summarizeGuide(rows: GuideRowState[]) {
  const s = { total: rows.length, confirmadas: 0, aConfirmar: 0, pendentes: 0 };
  for (const r of rows) {
    const st = rowStatus(r);
    if (st === "confirmar") s.aConfirmar++;
    else if (st === "concluido" || st === "faltando") s.confirmadas++;
    else s.pendentes++;
  }
  return s;
}

export function isValidPurchaseUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function validateImage(file: { type: string; size: number; name: string }): string | null {
  if (!IMAGE_TYPES.includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name))
    return "Use uma imagem JPG, PNG ou WebP.";
  if (file.size > IMAGE_MAX_BYTES) return "A imagem deve ter até 5 MB.";
  return null;
}
