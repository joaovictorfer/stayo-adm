import { useState, type ReactElement } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
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
  trigger,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: {
  id: string;
  code: string;
  locked: boolean;
  navigateAfterDelete?: boolean;
  compact?: boolean;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

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
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTyped("");
      }}
    >
      {showTrigger && (
        <AlertDialogTrigger asChild>
          {trigger ?? (
            <Button
              variant="outline"
              size={compact ? "icon" : "sm"}
              className={
                compact
                  ? "size-9 rounded-[var(--radius-control)] border-[var(--stayo-border)] bg-[var(--stayo-surface)] text-[var(--stayo-danger)] shadow-sm hover:border-[var(--stayo-danger)] hover:bg-[var(--stayo-danger)]/10 hover:text-[var(--stayo-danger)]"
                  : "gap-2 rounded-[var(--radius-control)] border-[var(--stayo-danger)]/40 text-[var(--stayo-danger)] hover:bg-[var(--stayo-danger)]/10 hover:text-[var(--stayo-danger)]"
              }
              aria-label={`Excluir ${code}`}
              title={`Excluir ${code}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {!compact && <span>Excluir</span>}
            </Button>
          )}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-[var(--stayo-danger)]/10">
            <AlertTriangle className="size-5 text-[var(--stayo-danger)]" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Excluir {code} definitivamente?</AlertDialogTitle>
          <AlertDialogDescription>
            {locked
              ? "Esta implantação está ativa ou vinculada ao Core e não pode ser excluída."
              : "Remove a implantação e tudo ligado a ela: propostas e aceites, reuniões, convites, cadastro, fornecedores, anexos e foto de capa. Os links enviados deixam de funcionar. Não é possível desfazer."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!locked && (
          <label className="grid gap-1.5 text-sm">
            <span>
              Digite <strong className="font-mono">{code}</strong> para confirmar
            </span>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={code}
              className="font-mono"
            />
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {!locked && (
            <Button
              variant="destructive"
              disabled={typed.trim() !== code || busy}
              onClick={() => void confirm()}
            >
              {busy ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
