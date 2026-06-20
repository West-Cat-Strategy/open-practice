export const localDocumentConversionReviewProvider = "local-document-conversion-metadata" as const;
export const documentConversionReviewSummaryPosture = "op_authored_metadata_only" as const;

export interface DocumentConversionReviewProviderInput {
  sourceText?: string;
  sourceTextLength?: number;
}

export interface DocumentConversionReviewProviderCounts {
  sourceTextLength: number;
  wordCount: number;
  lineCount: number;
  nonEmptyLineCount: number;
  paragraphCount: number;
  pageBreakCount: number;
  estimatedPageCount: number;
}

export interface DocumentConversionReviewProviderMetadata {
  provider: typeof localDocumentConversionReviewProvider;
  providerStatus: "metadata_only";
  conversionReviewPosture: "ready_for_review";
  summaryPosture: typeof documentConversionReviewSummaryPosture;
  metadataOnly: true;
  reviewOnly: true;
  sourceTextLength: number;
  wordCount: number;
  lineCount: number;
  nonEmptyLineCount: number;
  paragraphCount: number;
  pageBreakCount: number;
  estimatedPageCount: number;
  counts: DocumentConversionReviewProviderCounts;
  policy: {
    metadataOnly: true;
    reviewOnly: true;
    rawOcrTextStored: false;
    rawMarkdownStored: false;
    annotationBodiesStored: false;
    chunksStored: false;
    embeddingsStored: false;
    providerPayloadsStored: false;
  };
}

function countConversionReviewMetadata(
  input: DocumentConversionReviewProviderInput,
): DocumentConversionReviewProviderCounts {
  const value = input.sourceText ?? "";
  const sourceTextLength = value.length || input.sourceTextLength || 0;
  const lines = value.length === 0 ? [] : value.split(/\r\n|\r|\n/);
  const wordCount = value.trim().length === 0 ? 0 : (value.match(/\S+/g) ?? []).length;
  const pageBreakCount = (value.match(/\f/g) ?? []).length;

  return {
    sourceTextLength,
    wordCount,
    lineCount: lines.length,
    nonEmptyLineCount: lines.filter((line) => line.trim().length > 0).length,
    paragraphCount:
      value.length === 0
        ? 0
        : value
            .split(/\n\s*\n/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean).length,
    pageBreakCount,
    estimatedPageCount:
      sourceTextLength > 0 ? Math.max(1, pageBreakCount + 1, Math.ceil(wordCount / 500)) : 0,
  };
}

export class LocalDocumentConversionReviewProvider {
  createMetadata(
    input: DocumentConversionReviewProviderInput,
  ): DocumentConversionReviewProviderMetadata {
    const counts = countConversionReviewMetadata(input);

    return {
      provider: localDocumentConversionReviewProvider,
      providerStatus: "metadata_only",
      conversionReviewPosture: "ready_for_review",
      summaryPosture: documentConversionReviewSummaryPosture,
      metadataOnly: true,
      reviewOnly: true,
      sourceTextLength: counts.sourceTextLength,
      wordCount: counts.wordCount,
      lineCount: counts.lineCount,
      nonEmptyLineCount: counts.nonEmptyLineCount,
      paragraphCount: counts.paragraphCount,
      pageBreakCount: counts.pageBreakCount,
      estimatedPageCount: counts.estimatedPageCount,
      counts,
      policy: {
        metadataOnly: true,
        reviewOnly: true,
        rawOcrTextStored: false,
        rawMarkdownStored: false,
        annotationBodiesStored: false,
        chunksStored: false,
        embeddingsStored: false,
        providerPayloadsStored: false,
      },
    };
  }
}
