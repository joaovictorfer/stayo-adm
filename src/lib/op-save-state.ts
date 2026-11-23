export interface TeamDraftMember { staff_id: string; share: number; is_lead: boolean }

/** Order is presentation-only; saved membership, shares and leader define the draft. */
export function teamDraftKey(team: TeamDraftMember[]): string {
  return JSON.stringify(team.map(({ staff_id, share, is_lead }) => ({ staff_id, share, is_lead })).sort((a, b) => a.staff_id.localeCompare(b.staff_id)));
}

export function pendingSaveScopes(routine: boolean, team: boolean): string[] {
  return [routine ? "rotina" : "", team ? "equipe" : ""].filter(Boolean);
}