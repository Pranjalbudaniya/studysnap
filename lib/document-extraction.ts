import type { ExtractedChunk, SourceFileEntry } from "./local-study-draft";

export interface ExtractionResult {
  fileName: string;
  fileType: "pdf" | "docx" | "pptx";
  fileSize: number;
  totalChunks: number;
  totalWords: number;
  chunkType: "pages" | "slides" | "sections";
  chunks: ExtractedChunk[];
  isVeryLong: boolean;
}

export type ExtractionErrorCode =
  | "unsupported_format"
  | "file_too_large"
  | "empty_document"
  | "password_protected"
  | "scan_only"
  | "short_text"
  | "corrupt_file";

export class ExtractionError extends Error {
  code: ExtractionErrorCode;
  actionTitle?: string;

  constructor(code: ExtractionErrorCode, message: string, actionTitle?: string) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
    this.actionTitle = actionTitle;
  }
}

export const MAX_FILES_PER_PACK = 5;
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB
export const MIN_TOTAL_WORDS = 25;
export const VERY_LONG_WORDS_THRESHOLD = 8000;

export interface FileValidationResult {
  accepted: File[];
  rejected: Array<{ fileName: string; reason: string }>;
}

/** Validate incoming files against multi-file constraints */
export function validateIncomingFiles(
  incomingFiles: File[],
  currentSources: Array<{ fileName: string; fileSize: number; lastModified?: number }>
): FileValidationResult {
  const accepted: File[] = [];
  const rejected: Array<{ fileName: string; reason: string }> = [];

  let currentCount = currentSources.length;
  let currentTotalSize = currentSources.reduce((acc, s) => acc + s.fileSize, 0);

  for (const file of incomingFiles) {
    const fileName = file.name || "Lecture Document";
    const ext = fileName.split(".").pop()?.toLowerCase();

    // 1. Check max 5 files
    if (currentCount >= MAX_FILES_PER_PACK) {
      rejected.push({
        fileName,
        reason: "A study pack can include up to 5 files. Remove one to add another.",
      });
      continue;
    }

    // 2. Check duplicate (name + size + timestamp)
    const isDuplicate = currentSources.some(
      (s) =>
        s.fileName === fileName &&
        s.fileSize === file.size &&
        (s.lastModified === undefined || s.lastModified === file.lastModified)
    ) || accepted.some(
      (a) =>
        a.name === fileName &&
        a.size === file.size &&
        a.lastModified === file.lastModified
    );

    if (isDuplicate) {
      rejected.push({
        fileName,
        reason: "This file is already in your study pack.",
      });
      continue;
    }

    // 3. Check unsupported format
    if (!ext || !["pdf", "docx", "pptx"].includes(ext)) {
      rejected.push({
        fileName,
        reason: "This file type is not supported. Try a PDF, DOCX, or PPTX.",
      });
      continue;
    }

    // 4. Check per-file size (25 MB)
    if (file.size > MAX_FILE_SIZE) {
      rejected.push({
        fileName,
        reason: "This file is larger than 25 MB. Choose a smaller copy.",
      });
      continue;
    }

    // 5. Check total study-pack size (50 MB)
    if (currentTotalSize + file.size > MAX_TOTAL_SIZE) {
      rejected.push({
        fileName,
        reason: "Adding this file would exceed the 50 MB study-pack limit.",
      });
      continue;
    }

    // Accepted
    accepted.push(file);
    currentCount++;
    currentTotalSize += file.size;
  }

  return { accepted, rejected };
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(str: string): number {
  const matches = str.match(/[\w'-]+/g);
  return matches ? matches.length : 0;
}

/** Extract text from PDF using pdfjs-dist in the browser */
async function extractPdf(
  sourceId: string,
  file: File,
  onProgress?: (stage: string) => void
): Promise<{ chunks: ExtractedChunk[]; chunkType: "pages" }> {
  onProgress?.("Reading document");

  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  }

  const arrayBuffer = await file.arrayBuffer();

  let pdfDoc;
  try {
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string };
    if (
      errorObj?.name === "PasswordException" ||
      errorObj?.message?.toLowerCase().includes("password")
    ) {
      throw new ExtractionError(
        "password_protected",
        "This PDF can’t be read here. Remove protection or upload another copy."
      );
    }
    throw new ExtractionError(
      "corrupt_file",
      "This PDF can’t be read here. Remove protection or upload another copy."
    );
  }

  onProgress?.("Finding lecture text");

  const numPages = pdfDoc.numPages;
  if (numPages === 0) {
    throw new ExtractionError(
      "empty_document",
      "No study text was found in this file."
    );
  }

  const chunks: ExtractedChunk[] = [];
  let totalCharacters = 0;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);

    const pageRawText = cleanText(pageStrings.join(" "));
    const pageWords = countWords(pageRawText);
    totalCharacters += pageRawText.length;

    if (pageRawText.length > 0) {
      chunks.push({
        id: `${sourceId}_p_${i}`,
        sourceFileId: sourceId,
        sourceFileName: file.name,
        index: i,
        label: `${file.name} · Page ${i}`,
        subLabel: `Page ${i}`,
        text: pageRawText,
        selected: true,
        pageNumber: i,
        wordCount: pageWords,
      });
    }
  }

  // Scan-only detection
  if (totalCharacters < 15 || chunks.length === 0) {
    throw new ExtractionError(
      "scan_only",
      "No selectable text found. This privacy-first version does not use OCR."
    );
  }

  onProgress?.("Preparing material");
  return { chunks, chunkType: "pages" };
}

