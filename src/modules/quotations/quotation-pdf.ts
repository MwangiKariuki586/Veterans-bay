import type { QuotationDetail, QuotationVersion } from "./types";

type PdfLine = { text: string; strong?: boolean };

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 48;
const LINE_HEIGHT = 14;
const LINES_PER_PAGE = 50;

export function createQuotationPdf(
  quotation: QuotationDetail,
): Uint8Array<ArrayBuffer> {
  const version = quotation.versions.find(
    (item) => item.versionNumber === quotation.currentVersionNumber,
  );
  if (!version) {
    throw new Error("Quotation current-version invariant violated.");
  }

  return buildPdf(quotationLines(quotation, version));
}

function quotationLines(
  quotation: QuotationDetail,
  version: QuotationVersion,
): PdfLine[] {
  const lines: PdfLine[] = [
    { text: "VETERANS BAY", strong: true },
    { text: "FORMAL QUOTATION", strong: true },
    { text: `Quotation ${quotation.id}  |  Version ${version.versionNumber}` },
    { text: `Professional: ${quotation.providerName}` },
    { text: `Client: ${quotation.clientName}` },
    { text: `Service: ${quotation.requestCategory}` },
    { text: `Status: ${quotation.status.replaceAll("_", " ")}` },
    { text: "" },
    { text: "PRICE BREAKDOWN", strong: true },
  ];

  for (const item of version.lineItems) {
    lines.push(
      ...wrapLine(
        `${item.description} | ${titleCase(item.category)} | Qty ${item.quantity} | ${formatMoney(item.totalMinor, version.currency)}`,
      ),
    );
  }

  lines.push(
    { text: "" },
    { text: `Subtotal: ${formatMoney(version.subtotalMinor, version.currency)}` },
    { text: `Discount: ${formatMoney(version.discountMinor, version.currency)}` },
    { text: `Tax: ${formatMoney(version.taxMinor, version.currency)}` },
    { text: `Total: ${formatMoney(version.totalMinor, version.currency)}`, strong: true },
    { text: `Deposit: ${formatMoney(version.depositMinor, version.currency)}` },
    { text: "" },
    { text: "TIMING", strong: true },
    { text: `Expected duration: ${version.expectedDurationMinutes} minutes` },
    {
      text: `Proposed start: ${version.proposedStartAt ? formatDate(version.proposedStartAt) : "To be agreed"}`,
    },
    {
      text: `Valid until: ${version.validUntil ? formatDate(version.validUntil) : "Not set"}`,
    },
  );

  addSection(lines, "SCOPE", version.scope);
  addSection(lines, "EXCLUSIONS", version.exclusions);
  addSection(lines, "WARRANTY TERMS", version.warrantyTerms);
  addSection(lines, "PAYMENT TERMS", version.paymentTerms);
  lines.push(
    { text: "" },
    {
      text: "This document reflects the current preserved quotation version in Veterans Bay.",
    },
  );
  return lines;
}

function addSection(lines: PdfLine[], title: string, value: string) {
  lines.push({ text: "" }, { text: title, strong: true }, ...wrapLine(value));
}

function wrapLine(value: string, width = 76): PdfLine[] {
  const paragraphs = value.split(/\r?\n/);
  const result: PdfLine[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      result.push({ text: "" });
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > width && line) {
        result.push({ text: line });
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) result.push({ text: line });
  }
  return result;
}

function buildPdf(lines: PdfLine[]): Uint8Array<ArrayBuffer> {
  const pages = chunk(lines, LINES_PER_PAGE);
  const fontId = 3 + pages.length * 2;
  const strongFontId = fontId + 1;
  const objects = new Map<number, string>();
  const pageIds = pages.map((_, index) => 3 + index * 2);

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = pageStream(pageLines);
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${strongFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.set(
      contentId,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

  objects.set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(
    strongFontId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );

  const objectCount = strongFontId;
  let pdf = "%PDF-1.4\n% Veterans Bay quotation\n";
  const offsets = [0];
  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= objectCount; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function pageStream(lines: PdfLine[]) {
  const commands = [
    "BT",
    `/F1 10 Tf`,
    `${PAGE_MARGIN} ${PAGE_HEIGHT - PAGE_MARGIN} Td`,
    `${LINE_HEIGHT} TL`,
  ];
  for (const line of lines) {
    commands.push(`/${line.strong ? "F2" : "F1"} 10 Tf`);
    commands.push(`(${escapePdfText(line.text)}) Tj`);
    commands.push("T*");
  }
  commands.push("ET");
  return commands.join("\n");
}

function escapePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
