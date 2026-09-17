import { describe, expect, it } from "vitest";

import { computeProgress, computeReadiness, nextImplementationCode } from "./implementation-status";
import type { ImplementationItemStatus } from "../types/core";

function item(status: ImplementationItemStatus, mandatory = false, blocker = false) {
  return { status, mandatory, blocker };
}

describe("computeProgress", () => {
  it("returns 0/0/0 for an empty checklist", () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("ignores itens não_aplicável e pulado no total", () => {
    const items = [item("concluido"), item("pendente"), item("nao_aplicavel"), item("pulado")];
    expect(computeProgress(items)).toEqual({ done: 1, total: 2, percent: 50 });
  });

  it("arredonda a porcentagem", () => {
    const items = [item("concluido"), item("pendente"), item("pendente")];
    expect(computeProgress(items).percent).toBe(33);
  });
});

describe("computeReadiness", () => {
  it("está apta quando não há bloqueador nem obrigatório pendente", () => {
    const items = [item("concluido", true, true), item("pendente")];
    expect(computeReadiness(items)).toEqual({
      ready: true,
      pendingBlockers: 0,
      pendingMandatory: 0,
    });
  });

  it("não fica apta com um único bloqueador pendente, mesmo com o resto concluído", () => {
    const items = [
      item("concluido"),
      item("concluido"),
      item("concluido"),
      item("pendente", false, true),
    ];
    const progress = computeProgress(items);
    const readiness = computeReadiness(items);
    expect(progress.percent).toBe(75);
    expect(readiness.ready).toBe(false);
    expect(readiness.pendingBlockers).toBe(1);
  });

  it("conta obrigatórios pendentes separadamente de bloqueadores", () => {
    const items = [item("pendente", true, false), item("bloqueado", false, true)];
    expect(computeReadiness(items)).toEqual({
      ready: false,
      pendingBlockers: 1,
      pendingMandatory: 1,
    });
  });
});

describe("nextImplementationCode", () => {
  it("começa em IMP-00001 quando não há códigos existentes", () => {
    expect(nextImplementationCode([])).toBe("IMP-00001");
  });

  it("incrementa a partir do maior número existente", () => {
    expect(nextImplementationCode(["IMP-00001", "IMP-00003", "IMP-00002"])).toBe("IMP-00004");
  });

  it("ignora códigos em formato inesperado", () => {
    expect(nextImplementationCode(["IMP-00005", "lixo"])).toBe("IMP-00006");
  });
});
