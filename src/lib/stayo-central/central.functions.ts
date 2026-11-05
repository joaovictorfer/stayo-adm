import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CENTRAL_BASE_URL, querySchema, detailSchema, messages, type CentralErrorKind } from "./contracts";

export const centralDiagnostics = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 if(error||allowed!==true)throw new Error("Diagnóstico restrito aos administradores autorizados.");
 const [latest,successful,owners,projects,checkpoint]=await Promise.all([
  context.supabase.from("stayo_central_diagnostics").select("resource,queried_at,succeeded,result_kind,http_status,request_id,returned_count").order("queried_at",{ascending:false}).limit(1),
  context.supabase.from("stayo_central_diagnostics").select("queried_at,returned_count").eq("succeeded",true).order("queried_at",{ascending:false}).limit(1),
  context.supabase.from("owner_records").select("id,core_owner_id,updated_at"),
  context.supabase.from("implementation_projects").select("id,code,core_property_id,core_owner_id,owner_id,updated_at"),
  context.supabase.from("stayo_central_checkpoints").select("resource,completed_round_started_at,last_full_scan_at,revision"),
 ]);
 if([latest,successful,owners,projects,checkpoint].some(q=>q.error))throw new Error("Não foi possível consultar o diagnóstico.");
 const {previewMapping}=await import("./mapping");
 const ownerRows=previewMapping((owners.data||[]).map(o=>({localId:o.id,externalId:o.core_owner_id,code:null,updatedAt:o.updated_at})),[],null);
 const propertyRows=previewMapping((projects.data||[]).map(p=>({localId:p.id,externalId:p.core_property_id,code:p.code,updatedAt:p.updated_at})),[],null);
 const mismatches=(projects.data||[]).filter(p=>{const owner=(owners.data||[]).find(o=>o.id===p.owner_id);return !!p.core_owner_id&&!!owner?.core_owner_id&&p.core_owner_id!==owner.core_owner_id;});
 const configured=!!process.env["STAYO_API_TOKEN"];
 const originValid=(process.env["STAYO_API_URL"]||CENTRAL_BASE_URL)===CENTRAL_BASE_URL;
 return {configured,originValid,baseUrl:CENTRAL_BASE_URL,status:!originValid?"invalid_origin":!configured?"not_configured":"connection_disabled",contractReady:true,connectionEnabled:false,contractRevision:"c5e2b1e0",automaticSync:false,eventsEnabled:false,lastAttempt:latest.data?.[0]??null,lastSuccess:successful.data?.[0]??null,checkpoints:checkpoint.data||[],mapping:{owners:ownerRows,properties:propertyRows,ownerReferenceConflicts:mismatches.map(p=>({localId:p.id,code:p.code})),counts:{localOwners:ownerRows.length,localProperties:propertyRows.length,linkedOwners:ownerRows.filter(r=>r.externalId).length,linkedProperties:propertyRows.filter(r=>r.externalId).length,ambiguous:ownerRows.filter(r=>r.state==="duplicate_external").length+propertyRows.filter(r=>r.state==="duplicate_external").length+mismatches.length}}};
});

export const testCentralConnection = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 if(error||allowed!==true)throw new Error("Diagnóstico restrito aos administradores autorizados.");
 const token=process.env["STAYO_API_TOKEN"];
 if(!token)return {ok:false,kind:"not_configured" as CentralErrorKind,message:messages.not_configured,status:null,requestId:null};
 return {ok:false,kind:"connection_disabled" as CentralErrorKind,message:messages.connection_disabled,status:null,requestId:null};
});

export const previewCentralRecords = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>querySchema.parse(input)).handler(async({context,data})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 if(error||allowed!==true)throw new Error("Consulta restrita aos administradores autorizados.");
 const configured=!!process.env["STAYO_API_TOKEN"];
 // Official contracts verified; productive authentication is not authorized.
 return {ok:false,resource:data.resource,kind:configured?"connection_disabled":"not_configured",message:configured?messages.connection_disabled:messages.not_configured,localChanges:0};
});
export const previewCentralDetail = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>detailSchema.parse(input)).handler(async({context,data})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 if(error||allowed!==true)throw new Error("Consulta restrita aos administradores autorizados.");
 const configured=!!process.env["STAYO_API_TOKEN"];
 return {ok:false,resource:data.resource,checkin:data.checkin,kind:configured?"connection_disabled":"not_configured",message:configured?messages.connection_disabled:messages.not_configured,localChanges:0};
});
// Fase 4B: anonymous preview-only probe, separate from testCentralConnection; never reads STAYO_API_TOKEN.
export const anonymousCentralProbeEligibility = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 const {getRequest}=await import("@tanstack/react-start/server");
 const {environmentFor}=await import("./anonymous-probe");
 return {eligible:allowed===true&&environmentFor(getRequest()?.url)==="preview"};
});
export const anonymousCentralProbe = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 const {getRequest}=await import("@tanstack/react-start/server");
 const {runAnonymousProbe}=await import("./anonymous-probe");
 const r=await runAnonymousProbe({isAdmin:!error&&allowed===true,requestUrl:getRequest()?.url,fetcher:(u,i)=>fetch(u,i)});
 if("refused" in r)throw new Error(r.refused==="forbidden"?"Diagnóstico restrito aos administradores autorizados.":"Ambiente não autorizado: nenhuma chamada externa foi feita.");
 return r;
});
