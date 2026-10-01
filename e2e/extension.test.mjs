import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const projectRoot = resolve(import.meta.dirname, "..");
const extensionPath = resolve(process.env.PUPPETEER_EXTENSION_PATH || projectRoot);
const defaultExecutables = process.platform === "win32"
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ]
  : process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];

async function firstExisting(paths) {
  const { access } = await import("node:fs/promises");
  for (const path of paths) {
    try { await access(path); return path; } catch {}
  }
  return null;
}

async function waitForExtension(browser, name, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let found = [];
  while (Date.now() < deadline) {
    const extensions = await browser.extensions();
    found = [...extensions.values()];
    const match = found.find((item) => item.name === name);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Extension was not installed. Found: ${found.map((item) => item.name).join(", ")}`);
}

function createFixtureServer() {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers });
    const port = server.address().port;
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/worker.js") {
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.end(`postMessage({language:navigator.language,languages:navigator.languages,timezone:new Intl.DateTimeFormat().resolvedOptions().timeZone,offset:new Date().getTimezoneOffset()});`);
      return;
    }
    if (request.url === "/frame") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(`<!doctype html><html><body>frame<script>
        globalThis.frameProbe={language:navigator.language,languages:Array.from(navigator.languages),timezone:new Intl.DateTimeFormat().resolvedOptions().timeZone,offset:new Date().getTimezoneOffset()};
        new Image().src='http://127.0.0.1:${port}/frame-result?probe='+encodeURIComponent(JSON.stringify(globalThis.frameProbe));
      </script></body></html>`);
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><body>
      <h1>Localization fixture</h1>
      <iframe src="http://localhost:${port}/frame"></iframe>
      <script>
        globalThis.topProbe={language:navigator.language,languages:navigator.languages,timezone:new Intl.DateTimeFormat().resolvedOptions().timeZone,offset:new Date().getTimezoneOffset()};
        const worker=new Worker('/worker.js');
        worker.onmessage=(event)=>{globalThis.workerProbe=event.data};
      </script>
    </body></html>`);
  });
  return { server, requests };
}

async function waitForRecordedRequest(requests, predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = requests.find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for the fixture server request.");
}

