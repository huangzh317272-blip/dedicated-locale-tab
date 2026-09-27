import { normalizeConfig, normalizeUrl } from "./lib/config.js";
import { getTimezoneProbeTimestamps } from "./lib/inspection.js";
import {
  TAB_STATUS,
  classifyDebuggerError,
  errorText,
  findHeader,
  summarizeHealth
} from "./lib/session.js";

const REGISTRY_KEY = "controlledTabsV2";
const LAST_FAILURE_KEY = "lastIsolationFailureV1";
const CONTROL_PAGE = "control.html";
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const WINDOW_SIZE = Object.freeze({ width: 1280, height: 900 });
const GROUP_MARKER_PREFIX = "Locale Lab • ";
const CHILD_TARGET_TYPES = new Set([
  "iframe",
  "page",
  "worker",
  "shared_worker",
  "service_worker"
]);

let registryQueue = Promise.resolve();
const tabProtectionPromises = new Map();
const childProtectionPromises = new Map();
const networkRequests = new Map();
const detachedTabs = new Map();

async function readRegistry() {
  const stored = await chrome.storage.session.get(REGISTRY_KEY);
  return stored[REGISTRY_KEY] ?? {};
}

function updateRegistry(mutator) {
  const operation = registryQueue.catch(() => undefined).then(async () => {
    const registry = await readRegistry();
    const result = await mutator(registry);
    await chrome.storage.session.set({ [REGISTRY_KEY]: registry });
    return result;
  });
  registryQueue = operation;
  return operation;
}

async function saveRecord(tabId, record) {
  await updateRegistry((registry) => {
    registry[String(tabId)] = record;
  });
}

async function patchRecord(tabId, changes) {
  return updateRegistry((registry) => {
    const record = registry[String(tabId)];
    if (!record) return null;
    Object.assign(record, changes);
    return record;
  });
}

async function incrementProtectedChildTargets(tabId, targetType) {
  return updateRegistry((registry) => {
    const record = registry[String(tabId)];
    if (!record) return null;
    record.protectedChildTargets = (record.protectedChildTargets ?? 0) + 1;
    record.lastChildTargetType = targetType ?? "unknown";
    record.updatedAt = new Date().toISOString();
    return record;
  });
}

async function patchWindowRecords(windowId, changes) {
  await updateRegistry((registry) => {
    for (const record of Object.values(registry)) {
      if (record.windowId === windowId) Object.assign(record, changes);
    }
  });
}

async function deleteRecord(tabId) {
  await updateRegistry((registry) => {
    delete registry[String(tabId)];
  });
}

async function deleteWindowRecords(windowId) {
  await updateRegistry((registry) => {
    for (const [tabId, record] of Object.entries(registry)) {
      if (record.windowId === windowId) delete registry[tabId];
    }
  });
}

async function getRecord(tabId) {
  const registry = await readRegistry();
  return registry[String(tabId)] ?? null;
}

async function getWindowRecords(windowId) {
  const registry = await readRegistry();
  return Object.entries(registry)
    .filter(([, record]) => record.windowId === windowId)
    .map(([tabId, record]) => ({ tabId: Number(tabId), ...record }));
}

async function getWindowSeed(windowId) {
  const records = await getWindowRecords(windowId);
  return records.find((record) => record.status === TAB_STATUS.HEALTHY)
    ?? records[0]
    ?? null;
}

async function sendCommand(target, method, params = undefined) {
  return chrome.debugger.sendCommand(target, method, params);
}

async function captureUserAgentProfile(target) {
  const expression = String.raw`(async () => {
    const profile = { userAgent: navigator.userAgent, metadata: null };
    const data = navigator.userAgentData;
    if (!data) return profile;
    let high = {};
    try {
      high = await data.getHighEntropyValues([
        "architecture", "bitness", "model", "platformVersion",
        "uaFullVersion", "fullVersionList", "wow64"
      ]);
    } catch {}
    profile.metadata = {
      brands: high.brands ?? data.brands ?? [],
      fullVersionList: high.fullVersionList ?? [],
      fullVersion: high.uaFullVersion ?? "",
      platform: high.platform ?? data.platform ?? "",
      platformVersion: high.platformVersion ?? "",
      architecture: high.architecture ?? "",
      model: high.model ?? "",
      mobile: high.mobile ?? data.mobile ?? false,
      bitness: high.bitness ?? "",
      wow64: high.wow64 ?? false
    };
    if (Array.isArray(data.formFactors)) profile.metadata.formFactors = data.formFactors;
    return profile;
  })()`;
  const response = await sendCommand(target, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response?.exceptionDetails) {
    throw new Error("无法读取当前浏览器的 User-Agent 配置。");
  }
  const profile = response?.result?.value;
  if (!profile?.userAgent) throw new Error("浏览器没有返回有效的 User-Agent。");
  return profile;
}

