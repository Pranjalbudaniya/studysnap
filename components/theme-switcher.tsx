"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";

interface ThemeOption {
  id: "light" | "matte" | "amoled" | "system";
  label: string;
  description: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "light",
    label: "Light",
    description: "Warm ivory & ink",
  },
  {
    id: "matte",
    label: "Matte Black",
    description: "Rich charcoal & graphite",
  },
  {
    id: "amoled",
    label: "AMOLED",
    description: "True black & contrast",
  },
  {
    id: "system",
    label: "System",
    description: "Follows OS preference",
  },
];

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!mounted) {
    return (
      <div className="theme-switcher-skeleton" aria-hidden="true">
        <span className="theme-switcher-placeholder">Theme</span>
      </div>
    );
  }

  const currentTheme = theme || "system";
  const activeOption =
    THEME_OPTIONS.find((opt) => opt.id === currentTheme) || THEME_OPTIONS[3];

  return (
    <div className="theme-switcher-container" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="theme-switcher-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current theme: ${activeOption.label}. Change theme`}
      >
        <span className="theme-icon-container" aria-hidden="true">
          {currentTheme === "light" && (
            <svg
              className="theme-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="10" cy="10" r="4" />
              <path d="M10 2v2m0 12v2M2 10h2m12 0h2m-2.93-5.07l-1.41 1.41m-7.32 7.32l-1.41 1.41m0-10.14l1.41 1.41m7.32 7.32l1.41 1.41" />
            </svg>
          )}
          {currentTheme === "matte" && (
            <svg
              className="theme-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
          {currentTheme === "amoled" && (
            <svg
              className="theme-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <circle cx="10" cy="10" r="7" />
              <circle cx="10" cy="10" r="4" fill="var(--bg-app)" />
            </svg>
          )}
          {currentTheme === "system" && (
            <svg
              className="theme-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="14" height="10" rx="2" />
              <line x1="7" y1="16" x2="13" y2="16" />
              <line x1="10" y1="13" x2="10" y2="16" />
            </svg>
          )}
        </span>
        <span className="theme-label">{activeOption.label}</span>
        <svg
          className={`theme-chevron ${isOpen ? "open" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 8 10 12 14 8" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="theme-dropdown-menu"
          role="listbox"
          aria-label="Theme options"
          tabIndex={-1}
        >
          <div className="theme-dropdown-header">
            <span className="theme-dropdown-title">APPEARANCE</span>
          </div>
          {THEME_OPTIONS.map((opt) => {
            const isSelected = currentTheme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`theme-option-btn ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <div className="theme-option-indicator" aria-hidden="true">
                  <span className={`theme-swatch swatch-${opt.id}`} />
                </div>
                <div className="theme-option-text">
                  <div className="theme-option-name">{opt.label}</div>
                  <div className="theme-option-desc">{opt.description}</div>
                </div>
                {isSelected && (
                  <svg
                    className="theme-check-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="4 10 8 14 16 6" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
