import { z } from "zod";
import { ApiHttpError } from "../http/response.js";

export const deliveryConfirmationSchema = z.object({
  confirmed: z.boolean(),
  channel: z.string().min(1),
  recipientCount: z.coerce.number().int().min(0),
});

export type DeliveryConfirmation = z.infer<typeof deliveryConfirmationSchema>;

export function requireEmailDeliveryConfirmation(
  confirmation: DeliveryConfirmation | undefined,
  expected: { recipientCount: number },
): void {
  if (!confirmation || confirmation.confirmed !== true) {
    throw new ApiHttpError(
      400,
      "SEND_CONFIRMATION_REQUIRED",
      "Confirm recipient delivery before sending email",
    );
  }

  if (confirmation.channel !== "email" || confirmation.recipientCount !== expected.recipientCount) {
    throw new ApiHttpError(
      400,
      "SEND_CONFIRMATION_MISMATCH",
      "Send confirmation does not match the email delivery request",
      { expectedChannel: "email", expectedRecipientCount: expected.recipientCount },
    );
  }
}
