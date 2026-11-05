import { describe, expect, it } from "vitest";
import {
  STAYO_STANDARD, checkAccept, classifyChange, conditionsComplete, initialStandardPatch, requiresReconfirmation,
  resetToStandardPatch, standardExceptions, versionShownOnLink, type ProposalVersionLite, type VersionSnap,
} from "./commercial-standard";

const snap = (cc: Record<string, unknown>, extra: Partial<VersionSnap> = {}): VersionSnap => ({
  total: 500, items: [{ description: "Implantação", total: 500 }], contractConditions: cc, ...extra,
});
const base = { administrationFee: 20, durationMonths: 6, turnoverCleaningFee: 250, payoutRule: "Até o dia 10" };

describe("padrão comercial STAYO", () => {
  it("inicia com 20%, 180 dias, R$ 250 pago pelo hóspede e limpeza de implantação", () => {
    const p = initialStandardPatch({})!;
    expect(p["administration_fee"]).toBe(20);
    expect(p["duration_months"]).toBe(6);
    expect(p["turnover_cleaning_fee"]).toBe(250);
    expect(p["turnover_cleaning_payer"]).toBe("guest");
    expect(p["initial_cleaning_option"]).toBe("stayo_initial");
    expect(p["standard_copy"]).toEqual(STAYO_STANDARD);
  });
  it("não sobrescreve valor já definido e não reaplica em ficha que já tem cópia", () => {
    expect(initialStandardPatch({ administration_fee: 18 })!["administration_fee"]).toBeUndefined();
    expect(initialStandardPatch({ standard_copy: STAYO_STANDARD })).toBeNull();
  });
  it("valor alterado vira exceção do imóvel e volta ao padrão da cópia da ficha", () => {
    const row = { ...STAYO_STANDARD, administration_fee: 18, standard_copy: STAYO_STANDARD };
    expect(standardExceptions(row)).toEqual(["administration_fee"]);
    expect(resetToStandardPatch(row, "administration_fee")).toEqual({ administration_fee: 20 });
    expect(standardExceptions({ ...STAYO_STANDARD, standard_copy: STAYO_STANDARD })).toEqual([]);
  });
  it("condições incompletas não podem ser publicadas", () => {
    expect(conditionsComplete({ ...STAYO_STANDARD })).toBe(true);
    expect(conditionsComplete({ ...STAYO_STANDARD, initial_cleaning_option: "tbd" })).toBe(false);
    expect(conditionsComplete({ ...STAYO_STANDARD, turnover_cleaning_fee: null })).toBe(false);
  });
});

describe("versões e aceite", () => {
  const v = (id: string, version: number, status: ProposalVersionLite["status"], s: VersionSnap | null = snap(base)): ProposalVersionLite => ({ id, version, status, snapshot: s });

  it("antes do aceite o link mostra a última versão, nunca o rascunho", () => {
    expect(versionShownOnLink([v("a", 1, "superseded"), v("b", 2, "published"), v("c", 3, "draft", null)])?.id).toBe("b");
  });
  it("depois do aceite, mudança de valor exige nova confirmação", () => {
    const vs = [v("a", 1, "accepted")];
    expect(requiresReconfirmation(vs, snap({ ...base, administrationFee: 18 }))).toBe(true);
    expect(requiresReconfirmation(vs, snap(base, { total: 600, items: [{ description: "Implantação", total: 600 }] }))).toBe(true);
  });
  it("mudança só de texto de cláusula não exige nova confirmação", () => {
    expect(classifyChange(snap(base), snap({ ...base, payoutRule: "Até o dia 5" }))).toBe("text");
    expect(requiresReconfirmation([v("a", 1, "accepted")], snap({ ...base, payoutRule: "Até o dia 5" }))).toBe(false);
  });
  it("sem nenhuma mudança não gera versão", () => {
    expect(classifyChange(snap(base, { version: 1 }), snap(base, { version: 2 }))).toBe("none");
  });
  it("aceite enviado de versão antiga é recusado com 'condições atualizadas'", () => {
    const vs = [v("a", 1, "superseded"), v("b", 2, "published")];
    expect(checkAccept(vs, "a")).toEqual({ ok: false, message: "condições atualizadas" });
    expect(checkAccept(vs, "b")).toEqual({ ok: true });
  });
  it("versão aceita continua preservada quando nova versão de valor é publicada", () => {
    const vs = [v("a", 1, "accepted"), v("b", 2, "published", snap({ ...base, administrationFee: 18 }))];
    expect(vs.find((x) => x.id === "a")?.status).toBe("accepted");
    expect(versionShownOnLink(vs)?.id).toBe("b");
  });
});
