/**
 * Pure, testable utilities for calendar-event-sync thread logic.
 * No side effects — no fetch, no Supabase, no DOM.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ComposioCalendarPayload {
  connected_account_id: string;
  arguments: {
    summary: string;
    start_datetime: string;
    end_datetime: string;
    description: string;
    timezone: string;
  };
}

export interface BuildPayloadParams {
  connectionId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm (24h)
  description: string | null;
  timezone?: string;
}

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_START = "09:00";
const DEFAULT_TIMEZONE = "America/New_York";
const MAX_CONTENT_LENGTH = 2000;

// ── Regex patterns ───────────────────────────────────────────────────

const DAY_NAMES =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;

const MONTH_NAMES =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?\b/i;

const ORDINAL_DATE = /\bthe\s+\d{1,2}(st|nd|rd|th)\b/i;

const RELATIVE_DATE =
  /\b(today|tomorrow|tonight|yesterday|next\s+(week|month|day|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in\s+\d+\s+(days?|weeks?|hours?))\b/i;

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;

const TIME_PATTERN = /\b(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm)\b/i;
const TIME_24H = /\bat\s+\d{1,2}:\d{2}\b/i;

const EVENT_KEYWORDS =
  /\b(meeting|appointment|deadline|party|dinner|lunch|breakfast|brunch|call|interview|concert|conference|workshop|webinar|session|reservation|flight|check-?in|standup|stand-up|sync|review|demo|presentation|birthday|anniversary|wedding|exam|class|lecture|dentist|doctor|visit|checkup|check-?up)\b/i;

// Combined pattern for any date-like token
const ANY_DATE_SIGNAL = new RegExp(
  [
    DAY_NAMES.source,
    MONTH_NAMES.source,
    ORDINAL_DATE.source,
    RELATIVE_DATE.source,
    ISO_DATE.source,
    TIME_PATTERN.source,
    TIME_24H.source,
  ].join("|"),
  "i",
);

// Date/time fragments to strip when extracting title
const DATE_TIME_STRIP = new RegExp(
  [
    // "on Monday", "on January 5th", "on the 15th", "on 2025-03-10"
    `\\bon\\s+(${DAY_NAMES.source}|${MONTH_NAMES.source}|${ORDINAL_DATE.source.replace("\\b", "")}|${ISO_DATE.source})`,
    // "at 3pm", "at 14:00"
    `\\b(at\\s+)?\\d{1,2}(:\\d{2})?\\s*(am|pm)\\b`,
    `\\bat\\s+\\d{1,2}:\\d{2}\\b`,
    // relative
    RELATIVE_DATE.source,
    // standalone ISO date
    ISO_DATE.source,
  ].join("|"),
  "gi",
);

// ── Public functions ─────────────────────────────────────────────────

/**
 * Heuristic: does this memory string likely reference a calendar event?
 */
export function detectEventReference(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;

  const hasDateSignal = ANY_DATE_SIGNAL.test(trimmed);
  const hasEventKeyword = EVENT_KEYWORDS.test(trimmed);

  // Strong signal: any date/time token present alongside an event keyword
  if (hasDateSignal && hasEventKeyword) return true;

  // Medium signal: explicit time reference (someone saying "at 3pm" likely means an event)
  if (TIME_PATTERN.test(trimmed) || TIME_24H.test(trimmed)) return true;

  // Medium signal: relative date ("tomorrow", "next week") — typically action-oriented
  if (RELATIVE_DATE.test(trimmed)) return true;

  // Month + day ("January 5th") is strong enough on its own
  if (MONTH_NAMES.test(trimmed)) return true;

  // ISO date on its own is a strong signal
  if (ISO_DATE.test(trimmed)) return true;

  return false;
}

/**
 * Extract a concise event title from memory text.
 * Strips date/time fragments, takes the first sentence, and trims.
 */
export function parseEventTitle(content: string): string | null {
  if (!content || typeof content !== "string") return null;

  // Take the first sentence / clause
  let text = content.split(/[.\n]/).filter((s) => s.trim().length > 0)[0] ?? "";

  // Strip date/time fragments
  text = text.replace(DATE_TIME_STRIP, " ");

  // Collapse whitespace
  text = text.replace(/\s{2,}/g, " ").trim();

  // Trim trailing prepositions left behind (e.g. "Meeting ")
  text = text.replace(/\s+(on|at|in|for|by)\s*$/i, "").trim();

  if (text.length === 0) return null;

  // Cap at 120 chars
  if (text.length > 120) text = text.slice(0, 117) + "...";

  return text;
}

/**
 * Build the Composio GOOGLECALENDAR_CREATE_EVENT payload.
 * Default 60-minute duration, 09:00 start when time is null.
 */
export function buildComposioPayload(params: BuildPayloadParams): ComposioCalendarPayload {
  const { connectionId, title, date, time, description, timezone } = params;

  if (!connectionId) {
    throw new Error("connectionId is required");
  }
  if (!title) {
    throw new Error("title is required");
  }
  if (!date) {
    throw new Error("date is required");
  }

  const tz = timezone ?? DEFAULT_TIMEZONE;
  const startTime = time ?? DEFAULT_START;

  // Parse hours/minutes
  const [h, m] = startTime.split(":").map(Number);
  const endH = h + 1; // 60-minute default duration
  const endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  return {
    connected_account_id: connectionId,
    arguments: {
      summary: title,
      start_datetime: `${date}T${startTime}:00`,
      end_datetime: `${date}T${endTime}:00`,
      description: description ?? "",
      timezone: tz,
    },
  };
}

/**
 * Strip HTML tags, collapse whitespace, trim, and truncate.
 */
export function sanitizeMemoryContent(content: string): string {
  if (!content || typeof content !== "string") return "";

  let result = content;

  // Strip HTML tags
  result = result.replace(/<[^>]*>/g, " ");

  // Decode common HTML entities (reuse logic from decodeHtmlEntities)
  result = result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse whitespace
  result = result.replace(/\s+/g, " ").trim();

  // Truncate
  if (result.length > MAX_CONTENT_LENGTH) {
    result = result.slice(0, MAX_CONTENT_LENGTH - 3) + "...";
  }

  return result;
}
