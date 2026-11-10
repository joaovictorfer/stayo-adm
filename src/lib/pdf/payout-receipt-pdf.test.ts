import { expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendPayoutReceipts } from "./payout-receipt-pdf";
it("appends every original PDF receipt page after the report",async()=>{
  const report=await PDFDocument.create();report.addPage([595,842]);
  const receipt=await PDFDocument.create();receipt.addPage([300,400]);receipt.addPage([400,500]);
  const result=await PDFDocument.load(await appendPayoutReceipts(await report.save(),[{name:"receipt.pdf",mime:"application/pdf",bytes:await receipt.save()}],[0,0,0]));
  expect(result.getPageCount()).toBe(3);
  expect(result.getPages().map(p=>p.getSize())).toEqual([{width:595,height:842},{width:300,height:400},{width:400,height:500}]);
});
it("does not silently omit an unreadable receipt",async()=>{
  const report=await PDFDocument.create();report.addPage();
  await expect(appendPayoutReceipts(await report.save(),[{name:"broken.pdf",mime:"application/pdf",bytes:new Uint8Array([1,2,3])}],[0,0,0])).rejects.toThrow();
});