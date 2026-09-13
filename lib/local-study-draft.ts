import type { GeneratedStudyPack } from "./study-schema";

export interface ExtractedChunk {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  index: number;
  label: string; // e.g. "Biology Week 4.pdf · Page 3"
  subLabel: string; // e.g. "Page 3"
  text: string;
  selected: boolean;
  pageNumber?: number;
  slideNumber?: number;
  sectionNumber?: number;
  wordCount: number;
}

export interface SourceFileEntry {
  id: string;
  fileName: string;
  fileType: "pdf" | "docx" | "pptx";
  fileSize: number;
  status: "waiting" | "reading" | "ready" | "error";
  stageText?: string;
  errorMessage?: string;
  totalChunks: number;
  totalWords: number;
  chunkType: "pages" | "slides" | "sections";
  chunks: ExtractedChunk[];
}

export interface StudyDraftPreferences {
  subject: string;
  noteStyle: "cram" | "clear" | "flashcard";
  difficulty: "easy" | "mixed" | "challenging";
}

export interface QuickRecallState {
  confidenceMap: Record<number, boolean>;
  completed: boolean;
}

export interface StudyDraft {
  userId: string;
  sources: SourceFileEntry[];
  preferences: StudyDraftPreferences;
  generatedStudyPack?: GeneratedStudyPack;
  reviewFlags?: string[];
  quickRecallState?: QuickRecallState;
  savedPackId?: string;
  updatedAt: string;
}


const DB_NAME = "StudySnapDrafts";
const STORE_NAME = "drafts";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

export async function saveStudyDraft(draft: StudyDraft): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(draft);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Failed to save draft"));
      tx.oncomplete = () => db.close();
    });
  } catch (error) {
    console.warn("Failed to persist draft to IndexedDB:", error);
  }
}

export async function getStudyDraft(userId: string): Promise<StudyDraft | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(userId);

      request.onsuccess = () => {
        const res = request.result;
        if (!res) {
          resolve(null);
          return;
        }

        // Backward compatibility migration for older single-file drafts
        if (res.sources && Array.isArray(res.sources)) {
          resolve(res as StudyDraft);
        } else if (res.fileName && res.chunks) {
          const singleSourceId = `src_legacy_${Date.now()}`;
          const rawChunks = res.chunks as Array<{
            id?: string;
            label?: string;
            text?: string;
            selected?: boolean;
            pageNumber?: number;
            slideNumber?: number;
            sectionNumber?: number;
            wordCount?: number;
          }>;

          const migratedChunks: ExtractedChunk[] = rawChunks.map((c, i) => ({
            id: c.id || `${singleSourceId}_c_${i}`,
            sourceFileId: singleSourceId,
            sourceFileName: res.fileName,
            index: i,
            label: c.label?.includes("·") ? c.label : `${res.fileName} · ${c.label || `Part ${i + 1}`}`,
            subLabel: c.label || `Part ${i + 1}`,
            text: c.text || "",
            selected: c.selected ?? true,
            pageNumber: c.pageNumber,
            slideNumber: c.slideNumber,
            sectionNumber: c.sectionNumber,
            wordCount: c.wordCount || (c.text ? c.text.trim().split(/\s+/).length : 0),
          }));

          const migratedSource: SourceFileEntry = {
            id: singleSourceId,
            fileName: res.fileName,
            fileType: res.fileType || "pdf",
            fileSize: res.fileSize || 0,
            status: "ready",
            totalChunks: migratedChunks.length,
            totalWords: res.totalWords || migratedChunks.reduce((acc, c) => acc + c.wordCount, 0),
            chunkType: res.chunkType || "pages",
            chunks: migratedChunks,
          };

          const migratedDraft: StudyDraft = {
            userId: res.userId,
            sources: [migratedSource],
            preferences: res.preferences || {
              subject: "General",
              noteStyle: "clear",
              difficulty: "mixed",
            },
            updatedAt: res.updatedAt || new Date().toISOString(),
          };
          resolve(migratedDraft);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error || new Error("Failed to load draft"));
      tx.oncomplete = () => db.close();
    });
  } catch (error) {
    console.warn("Failed to load draft from IndexedDB:", error);
    return null;
  }
}

export async function deleteStudyDraft(userId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(userId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Failed to delete draft"));
      tx.oncomplete = () => db.close();
    });
  } catch (error) {
    console.warn("Failed to delete draft from IndexedDB:", error);
  }
}

export async function saveGeneratedPackToDraft(
  userId: string,
  pack: GeneratedStudyPack
): Promise<void> {
  try {
    const existing = await getStudyDraft(userId);
    if (!existing) return;
    const updated: StudyDraft = {
      ...existing,
      generatedStudyPack: pack,
      reviewFlags: existing.reviewFlags || [],
      updatedAt: new Date().toISOString(),
    };
    await saveStudyDraft(updated);
  } catch (error) {
    console.warn("Failed to save generated pack to draft:", error);
  }
}

export async function updateDraftReviewFlags(
  userId: string,
  flags: string[]
): Promise<void> {
  try {
    const existing = await getStudyDraft(userId);
    if (!existing) return;
    const updated: StudyDraft = {
      ...existing,
      reviewFlags: flags,
      updatedAt: new Date().toISOString(),
    };
    await saveStudyDraft(updated);
  } catch (error) {
    console.warn("Failed to update review flags in draft:", error);
  }
}

export async function updateDraftRecallState(
  userId: string,
  state: QuickRecallState
): Promise<void> {
  try {
    const existing = await getStudyDraft(userId);
    if (!existing) return;
    const updated: StudyDraft = {
      ...existing,
      quickRecallState: state,
      updatedAt: new Date().toISOString(),
    };
    await saveStudyDraft(updated);
  } catch (error) {
    console.warn("Failed to update recall state in draft:", error);
  }
}

export async function updateDraftSavedPackId(
  userId: string,
  savedPackId: string
): Promise<void> {
  try {
    const existing = await getStudyDraft(userId);
    if (!existing) return;
    const updated: StudyDraft = {
      ...existing,
      savedPackId,
      updatedAt: new Date().toISOString(),
    };
    await saveStudyDraft(updated);
  } catch (error) {
    console.warn("Failed to update savedPackId in draft:", error);
  }
}

