"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { buttonClass } from "@/components/ui/Button";

type Props = { publishableKey: string; clientSecret: string; bookingId: string; amountLabel: string; holdExpiresAt: string | null };

/** Card details are entered in Stripe's secure fields; Keyvaga's servers never see card numbers. */
export function PaymentForm(props: Props) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#0f5e52", colorText: "#1c2a27", borderRadius: "10px", fontFamily: "Inter, system-ui, sans-serif", fontSizeBase: "16px" },
        },
      }}
    >
      <Inner {...props} />
    </Elements>
  );
}

function Inner({ bookingId, amountLabel, holdExpiresAt }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const holdTime = holdExpiresAt ? new Date(holdExpiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/trips/${bookingId}?paid=1` },
    });
    // Only reached if the payment failed or needs fixing; on success Stripe redirects to the trip page.
    setError(error?.message ?? "Payment didn't go through. Please check your details and try again.");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p role="alert" className="font-medium text-danger">{error}</p> : null}
      <button type="submit" disabled={!stripe || busy} className={buttonClass("primary", "w-full")}>
        {busy ? "Processing…" : `Pay ${amountLabel}`}
      </button>
      {holdTime ? <p className="text-center text-sm text-ink-muted">We&apos;re holding these dates for you until {holdTime}.</p> : null}
    </form>
  );
}
