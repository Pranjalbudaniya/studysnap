"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  validateIncomingFiles,
  extractSingleSourceLocally,
  ExtractionError,
  MAX_FILES_PER_PACK,
  VERY_LONG_WORDS_THRESHOLD,
} from "../lib/document-extraction";
import {
  saveStudyDraft,
  getStudyDraft,
  deleteStudyDraft,
  type StudyDraft,
  type SourceFileEntry,
  type ExtractedChunk,
  type StudyDraftPreferences,
} from "../lib/local-study-draft";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";

interface MaterialImporterProps {
  userId?: string;
}

interface InFlightFile {
  file: File;
  sourceId: string;
}

const SUBJECT_OPTIONS = [
  "General",
  "Biology",
  "History",
  "Computer Science",
  "Law",
  "Medicine",
  "Other",
];

const NOTE_STYLES: { id: "cram" | "clear" | "flashcard"; label: string }[] = [
  { id: "cram", label: "Exam cram" },
  { id: "clear", label: "Clear explanations" },
  { id: "flashcard", label: "Flashcard-like" },
];

const DIFFICULTIES: { id: "easy" | "mixed" | "challenging"; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "mixed", label: "Mixed" },
  { id: "challenging", label: "Challenging" },
];

export function MaterialImporter({ userId: propUserId }: MaterialImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  // User context
  const [currentUserId, setCurrentUserId] = useState<string>(propUserId || "guest");

  // Step: "upload" | "focus"
  const [step, setStep] = useState<"upload" | "focus">("upload");

  // Multi-file source entries
  const [sources, setSources] = useState<SourceFileEntry[]>([]);
  // In-memory file references for active extraction/retry
  const fileRefs = useRef<Map<string, File>>(new Map());

  // In-flight extraction queue state
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Focus view source filter
  const [activeSourceFilter, setActiveSourceFilter] = useState<string>("all");

  // Preferences
  const [preferences, setPreferences] = useState<StudyDraftPreferences>({
    subject: "General",
    noteStyle: "clear",
    difficulty: "mixed",
  });

  // Errors, Notices, and Toasts
  const [rejectedFilesNotices, setRejectedFilesNotices] = useState<
    Array<{ fileName: string; reason: string }>
  >([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 4000);
  };

  // Determine user ID on client
  useEffect(() => {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        const uid = data.user?.id || "guest";
        setCurrentUserId(uid);
      });
    }
  }, []);

  // Silently restore existing local draft in IndexedDB
  const checkExistingDraft = useCallback(async (uid: string) => {
    try {
      const draft = await getStudyDraft(uid);
      if (draft && draft.sources && draft.sources.length > 0) {
        setSources(draft.sources);
        if (draft.preferences) {
          setPreferences(draft.preferences);
        }
      }
    } catch {
      // Silently continue with empty state
    }
  }, []);

  useEffect(() => {
    if (currentUserId) {
      checkExistingDraft(currentUserId);
    }
  }, [currentUserId, checkExistingDraft]);

  // Helper to persist active draft
  const persistDraft = async (updatedSources: SourceFileEntry[], prefs: StudyDraftPreferences) => {
    if (!currentUserId) return;
    const draft: StudyDraft = {
      userId: currentUserId,
      sources: updatedSources,
      preferences: prefs,
      updatedAt: new Date().toISOString(),
    };
    await saveStudyDraft(draft);
  };

  // Helper: Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Process incoming files
  const processIncomingFiles = async (fileList: FileList | File[]) => {
    setRejectedFilesNotices([]);
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const validation = validateIncomingFiles(
      incoming,
      sources.map((s) => ({
        fileName: s.fileName,
        fileSize: s.fileSize,
        lastModified: fileRefs.current.get(s.id)?.lastModified,
      }))
    );

    if (validation.rejected.length > 0) {
      setRejectedFilesNotices(validation.rejected);
    }

    if (validation.accepted.length === 0) {
      return;
    }

    // Create placeholder entries for accepted files
    const newEntries: SourceFileEntry[] = validation.accepted.map((file) => {
      const sourceId = `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      fileRefs.current.set(sourceId, file);
      const ext = file.name.split(".").pop()?.toLowerCase() as "pdf" | "docx" | "pptx";
      return {
        id: sourceId,
        fileName: file.name,
        fileType: ext || "pdf",
        fileSize: file.size,
        status: "waiting",
        stageText: "Waiting in queue",
        totalChunks: 0,
        totalWords: 0,
        chunkType: ext === "pptx" ? "slides" : ext === "docx" ? "sections" : "pages",
        chunks: [],
      };
    });

    const combinedSources = [...sources, ...newEntries];
    setSources(combinedSources);

    // Run sequential extraction on all waiting entries
    extractQueue(combinedSources, newEntries.map((e) => ({ file: fileRefs.current.get(e.id)!, sourceId: e.id })));
  };

  // Sequential extraction queue executor
  const extractQueue = async (
    currentList: SourceFileEntry[],
    queue: InFlightFile[]
  ) => {
    if (queue.length === 0 || isExtracting) return;
    setIsExtracting(true);

    let activeSources = [...currentList];

    for (const item of queue) {
      const sourceId = item.sourceId;
      const file = item.file;

      // Update status to reading
      activeSources = activeSources.map((s) =>
        s.id === sourceId
          ? { ...s, status: "reading", stageText: "Reading document" }
          : s
      );
      setSources(activeSources);

      try {
        const result = await extractSingleSourceLocally(
          sourceId,
          file,
          (stage) => {
            setSources((prev) =>
              prev.map((s) =>
                s.id === sourceId ? { ...s, stageText: stage } : s
              )
            );
          }
        );

        activeSources = activeSources.map((s) =>
          s.id === sourceId
            ? {
                ...s,
                status: "ready",
                stageText: undefined,
                errorMessage: undefined,
                totalChunks: result.totalChunks,
                totalWords: result.totalWords,
                chunkType: result.chunkType,
                chunks: result.chunks,
              }
            : s
        );
        setSources(activeSources);
        await persistDraft(activeSources, preferences);
      } catch (err: unknown) {
        let errorMsg = "We couldn’t read this file.";
        if (err instanceof ExtractionError) {
          errorMsg = err.message;
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }

        activeSources = activeSources.map((s) =>
          s.id === sourceId
            ? {
                ...s,
                status: "error",
                stageText: undefined,
                errorMessage: errorMsg,
                totalChunks: 0,
                totalWords: 0,
                chunks: [],
              }
            : s
        );
        setSources(activeSources);
        await persistDraft(activeSources, preferences);
      }
    }

    setIsExtracting(false);
  };

  // Retry an individual failed file
  const handleRetryFile = (sourceId: string) => {
    const file = fileRefs.current.get(sourceId);
    if (!file) {
      showToast("Please re-select the file to retry.");
      return;
    }

    const updated = sources.map((s) =>
      s.id === sourceId
        ? { ...s, status: "waiting" as const, stageText: "Waiting in queue", errorMessage: undefined }
        : s
    );
    setSources(updated);
    extractQueue(updated, [{ file, sourceId }]);
  };

  // Remove an individual file from study pack
  const handleRemoveSource = async (sourceId: string) => {
    fileRefs.current.delete(sourceId);
    const updated = sources.filter((s) => s.id !== sourceId);
    setSources(updated);
    if (activeSourceFilter === sourceId) {
      setActiveSourceFilter("all");
    }
    await persistDraft(updated, preferences);
    showToast("Source file removed.");
  };

  // Clear all files
  const handleClearAll = async () => {
    fileRefs.current.clear();
    setSources([]);
    setRejectedFilesNotices([]);
    setConfirmClearAll(false);
    setActiveSourceFilter("all");
    setStep("upload");
    if (currentUserId) {
      await deleteStudyDraft(currentUserId);
    }
    showToast("Cleared all files.");
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  // Chunk selection toggles
  const toggleChunk = async (chunkId: string) => {
    const updatedSources = sources.map((src) => ({
      ...src,
      chunks: src.chunks.map((c) =>
        c.id === chunkId ? { ...c, selected: !c.selected } : c
      ),
    }));
    setSources(updatedSources);
    await persistDraft(updatedSources, preferences);
  };

  const selectAllChunks = async () => {
    const updatedSources = sources.map((src) => ({
      ...src,
      chunks: src.chunks.map((c) => ({ ...c, selected: true })),
    }));
    setSources(updatedSources);
    await persistDraft(updatedSources, preferences);
  };

  const deselectAllChunks = async () => {
    const updatedSources = sources.map((src) => ({
      ...src,
      chunks: src.chunks.map((c) => ({ ...c, selected: false })),
    }));
    setSources(updatedSources);
    await persistDraft(updatedSources, preferences);
  };

  // Update preferences
  const updatePreference = async <K extends keyof StudyDraftPreferences>(
    key: K,
    value: StudyDraftPreferences[K]
  ) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    await persistDraft(sources, updated);
  };

  // Discard draft completely
  const handleDiscardCurrentDraft = async () => {
    await handleClearAll();
  };

  // Derived state
  const readySources = sources.filter((s) => s.status === "ready");
  const failedSources = sources.filter((s) => s.status === "error");
  const readingSources = sources.filter(
    (s) => s.status === "reading" || s.status === "waiting"
  );

  const allChunks = readySources.flatMap((s) => s.chunks);
  const selectedChunks = allChunks.filter((c) => c.selected);

  // Filtered chunks for display
  const displayedChunks =
    activeSourceFilter === "all"
      ? allChunks
      : readySources.find((s) => s.id === activeSourceFilter)?.chunks || [];

  const totalWordsCombined = readySources.reduce((acc, s) => acc + s.totalWords, 0);
  const isVeryLongCombined = totalWordsCombined > VERY_LONG_WORDS_THRESHOLD;

  // Ready sources with selected chunks count for CTA
  const readySourcesWithSelection = readySources.filter((s) =>
    s.chunks.some((c) => c.selected)
  );
  const readySourceCount = readySourcesWithSelection.length;

  // Queue summary string
  const totalPagesOrSectionsCount = readySources.reduce((acc, s) => acc + s.totalChunks, 0);
  const queueSummaryText = `${sources.length} of ${MAX_FILES_PER_PACK} files added · ${totalPagesOrSectionsCount} pages/sections · ${totalWordsCombined.toLocaleString()} words`;

  return (
    <div className="material-importer-container">
      {/* Toast banner */}
      {toastMessage && (
        <div className="workspace-toast" role="status" aria-live="polite">
          <svg
            className="toast-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="8" />
            <line x1="10" y1="7" x2="10" y2="11" />
            <circle cx="10" cy="14" r="0.75" fill="currentColor" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Stepper Indicator */}
      <div className="importer-stepper" aria-label="Study pack setup progress">
        <div className={`stepper-item ${step === "upload" ? "active" : "completed"}`}>
          <span className="stepper-number">1</span>
          <span className="stepper-label">Upload</span>
        </div>
        <div className="stepper-divider" />
        <div className={`stepper-item ${step === "focus" ? "active" : ""}`}>
          <span className="stepper-number">2</span>
          <span className="stepper-label">Focus</span>
        </div>
        <div className="stepper-divider" />
        <div className="stepper-item">
          <span className="stepper-number">3</span>
          <span className="stepper-label">Study</span>
        </div>
      </div>

      {/* ====================================================================
          1. UPLOAD & QUEUE STEP
          ==================================================================== */}
      {step === "upload" && (
        <div className="importer-upload-step">
          {/* Header */}
          <div className="workspace-header">
            <div className="eyebrow-chip">
              <span className="eyebrow-dot" aria-hidden="true" />
              <span>New study pack</span>
            </div>
            <h1 className="workspace-heading">Build a study pack from your material.</h1>
            <p className="workspace-description">
              Add lecture notes, slides, or readings. Combine up to 5 files into one focused study pack.
            </p>
          </div>

          {/* Rejected Files Notices (if any validation errors occurred) */}
          {rejectedFilesNotices.length > 0 && (
            <div className="importer-error-card" role="alert">
              <svg
                className="error-card-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="8" />
                <line x1="12" y1="8" x2="8" y2="12" />
                <line x1="8" y1="8" x2="12" y2="12" />
              </svg>
              <div className="error-card-body">
                <h2 className="error-card-title">File Notice</h2>
                <div className="rejected-items-list">
                  {rejectedFilesNotices.map((rej, idx) => (
                    <div key={idx} className="rejected-item-row">
                      <span className="rejected-file-name">{rej.fileName}:</span>{" "}
                      <span className="rejected-reason">{rej.reason}</span>
                    </div>
                  ))}
                </div>
                <div className="error-card-actions">
                  <button
                    type="button"
                    className="btn-error-cancel"
                    onClick={() => setRejectedFilesNotices([])}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Drop Zone (Shown when files count < 5 or when queue is empty) */}
          {sources.length < MAX_FILES_PER_PACK && (
            <div className="upload-drop-zone-wrapper">
              <div
                className={`file-drop-zone ${isDragOver ? "drag-over" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Upload lecture files drag and drop zone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx"
                  multiple
                  className="hidden-file-input"
                  onChange={(e) => {
                    if (e.target.files) {
                      processIncomingFiles(e.target.files);
                      e.target.value = "";
                    }
                  }}
                  style={{ display: "none" }}
                />

                <div className="drop-icon-wrapper" aria-hidden="true">
                  <svg
                    className="drop-svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 12 15 15" />
                  </svg>
                </div>

                <div className="drop-main-text">
                  Drop files here, or browse from your device.
                </div>

                <div className="supported-chips-row">
                  <span className="type-chip">PDF · DOCX · PPTX · Up to 5 files</span>
                </div>
              </div>

              {/* Understated Helper Text */}
              <div className="upload-helper-caption">
                PDF · DOCX · PPTX · Up to 5 files · Max 25 MB per file (50 MB total)
              </div>
            </div>
          )}

          {/* Source File Queue (When at least 1 file has been added) */}
          {sources.length > 0 && (
            <div className="source-queue-section">
              {/* Top Queue Controls & Summary */}
              <div className="queue-header-bar">
                <div className="queue-summary-group">
                  <h2 className="queue-title">Source Files</h2>
                  <span className="queue-summary-pill">{queueSummaryText}</span>
                </div>

                <div className="queue-action-buttons">
                  {sources.length < MAX_FILES_PER_PACK && (
                    <>
                      <input
                        ref={additionalFileInputRef}
                        type="file"
                        accept=".pdf,.docx,.pptx"
                        multiple
                        className="hidden-file-input"
                        onChange={(e) => {
                          if (e.target.files) {
                            processIncomingFiles(e.target.files);
                            e.target.value = "";
                          }
                        }}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        className="btn-queue-add"
                        onClick={() => additionalFileInputRef.current?.click()}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="8" y1="3" x2="8" y2="13" />
                          <line x1="3" y1="8" x2="13" y2="8" />
                        </svg>
                        <span>Add more files</span>
                      </button>
                    </>
                  )}

                  {!confirmClearAll ? (
                    <button
                      type="button"
                      className="btn-queue-clear"
                      onClick={() => setConfirmClearAll(true)}
                    >
                      Clear all
                    </button>
                  ) : (
                    <div className="confirm-clear-group">
                      <span className="confirm-prompt">Remove all?</span>
                      <button
                        type="button"
                        className="btn-confirm-yes"
                        onClick={handleClearAll}
                      >
                        Yes, clear
                      </button>
                      <button
                        type="button"
                        className="btn-confirm-no"
                        onClick={() => setConfirmClearAll(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Partial Success Guidance Notice */}
              {readySources.length > 0 && failedSources.length > 0 && (
                <div className="partial-notice-box" role="status">
                  <svg
                    className="partial-notice-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    aria-hidden="true"
                  >
                    <circle cx="10" cy="10" r="8" />
                    <line x1="10" y1="7" x2="10" y2="11" />
                    <circle cx="10" cy="14" r="0.75" fill="currentColor" />
                  </svg>
                  <span>
                    {readySources.length} {readySources.length === 1 ? "file is" : "files are"} ready. Remove or retry the remaining file to continue with available material.
                  </span>
                </div>
              )}

              {/* Queue Rows */}
              <div className="queue-list" role="list" aria-label="Source files queue">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className={`queue-item-card ${src.status}`}
                    role="listitem"
                  >
                    {/* File Icon */}
                    <div className="queue-icon-box" aria-hidden="true">
                      <span className="queue-format-badge">
                        {src.fileType.toUpperCase()}
                      </span>
                    </div>

                    {/* File Info & Status */}
                    <div className="queue-item-main">
                      <div className="queue-item-top">
                        <span className="queue-file-name" title={src.fileName}>
                          {src.fileName}
                        </span>
                        <span className="queue-file-meta">
                          {formatFileSize(src.fileSize)}
                        </span>
                      </div>

                      <div className="queue-item-status-row">
                        {src.status === "waiting" && (
                          <span className="status-badge waiting">
                            <span className="dot-indicator" /> Waiting
                          </span>
                        )}

                        {src.status === "reading" && (
                          <span className="status-badge reading">
                            <span className="pulse-dot" /> {src.stageText || "Reading..."}
                          </span>
                        )}

                        {src.status === "ready" && (
                          <span className="status-badge ready">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="3 8 7 12 13 4" />
                            </svg>
                            Ready · {src.totalChunks} {src.chunkType} ({src.totalWords.toLocaleString()} words)
                          </span>
                        )}

                        {src.status === "error" && (
                          <span className="status-badge error" title={src.errorMessage}>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="8" cy="8" r="6" />
                              <line x1="8" y1="5" x2="8" y2="8" />
                              <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                            </svg>
                            Couldn’t read: {src.errorMessage || "Extraction failed"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions: Retry (if error) & Remove */}
                    <div className="queue-item-actions">
                      {src.status === "error" && (
                        <button
                          type="button"
                          className="btn-item-retry"
                          onClick={() => handleRetryFile(src.id)}
                          aria-label={`Retry reading ${src.fileName}`}
                        >
                          Retry
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-item-remove"
                        onClick={() => handleRemoveSource(src.id)}
                        aria-label={`Remove ${src.fileName}`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="4" y1="4" x2="12" y2="12" />
                          <line x1="12" y1="4" x2="4" y2="12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Next Step Button (Visible when at least 1 file is ready) */}
              <div className="queue-bottom-actions">
                <button
                  type="button"
                  className="btn-primary-action"
                  disabled={readySources.length === 0 || isExtracting}
                  onClick={() => setStep("focus")}
                >
                  <span>
                    {isExtracting
                      ? "Reading files..."
                      : `Review & Focus (${readySources.length} ready)`}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="3" y1="8" x2="13" y2="8" />
                    <polyline points="9 4 13 8 9 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Global Actions */}
          <div className="importer-actions-bar">
            <Link href="/study" className="btn-secondary-action">
              Cancel
            </Link>
          </div>
        </div>
      )}

      {/* ====================================================================
          2. FOCUS & PREFERENCES STEP
          ==================================================================== */}
      {step === "focus" && readySources.length > 0 && (
        <div className="importer-focus-step">
          {/* Header Bar */}
          <div className="focus-header-bar">
            <div className="workspace-header">
              <div className="eyebrow-chip">
                <span className="eyebrow-dot" aria-hidden="true" />
                <span>Review & Focus</span>
              </div>
              <h1 className="workspace-heading">Choose what to study.</h1>
              <p className="workspace-description">
                Select the lecture sections to include and set your revision style.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary-action back-to-sources-btn"
              onClick={() => setStep("upload")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="13" y1="8" x2="3" y2="8" />
                <polyline points="7 4 3 8 7 12" />
              </svg>
              <span>Manage source files</span>
            </button>
          </div>

          {/* Very Long Material Notice */}
          {isVeryLongCombined && (
            <div className="workspace-alert-box warning" role="alert">
              <svg
                className="alert-box-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="8" />
                <line x1="10" y1="7" x2="10" y2="11" />
                <circle cx="10" cy="14" r="0.75" fill="currentColor" />
              </svg>
              <div className="alert-box-body">
                <h2 className="alert-box-title">Extensive Study Material</h2>
                <p className="alert-box-text">
                  This is a lot of material ({totalWordsCombined.toLocaleString()} words across {readySources.length} sources). Choose the sections you want to study first.
                </p>
              </div>
            </div>
          )}

          {/* 2-Column Split: Combined Material on Left, Preferences on Right */}
          <div className="focus-layout-grid">
            {/* Left Column: Combined Extracted Chunks */}
            <div className="source-material-column">
              <div className="source-panel-card">
                <div className="source-panel-header">
                  <div className="source-panel-title-group">
                    <h2 className="source-panel-heading">Your study material</h2>
                    <span className="source-meta-chip">
                      {readySources.length} {readySources.length === 1 ? "source" : "sources"} · {allChunks.length} sections · {totalWordsCombined.toLocaleString()} words
                    </span>
                  </div>

                  {/* Multi-Source Filter Chips */}
                  {readySources.length > 1 && (
                    <div className="source-filter-chips-row" role="tablist" aria-label="Filter material by source file">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeSourceFilter === "all"}
                        className={`source-filter-tab ${activeSourceFilter === "all" ? "active" : ""}`}
                        onClick={() => setActiveSourceFilter("all")}
                      >
                        All sources ({allChunks.length})
                      </button>
                      {readySources.map((src) => (
                        <button
                          key={src.id}
                          type="button"
                          role="tab"
                          aria-selected={activeSourceFilter === src.id}
                          className={`source-filter-tab ${activeSourceFilter === src.id ? "active" : ""}`}
                          onClick={() => setActiveSourceFilter(src.id)}
                          title={src.fileName}
                        >
                          <span className="tab-filename-truncate">{src.fileName}</span>
                          <span className="tab-chunk-count">({src.chunks.length})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selection Toolbar */}
                  <div className="selection-toolbar">
                    <button
                      type="button"
                      className="btn-toolbar"
                      onClick={selectAllChunks}
                    >
                      Use all ready material
                    </button>
                    <span className="toolbar-divider">|</span>
                    <button
                      type="button"
                      className="btn-toolbar"
                      onClick={deselectAllChunks}
                    >
                      Clear selection
                    </button>
                    <span className="selection-summary-badge">
                      Selected: {selectedChunks.length} of {allChunks.length} sections ({selectedChunks.reduce((acc, c) => acc + c.wordCount, 0).toLocaleString()} words)
                    </span>
                  </div>
                </div>

                {/* Chunks List */}
                <div className="chunks-scroll-list" role="group" aria-label="Extracted lecture sections">
                  {displayedChunks.length === 0 ? (
                    <div className="empty-chunks-box">
                      No material available in this view.
                    </div>
                  ) : (
                    displayedChunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className={`chunk-item-card ${chunk.selected ? "selected" : ""}`}
                        onClick={() => toggleChunk(chunk.id)}
                        role="checkbox"
                        aria-checked={chunk.selected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleChunk(chunk.id);
                          }
                        }}
                      >
                        <div className="chunk-header-row">
                          <div className="chunk-label-group">
                            <input
                              type="checkbox"
                              checked={chunk.selected}
                              onChange={() => toggleChunk(chunk.id)}
                              className="chunk-checkbox"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${chunk.label}`}
                            />
                            {/* Real Source Reference Label: FileName · Page/Slide/Section X */}
                            <span className="chunk-label-badge" title={chunk.label}>
                              {chunk.label}
                            </span>
                          </div>
                          <span className="chunk-word-count">
                            {chunk.wordCount} words
                          </span>
                        </div>

                        <p className="chunk-preview-text">{chunk.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Preferences & Primary Action */}
            <div className="preferences-column">
              <div className="preferences-card">
                <div className="preferences-card-header">
                  <h2 className="preferences-title">Make it yours</h2>
                  <p className="preferences-subtext">
                    Tailor your notes and five practice questions.
                  </p>
                </div>

                <div className="preferences-form">
                  {/* Subject Selector */}
                  <div className="pref-group">
                    <label htmlFor="subject-select" className="pref-label">
                      Subject
                    </label>
                    <select
                      id="subject-select"
                      className="pref-select"
                      value={preferences.subject}
                      onChange={(e) => updatePreference("subject", e.target.value)}
                    >
                      {SUBJECT_OPTIONS.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Note Style Segmented Control */}
                  <div className="pref-group">
                    <span className="pref-label">Revision style</span>
                    <div className="segmented-control" role="radiogroup" aria-label="Revision style">
                      {NOTE_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          role="radio"
                          aria-checked={preferences.noteStyle === style.id}
                          className={`segmented-btn ${preferences.noteStyle === style.id ? "active" : ""}`}
                          onClick={() => updatePreference("noteStyle", style.id)}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty Segmented Control */}
                  <div className="pref-group">
                    <span className="pref-label">Question difficulty</span>
                    <div className="segmented-control" role="radiogroup" aria-label="Question difficulty">
                      {DIFFICULTIES.map((diff) => (
                        <button
                          key={diff.id}
                          type="button"
                          role="radio"
                          aria-checked={preferences.difficulty === diff.id}
                          className={`segmented-btn ${preferences.difficulty === diff.id ? "active" : ""}`}
                          onClick={() => updatePreference("difficulty", diff.id)}
                        >
                          {diff.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Offline Notice */}
                  <div className="pref-offline-note">
                    <svg
                      className="offline-icon"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      aria-hidden="true"
                    >
                      <circle cx="10" cy="10" r="8" />
                      <line x1="10" y1="7" x2="10" y2="11" />
                      <circle cx="10" cy="14" r="0.75" fill="currentColor" />
                    </svg>
                    <span>
                      Your material is ready locally. Internet will be needed only when you generate with AI.
                    </span>
                  </div>

                  {/* Dynamic Primary CTA Button: Continue with X sources */}
                  <button
                    type="button"
                    className="btn-auth-primary"
                    disabled={selectedChunks.length === 0 || readySourceCount === 0}
                    onClick={async () => {
                      await persistDraft(sources, preferences);
                      showToast(
                        "Your material is ready. AI generation is the next setup step."
                      );
                    }}
                  >
                    <span>
                      {readySourceCount === 0
                        ? "Select material to continue"
                        : readySourceCount === 1
                        ? "Continue with 1 source"
                        : `Continue with ${readySourceCount} sources`}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="3" y1="8" x2="13" y2="8" />
                      <polyline points="9 4 13 8 9 12" />
                    </svg>
                  </button>

                  {/* Discard Draft Action */}
                  <button
                    type="button"
                    className="btn-discard-draft"
                    onClick={handleDiscardCurrentDraft}
                  >
                    Discard local draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

