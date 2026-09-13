"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "./theme-switcher";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";

export function SiteHeader() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node) &&
        userBtnRef.current &&
        !userBtnRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isUserMenuOpen) {
        setIsUserMenuOpen(false);
        userBtnRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      window.location.href = "/";
    }
  };

  const handleReplayIntro = () => {
    setIsUserMenuOpen(false);
    router.push("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Helper to compute 1-2 initials
  const getInitials = () => {
    if (!user) return "U";
    const name = user.user_metadata?.full_name?.trim();
    if (name) {
      const parts = name.split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const isSignedIn = mounted && Boolean(user);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {/* Brand identity */}
        <Link href="/study" className="brand-lockup">
          <div className="brand-mark-wrapper" aria-hidden="true">
            <span className="brand-mark-symbol">S</span>
          </div>
          <div className="brand-text-block">
            <span className="brand-wordmark">StudySnap</span>
            <span className="brand-tagline">
              Focused study, without the noise.
            </span>
          </div>
        </Link>

        {/* Right side controls */}
        <div className="header-actions">
          {isSignedIn ? (
            <>
              <Link href="/study" className="nav-workspace-link">
                Study library
              </Link>

              {/* User initials avatar menu */}
              <div className="user-menu-container" ref={userMenuRef}>
                <button
                  ref={userBtnRef}
                  type="button"
                  className="user-avatar-btn"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-label="User account menu"
                >
                  <span className="user-initials-badge">{getInitials()}</span>
                </button>

                {isUserMenuOpen && (
                  <div className="user-dropdown-menu" role="menu">
                    <div className="user-dropdown-header">
                      <span className="user-email-label">{user?.email}</span>
                    </div>

                    <div className="user-dropdown-divider" />

                    <Link
                      href="/study"
                      role="menuitem"
                      className="user-dropdown-item"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <svg
                        className="dropdown-item-icon"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="3" width="14" height="14" rx="2" />
                        <line x1="7" y1="8" x2="13" y2="8" />
                        <line x1="7" y1="12" x2="11" y2="12" />
                      </svg>
                      <span>Study library</span>
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      className="user-dropdown-item"
                      onClick={handleReplayIntro}
                    >
                      <svg
                        className="dropdown-item-icon"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="4 10 8 6 12 10" />
                        <path d="M8 6v8" />
                      </svg>
                      <span>Replay intro</span>
                    </button>

                    <div className="user-dropdown-divider" />

                    <button
                      type="button"
                      role="menuitem"
                      className="user-dropdown-item signout"
                      onClick={handleSignOut}
                    >
                      <svg
                        className="dropdown-item-icon"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M7 17l-4-4 4-4" />
                        <path d="M3 13h10a4 4 0 004-4V5" />
                      </svg>
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/sign-in" className="btn-signin-link">
              <span>Sign in</span>
            </Link>
          )}

          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
