import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

test("manifest declares the required MV3 entry points and permissions", async () => {
  const manifest = JSON.parse(
    await readFile(resolve(projectRoot, "manifest.json"), "utf8")
  );

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.background.type, "module");
  assert.deepEqual(
    [...manifest.permissions].sort(),
    ["debugger", "storage", "tabs"]
  );
});

test("all extension entry-point files exist", async () => {
  const paths = [
    "background.js",
    "control.html",
    "control.css",
    "control.js",
    "lib/config.js",
    "lib/environment-data.js"
  ];

  for (const relativePath of paths) {
    const contents = await readFile(resolve(projectRoot, relativePath), "utf8");
    assert.ok(contents.length > 0, `${relativePath} should not be empty`);
  }
});

test("control page keeps searchable presets and a synchronized dropdown", async () => {
  const html = await readFile(resolve(projectRoot, "control.html"), "utf8");
  assert.match(html, /id="preset"[^>]*list="preset-options"/s);
  assert.match(html, /id="preset-select"/);
  assert.match(html, /id="preset-options"/);
});
