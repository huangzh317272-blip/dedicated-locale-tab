import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECK_STATUS,
  evaluateInspection,
  getExpectedTimezoneOffset,
  getTimezoneProbeTimestamps
} from "../lib/inspection.js";

const summerTimestamp = Date.parse("2026-08-26T07:27:04Z");

test("calculates DST-aware Date timezone offsets", () => {
  assert.equal(getExpectedTimezoneOffset("America/Los_Angeles", summerTimestamp), 420);
  assert.equal(getExpectedTimezoneOffset("Asia/Shanghai", summerTimestamp), -480);
  const probes = getTimezoneProbeTimestamps(summerTimestamp);
  assert.equal(probes.length, 13);
  assert.equal(new Set(probes).size, 13);
});

function validActual(expected) {
  const timezoneProbes = getTimezoneProbeTimestamps(summerTimestamp).map((timestampMs) => ({
    timestampMs,
    offsetMinutes: getExpectedTimezoneOffset(expected.timezoneId, timestampMs)
  }));
  return {
    timestampMs: summerTimestamp,
    language: expected.languages[0],
    languages: expected.languages,
    locale: expected.languages[0],
    timezone: expected.timezoneId,
    timezoneOffsetMinutes: getExpectedTimezoneOffset(expected.timezoneId, summerTimestamp),
    timezoneProbes,
    temporalTimezone: expected.timezoneId,
    requestAcceptLanguage: expected.acceptLanguage
  };
}

test("requires exact languages, real request header and a DST matrix", () => {
  const expected = {
    language: "en-US",
    languages: ["en-US", "fr-FR"],
    timezoneId: "America/Los_Angeles",
    acceptLanguage: "en-US,fr-FR;q=0.9"
  };
  assert.equal(evaluateInspection(expected, validActual(expected)).status, CHECK_STATUS.PASS);
  const malformed = validActual(expected);
  malformed.timezoneProbes[3] = { ...malformed.timezoneProbes[3], offsetMinutes: 999 };
  const report = evaluateInspection(expected, malformed);
  assert.equal(report.status, CHECK_STATUS.FAIL);
  assert.equal(report.details.timezoneMatrix.status, CHECK_STATUS.FAIL);
  assert.equal(report.probeFailures.length, 1);
});

test("labels browser privacy reduction as a warning, not a false pass", () => {
  const expected = {
    language: "en-US",
    languages: ["en-US", "fr-FR"],
    timezoneId: "America/Los_Angeles",
    acceptLanguage: "en-US,fr-FR;q=0.9"
  };
  const actual = validActual(expected);
  actual.languages = ["en-US"];
  actual.requestAcceptLanguage = "en-US";
  actual.temporalTimezone = null;
  const report = evaluateInspection(expected, actual);
  assert.equal(report.status, CHECK_STATUS.WARNING);
  assert.equal(report.details.languages.status, CHECK_STATUS.WARNING);
  assert.equal(report.details.acceptLanguage.status, CHECK_STATUS.WARNING);
  assert.equal(report.details.temporalTimezone.status, CHECK_STATUS.UNVERIFIABLE);
});
