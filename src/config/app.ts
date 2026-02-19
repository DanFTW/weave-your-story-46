/**
 * Central app configuration.
 *
 * To change the base URL (e.g. migrating to weave.cloud), set the
 * VITE_APP_BASE_URL environment variable — no code changes needed.
 */
export const APP_BASE_URL =
  ((import.meta.env.VITE_APP_BASE_URL as string | undefined) ?? "https://weave-your-story-46.lovable.app")
    .replace(/\/$/, "");

/**
 * Build a canonical short share URL for a given token.
 * Format: <APP_BASE_URL>/s/<token>
 */
export function buildShareUrl(token: string): string {
  return `${APP_BASE_URL}/s/${token}`;
}
