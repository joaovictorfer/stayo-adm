import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import institutionalCover from "../../assets/owner-portal-property-fallback.jpg";
import {
  getAdminCoverState,
  getCondominiumCover,
  removeCondominiumCover,
  setCondominiumCoverExternal,
  uploadCondominiumCover,
  removeImplementationCover,
  setImplementationCoverSource,
  uploadImplementationCoverFor,
} from "../../lib/api/implementation-covers";

/**
 * Capa do link do proprietário. Prioridade aplicada no banco:
 * capa aprovada da implantação → foto do imóvel no Core (não integrado)
 * → foto autorizada do condomínio vinculado → institucional STAYO.
 */
export function CoverPicker({
  implementationId,
  propertyName,
}: {
  implementationId: string;
  propertyName: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [broken, setBroken] = useState(false);
  const key = ["implementation-cover", implementationId];
  const query = useQuery({ queryKey: key, queryFn: () => getAdminCoverState(implementationId) });

  const run = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => {
      setBroken(false);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a capa."),
  });

  const state = query.data;
  const condo = state?.condominium ?? null;
  const condoUsable = Boolean(condo?.url && condo.externalAllowed);

  let effective: { url: string; origin: string; label: string | null } = {
    url: institutionalCover,
    origin: "Imagem institucional STAYO",
    label: null,
  };
  if (state?.source === "implementation" && state.implementationUrl) {
    effective = {
      url: state.implementationUrl,
      origin: "Foto da implantação (aprovada)",
      label: null,
    };
  } else if (state?.source === "condominium" && condoUsable && condo?.url) {
    effective = {
      url: condo.url,
      origin: `Foto do condomínio vinculado`,
      label: `Condomínio ${condo.name}`,
    };
  }
  const isInstitutional = effective.url === institutionalCover || broken;

  return (
    <section
      className="rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--stayo-border)" }}
      aria-labelledby="cover-picker-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="cover-picker-title"
            className="text-sm font-semibold"
            style={{ color: "var(--stayo-ink)" }}
          >
            Capa do link do proprietário
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Aparece no topo do portal, da apresentação e do cadastro enviados ao proprietário.
          </p>
        </div>
        {run.isPending && (
          <Loader2
            className="size-4 animate-spin text-[var(--stayo-ink-muted)]"
            aria-label="Salvando"
          />
        )}
      </div>

      {query.isPending ? (
        <div className="mt-4 h-40 animate-pulse rounded-[var(--radius-control)] bg-[var(--stayo-bg)]" />
      ) : query.isError ? (
        <div className="mt-4 rounded-[var(--radius-control)] bg-[var(--stayo-bg)] p-4 text-sm">
          Não conseguimos carregar a capa.{" "}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <p
            className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--stayo-ink-muted)" }}
          >
            Prévia do que o proprietário verá
          </p>
          <div className="relative mt-2 h-40 overflow-hidden rounded-[var(--radius-control)] bg-[var(--stayo-forest)] sm:h-44">
            <img
              key={effective.url}
              src={broken ? institutionalCover : effective.url}
              onError={() => setBroken(true)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(11,49,80,0.85))]" />
            <span className="absolute left-3 top-3 rounded-full bg-[rgba(11,49,80,0.7)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--stayo-surface)]">
              {isInstitutional
                ? "Imagem institucional STAYO"
                : (effective.label ?? "Foto do imóvel")}
            </span>
            <div className="absolute bottom-3 left-3 right-3 text-[var(--stayo-surface)]">
              <strong className="block truncate text-base font-semibold">{propertyName}</strong>
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Origem:{" "}
            <strong style={{ color: "var(--stayo-ink)" }}>
              {broken ? "Imagem institucional STAYO (a foto não carregou)" : effective.origin}
            </strong>
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Enviar foto de capa"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) run.mutate(() => uploadImplementationCoverFor(implementationId, file));
              }}
            />
            <Button
              variant="outline"
              disabled={run.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {state?.implementationUrl
                ? "Trocar foto da implantação"
                : "Enviar foto da implantação"}
            </Button>
            {state?.implementationUrl && state.source !== "implementation" && (
              <Button
                variant="outline"
                disabled={run.isPending}
                onClick={() =>
                  run.mutate(() => setImplementationCoverSource(implementationId, "implementation"))
                }
              >
                <ImageIcon className="size-4" /> Usar foto da implantação
              </Button>
            )}
            {condo && condoUsable && state?.source !== "condominium" && (
              <Button
                variant="outline"
                disabled={run.isPending}
                onClick={() =>
                  run.mutate(() => setImplementationCoverSource(implementationId, "condominium"))
                }
              >
                <Building2 className="size-4" /> Usar foto do Condomínio {condo.name}
              </Button>
            )}
            {state?.source && (
              <Button
                variant="ghost"
                disabled={run.isPending}
                onClick={() =>
                  run.mutate(() => setImplementationCoverSource(implementationId, null))
                }
              >
                Usar imagem institucional
              </Button>
            )}
            {state?.implementationUrl && (
              <Button
                variant="ghost"
                disabled={run.isPending}
                onClick={() => run.mutate(() => removeImplementationCover(implementationId))}
              >
                <Trash2 className="size-4" /> Remover foto enviada
              </Button>
            )}
          </div>
          {condo && !condoUsable && (
            <p className="mt-3 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {condo.url
                ? `A foto do Condomínio ${condo.name} ainda não foi autorizada para uso externo. Autorize na ficha do condomínio.`
                : `O Condomínio ${condo.name} não tem foto cadastrada.`}
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Foto principal do imóvel no STAYO APP: disponível quando a integração com o Core
            existir.
          </p>
        </>
      )}
    </section>
  );
}

