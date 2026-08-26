import test from "node:test";
import assert from "node:assert/strict";

import {
  LANGUAGE_TAGS,
  REGION_PRESETS,
  getSupportedTimezones
} from "../lib/environment-data.js";
import { normalizeLanguage, normalizeTimezone } from "../lib/config.js";

test("region presets have unique labels and valid language/timezone pairs", () => {
  const labels = new Set();

  for (const preset of REGION_PRESETS) {
    assert.ok(!labels.has(preset.label), `duplicate preset label: ${preset.label}`);
    labels.add(preset.label);
    assert.equal(normalizeLanguage(preset.language), preset.language);
    assert.ok(normalizeTimezone(preset.timezoneId));
  }

  assert.ok(REGION_PRESETS.length >= 150);
});

test("language directory contains every preset language", () => {
  const languages = new Set(LANGUAGE_TAGS);

  for (const preset of REGION_PRESETS) {
    assert.ok(languages.has(preset.language), `missing language: ${preset.language}`);
  }

  assert.ok(LANGUAGE_TAGS.length >= 150);
});

test("timezone directory includes the runtime IANA list and UTC", () => {
  const timezones = getSupportedTimezones();
  assert.ok(timezones.includes("UTC"));
  assert.ok(timezones.includes("America/New_York"));
  assert.ok(timezones.includes("Asia/Shanghai"));
  assert.ok(timezones.includes("Europe/London"));

  if (typeof Intl.supportedValuesOf === "function") {
    for (const timezone of Intl.supportedValuesOf("timeZone")) {
      assert.ok(timezones.includes(timezone), `missing runtime timezone: ${timezone}`);
    }
  }
});
