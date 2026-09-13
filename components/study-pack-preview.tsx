"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getStudyDraft,
  updateDraftReviewFlags,
  updateDraftRecallState,
  updateDraftSavedPackId,
  type StudyDraft,
} from "../lib/local-study-draft";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";
import type { GeneratedStudyPack, QuizQuestion } from "../lib/study-schema";

interface ActiveEvidence {
  sourceRef: string;
  excerpt: string;
  contextTitle?: string;
}

export function StudyPackPreview() {
  const [currentUserId, setCurrentUserId] = useState<string>("guest");
  const [draft, setDraft] = useState<StudyDraft | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Real Save State
  const [savedPackId, setSavedPackId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [showSignInModal, setShowSignInModal] = useState<boolean>(false);

  // Main view tab: "notes" | "quiz"
  const [activeTab, setActiveTab] = useState<"notes" | "quiz">("notes");

  // Evidence Drawer state
  const [activeEvidence, setActiveEvidence] = useState<ActiveEvidence | null>(
    null
  );

  // Practice Quiz interactive state
  const [selectedMcqOptions, setSelectedMcqOptions] = useState<
    Record<number, number>
  >({});
  const [shortAnswers, setShortAnswers] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<
    Record<number, boolean>
  >({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<
    Record<number, boolean>
  >({});

  // Inline Note Edit State
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [editedOverview, setEditedOverview] = useState<string>("");

  // Quick Recall Overlay state
  const [isRecallOpen, setIsRecallOpen] = useState<boolean>(false);
  const [recallIndex, setRecallIndex] = useState<number>(0);
  const [recallRevealed, setRecallRevealed] = useState<boolean>(false);
  const [recallConfidence, setRecallConfidence] = useState<
    Record<number, boolean>
  >({});
  const [recallCompleted, setRecallCompleted] = useState<boolean>(false);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Load draft from IndexedDB
  const loadDraft = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const loaded = await getStudyDraft(uid);
      if (loaded && loaded.generatedStudyPack) {
        setDraft(loaded);
        setEditedOverview(loaded.generatedStudyPack.overview);
        if (loaded.savedPackId) {
          setSavedPackId(loaded.savedPackId);
        }
        if (loaded.reviewFlags) {
          const initialFlags: Record<number, boolean> = {};
          loaded.reviewFlags.forEach((flag) => {
            const match = flag.match(/^quiz_(\d+)$/);
            if (match) {
              initialFlags[parseInt(match[1], 10)] = true;
            }
          });
          setFlaggedQuestions(initialFlags);
        }
        if (loaded.quickRecallState) {
          setRecallConfidence(loaded.quickRecallState.confidenceMap || {});
        }
      } else {
        setDraft(null);
      }
    } catch {
      setDraft(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadDraft(currentUserId);
    }
  }, [currentUserId, loadDraft]);

  // Handle Save / Update Study Pack to Supabase
  const handleSaveStudyPack = async () => {
    if (isSaving) return;

    if (!draft || !draft.generatedStudyPack) {
      showToast("Generate a study pack before saving.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setSaveErrorMessage(
        "Your study library is not set up yet. Run the database migration, then try again."
      );
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setShowSignInModal(true);
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage(null);

    const studyPack = draft.generatedStudyPack;
    const readySources = (draft.sources || []).filter((s) => s.status === "ready");
    const sourceFileName =
      readySources.map((s) => s.fileName).join(", ") || "Untitled material";

    const payload = {
      user_id: user.id,
      title: studyPack.title,
      source_file_name: sourceFileName,
      subject: draft.preferences?.subject || "General",
      note_style: draft.preferences?.noteStyle || "clear",
      difficulty: draft.preferences?.difficulty || "mixed",
      notes_json: {
        title: studyPack.title,
        overview: editedOverview || studyPack.overview,
        keyConcepts: studyPack.keyConcepts || [],
        examTraps: studyPack.examTraps || [],
      },
      quiz_json: studyPack.quiz || [],
      review_flags: draft.reviewFlags || [],
      recall_progress: draft.quickRecallState || {},
    };

    try {
      if (savedPackId) {
        // Update existing row
        const { error } = await supabase
          .from("study_packs")
          .update(payload)
          .eq("id", savedPackId)
          .eq("user_id", user.id);

        if (error) {
          handleSaveError(error);
        } else {
          showToast("Saved changes to your study library.");
        }
      } else {
        // Insert new row
        const { data, error } = await supabase
          .from("study_packs")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          handleSaveError(error);
        } else if (data) {
          setSavedPackId(data.id);
          await updateDraftSavedPackId(user.id, data.id);
          showToast("Saved to your study library.");
        }
      }
    } catch {
      setSaveErrorMessage(
        "We couldn’t reach your study library. Check your connection and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveError = (error: {
    message?: string;
    code?: string;
    details?: string;
  }) => {
    const errStr = `${error.message || ""} ${error.code || ""} ${
      error.details || ""
    }`.toLowerCase();

    if (
      error.code === "42P01" ||
      error.code === "PGRST116" ||
      errStr.includes("does not exist") ||
      errStr.includes("relation") ||
      errStr.includes("study_packs")
    ) {
      setSaveErrorMessage(
        "Your study library is not set up yet. Run the database migration, then try again."
      );
    } else if (
      error.code === "PGRST301" ||
      errStr.includes("jwt") ||
      errStr.includes("expired") ||
      errStr.includes("unauthorized")
    ) {
      setSaveErrorMessage(
        "Your session expired. Sign in again to save your work."
      );
    } else if (
      errStr.includes("network") ||
      errStr.includes("fetch") ||
      errStr.includes("connection")
    ) {
      setSaveErrorMessage(
        "We couldn’t reach your study library. Check your connection and try again."
      );
    } else {
      setSaveErrorMessage(
        "We couldn’t save this study pack. Your work is still available locally."
      );
    }
  };

  // Toggle Reveal on Quiz card
  const toggleRevealAnswer = (qIdx: number) => {
    setRevealedAnswers((prev) => ({ ...prev, [qIdx]: !prev[qIdx] }));
  };

  // Toggle MCQ Option
  const handleSelectOption = (qIdx: number, optIdx: number) => {
    setSelectedMcqOptions((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  // Toggle Review Later on Quiz card
  const toggleFlagQuestion = async (qIdx: number) => {
    const isNowFlagged = !flaggedQuestions[qIdx];
    const updated = { ...flaggedQuestions, [qIdx]: isNowFlagged };
    setFlaggedQuestions(updated);

    showToast(
      isNowFlagged
        ? `Question ${qIdx + 1} flagged for review.`
        : `Question ${qIdx + 1} unflagged.`
    );

    if (currentUserId && draft) {
      const activeFlagKeys = Object.keys(updated)
        .filter((k) => updated[parseInt(k, 10)])
        .map((k) => `quiz_${k}`);
      await updateDraftReviewFlags(currentUserId, activeFlagKeys);
    }
  };

  // Reset Quiz
  const handleResetQuiz = () => {
    setSelectedMcqOptions({});
    setShortAnswers({});
    setRevealedAnswers({});
    showToast("Quiz answers reset.");
  };

  // Quick Recall actions
  const handleStartRecall = () => {
    setRecallIndex(0);
    setRecallRevealed(false);
    setRecallCompleted(false);
    setIsRecallOpen(true);
  };

  const handleFlipRecall = () => {
    setRecallRevealed(true);
  };

  const handleRateRecallConfidence = async (
    qIndex: number,
    confident: boolean
  ) => {
    const updatedConfidence = { ...recallConfidence, [qIndex]: confident };
    setRecallConfidence(updatedConfidence);

    if (draft && draft.generatedStudyPack) {
      const totalQuestions = draft.generatedStudyPack.quiz.length;
      if (qIndex + 1 < totalQuestions) {
        setRecallIndex(qIndex + 1);
        setRecallRevealed(false);
      } else {
        setRecallCompleted(true);
        if (currentUserId) {
          await updateDraftRecallState(currentUserId, {
            confidenceMap: updatedConfidence,
            completed: true,
          });
        }
      }
    }
  };

  // Empty or Loading state
  if (isLoading) {
    return (
      <div className="study-pack-preview-container">
        <div className="workspace-header">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span>Loading study pack</span>
          </div>
          <h1 className="workspace-heading">Opening your revision notes...</h1>
        </div>
      </div>
    );
  }

  if (!draft || !draft.generatedStudyPack) {
    return (
      <div className="study-pack-preview-container">
        <div className="workspace-header">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span>No study pack ready</span>
          </div>
          <h1 className="workspace-heading">No study pack is ready yet.</h1>
          <p className="workspace-description">
            Add material to begin.
          </p>
        </div>

        <div className="workspace-panel-card">
          <div className="panel-document-drop-zone">
            <div className="drop-zone-icon-wrapper">
              <svg
                className="drop-zone-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
            </div>
            <h2 className="drop-zone-title">Create your first study pack</h2>
            <p className="drop-zone-subtitle">
              Combine lecture slides, PDF readings, and DOCX notes into five
              focused practice questions and core revision notes.
            </p>
            <Link href="/study/new" className="btn-primary-action">
              <span>Start new study pack</span>
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
          </div>
        </div>
      </div>
    );
  }

  const studyPack: GeneratedStudyPack = draft.generatedStudyPack;
  const sources = draft.sources || [];
  const readySources = sources.filter((s) => s.status === "ready");
  const subjectName = draft.preferences?.subject || "General";
  const sourceNames = readySources.map((s) => s.fileName).join(", ");
  const quizList: QuizQuestion[] = studyPack.quiz || [];
  const keyConceptsList = studyPack.keyConcepts || [];
  const examTrapsList = studyPack.examTraps || [];

  const revealedCount = Object.values(revealedAnswers).filter(Boolean).length;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;
  const confidentCount =
    Object.values(recallConfidence).filter(Boolean).length;

  return (
    <div className="study-pack-preview-container">
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

      {/* Top Navigation & Action Bar */}
      <div className="preview-top-bar">
        <div className="preview-top-left">
          <Link href="/study" className="btn-back-to-library">
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
              <line x1="13" y1="8" x2="3" y2="8" />
              <polyline points="7 4 3 8 7 12" />
            </svg>
            <span>Back to study library</span>
          </Link>

          <span className="preview-status-pill">
            Study pack ready · {readySources.length}{" "}
            {readySources.length === 1 ? "source" : "sources"}
          </span>
        </div>

        <div className="preview-actions-group">
          {/* Quick Recall Action */}
          <button
            type="button"
            className="btn-preview-recall"
            onClick={handleStartRecall}
            aria-label="Start Quick Recall flashcards"
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
              <polygon points="5 3 13 8 5 13 5 3" />
            </svg>
            <span>Quick recall</span>
          </button>

          {/* Regenerate Action */}
          <Link href="/study/generating" className="btn-preview-action">
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
              <path d="M1 4v4h4" />
              <path d="M3.51 10.5a6 6 0 1 0 1.76-6.19L1 8" />
            </svg>
            <span>Regenerate</span>
          </Link>

          {/* Save Study Pack / Update Saved Pack */}
          <button
            type="button"
            className="btn-preview-action"
            onClick={handleSaveStudyPack}
            disabled={isSaving}
            aria-label={savedPackId ? "Update saved study pack" : "Save study pack to library"}
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : savedPackId ? (
              <>
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
                  <polyline points="3 8 7 12 13 4" />
                </svg>
                <span>Update saved pack</span>
              </>
            ) : (
              <>
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
                  <path d="M13 13H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h7l4 4v7a1 1 0 0 1-1 1z" />
                  <polyline points="10 2 10 6 6 6" />
                </svg>
                <span>Save study pack</span>
              </>
            )}
          </button>

          {/* Open library button (visible when pack is saved) */}
          {savedPackId && (
            <Link href="/study" className="btn-preview-action">
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
                <path d="M2 3h12v10H2z" />
                <path d="M2 7h12" />
                <path d="M6 3v10" />
              </svg>
              <span>Open library</span>
            </Link>
          )}

          {/* Export (disabled upcoming) */}
          <button
            type="button"
            className="btn-preview-action"
            disabled
            title="Saving and export are coming next."
            style={{ opacity: 0.6, cursor: "not-allowed" }}
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
              <path d="M14 10v4H2v-4" />
              <polyline points="7 7 10 10 13 7" />
              <line x1="10" y1="10" x2="10" y2="2" />
            </svg>
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Save Error Notice with Retry */}
      {saveErrorMessage && (
        <div className="workspace-alert-box error" role="alert" style={{ marginBottom: "1.5rem" }}>
          <svg
            className="alert-box-icon"
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
          <div className="alert-box-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "1rem", flexWrap: "wrap" }}>
            <p className="alert-box-text">{saveErrorMessage}</p>
            <button
              type="button"
              className="btn-item-retry"
              onClick={handleSaveStudyPack}
              style={{ flexShrink: 0 }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="preview-hero-card">
        <div className="preview-hero-top">
          <div className="preview-hero-badges">
            <span className="preview-subject-badge">{subjectName}</span>
            <span className="preview-sources-badge" title={sourceNames}>
              {readySources.length}{" "}
              {readySources.length === 1 ? "source file" : "source files"}
            </span>
          </div>
          <span className="preview-time-badge">
            Generated {new Date(draft.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <h1 className="preview-hero-title">{studyPack.title}</h1>

        {isEditingNotes ? (
          <textarea
            className="short-answer-textarea"
            value={editedOverview}
            onChange={(e) => setEditedOverview(e.target.value)}
            rows={3}
            aria-label="Edit overview text"
          />
        ) : (
          <p className="preview-hero-description">{editedOverview}</p>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="preview-tabs-container">
        <div className="preview-tabs-nav" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "notes"}
            className={`preview-tab-btn ${activeTab === "notes" ? "active" : ""}`}
            onClick={() => setActiveTab("notes")}
          >
            <span>Revision notes</span>
            <span className="tab-count-pill">{keyConceptsList.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "quiz"}
            className={`preview-tab-btn ${activeTab === "quiz" ? "active" : ""}`}
            onClick={() => setActiveTab("quiz")}
          >
            <span>Practice quiz</span>
            <span className="tab-count-pill">{quizList.length}</span>
          </button>
        </div>

        {/* ====================================================================
            TAB 1: REVISION NOTES
            ==================================================================== */}
        {activeTab === "notes" && (
          <div className="notes-tab-content">
            {/* Toolbar */}
            <div className="notes-toolbar">
              <span className="notes-meta-text">
                {keyConceptsList.length} key concepts · {examTrapsList.length} exam{" "}
                {examTrapsList.length === 1 ? "trap" : "traps"}
              </span>

              <button
                type="button"
                className={`btn-notes-edit-toggle ${isEditingNotes ? "active" : ""}`}
                onClick={() => setIsEditingNotes((prev) => !prev)}
              >
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
                  <path d="M12 2l2 2-9 9H3v-2l9-9z" />
                </svg>
                <span>{isEditingNotes ? "Done editing" : "Edit notes"}</span>
              </button>
            </div>

            {/* Core Concepts Grid */}
            <div className="notes-section-block">
              <h2 className="notes-section-title">
                <svg
                  className="section-icon"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="8" />
                  <line x1="10" y1="6" x2="10" y2="10" />
                  <line x1="10" y1="14" x2="10.01" y2="14" />
                </svg>
                <span>Core Concepts</span>
              </h2>

              <div className="key-concepts-grid">
                {keyConceptsList.map((concept, idx) => (
                  <div key={idx} className="key-concept-card">
                    <div className="concept-card-top">
                      <span className="concept-badge">Concept {idx + 1}</span>
                      <button
                        type="button"
                        className="concept-source-pill"
                        onClick={() =>
                          setActiveEvidence({
                            sourceRef: concept.sourceReference,
                            excerpt: concept.sourceExcerpt,
                            contextTitle: concept.term,
                          })
                        }
                        title="View source evidence"
                      >
                        <svg
                          className="evidence-icon"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>{concept.sourceReference}</span>
                      </button>
                    </div>

                    <h3 className="concept-title">{concept.term}</h3>
                    <p className="concept-summary">{concept.explanation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Likely Exam Traps (Rendered only if generated) */}
            {examTrapsList.length > 0 && (
              <div className="exam-traps-card">
                <div className="exam-traps-header">
                  <svg
                    className="traps-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    aria-hidden="true"
                  >
                    <path d="M10 2L2 18h16L10 2z" />
                    <line x1="10" y1="8" x2="10" y2="12" />
                    <line x1="10" y1="15" x2="10.01" y2="15" />
                  </svg>
                  <h2 className="traps-title">Likely Exam Traps</h2>
                </div>

                <div className="traps-list">
                  {examTrapsList.map((trap, idx) => (
                    <div key={idx} className="trap-item">
                      <span className="trap-mistake">Trap {idx + 1}</span>
                      <p className="trap-correction">{trap.text}</p>
                      {trap.sourceExcerpt && (
                        <button
                          type="button"
                          className="concept-source-pill"
                          style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
                          onClick={() =>
                            setActiveEvidence({
                              sourceRef: trap.sourceReference,
                              excerpt: trap.sourceExcerpt,
                              contextTitle: `Exam Trap ${idx + 1}`,
                            })
                          }
                        >
                          <svg
                            className="evidence-icon"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span>{trap.sourceReference}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review Next Section */}
            {flaggedCount > 0 && (
              <div className="review-next-card">
                <div className="review-next-header">
                  <div className="review-header-left">
                    <h2 className="review-title">Review Next</h2>
                    <span className="review-count-badge">
                      {flaggedCount} flagged
                    </span>
                  </div>
                  <span className="review-subtext">
                    Items flagged during your practice questions
                  </span>
                </div>

                <div className="review-items-list">
                  {quizList.map((q, idx) => {
                    if (!flaggedQuestions[idx]) return null;
                    return (
                      <div key={idx} className="review-item-row">
                        <div className="review-item-main">
                          <span className="review-item-type">
                            Question {idx + 1} · {q.type === "multiple_choice" ? "MCQ" : "Short Answer"}
                          </span>
                          <span className="review-item-title">{q.question}</span>
                          <span className="review-item-note">
                            Key concept: {q.answer}
                          </span>
                        </div>

                        <div className="review-item-actions">
                          <button
                            type="button"
                            className="btn-evidence-trigger"
                            onClick={() =>
                              setActiveEvidence({
                                sourceRef: q.sourceReference,
                                excerpt: q.sourceExcerpt,
                                contextTitle: `Question ${idx + 1} Evidence`,
                              })
                            }
                          >
                            <span>Evidence</span>
                          </button>

                          <button
                            type="button"
                            className="btn-review-toggle"
                            onClick={() => toggleFlagQuestion(idx)}
                          >
                            Mark reviewed
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 2: PRACTICE QUIZ (EXACTLY 5 QUESTIONS)
            ==================================================================== */}
        {activeTab === "quiz" && (
          <div className="quiz-tab-content">
            {/* Meta Bar */}
            <div className="quiz-meta-bar">
              <div className="quiz-stats-group">
                <span className="quiz-stat-pill">5 Practice Questions</span>
                <span className="quiz-stat-pill">
                  {revealedCount} of 5 answers revealed
                </span>
                {flaggedCount > 0 && (
                  <span className="quiz-stat-pill">
                    {flaggedCount} flagged for review
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn-reset-quiz"
                onClick={handleResetQuiz}
              >
                Reset quiz
              </button>
            </div>

            {/* Questions List */}
            <div className="quiz-questions-list">
              {quizList.map((q, qIdx) => {
                const isRevealed = !!revealedAnswers[qIdx];
                const isFlagged = !!flaggedQuestions[qIdx];
                const selectedOptIdx = selectedMcqOptions[qIdx];

                return (
                  <div
                    key={qIdx}
                    className={`quiz-question-card ${
                      isRevealed ? "revealed" : ""
                    } ${isFlagged ? "reviewed" : ""}`}
                  >
                    {/* Header */}
                    <div className="quiz-card-header">
                      <div className="question-badges-group">
                        <span className="question-type-badge">
                          Question {qIdx + 1} ·{" "}
                          {q.type === "multiple_choice"
                            ? "Multiple Choice"
                            : "Short Answer"}
                        </span>
                      </div>

                      <div className="question-actions-top">
                        <button
                          type="button"
                          className={`btn-flag-review ${
                            isFlagged ? "active" : ""
                          }`}
                          onClick={() => toggleFlagQuestion(qIdx)}
                          title="Flag for review next"
                        >
                          <svg
                            className="flag-svg"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 14V2h9l-2 4 2 4H3" />
                          </svg>
                          <span>{isFlagged ? "Flagged" : "Review later"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <h3 className="question-prompt-text">{q.question}</h3>

                    {/* Multiple Choice Options */}
                    {q.type === "multiple_choice" && q.options && (
                      <div className="mcq-options-list">
                        {q.options.map((optText, optIdx) => {
                          const letters = ["A", "B", "C", "D"];
                          const letter = letters[optIdx] || `${optIdx + 1}`;
                          const isSelected = selectedOptIdx === optIdx;

                          // Check if this option matches the correct answer
                          const isCorrectOption =
                            isRevealed &&
                            (q.answer.toLowerCase().includes(optText.toLowerCase()) ||
                              q.answer.startsWith(letter) ||
                              optText.toLowerCase().includes(q.answer.toLowerCase()));

                          const isIncorrectSelected =
                            isRevealed && isSelected && !isCorrectOption;

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              className={`mcq-option-item ${
                                isSelected ? "selected" : ""
                              } ${isCorrectOption ? "correct" : ""} ${
                                isIncorrectSelected ? "incorrect" : ""
                              }`}
                              onClick={() => handleSelectOption(qIdx, optIdx)}
                            >
                              <span className="mcq-option-letter">
                                {letter}
                              </span>
                              <span className="mcq-option-text">{optText}</span>
                              {isCorrectOption && (
                                <span className="mcq-result-indicator">
                                  ✓ Correct
                                </span>
                              )}
                              {isIncorrectSelected && (
                                <span className="mcq-result-indicator">
                                  ✗ Selected
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Short Answer Input */}
                    {q.type === "short_answer" && (
                      <div className="short-answer-input-box">
                        <textarea
                          className="short-answer-textarea"
                          placeholder="Type your answer here before revealing..."
                          value={shortAnswers[qIdx] || ""}
                          onChange={(e) =>
                            setShortAnswers((prev) => ({
                              ...prev,
                              [qIdx]: e.target.value,
                            }))
                          }
                          rows={2}
                          aria-label={`Your answer for question ${qIdx + 1}`}
                        />
                        <span className="short-answer-hint">
                          Self-graded recall: practice writing your answer first.
                        </span>
                      </div>
                    )}

                    {/* Footer Controls */}
                    <div className="quiz-card-footer">
                      <button
                        type="button"
                        className="btn-reveal-answer"
                        onClick={() => toggleRevealAnswer(qIdx)}
                      >
                        <svg
                          className="reveal-icon"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
                          <circle cx="8" cy="8" r="2" />
                        </svg>
                        <span>{isRevealed ? "Hide answer" : "Reveal answer"}</span>
                      </button>

                      <button
                        type="button"
                        className="concept-source-pill"
                        onClick={() =>
                          setActiveEvidence({
                            sourceRef: q.sourceReference,
                            excerpt: q.sourceExcerpt,
                            contextTitle: `Question ${qIdx + 1} Citation`,
                          })
                        }
                      >
                        <svg
                          className="evidence-icon"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>{q.sourceReference}</span>
                      </button>
                    </div>

                    {/* Revealed Answer & Explanation Box */}
                    {isRevealed && (
                      <div className="answer-explanation-panel">
                        <div className="explanation-header">
                          <span className="explanation-label">Model Answer</span>
                        </div>
                        <p className="explanation-text" style={{ fontWeight: 600 }}>
                          {q.answer}
                        </p>
                        <p className="explanation-text">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          EVIDENCE DRAWER (Right Slide-Over)
          ==================================================================== */}
      {activeEvidence && (
        <div
          className="evidence-drawer-backdrop"
          onClick={() => setActiveEvidence(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Source Evidence"
        >
          <div
            className="evidence-drawer-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div className="drawer-title-group">
                <h3 className="drawer-title">Source Evidence</h3>
                <span className="drawer-source-pill">
                  {activeEvidence.sourceRef}
                </span>
              </div>

              <button
                type="button"
                className="btn-drawer-close"
                onClick={() => setActiveEvidence(null)}
                aria-label="Close evidence drawer"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="13" y1="3" x2="3" y2="13" />
                  <line x1="3" y1="3" x2="13" y2="13" />
                </svg>
              </button>
            </div>

            <div className="drawer-body">
              {activeEvidence.contextTitle && (
                <div className="evidence-section">
                  <span className="evidence-section-title">Context</span>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    {activeEvidence.contextTitle}
                  </p>
                </div>
              )}

              <div className="evidence-section">
                <span className="evidence-section-title">Verbatim Excerpt</span>
                <div className="evidence-quote-box">
                  <p className="evidence-quote-text">
                    &ldquo;{activeEvidence.excerpt}&rdquo;
                  </p>
                </div>
              </div>

              <div className="evidence-section">
                <span className="evidence-section-title">Citation Location</span>
                <div className="evidence-location-bar">
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
                    <circle cx="8" cy="8" r="7" />
                    <line x1="8" y1="4" x2="8" y2="8" />
                    <line x1="8" y1="12" x2="8.01" y2="12" />
                  </svg>
                  <span className="location-tag">
                    {activeEvidence.sourceRef}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          QUICK RECALL MODAL (Active Recall Flashcards across 5 questions)
          ==================================================================== */}
      {isRecallOpen && quizList.length > 0 && (
        <div
          className="quick-recall-backdrop"
          onClick={() => setIsRecallOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Quick Recall Session"
        >
          <div
            className="quick-recall-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="recall-modal-header">
              <h3 className="recall-modal-title">Quick Recall</h3>
              {!recallCompleted && (
                <span className="recall-step-counter">
                  {recallIndex + 1} of {quizList.length}
                </span>
              )}
              <button
                type="button"
                className="btn-recall-close"
                onClick={() => setIsRecallOpen(false)}
                aria-label="Close recall modal"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="13" y1="3" x2="3" y2="13" />
                  <line x1="3" y1="3" x2="13" y2="13" />
                </svg>
              </button>
            </div>

            {/* Progress Track */}
            <div className="recall-progress-bar-container">
              <div
                className="recall-progress-bar-fill"
                style={{
                  width: recallCompleted
                    ? "100%"
                    : `${((recallIndex + 1) / quizList.length) * 100}%`,
                }}
              />
            </div>

            <div className="recall-modal-body">
              {!recallCompleted ? (
                <>
                  <div
                    className={`recall-card ${recallRevealed ? "flipped" : ""}`}
                  >
                    <span className="recall-tag">
                      {quizList[recallIndex].type === "multiple_choice"
                        ? "Multiple Choice Prompt"
                        : "Short Answer Prompt"}
                    </span>

                    <h4 className="recall-question-text">
                      {quizList[recallIndex].question}
                    </h4>

                    {recallRevealed ? (
                      <div className="recall-answer-box">
                        <span className="recall-answer-label">Answer</span>
                        <p className="recall-answer-text">
                          {quizList[recallIndex].answer}
                        </p>
                        <p className="recall-key-point">
                          {quizList[recallIndex].explanation}
                        </p>
                      </div>
                    ) : (
                      <span className="recall-hint">
                        Formulate your answer mentally, then flip.
                      </span>
                    )}
                  </div>

                  <div className="recall-actions-bar">
                    {!recallRevealed ? (
                      <button
                        type="button"
                        className="btn-recall-flip"
                        onClick={handleFlipRecall}
                      >
                        Flip to reveal answer
                      </button>
                    ) : (
                      <div className="confidence-buttons-group">
                        <button
                          type="button"
                          className="btn-confidence-again"
                          onClick={() =>
                            handleRateRecallConfidence(recallIndex, false)
                          }
                        >
                          Review again
                        </button>
                        <button
                          type="button"
                          className="btn-confidence-gotit"
                          onClick={() =>
                            handleRateRecallConfidence(recallIndex, true)
                          }
                        >
                          Got it
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="recall-summary-card">
                  <h4 className="recall-summary-title">Recall Complete!</h4>
                  <div className="recall-summary-score">
                    {confidentCount} / {quizList.length}
                  </div>
                  <p className="recall-summary-message">
                    You felt confident on {confidentCount} of {quizList.length}{" "}
                    questions.
                  </p>

                  <div className="recall-summary-actions">
                    <button
                      type="button"
                      className="btn-recall-restart"
                      onClick={handleStartRecall}
                    >
                      Repeat session
                    </button>
                    <button
                      type="button"
                      className="btn-recall-done"
                      onClick={() => setIsRecallOpen(false)}
                    >
                      Finish
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sign In Prompt Dialog */}
      {showSignInModal && (
        <div
          className="evidence-drawer-backdrop"
          onClick={() => setShowSignInModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Sign in to save study pack"
        >
          <div
            className="auth-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "440px",
              margin: "auto",
              boxShadow: "var(--shadow-dropdown)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div className="drop-zone-icon-wrapper" style={{ margin: "0 auto", width: "3rem", height: "3rem" }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: "1.5rem", height: "1.5rem" }}
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <div>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                Sign in to save
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Sign in to save this study pack to your library. Your generated notes and practice questions remain saved locally in your browser.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Link
                href="/sign-in?next=/study/preview"
                className="btn-auth-primary"
                style={{ justifyContent: "center", textDecoration: "none" }}
              >
                Sign in
              </Link>
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => setShowSignInModal(false)}
                style={{ justifyContent: "center" }}
              >
                Keep working locally
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
