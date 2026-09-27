import { normalizeLanguage, normalizeLanguagePreferences, normalizeTimezone } from "./config.js";

export const CHECK_STATUS = Object.freeze({
  PASS: "pass",
  WARNING: "warning",
  FAIL: "fail",
  UNVERIFIABLE: "unverifiable"
});

function canonicalizeLocale(value) {
  try { return normalizeLanguage(value); } catch { return null; }
}

function canonicalizeTimezone(value) {
  try { return normalizeTimezone(value); } catch { return null; }
}

function arraysEqual(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function normalizeHeader(value) {
  return String(value ?? "").split(",").map((part) => part.trim())
    .filter(Boolean).join(",");
}

function makeCheck(status, expected, actual, note = "") {
  return Object.freeze({ status, expected, actual, note });
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
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
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

export function getTimezoneProbeTimestamps(referenceTimestamp = Date.now()) {
  const reference = new Date(referenceTimestamp);
  if (Number.isNaN(reference.getTime())) {
    throw new Error("无法为无效时间创建时区测试矩阵。");
  }
  const year = reference.getUTCFullYear();
  return Object.freeze([
    reference.getTime(),
    ...Array.from({ length: 12 }, (_, month) => Date.UTC(year, month, 15, 12))
  ]);
}

export function evaluateInspection(expected, actual) {
  const expectedLanguages = normalizeLanguagePreferences(expected.languages, expected.language);
  const actualLanguages = Array.isArray(actual?.languages)
    ? actual.languages.map(String)
    : [];
  const expectedTimezone = normalizeTimezone(expected.timezoneId);
  const actualTimezone = canonicalizeTimezone(actual?.timezone);
  const timestampMs = Number(actual?.timestampMs);
  const expectedOffset = Number.isFinite(timestampMs)
    ? getExpectedTimezoneOffset(expectedTimezone, timestampMs)
    : null;
  const languagesExact = arraysEqual(actualLanguages, expectedLanguages);
  const languagesReduced = actualLanguages.length === 1
    && actualLanguages[0] === expectedLanguages[0]
    && expectedLanguages.length > 1;
  const expectedHeader = normalizeHeader(expected.acceptLanguage);
  const actualHeader = normalizeHeader(actual?.requestAcceptLanguage);
  const headerReduced = actualHeader === expectedLanguages[0]
    && actualHeader !== expectedHeader;
  const probes = Array.isArray(actual?.timezoneProbes) ? actual.timezoneProbes : [];
  const probeFailures = probes.filter((probe) => {
    const probeTimestamp = Number(probe?.timestampMs);
    return !Number.isFinite(probeTimestamp)
      || Number(probe?.offsetMinutes) !== getExpectedTimezoneOffset(expectedTimezone, probeTimestamp);
  });

  const details = {
    language: makeCheck(
      actual?.language === expectedLanguages[0] ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL,
      expectedLanguages[0], actual?.language ?? null
    ),
    languages: makeCheck(
      languagesExact ? CHECK_STATUS.PASS
        : languagesReduced ? CHECK_STATUS.WARNING : CHECK_STATUS.FAIL,
      expectedLanguages, actualLanguages,
      languagesReduced ? "浏览器隐私策略只公开了首选语言。" : ""
    ),
    locale: makeCheck(
      canonicalizeLocale(actual?.locale) === expectedLanguages[0]
        ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL,
      expectedLanguages[0], actual?.locale ?? null
    ),
    acceptLanguage: makeCheck(
      !actualHeader ? CHECK_STATUS.UNVERIFIABLE
        : actualHeader === expectedHeader ? CHECK_STATUS.PASS
          : headerReduced ? CHECK_STATUS.WARNING : CHECK_STATUS.FAIL,
      expectedHeader, actualHeader || null,
      headerReduced ? "浏览器可能启用了 Accept-Language Reduction。" : ""
    ),
    timezone: makeCheck(
      actualTimezone === expectedTimezone ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL,
      expectedTimezone, actual?.timezone ?? null
    ),
    timezoneOffset: makeCheck(
      expectedOffset !== null && Number(actual?.timezoneOffsetMinutes) === expectedOffset
        ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL,
      expectedOffset, actual?.timezoneOffsetMinutes ?? null
    ),
    timezoneMatrix: makeCheck(
      probes.length === 0 ? CHECK_STATUS.UNVERIFIABLE
        : probeFailures.length === 0 ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL,
      "全年 IANA 偏移规则",
      probes.length ? `${probes.length - probeFailures.length}/${probes.length}` : null
    ),
    temporalTimezone: makeCheck(
      !actual?.temporalTimezone ? CHECK_STATUS.UNVERIFIABLE
        : canonicalizeTimezone(actual.temporalTimezone) === expectedTimezone
          ? CHECK_STATUS.PASS : CHECK_STATUS.FAIL,
      expectedTimezone, actual?.temporalTimezone ?? null,
      actual?.temporalTimezone ? "" : "当前浏览器未提供 Temporal.Now.timeZoneId()。"
    )
  };
  const statuses = Object.values(details).map((check) => check.status);
  const status = statuses.includes(CHECK_STATUS.FAIL) ? CHECK_STATUS.FAIL
    : statuses.some((value) => value !== CHECK_STATUS.PASS)
      ? CHECK_STATUS.WARNING : CHECK_STATUS.PASS;
  return {
    status,
    passed: status !== CHECK_STATUS.FAIL,
    checks: Object.fromEntries(Object.entries(details).map(([key, check]) => [
      key,
      check.status === CHECK_STATUS.PASS || check.status === CHECK_STATUS.WARNING
    ])),
    details,
    expectedLanguages,
    expectedOffset,
    probeFailures
  };
}
