import { z } from "zod";
import { CENTRAL_BASE_URL, type CentralFilters, type CentralResource, type CentralResult, type CentralFailure, listEnvelope, filtersSchema, referenceSchema } from "./contracts";
export interface HttpOptions { token?: string; baseUrl?: string; fetcher?: typeof fetch; wait?: (ms:number)=>Promise<void>; random?: ()=>number; now?: ()=>number; timeoutMs?: number; log?: (entry:{ endpoint:string; status:number|null; attempt:number; requestId:string|null; kind:string })=>void }
export function createCentralHttp(options: HttpOptions) {
 const fetcher=options.fetcher ?? fetch; const wait=options.wait ?? (ms=>new Promise(resolve=>setTimeout(resolve,ms))); const random=options.random ?? Math.random; const now=options.now ?? Date.now;
 const failure=(kind:CentralFailure["kind"],status:number|null=null,requestId:string|null=null,retryAfterMs:number|null=null):CentralFailure=>({ok:false,kind,status,requestId,retryAfterMs});
 async function get<T>(path:string, schema:z.ZodType<T>, query:Record<string,string>={}):Promise<CentralResult<T>> {
  if(!options.token)return failure("not_configured");
  if((options.baseUrl ?? CENTRAL_BASE_URL)!==CENTRAL_BASE_URL)return failure("invalid_origin");
  if(!/^\/(health|system\/whoami|admin\/(properties|owners|reservations)(\/[0-9a-f-]{36}(\/checkin)?)?)$/.test(path))return failure("invalid_origin");
  const url=new URL(`${CENTRAL_BASE_URL}${path}`);Object.entries(query).forEach(([k,v])=>url.searchParams.set(k,v));
  const operationStarted=now();
  for(let attempt=1;attempt<=3;attempt++) {
   if(now()-operationStarted>=50000)return failure("timeout");
   const attemptStarted=now();const timeoutMs=Math.min(options.timeoutMs??15000,50000-(now()-operationStarted));
   let response:Response;
   try {response=await fetcher(url.toString(),{method:"GET",headers:{Authorization:`Bearer ${options.token}`,Accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(timeoutMs)});}
   catch(e) {const kind=e instanceof Error&&(e.name==="TimeoutError"||e.name==="AbortError")?"timeout":"network";options.log?.({endpoint:path.replace(/[0-9a-f-]{36}/g,":id"),status:null,attempt,requestId:null,kind});if(attempt===3)return failure(kind);await wait(500*2**(attempt-1)+Math.floor(random()*250));continue;}
   const ridRaw=response.headers.get("X-Request-Id");const rid=ridRaw && /^[a-zA-Z0-9_-]{1,200}$/.test(ridRaw)?ridRaw:null;
   if(!response.ok){
    const status=response.status;const kind=status===401?"unauthorized":status===403?"forbidden":status===429?"rate_limited":status>=500?"unavailable":"invalid_response";
    const ra=response.headers.get("Retry-After");const parsedDelay=ra===null?null:/^\d+$/.test(ra)?Number(ra)*1000:Date.parse(ra)-now();const delay=parsedDelay!==null&&Number.isFinite(parsedDelay)?Math.max(0,parsedDelay):null;
    void response.body?.cancel().catch(()=>{});options.log?.({endpoint:path.replace(/[0-9a-f-]{36}/g,":id"),status,attempt,requestId:rid,kind});
    if(attempt<3&&(status>=500||status===429)) {const backoff=500*2**(attempt-1)+Math.floor(random()*250);const pause=Math.max(backoff,delay??0);if(pause>15000||now()-operationStarted+pause>=50000)return failure(kind,status,rid,pause);await wait(pause);continue;}
    return failure(kind,status,rid,delay);
   }
   let body:unknown;let timer:ReturnType<typeof setTimeout>|undefined;
   try{body=await Promise.race([response.json(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new DOMException("Body deadline","TimeoutError")),Math.max(1,timeoutMs-(now()-attemptStarted)));})]);}
   catch(e){const kind=e instanceof Error&&(e.name==="TimeoutError"||e.name==="AbortError")?"timeout":"invalid_response";options.log?.({endpoint:path.replace(/[0-9a-f-]{36}/g,":id"),status:response.status,attempt,requestId:rid,kind});if(kind==="timeout"&&attempt<3)continue;return failure(kind,response.status,rid);}
   finally{if(timer!==undefined)clearTimeout(timer);}
   const parsed=schema.safeParse(body);if(!parsed.success){options.log?.({endpoint:path.replace(/[0-9a-f-]{36}/g,":id"),status:response.status,attempt,requestId:rid,kind:"invalid_response"});return failure("invalid_response",response.status,rid);}
   const metaRid=body&&typeof body==="object"&&"meta"in body?(body as {meta?:{request_id?:unknown}}).meta?.request_id:undefined;
   const requestId=rid||(typeof metaRid==="string"&&/^[a-zA-Z0-9_-]{1,200}$/.test(metaRid)?metaRid:null);
   options.log?.({endpoint:path.replace(/[0-9a-f-]{36}/g,":id"),status:response.status,attempt,requestId,kind:"ok"});
   return {ok:true,data:parsed.data,requestId,status:response.status};
  }
  return failure("unavailable");
 }
 async function pages(resource:CentralResource, filters:CentralFilters={}, maxPages=100):Promise<CentralResult<{items:{id:string}[];pages:number;roundStartedAt:string}>> {
  const params=filtersSchema.parse(filters);const query=Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)]));let cursor=params.cursor;const seenCursors=new Set<string>();const seenIds=new Set<string>();const items:{id:string}[]=[];const started=new Date(now()).toISOString();
  for(let n=1;n<=maxPages;n++){if(cursor){if(seenCursors.has(cursor))return failure("pagination");seenCursors.add(cursor);query['cursor']=cursor;}else delete query['cursor'];
   const result=await get(`/admin/${resource}`,listEnvelope(referenceSchema),query);if(!result.ok)return result;
   for(const item of result.data.data.items){if(seenIds.has(item.id))return failure("pagination",200,result.requestId);seenIds.add(item.id);items.push(item);}
   const page=result.data.data.page;if(!page.has_more)return {ok:true,data:{items,pages:n,roundStartedAt:started},requestId:result.requestId,status:200};cursor=page.next_cursor ?? undefined;
  }return failure("pagination");
 }
 return {get,pages};
}