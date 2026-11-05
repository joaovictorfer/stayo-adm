export interface HistoryEntry { id: string; label: string; detail?: string | null; timestamp: string; actor?: string | null }
export interface AuditRow { id: string; event: string; entity_id: string | null; actor_id: string | null; metadata: Record<string, unknown> | null; created_at: string }

/** Eventos técnicos repetitivos ficam fora da linha do tempo. */
const NOISE = new Set(["field.registration.saved", "guide.applied", "auth.login", "guide.response_corrected"]);

/** Converte auditoria em entrada; ids semânticos evitam duplicar o que já vem das propostas. */
export function auditToEntry(row: AuditRow, names: Record<string, string>): HistoryEntry | null {
  if (NOISE.has(row.event)) return null;
  const m = row.metadata ?? {};
  const actor = row.actor_id ? names[row.actor_id] ?? "Equipe STAYO" : null;
  const base = { timestamp: row.created_at, actor };
  switch (row.event) {
    case "conditions_published":
      return { ...base, id: `pp-${row.entity_id}`, label: `Condições salvas · versão ${m["version"] ?? ""}`.trim(), detail: m["change"] === "text" ? "Só texto: aceite mantido" : m["change"] === "values" ? "Valores mudaram: nova confirmação" : null };
    case "owner_proposal_confirmed":
      return { ...base, id: `pa-${row.entity_id}`, label: `Condições aceitas · versão ${m["version"] ?? ""}`.trim(), actor: actor ?? "Proprietário" };
    case "owner_intake.approve":
      return { ...base, id: row.id, label: "Dados do proprietário revisados" };
    case "inventory_submission_aprovar":
      return { ...base, id: row.id, label: "Envio do inventário revisado" };
    case "supply.resolved":
      return { ...base, id: row.id, label: "Bloqueio resolvido", detail: (m["name"] as string) ?? null };
    case "implementation.status_changed":
      return { ...base, id: row.id, label: "Etapa da ficha alterada", detail: m["to"] ? `${m["from"] ?? "—"} → ${m["to"]}` : null };
    case "portal.invitation_created": return { ...base, id: row.id, label: "Link do proprietário criado" };
    case "portal.invitation_revoked": return { ...base, id: row.id, label: "Link do proprietário revogado" };
    case "portal.block_released": return { ...base, id: row.id, label: "Conteúdo liberado no Portal" };
    case "guide.response_confirmed": return { ...base, id: row.id, label: "Resposta do proprietário confirmada" };
    case "guide.owner_answered": return { ...base, id: row.id, label: "Proprietário respondeu o inventário", actor: "Proprietário" };
  }
  if (/core|stayo_app|app\.link/i.test(row.event)) return { ...base, id: row.id, label: /unlink|desvinc/i.test(row.event) ? "Vínculo com o STAYO APP removido" : "Vinculado ao STAYO APP" };
  return null;
}

/** Junta fontes sem duplicar (mesmo id, ou mesmo texto no mesmo minuto) e ordena do mais recente. */
export function mergeHistory(...lists: Array<Array<HistoryEntry | null | undefined>>): HistoryEntry[] {
  const byId = new Map<string, HistoryEntry>();
  const seen = new Set<string>();
  for (const e of lists.flat()) {
    if (!e?.timestamp || Number.isNaN(Date.parse(e.timestamp))) continue;
    const prev = byId.get(e.id);
    if (prev) { if (!prev.actor && e.actor) byId.set(e.id, { ...prev, actor: e.actor }); continue; }
    const sig = `${e.label.toLowerCase()}|${e.timestamp.slice(0, 16)}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
