import { describe, expect, it } from "vitest";
import { cleaningStatus } from "./op-cleaning";

const res = [{ checkin: "2026-11-10", checkout: "2026-11-15" }];
describe("cleaningStatus", () => {
  it("fica sujo depois da saída sem limpeza", () => expect(cleaningStatus(res, [], "2026-11-16").state).toBe("sujo"));
  it("limpeza no dia da saída ou depois deixa pronto", () => expect(cleaningStatus(res, [{ dueDate: "2026-11-15", status: "concluida" }], "2026-11-16").state).toBe("pronto"));
  it("sem nova reserva continua pronto", () => expect(cleaningStatus(res, [{ dueDate: "2026-11-16", status: "concluida" }], "2026-11-30").state).toBe("pronto"));
  it("nova reserva que sai exige limpar de novo", () => {
    const two = [...res, { checkin: "2026-11-20", checkout: "2026-11-22" }];
    expect(cleaningStatus(two, [{ dueDate: "2026-11-16", status: "concluida" }], "2026-11-23").state).toBe("sujo");
  });
  it("hóspede hospedado aparece como ocupado", () => expect(cleaningStatus(res, [], "2026-11-12").state).toBe("ocupado"));
  it("marcar sujo cria limpeza pendente que vale até ser concluída", () =>
    expect(cleaningStatus([], [{ dueDate: "2026-11-01", status: "concluida" }, { dueDate: "2026-11-17", status: "pendente" }], "2026-11-17").state).toBe("sujo"));
  it("limpeza pendente futura não suja hoje", () =>
    expect(cleaningStatus(res, [{ dueDate: "2026-11-15", status: "concluida" }, { dueDate: "2026-11-22", status: "pendente" }], "2026-11-17").state).toBe("pronto"));
});