/** Extract text from DOCX using mammoth */
async function extractDocx(
  sourceId: string,
  file: File,
  onProgress?: (stage: string) => void
): Promise<{ chunks: ExtractedChunk[]; chunkType: "sections" }> {
  onProgress?.("Reading document");

  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();

  let result;
  try {
    result = await mammoth.extractRawText({ arrayBuffer });
  } catch {
    throw new ExtractionError(
      "corrupt_file",
      "We had trouble reading that document. Your file was not uploaded."
    );
  }

  onProgress?.("Finding lecture text");

  const rawText = cleanText(result.value || "");
  if (!rawText || rawText.length < 15) {
    throw new ExtractionError(
      "empty_document",
      "No study text was found in this file."
    );
  }

  const paragraphs = rawText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: ExtractedChunk[] = [];
  let currentChunkText = "";
  let sectionIndex = 1;

  for (const para of paragraphs) {
    if (currentChunkText.length > 0 && (currentChunkText.length + para.length > 1200)) {
      chunks.push({
        id: `${sourceId}_s_${sectionIndex}`,
        sourceFileId: sourceId,
        sourceFileName: file.name,
        index: sectionIndex,
        label: `${file.name} · Section ${sectionIndex}`,
        subLabel: `Section ${sectionIndex}`,
        text: currentChunkText.trim(),
        selected: true,
        sectionNumber: sectionIndex,
        wordCount: countWords(currentChunkText),
      });
      sectionIndex++;
      currentChunkText = para;
    } else {
      currentChunkText = currentChunkText
        ? `${currentChunkText}\n\n${para}`
        : para;
    }
  }

  if (currentChunkText.trim()) {
    chunks.push({
      id: `${sourceId}_s_${sectionIndex}`,
      sourceFileId: sourceId,
      sourceFileName: file.name,
      index: sectionIndex,
      label: `${file.name} · Section ${sectionIndex}`,
      subLabel: `Section ${sectionIndex}`,
      text: currentChunkText.trim(),
      selected: true,
      sectionNumber: sectionIndex,
      wordCount: countWords(currentChunkText),
    });
  }

  onProgress?.("Preparing material");
  return { chunks, chunkType: "sections" };
}

