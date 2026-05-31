import type {
  AiTriageProvider,
  DocumentTextExtractionRecord,
  InboundEmailParser,
  MailSender,
  MediaDerivativeRecord,
  MediaProcessor,
  MediaTranscriptRecord,
  OcrProvider,
  PaymentProcessorProvider,
  TranscriptionProvider,
} from "@open-practice/domain";
import { ProviderConfigurationError } from "./errors.js";

function disabled(feature: string): ProviderConfigurationError {
  return new ProviderConfigurationError(`${feature} provider is not configured`);
}

export class DisabledMailSender implements MailSender {
  async send(): Promise<{ providerMessageId?: string }> {
    throw disabled("Mail sender");
  }
}

export class DisabledInboundEmailParser implements InboundEmailParser {
  async parse(): Promise<Awaited<ReturnType<InboundEmailParser["parse"]>>> {
    throw disabled("Inbound email parser");
  }
}

export class DisabledAiTriageProvider implements AiTriageProvider {
  async triage(): Promise<Awaited<ReturnType<AiTriageProvider["triage"]>>> {
    throw disabled("AI triage");
  }
}

export class DisabledOcrProvider implements OcrProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async extractText(_: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
    language: string;
  }): Promise<Pick<DocumentTextExtractionRecord, "confidence" | "extractedText" | "metadata">> {
    throw disabled("OCR");
  }
}

export class DisabledTranscriptionProvider implements TranscriptionProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(_: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
  }): Promise<Pick<MediaTranscriptRecord, "text" | "metadata">> {
    throw disabled("Transcription");
  }
}

export class DisabledMediaProcessor implements MediaProcessor {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createDerivatives(_: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
  }): Promise<MediaDerivativeRecord[]> {
    throw disabled("Media processor");
  }
}

export class DisabledPaymentProcessorProvider implements PaymentProcessorProvider {
  async createCheckoutSession(): Promise<
    Awaited<ReturnType<PaymentProcessorProvider["createCheckoutSession"]>>
  > {
    throw disabled("Payment processor");
  }
}
