/**
 * Resolves the canonical site URL for authentication redirects.
 * Prioritizes:
 * 1. NEXT_PUBLIC_SITE_URL (explicitly configured production domain)
 * 2. window.location.origin (when running in browser)
 * 3. NEXT_PUBLIC_VERCEL_URL (set automatically by Vercel)
 * 4. RENDER_EXTERNAL_URL (set automatically by Render)
 * 5. Fallback to http://localhost:3000 for local development
 */
export function getSiteUrl(): string {
  let url = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!url && typeof window !== "undefined" && window.location.origin) {
    url = window.location.origin;
  }

  if (!url && process.env.NEXT_PUBLIC_VERCEL_URL) {
    url = process.env.NEXT_PUBLIC_VERCEL_URL;
  }

  if (!url && process.env.RENDER_EXTERNAL_URL) {
    url = process.env.RENDER_EXTERNAL_URL;
  }

  url = url || "http://localhost:3000";

  // Ensure protocol
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Remove trailing slashes
  return url.replace(/\/+$/, "");
}
