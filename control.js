import {
  DEFAULT_SETTINGS,
  buildAcceptLanguage,
  getRememberedOrigin,
  normalizeConfig,
  normalizeLanguage,
  normalizeLanguagePreferences,
  normalizeTimezone
} from "./lib/config.js";
import { LANGUAGE_TAGS, REGION_PRESETS, getSupportedTimezones } from "./lib/environment-data.js";
import { CHECK_STATUS, evaluateInspection } from "./lib/inspection.js";
import { createProfileDocument, mergeProfiles, normalizeProfile, parseProfileDocument } from "./lib/profiles.js";
import { createDiagnosticsReport, formatDiagnosticsMarkdown } from "./lib/report.js";

const SETTINGS_KEY = "lastEnvironmentSettingsV2";
const PROFILES_KEY = "savedLocaleProfilesV1";
const form = document.querySelector("#environment-form");
const urlInput = document.querySelector("#site-url");
const presetInput = document.querySelector("#preset");
const presetSelect = document.querySelector("#preset-select");
const presetOptions = document.querySelector("#preset-options");
const languageInput = document.querySelector("#language");
const additionalLanguagesInput = document.querySelector("#additional-languages");
const languageOptions = document.querySelector("#language-options");
const timezoneInput = document.querySelector("#timezone");
const timezoneOptions = document.querySelector("#timezone-options");
const listSummary = document.querySelector("#list-summary");
const environmentPreview = document.querySelector("#environment-preview");
const headerPreview = document.querySelector("#header-preview");
const timezonePreview = document.querySelector("#timezone-preview");
const openButton = document.querySelector("#open-button");
const saveProfileButton = document.querySelector("#save-profile-button");
const profileNameInput = document.querySelector("#profile-name");
const profilesContainer = document.querySelector("#profiles");
const profileTemplate = document.querySelector("#profile-template");
const openMatrixButton = document.querySelector("#open-matrix-button");
const exportProfilesButton = document.querySelector("#export-profiles-button");
const importProfilesButton = document.querySelector("#import-profiles-button");
const profileFileInput = document.querySelector("#profile-file-input");
const formMessage = document.querySelector("#form-message");
const refreshButton = document.querySelector("#refresh-button");
const exportReportJsonButton = document.querySelector("#export-report-json");
const exportReportMarkdownButton = document.querySelector("#export-report-markdown");
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
let savedProfiles = [];
let latestPages = [];

function setMessage(text = "", type = "") {
  formMessage.textContent = text;
  formMessage.className = `message${type ? ` ${type}` : ""}`;
}

function setBusy(isBusy) {
  for (const button of [openButton, saveProfileButton, openMatrixButton]) button.disabled = isBusy;
  openButton.textContent = isBusy ? "正在建立隔离环境…" : "打开隔离窗口";
}

function getLanguagesFromForm() {
  const primary = normalizeLanguage(languageInput.value);
  const additional = additionalLanguagesInput.value.trim()
    ? normalizeLanguagePreferences(additionalLanguagesInput.value)
    : [];
  return normalizeLanguagePreferences([primary, ...additional]);
}

function getConfigFromForm() {
  return normalizeConfig({
    url: urlInput.value,
    languages: getLanguagesFromForm(),
    timezoneId: timezoneInput.value
  });
}

function applyConfigToForm(profile) {
  const normalized = normalizeProfile(profile);
  languageInput.value = normalized.languages[0];
  additionalLanguagesInput.value = normalized.languages.slice(1).join(", ");
  timezoneInput.value = normalized.timezoneId;
  selectMatchingPreset();
  updatePreview();
}

function populateReferenceLists() {
  for (const preset of resolvedPresets) {
    const option = document.createElement("option");
    option.value = preset.label;
    option.label = `${preset.language} · ${preset.timezoneId}`;
    presetOptions.append(option);
    const selectOption = document.createElement("option");
    selectOption.value = preset.id;
    selectOption.textContent = `${preset.label} — ${preset.language} — ${preset.timezoneId}`;
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
  listSummary.textContent = `已载入 ${resolvedPresets.length} 个地区预设、${LANGUAGE_TAGS.length} 个语言选项、`
    + `${timezones.length} 个当前浏览器支持的 IANA 时区。`;
}

function updatePreview() {
  try {
    const languages = getLanguagesFromForm();
    const timezone = normalizeTimezone(timezoneInput.value);
    environmentPreview.textContent = languages.join(", ");
    headerPreview.textContent = buildAcceptLanguage(languages);
    timezonePreview.textContent = timezone;
  } catch {
    environmentPreview.textContent = "等待有效配置";
    headerPreview.textContent = "—";
    timezonePreview.textContent = "—";
  }
}

function selectMatchingPreset() {
  try {
    const language = normalizeLanguage(languageInput.value);
    const timezone = normalizeTimezone(timezoneInput.value);
    const match = resolvedPresets.find((preset) => preset.language === language && preset.timezoneId === timezone);
    presetInput.value = match?.label ?? "";
    presetSelect.value = match?.id ?? "";
  } catch {
    presetInput.value = "";
    presetSelect.value = "";
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] ?? {}) };
  urlInput.value = settings.url;
  const languages = normalizeLanguagePreferences(settings.languages, settings.language);
  languageInput.value = languages[0];
  additionalLanguagesInput.value = languages.slice(1).join(", ");
  timezoneInput.value = settings.timezoneId;
  selectMatchingPreset();
  updatePreview();
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "扩展后台没有返回有效结果。");
  return response.data;
}