export function CondominiumCoverPanel({
  condominiumId,
  condominiumName,
}: {
  condominiumId: string;
  condominiumName: string;
}) {
  return <CondominiumCoverInner id={condominiumId} name={condominiumName} />;
}

function CondominiumCoverInner({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const key = ["condominium-cover", id];
  const query = useQuery({ queryKey: key, queryFn: () => getCondominiumCover(id) });
  const run = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["implementation-cover"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });
  const data = query.data;
  return (
    <div className="grid gap-3">
      {query.isPending ? (
        <div className="h-36 animate-pulse rounded-lg bg-[var(--admin-surface-muted,#f3f1ec)]" />
      ) : data?.url ? (
        <img
          src={data.url}
          alt={`Foto do Condomínio ${name}`}
          className="h-36 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-36 place-items-center rounded-lg border border-dashed border-[var(--admin-border)] text-xs text-[var(--admin-muted)]">
          Nenhuma foto cadastrada
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Enviar foto do condomínio"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) run.mutate(() => uploadCondominiumCover(id, file));
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={run.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" /> {data?.url ? "Trocar foto" : "Enviar foto"}
        </Button>
        {data?.url && (
          <Button
            variant="ghost"
            size="sm"
            disabled={run.isPending}
            onClick={() => run.mutate(() => removeCondominiumCover(id))}
          >
            <Trash2 className="size-4" /> Remover
          </Button>
        )}
      </div>
      {data?.url && (
        <label className="flex items-start gap-2 text-sm text-[var(--admin-text)]">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={data.externalAllowed}
            disabled={run.isPending}
            onChange={(e) => {
              const v = e.target.checked;
              run.mutate(() => setCondominiumCoverExternal(id, v));
            }}
          />
          <span>
            Autorizar uso externo
            <span className="block text-xs text-[var(--admin-muted)]">
              Permite escolher esta foto como capa do link do proprietário, identificada como
              "Condomínio {name}".
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

/** URL assinada da capa efetiva, para exibição interna (ficha). */
export function useAdminCoverUrl(implementationId: string | undefined): string | null {
  const q = useQuery({
    queryKey: ["implementation-cover", implementationId],
    queryFn: () => getAdminCoverState(implementationId!),
    enabled: Boolean(implementationId),
  });
  const s = q.data;
  if (!s) return null;
  if (s.source === "implementation") return s.implementationUrl;
  if (s.source === "condominium" && s.condominium?.externalAllowed) return s.condominium.url;
  return null;
}
