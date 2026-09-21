import { describe, expect, it, vi } from "vitest";

vi.mock("./api/implementation-covers", () => ({
  isImplementationCoverStoragePath: (value: string) => value.startsWith("implementation-covers/"),
  getImplementationCoverSignedUrl: vi.fn(async (value: string) => `signed:${value}`),
}));

import { resolveImplementationCover, selectFallbackAttachment } from "./implementation-cover";
import type { Attachment } from "./api/attachments";
import type { ImplementationProject } from "../types/core";

const implementation = {
  id: "impl-1", code: "IMP-00001", status: "prospect", ownerId: null,
  ownerName: null, ownerPhone: null, coverImage: null, nickname: null,
  condominiumName: null, unit: null, address: null, postalCode: null, city: null,
  propertyType: null, bedrooms: null, capacity: null, responsibleUserId: null,
  startDateEstimate: null, completionDateEstimate: null, notes: null, origin: null,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  corePropertyId: null, coreOwnerId: null,
} satisfies ImplementationProject;
const image = (overrides: Partial<Attachment>): Attachment => ({
  id: "a1", ownerId: "o1", implementationId: "impl-1", ownerTaskId: null,
  storagePath: "o1/photo.jpg", category: "foto", mimeType: "image/jpeg", sizeBytes: 10,
  filename: "photo.jpg", uploadedBy: null, createdAt: "2026-01-01T00:00:00Z", ...overrides,
});

describe("resolveImplementationCover", () => {
  it("prioriza a capa própria", async () => {
    const result = await resolveImplementationCover({
      implementation: { ...implementation, coverImage: "https://example.com/cover.jpg" },
      condominiumImage: "condo.jpg",
      attachments: [image({})],
    });
    expect(result).toEqual({ url: "https://example.com/cover.jpg", source: "implementation" });
  });

  it("usa condomínio antes de documentos", async () => {
    const result = await resolveImplementationCover({
      implementation,
      condominiumImage: "condo.jpg",
      attachments: [image({})],
      attachmentUrl: async () => "attachment.jpg",
    });
    expect(result).toEqual({ url: "condo.jpg", source: "condominium" });
  });

  it("ignora anexos não visuais e prefere capa/condomínio", () => {
    const selected = selectFallbackAttachment("impl-1", [
      image({ id: "pdf", mimeType: "application/pdf" }),
      image({ id: "photo", category: "vistoria" }),
      image({ id: "cover", category: "capa do condomínio" }),
    ]);
    expect(selected?.id).toBe("cover");
  });

  it("retorna placeholder quando não há fonte", async () => {
    const result = await resolveImplementationCover({ implementation });
    expect(result.source).toBe("placeholder");
    expect(result.url).toContain("implementation-cover-placeholder");
  });
});