async function waitForControlledPages(controlPage, predicate, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await controlPage.evaluate(() => chrome.runtime.sendMessage({ type: "list-controlled-pages" }));
    if (latest.ok && predicate(latest.data)) return latest.data;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for controlled pages: ${JSON.stringify(latest)}`);
}

test("real Chromium applies locale and timezone before navigation to page, iframe and worker", { timeout: 70_000 }, async (context) => {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    || await firstExisting(defaultExecutables);
  assert.ok(executablePath, "Set PUPPETEER_EXECUTABLE_PATH to a Chrome or Edge executable.");
  const { server, requests } = createFixtureServer();
  server.listen(0, "0.0.0.0");
  await once(server, "listening");
  const port = server.address().port;
  const siteUrl = `http://127.0.0.1:${port}/`;
  let browser;
  let targetPage;
  let controlPage;
  let stage = "launch";
  const browserMessages = [];
  const setStage = (value) => {
    stage = value;
    if (process.env.PUPPETEER_TRACE === "1") console.log(`E2E stage: ${value}`);
  };
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: process.env.PUPPETEER_HEADFUL !== "1",
      pipe: true,
      dumpio: process.env.PUPPETEER_DUMPIO === "1",
      enableExtensions: [extensionPath],
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
    setStage("extension-install");
    const extension = await waitForExtension(browser, "专用语言与时区页面");
    const extensionId = extension.id;
    await browser.waitForTarget(
      (target) => target.type() === "service_worker" && target.url().startsWith(`chrome-extension://${extensionId}/`),
      { timeout: 20_000 }
    );
    for (const worker of await extension.workers()) {
      worker.on("console", (message) => browserMessages.push(`worker:${message.type()}:${message.text()}`));
    }
    setStage("control-page");
    setStage("control-page-extension-pages");
    const extensionPages = await extension.pages();
    setStage("control-page-browser-pages");
    const browserPages = await browser.pages();
    controlPage = extensionPages.find((page) => page.url().endsWith("/control.html"))
      ?? browserPages.find((page) => page.url() === "about:blank")
      ?? browserPages[0];
    assert.ok(controlPage, "The browser should expose at least one page for the control UI.");
    controlPage.on("console", (message) => browserMessages.push(`console:${message.type()}:${message.text()}`));
    controlPage.on("pageerror", (error) => browserMessages.push(`pageerror:${error.message}`));
    setStage("control-page-goto");
    if (controlPage.url() !== `chrome-extension://${extensionId}/control.html`) {
      await controlPage.goto(`chrome-extension://${extensionId}/control.html`);
    }
    setStage("control-page-selector");
    await controlPage.waitForSelector("#open-button");
    setStage("control-page-fill");
    await controlPage.evaluate((values) => {
      for (const [selector, value] of Object.entries(values)) {
        const input = document.querySelector(selector);
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, {
      "#site-url": siteUrl,
      "#language": "fr-FR",
      "#additional-languages": "en-US",
      "#timezone": "America/New_York"
    });
    setStage("control-page-submit");
    await controlPage.evaluate(() => document.querySelector("#environment-form").requestSubmit());
    setStage("controlled-page-navigation");
    const outcome = await Promise.race([
      browser.waitForTarget(
        (candidate) => candidate.type() === "page" && candidate.url().startsWith(siteUrl),
        { timeout: 15_000 }
      ).then((target) => ({ target })),
      controlPage.waitForFunction(() => document.querySelector("#form-message")?.classList.contains("error"), {
        timeout: 15_000
      }).then(() => controlPage.$eval("#form-message", (element) => ({ error: element.textContent })))
    ]);
    if (outcome.error) throw new Error(`Control page rejected the environment: ${outcome.error}`);
    const target = outcome.target;
    targetPage = await target.page();
    setStage("worker");
    await targetPage.waitForFunction(() => globalThis.workerProbe, { timeout: 20_000 });
    const top = await targetPage.evaluate(() => globalThis.topProbe);
    const worker = await targetPage.evaluate(() => globalThis.workerProbe);
    setStage("iframe");
    const frameResult = await waitForRecordedRequest(requests, (request) => request.url.startsWith("/frame-result?"));
    const iframe = JSON.parse(new URL(frameResult.url, siteUrl).searchParams.get("probe"));
    setStage("strict-inspection");
    const inspection = await controlPage.evaluate(async () => {
      const listed = await chrome.runtime.sendMessage({ type: "list-controlled-pages" });
      if (!listed.ok || !listed.data.length) return listed;
      return chrome.runtime.sendMessage({
        type: "inspect-controlled-page",
        tabId: listed.data[0].tabId
      });
    });
    assert.equal(inspection.ok, true, inspection.error);
    assert.equal(inspection.data.actual.requestAcceptLanguage, "fr-FR,en-US;q=0.9");
    assert.equal(inspection.data.actual.timezoneProbes.length, 13);
    assert.equal(inspection.data.actual.timezone, "America/New_York");
    setStage("assertions");
    for (const [kind, probe] of Object.entries({ top, iframe, worker })) {
      assert.equal(probe.language, "fr-FR", `${kind} language`);
      assert.deepEqual(probe.languages, ["fr-FR", "en-US"], `${kind} languages`);
      assert.equal(probe.timezone, "America/New_York", `${kind} timezone`);
    }
    const mainRequest = requests.find((request) => request.url === "/");
    assert.ok(mainRequest, "The fixture should receive the main document request.");
    assert.equal(
      mainRequest.headers["accept-language"],
      "fr-FR,en-US;q=0.9",
      "The server should receive the configured weighted Accept-Language header."
    );
    setStage("native-new-tab");
    const nativeTab = await controlPage.evaluate(async () => {
      const listed = await chrome.runtime.sendMessage({ type: "list-controlled-pages" });
      if (!listed.ok || !listed.data.length) throw new Error(listed.error || "No controlled window");
      const tab = await chrome.tabs.create({ windowId: listed.data[0].windowId, active: true });
      return { id: tab.id, windowId: tab.windowId };
    });
    await waitForControlledPages(controlPage, (pages) =>
      pages.length === 1
      && pages[0].tabCount === 2
      && pages[0].status === "healthy");
    const nativeInspection = await controlPage.evaluate((tabId) => chrome.runtime.sendMessage({
      type: "inspect-controlled-page",
      tabId
    }), nativeTab.id);
    assert.equal(nativeInspection.ok, true, nativeInspection.error);
    assert.equal(nativeInspection.data.actual.language, "fr-FR");
    assert.deepEqual(nativeInspection.data.actual.languages, ["fr-FR", "en-US"]);
    assert.equal(nativeInspection.data.actual.timezone, "America/New_York");

    setStage("close-one-tab");
    await controlPage.evaluate((tabId) => chrome.tabs.remove(tabId), nativeTab.id);
    await waitForControlledPages(controlPage, (pages) =>
      pages.length === 1
      && pages[0].tabCount === 1
      && pages[0].status === "healthy");
    assert.equal(targetPage.isClosed(), false, "closing one isolated tab must preserve its healthy sibling");
    assert.equal(
      await targetPage.evaluate(() => globalThis.topProbe.timezone),
      "America/New_York",
      "the remaining tab should retain its timezone override"
    );
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (targetPage) {
      await targetPage.screenshot({ path: resolve(projectRoot, ".tmp-e2e-failure.png"), fullPage: true })
        .catch(() => undefined);
    }
    context.diagnostic(`Browser: ${executablePath}`);
    context.diagnostic(`Stage: ${stage}`);
    if (controlPage && !controlPage.isClosed()) {
      const message = await controlPage.$eval("#form-message", (element) => element.textContent).catch(() => "");
      if (message) context.diagnostic(`Control message: ${message}`);
      const failure = await controlPage.evaluate(() => chrome.runtime.sendMessage({ type: "get-last-failure" }))
        .catch(() => null);
      if (failure?.data) context.diagnostic(`Last isolation failure: ${failure.data.reason}`);
      const sessions = await controlPage.evaluate(() => chrome.runtime.sendMessage({ type: "list-controlled-pages" }))
        .catch(() => null);
      if (sessions?.data) context.diagnostic(`Sessions: ${JSON.stringify(sessions.data)}`);
    }
    if (browser?.connected) {
      context.diagnostic(`Targets: ${browser.targets().map((target) => `${target.type()}:${target.url()}`).join(" | ")}`);
    }
    for (const message of browserMessages) context.diagnostic(message);
    throw error;
  } finally {
    if (browser) {
      await Promise.race([
        browser.close().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);
      browser.process()?.kill("SIGKILL");
    }
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});
