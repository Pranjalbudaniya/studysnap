import React from "react";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { AuthForm } from "../../components/auth-form";

export const metadata: Metadata = {
  title: "Sign in — StudySnap",
  description: "Sign in to your StudySnap revision space",
};

export default function SignInPage() {
  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="auth-page-main">
        <div className="auth-layout-grid">
          {/* Left Column: Form */}
          <div className="auth-form-column">
            <AuthForm mode="sign-in" />
          </div>

          {/* Right Column: Decorative Abstract Composition */}
          <div className="auth-deco-column" aria-hidden="true">
            <div className="auth-deco-stack">
              <div className="sheet-backdrop-1" />
              <div className="sheet-backdrop-2" />
              <div className="main-paper-sheet">
                <div className="paper-header">
                  <div className="paper-title-group">
                    <span className="source-chip">SESSION</span>
                    <span className="paper-meta-label">Revision Space</span>
                  </div>
                  <span className="subtle-flag">Ready</span>
                </div>
                <div className="simple-note-card">
                  <span className="note-label">Focused review</span>
                  <div className="note-heading">Saved Study Packs</div>
                  <p className="note-body">
                    Sign in to access your upcoming study packs and save revision notes across sessions.
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