async function applyProfileToSession(target, config, userAgentProfile) {
  const userAgentParams = {
    userAgent: userAgentProfile.userAgent,
    // navigator.languages contains only explicit preferences. HTTP fallback
    // ranges are applied separately through Network.setExtraHTTPHeaders.
    acceptLanguage: config.languages.join(",")
  };
  if (userAgentProfile.metadata) {
    userAgentParams.userAgentMetadata = userAgentProfile.metadata;
  }
  const steps = [
    ["network", "Network.enable"],
    ["timezone", "Emulation.setTimezoneOverride", { timezoneId: config.timezoneId }],
    ["locale", "Emulation.setLocaleOverride", { locale: config.locale }],
    ["languages", "Emulation.setUserAgentOverride", userAgentParams],
    ["acceptLanguage", "Network.setExtraHTTPHeaders", {
      headers: { "Accept-Language": config.acceptLanguage }
    }]
  ];
  const applied = {};
  const failures = [];
  const inherited = [];
  for (const [name, method, params] of steps) {
    try {
      await sendCommand(target, method, params);
      applied[name] = true;
    } catch (error) {
      const message = errorText(error);
      const alreadyInherited = (name === "locale" && message.includes("Another locale override is already in effect"))
        || (name === "timezone" && message.includes("Another timezone override is already in effect"));
      if (alreadyInherited) {
        applied[name] = true;
        inherited.push(name);
        continue;
      }
      applied[name] = false;
      failures.push(`${name}: ${message}`);
    }
  }
  if (failures.length) {
    throw new Error(`环境覆盖不完整（${failures.join("；")}）`);
  }
  return { ...applied, inherited };
}

async function enableChildTargetProtection(target) {
  await sendCommand(target, "Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true,
    filter: [...CHILD_TARGET_TYPES].map((type) => ({ type, exclude: false }))
  });
}

function buildGroupTitle(config) {
  const languages = config.languages.join(",");
  return `${GROUP_MARKER_PREFIX}${languages} • ${config.timezoneId}`.slice(0, 120);
}

async function markControlledTab(tabId, seed) {
  let groupId = Number.isInteger(seed.groupId) && seed.groupId >= 0
    ? seed.groupId
    : null;
  if (groupId === null) {
    groupId = await chrome.tabs.group({
      tabIds: [tabId],
      createProperties: { windowId: seed.windowId }
    });
    await chrome.tabGroups.update(groupId, {
      title: buildGroupTitle(seed.config),
      color: "green",
      collapsed: false
    });
    await patchWindowRecords(seed.windowId, { groupId });
  } else {
    await chrome.tabs.group({ groupId, tabIds: [tabId] });
  }
  return groupId;
}

async function isWindowPresent(windowId) {
  try {
    await chrome.windows.get(windowId);
    return true;
  } catch {
    return false;
  }
}