async function profileStorageSet(profiles) {
  await chrome.storage.local.set({ [PROFILES_KEY]: profiles });
  try { await chrome.storage.sync.set({ [PROFILES_KEY]: profiles }); } catch {}
}

function createId() {
  return crypto.randomUUID?.() ?? `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderProfiles() {
  profilesContainer.replaceChildren();
  if (!savedProfiles.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "尚未保存测试配置。可保存后导出到 Windows 或 Mac。";
    profilesContainer.append(empty);
    return;
  }
  for (const profile of savedProfiles) {
    const fragment = profileTemplate.content.cloneNode(true);
    const checkbox = fragment.querySelector(".profile-checkbox");
    checkbox.dataset.profileId = profile.id;
    fragment.querySelector(".profile-name").textContent = profile.name;
    fragment.querySelector(".profile-environment").textContent = `${profile.languages.join(", ")} · ${profile.timezoneId}`;
    fragment.querySelector(".apply-profile-button").addEventListener("click", () => {
      applyConfigToForm(profile);
      profileNameInput.value = profile.name;
      setMessage(`已载入配置“${profile.name}”。`, "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    fragment.querySelector(".delete-profile-button").addEventListener("click", async () => {
      savedProfiles = savedProfiles.filter((item) => item.id !== profile.id);
      await profileStorageSet(savedProfiles);
      renderProfiles();
      setMessage(`已删除配置“${profile.name}”。`, "success");
    });
    profilesContainer.append(fragment);
  }
}

async function loadProfiles() {
  const local = await chrome.storage.local.get(PROFILES_KEY);
  let synced = {};
  try { synced = await chrome.storage.sync.get(PROFILES_KEY); } catch {}
  const localProfiles = Array.isArray(local[PROFILES_KEY]) ? local[PROFILES_KEY] : [];
  const syncedProfiles = Array.isArray(synced[PROFILES_KEY]) ? synced[PROFILES_KEY] : [];
  // Local is authoritative on the current device. Sync is a convenience only;
  // explicit export/import remains the portable and inspectable migration path.
  savedProfiles = mergeProfiles(syncedProfiles, localProfiles);
  renderProfiles();
}

function statusLabel(status) {
  return ({
    [CHECK_STATUS.PASS]: "通过",
    [CHECK_STATUS.WARNING]: "警告",
    [CHECK_STATUS.FAIL]: "失败",
    [CHECK_STATUS.UNVERIFIABLE]: "无法验证",
    healthy: "受控",
    degraded: "已降级",
    "blocked-by-policy": "策略阻止",
    detached: "已断开",
    closing: "关闭中",
    "close-failed": "关闭失败"
  })[status] ?? String(status ?? "未知");
}

function statusClass(status) {
  if ([CHECK_STATUS.PASS, "healthy"].includes(status)) return "health-pass";
  if ([CHECK_STATUS.WARNING, "attaching", "applying"].includes(status)) return "health-warning";
  if (status === CHECK_STATUS.UNVERIFIABLE) return "health-unverifiable";
  return "health-fail";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "无法读取";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function formatInspection(result) {
  const report = evaluateInspection(result.expected, result.actual);
  const line = (label, check) => `${statusLabel(check.status).padEnd(4, "　")} ${label}\n`
    + `  期望：${formatValue(check.expected)}\n  实际：${formatValue(check.actual)}`
    + `${check.note ? `\n  说明：${check.note}` : ""}`;
  const intl = result.actual?.intl ?? {};
  return [
    `严格检查：${statusLabel(report.status)}`,
    `检查时间：${result.session?.lastVerifiedAt ?? "未知"}`,
    `已保护子目标：${result.session?.protectedChildTargets ?? 0}`,
    "",
    line("navigator.language", report.details.language),
    line("navigator.languages", report.details.languages),
    line("Intl 默认 Locale", report.details.locale),
    line("真实主文档 Accept-Language", report.details.acceptLanguage),
    line("Intl IANA 时区", report.details.timezone),
    line("当前 UTC 偏移", report.details.timezoneOffset),
    line("全年 DST / 偏移矩阵", report.details.timezoneMatrix),
    line("Temporal 时区", report.details.temporalTimezone),
    "",
    "Intl 样例：",
    `  数字：${formatValue(intl.number?.sample)}`,
    `  百分比：${formatValue(intl.percent)}`,
    `  相对时间：${formatValue(intl.relativeTime?.sample)}`,
    `  列表：${formatValue(intl.list?.sample)}`,
    `  地区名 US：${formatValue(intl.displayNames?.sample)}`,
    "",
    "范围：IP、VPN、DNS、WebRTC、Cookie、账号地区、字体、Canvas 与硬件特征不在本插件的隔离范围内。"
  ].join("\n");
}

function makeSessionCard(page) {
  const fragment = sessionTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".session-card");
  const inspection = fragment.querySelector(".inspection");
  const health = fragment.querySelector(".session-health");
  const dot = fragment.querySelector(".live-dot");
  fragment.querySelector(".session-title").textContent = `${page.title} · ${page.tabCount} 个标签页`;
  fragment.querySelector(".session-url").textContent = page.url;
  fragment.querySelector(".session-environment").textContent = `${page.config.languages.join(", ")} · ${page.config.timezoneId}`;
  fragment.querySelector(".session-meta").textContent = `受控标签 ${page.controlledTabCount} · 未受控标签 ${page.untrustedTabCount} · 子目标 ${page.protectedChildTargets}`;
  health.textContent = statusLabel(page.status);
  health.classList.add(statusClass(page.status));
  dot.classList.add(`dot-${statusClass(page.status).replace("health-", "")}`);
  const warning = fragment.querySelector(".session-warning");
  if (page.lastError || page.lastWarning) {
    warning.textContent = page.lastError || page.lastWarning;
    warning.hidden = false;
  }
  fragment.querySelector(".focus-button").addEventListener("click", async () => {
    try { await sendMessage({ type: "focus-controlled-page", tabId: page.tabId }); }
    catch (error) { setMessage(error.message, "error"); await refreshSessions(); }
  });
  fragment.querySelector(".inspect-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "检查中…";
    try {
      const result = await sendMessage({ type: "inspect-controlled-page", tabId: page.tabId });
      const report = evaluateInspection(result.expected, result.actual);
      inspection.className = `inspection inspection-${report.status}`;
      inspection.textContent = formatInspection(result);
      inspection.hidden = false;
      health.textContent = statusLabel(report.status);
      health.className = `health session-health ${statusClass(report.status)}`;
    } catch (error) {
      inspection.className = "inspection inspection-fail";
      inspection.textContent = `检查失败：${error.message}`;
      inspection.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "严格检查";
    }
  });
  fragment.querySelector(".new-tab-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "正在创建…";
    try {
      await sendMessage({ type: "create-controlled-tab", windowId: page.windowId });
      setMessage("新的 about:blank 标签已在首个网站请求前完成隔离。", "success");
      await refreshSessions();
    } catch (error) { setMessage(error.message, "error"); }
    finally { button.disabled = false; button.textContent = "新建隔离标签页"; }
  });
  fragment.querySelector(".close-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await sendMessage({ type: "close-controlled-page", tabId: page.tabId });
      card.remove();
      await refreshSessions();
    } catch (error) { setMessage(error.message, "error"); button.disabled = false; }
  });
  return fragment;
}

async function refreshSessions() {
  try {
    latestPages = await sendMessage({ type: "list-controlled-pages" });
    sessionsContainer.replaceChildren();
    if (!latestPages.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "目前没有隔离窗口。";
      sessionsContainer.append(empty);
      return;
    }
    for (const page of latestPages) sessionsContainer.append(makeSessionCard(page));
  } catch (error) {
    latestPages = [];
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = `无法读取运行状态：${error.message}`;
    sessionsContainer.replaceChildren(empty);
  }
}

function applySelectedPreset() {
  const preset = resolvedPresets.find((item) => item.label === presetInput.value.trim());
  presetSelect.value = preset?.id ?? "";
  if (!preset) return;
  languageInput.value = preset.language;
  additionalLanguagesInput.value = "";
  timezoneInput.value = preset.timezoneId;
  updatePreview();
}

function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function collectDiagnostics() {
  const pages = await sendMessage({ type: "list-controlled-pages" });
  if (!pages.length) throw new Error("没有可检查的隔离窗口。");
  const results = [];
  for (const page of pages) {
    try { results.push(await sendMessage({ type: "inspect-controlled-page", tabId: page.tabId })); }
    catch (error) { results.push({ expected: page.config, actual: { inspectionError: error.message }, session: page }); }
  }
  return createDiagnosticsReport(results, {
    extensionVersion: chrome.runtime.getManifest().version,
    browser: navigator.userAgent
  });
}

async function exportReport(format) {
  try {
    setMessage("正在检查所有环境并生成报告…");
    const report = await collectDiagnostics();
    const stamp = new Date().toISOString().replaceAll(":", "-");
    if (format === "json") {
      downloadText(`locale-diagnostics-${stamp}.json`, `${JSON.stringify(report, null, 2)}\n`, "application/json");
    } else {
      downloadText(`locale-diagnostics-${stamp}.md`, formatDiagnosticsMarkdown(report), "text/markdown");
    }
    setMessage("诊断报告已生成；网址仅保留 origin。", "success");
    await refreshSessions();
  } catch (error) { setMessage(error.message, "error"); }
}

presetInput.addEventListener("input", applySelectedPreset);
presetInput.addEventListener("change", applySelectedPreset);
presetSelect.addEventListener("change", () => {
  const preset = resolvedPresets.find((item) => item.id === presetSelect.value);
  if (!preset) { presetInput.value = ""; return; }
  presetInput.value = preset.label;
  languageInput.value = preset.language;
  additionalLanguagesInput.value = "";
  timezoneInput.value = preset.timezoneId;
  updatePreview();
});
for (const input of [languageInput, additionalLanguagesInput, timezoneInput]) {
  input.addEventListener("input", () => { selectMatchingPreset(); updatePreview(); });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage();
  let config;
  try { config = getConfigFromForm(); }
  catch (error) { setMessage(error.message, "error"); return; }
  setBusy(true);
  try {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: {
        url: getRememberedOrigin(config.url),
        language: config.language,
        languages: config.languages,
        timezoneId: config.timezoneId
      }
    });
    await sendMessage({ type: "open-controlled-page", config });
    setMessage("隔离窗口已打开；可直接用浏览器的“+”或 Ctrl/Cmd+T 新建隔离标签页。", "success");
    await refreshSessions();
  } catch (error) { setMessage(error.message, "error"); }
  finally { setBusy(false); }
});

saveProfileButton.addEventListener("click", async () => {
  try {
    const config = getConfigFromForm();
    const profile = normalizeProfile({
      id: createId(),
      name: profileNameInput.value,
      languages: config.languages,
      timezoneId: config.timezoneId
    });
    savedProfiles = mergeProfiles(savedProfiles, [profile]);
    await profileStorageSet(savedProfiles);
    renderProfiles();
    setMessage(`已保存配置“${profile.name}”。`, "success");
  } catch (error) { setMessage(error.message, "error"); }
});

openMatrixButton.addEventListener("click", async () => {
  const ids = [...document.querySelectorAll(".profile-checkbox:checked")].map((checkbox) => checkbox.dataset.profileId);
  const selected = savedProfiles.filter((profile) => ids.includes(profile.id));
  if (!selected.length) { setMessage("请先勾选至少一个测试配置。", "error"); return; }
  let normalizedUrl;
  try { normalizedUrl = getConfigFromForm().url; }
  catch (error) { setMessage(error.message, "error"); return; }
  setBusy(true);
  let opened = 0;
  try {
    for (const profile of selected) {
      await sendMessage({ type: "open-controlled-page", config: normalizeConfig({ url: normalizedUrl, ...profile }) });
      opened += 1;
    }
    setMessage(`已打开 ${opened} 个独立测试窗口。`, "success");
    await refreshSessions();
  } catch (error) { setMessage(`已打开 ${opened} 个；随后失败：${error.message}`, "error"); }
  finally { setBusy(false); }
});

exportProfilesButton.addEventListener("click", () => {
  if (!savedProfiles.length) { setMessage("没有可导出的测试配置。", "error"); return; }
  const document = createProfileDocument(savedProfiles);
  downloadText("dedicated-locale-profiles.json", `${JSON.stringify(document, null, 2)}\n`, "application/json");
  setMessage("配置已导出；文件不含网址、Cookie 或登录状态。", "success");
});

importProfilesButton.addEventListener("click", () => profileFileInput.click());
profileFileInput.addEventListener("change", async () => {
  const [file] = profileFileInput.files;
  if (!file) return;
  try {
    savedProfiles = mergeProfiles(savedProfiles, parseProfileDocument(await file.text()));
    await profileStorageSet(savedProfiles);
    renderProfiles();
    setMessage(`已导入配置，共保存 ${savedProfiles.length} 项。`, "success");
  } catch (error) { setMessage(`导入失败：${error.message}`, "error"); }
  finally { profileFileInput.value = ""; }
});

refreshButton.addEventListener("click", refreshSessions);
exportReportJsonButton.addEventListener("click", () => exportReport("json"));
exportReportMarkdownButton.addEventListener("click", () => exportReport("markdown"));
populateReferenceLists();
await loadSettings();
await loadProfiles();
await refreshSessions();
window.setInterval(refreshSessions, 5000);
