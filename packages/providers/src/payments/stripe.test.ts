import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { StripePaymentProcessorProvider, type StripeCheckoutSessionClient } from "./stripe.js";

describe("StripePaymentProcessorProvider", () => {
  it("creates a Stripe Checkout Session without card collection in Open Practice", async () => {
    const calls: Array<{
      params: Stripe.Checkout.SessionCreateParams;
      options?: Stripe.RequestOptions;
    }> = [];
    const client: StripeCheckoutSessionClient = {
      checkout: {
        sessions: {
          async create(params, options) {
            calls.push({ params, options });
            return {
              id: "cs_test_payment_request",
              url: "https://checkout.stripe.com/c/pay/cs_test_payment_request",
              expires_at: 1_780_339_600,
              livemode: false,
              payment_status: "unpaid",
              status: "open",
            };
          },
        },
      },
    };

    const provider = new StripePaymentProcessorProvider({
      secretKey: "sk_test_synthetic",
      client,
    });
    const session = await provider.createCheckoutSession({
      firmId: "firm-west-legal",
      matterId: "matter-001",
      invoiceId: "invoice-001",
      hostedPaymentRequestId: "payment-request-001",
      amountCents: 13230,
      currency: "CAD",
      description: "Open Practice invoice INV-001",
      successUrl:
        "https://app.example.test/?paymentRequestId=payment-request-001&stripeSessionId={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.example.test/?paymentRequestId=payment-request-001",
      idempotencyKey: "hosted-payment-request:firm-west-legal:payment-request-001",
    });

    expect(session).toEqual({
      provider: "stripe",
      externalSessionId: "cs_test_payment_request",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_payment_request",
      expiresAt: "2026-06-01T18:46:40.000Z",
      evidence: {
        mode: "checkout_session",
        liveMode: false,
        paymentStatus: "unpaid",
        sessionStatus: "open",
      },
    });
    expect(calls).toEqual([
      {
        options: { idempotencyKey: "hosted-payment-request:firm-west-legal:payment-request-001" },
        params: expect.objectContaining({
          mode: "payment",
          client_reference_id: "payment-request-001",
          success_url:
            "https://app.example.test/?paymentRequestId=payment-request-001&stripeSessionId={CHECKOUT_SESSION_ID}",
          cancel_url: "https://app.example.test/?paymentRequestId=payment-request-001",
          metadata: expect.objectContaining({
            firmId: "firm-west-legal",
            matterId: "matter-001",
            invoiceId: "invoice-001",
            hostedPaymentRequestId: "payment-request-001",
          }),
          payment_intent_data: {
            metadata: expect.objectContaining({
              hostedPaymentRequestId: "payment-request-001",
            }),
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "cad",
                unit_amount: 13230,
                product_data: { name: "Open Practice invoice INV-001" },
              },
            },
          ],
        }),
      },
    ]);
  });
});
