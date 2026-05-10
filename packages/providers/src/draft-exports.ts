import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import type {
  DraftExportBlock,
  DraftExportDocument,
  DraftExportFormat,
  DraftExportTextRun,
} from "@open-practice/domain";

export interface RenderedDraftExport {
  buffer: Buffer;
  contentType: string;
  extension: DraftExportFormat;
}

function plainText(runs: DraftExportTextRun[]): string {
  return runs.map((run) => run.text).join("");
}

function docxTextRun(run: DraftExportTextRun): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.marks.includes("bold"),
    italics: run.marks.includes("italic"),
    underline: run.marks.includes("underline") ? {} : undefined,
  });
}

function docxChildren(runs: DraftExportTextRun[]): Array<TextRun | ExternalHyperlink> {
  return runs.map((run) => {
    if (run.href && run.marks.includes("link")) {
      return new ExternalHyperlink({
        link: run.href,
        children: [docxTextRun(run)],
      });
    }
    return docxTextRun(run);
  });
}

function docxParagraph(block: DraftExportBlock): Paragraph {
  if (block.type === "heading") {
    return new Paragraph({
      heading: block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
      children: docxChildren(block.runs),
    });
  }
  if (block.type === "bullet_list_item") {
    return new Paragraph({
      bullet: { level: 0 },
      children: docxChildren(block.runs),
    });
  }
  if (block.type === "ordered_list_item") {
    return new Paragraph({
      text: `${block.order ?? 1}. ${plainText(block.runs)}`,
    });
  }
  if (block.type === "blockquote") {
    return new Paragraph({
      indent: { left: 480 },
      children: docxChildren(block.runs),
    });
  }
  return new Paragraph({ children: docxChildren(block.runs) });
}

export async function renderDraftDocx(document: DraftExportDocument): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun(document.title)],
          }),
          ...document.blocks.map(docxParagraph),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function applyPdfRunStyle(pdf: PDFKit.PDFDocument, run: DraftExportTextRun): void {
  if (run.marks.includes("bold") && run.marks.includes("italic")) {
    pdf.font("Helvetica-BoldOblique");
  } else if (run.marks.includes("bold")) {
    pdf.font("Helvetica-Bold");
  } else if (run.marks.includes("italic")) {
    pdf.font("Helvetica-Oblique");
  } else {
    pdf.font("Helvetica");
  }
}

function writePdfRuns(pdf: PDFKit.PDFDocument, runs: DraftExportTextRun[], prefix = ""): void {
  runs.forEach((run, index) => {
    applyPdfRunStyle(pdf, run);
    const text = `${index === 0 ? prefix : ""}${run.text}`;
    pdf.text(text, {
      continued: index < runs.length - 1,
      underline: run.marks.includes("underline") || run.marks.includes("link"),
      link: run.href,
    });
  });
  pdf.moveDown(0.7);
}

export async function renderDraftPdf(document: DraftExportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 54, size: "LETTER" });
    const chunks: Buffer[] = [];

    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.font("Helvetica-Bold").fontSize(18).text(document.title);
    pdf.moveDown();

    for (const block of document.blocks) {
      if (block.type === "heading") {
        pdf
          .font("Helvetica-Bold")
          .fontSize(block.level === 2 ? 14 : 16)
          .text(plainText(block.runs));
        pdf.moveDown(0.6);
        continue;
      }

      pdf.fontSize(11);
      if (block.type === "bullet_list_item") {
        writePdfRuns(pdf, block.runs, "- ");
      } else if (block.type === "ordered_list_item") {
        writePdfRuns(pdf, block.runs, `${block.order ?? 1}. `);
      } else if (block.type === "blockquote") {
        pdf.x += 18;
        writePdfRuns(pdf, block.runs);
        pdf.x -= 18;
      } else {
        writePdfRuns(pdf, block.runs);
      }
    }

    pdf.end();
  });
}

export async function renderDraftExport(input: {
  format: DraftExportFormat;
  document: DraftExportDocument;
}): Promise<RenderedDraftExport> {
  if (input.format === "docx") {
    return {
      buffer: await renderDraftDocx(input.document),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    };
  }

  return {
    buffer: await renderDraftPdf(input.document),
    contentType: "application/pdf",
    extension: "pdf",
  };
}
