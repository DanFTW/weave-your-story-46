import { describe, it, expect } from "vitest";
import {
  detectEventReference,
  parseEventTitle,
  buildComposioPayload,
  sanitizeMemoryContent,
} from "../src/utils/calendarThread";

// ── detectEventReference ─────────────────────────────────────────────

describe("detectEventReference", () => {
  describe("positive — named dates", () => {
    it("detects 'Meeting on Monday at 3pm'", () => {
      expect(detectEventReference("Meeting on Monday at 3pm")).toBe(true);
    });
    it("detects 'Team sync on Wednesday'", () => {
      expect(detectEventReference("Team sync on Wednesday")).toBe(true);
    });
  });

  describe("positive — ordinal dates", () => {
    it("detects 'Dentist on the 15th'", () => {
      expect(detectEventReference("Dentist on the 15th")).toBe(true);
    });
    it("detects 'Party on the 3rd'", () => {
      expect(detectEventReference("Party on the 3rd")).toBe(true);
    });
    it("detects 'Something on the 22nd' (ordinal alone)", () => {
      expect(detectEventReference("Something on the 22nd")).toBe(true);
    });
  });

  describe("positive — relative dates", () => {
    it("detects 'Call mom tomorrow'", () => {
      expect(detectEventReference("Call mom tomorrow")).toBe(true);
    });
    it("detects 'Deadline next week'", () => {
      expect(detectEventReference("Deadline next week")).toBe(true);
    });
    it("detects 'Submit report in 2 days'", () => {
      expect(detectEventReference("Submit report in 2 days")).toBe(true);
    });
  });

  describe("positive — ISO dates", () => {
    it("detects '2025-03-10 standup'", () => {
      expect(detectEventReference("2025-03-10 standup")).toBe(true);
    });
  });

  describe("positive — time patterns", () => {
    it("detects 'Lunch at 12:30pm'", () => {
      expect(detectEventReference("Lunch at 12:30pm")).toBe(true);
    });
    it("detects 'Call at 14:00'", () => {
      expect(detectEventReference("Call at 14:00")).toBe(true);
    });
  });

  describe("positive — month + day", () => {
    it("detects 'January 5th birthday'", () => {
      expect(detectEventReference("January 5th birthday")).toBe(true);
    });
    it("detects 'March 22 conference'", () => {
      expect(detectEventReference("March 22 conference")).toBe(true);
    });
  });

  describe("negative cases", () => {
    it("rejects 'I like pizza'", () => {
      expect(detectEventReference("I like pizza")).toBe(false);
    });
    it("rejects 'The year 2025 was great'", () => {
      expect(detectEventReference("The year 2025 was great")).toBe(false);
    });
    it("rejects empty string", () => {
      expect(detectEventReference("")).toBe(false);
    });
    it("rejects generic opinion", () => {
      expect(detectEventReference("React is better than Angular")).toBe(false);
    });
  });
});

// ── buildComposioPayload ─────────────────────────────────────────────

describe("buildComposioPayload", () => {
  const base = {
    connectionId: "conn-123",
    title: "Standup",
    date: "2025-03-10",
    time: "14:00",
    description: "Daily standup meeting",
  };

  it("returns correct shape", () => {
    const payload = buildComposioPayload(base);
    expect(payload).toHaveProperty("connected_account_id", "conn-123");
    expect(payload).toHaveProperty("arguments.summary", "Standup");
    expect(payload).toHaveProperty("arguments.start_datetime");
    expect(payload).toHaveProperty("arguments.end_datetime");
    expect(payload).toHaveProperty("arguments.description");
    expect(payload).toHaveProperty("arguments.timezone");
  });

  it("defaults to 60-minute duration", () => {
    const payload = buildComposioPayload(base);
    expect(payload.arguments.start_datetime).toBe("2025-03-10T14:00:00");
    expect(payload.arguments.end_datetime).toBe("2025-03-10T15:00:00");
  });

  it("defaults to 09:00–10:00 when time is null", () => {
    const payload = buildComposioPayload({ ...base, time: null });
    expect(payload.arguments.start_datetime).toBe("2025-03-10T09:00:00");
    expect(payload.arguments.end_datetime).toBe("2025-03-10T10:00:00");
  });

  it("defaults description to empty string when null", () => {
    const payload = buildComposioPayload({ ...base, description: null });
    expect(payload.arguments.description).toBe("");
  });

  it("defaults timezone to America/New_York", () => {
    const payload = buildComposioPayload(base);
    expect(payload.arguments.timezone).toBe("America/New_York");
  });

  it("uses custom timezone when provided", () => {
    const payload = buildComposioPayload({ ...base, timezone: "Europe/London" });
    expect(payload.arguments.timezone).toBe("Europe/London");
  });

  it("throws when connectionId is empty", () => {
    expect(() =>
      buildComposioPayload({ ...base, connectionId: "" }),
    ).toThrow("connectionId is required");
  });

  it("throws when title is empty", () => {
    expect(() =>
      buildComposioPayload({ ...base, title: "" }),
    ).toThrow("title is required");
  });

  it("throws when date is empty", () => {
    expect(() =>
      buildComposioPayload({ ...base, date: "" }),
    ).toThrow("date is required");
  });
});

// ── sanitizeMemoryContent ────────────────────────────────────────────

describe("sanitizeMemoryContent", () => {
  it("strips HTML tags", () => {
    expect(sanitizeMemoryContent("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("collapses whitespace", () => {
    expect(sanitizeMemoryContent("hello    world\n\nfoo")).toBe("hello world foo");
  });

  it("trims leading/trailing whitespace", () => {
    expect(sanitizeMemoryContent("  spaced  ")).toBe("spaced");
  });

  it("decodes common HTML entities", () => {
    expect(sanitizeMemoryContent("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("returns empty string for empty/null input", () => {
    expect(sanitizeMemoryContent("")).toBe("");
    expect(sanitizeMemoryContent(null as any)).toBe("");
  });

  it("truncates at 2000 characters", () => {
    const long = "a".repeat(3000);
    const result = sanitizeMemoryContent(long);
    expect(result.length).toBe(2000);
    expect(result.endsWith("...")).toBe(true);
  });
});

// ── parseEventTitle ──────────────────────────────────────────────────

describe("parseEventTitle", () => {
  it("extracts title from event text", () => {
    const result = parseEventTitle("Team meeting on Monday at 3pm");
    expect(result).toBe("Team meeting");
  });

  it("extracts title with relative date", () => {
    const result = parseEventTitle("Call mom tomorrow");
    expect(result).toBeTruthy();
    expect(result!.toLowerCase()).toContain("call mom");
  });

  it("returns null for empty string", () => {
    expect(parseEventTitle("")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(parseEventTitle("   ")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseEventTitle(null as any)).toBeNull();
  });

  it("caps title at 120 characters", () => {
    const long = "A".repeat(200) + " on Monday";
    const result = parseEventTitle(long);
    expect(result!.length).toBeLessThanOrEqual(120);
  });
});