async function closeControlledWindow(windowId, reason) {
  if (reason !== "用户主动关闭隔离窗口。") {
    await chrome.storage.session.set({
      [LAST_FAILURE_KEY]: {
        windowId,
        reason: reason || "隔离窗口已关闭。",
        occurredAt: new Date().toISOString()
      }
    });
  }
  await patchWindowRecords(windowId, {
    status: TAB_STATUS.CLOSING,
    lastError: reason,
    updatedAt: new Date().toISOString()
  });
  let firstError = null;
  try {
    await chrome.windows.remove(windowId);
  } catch (error) {
    firstError = error;
  }
  if (await isWindowPresent(windowId)) {
    try {
      const tabs = await chrome.tabs.query({ windowId });
      const tabIds = tabs.map((tab) => tab.id).filter(Number.isInteger);
      if (tabIds.length) await chrome.tabs.remove(tabIds);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (await isWindowPresent(windowId)) {
    const message = `无法关闭失去隔离保护的窗口：${errorText(firstError)}`;
    await patchWindowRecords(windowId, {
      status: TAB_STATUS.CLOSE_FAILED,
      lastError: message
    });
    throw new Error(message);
  }
  await deleteWindowRecords(windowId);
}

async function closeUnexpectedTab(tabId, windowId, reason) {
  await patchWindowRecords(windowId, {
    lastWarning: reason,
    updatedAt: new Date().toISOString()
  });
  try {
    await chrome.tabs.remove(tabId);
  } catch (error) {
    await closeControlledWindow(windowId, `${reason}；标签页关闭失败：${errorText(error)}`);
  }
}

async function protectControlledTab(tabId, seed, navigateUrl = null) {
  if (tabProtectionPromises.has(tabId)) return tabProtectionPromises.get(tabId);
  const protection = (async () => {
    const existing = await getRecord(tabId);
    if (existing?.status === TAB_STATUS.HEALTHY) {
      return { tabId, windowId: existing.windowId };
    }
    const target = { tabId };
    let userAgentProfile = seed.userAgentProfile ?? null;
    await saveRecord(tabId, {
      config: seed.config,
      userAgentProfile,
      windowId: seed.windowId,
      groupId: seed.groupId ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: TAB_STATUS.ATTACHING,
      lastError: null,
      lastWarning: null,
      protectedChildTargets: 0,
      lastRequest: null,
      lastVerifiedAt: null
    });
    try {
      await chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
      if (!userAgentProfile) {
        userAgentProfile = await captureUserAgentProfile(target);
        await patchRecord(tabId, { userAgentProfile });
      }
      await patchRecord(tabId, { status: TAB_STATUS.APPLYING });
      const applied = await applyProfileToSession(target, seed.config, userAgentProfile);
      await enableChildTargetProtection(target);
      const groupId = await markControlledTab(tabId, {
        ...seed,
        userAgentProfile
      });
      await patchRecord(tabId, {
        status: TAB_STATUS.HEALTHY,
        groupId,
        applied,
        updatedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString()
      });
      if (navigateUrl) await sendCommand(target, "Page.navigate", { url: navigateUrl });
      return { tabId, windowId: seed.windowId };
    } catch (error) {
      const classified = classifyDebuggerError(error);
      await patchRecord(tabId, {
        status: classified.status,
        lastError: classified.message,
        updatedAt: new Date().toISOString()
      });
      try {
        await closeControlledWindow(seed.windowId, classified.message);
      } catch (closeError) {
        throw new Error(`${classified.message}；${errorText(closeError)}`);
      }
      throw new Error(classified.message);
    }
  })();
  tabProtectionPromises.set(tabId, protection);
  try {
    return await protection;
  } finally {
    tabProtectionPromises.delete(tabId);
  }
}

async function createControlledPage(rawConfig) {
  const config = normalizeConfig(rawConfig);
  let createdWindow = null;
  try {
    createdWindow = await chrome.windows.create({
      url: "about:blank",
      type: "normal",
      focused: true,
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height
    });
    const tab = createdWindow.tabs?.[0];
    if (!tab?.id || !Number.isInteger(createdWindow.id)) {
      throw new Error("浏览器没有成功创建专用页面。");
    }
    await protectControlledTab(tab.id, {
      config,
      userAgentProfile: null,
      windowId: createdWindow.id,
      groupId: null
    }, config.url);
    return { tabId: tab.id, windowId: createdWindow.id, config };
  } catch (error) {
    if (createdWindow?.id && await isWindowPresent(createdWindow.id)) {
      try {
        await closeControlledWindow(createdWindow.id, errorText(error));
      } catch {}
    }
    throw new Error(`专用页面启动失败：${errorText(error)}`);
  }
}

async function attachedControlledTabIds() {
  const targets = await chrome.debugger.getTargets();
  return new Set(targets.filter((target) => target.attached && Number.isInteger(target.tabId))
    .map((target) => target.tabId));
}

async function listControlledPages() {
  const registry = await readRegistry();
  const attached = await attachedControlledTabIds();
  const windows = new Map();
  const staleTabIds = [];
  const compromisedWindows = new Map();

  for (const [tabIdText, record] of Object.entries(registry)) {
    const tabId = Number(tabIdText);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (record.status === TAB_STATUS.HEALTHY && !attached.has(tabId)) {
        compromisedWindows.set(record.windowId, "调试连接已断开。");
      }
      const group = windows.get(record.windowId) ?? {
        windowId: record.windowId,
        config: record.config,
        createdAt: record.createdAt,
        statuses: [],
        tabs: [],
        protectedChildTargets: 0,
        lastVerifiedAt: null,
        lastError: null,
        lastWarning: null
      };
      group.statuses.push(record.status);
      group.protectedChildTargets += record.protectedChildTargets ?? 0;
      group.lastVerifiedAt = record.lastVerifiedAt ?? group.lastVerifiedAt;
      group.lastError = record.lastError ?? group.lastError;
      group.lastWarning = record.lastWarning ?? group.lastWarning;
      group.tabs.push({
        tabId,
        title: tab.title || "专用页面",
        url: tab.url || record.config.url,
        active: Boolean(tab.active)
      });
      if (record.createdAt < group.createdAt) group.createdAt = record.createdAt;
      windows.set(record.windowId, group);
    } catch {
      staleTabIds.push(tabId);
    }
  }

  if (staleTabIds.length) {
    await updateRegistry((current) => {
      for (const tabId of staleTabIds) delete current[String(tabId)];
    });
  }

  for (const group of windows.values()) {
    try {
      const allTabs = await chrome.tabs.query({ windowId: group.windowId });
      const controlledIds = new Set(group.tabs.map((tab) => tab.tabId));
      group.untrustedTabCount = allTabs.filter((tab) => !controlledIds.has(tab.id)).length;
      if (group.untrustedTabCount) {
        compromisedWindows.set(group.windowId, "窗口内存在未受控标签页。");
      }
    } catch {
      compromisedWindows.set(group.windowId, "无法枚举隔离窗口中的标签页。");
    }
  }

  for (const [windowId, reason] of compromisedWindows) {
    try { await closeControlledWindow(windowId, reason); } catch {}
    windows.delete(windowId);
  }

  return [...windows.values()].map((group) => {
    const activeTab = group.tabs.find((tab) => tab.active) ?? group.tabs[0];
    return {
      tabId: activeTab.tabId,
      windowId: group.windowId,
      title: activeTab.title,
      url: activeTab.url,
      tabCount: group.tabs.length,
      controlledTabCount: group.tabs.length,
      untrustedTabCount: group.untrustedTabCount ?? 0,
      protectedChildTargets: group.protectedChildTargets,
      status: summarizeHealth(group.statuses),
      lastVerifiedAt: group.lastVerifiedAt,
      lastError: group.lastError,
      lastWarning: group.lastWarning,
      config: group.config,
      createdAt: group.createdAt
    };
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildInspectionExpression(probeTimestamps) {
  return `(async () => {
    const now = new Date();
    const dateResolved = new Intl.DateTimeFormat().resolvedOptions();
    const safe = (factory) => { try { return factory(); } catch (error) { return { error: String(error) }; } };
    let uaData = null;
    if (navigator.userAgentData) {
      let high = {};
      try {
        high = await navigator.userAgentData.getHighEntropyValues([
          "architecture", "bitness", "model", "platformVersion", "uaFullVersion", "fullVersionList", "wow64"
        ]);
      } catch {}
      uaData = {
        brands: navigator.userAgentData.brands,
        mobile: navigator.userAgentData.mobile,
        platform: navigator.userAgentData.platform,
        ...high
      };
    }
    const temporalTimezone = globalThis.Temporal?.Now?.timeZoneId
      ? Temporal.Now.timeZoneId()
      : null;
    const probes = ${JSON.stringify(probeTimestamps)}.map((timestampMs) => ({
      timestampMs,
      offsetMinutes: new Date(timestampMs).getTimezoneOffset()
    }));
    return {
      timestampMs: now.getTime(),
      language: navigator.language,
      languages: Array.from(navigator.languages ?? []),
      locale: dateResolved.locale,
      timezone: dateResolved.timeZone,
      timezoneOffsetMinutes: now.getTimezoneOffset(),
      timezoneProbes: probes,
      temporalTimezone,
      localDateText: now.toString(),
      documentLanguage: document.documentElement.lang || null,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      userAgentData: uaData,
      intl: {
        dateTime: dateResolved,
        number: safe(() => ({ resolved: new Intl.NumberFormat().resolvedOptions(), sample: new Intl.NumberFormat().format(1234567.89) })),
        percent: safe(() => new Intl.NumberFormat(undefined, { style: "percent" }).format(0.1234)),
        collator: safe(() => new Intl.Collator().resolvedOptions()),
        pluralRules: safe(() => new Intl.PluralRules().resolvedOptions()),
        relativeTime: safe(() => ({ resolved: new Intl.RelativeTimeFormat().resolvedOptions(), sample: new Intl.RelativeTimeFormat().format(-1, "day") })),
        list: safe(() => ({ resolved: new Intl.ListFormat().resolvedOptions(), sample: new Intl.ListFormat().format(["A", "B", "C"]) })),
        displayNames: safe(() => typeof Intl.DisplayNames === "function" ? ({ resolved: new Intl.DisplayNames(undefined, { type: "region" }).resolvedOptions(), sample: new Intl.DisplayNames(undefined, { type: "region" }).of("US") }) : null),
        segmenter: safe(() => typeof Intl.Segmenter === "function" ? new Intl.Segmenter().resolvedOptions() : null)
      }
    };
  })()`;
}

async function inspectControlledPage(tabId) {
  const record = await getRecord(tabId);
  if (!record || record.status !== TAB_STATUS.HEALTHY) {
    throw new Error("该页面未处于健康受控状态，请重新创建专用页面。");
  }
  const attached = await attachedControlledTabIds();
  if (!attached.has(tabId)) {
    await closeControlledWindow(record.windowId, "检查时发现调试连接已经断开。");
    throw new Error("调试连接已经断开，窗口已按 fail-closed 规则关闭。");
  }
  const probeTimestamps = getTimezoneProbeTimestamps();
  const response = await sendCommand({ tabId }, "Runtime.evaluate", {
    expression: buildInspectionExpression(probeTimestamps),
    awaitPromise: true,
    returnByValue: true
  });
  if (response?.exceptionDetails) {
    throw new Error("页面环境读取失败，页面可能正在跳转。");
  }
  const actual = response?.result?.value ?? null;
  actual.requestAcceptLanguage = record.lastRequest?.acceptLanguage ?? null;
  actual.requestUserAgentHints = record.lastRequest?.userAgentHints ?? {};
  const verifiedAt = new Date().toISOString();
  await patchRecord(tabId, { lastVerifiedAt: verifiedAt });
  return {
    expected: record.config,
    actual,
    session: {
      tabId,
      windowId: record.windowId,
      url: (await chrome.tabs.get(tabId)).url ?? record.config.url,
      status: record.status,
      controlledTabCount: (await getWindowRecords(record.windowId)).length,
      untrustedTabCount: 0,
      protectedChildTargets: record.protectedChildTargets ?? 0,
      lastVerifiedAt: verifiedAt
    }
  };
}

async function createControlledTab(windowId, rawUrl = null) {
  const seed = await getWindowSeed(windowId);
  if (!seed || seed.status !== TAB_STATUS.HEALTHY) {
    throw new Error("该隔离窗口已失效，请重新创建。");
  }
  await chrome.windows.get(windowId);
  const tab = await chrome.tabs.create({ windowId, url: "about:blank", active: true });
  if (!tab.id) throw new Error("浏览器没有成功创建新的隔离标签页。");
  const navigateUrl = rawUrl ? normalizeUrl(rawUrl) : null;
  await protectControlledTab(tab.id, seed, navigateUrl);
  return { tabId: tab.id, windowId };
}

async function focusControlledPage(tabId) {
  const record = await getRecord(tabId);
  if (!record || record.status !== TAB_STATUS.HEALTHY) {
    throw new Error("该专用页面不再处于受控状态。");
  }
  const tab = await chrome.tabs.get(tabId);
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
}

async function closeControlledPage(tabId) {
  const record = await getRecord(tabId);
  if (!record) throw new Error("该专用页面已经关闭。");
  await closeControlledWindow(record.windowId, "用户主动关闭隔离窗口。");
}

async function openControlPage() {
  const controlUrl = chrome.runtime.getURL(CONTROL_PAGE);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url === controlUrl);
  if (existing?.id) {
    await chrome.windows.update(existing.windowId, { focused: true });
    await chrome.tabs.update(existing.id, { active: true });
    return;
  }
  await chrome.tabs.create({ url: controlUrl });
}

async function recoverOrphanedGroups() {
  const registry = await readRegistry();
  let attached = new Set();
  try { attached = await attachedControlledTabIds(); } catch {}
  const groups = await chrome.tabGroups.query({});
  for (const group of groups) {
    if (!group.title?.startsWith(GROUP_MARKER_PREFIX) || !Number.isInteger(group.windowId)) continue;
    const records = Object.entries(registry)
      .filter(([, record]) => record.windowId === group.windowId);
    let groupTabs = [];
    try { groupTabs = await chrome.tabs.query({ groupId: group.id }); } catch {}
    const controlledIds = new Set(records.map(([tabId]) => Number(tabId)));
    const trusted = records.length > 0
      && groupTabs.length === records.length
      && groupTabs.every((tab) => controlledIds.has(tab.id))
      && records.every(([tabId, record]) =>
        record.status === TAB_STATUS.HEALTHY
        && record.groupId === group.id
        && attached.has(Number(tabId)));
    if (!trusted) {
      try {
        await closeControlledWindow(group.windowId, "启动恢复时发现安全标签组缺少完整 debugger 保护。");
      } catch (error) {
        console.error(errorText(error));
      }
    }
  }
}

function networkKey(source, requestId) {
  return `${source.tabId}:${source.sessionId ?? "root"}:${requestId}`;
}

async function handleNetworkEvent(source, method, params) {
  if (source.tabId === undefined || source.sessionId !== undefined) return;
  const key = networkKey(source, params.requestId);
  const entry = networkRequests.get(key) ?? {};
  if (method === "Network.requestWillBeSent") {
    entry.isDocument = params.type === "Document";
    entry.url = params.request?.url ?? null;
  } else if (method === "Network.requestWillBeSentExtraInfo") {
    entry.headers = params.headers ?? {};
  }
  networkRequests.set(key, entry);
  if (entry.isDocument && entry.headers) {
    const acceptLanguage = findHeader(entry.headers, "accept-language");
    const userAgentHints = Object.fromEntries(Object.entries(entry.headers)
      .filter(([name]) => name.toLowerCase().startsWith("sec-ch-ua")));
    await patchRecord(source.tabId, {
      lastRequest: {
        url: entry.url,
        acceptLanguage,
        userAgentHints,
        observedAt: new Date().toISOString()
      }
    });
    networkRequests.delete(key);
  }
  if (networkRequests.size > 200) {
    const first = networkRequests.keys().next().value;
    networkRequests.delete(first);
  }
}

async function protectChildTarget(source, params) {
  if (source.tabId === undefined || !CHILD_TARGET_TYPES.has(params.targetInfo?.type)) return;
  const key = `${source.tabId}:${params.sessionId}`;
  if (childProtectionPromises.has(key)) return childProtectionPromises.get(key);
  const protection = (async () => {
    const record = await getRecord(source.tabId);
    if (!record || ![TAB_STATUS.APPLYING, TAB_STATUS.HEALTHY].includes(record.status)) return;
    const childTarget = { tabId: source.tabId, sessionId: params.sessionId };
    try {
      await applyProfileToSession(childTarget, record.config, record.userAgentProfile);
      await enableChildTargetProtection(childTarget);
      await incrementProtectedChildTargets(source.tabId, params.targetInfo?.type);
      await sendCommand(childTarget, "Runtime.runIfWaitingForDebugger");
    } catch (error) {
      const message = `子目标 ${params.targetInfo?.type ?? "unknown"} 覆盖失败：${errorText(error)}`;
      await patchRecord(source.tabId, {
        status: TAB_STATUS.DEGRADED,
        lastError: message
      });
      // Do not resume a partially protected target. Closing the complete window
      // destroys the paused target and preserves fail-closed behavior.
      await closeControlledWindow(record.windowId, message);
    }
  })();
  childProtectionPromises.set(key, protection);
  try { return await protection; } finally { childProtectionPromises.delete(key); }
}

chrome.action.onClicked.addListener(() => {
  openControlPage().catch((error) => console.error(errorText(error)));
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  recoverOrphanedGroups().catch((error) => console.error(errorText(error)));
  if (reason === "install") {
    openControlPage().catch((error) => console.error(errorText(error)));
  }
});

chrome.runtime.onStartup.addListener(() => {
  recoverOrphanedGroups().catch((error) => console.error(errorText(error)));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case "open-controlled-page": return createControlledPage(message.config);
      case "list-controlled-pages": return listControlledPages();
      case "inspect-controlled-page": return inspectControlledPage(Number(message.tabId));
      case "create-controlled-tab": return createControlledTab(Number(message.windowId), message.url);
      case "focus-controlled-page": return focusControlledPage(Number(message.tabId));
      case "close-controlled-page": return closeControlledPage(Number(message.tabId));
      case "get-last-failure": {
        const stored = await chrome.storage.session.get(LAST_FAILURE_KEY);
        return stored[LAST_FAILURE_KEY] ?? null;
      }
      default: throw new Error("不支持的扩展操作。");
    }
  };
  run().then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: errorText(error) }));
  return true;
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Target.attachedToTarget") {
    protectChildTarget(source, params).catch((error) => console.error(errorText(error)));
    return;
  }
  if (method === "Network.requestWillBeSent" || method === "Network.requestWillBeSentExtraInfo") {
    handleNetworkEvent(source, method, params).catch((error) => console.error(errorText(error)));
  }
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId === undefined) return;
  const failClosed = async () => {
    const record = await getRecord(source.tabId);
    if (!record || record.status === TAB_STATUS.CLOSING) return;
    if (reason === "target_closed") return;
    await patchRecord(source.tabId, {
      status: TAB_STATUS.DETACHED,
      lastError: `调试连接意外断开：${reason}`
    });
    await closeControlledWindow(record.windowId, `调试连接意外断开：${reason}`);
  };
  failClosed().catch((error) => console.error(errorText(error)));
});

chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.id || !Number.isInteger(tab.windowId)) return;
  const inherit = async () => {
    const seed = await getWindowSeed(tab.windowId);
    if (!seed || await getRecord(tab.id)) return;
    const requestedUrl = tab.pendingUrl || tab.url || "";
    if (requestedUrl && requestedUrl !== "about:blank") {
      await closeUnexpectedTab(
        tab.id,
        tab.windowId,
        "已阻止在导航前无法验证的原生新标签页；请使用控制页的“新建隔离标签页”。"
      );
      return;
    }
    await protectControlledTab(tab.id, seed);
  };
  inherit().catch((error) => console.error(`新标签页隔离失败：${errorText(error)}`));
});

chrome.tabs.onDetached.addListener((tabId, info) => {
  detachedTabs.set(tabId, info);
});

chrome.tabs.onAttached.addListener((tabId, info) => {
  const handleAttach = async () => {
    const record = await getRecord(tabId);
    const targetSeed = await getWindowSeed(info.newWindowId);
    if (record && record.windowId !== info.newWindowId) {
      await closeUnexpectedTab(
        tabId,
        record.windowId,
        "受控标签页被移出原隔离窗口，已关闭该标签页。"
      );
      return;
    }
    if (!record && targetSeed) {
      await closeUnexpectedTab(
        tabId,
        info.newWindowId,
        "普通标签页不能拖入隔离窗口，已按 fail-closed 规则关闭。"
      );
    }
  };
  handleAttach().catch((error) => console.error(errorText(error)))
    .finally(() => detachedTabs.delete(tabId));
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  const handleReplacement = async () => {
    const record = await getRecord(removedTabId);
    if (!record) return;
    await closeControlledWindow(
      record.windowId,
      `浏览器以预渲染页面替换了受控标签 ${removedTabId} → ${addedTabId}，无法保证导航前覆盖。`
    );
  };
  handleReplacement().catch((error) => console.error(errorText(error)));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const verifyLifecycle = async () => {
    const record = await getRecord(tabId);
    if (!record || record.status !== TAB_STATUS.HEALTHY) return;
    if (tab.windowId !== record.windowId || (Number.isInteger(record.groupId) && tab.groupId !== record.groupId)) {
      await closeControlledWindow(record.windowId, "受控标签页离开了隔离窗口或安全标签组。");
      return;
    }
    if (changeInfo.discarded === false || changeInfo.status === "loading") {
      const attached = await attachedControlledTabIds();
      if (!attached.has(tabId)) {
        await closeControlledWindow(record.windowId, "标签恢复或导航时调试连接已丢失。");
      }
    }
  };
  verifyLifecycle().catch((error) => console.error(errorText(error)));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const handleRemoval = async () => {
    const record = await getRecord(tabId);
    // A programmatic fail-closed window removal owns the record lifecycle and
    // deletes all records only after the window is confirmed gone.
    if (record?.status === TAB_STATUS.CLOSING) return;
    await deleteRecord(tabId);
  };
  handleRemoval().catch((error) => console.error(errorText(error)));
});

recoverOrphanedGroups().catch((error) => console.error(errorText(error)));
