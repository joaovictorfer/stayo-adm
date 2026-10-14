/** Grava marca d'água (logo, nome do imóvel e selo "Implantação STAYO · data") na própria foto. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function surveyStickerText(date = new Date()) {
  return `Implantação STAYO · ${date.toLocaleDateString("pt-BR")}`;
}

export async function watermarkPhoto(file: File, propertyName: string, logoUrl: string): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext("2d")!;
    c.drawImage(img, 0, 0, w, h);

    const u = Math.max(w, h) / 100;
    // Faixa inferior escura
    const band = u * 11;
    const grad = c.createLinearGradient(0, h - band * 1.6, 0, h);
    grad.addColorStop(0, "rgba(11,49,80,0)");
    grad.addColorStop(1, "rgba(11,49,80,0.85)");
    c.fillStyle = grad;
    c.fillRect(0, h - band * 1.6, w, band * 1.6);

    // Logo
    try {
      const logo = await loadImage(logoUrl);
      const lh = u * 4.2;
      const lw = (logo.width / logo.height) * lh;
      c.globalAlpha = 0.95;
      c.drawImage(logo, u * 2.5, h - u * 2.5 - lh, lw, lh);
      c.globalAlpha = 1;
    } catch {
      /* logo indisponível: segue só com textos */
    }

    // Nome do imóvel
    c.fillStyle = "#ffffff";
    c.font = `600 ${u * 2.6}px Outfit, Figtree, sans-serif`;
    c.textAlign = "right";
    c.textBaseline = "bottom";
    c.fillText(propertyName, w - u * 2.5, h - u * 2.5);

    // Selo
    const sticker = surveyStickerText();
    c.font = `700 ${u * 2}px Figtree, sans-serif`;
    const tw = c.measureText(sticker).width;
    const ph = u * 1.2;
    const bx = w - u * 2.5 - tw - ph * 2;
    const by = u * 2.5;
    const bh = u * 4.2;
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.beginPath();
    c.roundRect(bx, by, tw + ph * 2, bh, bh / 2);
    c.fill();
    c.fillStyle = "#0b3150";
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(sticker, bx + ph, by + bh / 2);

    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1]!;
  } finally {
    URL.revokeObjectURL(url);
  }
}
