import { z } from "zod";
export const chargeItemSchema = z.object({ id: z.string().min(1).max(80), description: z.string().trim().min(1).max(250), quantity: z.number().int().min(1).max(999), unitCents: z.number().int().min(1).max(100000000) }).strict();
export const chargeDraftSchema = z.object({
  id: z.string().uuid(), revision: z.number().int().min(0), title: z.string().trim().min(1).max(160), recipient: z.string().trim().min(1).max(160),
  email: z.union([z.literal(""), z.string().email().max(254)]), ownerId: z.string().uuid().nullable(), implementationId: z.string().uuid().nullable(),
  due: z.string().date(), competence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), notes: z.string().max(1000), internalNotes: z.string().max(1000), items: z.array(chargeItemSchema).min(1).max(50),
}).strict().refine(d => d.items.reduce((sum, i) => sum + i.quantity * i.unitCents, 0) <= 100000000, "Subtotal máximo de R$ 1.000.000.");
export type ChargeDraftInput = z.infer<typeof chargeDraftSchema>;
export const chargeActionSchema = z.object({ id: z.string().uuid(), revision: z.number().int().min(1), action: z.enum(["publish", "cancel", "revoke", "renew", "link"]), implementationId: z.string().uuid().nullable().optional() }).strict();
export type ChargeActionInput = z.infer<typeof chargeActionSchema>;