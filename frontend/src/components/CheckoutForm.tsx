import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { FormEvent, useState } from "react";

type Props = {
  email: string;
  reference: string;
  onSuccess: (reference: string) => void;
};

export default function CheckoutForm({ email, reference, onSuccess }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setLoading(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success/pending`,
        receipt_email: email,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(reference);
    }
    setLoading(false);
  }

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <h2>Payment details</h2>
      <p className="secure-note">Payments are secured and encrypted</p>
      <PaymentElement />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={!stripe || loading}>
        {loading ? "Processing…" : "Book and pay"}
      </button>
    </form>
  );
}
