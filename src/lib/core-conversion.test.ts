import { describe, expect, it, vi } from "vitest";

// Testes de lógica pura — nunca devem depender de rede real. Antes da Fase
// 19 (Lovable Cloud habilitado), `adminApi.audit.log` sempre caía no adapter
// local (sem Supabase configurado neste ambiente); agora que a credencial
// real existe, o singleton de `./api/queries` passaria a tentar uma escrita
// de verdade em `audit_logs` — mockado aqui para manter o teste hermético.
vi.mock("./api/queries", () => ({
  adminApi: { audit: { log: vi.fn().mockResolvedValue(undefined) } },
  coreApi: {
    owners: { search: vi.fn().mockResolvedValue([]) },
    properties: { list: vi.fn().mockResolvedValue({ data: [] }) },
  },
}));

import { CoreConversionNotAvailableError, coreConversionService } from "./core-conversion";
import type { ImplementationProject } from "../types/core";

const baseImplementation: ImplementationProject = {
  id: "impl-1",
  code: "IMP-00001",
  status: "prospect",
  ownerId: "owner-1",
  ownerName: "Dono Teste",
  ownerPhone: "11999990000",
  coverImage: null,
  nickname: null,
  condominiumName: null,
  unit: null,
  address: null,
  postalCode: null,
  city: null,
  propertyType: null,
  bedrooms: null,
  capacity: null,
  responsibleUserId: null,
  startDateEstimate: null,
  completionDateEstimate: null,
  notes: null,
  origin: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  corePropertyId: null,
  coreOwnerId: null,
};

describe("coreConversionService.convertImplementation", () => {
  it("é idempotente: retorna os IDs já existentes sem lançar nem chamar nada novo", async () => {
    const converted: ImplementationProject = {
      ...baseImplementation,
      corePropertyId: "core-property-1",
      coreOwnerId: "core-owner-1",
    };

    const result = await coreConversionService.convertImplementation(converted);

    expect(result).toEqual({ corePropertyId: "core-property-1", coreOwnerId: "core-owner-1" });
  });

  it("nunca fabrica IDs quando ainda não convertida — lança em vez de inventar", async () => {
    await expect(coreConversionService.convertImplementation(baseImplementation)).rejects.toThrow(
      CoreConversionNotAvailableError,
    );
  });

  it("createOwner/createProperty/linkImplementation são stubs explícitos, nunca inventam dado", async () => {
    await expect(coreConversionService.createOwner(baseImplementation)).rejects.toThrow(
      CoreConversionNotAvailableError,
    );
    await expect(coreConversionService.createProperty(baseImplementation)).rejects.toThrow(
      CoreConversionNotAvailableError,
    );
    await expect(
      coreConversionService.linkImplementation(baseImplementation.id, {
        corePropertyId: "x",
        coreOwnerId: "y",
      }),
    ).rejects.toThrow(CoreConversionNotAvailableError);
  });
});
