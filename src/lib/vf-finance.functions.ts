import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { expensesTransmissionAllowed, operationalExpenseSchema, statementPath, statementQuerySchema, statementResponseSchema } from "./vf-finance-contract";

export const getVfStatements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => statementQuerySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "finance"] });
    if (error || allowed !== true) throw new Error("Acesso financeiro não autorizado.");
    const secret = process.env["STAYO_WEBHOOK_SECRET"];
    if (!secret) return { ok: false as const, status: 503, error: "Credencial financeira não configurada." };
    try {
      const response = await fetch(`https://vf-hub.lovable.app${statementPath(data)}`, {
        headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return { ok: false as const, status: response.status, error: response.status === 401 ? "O VF - Financeiro não reconheceu a credencial compartilhada." : `Consulta indisponível no VF - Financeiro (${response.status}).` };
      const parsed = statementResponseSchema.safeParse(await response.json());
      if (!parsed.success) return { ok: false as const, status: 502, error: "O demonstrativo recebido está fora do formato esperado." };
      return { ok: true as const, statement: parsed.data };
    } catch {
      return { ok: false as const, status: 502, error: "Não foi possível consultar o VF - Financeiro agora." };
    }
  });

export const sendVfOperationalExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ confirmed: z.literal(true), expense: operationalExpenseSchema }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "finance"] });
    if (error || allowed !== true) throw new Error("Acesso financeiro não autorizado.");
    if (!expensesTransmissionAllowed(process.env["VF_FINANCE_EXPENSES_ENABLED"], data.confirmed)) {
      return { ok: false, status: 403, error: "Envio de despesas bloqueado até autorização explícita de ativação." };
    }
    const secret = process.env["STAYO_WEBHOOK_SECRET"];
    if (!secret) return { ok: false, status: 503, error: "Credencial financeira não configurada." };
    try {
      const response = await fetch("https://vf-hub.lovable.app/api/public/stayo-expenses", {
        method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify(data.expense), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return { ok: false, status: response.status, error: `Envio recusado pelo VF - Financeiro (${response.status}).` };
      const result = z.object({ status: z.enum(["created", "updated", "duplicate", "error"]) }).parse(await response.json());
      return { ok: result.status !== "error", status: response.status, result: result.status };
    } catch {
      return { ok: false, status: 502, error: "Não foi possível confirmar o envio. Reutilize a mesma chave ao tentar novamente." };
    }
  });