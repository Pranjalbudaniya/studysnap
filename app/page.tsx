"use client";

import React from "react";
import Link from "next/link";
import { SiteHeader } from "../components/site-header";

export default function HomePage() {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="page-wrapper">
      <SiteHeader />

      {/* ====================================================================
          1. HERO — Restored Phase 1 Visual Direction
          ==================================================================== */}
      <main className="hero-section" aria-label="StudySnap overview">
        <div className="hero-grid">
          {/* Left Column: Core Value & Call to Action */}
          <div className="hero-content">
            <div className="eyebrow-chip">
              <span className="eyebrow-dot" aria-hidden="true" />
              <span>STUDYSNAP</span>
            </div>

            <h1 className="hero-heading">
              <span className="hero-heading-lead">Study deeper.</span>
              <span className="hero-heading-sub">Revise clearer.</span>
            </h1>

            <p className="hero-description">
              Turn lecture material into focused revision notes and five practice
              questions—without the noise.
            </p>

            <div className="hero-cta-group">
              <Link href="/study" className="btn-primary-action">
                <span>Start studying</span>
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

              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => scrollToSection("how-it-works")}
              >
                <span>How it works</span>
              </button>
            </div>

            <div className="hero-neutral-note">
              A focused space for turning lecture material into study-ready notes.
            </div>
          </div>

          {/* Right Column: Abstract Layered-Paper Composition */}
          <div
            className="abstract-composition-container"
            aria-label="Abstract visual composition of study notes and questions"
          >
            <div className="document-stack">
              <div className="sheet-backdrop-1" aria-hidden="true" />
              <div className="sheet-backdrop-2" aria-hidden="true" />

              <div className="main-paper-sheet">
                {/* Header with subtle chip and flag */}
                <div className="paper-header">
                  <div className="paper-title-group">
                    <span className="source-chip">p. 12</span>
                    <span className="paper-meta-label">Lecture Notes · Chapter 2</span>
                  </div>
                  <span className="subtle-flag">Review note</span>
                </div>

                {/* Simple Note Card */}
                <div className="simple-note-card">
                  <span className="note-label">Key concept</span>
                  <div className="note-heading">Core Principles</div>
                  <p className="note-body">
                    Main ideas and definitions extracted directly from the
                    lecture material for clear, structured review.
                  </p>
                </div>

                {/* Small Question Card */}
                <div className="small-question-card">
                  <div className="question-meta">
                    <span className="question-tag">Practice question</span>
                    <span className="source-chip">Active Recall</span>
                  </div>
                  <div className="question-text">
                    Which method best reinforces active recall during revision?
                  </div>
                  <div className="question-choices">
                    <div className="choice-item selected">
                      <span className="choice-dot">A</span>
                      <span>Self-testing with targeted questions</span>
                    </div>
                    <div className="choice-item">
                      <span className="choice-dot">B</span>
                      <span>Passive re-reading of full slides</span>
                    </div>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="paper-footer-bar">
                  <span>STUDYSNAP</span>
                  <span>5 Practice Questions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ====================================================================
          2. WORKFLOW SECTION
          ==================================================================== */}
      <section
        id="how-it-works"
        className="workflow-section"
        aria-label="How StudySnap works"
      >
        <div className="workflow-container">
          <div className="section-header">
            <span className="section-label">WORKFLOW</span>
            <h2 className="section-heading">How StudySnap works.</h2>
            <p className="section-subtext">
              A single, uncluttered path from raw lecture material to
              study-ready revision.
            </p>
          </div>

          <div className="workflow-grid">
            <div className="workflow-card">
              <span className="workflow-card-step">01 — UPLOAD</span>
              <h3 className="workflow-card-title">Bring the lecture.</h3>
              <p className="workflow-card-desc">
                Designed to process lecture slides and documents into structured
                study packs. Upload support is coming next.
              </p>
            </div>

            <div className="workflow-card">
              <span className="workflow-card-step">02 — STRUCTURE</span>
              <h3 className="workflow-card-title">Extract key concepts.</h3>
              <p className="workflow-card-desc">
                Organize dense lecture content into clean, readable revision
                notes highlighting key ideas and definitions.
              </p>
            </div>

            <div className="workflow-card">
              <span className="workflow-card-step">03 — PRACTICE</span>
              <h3 className="workflow-card-title">Five practice questions.</h3>
              <p className="workflow-card-desc">
                Reinforce what you reviewed with exactly five targeted recall
                questions generated from the same material.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. PRINCIPLES / VALUE SECTION
          ==================================================================== */}
      <section
        className="principles-section"
        aria-label="Core design principles"
      >
        <div className="section-header" style={{ marginBottom: "3rem" }}>
          <span className="section-label">DESIGN PRINCIPLES</span>
          <h2 className="section-heading">Built to keep revision simple.</h2>
        </div>

        <div className="principles-grid">
          <div className="principle-card">
            <h3 className="principle-card-title">Single focus</h3>
            <p className="principle-card-desc">
              One document turns into one concise study pack, without distracting
              features or unnecessary complexity.
            </p>
          </div>

          <div className="principle-card">
            <h3 className="principle-card-title">Grounded notes</h3>
            <p className="principle-card-desc">
              Notes and questions are built directly from your lecture text so
              your review stays aligned with course material.
            </p>
          </div>

          <div className="principle-card">
            <h3 className="principle-card-title">Active recall</h3>
            <p className="principle-card-desc">
              Exactly five focused questions per lecture help test your retention
              while the ideas are fresh.
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. FINAL CTA
          ==================================================================== */}
      <section className="final-cta-section" aria-label="Get started with StudySnap">
        <div className="final-cta-card">
          <span className="cta-eyebrow">GET STARTED</span>
          <h2 className="cta-heading">Ready when your next lecture is.</h2>
          <p className="cta-description">
            One focused space for turning lecture material into revision notes and
            five practice questions.
          </p>

          <Link href="/study" className="btn-primary-action">
            <span>Start studying</span>
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

          <div className="cta-neutral-note">
            Upload support is coming next.
          </div>
        </div>
      </section>

      {/* ====================================================================
          5. FOOTER
          ==================================================================== */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-top-row">
            {/* Brand Block */}
            <div className="footer-brand">
              <div className="footer-wordmark">StudySnap</div>
              <p className="footer-tagline">
                Focused study, without the noise.
              </p>
            </div>

            {/* Navigation Links */}
            <nav className="footer-nav-groups" aria-label="Footer navigation">
              <button
                type="button"
                className="footer-link"
                onClick={() => scrollToSection("how-it-works")}
              >
                How it works
              </button>
              <Link href="/privacy" className="footer-link">
                Privacy policy
              </Link>
              <Link href="/terms" className="footer-link">
                Terms
              </Link>
            </nav>
          </div>

          <div className="footer-bottom-row">
            <span>© 2026 StudySnap.</span>

            <button
              type="button"
              className="footer-replay-btn"
              onClick={scrollToTop}
              title="Smoothly scroll back to top"
            >
              <span>Replay intro</span>
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
                <polyline points="4 10 8 6 12 10" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
