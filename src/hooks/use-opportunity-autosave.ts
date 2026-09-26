import { useCallback, useEffect, useRef, useState } from "react";

import {
  autosaveOpportunity,
  type FieldConflict,
  type FormField,
  type FormValues,
} from "../lib/api/opportunity-form";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Autosave da oportunidade: debounce, fila serializada (uma gravação por vez),
 * flush explícito e conflito por campo quando outra pessoa mudou o mesmo dado.
 * Atualizações são idempotentes (UPDATE por campo), então repetir não duplica.
 */
export function useOpportunityAutosave(id: string, initial: FormValues | null) {
  const [values, setValues] = useState<FormValues | null>(initial);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const base = useRef<FormValues | null>(initial);
  const pending = useRef<Partial<Record<FormField, string>>>({});
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (initial && !base.current) {
      base.current = initial;
      setValues(initial);
    }
  }, [initial]);

  const run = useCallback(async (): Promise<boolean> => {
    if (running.current) await running.current;
    const patch = pending.current;
    if (!Object.keys(patch).length) return true;
    pending.current = {};
    const baseSnap: Partial<FormValues> = {};
    for (const k of Object.keys(patch) as FormField[]) baseSnap[k] = base.current?.[k] ?? "";
    setState("saving");
    const p = (async () => {
      try {
        const res = await autosaveOpportunity(id, patch, baseSnap);
        const conflicted = new Set(res.conflicts.map((c) => c.field));
        // Base passa a ser o que está no banco para campos gravados.
        base.current = { ...(base.current ?? res.values) };
        for (const k of Object.keys(patch) as FormField[])
          if (!conflicted.has(k)) base.current[k] = res.values[k];
        if (res.conflicts.length)
          setConflicts((cur) => [
            ...cur.filter((c) => !conflicted.has(c.field)),
            ...res.conflicts,
          ]);
        setError(null);
        setState(Object.keys(pending.current).length ? "saving" : "saved");
        return true;
      } catch (e) {
        // Devolve à fila sem perder o que foi digitado depois.
        pending.current = { ...patch, ...pending.current };
        setError(e instanceof Error ? e.message : "Sem conexão.");
        setState("error");
        return false;
      }
    })();
    running.current = p;
    const ok = await p;
    running.current = null;
    return ok;
  }, [id]);

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const ok = await run();
    if (ok && Object.keys(pending.current).length) return run();
    return ok;
  }, [run]);

  const set = useCallback(
    (field: FormField, value: string) => {
      setValues((cur) => (cur ? { ...cur, [field]: value } : cur));
      pending.current = { ...pending.current, [field]: value };
      setState("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void run(), 800);
    },
    [run],
  );

  const resolveConflict = useCallback(
    (field: FormField, keep: "mine" | "current") => {
      const c = conflicts.find((x) => x.field === field);
      if (!c) return;
      setConflicts((cur) => cur.filter((x) => x.field !== field));
      if (base.current) base.current[field] = c.current;
      if (keep === "current") {
        setValues((cur) => (cur ? { ...cur, [field]: c.current } : cur));
      } else {
        pending.current = { ...pending.current, [field]: c.mine };
        void run();
      }
    },
    [conflicts, run],
  );

  // Salva ao ocultar a aba ou fechar.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        void flush();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flush]);

  return { values, set, state, error, conflicts, resolveConflict, flush, retry: flush };
}
