import { describe, it, expect, vi } from "vitest";
import { runAnonymousProbe, environmentFor } from "./anonymous-probe";
const P="https://id-preview--696b2125-0bf9-4538-8458-05d88fc5e8a2.lovable.app/configuracoes";
const json=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json","x-request-id":"r"+s}});
const good=()=>vi.fn(async(u:string)=>u.endsWith("/health")?json(200,{data:{status:"ok"},meta:{api_version:"v1"}}):json(401,{error:{code:"unauthorized"}}));
describe("anonymous probe",()=>{
 it("non-admin makes zero calls",async()=>{const f=good();expect(await runAnonymousProbe({isAdmin:false,requestUrl:P,fetcher:f})).toEqual({refused:"forbidden"});expect(f).not.toHaveBeenCalled();});
 it("production/custom/localhost make zero calls",async()=>{for(const u of["https://stayo-adm.lovable.app/","https://adm.stayogramado.com.br/","http://localhost:8080/",undefined]){const f=good();expect(await runAnonymousProbe({isAdmin:true,requestUrl:u,fetcher:f})).toEqual({refused:"environment"});expect(f).not.toHaveBeenCalled();}});
 it("passes only with both expected results, no token or cookies",async()=>{const f=good();const r:any=await runAnonymousProbe({isAdmin:true,requestUrl:P,fetcher:f});expect(r.ok).toBe(true);expect(f).toHaveBeenCalledTimes(2);for(const [,i] of f.mock.calls as any){expect(i.redirect).toBe("manual");expect(i.headers).toEqual({Accept:"application/json"});}});
 it("redirect, HTML 403/1010 and timeout fail",async()=>{
  const r1:any=await runAnonymousProbe({isAdmin:true,requestUrl:P,fetcher:async()=>new Response(null,{status:302})});expect(r1.calls.map((c:any)=>c.failure)).toEqual(["redirect","redirect"]);
  const r2:any=await runAnonymousProbe({isAdmin:true,requestUrl:P,fetcher:async()=>new Response("error code: 1010",{status:403,headers:{"content-type":"text/html"}})});expect(r2.calls[0].failure).toBe("403/1010");expect(r2.ok).toBe(false);
  const r3:any=await runAnonymousProbe({isAdmin:true,requestUrl:P,timeoutMs:10,fetcher:(_u,i)=>new Promise((_,rej)=>i.signal!.addEventListener("abort",()=>rej(Object.assign(new Error(),{name:"AbortError"}))))});expect(r3.calls[0].failure).toBe("timeout");
  const r4:any=await runAnonymousProbe({isAdmin:true,requestUrl:P,fetcher:async()=>json(200,{data:{status:"ok"},meta:{api_version:"v1"}})});expect(r4.ok).toBe(false);
 });
 it("env detection",()=>{expect(environmentFor(P)).toBe("preview");expect(environmentFor("https://evil.com/?h=id-preview--696b2125-0bf9-4538-8458-05d88fc5e8a2.lovable.app")).toBe("ineligible");});
});
