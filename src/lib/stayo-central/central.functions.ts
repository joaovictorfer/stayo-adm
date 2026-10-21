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
 return {configured,originValid,baseUrl:CENTRAL_BASE_URL,status:!originValid?"invalid_origin":!configured?"not_configured":"authentication_pending",contractReady:false,automaticSync:false,eventsEnabled:false,lastAttempt:latest.data?.[0]??null,lastSuccess:successful.data?.[0]??null,checkpoints:checkpoint.data||[],mapping:{owners:ownerRows,properties:propertyRows,ownerReferenceConflicts:mismatches.map(p=>({localId:p.id,code:p.code})),counts:{localOwners:ownerRows.length,localProperties:propertyRows.length,linkedOwners:ownerRows.filter(r=>r.externalId).length,linkedProperties:propertyRows.filter(r=>r.externalId).length,ambiguous:ownerRows.filter(r=>r.state==="duplicate_external").length+propertyRows.filter(r=>r.state==="duplicate_external").length+mismatches.length}}};
});

export const testCentralConnection = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 if(error||allowed!==true)throw new Error("Diagnóstico restrito aos administradores autorizados.");
 const token=process.env["STAYO_API_TOKEN"];
 if(!token)return {ok:false,kind:"not_configured" as CentralErrorKind,message:messages.not_configured,status:null,requestId:null};
 const {createCentralHttp}=await import("./http.server");
 const {whoamiTransportSchema}=await import("./contracts");
 const client=createCentralHttp({token,baseUrl:process.env["STAYO_API_URL"]||CENTRAL_BASE_URL});
 const result=await client.get("/system/whoami",whoamiTransportSchema);
 // HTTP 200 alone cannot prove the expected app/scope until official whoami schema is available.
 const kind:CentralErrorKind=result.ok?"contract_pending":result.kind;
 const {error:saveError}=await context.supabase.from("stayo_central_diagnostics").insert({resource:"connection",succeeded:false,result_kind:kind,http_status:result.status,request_id:result.requestId,returned_count:0,actor_id:context.userId});
 if(saveError)throw new Error("Consulta realizada, mas não foi possível registrar o diagnóstico.");
 return {ok:false,kind,message:messages[kind],status:result.status,requestId:result.requestId};
});

export const previewCentralRecords = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>querySchema.parse(input)).handler(async({context,data})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 if(error||allowed!==true)throw new Error("Consulta restrita aos administradores autorizados.");
 const configured=!!process.env["STAYO_API_TOKEN"];
 // Deliberately fail closed: no provider payload, import or checkpoint advance without complete OpenAPI.
 return {ok:false,resource:data.resource,kind:configured?"contract_pending":"not_configured",message:configured?messages.contract_pending:messages.not_configured,items:[],localChanges:0};
});
export const previewCentralDetail = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(input=>detailSchema.parse(input)).handler(async({context,data})=>{
 setResponseHeader("Cache-Control","no-store");
 const {data:allowed,error}=await context.supabase.rpc("has_admin_role",{roles:["super_admin","admin"]});
 if(error||allowed!==true)throw new Error("Consulta restrita aos administradores autorizados.");
 return {ok:false,resource:data.resource,checkin:data.checkin,kind:"contract_pending",message:messages.contract_pending,localChanges:0};
});