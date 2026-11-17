import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { addTaxRate, deleteTaxRate, setTaxRateActive } from "@/app/actions/taxes";
import { PortalShell } from "@/components/layout/PortalShell";
import { adminNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { formatCents } from "@/lib/money";
import { formatRate, ratesForPlace } from "@/lib/tax-calc";
import { taxReportFor } from "@/lib/tax-report";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Lodging taxes" };

export default function Page({ searchParams }: PageProps<"/admin/taxes">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Taxes searchParams={searchParams} />
    </Suspense>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

async function Taxes({ searchParams }: { searchParams: PageProps<"/admin/taxes">["searchParams"] }) {
  await connection();
  const user = await requirePortal("admin", "/admin/taxes");
  const sp = await searchParams;
  const today = todayIn();
  const thisMonth = today.toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(str(sp.month) ?? "") ? str(sp.month)! : thisMonth;

  const [rates, listings, report] = await Promise.all([
    db.taxRate.findMany({ orderBy: [{ state: "asc" }, { city: "asc" }, { name: "asc" }] }),
    db.listing.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, city: true, region: true }, orderBy: { title: "asc" } }),
    taxReportFor(month),
  ]);
  const activeRates = rates.filter((r) => r.active);
  const uncovered = listings.filter((l) => ratesForPlace(activeRates, l).length === 0);
  const error = str(sp.error)?.slice(0, 200);
  const saved = str(sp.saved)?.slice(0, 200);
  const totals = report ? { keyvaga: report.rows.filter((r) => r.filedBy === "KEYVAGA").reduce((s, r) => s + r.taxCents, 0), owner: report.rows.filter((r) => r.filedBy === "OWNER").reduce((s, r) => s + r.taxCents, 0) } : null;

  return (
    <PortalShell portal="Admin" user={user} nav={adminNav("/admin/taxes")}>
      <div className="flex flex-col gap-8 pt-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Lodging taxes</h1>
          <p className="max-w-3xl text-ink-muted">
            Enter the lodging tax rates for each area where you have listings. Guests pay them at checkout, on nights plus cleaning
            (Keyvaga&apos;s fees are never taxed). Rates marked <strong>Keyvaga files</strong> stay with Keyvaga for you to send to the tax
            office; rates marked <strong>Owner files</strong> are added to the owner&apos;s payout for them to report and pay. Check rates and
            who files each one with your CPA.
          </p>
        </div>

        {error ? <p role="alert" className="rounded-control border border-danger px-4 py-3 font-medium text-danger">{error}</p> : null}
        {saved ? <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{saved}</p> : null}

        {uncovered.length ? (
          <div className="flex flex-col gap-2 rounded-card bg-warn-soft p-6 text-on-warn-soft">
            <h2 className="text-xl font-bold">Listings with no tax rates yet ({uncovered.length})</h2>
            <p>Guests booking these aren&apos;t charged any lodging tax until you add rates for their state or town.</p>
            <ul className="list-disc pl-6">
              {uncovered.map((l) => <li key={l.id}>{l.title}: {l.city}, {l.region}</li>)}
            </ul>
          </div>
        ) : null}

        <section aria-labelledby="rates-title" className="flex flex-col gap-4">
          <h2 id="rates-title" className="text-2xl font-bold">Tax rates</h2>
          {rates.length === 0 ? (
            <p className="text-ink-muted">No rates yet. Add your first one below.</p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-line bg-surface">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-ink-muted">
                  <tr><th className="p-3">Area</th><th className="p-3">Tax</th><th className="p-3">Rate</th><th className="p-3">Who files</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} className={`border-b border-line last:border-0 ${r.active ? "" : "text-ink-muted"}`}>
                      <td className="p-3">{r.city ? `${r.city}, ${r.state}` : `${r.state} (state-wide)`}</td>
                      <td className="p-3">{r.name}{r.notes ? <span className="block text-xs text-ink-muted">{r.notes}</span> : null}</td>
                      <td className="p-3 font-semibold">{formatRate(r.ratePpm)}</td>
                      <td className="p-3">{r.filedBy === "KEYVAGA" ? "Keyvaga files" : "Owner files"}</td>
                      <td className="p-3">{r.active ? "Active" : "Off"}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <form action={setTaxRateActive.bind(null, r.id, !r.active)}><Button type="submit" variant="ghost">{r.active ? "Turn off" : "Turn on"}</Button></form>
                          <form action={deleteTaxRate.bind(null, r.id)}><Button type="submit" variant="ghost">Delete</Button></form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm text-ink-muted">Changes apply to new bookings. Existing bookings keep the taxes they were charged.</p>
        </section>

        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Add a tax rate</h2>
          <form action={addTaxRate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="State" id="state" required placeholder="AL" hint="Two-letter code or full name." />
            <Field label="Town (optional)" id="city" placeholder="Gulf Shores" hint="Leave empty for a state-wide tax. For a county tax, add it for each town in that county." />
            <Field label="Tax name" id="name" required placeholder="Gulf Shores lodging tax" hint="Shown on guest receipts and the tax report." />
            <Field label="Rate (%)" id="rate" required inputMode="decimal" placeholder="4.5" />
            <div className="flex flex-col gap-2">
              <label htmlFor="filedBy" className="text-sm font-semibold text-ink">Who files it</label>
              <select id="filedBy" name="filedBy" className={`${inputClass} appearance-auto`} defaultValue="KEYVAGA">
                <option value="KEYVAGA">Keyvaga files (kept for you to remit)</option>
                <option value="OWNER">Owner files (added to the owner&apos;s payout)</option>
              </select>
            </div>
            <Field label="Notes (optional)" id="notes" placeholder="Filed monthly with Alabama ONE SPOT" />
            <div className="md:col-span-2"><Button type="submit">Add rate</Button></div>
          </form>
        </Card>

        <section aria-labelledby="report-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="report-title" className="text-2xl font-bold">Monthly tax report</h2>
              <p className="text-ink-muted">Tax collected for stays checking in during the month. Cancelled stays count only for tax that wasn&apos;t refunded.</p>
            </div>
            <form className="flex items-end gap-2" action="/admin/taxes">
              <div className="flex flex-col gap-2">
                <label htmlFor="month" className="text-sm font-semibold">Month</label>
                <input id="month" name="month" type="month" defaultValue={month} className={inputClass} />
              </div>
              <Button type="submit" variant="secondary">Show</Button>
            </form>
          </div>
          {report && report.rows.length ? (
            <>
              <div className="overflow-x-auto rounded-card border border-line bg-surface">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-line text-ink-muted">
                    <tr><th className="p-3">Who files</th><th className="p-3">Area</th><th className="p-3">Tax</th><th className="p-3">Rate</th><th className="p-3 text-right">Stays</th><th className="p-3 text-right">Taxable amount</th><th className="p-3 text-right">Tax collected</th></tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={`${r.filedBy}${r.state}${r.city}${r.name}${r.ratePpm}`} className="border-b border-line last:border-0">
                        <td className="p-3">{r.filedBy === "KEYVAGA" ? "Keyvaga" : "Owner"}</td>
                        <td className="p-3">{r.city ? `${r.city}, ${r.state}` : `${r.state} (state-wide)`}</td>
                        <td className="p-3">{r.name}</td>
                        <td className="p-3">{formatRate(r.ratePpm)}</td>
                        <td className="p-3 text-right">{r.stays}</td>
                        <td className="p-3 text-right">{formatCents(r.taxableCents)}</td>
                        <td className="p-3 text-right font-semibold">{formatCents(r.taxCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totals ? (
                <p className="text-ink-muted">
                  <strong className="text-ink">Keyvaga to remit: {formatCents(totals.keyvaga)}</strong> · Passed to owners to file: {formatCents(totals.owner)}
                </p>
              ) : null}
              <a href={`/admin/taxes/report.csv?month=${month}`} className="self-start font-semibold text-brand underline underline-offset-4">Download {report.label} as a spreadsheet (CSV)</a>
            </>
          ) : (
            <p className="text-ink-muted">No lodging tax collected for {report?.label ?? month}.</p>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
