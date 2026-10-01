import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootPath = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(entry.name)) return [];
      return walk(path);
    }
    return [path];
  });
}

const scripts = walk(rootPath).filter((path) => /\.(?:js|mjs)$/.test(path));
for (const script of scripts) {
  const result = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
}

const manifest = JSON.parse(readFileSync(join(rootPath, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("manifest_version 必须为 3。");
if (manifest.version !== "1.1.0") throw new Error("manifest 与发布版本不一致。");
if (manifest.host_permissions?.length) throw new Error("扩展不得申请全站 host_permissions。");
for (const permission of ["debugger", "storage", "tabs", "tabGroups"]) {
  if (!manifest.permissions.includes(permission)) throw new Error(`缺少权限：${permission}`);
}
for (const size of [16, 32, 48, 128]) {
  const path = join(rootPath, `assets/icon-${size}.png`);
  if (!existsSync(path)) throw new Error(`缺少图标：${relative(rootPath, path)}`);
}
for (const [path, width, height] of [
  ["store-assets/screenshot-control-1280x800.png", 1280, 800],
  ["store-assets/promo-small-440x280.png", 440, 280]
]) {
  const buffer = readFileSync(join(rootPath, path));
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error(`${path} 不是 PNG。`);
  if (buffer.readUInt32BE(16) !== width || buffer.readUInt32BE(20) !== height) {
    throw new Error(`${path} 尺寸必须为 ${width}x${height}。`);
  }
}
const expectedPurpose = "浏览器本地化与时区隔离测试插件，用于网页国际化开发、语言兼容性测试和隐私研究；不得用于绕过网站地区限制、账号封禁或安全措施。";
if (manifest.description !== expectedPurpose) throw new Error("manifest 用途与项目边界声明不一致。");

console.log(`Project checks passed: ${scripts.length} JavaScript files, manifest, permissions, icons and purpose statement.`);
