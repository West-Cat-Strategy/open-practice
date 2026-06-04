export const allowedOcrLanguages = ["eng"] as const;

export type AllowedOcrLanguage = (typeof allowedOcrLanguages)[number];

export function isAllowedOcrLanguage(value: string): value is AllowedOcrLanguage {
  return (allowedOcrLanguages as readonly string[]).includes(value);
}

export function normalizeOcrLanguage(value: string | undefined): AllowedOcrLanguage {
  const language = value?.trim() || "eng";
  if (isAllowedOcrLanguage(language)) return language;
  throw new Error(`Unsupported OCR language: ${language}`);
}
