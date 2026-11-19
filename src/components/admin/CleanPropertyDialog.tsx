import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyCentsInput } from "@/components/ui/money-input";
import { markClean, type CleaningRow } from "@/lib/api/op-cleaning-api";

export function CleanPropertyDialog({ row, staff, today, onClose, onDone }: { row: CleaningRow | null; staff: { id: string; name: string }[]; today: string; onClose: () => void; onDone: () => void }) {
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(today);
  const [cents, setCents] = useState(16000);
  useEffect(() => {
    if (!row) return;
    setStaffId(row.next?.staffId ?? ""); setDate(today); setCents(Math.round((row.next?.amount ?? 160) * 100));
  }, [row, today]);
  const save = useMutation({
    mutationFn: () => {
      if (!row) throw new Error("Selecione o imóvel.");
      return markClean({ implementationId: row.id, staffId, staffName: staff.find((s) => s.id === staffId)?.name ?? "", date, amount: cents / 100 });
    },
    onSuccess: () => { toast.success(`${row?.property} marcado como limpo.`); onDone(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return <Dialog open={!!row} onOpenChange={(v) => { if (!v && !save.isPending) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Marcar {row?.property} como limpo</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium">Quem limpou
          <select aria-label="Quem limpou" className="admin-input h-11 w-full px-3" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Selecione</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm font-medium">Quando<input aria-label="Data da limpeza" type="date" max={today} className="admin-input h-11 w-full px-3" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="block space-y-1.5 text-sm font-medium">Valor<MoneyCentsInput aria-label="Valor da limpeza" cents={cents} onCentsChange={setCents} /></label>
        </div>
        {staff.length === 0 && <p className="text-xs text-muted-foreground">Cadastre a equipe em Equipe e Meu Dia para escolher quem limpou.</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button disabled={!staffId || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando…" : "Confirmar limpeza"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}