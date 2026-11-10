import { useState } from "react";
import { Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { adjustPayoutAmounts, PAYOUT_FIELD_LABEL, type PayoutAmountField } from "@/lib/api/core-client";

const toCents = (v: string) => { const t = v.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", "."); if (!/^\d+(\.\d{1,2})?$/.test(t)) return null; return Math.round(Number(t) * 100); };

type Row = { id: string; reservation_code?: string | null; guest_name: string; payout_flow: string; missing_amounts?: string[] | null; manual_amounts?: string[] | null;
  gross_cents: number; cleaning_cents: number; platform_fee_cents: number; owner_direct_cents: number };

export function PayoutAmountEditor({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const missing = new Set(row.missing_amounts ?? []);
  // Só os campos que vieram sem valor (ou já lançados manualmente) são editáveis aqui.
  const editable = new Set([...(row.missing_amounts ?? []), ...(row.manual_amounts ?? [])]);
  const fields = (["gross", "cleaning", "platform_fee", ...(row.payout_flow === "platform_auto" ? ["owner_direct"] : [])] as PayoutAmountField[]).filter(f => editable.has(f));
  const initial = () => Object.fromEntries(fields.map(f => [f, missing.has(f) ? "" : ((row as any)[`${f}_cents`] / 100).toFixed(2).replace(".", ",")])) as Record<PayoutAmountField, string>;
  const [vals, setVals] = useState(initial);
  const [confirm, setConfirm] = useState<Record<PayoutAmountField, string>>({} as any);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = Object.fromEntries(fields.map(f => [f, toCents(vals[f] ?? "")])) as Record<PayoutAmountField, number | null>;
  const step1Ok = fields.every(f => parsed[f] !== null) && reason.trim().length >= 5;
  const confirmParsed = Object.fromEntries(fields.map(f => [f, toCents(confirm[f] ?? "")])) as Record<PayoutAmountField, number | null>;
  const mismatch = fields.filter(f => (confirm[f] ?? "") !== "" && confirmParsed[f] !== parsed[f]);
  const step2Ok = fields.every(f => confirmParsed[f] !== null && confirmParsed[f] === parsed[f]);

  const reset = () => { setStep(1); setVals(initial()); setConfirm({} as any); setReason(""); };
  const save = async () => {
    setBusy(true);
    try {
      const a = Object.fromEntries(fields.map(f => [f, parsed[f]!]));
      const c = Object.fromEntries(fields.map(f => [f, confirmParsed[f]!]));
      const r = await adjustPayoutAmounts(row.id, a, c, reason.trim());
      toast.success(r.changed ? "Valores salvos e registrados na ficha do imóvel." : "Nenhum valor foi alterado.");
      setOpen(false); reset(); onSaved();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const isManual = (row.manual_amounts ?? []).length > 0;
  return <>
    <Button variant="ghost" size="icon" type="button" aria-label="Lançar valores manualmente" title={isManual ? "Valores lançados manualmente — editar" : "Lançar valores manualmente"}
      onClick={() => { reset(); setOpen(true); }} className={missing.size ? "text-destructive hover:text-destructive" : "text-muted-foreground"}><Pencil size={16} /></Button>
    <Dialog open={open} onOpenChange={o => { if (!busy) setOpen(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar valores · {row.reservation_code || "Reserva"}</DialogTitle>
          <DialogDescription>{row.guest_name}. {step === 1 ? "Passo 1 de 2: informe os valores e o motivo." : "Passo 2 de 2: digite os valores de novo para confirmar."}</DialogDescription>
        </DialogHeader>
        {step === 1 ? <div className="space-y-3">
          {fields.map(f => <label key={f} className="block text-sm"><span className="mb-1 flex justify-between font-medium">{PAYOUT_FIELD_LABEL[f]}{missing.has(f) && <span className="text-xs text-destructive">Não informado</span>}</span>
            <Input inputMode="decimal" placeholder="0,00" value={vals[f] ?? ""} onChange={e => setVals(v => ({ ...v, [f]: e.target.value }))} aria-invalid={vals[f] !== "" && parsed[f] === null} /></label>)}
          <label className="block text-sm"><span className="mb-1 block font-medium">Motivo / origem da informação</span>
            <Input maxLength={500} placeholder="Ex.: conforme extrato do Airbnb de 16/10" value={reason} onChange={e => setReason(e.target.value)} /></label>
        </div> : <div className="space-y-3">
          {fields.map(f => <label key={f} className="block text-sm"><span className="mb-1 block font-medium">Confirme: {PAYOUT_FIELD_LABEL[f]}</span>
            <Input inputMode="decimal" placeholder="Digite novamente" autoComplete="off" onPaste={e => e.preventDefault()} value={confirm[f] ?? ""} onChange={e => setConfirm(v => ({ ...v, [f]: e.target.value }))} aria-invalid={mismatch.includes(f)} />
            {mismatch.includes(f) && <span className="mt-1 block text-xs text-destructive">Não confere com o valor digitado no passo 1.</span>}</label>)}
          <p className="flex gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground"><ShieldCheck size={16} className="shrink-0" />O ajuste fica salvo no banco, aparece no histórico da ficha do imóvel e não é apagado pela sincronização com o Guia STAYO.</p>
        </div>}
        <DialogFooter className="gap-2">
          {step === 2 && <Button variant="outline" type="button" disabled={busy} onClick={() => setStep(1)}>Voltar</Button>}
          {step === 1 ? <Button type="button" disabled={!step1Ok} onClick={() => setStep(2)}>Continuar</Button>
            : <Button type="button" disabled={!step2Ok || busy} onClick={save}>{busy ? "Salvando…" : "Confirmar e salvar"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
