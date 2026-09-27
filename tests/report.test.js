import test from "node:test";
import assert from "node:assert/strict";
import { createDiagnosticsReport, formatDiagnosticsMarkdown, redactUrl } from "../lib/report.js";
import { getExpectedTimezoneOffset, getTimezoneProbeTimestamps } from "../lib/inspection.js";

test("redacts paths and secrets from multi-environment reports", () => {
  const timestampMs = Date.parse("2026-01-15T12:00:00Z");
  const timezoneId = "Asia/Tokyo";
  const expected = { languages: ["ja-JP"], language: "ja-JP", timezoneId, acceptLanguage: "ja-JP" };
  const actual = {
    timestampMs,
    language: "ja-JP",
    languages: ["ja-JP"],
    locale: "ja-JP",
    timezone: timezoneId,
    timezoneOffsetMinutes: getExpectedTimezoneOffset(timezoneId, timestampMs),
    timezoneProbes: getTimezoneProbeTimestamps(timestampMs).map((probe) => ({
      timestampMs: probe,
      offsetMinutes: getExpectedTimezoneOffset(timezoneId, probe)
    })),
    temporalTimezone: timezoneId,
    requestAcceptLanguage: expected.acceptLanguage
  };
  const report = createDiagnosticsReport([{
    expected,
    actual,
    session: { url: "https://example.com/private?token=secret", windowId: 1, status: "healthy" }
  }], { extensionVersion: "1.0.0", browser: "Test" });
  assert.equal(redactUrl("https://example.com/private?x=1"), "https://example.com/");
  assert.equal(report.environments[0].urlOrigin, "https://example.com/");
  assert.doesNotMatch(JSON.stringify(report), /private|token=secret/);
  assert.match(formatDiagnosticsMarkdown(report), /Status/);
});
