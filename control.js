import {
  DEFAULT_SETTINGS,
  buildAcceptLanguage,
  normalizeConfig,
  normalizeLanguage,
  normalizeTimezone
} from "./lib/config.js";
import {
  LANGUAGE_TAGS,
  REGION_PRESETS,
  getSupportedTimezones
} from "./lib/environment-data.js";

const SETTINGS_KEY = "lastEnvironmentSettingsV1";

const form = document.querySelector("#environment-form");
const urlInput = document.querySelector("#site-url");
const presetInput = document.querySelector("#preset");
const presetSelect = document.querySelector("#preset-select");
const presetOptions = document.querySelector("#preset-options");
const languageInput = document.querySelector("#language");
const languageOptions = document.querySelector("#language-options");
const timezoneInput = document.querySelector("#timezone");
const timezoneOptions = document.querySelector("#timezone-options");
const listSummary = document.querySelector("#list-summary");
const environmentPreview = document.querySelector("#environment-preview");
const headerPreview = document.querySelector("#header-preview");
const openButton = document.querySelector("#open-button");
const formMessage = document.querySelector("#form-message");
const refreshButton = document.querySelector("#refresh-button");
const sessionsContainer = document.querySelector("#sessions");
const sessionTemplate = document.querySelector("#session-template");

const languageDisplayNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["zh-CN"], { type: "language", fallback: "code" })
  : null;

const resolvedPresets = REGION_PRESETS.map((preset) => ({
  ...preset,
  language: normalizeLanguage(preset.language),
  timezoneId: normalizeTimezone(preset.timezoneId)
}));

function setMessage(text = "", type = "") {
  formMessage.textContent = text;
  formMessage.className = `message${type ? ` ${type}` : ""}`;
}

function setBusy(isBusy) {
  openButton.disabled = isBusy;
  refreshButton.disabled = isBusy;
  openButton.textContent = isBusy ? "正在建立隔离环境…" : "打开专用页面";
}

function populateReferenceLists() {
  for (const preset of resolvedPresets) {
    const option = document.createElement("option");
    option.value = preset.label;
    option.label = `${preset.language} · ${preset.timezoneId}`;
    presetOptions.append(option);

    const selectOption = document.createElement("option");
    selectOption.value = preset.id;
    selectOption.textContent =
      `${preset.label} — ${preset.language} — ${preset.timezoneId}`;
    presetSelect.append(selectOption);
  }

  for (const language of LANGUAGE_TAGS) {
    const option = document.createElement("option");
    option.value = language;
    option.label = languageDisplayNames?.of(language) ?? language;
    languageOptions.append(option);
  }

  const timezones = getSupportedTimezones();
  for (const timezone of timezones) {
    const option = document.createElement("option");
    option.value = timezone;
    timezoneOptions.append(option);
  }

  listSummary.textContent =
    `已载入 ${resolvedPresets.length} 个地区预设、${LANGUAGE_TAGS.length} 个语言选项、`
    + `${timezones.length} 个浏览器支持的时区。`;
}

function updatePreview() {
  try {
    const language = normalizeLanguage(languageInput.value);
    const timezone = normalizeTimezone(timezoneInput.value);
    environmentPreview.textContent = `${language} · ${timezone}`;
    headerPreview.textContent = buildAcceptLanguage(language);
  } catch {
    environmentPreview.textContent = "等待有效配置";
    headerPreview.textContent = "—";
  }
}

function selectMatchingPreset() {
  try {
    const language = normalizeLanguage(languageInput.value);
    const timezone = normalizeTimezone(timezoneInput.value);
    const match = resolvedPresets.find(
      (preset) => preset.language === language && preset.timezoneId === timezone
    );
    presetInput.value = match?.label ?? "";
    presetSelect.value = match?.id ?? "";
  } catch {
    presetInput.value = "";
    presetSelect.value = "";
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_KEY] ?? {})
  };
  urlInput.value = settings.url;
  languageInput.value = settings.language;
  timezoneInput.value = settings.timezoneId;
  selectMatchingPreset();
  updatePreview();
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error || "扩展后台没有返回有效结果。");
  }
  return response.data;
}

