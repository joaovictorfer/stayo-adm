import blackLogo from "@/assets/stayo-logo-black.png.asset.json";
import greenLogo from "@/assets/stayo-logo-green.png.asset.json";
import sandLogo from "@/assets/stayo-logo-sand.png.asset.json";
import squareGreenLogo from "@/assets/stayo-logo-square-green.png.asset.json";
import squareWhiteLogo from "@/assets/stayo-logo-square-white.png.asset.json";
import whiteLogo from "@/assets/stayo-logo-white.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Logos oficiais STAYO Gramado — use sempre este componente, nunca o nome em texto.
 * - green: fundos claros (padrão)
 * - white: fundos escuros/navy/fotos
 * - black: impressão monocromática
 * - sand: marca d'água sobre fundos escuros ou areia
 * - square-green / square-white: selos quadrados (ícone de app, avatar, capas)
 */
export type StayoLogoVariant =
  "green" | "white" | "black" | "sand" | "square-green" | "square-white";

const sources: Record<StayoLogoVariant, string> = {
  green: greenLogo.url,
  white: whiteLogo.url,
  black: blackLogo.url,
  sand: sandLogo.url,
  "square-green": squareGreenLogo.url,
  "square-white": squareWhiteLogo.url,
};

export const stayoLogoUrl = (variant: StayoLogoVariant = "green") => sources[variant];

export function StayoLogo({
  variant = "green",
  className,
  decorative = false,
}: {
  variant?: StayoLogoVariant;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      src={sources[variant]}
      alt={decorative ? "" : "Stayo Gramado"}
      aria-hidden={decorative || undefined}
      className={cn("block object-contain", className)}
    />
  );
}
