import { describe, expect, it } from "vitest";
import { parsePix, hasError } from "pix-utils";
import { buildPayoutPix, payoutPixReference, receiptMime, receiptLimit } from "./payout-pix";
const recipient = { name:"Márcia Regina Nunes Villanova", city:"Porto Alegre", pixType:"email" as const, pixKey:"villanova@mprs.mp.br" };
describe("Pix do repasse",()=>{
  it("identifies the apartment, statement month and payment request in the Pix payload",()=>{
    const reference = { property: "Vêneto C203", unit: "C203", competence: "2026-10" };
    expect(parsePix(buildPayoutPix(recipient,176000,"12345678-1234-1234-1234-123456789012",reference))).toMatchObject({ txid: "REPC2032026101234567812", infoAdicional: "REPASSE VENETO C203 2026-10 REF 1234567812", transactionAmount:1760 });
  });
  it("respects the 25-character Pix identifier limit and distinguishes requests",()=>{
    const reference = {property:"Ravena B406",unit:"APARTAMENTO406",competence:"2026-10"};
    expect(payoutPixReference("12345678-1234",reference).txid).toHaveLength(25);
    expect(payoutPixReference("12345678-1234",reference).txid).not.toBe(payoutPixReference("87654321-1234",reference).txid);
  });
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