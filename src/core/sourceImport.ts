
export type Authorship = "original" | "revised" | "ai-assisted";
export type WritingFormat = "email" | "essay" | "plan" | "other";
export type SourceStatus = "unprocessed" | "approved" | "excluded" | "evaluation";
export type ParagraphDecision = "included" | "excluded";

export interface ParagraphRecord {
  id: string;
  text: string;
  decision: ParagraphDecision;
}

export interface ImportPreview {
  filename: string;
  type: "txt" | "md" | "docx";
  size: number;
  hash: string;
  paragraphs: ParagraphRecord[];
  warnings: string[];
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export interface NormalizedSource {
  id: string;
  text: string;
  paragraphs: string[];
  hash: string;
}

export interface WritingSource {
  id: string;
  title: string;
  authorship: Authorship;
  format: WritingFormat;
  status: SourceStatus;
  paragraphs: string[];
  paragraphDecisions: ParagraphRecord[];
  voiceArea: string;
  hash: string;
  createdAt: string;
}

function fnv1a64(input: string): string {
  let upper = 0x1a2b3c4d;
  let lower = 0x84222325;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    upper = Math.imul(upper ^ (code & 0xff), 0x01000193) >>> 0;
    lower = Math.imul(lower ^ (code >>> 8), 0x01000193) >>> 0;
  }

  return `${upper.toString(16).padStart(8, "0")}${lower.toString(16).padStart(8, "0")}`;
}

export function normalizeText(raw: string): NormalizedSource {
  const paragraphs = raw
    .split(/\r?\n\s*\r?\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const text = paragraphs.join("\n\n");
  const hash = fnv1a64(text);
  const id = `src_${hash.slice(0, 18)}`;

  return { id, text, paragraphs, hash };
}

function paragraphRecords(paragraphs: string[]): ParagraphRecord[] {
  return paragraphs.map((text, index) => ({
    id: `p_${fnv1a64(text).slice(0, 14)}_${index + 1}`,
    text,
    decision: "included",
  }));
}

export async function importWritingFile(file: File): Promise<ImportPreview> {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "txt" && extension !== "md" && extension !== "docx") {
    throw new Error("Unsupported writing file. Choose a .txt, .md, or .docx file.");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`Writing file is too large (maximum ${MAX_IMPORT_BYTES} bytes).`);
  }

  let raw: string;
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    raw = result.value;
  } else {
    raw = await file.text();
  }
  const normalized = normalizeText(raw);
  if (!normalized.text) throw new Error("Writing file is empty or contains no readable text.");

  return {
    filename: file.name,
    type: extension,
    size: file.size,
    hash: normalized.hash,
    paragraphs: paragraphRecords(normalized.paragraphs),
    warnings: [],
  };
}

export function isDuplicateText(raw: string, seen: string[]): boolean {
  const normalized = normalizeText(raw).text.toLowerCase();
  return seen.some((value) => normalizeText(value).text.toLowerCase() === normalized);
}

export function createSource(
  raw: string,
  metadata: {
    title?: string;
    authorship?: Authorship;
    format?: WritingFormat;
  } = {},
): WritingSource {
  const normalized = normalizeText(raw);
  if (!normalized.text) {
    throw new Error("Writing source cannot be empty.");
  }

  return {
    id: normalized.id,
    title: metadata.title?.trim() || `Source ${normalized.hash.slice(0, 6)}`,
    authorship: metadata.authorship ?? "original",
    format: metadata.format ?? "other",
    status: "unprocessed",
    paragraphs: normalized.paragraphs,
    paragraphDecisions: paragraphRecords(normalized.paragraphs),
    voiceArea: "general guidance",
    hash: normalized.hash,
    createdAt: new Date().toISOString(),
  };
}
