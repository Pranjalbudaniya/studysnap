"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { MaterialImporter } from "../../../components/material-importer";

export default function NewStudyPackPage() {
  const router = useRouter();

  useEffect(() => {
    document.title = "New Study Pack — StudySnap";

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest(".btn-auth-primary");
      if (btn && !btn.hasAttribute("disabled")) {
        // Small timeout allows MaterialImporter's persistDraft to finish saving to IndexedDB
        setTimeout(() => {
          router.push("/study/generating");
        }, 250);
      }
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="new-study-main">
        <div className="new-study-container">
          {/* Back Navigation Bar */}
          <div className="new-study-nav-bar">
            <Link href="/study" className="back-to-workspace-link">
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
          </div>

          <MaterialImporter />
        </div>
      </main>
    </div>
  );
}

