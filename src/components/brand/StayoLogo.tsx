import greenLogo from "@/assets/stayo-logo-green.png.asset.json";
import whiteLogo from "@/assets/stayo-logo-white.png.asset.json";
import { cn } from "@/lib/utils";

export function StayoLogo({
  variant = "green",
  className,
}: {
  variant?: "green" | "white";
  className?: string;
}) {
  return (
    <img
      src={variant === "white" ? whiteLogo.url : greenLogo.url}
      alt="Stayo Gramado"
      className={cn("block object-contain", className)}
    />
  );
}