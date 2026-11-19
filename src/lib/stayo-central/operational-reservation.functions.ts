import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CENTRAL_BASE_URL } from "./contracts";

export const readOperationalReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).strict().parse(input))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const role = await context.supabase.rpc("has_admin_role", { roles: ["super_admin", "admin", "operations", "finance"] });
    if (role.error || role.data !== true) throw new Error("Acesso restrito à equipe autorizada.");
    const local = await context.supabase.from("payout_reservations").select("central_reservation_id,implementation_id").eq("id", data.id).single();
    if (local.error || !local.data) throw new Error("Reserva indisponível.");
    if (!local.data.central_reservation_id) return null;
    const project = await context.supabase.from("implementation_projects").select("core_property_id").eq("id", local.data.implementation_id).single();
    if (project.error || !project.data?.core_property_id) throw new Error("Vínculo do imóvel indisponível.");
    const { createCentralHttp } = await import("./http.server");
    const { adminReservationSchema, providerEnvelope } = await import("./provider-contracts");
    const http = createCentralHttp({ token: process.env["STAYO_API_TOKEN"] || "", baseUrl: process.env["STAYO_API_URL"] || CENTRAL_BASE_URL });
    const result = await http.get(`/admin/reservations/${local.data.central_reservation_id}`, providerEnvelope(adminReservationSchema));
    if (!result.ok) throw new Error("Não foi possível consultar os detalhes no Guia STAYO agora.");
    const r = result.data.data;
    if (r.id !== local.data.central_reservation_id || r.property_id !== project.data.core_property_id) throw new Error("Os dados da reserva não correspondem ao imóvel vinculado.");
    return { code: r.reservation_code, adults: r.adults, children: r.children, infants: r.infants, webCheckin: r.web_checkin_status, status: r.status, nights: r.nights };
  });