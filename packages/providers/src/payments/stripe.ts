import Stripe from "stripe";
import type {
  PaymentProcessorCheckoutSession,
  PaymentProcessorCheckoutSessionInput,
  PaymentProcessorProvider,
} from "@open-practice/domain";
import { ProviderResponseError } from "../errors.js";

export interface StripeCheckoutSessionClient {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options?: Stripe.RequestOptions,
      ): Promise<
        Pick<
          Stripe.Checkout.Session,
          "expires_at" | "id" | "livemode" | "payment_status" | "status" | "url"
        >
      >;
    };
  };
}

export interface StripePaymentProcessorConfig {
  secretKey: string;
  client?: StripeCheckoutSessionClient;
}

function metadata(input: PaymentProcessorCheckoutSessionInput): Record<string, string> {
  return {
    firmId: input.firmId,
    matterId: input.matterId,
    invoiceId: input.invoiceId,
    hostedPaymentRequestId: input.hostedPaymentRequestId,
    ...(input.metadata ?? {}),
  };
}

export class StripePaymentProcessorProvider implements PaymentProcessorProvider {
  private readonly client: StripeCheckoutSessionClient;

  constructor(config: StripePaymentProcessorConfig) {
    this.client = config.client ?? new Stripe(config.secretKey);
  }

  async createCheckoutSession(
    input: PaymentProcessorCheckoutSessionInput,
  ): Promise<PaymentProcessorCheckoutSession> {
    const requestMetadata = metadata(input);
    try {
      const session = await this.client.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: input.hostedPaymentRequestId,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: requestMetadata,
          payment_intent_data: {
            metadata: requestMetadata,
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.amountCents,
                product_data: {
                  name: input.description,
                },
              },
            },
          ],
        },
        { idempotencyKey: input.idempotencyKey },
      );

      if (!session.url) {
        throw new ProviderResponseError("Stripe checkout session did not include a checkout URL");
      }

      return {
        provider: "stripe",
        externalSessionId: session.id,
        checkoutUrl: session.url,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : undefined,
        evidence: {
          mode: "checkout_session",
          liveMode: session.livemode,
          paymentStatus: session.payment_status,
          sessionStatus: session.status,
        },
      };
    } catch (error) {
      if (error instanceof ProviderResponseError) throw error;
      throw new ProviderResponseError(
        error instanceof Error ? error.message : "Stripe checkout session creation failed",
      );
    }
  }
}
