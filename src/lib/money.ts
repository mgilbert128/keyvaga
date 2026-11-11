/** Launch currency is USD. Amounts are integers in cents everywhere. */
export const CURRENCY = "USD" as const;

const wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });

export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("Money must be an integer number of cents");
  return cents % 100 === 0 ? wholeDollars.format(cents / 100) : withCents.format(cents / 100);
}
