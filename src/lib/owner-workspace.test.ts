import { describe, expect, it } from "vitest";
import { deriveOwnerWorkspaceStatus, maskPixKey } from "./owner-workspace";
import type { OwnerRecord } from "../types/admin";
import type { ImplementationProject, Property } from "../types/core";

const owner: OwnerRecord = { id: "o", name: "Victor", phone: null, email: null, document: null, lifecycleStatus: "prospect", coreOwnerId: null, createdAt: "", updatedAt: "" };
const property = { id: "p" } as Property;
const implementation = { id: "i", status: "em_implantacao" } as ImplementationProject;

describe("owner workspace", () => {
  it("classifica proprietário com um imóvel como ativo", () => {
    expect(deriveOwnerWorkspaceStatus(owner, [property], [])).toBe("Ativo");
  });
  it("mantém ativo com múltiplos imóveis", () => {
    expect(deriveOwnerWorkspaceStatus(owner, [property, { ...property, id: "p2" }], [implementation])).toBe("Ativo");
  });
  it("identifica proprietário ainda em implantação", () => {
    expect(deriveOwnerWorkspaceStatus(owner, [], [implementation])).toBe("Em implantação");
  });
  it("mascara a chave PIX e preserva apenas quatro caracteres", () => {
    expect(maskPixKey("victor@example.com")).toBe("••••••••••.com");
  });
});