function formatInspection(result) {
  const expected = result.expected;
  const actual = result.actual;
  const languageMatches = actual?.language === expected.language;
  const timezoneMatches = actual?.timezone === expected.timezoneId;

  return [
    `检查结果：${languageMatches && timezoneMatches ? "通过" : "存在不一致"}`,
    "",
    `期望语言     ${expected.language}`,
    `实际语言     ${actual?.language ?? "无法读取"}`,
    `语言列表     ${(actual?.languages ?? []).join(", ") || "无法读取"}`,
    `Intl Locale  ${actual?.locale ?? "无法读取"}`,
    "",
    `期望时区     ${expected.timezoneId}`,
    `实际时区     ${actual?.timezone ?? "无法读取"}`,
    `时区偏移     ${actual?.timezoneOffsetMinutes ?? "无法读取"} 分钟`,
    `页面本地时间 ${actual?.localDateText ?? "无法读取"}`,
    "",
    "说明：页面 JavaScript 无法直接读取自身发出的 Accept-Language 请求头。"
  ].join("\n");
}

function makeSessionCard(page) {
  const fragment = sessionTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".session-card");
  const inspection = fragment.querySelector(".inspection");

  fragment.querySelector(".session-title").textContent = page.title;
  fragment.querySelector(".session-url").textContent = page.url;
  fragment.querySelector(".session-environment").textContent =
    `${page.config.language} · ${page.config.timezoneId}`;

  fragment.querySelector(".focus-button").addEventListener("click", async () => {
    try {
      await sendMessage({ type: "focus-controlled-page", tabId: page.tabId });
    } catch (error) {
      setMessage(error.message, "error");
      await refreshSessions();
    }
  });

  fragment.querySelector(".inspect-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "检查中…";
    try {
      const result = await sendMessage({
        type: "inspect-controlled-page",
        tabId: page.tabId
      });
      inspection.textContent = formatInspection(result);
      inspection.hidden = false;
    } catch (error) {
      inspection.textContent = `检查失败：${error.message}`;
      inspection.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "检查环境";
    }
  });

  fragment.querySelector(".close-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await sendMessage({ type: "close-controlled-page", tabId: page.tabId });
      card.remove();
      await refreshSessions();
    } catch (error) {
      setMessage(error.message, "error");
      button.disabled = false;
    }
  });

  return fragment;
}

async function refreshSessions() {
  try {
    const pages = await sendMessage({ type: "list-controlled-pages" });
    sessionsContainer.replaceChildren();

    if (!pages.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "目前没有专用页面。";
      sessionsContainer.append(empty);
      return;
    }

    for (const page of pages) {
      sessionsContainer.append(makeSessionCard(page));
    }
  } catch (error) {
    sessionsContainer.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = `无法读取运行状态：${error.message}`;
    sessionsContainer.append(empty);
  }
}

function applySelectedPreset() {
  const preset = resolvedPresets.find(
    (item) => item.label === presetInput.value.trim()
  );
  presetSelect.value = preset?.id ?? "";
  if (!preset) {
    return;
  }
  languageInput.value = preset.language;
  timezoneInput.value = preset.timezoneId;
  updatePreview();
}

presetInput.addEventListener("input", applySelectedPreset);
presetInput.addEventListener("change", applySelectedPreset);

presetSelect.addEventListener("change", () => {
  const preset = resolvedPresets.find(
    (item) => item.id === presetSelect.value
  );
  if (!preset) {
    presetInput.value = "";
    return;
  }
  presetInput.value = preset.label;
  languageInput.value = preset.language;
  timezoneInput.value = preset.timezoneId;
  updatePreview();
});

for (const input of [languageInput, timezoneInput]) {
  input.addEventListener("input", () => {
    selectMatchingPreset();
    updatePreview();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage();

  let config;
  try {
    config = normalizeConfig({
      url: urlInput.value,
      language: languageInput.value,
      timezoneId: timezoneInput.value
    });
  } catch (error) {
    setMessage(error.message, "error");
    return;
  }

  setBusy(true);
  try {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: {
        url: config.url,
        language: config.language,
        timezoneId: config.timezoneId
      }
    });

    await sendMessage({ type: "open-controlled-page", config });
    setMessage("专用页面已经打开。请只在新窗口中使用目标网站。", "success");
    await refreshSessions();
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
});

refreshButton.addEventListener("click", refreshSessions);

populateReferenceLists();
await loadSettings();
await refreshSessions();

window.setInterval(refreshSessions, 5000);
