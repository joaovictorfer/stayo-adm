import { describe, expect, it } from "vitest";
import { blockerMessage, canComplete, validateTeam } from "./op-execution-rules";

const item = (checked: boolean, requires_photo = false, photo = false) => ({ checked_at: checked ? "x" : null, requires_photo, photo_path: photo ? "p" : null });
describe("conclusão de tarefa", () => {
  it("bloqueia com item não marcado", () => expect(canComplete([item(false)])).toBe(false));
  it("bloqueia com foto obrigatória faltando", () => expect(canComplete([item(true, true, false)])).toBe(false));
  it("libera com tudo marcado e fotos", () => expect(canComplete([item(true, true, true), item(true)])).toBe(true));
  it("libera sem checklist", () => expect(canComplete([])).toBe(true));
  it("explica o que falta", () => expect(blockerMessage([item(false), item(true, true)])).toBe("Falta: 1 item pendente e 1 foto obrigatória."));
});
describe("equipe da tarefa", () => {
  it("exige soma 100%", () => expect(validateTeam([{ share: 60, is_lead: true }, { share: 30, is_lead: false }])).toBe("Os percentuais da equipe precisam somar 100%."));
  it("exige um responsável", () => expect(validateTeam([{ share: 100, is_lead: false }])).toBe("Escolha um responsável principal."));
  it("aceita equipe válida", () => expect(validateTeam([{ share: 50, is_lead: true }, { share: 50, is_lead: false }])).toBeNull());
});
