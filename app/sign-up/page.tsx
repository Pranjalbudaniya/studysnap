import React from "react";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { AuthForm } from "../../components/auth-form";

export const metadata: Metadata = {
  title: "Create Account — StudySnap",
  description: "Create an account to save your StudySnap study packs",
};

export default function SignUpPage() {
  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="auth-page-main">
        <div className="auth-layout-grid">
          {/* Left Column: Form */}
          <div className="auth-form-column">
            <AuthForm mode="sign-up" />
          </div>

          {/* Right Column: Decorative Abstract Composition */}
          <div className="auth-deco-column" aria-hidden="true">
            <div className="auth-deco-stack">
              <div className="sheet-backdrop-1" />
              <div className="sheet-backdrop-2" />
              <div className="main-paper-sheet">
                <div className="paper-header">
                  <div className="paper-title-group">
                    <span className="source-chip">ACCOUNT</span>
                    <span className="paper-meta-label">New Workspace</span>
                  </div>
                  <span className="subtle-flag">Setup</span>
                </div>
                <div className="simple-note-card">
                  <span className="note-label">One workflow</span>
                  <div className="note-heading">Clearer Revision</div>
                  <p className="note-body">
                    Create an account to keep your revision notes organized and practice questions ready whenever you study.
                  </p>
                </div>
                <div className="paper-footer-bar">
                  <span>STUDYSNAP</span>
                  <span>5 Questions per Lecture</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
