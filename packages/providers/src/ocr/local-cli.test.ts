import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProviderConfigurationError } from "../errors.js";
import {
  LocalCliOcrProvider,
  UnsupportedOcrInputError,
  assertLocalCliOcrReadiness,
  sniffOcrInputKind,
  type LocalCliOcrCommandRunner,
} from "./local-cli.js";

const pdfBytes = new TextEncoder().encode("%PDF-1.7\nSynthetic PDF body");
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const tiffBytes = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x00]);

describe("LocalCliOcrProvider", () => {
  it("extracts PDF sidecar text with execFile-style arguments and cleans up temp files", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "open-practice-ocr-test-"));
    const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];
    const runner: LocalCliOcrCommandRunner = async (command, args, options) => {
      calls.push({ command, args, timeoutMs: options.timeoutMs });
      const sidecarPath = args[args.indexOf("--sidecar") + 1];
      expect(sidecarPath).toBeTruthy();
      await writeFile(sidecarPath!, "Synthetic sidecar text from PDF.");
      return { stdout: "", stderr: "" };
    };
    const provider = new LocalCliOcrProvider({
      tempDir,
      timeoutSeconds: 30,
      runCommand: runner,
    });

    const result = await provider.extractText({
      firmId: "firm-west-legal",
      documentId: "doc-pdf",
      content: pdfBytes,
      language: "eng",
    });

    expect(result).toEqual({
      extractedText: "Synthetic sidecar text from PDF.",
      metadata: expect.objectContaining({
        engine: "ocrmypdf",
        provider: "local_cli",
        ocrEngine: "tesseract",
        inputKind: "pdf",
        language: "eng",
        textLength: "Synthetic sidecar text from PDF.".length,
        confidenceAvailable: false,
        shellInterpolation: false,
        tesseractTimeoutSeconds: 30,
      }),
    });
    expect(result).not.toHaveProperty("confidence");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: "ocrmypdf",
      timeoutMs: 40_000,
    });
    expect(calls[0]?.args).toEqual([
      "--skip-text",
      "--output-type",
      "none",
      "--sidecar",
      expect.stringMatching(/sidecar\.txt$/),
      "--language",
      "eng",
      "--jobs",
      "1",
      "--tesseract-timeout",
      "30",
      expect.stringMatching(/source\.pdf$/),
      expect.stringMatching(/output\.pdf$/),
    ]);
    expect(calls[0]?.args).not.toContain("Synthetic sidecar text from PDF.");
    await expect(readdir(tempDir)).resolves.toEqual([]);
  });

  it("extracts image sidecar text after sniffing PNG bytes", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "open-practice-ocr-image-test-"));
    const sourcePaths: string[] = [];
    const provider = new LocalCliOcrProvider({
      tempDir,
      runCommand: async (_command, args) => {
        sourcePaths.push(args.at(-2) ?? "");
        const sidecarPath = args[args.indexOf("--sidecar") + 1];
        await writeFile(sidecarPath!, "Synthetic image OCR text.");
        return {};
      },
    });

    const result = await provider.extractText({
      firmId: "firm-west-legal",
      documentId: "doc-image",
      content: pngBytes,
      language: "eng",
    });

    expect(result.extractedText).toBe("Synthetic image OCR text.");
    expect(result.metadata).toMatchObject({ inputKind: "png", engine: "ocrmypdf" });
    expect(sourcePaths).toEqual([expect.stringMatching(/source\.png$/)]);
    await expect(readdir(tempDir)).resolves.toEqual([]);
  });

  it("rejects unsupported input without invoking the CLI", async () => {
    const calls: unknown[] = [];
    const provider = new LocalCliOcrProvider({
      runCommand: async () => {
        calls.push("called");
        return {};
      },
    });

    await expect(
      provider.extractText({
        firmId: "firm-west-legal",
        documentId: "doc-text",
        content: new TextEncoder().encode("plain text"),
        language: "eng",
      }),
    ).rejects.toBeInstanceOf(UnsupportedOcrInputError);
    expect(calls).toEqual([]);
  });

  it("surfaces missing OCRmyPDF binaries as provider configuration errors", async () => {
    const provider = new LocalCliOcrProvider({
      runCommand: async () => {
        throw Object.assign(new Error("spawn ocrmypdf ENOENT"), { code: "ENOENT" });
      },
    });

    await expect(
      provider.extractText({
        firmId: "firm-west-legal",
        documentId: "doc-pdf",
        content: pdfBytes,
        language: "eng",
      }),
    ).rejects.toThrow("ocrmypdf CLI binary is not available");
  });

  it("reports OCRmyPDF timeouts without retaining temp files", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "open-practice-ocr-timeout-test-"));
    const provider = new LocalCliOcrProvider({
      tempDir,
      timeoutSeconds: 5,
      runCommand: async () => {
        throw Object.assign(new Error("operation timed out"), {
          code: "ETIMEDOUT",
          killed: true,
        });
      },
    });

    await expect(
      provider.extractText({
        firmId: "firm-west-legal",
        documentId: "doc-pdf",
        content: pdfBytes,
        language: "eng",
      }),
    ).rejects.toThrow("ocrmypdf timed out after 5 seconds");
    await expect(readdir(tempDir)).resolves.toEqual([]);
  });

  it("checks OCRmyPDF, Tesseract, and eng language data for readiness", async () => {
    const commands: string[] = [];
    await assertLocalCliOcrReadiness({
      runCommand: async (command, args) => {
        commands.push(`${command} ${args.join(" ")}`);
        if (command === "tesseract") return { stdout: "List of available languages:\neng\nosd\n" };
        return { stdout: "ocrmypdf 16.0.0" };
      },
    });

    expect(commands).toEqual(["ocrmypdf --version", "tesseract --list-langs"]);

    await expect(
      assertLocalCliOcrReadiness({
        runCommand: async (command) => {
          if (command === "tesseract") return { stdout: "List of available languages:\nosd\n" };
          return { stdout: "ocrmypdf 16.0.0" };
        },
      }),
    ).rejects.toThrow("tesseract eng language data is not installed");

    await expect(
      assertLocalCliOcrReadiness({
        runCommand: async () => {
          throw Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
        },
      }),
    ).rejects.toBeInstanceOf(ProviderConfigurationError);
  });

  it("sniffs all supported OCR input magic bytes", () => {
    expect(sniffOcrInputKind(pdfBytes)).toBe("pdf");
    expect(sniffOcrInputKind(pngBytes)).toBe("png");
    expect(sniffOcrInputKind(jpegBytes)).toBe("jpeg");
    expect(sniffOcrInputKind(tiffBytes)).toBe("tiff");
    expect(sniffOcrInputKind(new Uint8Array([0x00, 0x01, 0x02]))).toBeUndefined();
  });
});
