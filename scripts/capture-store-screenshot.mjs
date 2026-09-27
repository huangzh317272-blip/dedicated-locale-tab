import { access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "store-assets", "screenshot-control-1280x800.png");
const candidates = process.platform === "win32"
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ]
  : process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["/usr/bin/google-chrome", "/usr/bin/microsoft-edge"];

async function findExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error("Set PUPPETEER_EXECUTABLE_PATH to Chrome for Testing or Edge.");
}

async function waitForExtension(browser) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const extension = [...(await browser.extensions()).values()]
      .find((item) => item.name === "专用语言与时区页面");
    if (extension) return extension;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The unpacked extension did not finish installing.");
}

const browser = await puppeteer.launch({
  executablePath: await findExecutable(),
  headless: true,
  pipe: true,
  enableExtensions: [root],
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

try {
  const extension = await waitForExtension(browser);
  await browser.waitForTarget(
    (target) => target.type() === "service_worker" && target.url().startsWith(`chrome-extension://${extension.id}/`),
    { timeout: 20_000 }
  );
  const pages = await browser.pages();
  const page = pages.find((candidate) => candidate.url() === "about:blank") ?? pages[0];
  if (!page) throw new Error("No browser page is available for the store screenshot.");
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(`chrome-extension://${extension.id}/control.html`);
  await page.waitForSelector("#open-button");
  await page.evaluate(() => {
    const values = {
      "#site-url": "https://example.com/",
      "#language": "en-US",
      "#additional-languages": "fr-FR",
      "#timezone": "America/Los_Angeles",
      "#profile-name": "English · Los Angeles"
    };
    for (const [selector, value] of Object.entries(values)) {
      const input = document.querySelector(selector);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  await mkdir(resolve(root, "store-assets"), { recursive: true });
  await page.screenshot({ path: output, type: "png", captureBeyondViewport: false });
  console.log(output);
} finally {
  await Promise.race([
    browser.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
  browser.process()?.kill("SIGKILL");
}
