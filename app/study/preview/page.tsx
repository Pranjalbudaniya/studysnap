import React from "react";
import type { Metadata } from "next";
import { SiteHeader } from "../../../components/site-header";
import { StudyPackPreview } from "../../../components/study-pack-preview";

export const metadata: Metadata = {
  title: "Study Pack — StudySnap",
  description: "Focused revision notes, practice quiz, and source evidence",
};


export default function StudyPreviewPage() {
  return (
    <div className="page-wrapper preview-page-wrapper">
      <SiteHeader />

      <main className="preview-main">
        <StudyPackPreview />
      </main>
    </div>
  );
}
