import { normalizeConfig } from "./lib/config.js";

const REGISTRY_KEY = "controlledTabsV1";
const CONTROL_PAGE = "control.html";
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const WINDOW_SIZE = Object.freeze({ width: 1280, height: 900 });

let registryQueue = Promise.resolve();

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

  const userAgentParams = {
    userAgent: userAgentProfile.userAgent,
    acceptLanguage: config.acceptLanguage
  };
  if (userAgentProfile.metadata) {
    userAgentParams.userAgentMetadata = userAgentProfile.metadata;
  }

  await sendCommand(target, "Emulation.setUserAgentOverride", userAgentParams);
}

async function enableChildTargetProtection(target) {
  await sendCommand(target, "Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true
  });
}

async function createControlledPage(rawConfig) {
  const config = normalizeConfig(rawConfig);
  let createdWindow = null;
  let tabId = null;

  try {
    createdWindow = await chrome.windows.create({
      url: "about:blank",
      type: "popup",
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
  const pages = [];
  const staleTabIds = [];

  for (const [tabIdText, record] of Object.entries(registry)) {
    const tabId = Number(tabIdText);
    try {
      const tab = await chrome.tabs.get(tabId);
      pages.push({
        tabId,
        windowId: tab.windowId,
        title: tab.title || "专用页面",
        url: tab.url || record.config.url,
        config: record.config,
        createdAt: record.createdAt
      });
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

  return pages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  try {
    await chrome.windows.remove(record.windowId);
  } catch {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // It is already gone; registry cleanup still needs to run.
    }
  }
  await deleteRecord(tabId);
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
