"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";
import { getSiteUrl } from "../lib/supabase/url";

interface AuthFormProps {
  mode: "sign-in" | "sign-up" | "forgot-password" | "reset-password";
}

export function AuthForm(props: AuthFormProps) {
  return (
    <React.Suspense fallback={<div className="auth-card-container"><div className="auth-card" style={{ minHeight: "360px" }} /></div>}>
      <AuthFormContent {...props} />
    </React.Suspense>
  );
}

function AuthFormContent({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState<boolean>(() => isSupabaseConfigured());

  useEffect(() => {
    setConfigured(isSupabaseConfigured());

    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    if (errorParam) {
      if (errorParam === "auth_callback_failed") {
        setErrorMessage("Authentication link expired or invalid. Please try again.");
      } else {
        setErrorMessage(errorDescription || "Authentication error occurred.");
      }
    }

    if (mode === "reset-password" && isSupabaseConfigured()) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setHasValidSession(Boolean(session));
      });
    }
  }, [searchParams, mode]);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    if (!configured) {
      setErrorMessage("Authentication is not configured yet. Add the Supabase public environment variables to continue.");
      return;
    }

    setIsGoogleLoading(true);
    try {
      const supabase = createClient();
      const siteUrl = getSiteUrl();
      const redirectUrl = `${siteUrl}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setErrorMessage("Unable to connect with Google. Please try again.");
        setIsGoogleLoading(false);
      }
    } catch {
      setErrorMessage("Network error connecting to authentication service.");
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!configured) {
      setErrorMessage("Authentication is not configured yet. Add the Supabase public environment variables to continue.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const siteUrl = getSiteUrl();

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("invalid login credentials") || msg.includes("invalid_grant")) {
            setErrorMessage("Invalid email or password. Please try again.");
          } else if (msg.includes("email not confirmed")) {
            setErrorMessage("Please confirm your email address before signing in.");
          } else {
            setErrorMessage("Unable to sign in. Please verify your credentials and try again.");
          }
          setIsLoading(false);
        } else {
          window.location.href = "/study";
        }
      } else if (mode === "sign-up") {
        if (password.length < 8) {
          setErrorMessage("Password must be at least 8 characters.");
          setIsLoading(false);
          return;
        }

        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${siteUrl}/auth/callback`,
            data: {
              full_name: name.trim() || undefined,
            },
          },
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("already registered") || msg.includes("user_already_exists")) {
            setErrorMessage("An account with this email already exists. Try signing in instead.");
          } else {
            setErrorMessage("Unable to create account. Please check your information and try again.");
          }
          setIsLoading(false);
        } else if (data?.user && !data.session) {
          // Confirmation email required
          setSuccessMessage("Check your inbox (and spam folder) to confirm your email.");
          setIsLoading(false);
        } else {
          window.location.href = "/study";
        }
      } else if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("rate limit") || msg.includes("too many requests")) {
            setErrorMessage("Too many reset requests. Please wait a few minutes before trying again.");
          } else {
            setErrorMessage("Unable to send reset email. Please try again later.");
          }
        } else {
          setSuccessMessage(
            "If an account exists for that email, we’ve sent a reset link. Please check your inbox and spam folder."
          );
        }
        setIsLoading(false);
      } else if (mode === "reset-password") {
        if (password.length < 8) {
          setErrorMessage("Password must be at least 8 characters.");
          setIsLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMessage("Passwords do not match. Please re-enter your password.");
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        if (error) {
          setErrorMessage(error.message || "Unable to update password. The link may have expired.");
          setIsLoading(false);
        } else {
          setSuccessMessage("Your password has been successfully updated! Redirecting to study workspace...");
          setTimeout(() => {
            window.location.href = "/study";
          }, 1500);
        }
      }
    } catch {
      setErrorMessage("Network error occurred. Please check your connection.");
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card-container">
      {/* Configuration warning banner */}
      {!configured && (
        <div className="auth-alert warning" role="alert">
          <svg
            className="alert-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="8" />
            <line x1="10" y1="7" x2="10" y2="11" />
            <circle cx="10" cy="14" r="0.75" fill="currentColor" />
          </svg>
          <div className="alert-text">
            <strong>Configuration Notice:</strong> Authentication is not configured yet. Add the Supabase public environment variables to continue.
          </div>
        </div>
      )}

      {/* Mode reset-password without active session warning */}
      {mode === "reset-password" && hasValidSession === false && (
        <div className="auth-alert warning" role="alert">
          <svg
            className="alert-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="8" />
            <line x1="10" y1="7" x2="10" y2="11" />
            <circle cx="10" cy="14" r="0.75" fill="currentColor" />
          </svg>
          <div className="alert-text">
            No active password reset session found. Please click the link in your email or{" "}
            <Link href="/forgot-password" className="form-link-inline">
              request a new reset link
            </Link>.
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="auth-alert error" role="alert">
          <svg
            className="alert-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="8" />
            <line x1="12" y1="8" x2="8" y2="12" />
            <line x1="8" y1="8" x2="12" y2="12" />
          </svg>
          <div className="alert-text">{errorMessage}</div>
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <div className="auth-alert success" role="status">
          <svg
            className="alert-icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 10l3 3L15 6" />
          </svg>
          <div className="alert-text">{successMessage}</div>
        </div>
      )}

      {/* Main card */}
      <div className="auth-card">
        {/* Header */}
        <div className="auth-card-header">
          {mode === "sign-in" && (
            <>
              <h1 className="auth-heading">Welcome back.</h1>
              <p className="auth-subtext">
                Pick up where your study session left off.
              </p>
            </>
          )}
          {mode === "sign-up" && (
            <>
              <h1 className="auth-heading">Build your revision space.</h1>
              <p className="auth-subtext">
                Save study packs when you are ready.
              </p>
            </>
          )}
          {mode === "forgot-password" && (
            <>
              <h1 className="auth-heading">Reset your password.</h1>
              <p className="auth-subtext">
                We’ll send a secure reset link if an account exists for this email.
              </p>
            </>
          )}
          {mode === "reset-password" && (
            <>
              <h1 className="auth-heading">Set a new password.</h1>
              <p className="auth-subtext">
                Choose a strong new password for your StudySnap account.
              </p>
            </>
          )}
        </div>

        {/* Google OAuth (only for sign-in) */}
        {mode === "sign-in" && (
          <>
            <button
              type="button"
              className="btn-google-oauth"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
            >
              <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.45 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27A7.18 7.18 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.26A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.26 5.42l4.02-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.29 2.55 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{isGoogleLoading ? "Connecting..." : "Continue with Google"}</span>
            </button>

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>
          </>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="auth-form-fields">
          {mode === "sign-up" && (
            <div className="form-group">
              <label htmlFor="name-input" className="form-label">
                Full Name <span className="label-optional">(optional)</span>
              </label>
              <input
                id="name-input"
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {mode !== "reset-password" && (
            <div className="form-group">
              <label htmlFor="email-input" className="form-label">
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                required
                className="form-input"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          )}

          {mode !== "forgot-password" && (
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="password-input" className="form-label">
                  {mode === "reset-password" ? "New Password" : "Password"}
                </label>
                {mode === "sign-in" && (
                  <Link
                    href="/forgot-password"
                    className="form-link-subtle"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>

              <div className="password-input-wrapper">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  className="form-input password-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      className="toggle-icon"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.303 6.546A10.048 10.048 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.11 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg
                      className="toggle-icon"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" />
                    </svg>
                  )}
                </button>
              </div>

              {(mode === "sign-up" || mode === "reset-password") && (
                <span className="form-helper-text">
                  Use at least 8 characters.
                </span>
              )}
            </div>
          )}

          {mode === "reset-password" && (
            <div className="form-group">
              <label htmlFor="confirm-password-input" className="form-label">
                Confirm New Password
              </label>

              <div className="password-input-wrapper">
                <input
                  id="confirm-password-input"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  className="form-input password-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg
                      className="toggle-icon"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.303 6.546A10.048 10.048 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.11 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg
                      className="toggle-icon"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === "sign-up" && (
            <div className="terms-checkbox-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="terms-checkbox"
                />
                <span>
                  I agree to the <Link href="/terms" className="form-link-inline">Terms</Link> and <Link href="/privacy" className="form-link-inline">Privacy Policy</Link>.
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            className="btn-auth-primary"
            disabled={isLoading || isGoogleLoading || (mode === "sign-up" && !termsAgreed)}
          >
            {isLoading ? (
              <span>Please wait...</span>
            ) : mode === "sign-in" ? (
              <span>Sign in</span>
            ) : mode === "sign-up" ? (
              <span>Create account</span>
            ) : mode === "forgot-password" ? (
              <span>Send reset link</span>
            ) : (
              <span>Update password</span>
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="auth-card-footer">
          {mode === "sign-in" && (
            <>
              <div className="auth-switch-text">
                New to StudySnap?{" "}
                <Link href="/sign-up" className="form-link-action">
                  Create an account
                </Link>
              </div>
              <div className="auth-guest-row">
                <Link href="/study" className="btn-guest-action">
                  Continue without an account →
                </Link>
              </div>
            </>
          )}

          {mode === "sign-up" && (
            <div className="auth-switch-text">
              Already have an account?{" "}
              <Link href="/sign-in" className="form-link-action">
                Sign in
              </Link>
            </div>
          )}

          {(mode === "forgot-password" || mode === "reset-password") && (
            <div className="auth-switch-text">
              Remember your password?{" "}
              <Link href="/sign-in" className="form-link-action">
                Back to Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
