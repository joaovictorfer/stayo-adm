import { payoutPdfSplit, type PayoutPdfReservation } from "./pdf/payout-pdf";

/** Channel grouping is presentation-only: payment flow remains attached to each reservation. */
export function payoutChannelGroups<T extends PayoutPdfReservation>(rows: T[], feePercent: number) {
  const channels = [...new Set(["direta", "airbnb", ...rows.map(row => row.channel)])];
  return channels.map(channel => {
    const reservations = rows.filter(row => row.channel === channel);
    const complete = reservations.every(row => !row.missing_amounts?.some(key => ["gross", "cleaning", "platform_fee"].includes(key)));
    const totals = reservations.reduce((sum, row) => {
      const split = payoutPdfSplit(row, feePercent);
      return { base: sum.base + split.base, stayo: sum.stayo + split.stayo, owner: sum.owner + split.owner };
    }, { base: 0, stayo: 0, owner: 0 });
    return { channel, reservations, complete, totals };
  }).filter(group => group.reservations.length > 0 || group.channel === "direta" || group.channel === "airbnb");
}