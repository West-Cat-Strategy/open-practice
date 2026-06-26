import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  normalizeOcrLanguage,
  type DocumentTextExtractionRecord,
  type OcrProvider,
} from "@open-practice/domain";
import { ProviderConfigurationError } from "../errors.js";

export type LocalCliOcrInputKind = "pdf" | "jpeg" | "png" | "tiff";

export interface LocalCliOcrCommandResult {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}

export interface LocalCliOcrCommandRunnerOptions {
  timeoutMs: number;
}

export type LocalCliOcrCommandRunner = (
  command: string,
  args: string[],
  options: LocalCliOcrCommandRunnerOptions,
) => Promise<LocalCliOcrCommandResult>;

export interface LocalCliOcrProviderOptions {
  ocrmyPdfPath?: string;
  tesseractPath?: string;
  timeoutSeconds?: number;
  tempDir?: string;
  runCommand?: LocalCliOcrCommandRunner;
}

const execFileAsync = promisify(execFile);
const defaultOcrmyPdfPath = "ocrmypdf";
const defaultTesseractPath = "tesseract";
const defaultTimeoutSeconds = 120;
const commandGraceMs = 10_000;

const inputExtensions: Record<LocalCliOcrInputKind, string> = {
  pdf: ".pdf",
  jpeg: ".jpg",
  png: ".png",
  tiff: ".tiff",
};

export class UnsupportedOcrInputError extends Error {
  readonly reason = "unsupported_file_type";

  constructor() {
    super("Unsupported OCR input file type");
  }
}

export function isUnsupportedOcrInputError(error: unknown): error is UnsupportedOcrInputError {
  return error instanceof UnsupportedOcrInputError;
}

function commandName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function positiveTimeoutSeconds(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }
  return defaultTimeoutSeconds;
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function defaultRunCommand(
  command: string,
  args: string[],
  options: LocalCliOcrCommandRunnerOptions,
): Promise<LocalCliOcrCommandResult> {
  return execFileAsync(command, args, {
    maxBuffer: 1024 * 1024,
    timeout: options.timeoutMs,
  });
}

function normalizeCommandOutput(value: string | Buffer | undefined): string {
  if (typeof value === "string") return value;
  return value?.toString("utf8") ?? "";
}

function commandErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return String(error);
}

function providerConfigurationError(command: string, error: unknown): ProviderConfigurationError {
  if (isNodeErrnoException(error) && error.code === "ENOENT") {
    return new ProviderConfigurationError(`${command} CLI binary is not available`);
  }
  return new ProviderConfigurationError(`${command} CLI readiness check failed`);
}

function ocrExecutionError(timeoutSeconds: number, error: unknown): Error {
  if (isNodeErrnoException(error) && error.code === "ENOENT") {
    return new ProviderConfigurationError("ocrmypdf CLI binary is not available");
  }
  const killed =
    error instanceof Error &&
    "killed" in error &&
    Boolean((error as Error & { killed?: boolean }).killed);
  if (isNodeErrnoException(error) && (error.code === "ETIMEDOUT" || killed)) {
    return new Error(`ocrmypdf timed out after ${timeoutSeconds} seconds`);
  }
  return new Error(`ocrmypdf failed: ${commandErrorMessage(error)}`);
}

export function sniffOcrInputKind(content: Uint8Array): LocalCliOcrInputKind | undefined {
  if (
    content.length >= 5 &&
    content[0] === 0x25 &&
    content[1] === 0x50 &&
    content[2] === 0x44 &&
    content[3] === 0x46 &&
    content[4] === 0x2d
  ) {
    return "pdf";
  }
  if (
    content.length >= 8 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a
  ) {
    return "png";
  }
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return "jpeg";
  }
  if (
    content.length >= 4 &&
    ((content[0] === 0x49 && content[1] === 0x49 && content[2] === 0x2a && content[3] === 0x00) ||
      (content[0] === 0x4d && content[1] === 0x4d && content[2] === 0x00 && content[3] === 0x2a))
  ) {
    return "tiff";
  }
  return undefined;
}

export async function assertLocalCliOcrReadiness(
  options: LocalCliOcrProviderOptions = {},
): Promise<void> {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const ocrmyPdfPath = commandName(options.ocrmyPdfPath, defaultOcrmyPdfPath);
  const tesseractPath = commandName(options.tesseractPath, defaultTesseractPath);
  const timeoutMs = 15_000;

  try {
    await runCommand(ocrmyPdfPath, ["--version"], { timeoutMs });
  } catch (error) {
    throw providerConfigurationError("ocrmypdf", error);
  }

  let languageOutput: string;
  try {
    const result = await runCommand(tesseractPath, ["--list-langs"], { timeoutMs });
    languageOutput = [normalizeCommandOutput(result.stdout), normalizeCommandOutput(result.stderr)]
      .join("\n")
      .trim();
  } catch (error) {
    throw providerConfigurationError("tesseract", error);
  }

  const languages = new Set(
    languageOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  if (!languages.has("eng")) {
    throw new ProviderConfigurationError("tesseract eng language data is not installed");
  }
}

export class LocalCliOcrProvider implements OcrProvider {
  private readonly ocrmyPdfPath: string;
  private readonly timeoutSeconds: number;
  private readonly tempDir?: string;
  private readonly runCommand: LocalCliOcrCommandRunner;

  constructor(options: LocalCliOcrProviderOptions = {}) {
    this.ocrmyPdfPath = commandName(options.ocrmyPdfPath, defaultOcrmyPdfPath);
    this.timeoutSeconds = positiveTimeoutSeconds(options.timeoutSeconds);
    this.tempDir = options.tempDir?.trim() || undefined;
    this.runCommand = options.runCommand ?? defaultRunCommand;
  }

  async extractText(input: {
    firmId: string;
    documentId: string;
    content: Uint8Array;
    language: string;
  }): Promise<Pick<DocumentTextExtractionRecord, "confidence" | "extractedText" | "metadata">> {
    const language = normalizeOcrLanguage(input.language);
    const inputKind = sniffOcrInputKind(input.content);
    if (!inputKind) throw new UnsupportedOcrInputError();

    const root = await mkdtemp(path.join(this.tempDir ?? tmpdir(), "open-practice-ocr-"));
    const sourcePath = path.join(root, `source${inputExtensions[inputKind]}`);
    const sidecarPath = path.join(root, "sidecar.txt");
    const outputPath = path.join(root, "output.pdf");
    const timeoutSeconds = this.timeoutSeconds;
    const commandTimeoutMs = timeoutSeconds * 1000 + commandGraceMs;

    try {
      await writeFile(sourcePath, Buffer.from(input.content));
      await this.runCommand(
        this.ocrmyPdfPath,
        [
          "--skip-text",
          "--output-type",
          "none",
          "--sidecar",
          sidecarPath,
          "--language",
          language,
          "--jobs",
          "1",
          "--tesseract-timeout",
          String(timeoutSeconds),
          sourcePath,
          outputPath,
        ],
        { timeoutMs: commandTimeoutMs },
      );
      const extractedText = await readFile(sidecarPath, "utf8");
      return {
        extractedText,
        metadata: {
          engine: "ocrmypdf",
          provider: "local_cli",
          ocrEngine: "tesseract",
          inputKind,
          language,
          textLength: extractedText.length,
          confidenceAvailable: false,
          skipText: true,
          outputType: "none",
          jobs: 1,
          tesseractTimeoutSeconds: timeoutSeconds,
          shellInterpolation: false,
        },
      };
    } catch (error) {
      throw ocrExecutionError(timeoutSeconds, error);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
