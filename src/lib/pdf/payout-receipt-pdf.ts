import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Private receipt bytes are appended locally and never published. */
export async function validateReceiptDocument(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf") {
    const doc = await PDFDocument.load(bytes);
    if (!doc.getPageCount()) throw new Error("Comprovante sem páginas.");
  } else {
    const doc = await PDFDocument.create();
    if (mime === "image/png") await doc.embedPng(bytes); else await doc.embedJpg(bytes);
  }
}
export async function appendPayoutReceipts(report: Uint8Array, receipts: { name: string; mime: string; bytes: Uint8Array }[], ink: [number,number,number]) {
  const doc = await PDFDocument.load(report);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const receipt of receipts) {
    if (receipt.mime === "application/pdf") {
      const source = await PDFDocument.load(receipt.bytes);
      const pages = await doc.copyPages(source, source.getPageIndices());
      pages.forEach(page => doc.addPage(page));
    } else {
      const page = doc.addPage([595.28,841.89]);
      page.drawText("ANEXO - COMPROVANTE DE PAGAMENTO", { x:27,y:800,size:13,font,color:rgb(...ink) });
      const image = receipt.mime === "image/png" ? await doc.embedPng(receipt.bytes) : await doc.embedJpg(receipt.bytes);
      const size = image.scaleToFit(541,730);
      page.drawImage(image,{x:(595.28-size.width)/2,y:40+(730-size.height)/2,width:size.width,height:size.height});
    }
  }
  return doc.save();
}