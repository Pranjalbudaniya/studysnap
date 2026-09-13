"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { StudyPack } from "../lib/supabase/server";

export interface StudyWorkspaceData {
  status: "guest" | "empty" | "library" | "migration_missing" | "error";
  user?: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; name?: string };
  } | null;
  studyPacks?: StudyPack[];
}

interface StudyWorkspaceProps {
  initialData: StudyWorkspaceData;
}

export function StudyWorkspace({ initialData }: StudyWorkspaceProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 3500);
  };

  // Helper to extract first name
  const getFirstName = () => {
    if (!initialData.user) return "there";
    const fullName =
      initialData.user.user_metadata?.full_name ||
      initialData.user.user_metadata?.name;
    if (fullName?.trim()) {
      return fullName.trim().split(/\s+/)[0];
    }
    if (initialData.user.email) {
      const emailPrefix = initialData.user.email.split("@")[0];
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }
    return "there";
  };

  // Helper to format date
  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // 1. GUEST STATE (Signed out visitor)
  if (initialData.status === "guest") {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span>Study library</span>
          </div>

          <h1 className="workspace-heading">Start with one lecture.</h1>

          <p className="workspace-description">
            Sign in to build a revision library you can return to.
          </p>
        </div>

        <div className="guest-workspace-card">
          <div className="guest-card-content">
            <div className="drop-zone-icon-wrapper" aria-hidden="true">
              <svg
                className="drop-zone-icon"
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

            <div className="guest-actions-group">
              <Link href="/study/new" className="btn-primary-action">
                <span>Start a new study pack</span>
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

              <Link href="/sign-in" className="btn-secondary-action">
                <span>Sign in to save study packs</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. MIGRATION MISSING STATE
  if (initialData.status === "migration_missing") {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span>Study library</span>
          </div>

          <h1 className="workspace-heading">Database setup needed.</h1>
        </div>

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
            <h2 className="alert-box-title">Setup Required</h2>
            <p className="alert-box-text">
              Your study library is almost ready. Run the StudySnap database migration to finish setup.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. QUERY ERROR STATE
  if (initialData.status === "error") {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span>Study library</span>
          </div>

          <h1 className="workspace-heading">Workspace unavailable.</h1>
        </div>

        <div className="workspace-alert-box error" role="alert">
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
          <div className="alert-box-body">
            <h2 className="alert-box-title">Query Notice</h2>
            <p className="alert-box-text">
              We couldn’t load your study library right now. Try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. SIGNED-IN USER WITH ZERO STUDY PACKS (ONBOARDING STATE)
  if (initialData.status === "empty") {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span>Study library</span>
          </div>

          <h1 className="workspace-heading">
            Your revision library starts here.
          </h1>

          <p className="workspace-description">
            Your first lecture can become focused notes and five practice questions.
          </p>
        </div>

        {/* Central Onboarding Panel */}
        <div className="workspace-panel-card">
          <div className="panel-document-drop-zone">
            <div className="drop-zone-icon-wrapper" aria-hidden="true">
              <svg
                className="drop-zone-icon"
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

            <div className="drop-zone-format-tag">PDF · DOCX · PPTX</div>

            <h2 className="drop-zone-title">Start your first study pack</h2>

            <p className="drop-zone-subtitle">
              Combine lecture slides, readings, or notes into focused revision.
            </p>

            <Link href="/study/new" className="btn-primary-action">
              <span>Create study pack</span>
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

        {/* Reassuring note */}
        <div className="workspace-note-card">
          <div className="workspace-note-content">
            <svg
              className="note-status-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="8" />
              <line x1="10" y1="7" x2="10" y2="11" />
              <circle cx="10" cy="14" r="0.75" fill="currentColor" />
            </svg>
            <span className="workspace-note-text">
              You’re signed in. Your saved study packs will appear here.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 5. SIGNED-IN USER WITH ONE OR MORE STUDY PACKS (PERSONAL LIBRARY VIEW)
  const packs = initialData.studyPacks || [];
  const packCountText = `${packs.length} ${packs.length === 1 ? "saved pack" : "saved packs"}`;

  return (
    <div className="workspace-container">
      {/* Toast Notification */}
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

      {/* Workspace Top Header */}
      <div className="workspace-top-bar">
        <div className="workspace-header">
          <div className="eyebrow-chip">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span>Study library</span>
          </div>

          <h1 className="workspace-heading">
            Welcome back, {getFirstName()}.
          </h1>

          <p className="workspace-description">
            Pick up a revision session or start a new one.
          </p>
        </div>

        <div className="workspace-top-actions">
          <Link href="/study/new" className="btn-primary-action small">
            <span>New study pack</span>
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
          </Link>
        </div>
      </div>

      {/* Library Section */}
      <div className="library-section">
        <div className="library-section-header">
          <div className="library-title-group">
            <h2 className="library-heading">Your study packs</h2>
            <span className="library-count-chip">{packCountText}</span>
          </div>
        </div>

        {/* Responsive Grid of Real Cards */}
        <div className="study-packs-grid">
          {/* First card: New study pack action */}
          <Link href="/study/new" className="study-pack-card new-pack-card-action">
            <div className="new-pack-icon-wrapper" aria-hidden="true">
              <svg
                className="new-pack-svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <h3 className="new-pack-card-title">New study pack</h3>
            <p className="new-pack-card-subtitle">
              Add slides, notes, or readings
            </p>
          </Link>

          {packs.map((pack) => {
            const reviewCount = Array.isArray(pack.review_flags)
              ? pack.review_flags.length
              : 0;

            return (
              <div
                key={pack.id}
                className="study-pack-card"
                onClick={() =>
                  showToast("Opening saved study packs arrives in the next phase.")
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    showToast("Opening saved study packs arrives in the next phase.");
                  }
                }}
                aria-label={`Study pack: ${pack.title}`}
              >
                {/* Top row: Subject & Date */}
                <div className="pack-card-top-row">
                  <div className="pack-subject-tag">
                    {pack.subject?.trim() || "General Study"}
                  </div>

                  <span className="pack-card-date">
                    {formatDate(pack.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="pack-card-title">{pack.title}</h3>

                {/* Source File Name if available */}
                {pack.source_file_name && (
                  <div className="pack-card-source">
                    <svg
                      className="pack-source-icon"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6l-5-5z" />
                      <polyline points="9 1 9 6 14 6" />
                    </svg>
                    <span className="source-file-truncate">
                      {pack.source_file_name}
                    </span>
                  </div>
                )}

                {/* Bottom Footer: Flags & Status */}
                <div className="pack-card-footer">
                  <span className="pack-status-badge">Ready to revise</span>

                  {reviewCount > 0 && (
                    <span className="pack-flag-badge">
                      <svg
                        className="flag-icon"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M3 2v12h1.5V9.5h6.5l-1-3 1-3.5H4.5V2H3z" />
                      </svg>
                      <span>{reviewCount} flagged</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
