import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { getSupabaseBrowserClient } from "../../../lib/api/supabase-client";
import { isValidEmail } from "../../../lib/api/owner-platforms";
import { formatBrazilianDocument, formatBrazilianPhone } from "../../../lib/owner-form-validation";

const DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "icloud.com", "live.com", "uol.com.br", "bol.com.br", "terra.com.br"];

/** Sugere domínios comuns enquanto o e-mail é digitado. */
export function EmailSuggestInput({ value, onChange, id, placeholder = "nome@gmail.com" }: { value: string; onChange: (v: string) => void; id?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [local, domainPart = ""] = value.split("@");
  const suggestions = local && !value.includes(" ") ? DOMAINS.filter(d => d.startsWith(domainPart.toLowerCase()) && d !== domainPart.toLowerCase()).slice(0, 5) : [];
  return <div className="relative">
    <Input id={id} type="email" inputMode="email" autoComplete="off" value={value} placeholder={placeholder}
      onChange={e => { onChange(e.target.value.trim()); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} className="h-11" />
    {open && suggestions.length > 0 && <ul role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[var(--stayo-border)] bg-[var(--stayo-surface)] shadow-md">
      {suggestions.map(d => <li key={d}><button type="button" role="option" aria-selected={false} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(`${local}@${d}`); setOpen(false); }}
        className="block w-full px-3 py-2 text-left text-sm text-[var(--stayo-navy)] hover:bg-[var(--ficha-subtle)]">{local}<span className="text-[var(--stayo-ink-muted)]">@{d}</span></button></li>)}
    </ul>}
  </div>;
}

type PixType = "cpf" | "cnpj" | "phone" | "email" | "random";
const PIX_TYPES: Array<{ key: PixType; label: string }> = [
  { key: "cpf", label: "CPF" }, { key: "cnpj", label: "CNPJ" }, { key: "phone", label: "Telefone" }, { key: "email", label: "E-mail" }, { key: "random", label: "Aleatória" },
];

function pixValid(type: PixType, v: string) {
  const d = v.replace(/\D/g, "");
  if (type === "cpf") return d.length === 11;
  if (type === "cnpj") return d.length === 14;
  if (type === "phone") return d.length === 10 || d.length === 11;
  if (type === "email") return isValidEmail(v);
  return v.trim().length >= 8;
}
function pixFormat(type: PixType, v: string) {
  if (type === "cpf" || type === "cnpj") return formatBrazilianDocument(v.replace(/\D/g, "").slice(0, type === "cpf" ? 11 : 14));
  if (type === "phone") return formatBrazilianPhone(v.replace(/\D/g, "").slice(0, 11));
  return v;
}

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Indisponível");
  return c;
}

export function PixEditor({ implementationId, initialType, initialKey }: { implementationId: string; initialType?: PixType | undefined; initialKey?: string | null | undefined }) {
  const qc = useQueryClient();
  const [type, setType] = useState<PixType>(initialType ?? "cpf");
  const [key, setKey] = useState(initialKey ? pixFormat(initialType ?? "cpf", initialKey) : "");
  const [saving, setSaving] = useState(false);
  const touched = useRef(false);
  useEffect(() => { if (!touched.current && initialKey) { setType(initialType ?? "cpf"); setKey(pixFormat(initialType ?? "cpf", initialKey)); } }, [initialKey, initialType]);
  const ok = pixValid(type, key);
  const save = async () => {
    setSaving(true);
    try {
      const value = type === "email" || type === "random" ? key.trim() : key.replace(/\D/g, "");
      const { error } = await client().from("owner_payout_accounts").upsert({ implementation_id: implementationId, pix_type: type, pix_key: value }, { onConflict: "implementation_id" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["owner-onboarding", "submission", implementationId] });
      toast.success("Chave Pix salva");
    } catch (e) { toast.error((e as Error).message.includes("row-level") ? "Sem permissão para editar dados de recebimento." : "Não foi possível salvar a chave Pix."); }
    finally { setSaving(false); }
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de chave">
      {PIX_TYPES.map(t => <button key={t.key} type="button" role="radio" aria-checked={type === t.key} onClick={() => { touched.current = true; setType(t.key); setKey(""); }}
        className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors ${type === t.key ? "border-[var(--stayo-navy)] bg-[var(--stayo-navy)] text-[var(--stayo-surface)]" : "border-[var(--stayo-border)] bg-[var(--stayo-surface)] text-[var(--stayo-navy)] hover:bg-[var(--ficha-subtle)]"}`}>{t.label}</button>)}
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">{type === "email"
        ? <EmailSuggestInput value={key} onChange={v => { touched.current = true; setKey(v); }} />
        : <Input value={key} inputMode={type === "random" ? "text" : "numeric"} className="h-11" placeholder={type === "cpf" ? "000.000.000-00" : type === "cnpj" ? "00.000.000/0000-00" : type === "phone" ? "(54) 99999-9999" : "Cole a chave aleatória"}
            onChange={e => { touched.current = true; setKey(pixFormat(type, e.target.value)); }} />}</div>
      <Button className="h-11" disabled={!ok || saving} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar"}</Button>
    </div>
    {key && !ok && <p className="text-xs text-[var(--ficha-pending-fg)]">Confira a chave informada.</p>}
  </div>;
}

export function AirbnbEmailEditor({ implementationId, initial }: { implementationId: string; initial?: string | null | undefined }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) setEmail(initial ?? ""); }, [initial]);
  const ok = isValidEmail(email);
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await client().from("implementation_projects").update({ airbnb_account_email: email.trim().toLowerCase() }).eq("id", implementationId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["implementation-platforms", implementationId] });
      toast.success("E-mail do Airbnb salvo");
    } catch { toast.error("Não foi possível salvar o e-mail."); }
    finally { setSaving(false); }
  };
  return <div className="space-y-1">
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1"><EmailSuggestInput value={email} onChange={v => { touched.current = true; setEmail(v); }} /></div>
      <Button className="h-11" disabled={!ok || saving || email === (initial ?? "")} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar"}</Button>
    </div>
    {email && !ok && <p className="text-xs text-[var(--ficha-pending-fg)]">Confira o e-mail.</p>}
  </div>;
}
