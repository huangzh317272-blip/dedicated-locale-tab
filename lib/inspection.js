import {
  buildLanguageList,
  normalizeLanguage,
  normalizeTimezone
} from "./config.js";

function canonicalizeLocale(value) {
  try {
    return normalizeLanguage(value);
  } catch {
    return null;
  }
}

function arraysEqual(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function getExpectedTimezoneOffset(timezoneId, timestampMs) {
  const timezone = normalizeTimezone(timezoneId);
  const instant = new Date(timestampMs);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("无法根据无效时间计算时区偏移。");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  const localFieldsAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return Math.round((instant.getTime() - localFieldsAsUtc) / 60_000);
}

export function evaluateInspection(expected, actual) {
  const expectedLanguages = expected.languages ?? buildLanguageList(expected.language);
  const actualLanguages = Array.isArray(actual?.languages) ? actual.languages : [];
  const timestampMs = Number(actual?.timestampMs);
  const expectedOffset = Number.isFinite(timestampMs)
    ? getExpectedTimezoneOffset(expected.timezoneId, timestampMs)
    : null;

  const checks = {
    language: actual?.language === expected.language,
    languages: arraysEqual(actualLanguages, expectedLanguages),
    locale: canonicalizeLocale(actual?.locale) === expected.language,
    timezone: actual?.timezone === expected.timezoneId,
    timezoneOffset: expectedOffset !== null
      && actual?.timezoneOffsetMinutes === expectedOffset
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    expectedLanguages,
    expectedOffset
  };
}
