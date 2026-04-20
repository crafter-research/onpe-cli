// cligentic block: error-map
//
// Typed error class with code, name, human message, and hint. Maps
// upstream API errors to actionable messages. Agents read the hint
// field to self-correct.
//
// Usage:
//   import { AppError, mapError } from "./foundation/error-map";
//
//   const errors = {
//     "AUTH_EXPIRED": { name: "AuthExpired", human: "Session expired.", hint: "Run: myapp login" },
//     "RATE_LIMIT":  { name: "RateLimit", human: "Too many requests.", hint: "Wait 60s and retry." },
//   };
//
//   try { await api.call(); }
//   catch (err) { throw mapError(err, errors); }

export type ErrorEntry = {
  name: string;
  human: string;
  hint?: string;
};

export type ErrorMap = Record<string, ErrorEntry>;

export class AppError extends Error {
  code: string;
  human: string;
  hint?: string;

  constructor(code: string, entry: ErrorEntry, cause?: unknown) {
    super(entry.human);
    this.name = entry.name;
    this.code = code;
    this.human = entry.human;
    this.hint = entry.hint;
    if (cause) this.cause = cause;
  }

  toJSON() {
    return {
      ok: false,
      code: this.code,
      name: this.name,
      error: this.human,
      hint: this.hint,
    };
  }
}

/**
 * Maps an upstream error to an AppError using the provided error map.
 * If the error has a `code` property that matches a key in the map,
 * returns a typed AppError with the mapped message and hint.
 * Otherwise wraps the original error as-is.
 */
export function mapError(err: unknown, errors: ErrorMap): AppError {
  const code = extractCode(err);
  if (code && errors[code]) {
    return new AppError(code, errors[code], err);
  }
  const message = err instanceof Error ? err.message : String(err);
  return new AppError("UNKNOWN", { name: "UnknownError", human: message }, err);
}

function extractCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as Record<string, unknown>).code);
  }
  return null;
}
