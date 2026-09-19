const BRAZIL_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

export function normalizeBrazilPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function formatBrazilPhone(value: string): string {
  const digits = normalizeBrazilPhone(value);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${ddd}) ${number}`;
  if (number.length <= 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5, 9)}`;
}

export function isValidBrazilPhone(value: string): boolean {
  const digits = normalizeBrazilPhone(value);
  if (!BRAZIL_DDDS.has(digits.slice(0, 2))) return false;
  if (digits.length === 10) return /^[2-5]\d{7}$/.test(digits.slice(2));
  return digits.length === 11 && digits[2] === "9";
}

export function sameBrazilPhone(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const left = normalizeBrazilPhone(a);
  const right = normalizeBrazilPhone(b);
  return left.length >= 10 && left === right;
}