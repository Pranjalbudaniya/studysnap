import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy — StudySnap",
  description: "Privacy policy and data principles for StudySnap",
};

export default function PrivacyPage() {
  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="legal-page-main">
        <div className="legal-container">
          <div className="legal-header">
            <span className="section-label">LEGAL & PRIVACY</span>
            <h1 className="legal-heading">Privacy Policy</h1>
            <p className="legal-subtext">Last updated: September 2026</p>
          </div>

          <article className="legal-content">
            <section className="legal-section">
              <h2 className="legal-section-title">1. Our Commitment to Privacy</h2>
              <p>
                StudySnap is built with the principle of minimal data collection. Our purpose is to provide a focused, uncluttered tool for students and educators to turn lecture material into revision notes and five practice questions.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">2. Information We Collect</h2>
              <p>
                When you create an account, we store your email address and authentication credentials securely using our authentication provider (Supabase). If you use StudySnap as a guest, no account information is required or stored.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">3. Lecture Materials & Files</h2>
              <p>
                In future phases when document uploads become available, your materials will be processed strictly to generate your requested revision notes and practice questions. We do not sell, rent, or monetize your study materials.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">4. Third-Party Services</h2>
              <p>
                We use trusted infrastructure providers such as Supabase for secure user authentication and session management. These providers process data in accordance with their respective security and privacy standards.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">5. Contact</h2>
              <p>
                If you have any questions regarding this Privacy Policy, please reach out via our contact channels or return to the{" "}
                <Link href="/" className="legal-link">
                  home page
                </Link>
                .
              </p>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
