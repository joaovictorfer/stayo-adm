import officialLogo from "../../assets/stayo-logo-white.png.asset.json";
import bodyFont from "../../assets/payout-figtree.ttf.asset.json";
import headingFont from "../../assets/payout-outfit.ttf.asset.json";
import { generatePayoutPdf, type PayoutPdfInput, type PayoutPdfPalette } from "./payout-pdf";

/** Uses the light, print palette even when the administrative UI is in dark mode. */
function printPalette(): PayoutPdfPalette {
  const probe = document.createElement("div");
  probe.className = "payout-pdf-palette";
  document.body.appendChild(probe);
  const css = getComputedStyle(probe);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) { probe.remove(); throw new Error("Não foi possível preparar as cores do PDF."); }
  const result = {} as PayoutPdfPalette;
  for (const key of ["navy", "cobalt", "coral", "gold", "paper", "ink", "muted", "border", "soft", "onSolid"] as const) {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css.getPropertyValue(`--pdf-${key}`).trim(); ctx.fillRect(0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    result[key] = [(pixel[0] ?? 0) / 255, (pixel[1] ?? 0) / 255, (pixel[2] ?? 0) / 255];
  }
  probe.remove(); return result;
}
async function bytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível carregar a identidade visual do PDF. Tente novamente.");
  return new Uint8Array(await response.arrayBuffer());
}
export async function downloadPayoutPdf(input: Omit<PayoutPdfInput, "palette" | "assets">, coverUrl?: string | null) {
  const [logo, body, heading] = await Promise.all([bytes(officialLogo.url), bytes(bodyFont.url), bytes(headingFont.url)]);
  let cover: Uint8Array | undefined;
  if (coverUrl) {
    try {
      const bitmap = await createImageBitmap(new Blob([await bytes(coverUrl)]));
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(bitmap, 0, 0); bitmap.close();
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (blob) cover = new Uint8Array(await blob.arrayBuffer());
      }
    } catch { /* An unavailable real cover is omitted, never replaced by another property's photo. */ }
  }
  const pdf = await generatePayoutPdf({ ...input, palette: printPalette(), assets: { logo, bodyFont: body, headingFont: heading, cover } });
  const url = URL.createObjectURL(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }));
  const anchor = document.createElement("a"); anchor.href = url;
  anchor.download = `STAYO-Repasse-${input.property.replace(/[^\p{L}\p{N}]+/gu, "-")}-${input.competence}.pdf`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}