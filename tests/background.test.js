import test from "node:test";
import assert from "node:assert/strict";

test("new tabs inherit a window's locale, header, and timezone overrides", async () => {
  const listeners = {};
  const commands = [];
  const attachedTabs = [];
  const sessionState = {};
  const tabs = new Map();
  let nextTabId = 100;

  const event = (name) => ({
    addListener(listener) {
      listeners[name] = listener;
    }
  });

  globalThis.chrome = {
    action: { onClicked: event("actionClicked") },
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      onInstalled: event("installed"),
      onMessage: event("message")
    },
    storage: {
      session: {
        async get(key) {
          return { [key]: sessionState[key] };
        },
        async set(values) {
          Object.assign(sessionState, values);
        }
      }
    },
    debugger: {
      onEvent: event("debuggerEvent"),
      onDetach: event("debuggerDetach"),
      async attach(target) {
        attachedTabs.push(target.tabId);
      },
      async sendCommand(target, method, params) {
        commands.push({ target, method, params });
        if (method === "Runtime.evaluate") {
          return {
            result: {
              value: {
                userAgent: "TestBrowser/1.0",
                metadata: null
              }
            }
          };
        }
        return {};
      }
    },
    windows: {
      async create(options) {
        const tab = {
          id: nextTabId++,
          windowId: 10,
          url: options.url,
          title: "Initial",
          active: true
        };
        tabs.set(tab.id, tab);
        return { id: 10, tabs: [tab] };
      },
      async get(windowId) {
        return { id: windowId };
      },
      async update() {},
      async remove() {}
    },
    tabs: {
      onCreated: event("tabCreated"),
      onRemoved: event("tabRemoved"),
      async create(options) {
        for (const tab of tabs.values()) {
          if (tab.windowId === options.windowId) tab.active = false;
        }
        const tab = {
          id: nextTabId++,
          windowId: options.windowId,
          url: options.url,
          title: "New tab",
          active: Boolean(options.active)
        };
        tabs.set(tab.id, tab);
        return tab;
      },
      async get(tabId) {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error("missing tab");
        return tab;
      },
      async query({ windowId } = {}) {
        return [...tabs.values()].filter(
          (tab) => windowId === undefined || tab.windowId === windowId
        );
      },
      async update(tabId, changes) {
        Object.assign(tabs.get(tabId), changes);
      },
      async remove(tabIds) {
        for (const tabId of Array.isArray(tabIds) ? tabIds : [tabIds]) {
          tabs.delete(tabId);
        }
      }
    }
  };

  await import(`../background.js?test=${Date.now()}`);

  const sendMessage = (message) => new Promise((resolve) => {
    listeners.message(message, {}, resolve);
  });

  const opened = await sendMessage({
    type: "open-controlled-page",
    config: {
      url: "https://example.com",
      language: "en-US",
      timezoneId: "America/Los_Angeles"
    }
  });
  assert.equal(opened.ok, true);

  const created = await sendMessage({
    type: "create-controlled-tab",
    windowId: 10
  });
  assert.equal(created.ok, true);
  assert.deepEqual(attachedTabs, [100, 101]);

  const newTabCommands = commands.filter((entry) => entry.target.tabId === 101);
  const userAgentOverride = newTabCommands.find(
    (entry) => entry.method === "Emulation.setUserAgentOverride"
  );
  assert.equal(userAgentOverride.params.acceptLanguage, "en-US,en");

  const requestHeaders = newTabCommands.find(
    (entry) => entry.method === "Network.setExtraHTTPHeaders"
  );
  assert.equal(
    requestHeaders.params.headers["Accept-Language"],
    "en-US,en;q=0.9"
  );
  assert.ok(newTabCommands.some(
    (entry) => entry.method === "Emulation.setTimezoneOverride"
      && entry.params.timezoneId === "America/Los_Angeles"
  ));

  const windows = await sendMessage({ type: "list-controlled-pages" });
  assert.equal(windows.ok, true);
  assert.equal(windows.data.length, 1);
  assert.equal(windows.data[0].tabCount, 2);

  delete globalThis.chrome;
});
