import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";

import officialLogo from "@/assets/stayo-logo-green.png.asset.json";

export const PDF_STYLES = {
  pageSize: [595.28, 841.89] as [number, number],
  margin: 56,
  colors: {
    forest: rgb(0.13, 0.25, 0.18),
    ink: rgb(0.11, 0.14, 0.11),
    inkMuted: rgb(0.36, 0.4, 0.37),
    border: rgb(0.88, 0.87, 0.82),
  },
};

export interface TextOptions {
  size?: number;
  color?: ReturnType<typeof rgb>;
  font?: "regular" | "bold";
  x?: number;
  align?: "left" | "center" | "right";
}

export class StayoPdfBuilder {
  doc: PDFDocument;
  fontRegular!: PDFFont;
  fontBold!: PDFFont;
  officialLogo?: PDFImage;
  currentPage!: PDFPage;
  y: number = 0;
  pages: PDFPage[] = [];
  documentTitle: string;
  primaryDate: Date;

  private constructor(doc: PDFDocument, title: string, date?: Date) {
    this.doc = doc;
    this.documentTitle = title;
    this.primaryDate = date || new Date();
  }

  static async create(title: string = "Documento Stayo", date?: Date) {
    const doc = await PDFDocument.create();
    const builder = new StayoPdfBuilder(doc, title, date);
    builder.fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    builder.fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    if (typeof window !== "undefined") {
      try {
        const response = await fetch(officialLogo.url);
        if (response.ok) {
          builder.officialLogo = await doc.embedPng(await response.arrayBuffer());
        }
      } catch {
        // O texto de marca permanece como fallback quando a imagem não estiver disponível.
      }
    }
    return builder;
  }

  private getFont(type: "regular" | "bold" = "regular") {
    return type === "bold" ? this.fontBold : this.fontRegular;
  }

  addPage(withHeader = true) {
    this.currentPage = this.doc.addPage(PDF_STYLES.pageSize);
    this.pages.push(this.currentPage);
    this.y = PDF_STYLES.pageSize[1] - PDF_STYLES.margin;

    if (withHeader) {
      this.drawHeader();
    }
  }

  ensureSpace(needed: number) {
    if (!this.currentPage || this.y - needed < PDF_STYLES.margin) {
      this.addPage(true);
    }
  }

  drawHeader() {
    if (this.officialLogo) {
      const dims = this.officialLogo.scaleToFit(76, 48);
      this.currentPage.drawImage(this.officialLogo, {
        x: PDF_STYLES.margin,
        y: this.y - 15,
        width: dims.width,
        height: dims.height,
      });
    } else {
      this.currentPage.drawText("STAYO", {
        x: PDF_STYLES.margin,
        y: this.y,
        size: 16,
        font: this.fontBold,
        color: PDF_STYLES.colors.forest,
      });
    }

    const dateStr = this.primaryDate.toLocaleDateString("pt-BR");
    
    const titleWidth = this.fontRegular.widthOfTextAtSize(this.documentTitle, 10);
    this.currentPage.drawText(this.documentTitle, {
      x: PDF_STYLES.pageSize[0] - PDF_STYLES.margin - titleWidth,
      y: this.y + 4,
      size: 10,
      font: this.fontRegular,
      color: PDF_STYLES.colors.inkMuted,
    });
    
    const dateWidth = this.fontRegular.widthOfTextAtSize(dateStr, 10);
    this.currentPage.drawText(dateStr, {
      x: PDF_STYLES.pageSize[0] - PDF_STYLES.margin - dateWidth,
      y: this.y - 10,
      size: 10,
      font: this.fontRegular,
      color: PDF_STYLES.colors.inkMuted,
    });

    this.y -= 28;
    this.rule();
    this.spacer(12);
  }

