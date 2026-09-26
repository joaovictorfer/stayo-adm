import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { deleteImplementation } from "../../lib/api/implementation-covers";

export function DeleteImplementationButton({
  id,
  code,
  locked,
  navigateAfterDelete = true,
  compact = false,
}: {
  id: string;
  code: string;
  locked: boolean;
  navigateAfterDelete?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function confirm() {
    setBusy(true);
    try {
      await deleteImplementation(id, typed.trim());
      await qc.invalidateQueries({ queryKey: ["implementations"] });
      toast.success(`${code} excluída.`);
      setOpen(false);
      if (navigateAfterDelete) void navigate({ to: "/implantacao" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTyped(""); }}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className="text-[var(--stayo-danger)]"
          aria-label={`Excluir ${code}`}
          title={`Excluir ${code}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {!compact && <span className="hidden sm:inline">Excluir</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {code} definitivamente?</AlertDialogTitle>
          <AlertDialogDescription>
            {locked
              ? "Esta implantação está ativa ou vinculada ao Core e não pode ser excluída."
              : "Remove a implantação e tudo ligado a ela: propostas e aceites, reuniões, convites, cadastro, fornecedores, anexos e foto de capa. Os links enviados deixam de funcionar. Não é possível desfazer."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!locked && (
          <label className="grid gap-1 text-sm">
            Digite <strong>{code}</strong> para confirmar
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {!locked && (
            <Button variant="destructive" disabled={typed.trim() !== code || busy} onClick={() => void confirm()}>
              {busy ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
