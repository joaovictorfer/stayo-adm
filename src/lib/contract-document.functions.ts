import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateContractDocx } from "./contract-document";
import { contractFieldsSchema } from "./contract-preparation";
import templateMap from "./contract-template-map.json";
import { authorizationLetterSchema, generateAuthorizationLetterDocx } from "./authorization-letter";

export { contractFieldsSchema } from "./contract-preparation";

export const exportStandardContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ implementationId: z.string().uuid(), fields: contractFieldsSchema }).parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data: allowed, error } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "commercial", "operations"] });
    if (error || allowed !== true) throw new Error("Geração de contrato restrita à equipe autorizada.");
    const { data: project, error: projectError } = await context.supabase.from("implementation_projects").select("id,code").eq("id", data.implementationId).maybeSingle();
    if (projectError || !project) throw new Error("Ficha indisponível para geração.");
    const { standardContractBase64 } = await import("./contract-standard-template.server");
    const bytes = Uint8Array.from(atob(standardContractBase64), c => c.charCodeAt(0));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
    if (hash !== templateMap.sha256) throw new Error("Integridade da minuta inválida.");
    const document = generateContractDocx(bytes, data.fields);
    let binary = "";
    for (let i = 0; i < document.length; i += 8192) binary += String.fromCharCode(...document.subarray(i, i + 8192));
    return { base64: btoa(binary), filename: `Contrato-STAYO-${project.code}.docx` };
  });
export const exportAuthorizationLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ implementationId: z.string().uuid(), fields: authorizationLetterSchema }).parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data: allowed, error } = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "commercial", "operations"] });
    if (error || allowed !== true) throw new Error("Geração da carta restrita à equipe autorizada.");
    const { data: project, error: projectError } = await context.supabase.from("implementation_projects").select("id,code").eq("id", data.implementationId).maybeSingle();
    if (projectError || !project) throw new Error("Ficha indisponível para geração.");
    const { originalContractBase64 } = await import("./contract-template.server");
    const bytes = Uint8Array.from(atob(originalContractBase64), c => c.charCodeAt(0));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
    if (hash !== templateMap.letterTemplateSha256) throw new Error("Integridade do modelo inválida.");
    const document = generateAuthorizationLetterDocx(bytes, data.fields);
    let binary = "";
    for (let i = 0; i < document.length; i += 8192) binary += String.fromCharCode(...document.subarray(i, i + 8192));
    return { base64: btoa(binary), filename: `Carta-Portaria-${project.code}.docx` };
  });
