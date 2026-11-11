import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { auditToEntry } from './implementation-history';
import { filterPropertyHistory, latestHistoryEntries, validateHistoryQuantities } from './property-history';
import type { PropertyHistoryEntry } from '@/types/core';

const filters = z.object({ search:z.string().max(180),phase:z.string(),category:z.string(),status:z.string(),from:z.string(),to:z.string(),ascending:z.boolean() });
export const readPropertyHistory = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({implementationId:z.string().uuid(),filters,offset:z.number().int().min(0),caseId:z.string().uuid().optional()})).handler(async({data,context})=>{
 const s=context.supabase;
 const role=await s.rpc('has_admin_role',{roles:['super_admin','admin','commercial','operations','finance','viewer']});
 if(role.error || role.data!==true) throw new Error('Acesso negado');
 const entries:PropertyHistoryEntry[]=[]; const warnings:string[]=[];
 // Each source is read in explicit pages; failures remain visible, never become empty success.
 async function pages<T>(get:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>, name:string):Promise<T[]> {
  const rows:T[]=[]; for(let n=0;;n+=500){const r=await get(n,n+499);if(r.error){warnings.push(name);break;}rows.push(...(r.data??[]));if((r.data?.length??0)<500)break;}return rows;
 }
 const cases=await pages((a,b)=>s.from('property_history_cases').select('*').eq('implementation_id',data.implementationId).order('id').range(a,b),'Ocorrências');
 const caseMap=new Map(cases.map(c=>[c.id,c]));
 const events=cases.length ? await pages((a,b)=>s.from('property_history_events').select('*').in('case_id',cases.map(c=>c.id)).order('id').range(a,b),'Atualizações'):[];
 const actors=new Set(events.map(e=>e.created_by).filter((id):id is string=>Boolean(id)));
 const profiles=actors.size ? await s.from('admin_profiles').select('id,full_name').in('id',[...actors]):{data:[]};
 const names=Object.fromEntries((profiles.data??[]).map(p=>[p.id,p.full_name??'Equipe STAYO']));
 const blank={caseId:null,revision:0,status:'registrado',dateOnly:false,actor:'Equipe STAYO',responsible:'',room:'',supplier:'',expectedQty:null,receivedQty:null,checkedQty:null,expectedDate:null,amountCents:null,correctionReason:''};
 for(const e of events){const c=caseMap.get(e.case_id);if(!c)continue;entries.push({...blank,id:e.id,caseId:c.id,revision:e.revision,title:c.title,description:e.description,category:c.category as PropertyHistoryEntry['category'],phase:c.phase as PropertyHistoryEntry['phase'],status:e.status,occurredAt:e.occurred_at,dateOnly:e.date_only,createdAt:e.created_at,actor:e.created_by?names[e.created_by]??'Equipe STAYO':'Equipe STAYO',responsible:e.responsible,room:e.room,supplier:e.supplier,expectedQty:e.expected_qty,receivedQty:e.received_qty,checkedQty:e.checked_qty,expectedDate:e.expected_date,amountCents:e.amount_cents,correctionReason:e.correction_reason});}
 if(data.caseId)return {entries:entries.filter(e=>e.caseId===data.caseId).sort((a,b)=>b.revision-a.revision),total:0,warnings,pending:0,pendingEntries:[] as PropertyHistoryEntry[]};
 const [updates,steps,proposals,reservations,project,audits,decisions,inspections]=await Promise.all([
 pages((a,b)=>s.from('implementation_timeline_updates').select('*').eq('implementation_id',data.implementationId).order('id').range(a,b),'Implantação'),
 pages((a,b)=>s.from('implementation_timeline_steps').select('id,title,done_at').eq('implementation_id',data.implementationId).not('done_at','is',null).order('id').range(a,b),'Etapas'),
 pages((a,b)=>s.from('proposals').select('id').eq('implementation_id',data.implementationId).order('id').range(a,b),'Propostas'),
 pages((a,b)=>s.from('payout_reservations').select('id,reservation_code,channel,guest_name,checkin_date,checkout_date,created_at').eq('implementation_id',data.implementationId).order('id').range(a,b),'Reservas'),
 s.from('implementation_projects').select('created_at').eq('id',data.implementationId).single(),
 pages((a,b)=>s.from('audit_logs').select('id,event,entity_id,actor_id,metadata,created_at').or(`entity_id.eq.${data.implementationId},metadata->>implementationId.eq.${data.implementationId}`).order('id').range(a,b),'Auditoria'),
 pages((a,b)=>s.from('implementation_field_confirmations').select('id,field_key,state,updated_at').eq('implementation_id',data.implementationId).like('field_key','div:%').order('id').range(a,b),'Decisões'),
 pages((a,b)=>s.from('implementation_inspections').select('id,type,status,scheduled_for,completed_at,public_notes,created_at').eq('implementation_id',data.implementationId).order('id').range(a,b),'Vistorias')
 ]);
 if(project.data)entries.push({...blank,id:'creation',title:'Ficha criada',description:'',category:'implantacao',phase:'implantacao',occurredAt:project.data.created_at,createdAt:project.data.created_at});
 if(project.error)warnings.push('Ficha');
 for(const u of updates)entries.push({...blank,id:`upd-${u.id}`,title:u.title,description:u.description??'',category:u.kind==='enxoval'?'compra':'implantacao',phase:'implantacao',occurredAt:u.event_date,dateOnly:/T00:00:00/.test(u.event_date),createdAt:u.created_at});
 for(const d of decisions)entries.push({...blank,id:`dec-${d.id}`,title:'Divergência revisada',description:`${d.field_key.slice(4)} · ${d.state}`,category:'implantacao',phase:'implantacao',occurredAt:d.updated_at,createdAt:d.updated_at});
 for(const i of inspections)entries.push({...blank,id:`inspection-${i.id}`,title:`Vistoria · ${i.type}`,description:i.public_notes??'',category:'vistoria',phase:'implantacao',status:i.completed_at?'concluido':'agendada',occurredAt:i.completed_at??i.scheduled_for??i.created_at,createdAt:i.created_at});
 for(const t of steps)if(t.done_at)entries.push({...blank,id:`step-${t.id}`,title:`Etapa concluída: ${t.title}`,description:'',category:'implantacao',phase:'implantacao',occurredAt:t.done_at,createdAt:t.done_at});
 const proposalAudits=proposals.length?await pages((a,b)=>s.from('audit_logs').select('id,event,entity_id,actor_id,metadata,created_at').in('entity_id',proposals.map(p=>p.id)).order('id').range(a,b),'Aceites'):[];
 for(const a of [...audits,...proposalAudits]){const e=auditToEntry(a as Parameters<typeof auditToEntry>[0],names);if(e && !entries.some(x=>x.id===e.id))entries.push({...blank,id:e.id,title:e.label,description:e.detail??'',category:'implantacao',phase:'implantacao',occurredAt:e.timestamp,createdAt:e.timestamp,actor:e.actor??'Equipe STAYO'});}
 for(const r of reservations)entries.push({...blank,id:`reservation-${r.id}`,title:`${r.reservation_code??'Reserva'} · ${r.channel}`,description:`${r.guest_name} · ${r.checkin_date.split('-').reverse().join('/')} a ${r.checkout_date.split('-').reverse().join('/')}`,category:'reserva',phase:'operacao',occurredAt:r.checkin_date+'T12:00:00Z',dateOnly:true,createdAt:r.created_at,reservationMonth:r.checkin_date.slice(0,7)});
 const pendingEntries=filterPropertyHistory(latestHistoryEntries(entries),{...data.filters,status:'pending'});
 const filtered=filterPropertyHistory(entries,data.filters);
 return {entries:filtered.slice(data.offset,data.offset+30),total:filtered.length,warnings,pending:pendingEntries.length,pendingEntries};
});
const optionalQty=z.number().int().nonnegative().nullable();
export const recordPropertyHistory = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({implementation_id:z.string().uuid(),case_id:z.string().uuid().nullable(),request_id:z.string().uuid(),revision:z.number().int().nonnegative(),category:z.enum(['implantacao','reserva','compra','manutencao','higienizacao','vistoria','ocorrencia']),phase:z.enum(['implantacao','operacao']),title:z.string().trim().min(1).max(180),occurred_at:z.string().datetime(),date_only:z.boolean(),status:z.enum(['aberta','agendada','em_andamento','aguardando_entrega','parcial','recebido','pendencia','concluido','cancelado']),description:z.string().max(4000),responsible:z.string().max(180),room:z.string().max(180),supplier:z.string().max(180),expected_qty:optionalQty,received_qty:optionalQty,checked_qty:optionalQty,expected_date:z.string().nullable(),amount_cents:z.number().int().nonnegative().nullable(),is_correction:z.boolean(),correction_reason:z.string().max(1000)})).handler(async({data,context})=>{
 const err=validateHistoryQuantities(data.category,data.status,data.expected_qty,data.received_qty,data.checked_qty);if(err)throw new Error(err);
 const result=await context.supabase.rpc('admin_record_property_history',{p_input:data});if(result.error)throw new Error(result.error.message);return result.data;
});