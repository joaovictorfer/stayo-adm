import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { OwnerWorkspaceSnapshot } from '@/types/core';
import { ownerMonthProjection } from './owner-workspace';
import type { PayoutPdfReservation } from './pdf/payout-pdf';

const idInput = z.object({ implementationId: z.string().uuid() });
const tokenInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
async function hash(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export const prepareOwnerWorkspace = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput).handler(async ({ data, context }): Promise<OwnerWorkspaceSnapshot> => {
  const s = context.supabase;
  const role = await s.rpc('has_admin_role', { roles: ['super_admin', 'admin', 'operations', 'finance'] });
  if (role.error || role.data !== true) throw new Error('Acesso negado');
  const project = await s.from('implementation_projects').select('id,code,nickname,condominium_name,unit,owner_id,operational_status').eq('id', data.implementationId).single();
  if (project.error || !project.data.owner_id) throw new Error('Vincule o proprietário antes de publicar');
  async function pages<T>(query: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const result: T[] = [];
    for (let a = 0; ; a += 500) { const r = await query(a, a + 499); if (r.error) throw new Error('Não foi possível preparar todos os registros'); result.push(...(r.data ?? [])); if ((r.data?.length ?? 0) < 500) break; }
    return result;
  }
  const [rows, expenses, transfers, conditions, updates, inspections] = await Promise.all([
    pages((a,b) => s.from('payout_reservations').select('id,reservation_code,channel,guest_name,guest_cpf,checkin_date,checkout_date,payout_flow,gross_cents,cleaning_cents,platform_fee_cents,owner_direct_cents,missing_amounts').eq('implementation_id', data.implementationId).order('id').range(a,b)),
    pages((a,b) => s.from('property_expenses').select('occurred_on,amount_cents,charged_to_owner').eq('implementation_id', data.implementationId).order('id').range(a,b)),
    pages((a,b) => s.from('payout_transfers').select('competence,amount_cents').eq('implementation_id', data.implementationId).order('id').range(a,b)),
    s.from('implementation_contract_conditions').select('administration_fee').eq('implementation_id', data.implementationId).maybeSingle(),
    pages((a,b) => s.from('implementation_timeline_updates').select('id,title,event_date,kind').eq('implementation_id', data.implementationId).eq('owner_visible', true).order('id').range(a,b)),
    pages((a,b) => s.from('implementation_inspections').select('id,type,status,scheduled_for,completed_at').eq('implementation_id', data.implementationId).eq('owner_visible', true).order('id').range(a,b)),
  ]);
  if (conditions.error) throw new Error('Não foi possível conferir as condições');
  const fee = Number(conditions.data?.administration_fee ?? 20);
  const months = [...new Set([...rows.map(r => r.checkin_date.slice(0,7)), ...expenses.map(e => e.occurred_on.slice(0,7)), ...transfers.map(t => t.competence)])].sort().reverse();
  const p = project.data;
  return { implementationId: p.id, propertyName: p.nickname || [p.condominium_name,p.unit].filter(Boolean).join(' ') || p.code, code: p.code, situation: p.operational_status, publishedAt: new Date().toISOString(), fee,
    months: months.map(m => ownerMonthProjection(m, fee, rows as (PayoutPdfReservation & { id: string })[], expenses, transfers)),
    history: [...updates.map(u => ({ id: u.id, title: u.title, date: u.event_date, category: 'Atualização', status: 'registrado' })),
      ...inspections.map(i => ({ id: i.id, title: `Vistoria · ${i.type}`, date: i.completed_at ?? i.scheduled_for ?? '', category: 'Vistoria', status: i.status }))].filter(e => e.date).sort((a,b) => b.date.localeCompare(a.date)),
  };
});

