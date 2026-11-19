import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PreparationItem } from "@/lib/reservation-preparation";
export const preparationQuery = () => queryOptions({
  queryKey: ["reservation-preparation"],
  queryFn: async () => {
    const { data, error } = await supabase.from("op_reservation_preparation").select("reservation_id,item,checked");
    if (error) throw error;
    return data ?? [];
  },
});
export async function toggleReservationPreparation(reservationId: string, item: PreparationItem, checked: boolean, previous: boolean) {
  const { error } = await supabase.rpc("admin_toggle_reservation_preparation", { p_reservation: reservationId, p_item: item, p_checked: checked, p_previous: previous });
  if (error) throw new Error(error.message);
}