import { describe, expect, it } from "vitest";
import { LocalCliOcrProvider } from "@open-practice/providers/ocr/local-cli";
import { TesseractOcrProvider } from "@open-practice/providers/ocr/tesseract";
import {
  createOcrProviderFromEnv,
  validateSelectedWorkerQueueReadiness,
  workerEnvSchema,
  type WorkerEnv,
} from "./worker.js";

describe("worker OCR runtime configuration", () => {
  it("defaults to the local CLI provider with bounded timeout settings", () => {
    const env = workerEnvSchema.parse({});

    expect(env.OCR_PROVIDER).toBe("local_cli");
    expect(env.OCR_CLI_TIMEOUT_SECONDS).toBe(120);
    expect(createOcrProviderFromEnv(env)).toBeInstanceOf(LocalCliOcrProvider);
  });

  it("retains Tesseract.js only as an explicit fallback provider", () => {
    const env: WorkerEnv = {
      ...workerEnvSchema.parse({}),
      OCR_PROVIDER: "tesseract_js",
    };

    expect(createOcrProviderFromEnv(env)).toBeInstanceOf(TesseractOcrProvider);
  });

  it("runs local CLI readiness only for selected OCR queue workers", async () => {
    const env = workerEnvSchema.parse({ OCR_CLI_TIMEOUT_SECONDS: "45" });
    const readinessCalls: unknown[] = [];
    const readiness = async (options?: unknown) => {
      readinessCalls.push(options);
    };

    await validateSelectedWorkerQueueReadiness(env, ["email"], readiness);
    expect(readinessCalls).toEqual([]);

    await validateSelectedWorkerQueueReadiness(env, ["ocr"], readiness);
    expect(readinessCalls).toEqual([{ timeoutSeconds: 45, tempDir: undefined }]);

    await validateSelectedWorkerQueueReadiness(
      { ...env, OCR_PROVIDER: "tesseract_js" },
      ["ocr"],
      readiness,
    );
    expect(readinessCalls).toHaveLength(1);
  });
});
