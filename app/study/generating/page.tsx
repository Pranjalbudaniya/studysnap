import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../../components/site-header";
import { GenerationProgress } from "../../../components/generation-progress";

export const metadata: Metadata = {
  title: "Generating Study Pack — StudySnap",
  description: "Organizing your material into focused notes and practice questions",
};

export default function GeneratingPage() {
  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="generating-main">
        <div className="generating-container">
          {/* Back Navigation */}
          <div className="generating-nav-bar">
            <Link href="/study/new" className="back-to-workspace-link">
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
              <span>Back to material</span>
            </Link>
          </div>

          <GenerationProgress />
        </div>
      </main>
    </div>
  );
}
