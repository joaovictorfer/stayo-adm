import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarStay } from "@/lib/op-calendar";

export const operationalCalendarQuery = () => queryOptions({
  queryKey: ["op-movements", "calendar"],
  queryFn: async (): Promise<{ stays: CalendarStay[]; tasks: { id: string; propertyId: string | null; reservationId: string | null; date: string; status: string; staff: string[] }[] }> => {
    const [reservations, tasks] = await Promise.all([
      supabase.from("payout_reservations").select("id,implementation_id,guest_name,checkin_date,checkout_date,channel").order("checkin_date"),
      supabase.from("op_tasks").select("id,implementation_id,payout_reservation_id,due_date,status,op_task_team(op_staff(name))").eq("kind", "limpeza"),
    ]);
    if (reservations.error) throw reservations.error;
    if (tasks.error) throw tasks.error;
    return {
      stays: (reservations.data ?? []).flatMap((r) => r.checkin_date && r.checkout_date ? [{ id: r.id, implementationId: r.implementation_id, guest: r.guest_name ?? "Hóspede", checkin: r.checkin_date, checkout: r.checkout_date, channel: r.channel }] : []),
      tasks: (tasks.data ?? []).map((t) => ({ id: t.id, propertyId: t.implementation_id, reservationId: t.payout_reservation_id, date: t.due_date, status: t.status, staff: (t.op_task_team ?? []).flatMap((m) => m.op_staff?.name ? [m.op_staff.name] : []) })),
    };
  },
});

export async function scheduleCleaning(taskId: string, date: string) {
  const { error } = await supabase.rpc("admin_schedule_cleaning", { p_task_id: taskId, p_date: date });
  if (error) throw new Error(error.message);
}