import { createWorker } from "tesseract.js";
import type { DocumentTextExtractionRecord, OcrProvider } from "@open-practice/domain";

export class TesseractOcrProvider implements OcrProvider {
  async extractText(input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
    language: string;
  }): Promise<Pick<DocumentTextExtractionRecord, "confidence" | "extractedText" | "metadata">> {
    const worker = await createWorker(input.language);

    try {
      // tesseract.js recognize can take a Buffer or Uint8Array
      const { data } = await worker.recognize(Buffer.from(input.content));

      return {
        extractedText: data.text,
        confidence: Math.round(data.confidence),
        metadata: {
          engine: "tesseract",
          version: "5.0", // tesseract.js version/core version
          jobId: input.documentId,
        },
      };
    } finally {
      await worker.terminate();
    }
  }
}
