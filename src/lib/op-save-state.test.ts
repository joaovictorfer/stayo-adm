import { describe, expect, it } from "vitest";
import { pendingSaveScopes, teamDraftKey } from "./op-save-state";

describe("salvamentos independentes de rotina e equipe", () => {
  it("salvar a rotina não elimina alterações pendentes da equipe", () => {
    expect(pendingSaveScopes(false, true)).toEqual(["equipe"]);
  });
  it("salvar a equipe não elimina alterações pendentes da rotina", () => {
    expect(pendingSaveScopes(true, false)).toEqual(["rotina"]);
  });
  it("somente ambos salvos permitem fechar sem descarte", () => {
    expect(pendingSaveScopes(true, true)).toEqual(["rotina", "equipe"]);
    expect(pendingSaveScopes(false, false)).toEqual([]);
  });
  it("detecta remoção, percentual e líder, mas não mudança de ordem", () => {
    const a = { staff_id: "a", share: 50, is_lead: true };
    const b = { staff_id: "b", share: 50, is_lead: false };
    expect(teamDraftKey([a, b])).toBe(teamDraftKey([b, a]));
    expect(teamDraftKey([a])).not.toBe(teamDraftKey([a, b]));
    expect(teamDraftKey([{ ...a, share: 60 }, b])).not.toBe(teamDraftKey([a, b]));
    expect(teamDraftKey([{ ...a, is_lead: false }, b])).not.toBe(teamDraftKey([a, b]));
  });
});