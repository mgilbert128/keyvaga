import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessPortal } from "@/lib/auth/roles";
import { formatRate } from "@/lib/tax-calc";
import { taxReportFor } from "@/lib/tax-report";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const dollars = (c: number) => (c / 100).toFixed(2);

/** CSV of the monthly tax report, for the CPA. Admin only. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.roles, "admin")) return new Response("Not allowed", { status: 403 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  const report = await taxReportFor(month);
  if (!report) return new Response("Use ?month=YYYY-MM", { status: 400 });
  const lines = [
    ["Month", "Filed by", "State", "City", "Tax", "Rate", "Stays", "Taxable amount (USD)", "Tax collected (USD)"],
    ...report.rows.map((r) => [report.label, r.filedBy === "KEYVAGA" ? "Keyvaga" : "Owner", r.state, r.city || "(state-wide)", r.name, formatRate(r.ratePpm), r.stays, dollars(r.taxableCents), dollars(r.taxCents)]),
  ];
  return new Response(lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="keyvaga-lodging-tax-${month}.csv"`, "cache-control": "no-store" },
  });
}
