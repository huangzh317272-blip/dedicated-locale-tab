import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_DOCUMENT_KIND,
  createProfileDocument,
  mergeProfiles,
  parseProfileDocument
} from "../lib/profiles.js";

test("round-trips portable profiles without URLs or login data", () => {
  const document = createProfileDocument([{
    id: "tokyo",
    name: "Tokyo Japanese",
    languages: ["ja-JP", "en-US"],
    timezoneId: "Asia/Tokyo",
    url: "https://example.com/private?token=secret",
    cookies: ["secret"]
  }]);
  assert.equal(document.kind, PROFILE_DOCUMENT_KIND);
  const serialized = JSON.stringify(document);
  assert.doesNotMatch(serialized, /example\.com|secret|cookies/);
  assert.deepEqual(parseProfileDocument(serialized)[0].languages, ["ja-JP", "en-US"]);
});

test("merges duplicate environments using the imported profile", () => {
  const merged = mergeProfiles(
    [{ id: "old", name: "Old", languages: ["en-US"], timezoneId: "America/New_York" }],
    [{ id: "new", name: "New", languages: ["en-US"], timezoneId: "America/New_York" }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "New");
});

test("rejects unrelated and future profile documents", () => {
  assert.throws(() => parseProfileDocument({ kind: "other", schemaVersion: 1, profiles: [] }), /不是/);
  assert.throws(() => parseProfileDocument({ kind: PROFILE_DOCUMENT_KIND, schemaVersion: 2, profiles: [] }), /不支持/);
});
