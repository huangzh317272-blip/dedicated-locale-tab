import { normalizeLanguagePreferences, normalizeTimezone } from "./config.js";

export const PROFILE_DOCUMENT_KIND = "dedicated-locale-tab/profiles";
export const PROFILE_SCHEMA_VERSION = 1;
export const MAX_SAVED_PROFILES = 30;

function normalizeName(value, fallback) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  return (name || fallback).slice(0, 60);
}

export function normalizeProfile(rawProfile, index = 0) {
  const languages = normalizeLanguagePreferences(rawProfile?.languages, rawProfile?.language);
  const timezoneId = normalizeTimezone(rawProfile?.timezoneId);
  const fallback = `${languages[0]} · ${timezoneId}`;
  return Object.freeze({
    id: String(rawProfile?.id || `profile-${index + 1}`).slice(0, 100),
    name: normalizeName(rawProfile?.name, fallback),
    languages: Object.freeze(languages),
    timezoneId
  });
}

export function createProfileDocument(rawProfiles) {
  const profiles = rawProfiles.slice(0, MAX_SAVED_PROFILES)
    .map((profile, index) => normalizeProfile(profile, index));
  return Object.freeze({
    kind: PROFILE_DOCUMENT_KIND,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles
  });
}

export function parseProfileDocument(value) {
  const document = typeof value === "string" ? JSON.parse(value) : value;
  if (document?.kind !== PROFILE_DOCUMENT_KIND) {
    throw new Error("该文件不是专用语言与时区页面的配置文件。");
  }
  if (document.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new Error(`不支持配置文件版本 ${document.schemaVersion ?? "未知"}。`);
  }
  if (!Array.isArray(document.profiles)) {
    throw new Error("配置文件缺少 profiles 数组。");
  }
  return document.profiles.slice(0, MAX_SAVED_PROFILES)
    .map((profile, index) => normalizeProfile(profile, index));
}

export function mergeProfiles(current, incoming) {
  const merged = new Map();
  for (const profile of [...current, ...incoming]) {
    const normalized = normalizeProfile(profile, merged.size);
    const key = `${normalized.languages.join(",")}|${normalized.timezoneId}`;
    merged.set(key, normalized);
  }
  return [...merged.values()].slice(0, MAX_SAVED_PROFILES);
}
