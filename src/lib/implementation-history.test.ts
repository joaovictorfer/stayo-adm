import { describe, expect, it } from "vitest";
import { auditToEntry, mergeHistory } from "./implementation-history";

const row = (event: string, extra: Partial<Parameters<typeof auditToEntry>[0]> = {}) => ({ id: "a1", event, entity_id: "p1", actor_id: "u1", metadata: {}, created_at: "2026-11-05T10:00:00Z", ...extra });

describe("histórico da ficha", () => {
  it("condições salvas mostram a versão e quem fez", () => {
    const e = auditToEntry(row("conditions_published", { metadata: { version: 3, change: "values" } }), { u1: "Victor" });
    expect(e).toMatchObject({ id: "pp-p1", label: "Condições salvas · versão 3", actor: "Victor" });
  });
  it("aceite da auditoria e da proposta viram uma única linha", () => {
    const a = auditToEntry(row("owner_proposal_confirmed", { actor_id: null, metadata: { version: 2 } }), {});
    const fromProposal = { id: "pa-p1", label: "Proposta v2 aceita por Ana", timestamp: "2026-11-05T10:00:05Z" };
    expect(mergeHistory([fromProposal], [a]).filter((x) => x.id === "pa-p1")).toHaveLength(1);
  });
  it("eventos técnicos repetitivos não entram", () => {
    expect(auditToEntry(row("field.registration.saved"), {})).toBeNull();
  });
  it("mesmo texto no mesmo minuto não duplica e a ordem é do mais recente", () => {
    const m = mergeHistory([
      { id: "x", label: "Etapa concluída: Fotos", timestamp: "2026-11-05T10:00:10Z" },
      { id: "y", label: "Etapa concluída: Fotos", timestamp: "2026-11-05T10:00:40Z" },
      { id: "z", label: "Bloqueio resolvido", timestamp: "2026-11-06T09:00:00Z" },
    ]);
    expect(m.map((e) => e.id)).toEqual(["z", "x"]);
  });
  it("vínculo com o STAYO APP aparece", () => {
    expect(auditToEntry(row("core.property_linked"), {})?.label).toBe("Vinculado ao STAYO APP");
  });
});
