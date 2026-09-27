import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAcceptLanguage,
  buildLanguageList,
  getRememberedOrigin,
  normalizeConfig,
  normalizeLanguage,
  normalizeLanguagePreferences,
  normalizeTimezone,
  normalizeUrl,
  toIcuLocale
} from "../lib/config.js";

test("normalizes a site URL and adds HTTPS", () => {
  assert.equal(normalizeUrl("example.com/login"), "https://example.com/login");
  assert.equal(
    getRememberedOrigin("https://example.com/login?token=secret#fragment"),
    "https://example.com/"
  );
});

test("rejects non-web protocols", () => {
  assert.throws(() => normalizeUrl("file:///C:/secret.txt"), /HTTP/);
});

test("canonicalizes BCP 47 language tags", () => {
  assert.equal(normalizeLanguage("EN-us"), "en-US");
  assert.equal(toIcuLocale("zh-hant-tw"), "zh_Hant_TW");
});

test("builds a consistent Accept-Language value", () => {
  assert.deepEqual(buildLanguageList("en-US"), ["en-US", "en"]);
  assert.deepEqual(
    buildLanguageList("zh-Hant-TW"),
    ["zh-Hant-TW", "zh-Hant", "zh"]
  );
  assert.equal(buildAcceptLanguage("en-US"), "en-US");
  assert.equal(buildAcceptLanguage("zh-Hant-TW"), "zh-Hant-TW");
  assert.deepEqual(normalizeLanguagePreferences("EN-us, zh-hant-tw, en-US"), ["en-US", "zh-Hant-TW"]);
  assert.equal(
    buildAcceptLanguage(["en-US", "zh-CN"]),
    "en-US,zh-CN;q=0.9"
  );
});

test("validates and resolves IANA timezones", () => {
  assert.equal(normalizeTimezone("America/New_York"), "America/New_York");
  assert.throws(() => normalizeTimezone("New York"), /时区名称无效/);
});

test("produces the complete CDP configuration", () => {
  assert.deepEqual(
    normalizeConfig({
      url: "https://example.com",
      timezoneId: "Asia/Tokyo",
      language: "ja-jp"
    }),
    {
      url: "https://example.com/",
      timezoneId: "Asia/Tokyo",
      language: "ja-JP",
      languages: ["ja-JP"],
      locale: "ja_JP",
      acceptLanguage: "ja-JP"
    }
  );
});

test("keeps navigator languages explicit and mirrors Chromium header weights", () => {
  const config = normalizeConfig({
    url: "example.com",
    timezoneId: "Europe/Paris",
    languages: ["fr-FR", "en-US"]
  });
  assert.deepEqual(config.languages, ["fr-FR", "en-US"]);
  assert.equal(config.acceptLanguage, "fr-FR,en-US;q=0.9");
  assert.throws(
    () => normalizeLanguagePreferences(["en", "fr", "de", "es", "it", "ja"]),
    /最多允许 5 项/
  );
});
