import { createStaticPix, hasError } from "pix-utils";
import { z } from "zod";

export const receiptLimit = 10 * 1024 * 1024;
export const recipientSchema = z.object({ name: z.string().min(2), city: z.string().min(2), pixType: z.enum(["email", "cpf", "cnpj", "phone", "random"]), pixKey: z.string().min(1) });
export function buildPayoutPix(recipient: z.infer<typeof recipientSchema>, cents: number, id: string) {
  const r = recipientSchema.parse(recipient);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Não há saldo válido para Pix.");
  let key = r.pixKey.trim();
  if (r.pixType === "email") key = z.string().email().parse(key);
  else if (r.pixType === "cpf" || r.pixType === "cnpj") { key = key.replace(/\D/g, ""); if (key.length !== (r.pixType === "cpf" ? 11 : 14)) throw new Error("Chave Pix inválida."); }
  else if (r.pixType === "phone") { key = key.replace(/\D/g, ""); if (key.length === 10 || key.length === 11) key = `55${key}`; if (!/^55\d{10,11}$/.test(key)) throw new Error("Telefone Pix inválido."); key = `+${key}`; }
  else key = z.string().uuid().parse(key);
  const clean = (v: string, length: number) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase().slice(0, length);
  const pix = createStaticPix({ merchantName: clean(r.name, 25), merchantCity: clean(r.city, 15), pixKey: key, transactionAmount: cents / 100, txid: id.replace(/-/g, "").slice(0, 25) });
  if (hasError(pix)) throw new Error("Não foi possível gerar Pix. Confira os dados do titular.");
  return pix.toBRCode();
}
export function receiptMime(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes.length > receiptLimit) throw new Error("Comprovante deve ter até 10 MB.");
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return "image/png";
  throw new Error("Envie um comprovante PDF, JPG ou PNG válido.");
}