import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { GUEST_FEE_PERCENT, HOST_FEE_PERCENT } from "@/lib/earnings";
import { KeepCalculator } from "./KeepCalculator";

/** Homepage "Simple, fair fees" section with the owner calculator. */
export function FeesSection() {
  return (
    <section aria-labelledby="fees-title" className="flex flex-col gap-6">
      <div className="flex max-w-3xl flex-col gap-2">
        <h2 id="fees-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Simple, fair fees</h2>
        <p className="text-lg text-ink-muted">One small fee on each side. No listing fees, no monthly fees, no surprises at checkout.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <p className="text-5xl font-bold tracking-tight text-brand">{GUEST_FEE_PERCENT}%</p>
          <h3 className="text-xl font-bold">For guests</h3>
          <p className="text-ink-muted">A {GUEST_FEE_PERCENT}% service fee, shown in the price before you book. The total you see is the total you pay.</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <p className="text-5xl font-bold tracking-tight text-brand">{100 - HOST_FEE_PERCENT}%</p>
          <h3 className="text-xl font-bold">Owners keep</h3>
          <p className="text-ink-muted">Keyvaga keeps just {HOST_FEE_PERCENT}% of each booking. Listing your property is free. <Link href="/list-your-property" className="font-semibold text-brand underline underline-offset-4">List your property</Link></p>
        </Card>
      </div>
      <h3 id="keep-title" className="text-xl font-bold sm:text-2xl">What you&apos;d keep</h3>
      <KeepCalculator />
    </section>
  );
}
