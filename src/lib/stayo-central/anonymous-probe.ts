// Anonymous connectivity probe (Fase 4B). Never sends tokens, cookies or operator headers.
export const PROBE_TARGETS = [
  { name: "health", url: "https://guia.stayogramado.com.br/api/v1/health" },
  { name: "whoami", url: "https://guia.stayogramado.com.br/api/v1/system/whoami" },
] as const;
export const AUTHORIZED_PREVIEW_HOSTS = ["id-preview--696b2125-0bf9-4538-8458-05d88fc5e8a2.lovable.app"] as const;
export const PROBE_PROJECT = "stayo-admin";

export type ProbeCall = { name: string; ok: boolean; status: number | null; requestId: string | null; failure: string | null };
export type ProbeResult = { project: string; environment: string; executedAt: string; executionId: string; ok: boolean; calls: ProbeCall[] };

/** Strict host allowlist; anything else (production, custom domain, localhost, missing) is ineligible. */
export function environmentFor(requestUrl: string | null | undefined): "preview" | "ineligible" {
  try {
    const u = new URL(requestUrl || "");
    return u.protocol === "https:" && (AUTHORIZED_PREVIEW_HOSTS as readonly string[]).includes(u.hostname) ? "preview" : "ineligible";
  } catch { return "ineligible"; }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function call(fetcher: Fetch, target: (typeof PROBE_TARGETS)[number], timeoutMs: number): Promise<ProbeCall> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(target.url, { method: "GET", headers: { Accept: "application/json" }, redirect: "manual", signal: ctrl.signal, credentials: "omit" });
    const requestId = res.headers.get("x-request-id") || res.headers.get("cf-ray");
    const base = { name: target.name, status: res.status, requestId };
    if (res.status >= 300 && res.status < 400 || res.type === "opaqueredirect") return { ...base, ok: false, failure: "redirect" };
    const type = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!type.includes("json")) return { ...base, ok: false, failure: res.status === 403 && /1010/.test(text) ? "403/1010" : "non_json" };
    let body: any; try { body = JSON.parse(text); } catch { return { ...base, ok: false, failure: "invalid_json" }; }
    const reqId = requestId || body?.meta?.request_id || body?.error?.request_id || null;
    const ok = target.name === "health"
      ? res.status === 200 && body?.data?.status === "ok" && body?.meta?.api_version === "v1"
      : res.status === 401 && body?.error?.code === "unauthorized";
    return { ...base, requestId: reqId, ok, failure: ok ? null : res.status === 403 ? "403" : "unexpected_response" };
  } catch (e) {
    return { name: target.name, ok: false, status: null, requestId: null, failure: (e as Error)?.name === "AbortError" ? "timeout" : "network_error" };
  } finally { clearTimeout(timer); }
}

export async function runAnonymousProbe(opts: { isAdmin: boolean; requestUrl: string | null | undefined; fetcher: Fetch; timeoutMs?: number; now?: () => Date; id?: () => string }): Promise<ProbeResult | { refused: "forbidden" | "environment" }> {
  if (!opts.isAdmin) return { refused: "forbidden" };
  if (environmentFor(opts.requestUrl) !== "preview") return { refused: "environment" };
  const calls: ProbeCall[] = [];
  for (const t of PROBE_TARGETS) calls.push(await call(opts.fetcher, t, opts.timeoutMs ?? 5000));
  return { project: PROBE_PROJECT, environment: "preview", executedAt: (opts.now?.() ?? new Date()).toISOString(), executionId: opts.id?.() ?? crypto.randomUUID(), ok: calls.every(c => c.ok), calls };
}
