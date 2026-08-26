import { buildLanguageList, normalizeConfig } from "./lib/config.js";

const REGISTRY_KEY = "controlledTabsV1";
const CONTROL_PAGE = "control.html";
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const WINDOW_SIZE = Object.freeze({ width: 1280, height: 900 });

let registryQueue = Promise.resolve();
const tabProtectionPromises = new Map();

function errorText(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "未知错误");
}

async function readRegistry() {
  const stored = await chrome.storage.session.get(REGISTRY_KEY);
  return stored[REGISTRY_KEY] ?? {};
}

function updateRegistry(mutator) {
  const operation = registryQueue
    .catch(() => undefined)
    .then(async () => {
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

async function deleteRecord(tabId) {
  await updateRegistry((registry) => {
    delete registry[String(tabId)];
  });
}

async function getRecord(tabId) {
  const registry = await readRegistry();
  return registry[String(tabId)] ?? null;
}

async function getWindowSeed(windowId) {
  const registry = await readRegistry();
  return Object.values(registry).find((record) => record.windowId === windowId) ?? null;
}

async function deleteWindowRecords(windowId) {
  await updateRegistry((registry) => {
    for (const [tabId, record] of Object.entries(registry)) {
      if (record.windowId === windowId) {
        delete registry[tabId];
      }
    }
  });
}

async function sendCommand(target, method, params = undefined) {
  return chrome.debugger.sendCommand(target, method, params);
}

async function captureUserAgentProfile(target) {
  const expression = String.raw`(async () => {
    const profile = {
      userAgent: navigator.userAgent,
      metadata: null
    };
    const data = navigator.userAgentData;
    if (!data) return profile;

    let high = {};
    try {
      high = await data.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList",
        "wow64"
      ]);
    } catch {
      high = {};
    }

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
    if (Array.isArray(data.formFactors)) {
      profile.metadata.formFactors = data.formFactors;
    }
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
  if (!profile?.userAgent) {
    throw new Error("浏览器没有返回有效的 User-Agent。");
  }
  return profile;
}

async function applyOverrides(target, config, userAgentProfile) {
  await sendCommand(target, "Emulation.setTimezoneOverride", {
    timezoneId: config.timezoneId
  });

  await sendCommand(target, "Emulation.setLocaleOverride", {
    locale: config.locale
  });

  const languages = config.languages ?? buildLanguageList(config.language);
  const userAgentParams = {
    userAgent: userAgentProfile.userAgent,
    acceptLanguage: languages.join(",")
  };
  if (userAgentProfile.metadata) {
    userAgentParams.userAgentMetadata = userAgentProfile.metadata;
  }

  await sendCommand(target, "Emulation.setUserAgentOverride", userAgentParams);
  await sendCommand(target, "Network.setExtraHTTPHeaders", {
    headers: {
      "Accept-Language": config.acceptLanguage
    }
  });
}

async function enableChildTargetProtection(target) {
  await sendCommand(target, "Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true
  });
}

async function protectControlledTab(tabId, seed, navigateUrl = null) {
  if (tabProtectionPromises.has(tabId)) {
    return tabProtectionPromises.get(tabId);
  }

  const protection = (async () => {
    if (await getRecord(tabId)) {
      return { tabId, windowId: seed.windowId };
    }

    const target = { tabId };
    try {
      await chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
      await saveRecord(tabId, {
        config: seed.config,
        userAgentProfile: seed.userAgentProfile,
        windowId: seed.windowId,
        createdAt: new Date().toISOString()
      });
      await applyOverrides(target, seed.config, seed.userAgentProfile);
      await enableChildTargetProtection(target);
      if (navigateUrl) {
        await sendCommand(target, "Page.navigate", { url: navigateUrl });
      }
      return { tabId, windowId: seed.windowId };
    } catch (error) {
      await deleteRecord(tabId);
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // The tab may already be closed.
      }
      throw error;
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
  let tabId = null;

  try {
    createdWindow = await chrome.windows.create({
      url: "about:blank",
      type: "normal",
      focused: true,
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height
    });

    const tab = createdWindow.tabs?.[0];
    if (!tab?.id) {
      throw new Error("浏览器没有成功创建专用页面。");
    }
    tabId = tab.id;

    const target = { tabId };
    await chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
    const userAgentProfile = await captureUserAgentProfile(target);

    await saveRecord(tabId, {
      config,
      userAgentProfile,
      windowId: createdWindow.id,
      createdAt: new Date().toISOString()
    });

    await applyOverrides(target, config, userAgentProfile);
    await enableChildTargetProtection(target);
    await sendCommand(target, "Page.navigate", { url: config.url });

    return {
      tabId,
      windowId: createdWindow.id,
      config
    };
  } catch (error) {
    if (createdWindow?.id) {
      try {
        await chrome.windows.remove(createdWindow.id);
      } catch {
        // The window may already have been closed by the user.
      }
    }
    if (tabId !== null) {
      await deleteRecord(tabId);
    }
    throw new Error(`专用页面启动失败：${errorText(error)}`);
  }
}

async function listControlledPages() {
  const registry = await readRegistry();
  const windows = new Map();
  const staleTabIds = [];

  for (const [tabIdText, record] of Object.entries(registry)) {
    const tabId = Number(tabIdText);
    try {
      const tab = await chrome.tabs.get(tabId);
      const group = windows.get(tab.windowId) ?? {
        windowId: tab.windowId,
        config: record.config,
        createdAt: record.createdAt,
        tabs: []
      };
      group.tabs.push({
        tabId,
        title: tab.title || "专用页面",
        url: tab.url || record.config.url,
        active: Boolean(tab.active)
      });
      if (record.createdAt < group.createdAt) {
        group.createdAt = record.createdAt;
      }
      windows.set(tab.windowId, group);
    } catch {
      staleTabIds.push(tabId);
    }
  }

  if (staleTabIds.length) {
    await updateRegistry((current) => {
      for (const tabId of staleTabIds) {
        delete current[String(tabId)];
      }
    });
  }

  return [...windows.values()]
    .map((group) => {
      const activeTab = group.tabs.find((tab) => tab.active) ?? group.tabs[0];
      return {
        tabId: activeTab.tabId,
        windowId: group.windowId,
        title: activeTab.title,
        url: activeTab.url,
        tabCount: group.tabs.length,
        config: group.config,
        createdAt: group.createdAt
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function inspectControlledPage(tabId) {
  const record = await getRecord(tabId);
  if (!record) {
    throw new Error("该页面已不在受控状态，请重新创建专用页面。");
  }

  const expression = String.raw`(() => {
    const now = new Date();
    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    return {
      timestampMs: now.getTime(),
      language: navigator.language,
      languages: Array.from(navigator.languages ?? []),
      locale: resolved.locale,
      timezone: resolved.timeZone,
      timezoneOffsetMinutes: now.getTimezoneOffset(),
      localDateText: now.toString(),
      documentLanguage: document.documentElement.lang || null
    };
  })()`;

  const response = await sendCommand({ tabId }, "Runtime.evaluate", {
    expression,
    returnByValue: true
  });

  if (response?.exceptionDetails) {
    throw new Error("页面环境读取失败，页面可能正在跳转。");
  }

  return {
    expected: record.config,
    actual: response?.result?.value ?? null
  };
}

async function createControlledTab(windowId) {
  const seed = await getWindowSeed(windowId);
  if (!seed) {
    throw new Error("该隔离窗口已失效，请重新创建。");
  }

  await chrome.windows.get(windowId);
  const tab = await chrome.tabs.create({
    windowId,
    url: "about:blank",
    active: true
  });
  if (!tab.id) {
    throw new Error("浏览器没有成功创建新的隔离标签页。");
  }

  await protectControlledTab(tab.id, seed);
  return { tabId: tab.id, windowId };
}

async function focusControlledPage(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tabId, { active: true });
}

async function closeControlledPage(tabId) {
  const record = await getRecord(tabId);
  if (!record) {
    throw new Error("该专用页面已经关闭。");
  }

  await deleteWindowRecords(record.windowId);
  try {
    await chrome.windows.remove(record.windowId);
  } catch {
    const tabs = await chrome.tabs.query({ windowId: record.windowId });
    const tabIds = tabs.map((tab) => tab.id).filter(Number.isInteger);
    if (tabIds.length) {
      await chrome.tabs.remove(tabIds);
    }
  }
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

chrome.action.onClicked.addListener(() => {
  openControlPage().catch((error) => console.error(errorText(error)));
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    openControlPage().catch((error) => console.error(errorText(error)));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case "open-controlled-page":
        return createControlledPage(message.config);
      case "list-controlled-pages":
        return listControlledPages();
      case "inspect-controlled-page":
        return inspectControlledPage(Number(message.tabId));
      case "create-controlled-tab":
        return createControlledTab(Number(message.windowId));
      case "focus-controlled-page":
        return focusControlledPage(Number(message.tabId));
      case "close-controlled-page":
        return closeControlledPage(Number(message.tabId));
      default:
        throw new Error("不支持的扩展操作。");
    }
  };

  run()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: errorText(error) }));

  return true;
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method !== "Target.attachedToTarget" || source.tabId === undefined) {
    return;
  }

  const protectChildTarget = async () => {
    const record = await getRecord(source.tabId);
    if (!record) {
      return;
    }

    const childTarget = {
      tabId: source.tabId,
      sessionId: params.sessionId
    };

    try {
      await applyOverrides(childTarget, record.config, record.userAgentProfile);
      await enableChildTargetProtection(childTarget);
    } catch (error) {
      console.warn(
        `无法对 ${params.targetInfo?.type ?? "child"} 子目标应用全部覆盖：${errorText(error)}`
      );
    } finally {
      try {
        await sendCommand(childTarget, "Runtime.runIfWaitingForDebugger");
      } catch {
        // The child target may have disappeared during navigation.
      }
    }
  };

  protectChildTarget().catch((error) => console.error(errorText(error)));
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId === undefined) {
    return;
  }

  const failClosed = async () => {
    const record = await getRecord(source.tabId);
    if (!record) {
      return;
    }
    await deleteRecord(source.tabId);

    if (reason !== "target_closed") {
      try {
        await chrome.windows.remove(record.windowId);
      } catch {
        try {
          await chrome.tabs.remove(source.tabId);
        } catch {
          // The controlled page is already gone.
        }
      }
    }
  };

  failClosed().catch((error) => console.error(errorText(error)));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  deleteRecord(tabId).catch((error) => console.error(errorText(error)));
});

chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.id || !Number.isInteger(tab.windowId)) {
    return;
  }

  const inheritWindowEnvironment = async () => {
    const seed = await getWindowSeed(tab.windowId);
    if (!seed || await getRecord(tab.id)) {
      return;
    }

    const requestedUrl = tab.pendingUrl || tab.url || "";
    const navigateUrl = /^https?:/i.test(requestedUrl) ? requestedUrl : null;
    if (requestedUrl && requestedUrl !== "about:blank") {
      await chrome.tabs.update(tab.id, { url: "about:blank" });
    }
    await protectControlledTab(tab.id, seed, navigateUrl);
  };

  inheritWindowEnvironment().catch((error) => {
    console.error(`新标签页隔离失败：${errorText(error)}`);
  });
});
