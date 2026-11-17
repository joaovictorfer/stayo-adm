import { queryOptions } from "@tanstack/react-query";

import { supabase } from "../../integrations/supabase/client";
import { buildMovements } from "../op-movements";
import { propertyLabel } from "../property-label";

/** Entradas/saídas de hóspedes a partir das reservas já importadas no Admin (somente leitura; sem CPF). */
export const opMovementsQuery = (from: string, to: string) => queryOptions({
  queryKey: ["op-movements", from, to],
  queryFn: async () => {
    // Busca uma margem de 1 dia para detectar viradas na borda do período.
    const { data, error } = await supabase.from("payout_reservations")
      .select("id, implementation_id, guest_name, checkin_date, checkout_date, channel, implementation_projects(code, nickname, condominium_name, unit)")
      .lte("checkin_date", to.length ? nextDay(to) : to).gte("checkout_date", from);
    if (error) throw error;
    const rows = (data ?? []).filter((r) => r.checkin_date && r.checkout_date).map((r) => {
      const p = (Array.isArray(r.implementation_projects) ? r.implementation_projects[0] : r.implementation_projects) as Parameters<typeof propertyLabel>[0] | null;
      return { id: r.id, implementationId: r.implementation_id, property: p ? propertyLabel(p) : "Imóvel", guest: r.guest_name, checkin: r.checkin_date!, checkout: r.checkout_date!, channel: r.channel };
    });
    return buildMovements(rows, from, to);
  },
});

const nextDay = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10); };