  async drawCover(title: string, subtitle?: string, coverImageBytes?: Uint8Array) {
    this.currentPage = this.doc.addPage(PDF_STYLES.pageSize);
    this.pages.push(this.currentPage);
    
    let contentStartY = PDF_STYLES.pageSize[1] - (PDF_STYLES.pageSize[1] / 3);

    if (coverImageBytes) {
      try {
        let image;
        // Check PNG magic bytes to select proper embedder
        if (coverImageBytes[0] === 0x89 && coverImageBytes[1] === 0x50 && coverImageBytes[2] === 0x4e && coverImageBytes[3] === 0x47) {
          image = await this.doc.embedPng(coverImageBytes);
        } else {
          image = await this.doc.embedJpg(coverImageBytes);
        }
        
        const dims = image.scaleToFit(PDF_STYLES.pageSize[0], PDF_STYLES.pageSize[1] * 0.45);
        this.currentPage.drawImage(image, {
          x: (PDF_STYLES.pageSize[0] - dims.width) / 2,
          y: PDF_STYLES.pageSize[1] - dims.height,
          width: dims.width,
          height: dims.height,
        });
        contentStartY = PDF_STYLES.pageSize[1] - dims.height - 40;
      } catch (e) {
        console.warn("Falha ao embutir a imagem de capa", e);
      }
    }

    this.y = contentStartY;

    if (this.officialLogo) {
      const dims = this.officialLogo.scaleToFit(170, 108);
      this.currentPage.drawImage(this.officialLogo, {
        x: PDF_STYLES.margin,
        y: this.y - dims.height,
        width: dims.width,
        height: dims.height,
      });
      this.y -= dims.height + 24;
    } else {
      this.text("STAYO", { size: 24, font: "bold", color: PDF_STYLES.colors.forest });
      this.spacer(24);
    }
    this.text(title, { size: 20, font: "bold", color: PDF_STYLES.colors.ink });
    if (subtitle) {
      this.spacer(8);
      this.text(subtitle, { size: 14, color: PDF_STYLES.colors.inkMuted });
    }
    
    this.y = PDF_STYLES.margin + 60;
    this.rule();
    this.text(`Gerado em: ${this.primaryDate.toLocaleDateString("pt-BR")}`, { size: 10, color: PDF_STYLES.colors.inkMuted });
  }

  text(value: string, opts: TextOptions = {}) {
    const size = opts.size ?? 10;
    this.ensureSpace(size + 6);
    const font = this.getFont(opts.font);
    
    let x = opts.x ?? PDF_STYLES.margin;
    if (opts.align === "right") {
      const w = font.widthOfTextAtSize(value, size);
      x = PDF_STYLES.pageSize[0] - PDF_STYLES.margin - w;
    } else if (opts.align === "center") {
      const w = font.widthOfTextAtSize(value, size);
      x = (PDF_STYLES.pageSize[0] - w) / 2;
    }

    this.currentPage.drawText(value, {
      x,
      y: this.y,
      size,
      font,
      color: opts.color ?? PDF_STYLES.colors.ink,
    });
    this.y -= size + 6;
  }

  spacer(h = 10) {
    this.y -= h;
  }

  rule() {
    this.ensureSpace(12);
    this.currentPage.drawLine({
      start: { x: PDF_STYLES.margin, y: this.y },
      end: { x: PDF_STYLES.pageSize[0] - PDF_STYLES.margin, y: this.y },
      thickness: 0.75,
      color: PDF_STYLES.colors.border,
    });
    this.y -= 14;
  }

  async save(): Promise<Uint8Array> {
    const totalPages = this.pages.length;
    this.pages.forEach((page, i) => {
      const pageNum = i + 1;
      const footerText = `Página ${pageNum} de ${totalPages}`;
      const footerWidth = this.fontRegular.widthOfTextAtSize(footerText, 9);

      page.drawText(footerText, {
        x: PDF_STYLES.pageSize[0] - PDF_STYLES.margin - footerWidth,
        y: PDF_STYLES.margin / 2,
        size: 9,
        font: this.fontRegular,
        color: PDF_STYLES.colors.inkMuted,
      });

      page.drawText(`Stayo — ${this.documentTitle}`, {
        x: PDF_STYLES.margin,
        y: PDF_STYLES.margin / 2,
        size: 9,
        font: this.fontRegular,
        color: PDF_STYLES.colors.inkMuted,
      });
    });

    return await this.doc.save();
  }
}
