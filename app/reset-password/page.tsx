import React from "react";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { AuthForm } from "../../components/auth-form";

export const metadata: Metadata = {
  title: "Set New Password — StudySnap",
  description: "Set a new password for your StudySnap account",
};

export default function ResetPasswordPage() {
  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="auth-page-main">
        <div className="auth-layout-grid single-col">
          <div className="auth-form-column">
            <AuthForm mode="reset-password" />
          </div>
        </div>
      </main>
    </div>
  );
}
