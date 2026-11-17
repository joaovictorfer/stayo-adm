/** Regras puras da execução operacional, compartilhadas por Admin e Meu Dia. */
export interface ChecklistLike { checked_at: string | null; requires_photo: boolean; photo_path: string | null }

export function checklistBlockers(items: ChecklistLike[]) {
  return {
    unchecked: items.filter((i) => !i.checked_at).length,
    missingPhotos: items.filter((i) => i.requires_photo && !i.photo_path).length,
  };
}
export const canComplete = (items: ChecklistLike[]) => { const b = checklistBlockers(items); return b.unchecked === 0 && b.missingPhotos === 0; };
export function blockerMessage(items: ChecklistLike[]) {
  const b = checklistBlockers(items);
  const parts = [b.unchecked ? `${b.unchecked} ${b.unchecked === 1 ? "item pendente" : "itens pendentes"}` : "", b.missingPhotos ? `${b.missingPhotos} ${b.missingPhotos === 1 ? "foto obrigatória" : "fotos obrigatórias"}` : ""].filter(Boolean);
  return parts.length ? `Falta: ${parts.join(" e ")}.` : null;
}
/** Percentuais da equipe precisam somar 100 (com tolerância de centavos) e ter um responsável. */
export function validateTeam(team: { share: number; is_lead: boolean }[]): string | null {
  if (team.length === 0) return null;
  const total = team.reduce((s, m) => s + m.share, 0);
  if (Math.abs(total - 100) > 0.01) return "Os percentuais da equipe precisam somar 100%.";
  if (team.filter((m) => m.is_lead).length !== 1) return "Escolha um responsável principal.";
  return null;
}
