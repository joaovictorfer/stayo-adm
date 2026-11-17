import { describe, expect, it } from "vitest";
import { blockedSectionFor, canSeeNav, navigation } from "./navigation";

const find = (id: string) => navigation.flatMap((i) => [i, ...(i.children ?? [])]).find((i) => i.id === id)!;

describe("acesso por perfil", () => {
  it("comercial e consulta não abrem a operação", () => {
    expect(blockedSectionFor("/operacao/agenda", "commercial")?.id).toBe("operations-agenda");
    expect(blockedSectionFor("/operacao/equipe", "viewer")?.id).toBe("operations-team");
  });
  it("financeiro abre Custos, mas não Agenda", () => {
    expect(blockedSectionFor("/operacao/custos", "finance")).toBeNull();
    expect(blockedSectionFor("/operacao/agenda", "finance")).not.toBeNull();
  });
  it("operação abre agenda, equipe e custos", () => {
    for (const p of ["/operacao/agenda", "/operacao/equipe", "/operacao/custos"]) expect(blockedSectionFor(p, "operations")).toBeNull();
  });
  it("Meu Dia não é bloqueado pelo menu", () => {
    expect(blockedSectionFor("/meu-dia/x", "viewer")).toBeNull();
  });
  it("financeiro vê o grupo Operação só para chegar em Custos", () => {
    expect(canSeeNav(find("operations"), "finance")).toBe(true);
    expect(canSeeNav(find("operations-agenda"), "finance")).toBe(false);
  });
  it("menu esconde Custos para comercial", () => {
    expect(canSeeNav(find("operations-costs"), "commercial")).toBe(false);
  });
});
