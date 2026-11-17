import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { validateOpTask, type OpTaskInput } from "@/lib/api/op-tasks";

const base: OpTaskInput = { title: "Limpeza", kind: "limpeza", implementationId: null, dueDate: "2026-11-17", scheduledTime: "11:00", priority: "media", status: "pendente", amount: 160, responsibleName: null, guidance: null };
describe("validateOpTask", () => {
  it("aceita tarefa completa", () => expect(validateOpTask(base)).toBeNull());
  it("exige título", () => expect(validateOpTask({ ...base, title: "  " })).toBe("Informe o título da tarefa."));
  it("exige data", () => expect(validateOpTask({ ...base, dueDate: "" })).toBe("Informe a data."));
  it("rejeita valor negativo", () => expect(validateOpTask({ ...base, amount: -1 })).toBe("Valor inválido."));
});
