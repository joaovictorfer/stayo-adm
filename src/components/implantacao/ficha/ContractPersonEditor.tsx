import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../../ui/button";
import { formatBrazilianDocument, formatBrazilianPhone } from "../../../lib/owner-form-validation";
import { EmailSuggestInput } from "./OwnerQuickEditors";

export type EditablePerson = {
  fullName?: string | null; document?: string | null; email?: string | null; phone?: string | null;
  maritalStatus?: string | null; profession?: string | null; role?: string | null;
};

const MARITAL = [["solteiro", "Solteiro(a)"], ["casado", "Casado(a)"], ["uniao_estavel", "União estável"], ["divorciado", "Divorciado(a)"], ["separado", "Separado(a)"], ["viuvo", "Viúvo(a)"]] as const;
const input = "h-10 w-full rounded-lg border border-[var(--stayo-border)] bg-white px-3 text-sm text-[var(--stayo-navy)] outline-none focus:border-[var(--stayo-navy)]";
const digits = (v: string) => v.replace(/\D/g, "");

async function ensureProfile(implementationId: string) {
  const { error } = await supabase.from("owner_onboarding_profiles").upsert({ implementation_id: implementationId } as never, { onConflict: "implementation_id", ignoreDuplicates: true });
  if (error) throw error;
}

/** Grava a pessoa na posição indicada (0 = titular). O link do proprietário lê os mesmos registros e permite completar. */
async function savePerson(implementationId: string, position: number, p: EditablePerson) {
  await ensureProfile(implementationId);
  const row = {
    implementation_id: implementationId, position,
    role: position === 0 ? "proprietario" : (p.role === "proponente" ? "proponente" : "coproprietario"),
    full_name: p.fullName?.trim() || null, document: p.document ? digits(p.document) || null : null,
    email: p.email?.trim().toLowerCase() || null, phone: p.phone ? digits(p.phone) || null : null,
    marital_status: p.maritalStatus || null, profession: p.profession?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("owner_onboarding_people").upsert(row as never, { onConflict: "implementation_id,position" });
  if (error) throw error;
}

function L({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block min-w-0"><span className="mb-1 block text-xs text-[var(--stayo-ink-muted)]">{label}</span>{children}</label>; }

export function ContractPersonForm({ implementationId, position, initial, onDone }: { implementationId: string; position: number; initial: EditablePerson; onDone: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState<EditablePerson>({ ...initial, document: initial.document ? formatBrazilianDocument(initial.document) : "", phone: initial.phone ? formatBrazilianPhone(initial.phone.replace(/^55(?=\d{10,11}$)/, "")) : "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof EditablePerson) => (v: string) => setP(s => ({ ...s, [k]: v }));
  const save = async () => {
    if (!p.fullName?.trim()) { toast.error("Informe ao menos o nome."); return; }
    setBusy(true);
    try { await savePerson(implementationId, position, p); await qc.invalidateQueries({ queryKey: ["owner-onboarding", "submission", implementationId] }); toast.success("Dados salvos"); onDone(); }
    catch (e) { toast.error((e as Error).message || "Não foi possível salvar."); } finally { setBusy(false); }
  };
  return <div className="space-y-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <L label="Nome"><input className={input} value={p.fullName ?? ""} onChange={e => set("fullName")(e.target.value)} placeholder="Pode ser só o primeiro nome" /></L>
      <L label="CPF/CNPJ"><input className={input} inputMode="numeric" value={p.document ?? ""} onChange={e => set("document")(formatBrazilianDocument(e.target.value))} /></L>
      <L label="WhatsApp"><input className={input} inputMode="tel" value={p.phone ?? ""} onChange={e => set("phone")(formatBrazilianPhone(e.target.value))} /></L>
      <L label="E-mail"><EmailSuggestInput value={p.email ?? ""} onChange={set("email")} /></L>
      <L label="Estado civil"><select className={input} value={p.maritalStatus ?? ""} onChange={e => set("maritalStatus")(e.target.value)}><option value="">Não informado</option>{MARITAL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></L>
      <L label="Profissão"><input className={input} value={p.profession ?? ""} onChange={e => set("profession")(e.target.value)} /></L>
    </div>
    <p className="text-xs text-[var(--stayo-ink-muted)]">O que ficar em branco o proprietário completa pelo link do cadastro.</p>
    <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void save()}><Check />Salvar</Button><Button size="sm" variant="ghost" disabled={busy} onClick={onDone}><X />Cancelar</Button></div>
  </div>;
}

export function AddContractPerson({ implementationId, position }: { implementationId: string; position: number }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus />Adicionar proponente {position + 1}</Button>;
  return <div className="rounded-lg border border-dashed border-[var(--stayo-border)] p-3"><p className="mb-2 text-sm font-semibold">Proponente {position + 1}</p>
    <ContractPersonForm implementationId={implementationId} position={position} initial={{ role: "coproprietario" }} onDone={() => setOpen(false)} /></div>;
}
