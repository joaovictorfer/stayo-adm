import { z } from "zod";
import { normalizePhone } from "./owner-form-validation";
import { reconcileRooms, type RoomState } from "./amenities";

export const bedTypes = ["Solteiro", "Auxiliar", "Casal", "Queen", "King"] as const;
export const bedOptionsSchema = z
  .object(Object.fromEntries(bedTypes.map((k) => [k, z.number().int().min(0).max(20).optional()])))
  .strict();
export const fieldPatchSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome completo").max(200).optional(),
    phone: z
      .string()
      .transform(normalizePhone)
      .refine((v) => /^55\d{10,11}$/.test(v), "Informe um telefone válido")
      .optional(),
    condominium: z.string().trim().max(200).optional(),
    unit: z.string().trim().max(200).optional(),
    box: z.string().max(200).optional(),
    wifiNetwork: z.string().max(200).optional(),
    wifiPassword: z.string().max(200).optional(),
    bedrooms: z.number().int().min(0).max(20).nullable().optional(),
    bathrooms: z.number().int().min(0).max(20).nullable().optional(),
    lavatories: z.number().int().min(0).max(20).nullable().optional(),
    beds: z
      .array(z.object({ roomId: z.string().min(1).max(80), options: bedOptionsSchema }))
      .max(20)
      .optional(),
  })
  .strict();
export type FieldPatch = z.input<typeof fieldPatchSchema>;
export type FieldValues = {
  name: string;
  phone: string;
  condominium: string;
  unit: string;
  box: string;
  wifiNetwork: string;
  wifiPassword: string;
  bedrooms: number | null;
  bathrooms: number | null;
  lavatories: number | null;
  rooms: RoomState[];
};
export type FieldRegistration = {
  implementationId: string | null;
  revision: number;
  step: number;
  contactLocked: boolean;
  condominiumLocked: boolean;
  values: FieldValues;
};
export const contactReady = (name: string, phone: string) =>
  fieldPatchSchema.pick({ name: true, phone: true }).safeParse({ name, phone }).success;
export function registrationRooms(
  rooms: RoomState[],
  bedrooms: number,
  bathrooms: number,
  lavatories: number,
) {
  const populatedBedrooms = rooms.filter((r) => r.kind === "quarto" && Object.values(r.items).some((item) => item.on));
  if (populatedBedrooms.length > bedrooms)
    throw new Error("Remova as camas e os itens dos quartos excedentes antes de reduzir a quantidade.");
  const base: RoomState[] = rooms.length
    ? rooms
    : ["cozinha", "sala", "geral"].map((kind, i) => ({
        id: `field-${kind}`,
        kind: kind as RoomState["kind"],
        name: ["Cozinha", "Sala", "Geral do imóvel"][i] ?? kind,
        items: {},
        custom: [],
      }));
  return reconcileRooms(base, { bedrooms, bathrooms, lavatories });
}
export function applyRoomBeds(rooms: RoomState[], beds: NonNullable<FieldPatch["beds"]>) {
  return rooms.map((room) => {
    const edit = beds.find((b) => b.roomId === room.id);
    if (!edit) return room;
    if (room.kind !== "quarto") throw new Error("As camas devem pertencer a um quarto.");
    const opts = bedOptionsSchema.parse(edit.options) as Record<string, number>;
    return {
      ...room,
      items: {
        ...room.items,
        camas: { ...room.items["camas"], on: Object.values(opts).some((n) => n > 0), opts },
      },
    };
  });
}
