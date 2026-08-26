import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAcceptLanguage,
  buildLanguageList,
  normalizeConfig,
  normalizeLanguage,
  normalizeTimezone,
  normalizeUrl,
  toIcuLocale
} from "../lib/config.js";

test("normalizes a site URL and adds HTTPS", () => {
  assert.equal(normalizeUrl("example.com/login"), "https://example.com/login");
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
  assert.equal(buildAcceptLanguage("en-US"), "en-US,en;q=0.9");
  assert.equal(
    buildAcceptLanguage("zh-Hant-TW"),
    "zh-Hant-TW,zh-Hant;q=0.9,zh;q=0.8"
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
      languages: ["ja-JP", "ja"],
      locale: "ja_JP",
      acceptLanguage: "ja-JP,ja;q=0.9"
    }
  );
});
