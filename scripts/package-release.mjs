import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const dist = join(root, "dist");
const output = join(dist, `dedicated-locale-tab-v${manifest.version}.zip`);
const includedRoots = [
  "manifest.json", "background.js", "control.html", "control.css", "control.js", "LICENSE", "PRIVACY.md"
];

function collect(directory, prefix) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? collect(child, `${prefix}${entry.name}/`) : [{ path: child, name: `${prefix}${entry.name}` }];
  });
}

const entries = [
  ...includedRoots.map((path) => ({ path, name: basename(path) })),
  ...collect("lib", "lib/"),
  ...collect("assets", "assets/").filter((entry) => entry.name.endsWith(".png"))
].sort((left, right) => left.name.localeCompare(right.name));

const crcTable = Array.from({ length: 256 }, (_, number) => {
  let value = number;
  for (let index = 0; index < 8; index += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) { const buffer = Buffer.alloc(2); buffer.writeUInt16LE(value); return buffer; }
function u32(value) { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(value >>> 0); return buffer; }

const localParts = [];
const centralParts = [];
let offset = 0;
for (const entry of entries) {
  const name = Buffer.from(entry.name.replaceAll("\\", "/"));
  const data = readFileSync(join(root, entry.path));
  const crc = crc32(data);
  const local = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x0021),
    u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
  ]);
  const central = Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x0021),
    u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
    u16(0), u16(0), u32(0), u32(offset), name
  ]);
  localParts.push(local);
  centralParts.push(central);
  offset += local.length;
}
const centralDirectory = Buffer.concat(centralParts);
const archive = Buffer.concat([
  ...localParts,
  centralDirectory,
  u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
  u32(centralDirectory.length), u32(offset), u16(0)
]);

mkdirSync(dist, { recursive: true });
writeFileSync(output, archive);
const digest = createHash("sha256").update(archive).digest("hex");
writeFileSync(`${output}.sha256`, `${digest}  ${basename(output)}\n`);
console.log(`${relative(root, output)}\nSHA-256 ${digest}\nFiles ${entries.length}`);
