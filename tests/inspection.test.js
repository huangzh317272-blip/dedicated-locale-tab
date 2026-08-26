import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateInspection,
  getExpectedTimezoneOffset
} from "../lib/inspection.js";

const summerTimestamp = Date.parse("2026-08-26T07:27:04Z");

test("calculates DST-aware Date timezone offsets", () => {
  assert.equal(
    getExpectedTimezoneOffset("America/Los_Angeles", summerTimestamp),
    420
  );
  assert.equal(
    getExpectedTimezoneOffset("Asia/Shanghai", summerTimestamp),
    -480
  );
});

test("requires language list, locale, timezone, and offset consistency", () => {
  const expected = {
    language: "en-US",
    languages: ["en-US", "en"],
    timezoneId: "America/Los_Angeles"
  };
  const actual = {
    timestampMs: summerTimestamp,
    language: "en-US",
    languages: ["en-US", "en"],
    locale: "en-US",
    timezone: "America/Los_Angeles",
    timezoneOffsetMinutes: 420
  };

  assert.equal(evaluateInspection(expected, actual).passed, true);

  const malformedLanguages = {
    ...actual,
    languages: ["en-US", "en;q=0.9"]
  };
  const report = evaluateInspection(expected, malformedLanguages);
  assert.equal(report.passed, false);
  assert.equal(report.checks.languages, false);
});
