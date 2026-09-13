import React from "react";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { AuthForm } from "../../components/auth-form";

export const metadata: Metadata = {
  title: "Reset Password — StudySnap",
  description: "Reset your StudySnap password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="page-wrapper">
      <SiteHeader />

      <main className="auth-page-main">
        <div className="auth-layout-grid single-col">
          <div className="auth-form-column">
            <AuthForm mode="forgot-password" />
          </div>
        </div>
      </main>
    </div>
  );
}