/** Extract text from PPTX using JSZip and browser XML DOMParser */
async function extractPptx(
  sourceId: string,
  file: File,
  onProgress?: (stage: string) => void
): Promise<{ chunks: ExtractedChunk[]; chunkType: "slides" }> {
  onProgress?.("Reading document");

  const JSZip = (await import("jszip")).default;
  const arrayBuffer = await file.arrayBuffer();

  let zip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    throw new ExtractionError(
      "corrupt_file",
      "We had trouble reading that document. Your file was not uploaded."
    );
  }

  onProgress?.("Finding lecture text");

  const slideEntries: { name: string; slideNumber: number }[] = [];
  const slideRegex = /ppt\/slides\/slide(\d+)\.xml/i;

  zip.forEach((relativePath) => {
    const match = relativePath.match(slideRegex);
    if (match) {
      slideEntries.push({
        name: relativePath,
        slideNumber: parseInt(match[1], 10),
      });
    }
  });

  if (slideEntries.length === 0) {
    throw new ExtractionError(
      "empty_document",
      "No study text was found in this file."
    );
  }

  slideEntries.sort((a, b) => a.slideNumber - b.slideNumber);

  const parser = new DOMParser();
  const chunks: ExtractedChunk[] = [];
  let totalCharacters = 0;

  for (let idx = 0; idx < slideEntries.length; idx++) {
    const entry = slideEntries[idx];
    const xmlContent = await zip.file(entry.name)?.async("text");
    if (!xmlContent) continue;

    try {
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      const textNodes = xmlDoc.getElementsByTagName("a:t");
      const slideStrings: string[] = [];

      for (let j = 0; j < textNodes.length; j++) {
        const txt = textNodes[j]?.textContent?.trim();
        if (txt) slideStrings.push(txt);
      }

      const slideText = cleanText(slideStrings.join(" "));
      const slideWords = countWords(slideText);
      totalCharacters += slideText.length;

      if (slideText.length > 0) {
        chunks.push({
          id: `${sourceId}_sl_${idx + 1}`,
          sourceFileId: sourceId,
          sourceFileName: file.name,
          index: idx + 1,
          label: `${file.name} · Slide ${idx + 1}`,
          subLabel: `Slide ${idx + 1}`,
          text: slideText,
          selected: true,
          slideNumber: idx + 1,
          wordCount: slideWords,
        });
      }
    } catch {
      // Ignore single malformed slide
    }
  }

  if (totalCharacters < 15 || chunks.length === 0) {
    throw new ExtractionError(
      "empty_document",
      "No study text was found in this file."
    );
  }

  onProgress?.("Preparing material");
  return { chunks, chunkType: "slides" };
}

/** Extract single source file locally with source ID tagging */
export async function extractSingleSourceLocally(
  sourceId: string,
  file: File,
  onProgress?: (stage: string) => void
): Promise<{
  fileName: string;
  fileType: "pdf" | "docx" | "pptx";
  fileSize: number;
  totalChunks: number;
  totalWords: number;
  chunkType: "pages" | "slides" | "sections";
  chunks: ExtractedChunk[];
}> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ExtractionError(
      "file_too_large",
      "This file is larger than 25 MB. Choose a smaller copy."
    );
  }

  const name = file.name || "Lecture Document";
  const extension = name.split(".").pop()?.toLowerCase();

  let extractedData: {
    chunks: ExtractedChunk[];
    chunkType: "pages" | "slides" | "sections";
  };

  if (extension === "pdf") {
    extractedData = await extractPdf(sourceId, file, onProgress);
  } else if (extension === "docx") {
    extractedData = await extractDocx(sourceId, file, onProgress);
  } else if (extension === "pptx") {
    extractedData = await extractPptx(sourceId, file, onProgress);
  } else {
    throw new ExtractionError(
      "unsupported_format",
      "This file type is not supported. Try a PDF, DOCX, or PPTX."
    );
  }

  const totalWords = extractedData.chunks.reduce(
    (acc, chunk) => acc + chunk.wordCount,
    0
  );

  if (totalWords < MIN_TOTAL_WORDS) {
    throw new ExtractionError(
      "short_text",
      "There isn’t enough readable material here to create a useful study pack."
    );
  }

  return {
    fileName: name,
    fileType: extension as "pdf" | "docx" | "pptx",
    fileSize: file.size,
    totalChunks: extractedData.chunks.length,
    totalWords,
    chunkType: extractedData.chunkType,
    chunks: extractedData.chunks,
  };
}