const reservationSchema = z.object({ id: z.string().uuid(), code: z.string(), channel: z.string(), guestName: z.string(), cpfMasked: z.string().nullable(), checkin: z.string(), checkout: z.string(), total: z.number().nullable(), stayo: z.number().nullable(), owner: z.number().nullable(), directReceipt: z.number().nullable(), directConfirmed: z.boolean() }).strict();
const snapshotSchema = z.object({ implementationId: z.string().uuid(), propertyName: z.string(), code: z.string(), situation: z.string(), publishedAt: z.string().datetime(), fee: z.number().min(0).max(100), months: z.array(z.object({ competence: z.string(), reservations: z.array(reservationSchema), total: z.number().nullable(), ownerTotal: z.number().nullable(), airbnbReceived: z.number().nullable(), expenses: z.number(), transferred: z.number(), closingAmount: z.number().nullable(), balance: z.number().nullable() }).strict()), history: z.array(z.object({ id:z.string(), title:z.string(), date:z.string(), category:z.string(), status:z.string() }).strict()) }).strict();

export const publishOwnerWorkspace = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ snapshot: snapshotSchema })).handler(async ({ data, context }) => {
  // Reject unmasked documents even if an administrative caller bypasses the review UI.
  if (data.snapshot.months.some(m => m.reservations.some(r => r.cpfMasked && !r.cpfMasked.includes('•')))) throw new Error('Documento deve permanecer protegido');
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
  const r = await context.supabase.rpc('admin_publish_owner_workspace', { p_implementation_id: data.snapshot.implementationId, p_hash: await hash(token), p_snapshot: data.snapshot });
  if (r.error) throw new Error(r.error.message);
  return { id: r.data, token };
});

export const listOwnerWorkspaceLinks = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(idInput).handler(async ({ data, context }) => {
  const r = await context.supabase.from('owner_workspace_links').select('id,created_at,expires_at,revoked_at').eq('implementation_id', data.implementationId).order('created_at', { ascending: false });
  if (r.error) throw new Error('Acesso negado'); return r.data;
});
export const revokeOwnerWorkspace = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id:z.string().uuid() })).handler(async ({ data,context }) => {
  const r = await context.supabase.rpc('admin_revoke_owner_workspace', { p_id:data.id }); if(r.error) throw new Error('Não foi possível revogar');
});

export const readOwnerWorkspace = createServerFn({ method: 'POST' }).inputValidator(tokenInput).handler(async ({ data }): Promise<(OwnerWorkspaceSnapshot & { coverUrl: string | null }) | null> => {
  const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Portal indisponível');
  const client = createClient(url,key,{ auth:{ persistSession:false, autoRefreshToken:false }, global:{ fetch:(input,init) => { const headers=new Headers(init?.headers); if(key.startsWith('sb_') && headers.get('Authorization')===`Bearer ${key}`) headers.delete('Authorization'); headers.set('apikey',key); return fetch(input,{...init,headers}); } } });
  const r = await client.rpc('owner_workspace_resolve', { p_hash:await hash(data.token) });
  if(r.error) throw new Error('Não foi possível abrir o portal'); if(!r.data) return null;
  const snapshot=snapshotSchema.parse(r.data);
  // Privileged storage signing is allowed only after the dedicated capability was verified.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const cover = await supabaseAdmin.rpc('implementation_effective_cover', { p_implementation_id:snapshot.implementationId });
  const path = (cover.data as { path?:string } | null)?.path;
  const signed=path ? await supabaseAdmin.storage.from('implementation-covers').createSignedUrl(path,600) : null;
  return { ...snapshot, coverUrl:signed?.data?.signedUrl ?? null };
});

export const revealOwnerGuestCpf = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth]).inputValidator(tokenInput.extend({ reservationId:z.string().uuid() })).handler(async ({ data,context }) => {
  const r=await context.supabase.rpc('owner_workspace_guest_document',{p_hash:await hash(data.token),p_reservation_id:data.reservationId});
  if(r.error) throw new Error('Entre com a conta autorizada deste imóvel para consultar o CPF');
  return typeof r.data==='string' ? r.data.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4') : null;
});