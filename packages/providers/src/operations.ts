import type {
  AiTriageProvider,
  DocumentTextExtractionRecord,
  InboundEmailParser,
  MailSender,
  MediaDerivativeRecord,
  MediaProcessor,
  MediaTranscriptRecord,
  OcrProvider,
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
  async extractText(_input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
    language: string;
  }): Promise<Pick<DocumentTextExtractionRecord, "confidence" | "extractedText" | "metadata">> {
    throw disabled("OCR");
  }
}

export class DisabledTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
  }): Promise<Pick<MediaTranscriptRecord, "text" | "metadata">> {
    throw disabled("Transcription");
  }
}

export class DisabledMediaProcessor implements MediaProcessor {
  async createDerivatives(_input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
  }): Promise<MediaDerivativeRecord[]> {
    throw disabled("Media processor");
  }
}
