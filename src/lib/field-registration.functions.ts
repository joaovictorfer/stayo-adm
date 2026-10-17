import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { hashToken } from '@/lib/api/token-hash';
import { applyRoomBeds, fieldPatchSchema, registrationRooms, type FieldRegistration } from './field-registration';

const tokenSchema = z.string().regex(/^[a-f0-9]{48}$/);
export const createFieldLink = createServerFn({ method: 'POST' })
 .middleware([requireSupabaseAuth])
 .inputValidator((d) => z.object({ implementationId: z.string().uuid().optional() }).parse(d))
 .handler(async ({ data, context }) => {
   const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
   const { error } = await context.supabase.rpc('admin_create_field_link', { p_hash: await hashToken(token), p_implementation_id: data.implementationId });
   if (error) throw new Error('Não foi possível gerar o link. Verifique sua permissão e o estado da ficha.');
   return { token };
 });

export const resolveFieldRegistration = createServerFn({ method: 'POST' })
 .inputValidator(d => z.object({ token: tokenSchema }).parse(d))
 .handler(async ({ data }) => {
   const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
   const { data: result, error } = await supabaseAdmin.rpc('field_registration_resolve', { p_token: data.token });
   if (error || !result) throw new Error('Link inválido, expirado ou cadastro encerrado.');
   return result as unknown as FieldRegistration;
 });

export const saveFieldRegistration = createServerFn({ method: 'POST' })
 .inputValidator(d => z.object({ token: tokenSchema, revision: z.number().int().min(0), step: z.number().int().min(0).max(3), patch: fieldPatchSchema }).parse(d))
 .handler(async ({ data }) => {
   const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
   const { data: resolved, error: denied } = await supabaseAdmin.rpc('field_registration_resolve', { p_token: data.token });
   if (denied || !resolved) throw new Error('Link inválido, expirado ou cadastro encerrado.');
   const current = resolved as unknown as FieldRegistration;
   const { beds, ...patch } = data.patch;
   const roomsChanged = beds !== undefined || patch.bedrooms !== undefined || patch.bathrooms !== undefined || patch.lavatories !== undefined;
   const roomPatch = roomsChanged ? { rooms: applyRoomBeds(registrationRooms(current.values.rooms, patch.bedrooms ?? current.values.bedrooms ?? 0, patch.bathrooms ?? current.values.bathrooms ?? 0, patch.lavatories ?? current.values.lavatories ?? 0), beds ?? []) } : {};
   if (beds?.some(b => !current.values.rooms.some(r => r.id === b.roomId && r.kind === 'quarto'))) throw new Error('Quarto não encontrado. Recarregue o cadastro.');
   const { data: result, error } = await supabaseAdmin.rpc('field_registration_save', { p_token: data.token, p_revision: data.revision, p_step: data.step, p_patch: JSON.parse(JSON.stringify({ ...patch, ...roomPatch })) });
   if (error) {
     if (error.message.includes('outra sessão')) throw new Error('Outra sessão alterou este cadastro. Recarregue para conferir os dados.');
     if (error.message.includes('protegido') || error.message.includes('vinculado')) throw new Error('Esse dado está vinculado a um cadastro existente. Solicite o ajuste à STAYO.');
     throw new Error('Não foi possível salvar. Confira os campos e tente novamente.');
   }
   return result as unknown as FieldRegistration;
 });

export const prepareFieldInventory = createServerFn({ method: 'POST' })
 .inputValidator(d => z.object({ token: tokenSchema }).parse(d))
 .handler(async ({ data }) => {
   const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
   const { error } = await supabaseAdmin.rpc('field_registration_prepare_inventory', { p_token: data.token });
   if (error) throw new Error('Não foi possível preparar o inventário. Confira os ambientes e tente novamente.');
   return { ok: true };
 });
