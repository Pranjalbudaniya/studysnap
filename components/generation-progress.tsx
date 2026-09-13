"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getStudyDraft,
  saveGeneratedPackToDraft,
  type StudyDraft,
} from "../lib/local-study-draft";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";

interface StageInfo {
  id: number;
  label: string;
  description: string;
}

const STAGES: StageInfo[] = [
  {
    id: 1,
    label: "Reading your material",
    description: "Extracting key terms and core concepts from your selected sources.",
  },
  {
    id: 2,
    label: "Structuring revision notes",
    description: "Organizing explanations and flagging likely exam traps.",
  },
  {
    id: 3,
    label: "Writing 5 practice questions",
    description: "Drafting active recall prompts and model answers.",
  },
  {
    id: 4,
    label: "Finishing your study pack",
    description: "Linking source evidence and preparing your study workspace.",
  },
];

export function GenerationProgress() {
  const router = useRouter();

  // Lifecycle state
  const [currentUserId, setCurrentUserId] = useState<string>("guest");
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sourceSummary, setSourceSummary] = useState<{
    fileCount: number;
    chunkCount: number;
    wordCount: number;
  }>({ fileCount: 0, chunkCount: 0, wordCount: 0 });

  const abortControllerRef = useRef<AbortController | null>(null);
  const stageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3500);
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

  // Main generation executor
  const runGeneration = useCallback(
    async (userIdToUse: string) => {
      setIsGenerating(true);
      setIsCompleted(false);
      setIsCancelled(false);
      setErrorMessage(null);
      setCurrentStage(1);

      // Clean any existing interval
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
      }

      try {
        // 1. Load active draft from IndexedDB
        const draft: StudyDraft | null = await getStudyDraft(userIdToUse);
        if (!draft || !draft.sources || draft.sources.length === 0) {
          setIsGenerating(false);
          setErrorMessage(
            "Choose some material before generating your study pack."
          );
          return;
        }

        const readySources = draft.sources.filter(
          (s) => s.status === "ready" && s.chunks && s.chunks.length > 0
        );
        const selectedChunks = readySources
          .flatMap((s) => s.chunks)
          .filter((c) => c.selected);

        if (selectedChunks.length === 0) {
          setIsGenerating(false);
          setErrorMessage(
            "Choose some material before generating your study pack."
          );
          return;
        }

        const totalWords = selectedChunks.reduce(
          (acc, c) => acc + c.wordCount,
          0
        );
        const totalChars = selectedChunks.reduce(
          (acc, c) => acc + c.text.length,
          0
        );

        setSourceSummary({
          fileCount: readySources.filter((s) =>
            s.chunks.some((c) => c.selected)
          ).length,
          chunkCount: selectedChunks.length,
          wordCount: totalWords,
        });

        if (totalChars < 200 || totalWords < 40) {
          setIsGenerating(false);
          setErrorMessage(
            "There isn’t enough selected material to create a useful study pack."
          );
          return;
        }

        if (totalChars > 120000) {
          setIsGenerating(false);
          setErrorMessage(
            "Your selection is too large. Choose fewer pages, slides, or sections and try again."
          );
          return;
        }

        // 2. Setup Abort Controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Stage 1 -> 2 progression
        const t1 = setTimeout(() => {
          setCurrentStage((prev) => (prev < 2 ? 2 : prev));
        }, 1200);

        // Stage 2 -> 3 progression
        const t2 = setTimeout(() => {
          setCurrentStage((prev) => (prev < 3 ? 3 : prev));
        }, 4000);

        // 3. Dispatch Server Request to /api/generate
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedChunks: selectedChunks.map((c) => ({
              id: c.id,
              label: c.label,
              sourceFileName: c.sourceFileName,
              subLabel: c.subLabel,
              text: c.text,
            })),
            preferences: draft.preferences || {
              subject: "General",
              noteStyle: "clear",
              difficulty: "mixed",
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(t1);
        clearTimeout(t2);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const friendlyMsg =
            errData.error ||
            "We couldn’t safely structure this study pack. Please try again.";
          setIsGenerating(false);
          setErrorMessage(friendlyMsg);
          return;
        }

        const data = await response.json();
        if (!data || !data.studyPack) {
          setIsGenerating(false);
          setErrorMessage(
            "We couldn’t safely structure this study pack. Please try again."
          );
          return;
        }

        // 4. Save result to IndexedDB draft
        setCurrentStage(4);
        setIsCompleted(true);
        await saveGeneratedPackToDraft(userIdToUse, data.studyPack);

        // 5. Navigate to preview
        setTimeout(() => {
          router.push("/study/preview");
        }, 600);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setIsGenerating(false);
          setIsCancelled(true);
          return;
        }

        setIsGenerating(false);
        setErrorMessage(
          "We couldn’t reach the AI service. Check your connection and try again."
        );
      }
    },
    [router]
  );

  // Trigger generation when user context is ready
  useEffect(() => {
    if (currentUserId) {
      runGeneration(currentUserId);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
      }
    };
  }, [currentUserId, runGeneration]);

  // Handle Cancel Action
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setIsCancelled(true);
    showToast("Generation cancelled. Your selected material is preserved.");
  };

  const handleRetry = () => {
    if (currentUserId) {
      runGeneration(currentUserId);
    }
  };

  return (
    <div className="generation-progress-container">
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
        <div className="stepper-item completed">
          <span className="stepper-number">1</span>
          <span className="stepper-label">Upload</span>
        </div>
        <div className="stepper-divider" />
        <div className="stepper-item completed">
          <span className="stepper-number">2</span>
          <span className="stepper-label">Focus</span>
        </div>
        <div className="stepper-divider" />
        <div className={`stepper-item ${!errorMessage ? "active" : ""}`}>
          <span className="stepper-number">3</span>
          <span className="stepper-label">Study</span>
        </div>
      </div>

      {/* ====================================================================
          1. ACTIVE IN-FLIGHT GENERATION OR COMPLETION
          ==================================================================== */}
      {!errorMessage && !isCancelled && (
        <div className="generation-main-layout">
          {/* Header */}
          <div className="workspace-header">
            <div className="eyebrow-chip">
              <span className="eyebrow-dot" aria-hidden="true" />
              <span>Generating study pack</span>
            </div>
            <h1 className="workspace-heading">
              Turning your material into focused revision.
            </h1>
            <p className="workspace-description">
              {sourceSummary.fileCount > 0 ? (
                <>
                  Analyzing {sourceSummary.fileCount} source file
                  {sourceSummary.fileCount > 1 ? "s" : ""} ·{" "}
                  {sourceSummary.chunkCount} sections ·{" "}
                  {sourceSummary.wordCount.toLocaleString()} words
                </>
              ) : (
                "Synthesizing key concepts and drafting practice questions."
              )}
            </p>
          </div>

          {/* Main Progress Card */}
          <div className="generation-panel-card">
            {/* Stage Timeline */}
            <div className="generation-timeline-list" role="list">
              {STAGES.map((stg) => {
                const isPast = isCompleted || currentStage > stg.id;
                const isCurrent = !isCompleted && currentStage === stg.id;

                return (
                  <div
                    key={stg.id}
                    className={`timeline-stage-item ${
                      isPast ? "completed" : isCurrent ? "current" : "upcoming"
                    }`}
                    role="listitem"
                  >
                    {/* Stage icon / marker */}
                    <div className="stage-marker-box" aria-hidden="true">
                      {isPast ? (
                        <svg
                          className="stage-check-svg"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 8 7 12 13 4" />
                        </svg>
                      ) : isCurrent ? (
                        <span className="stage-pulse-dot" />
                      ) : (
                        <span className="stage-number-text">{stg.id}</span>
                      )}
                    </div>

                    {/* Stage details */}
                    <div className="stage-details-text">
                      <div className="stage-title-row">
                        <span className="stage-title">{stg.label}</span>
                        {isCurrent && (
                          <span className="stage-status-tag">In progress</span>
                        )}
                        {isPast && (
                          <span className="stage-status-tag completed">
                            Ready
                          </span>
                        )}
                      </div>
                      <p className="stage-desc">{stg.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions Bar */}
            <div className="generation-actions-row">
              {isGenerating && (
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              )}

              {isCompleted && (
                <Link href="/study/preview" className="btn-primary-action">
                  <span>View study pack</span>
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
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          2. RECOVERABLE STATE: GENERATION CANCELLED
          ==================================================================== */}
      {isCancelled && !errorMessage && (
        <div className="generation-recovery-card">
          <div className="recovery-header">
            <div className="recovery-icon-wrapper" aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="recovery-title">Generation cancelled</h2>
            <p className="recovery-text">
              Generation was cancelled. Your source material and preferences
              remain safely preserved in your browser.
            </p>
          </div>

          <div className="recovery-actions">
            <button
              type="button"
              className="btn-primary-action"
              onClick={handleRetry}
            >
              Resume generation
            </button>
            <Link href="/study/new" className="btn-secondary-action">
              Back to material
            </Link>
          </div>
        </div>
      )}

      {/* ====================================================================
          3. RECOVERABLE STATE: ERROR / FAILURE
          ==================================================================== */}
      {errorMessage && (
        <div className="generation-recovery-card">
          <div className="recovery-header">
            <div className="recovery-icon-wrapper error" aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="recovery-title">Unable to generate study pack</h2>
            <p className="recovery-text">{errorMessage}</p>
          </div>

          <div className="recovery-actions">
            <button
              type="button"
              className="btn-primary-action"
              onClick={handleRetry}
            >
              Try again
            </button>
            <Link href="/study/new" className="btn-secondary-action">
              Back to material
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
