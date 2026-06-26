import { createWorker } from "tesseract.js";
import {
  normalizeOcrLanguage,
  type DocumentTextExtractionRecord,
  type OcrProvider,
} from "@open-practice/domain";

function normalizeProviderConfidence(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const normalized = value > 1 ? value / 100 : value;
  return Number(Math.min(1, Math.max(0, normalized)).toFixed(4));
}

export class TesseractOcrProvider implements OcrProvider {
  async extractText(input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
    language: string;
  }): Promise<Pick<DocumentTextExtractionRecord, "confidence" | "extractedText" | "metadata">> {
    const language = normalizeOcrLanguage(input.language);
    const worker = await createWorker(language);

    try {
      // tesseract.js recognize can take a Buffer or Uint8Array
      const { data } = await worker.recognize(Buffer.from(input.content));

      return {
        extractedText: data.text,
        confidence: normalizeProviderConfidence(data.confidence),
        metadata: {
          engine: "tesseract",
          version: "5.0", // tesseract.js version/core version
          jobId: input.documentId,
          confidenceScale: "0..1",
        },
      };
    } finally {
      await worker.terminate();
    }
  }
}
