import { useState } from "react";

import institutionalCover from "../../assets/owner-portal-property-fallback.jpg";
import { useOwnerCoverByToken } from "../../hooks/use-owner-cover";

/**
 * Faixa de capa das páginas públicas por link. Só mostra imagem autorizada
 * para a implantação do link válido; senão, o visual institucional STAYO.
 * Foto do condomínio aparece identificada como "Condomínio [nome]".
 */
export function OwnerCoverBanner({ token, inline = false }: { token: string; inline?: boolean }) {
  const cover = useOwnerCoverByToken(token);
  const [broken, setBroken] = useState(false);
  if (cover.isPending) {
    return (
      <div
        className={inline ? "mt-4" : "mx-auto w-full max-w-xl px-4 pt-2 md:max-w-2xl"}
        aria-hidden="true"
      >
        <div className="h-28 animate-pulse rounded-2xl bg-[rgba(255,255,255,0.12)] sm:h-36" />
      </div>
    );
  }
  const data = broken ? null : (cover.data ?? null);
  const note = !data
    ? "Imagem institucional STAYO"
    : data.source === "condominium"
      ? data.label
      : null;
  return (
    <div className={inline ? "mt-4" : "mx-auto w-full max-w-xl px-4 pt-2 md:max-w-2xl"}>
      <figure className="relative h-28 overflow-hidden rounded-2xl bg-[var(--stayo-forest-strong)] sm:h-36">
        <img
          src={data?.url ?? institutionalCover}
          onError={() => setBroken(true)}
          alt={
            !data
              ? "Visual institucional STAYO (não é foto do imóvel)"
              : data.source === "condominium"
                ? `Foto do ${data.label ?? "condomínio"}`
                : "Foto do imóvel"
          }
          className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-500"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(11,49,80,0.55))]" />
        {note && (
          <figcaption className="absolute bottom-2.5 left-3 rounded-full bg-[rgba(11,49,80,0.72)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--stayo-surface)]">
            {note}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
