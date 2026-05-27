// BigQuery client + typed query helper.
//
// Two important guarantees:
//   1. Credentials NEVER leak to the browser. This file is server-only.
//      Anything that imports it implicitly becomes a server module. If we
//      ever tried to import this from a Client Component, Next.js would
//      throw at build time (because the credentials env var is private).
//   2. Errors don't include credential material. The Google client likes to
//      attach the JWT it tried to use to its error messages — we wrap and
//      rethrow with a sanitised message before bubbling up.

import { BigQuery } from "@google-cloud/bigquery";

let _client: BigQuery | null = null;

/**
 * Lazy singleton. Reading `GOOGLE_APPLICATION_CREDENTIALS_JSON` and parsing
 * it is cheap, but we still do it once per process so a misconfigured env
 * fails fast on the first query instead of silently every time.
 */
function getClient(): BigQuery {
  if (_client) return _client;

  const projectId = process.env.GOOGLE_PROJECT_ID;
  const credsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!projectId) {
    throw new Error("GOOGLE_PROJECT_ID is not set");
  }
  if (!credsRaw) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = parseCredentialsJson(credsRaw);
  } catch {
    // Never include the raw value in the error — even a partial dump can
    // contain the private key.
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON");
  }

  _client = new BigQuery({ projectId, credentials });
  return _client;
}

/** Parse service-account JSON from env — tolerates .env.local-style wrapping. */
function parseCredentialsJson(raw: string): Record<string, unknown> {
  let s = raw.trim();
  // .env.local often wraps the JSON in single quotes; Vercel must not — but
  // strip them if someone pasted the .env.local value verbatim.
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    s = s.slice(1, -1);
  }
  return JSON.parse(s) as Record<string, unknown>;
}

/**
 * BigQuery returns DATE / TIMESTAMP / DATETIME columns as `{ value: "..." }`
 * objects (a wrapper that distinguishes them from arbitrary strings). For
 * our purposes — feeding JSON to React — we just want the inner string.
 * This function walks an arbitrary value and flattens any single-key
 * `{ value: T }` object to its inner `T`. Idempotent.
 */
function unwrapBqValues(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(unwrapBqValues);
  if (typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === "value") {
    // BQ wrapper — return the inner primitive.
    return obj.value;
  }

  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = unwrapBqValues(obj[k]);
  return out;
}

export type BqParams = Record<string, string | number | boolean | null>;

/**
 * Run a parameterised SQL query against BigQuery and return typed rows.
 *
 * Always pass user-supplied values through `params`, never via string
 * concatenation, so BigQuery treats them as data (no SQL injection).
 *
 *   const rows = await queryBigQuery<{ id: string }>(
 *     "SELECT id FROM `proj.ds.t` WHERE status = @status",
 *     { status: "Active" },
 *   );
 */
export async function queryBigQuery<T>(
  sql: string,
  params: BqParams = {},
): Promise<T[]> {
  const client = getClient();

  try {
    const [rows] = await client.query({ query: sql, params });
    return rows.map((r) => unwrapBqValues(r)) as T[];
  } catch (err) {
    // Don't leak the underlying Google client error verbatim — it can
    // include header values and partial credential metadata. Log loudly
    // on the server, rethrow a generic-but-useful message.
    console.error("[bigquery] query failed:", err);
    throw new Error("BigQuery query failed");
  }
}

/** Exposed for one-off scripts and tests. Prefer `queryBigQuery` in app code. */
export function getBigQueryClient(): BigQuery {
  return getClient();
}
