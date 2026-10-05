import { describe, expect, it } from "vitest";
import { computeRegistrationProgress } from "./owner-registration-progress";

const full = {
  owner: { done: 16, total: 16 },
  property: { done: 7, total: 7 },
  platformsDone: true,
  prepAnswers: ["tenho", "nao_tenho", "nao_aplica"],
};

describe("computeRegistrationProgress", () => {
  it("cadastro bastante incompleto", () => {
    const r = computeRegistrationProgress({
      owner: { done: 4, total: 16 },
      property: { done: 0, total: 7 },
      platformsDone: false,
      prepAnswers: [null, null, null],
    });
    expect(r.percent).toBe(14);
    expect(r.pending.map((p) => p.key)).toEqual(["owner", "property", "platforms", "prep"]);
  });
  it("parcial e apagar dado obrigatório reduz", () => {
    const partial = computeRegistrationProgress({ ...full, property: { done: 3, total: 7 }, platformsDone: false });
    const after = computeRegistrationProgress({ ...full, owner: { done: 15, total: 16 }, property: { done: 3, total: 7 }, platformsDone: false });
    expect(after.percent).toBeLessThan(partial.percent);
    expect(after.pending[0]?.key).toBe("owner");
  });
  it("preparação parcial nunca é 100%", () => {
    const r = computeRegistrationProgress({ ...full, prepAnswers: ["tenho", null, null] });
    expect(r.percent).toBeLessThan(100);
    expect(r.pending.map((p) => p.key)).toEqual(["prep"]);
  });
  it("itens não carregados contam como pendência", () => {
    expect(computeRegistrationProgress({ ...full, prepAnswers: null }).percent).toBeLessThan(100);
  });
  it("quase completo não arredonda para 100", () => {
    const r = computeRegistrationProgress({ ...full, prepAnswers: [...Array(199).fill("tenho"), null] });
    expect(r.percent).toBe(99);
  });
  it("completo = 100 (N/A conta como resposta)", () => {
    expect(computeRegistrationProgress(full)).toEqual({ percent: 100, pending: [] });
  });
});
