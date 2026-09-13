import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";

export const metadata: Metadata = {
  title: "Terms of Service — StudySnap",
  description: "Terms of service and usage guidelines for StudySnap",
};

export default function TermsPage() {
  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="legal-page-main">
        <div className="legal-container">
          <div className="legal-header">
            <span className="section-label">LEGAL & TERMS</span>
            <h1 className="legal-heading">Terms of Service</h1>
            <p className="legal-subtext">Last updated: September 2026</p>
          </div>

          <article className="legal-content">
            <section className="legal-section">
              <h2 className="legal-section-title">1. Acceptance of Terms</h2>
              <p>
                By accessing or using StudySnap, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">2. Use of the Service</h2>
              <p>
                StudySnap is designed for personal academic revision and study purposes. You agree to use the service in compliance with all applicable laws and regulations.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">3. Account Responsibilities</h2>
              <p>
                When you create an account, you are responsible for maintaining the confidentiality of your credentials. You agree to notify us immediately of any unauthorized access to your account.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">4. Educational Content & Disclaimers</h2>
              <p>
                StudySnap provides automated study assistance and note structuring. While we strive for accuracy, users are encouraged to verify important study concepts against their primary academic sources and instructors.
              </p>
            </section>

            <section className="legal-section">
              <h2 className="legal-section-title">5. Changes to Terms</h2>
              <p>
                We may periodically update these Terms. Continued use of StudySnap following updates constitutes your acceptance of the revised Terms. Return to the{" "}
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
