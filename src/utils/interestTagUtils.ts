/**
 * Shared utilities for cleaning, normalizing, and deduplicating interest tags.
 *
 * Used by both the configure screen and the active-monitoring sync flow
 * to ensure tags like "My interests and hobbies include: tech" are
 * reduced to a clean "Tech" before display.
 */

const CONVERSATIONAL_PREFIXES: RegExp[] = [
  /^(?:my\s+)?(?:interests?(?:\s+and\s+hobbies?)?|hobbies?)\s+include\s*:?\s*/i,
  /^i(?:'m|\s+am)\s+into\s+/i,
  /^i\s+(?:love|enjoy|like)\s+/i,
  /^(?:passionate about|interested in|fan of|obsessed with)\s+/i,
];

const CONVERSATIONAL_SUFFIXES: RegExp[] = [
  /\s+is\s+(?:one\s+of\s+)?(?:my\s+)?(?:interests?(?:\s+and\s+hobbies?)?|hobbies?)\s*$/i,
];

const MAX_TAG_LENGTH = 60;

/**
 * Strip conversational prefixes, collapse whitespace, title-case,
 * and reject anything still longer than MAX_TAG_LENGTH (likely a sentence).
 */
export function cleanInterestTag(raw: string): string {
  let cleaned = raw.trim();
  for (const prefix of CONVERSATIONAL_PREFIXES) {
    cleaned = cleaned.replace(prefix, "");
  }
  for (const suffix of CONVERSATIONAL_SUFFIXES) {
    cleaned = cleaned.replace(suffix, "");
  }
  cleaned = cleaned
    .replace(/[.,;!]+$/, "")       // trailing punctuation
    .replace(/\s+/g, " ")          // collapse whitespace
    .trim();

  if (cleaned.length === 0 || cleaned.length > MAX_TAG_LENGTH) return "";

  // Title-case
  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Split a raw interest string (comma/semicolon-delimited) into
 * cleaned, deduplicated tags.
 */
export function parseAndDeduplicateInterestTags(raw: string): string[] {
  const tags = raw
    .split(/[,;]/)
    .map(cleanInterestTag)
    .filter(Boolean);

  // Case-insensitive dedup, preserving first occurrence
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}

/**
 * Filter tags against a comma-separated blocklist.
 * Blocked terms never reappear from sync/prefill.
 */
export function filterBlockedInterests(tags: string[], blocklist: string | null): string[] {
  if (!blocklist) return tags;
  const blocked = new Set(
    blocklist.split(",").map(b => b.trim().toLowerCase()).filter(Boolean)
  );
  return tags.filter(t => !blocked.has(t.toLowerCase()));
}
  const tags = raw
    .split(/[,;]/)
    .map(cleanInterestTag)
    .filter(Boolean);

  // Case-insensitive dedup, preserving first occurrence
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}
