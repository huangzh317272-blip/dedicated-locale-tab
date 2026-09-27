import test from "node:test";
import assert from "node:assert/strict";

test("new tabs inherit strict window isolation and capture the real request header", async () => {
  const listeners = {};
  const commands = [];
  const attachedTabs = new Set();
  const sessionState = {};
  const tabs = new Map();
  const windows = new Set();
  const groups = new Map();
  let nextTabId = 100;
  let nextGroupId = 20;
  let failChildLocale = false;

  const event = (name) => ({ addListener(listener) { listeners[name] = listener; } });
  globalThis.chrome = {
    action: { onClicked: event("actionClicked") },
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      onInstalled: event("installed"),
      onStartup: event("startup"),
      onMessage: event("message")
    },
    storage: {
      session: {
        async get(key) { return { [key]: sessionState[key] }; },
        async set(values) { Object.assign(sessionState, values); }
      }
    },
    debugger: {
      onEvent: event("debuggerEvent"),
      onDetach: event("debuggerDetach"),
      async attach(target) { attachedTabs.add(target.tabId); },
      async getTargets() {
        return [...attachedTabs].map((tabId) => ({ tabId, attached: true }));
      },
      async sendCommand(target, method, params) {
        commands.push({ target, method, params });
        if (failChildLocale && target.sessionId === "child-fail" && method === "Emulation.setLocaleOverride") {
          throw new Error("synthetic child locale failure");
        }
        if (method === "Runtime.evaluate") {
          if (params.expression.includes("const profile")) {
            return { result: { value: { userAgent: "TestBrowser/1.0", metadata: null } } };
          }
          const timestampMs = Date.parse("2026-08-26T07:27:04Z");
          return {
            result: {
              value: {
                timestampMs,
                language: "en-US",
                languages: ["en-US"],
                locale: "en-US",
                timezone: "America/Los_Angeles",
                timezoneOffsetMinutes: 420,
                timezoneProbes: [],
                temporalTimezone: null,
                intl: {}
              }
            }
          };
        }
        if (method === "Page.navigate") tabs.get(target.tabId).url = params.url;
        return {};
      }
    },
    windows: {
      async create(options) {
        const windowId = 10;
        windows.add(windowId);
        const tab = { id: nextTabId++, windowId, groupId: -1, url: options.url, title: "Initial", active: true };
        tabs.set(tab.id, tab);
        return { id: windowId, tabs: [tab] };
      },
      async get(windowId) {
        if (!windows.has(windowId)) throw new Error("missing window");
        return { id: windowId };
      },
      async update() {},
      async remove(windowId) {
        windows.delete(windowId);
        for (const [tabId, tab] of tabs) {
          if (tab.windowId === windowId) {
            tabs.delete(tabId);
            attachedTabs.delete(tabId);
          }
        }
      }
    },
    tabGroups: {
      async query() { return [...groups.values()]; },
      async update(groupId, changes) {
        const group = { ...(groups.get(groupId) ?? { id: groupId, windowId: 10 }), ...changes };
        groups.set(groupId, group);
        return group;
      }
    },
    tabs: {
      onCreated: event("tabCreated"),
      onRemoved: event("tabRemoved"),
      onDetached: event("tabDetached"),
      onAttached: event("tabAttached"),
      onReplaced: event("tabReplaced"),
      onUpdated: event("tabUpdated"),
      async group({ groupId, tabIds, createProperties }) {
        const resolvedGroupId = Number.isInteger(groupId) ? groupId : nextGroupId++;
        if (!groups.has(resolvedGroupId)) {
          groups.set(resolvedGroupId, { id: resolvedGroupId, windowId: createProperties?.windowId ?? 10, title: "" });
        }
        for (const tabId of tabIds) tabs.get(tabId).groupId = resolvedGroupId;
        return resolvedGroupId;
      },
      async create(options) {
        for (const tab of tabs.values()) if (tab.windowId === options.windowId) tab.active = false;
        const tab = {
          id: nextTabId++, windowId: options.windowId, groupId: -1,
          url: options.url, title: "New tab", active: Boolean(options.active)
        };
        tabs.set(tab.id, tab);
        return tab;
      },
      async get(tabId) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error("missing tab");
        return tab;
      },
      async query({ windowId, groupId } = {}) {
        return [...tabs.values()].filter((tab) =>
          (windowId === undefined || tab.windowId === windowId)
          && (groupId === undefined || tab.groupId === groupId));
      },
      async update(tabId, changes) { Object.assign(tabs.get(tabId), changes); },
      async remove(tabIds) {
        for (const tabId of Array.isArray(tabIds) ? tabIds : [tabIds]) {
          tabs.delete(tabId);
          attachedTabs.delete(tabId);
        }
      }
    }
  };

  await import(`../background.js?test=${Date.now()}`);
  const sendMessage = (message) => new Promise((resolve) => listeners.message(message, {}, resolve));

  const opened = await sendMessage({
    type: "open-controlled-page",
    config: {
      url: "https://example.com",
      languages: ["en-US"],
      timezoneId: "America/Los_Angeles"
    }
  });
  assert.equal(opened.ok, true);

  const created = await sendMessage({ type: "create-controlled-tab", windowId: 10 });
  assert.equal(created.ok, true);
  assert.deepEqual([...attachedTabs], [100, 101]);

  const newTabCommands = commands.filter((entry) => entry.target.tabId === 101);
  assert.equal(
    newTabCommands.find((entry) => entry.method === "Emulation.setUserAgentOverride").params.acceptLanguage,
    "en-US"
  );
  assert.equal(
    newTabCommands.find((entry) => entry.method === "Network.setExtraHTTPHeaders")
      .params.headers["Accept-Language"],
    "en-US"
  );
  assert.ok(newTabCommands.some((entry) =>
    entry.method === "Emulation.setTimezoneOverride"
    && entry.params.timezoneId === "America/Los_Angeles"));
  assert.ok(newTabCommands.some((entry) => entry.method === "Target.setAutoAttach"));
  assert.equal(tabs.get(100).groupId, tabs.get(101).groupId);

  listeners.debuggerEvent(
    { tabId: 101 },
    "Network.requestWillBeSent",
    { requestId: "r1", type: "Document", request: { url: "https://example.com/" } }
  );
  listeners.debuggerEvent(
    { tabId: 101 },
    "Network.requestWillBeSentExtraInfo",
    { requestId: "r1", headers: { "Accept-Language": "en-US" } }
  );
  await new Promise((resolve) => setImmediate(resolve));
  const inspected = await sendMessage({ type: "inspect-controlled-page", tabId: 101 });
  assert.equal(inspected.ok, true);
  assert.equal(inspected.data.actual.requestAcceptLanguage, "en-US");

  const listed = await sendMessage({ type: "list-controlled-pages" });
  assert.equal(listed.ok, true);
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0].tabCount, 2);
  assert.equal(listed.data[0].status, "healthy");
  assert.equal(listed.data[0].untrustedTabCount, 0);

  tabs.set(999, {
    id: 999, windowId: 10, groupId: -1,
    url: "https://ordinary.example/", title: "Ordinary", active: false
  });
  listeners.tabAttached(999, { newWindowId: 10, newPosition: 2 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(tabs.has(999), false, "an ordinary dragged-in tab must be closed");

  failChildLocale = true;
  listeners.debuggerEvent(
    { tabId: 101 },
    "Target.attachedToTarget",
    { sessionId: "child-fail", targetInfo: { type: "worker" } }
  );
  for (let index = 0; index < 20 && windows.has(10); index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(windows.has(10), false, "a required child override failure must close the complete window");
  assert.match(sessionState.lastIsolationFailureV1.reason, /synthetic child locale failure/);
  const afterFailure = await sendMessage({ type: "list-controlled-pages" });
  assert.deepEqual(afterFailure.data, []);

  delete globalThis.chrome;
});
