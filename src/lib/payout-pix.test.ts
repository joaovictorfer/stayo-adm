import { describe, expect, it } from "vitest";
import { parsePix, hasError } from "pix-utils";
import { buildPayoutPix, receiptMime, receiptLimit } from "./payout-pix";
const recipient = { name:"Márcia Regina Nunes Villanova", city:"Porto Alegre", pixType:"email" as const, pixKey:"villanova@mprs.mp.br" };
describe("Pix do repasse",()=>{
  it("encodes exactly R$ 1.760,00 and the saved recipient key",()=>{
    const parsed = parsePix(buildPayoutPix(recipient,176000,"12345678-1234-1234-1234-123456789012"));
    expect(hasError(parsed)).toBe(false);
    if(hasError(parsed)) throw new Error("Pix inválido");
    expect(parsed).toMatchObject({transactionAmount:1760,pixKey:"villanova@mprs.mp.br"});
  });
  it.each([0,-1,1.5])("blocks invalid balance %s",value=>{expect(()=>buildPayoutPix(recipient,value,"id")).toThrow();});
  it("blocks missing or invalid recipient key",()=>{expect(()=>buildPayoutPix({...recipient,pixKey:""},100,"id")).toThrow();expect(()=>buildPayoutPix({...recipient,pixKey:"invalid"},100,"id")).toThrow();});
  it("retains cent precision",()=>{expect(parsePix(buildPayoutPix(recipient,281976,"id"))).toMatchObject({transactionAmount:2819.76});});
  it("requires a real supported file signature",()=>{expect(receiptMime(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");expect(()=>receiptMime(new TextEncoder().encode("fake receipt"))).toThrow();});
  it("blocks receipts above 10 MB",()=>{expect(()=>receiptMime(new Uint8Array(receiptLimit+1))).toThrow();});
});