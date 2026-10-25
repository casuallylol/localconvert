const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { findLibreOffice } = require("../src/lo-paths");

const found = findLibreOffice();

if (!found.path) {
  console.error(
    "No LibreOffice found. See README: 'Testing real document conversion'."
  );
  process.exit(1);
}

console.log(`Using ${found.source}: ${found.path}`);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lo-test-"));
const input = path.join(dir, "hello.txt");
fs.writeFileSync(input, "LocalConvert test");

console.log("Converting a test file (first run can take 10-30 seconds)...");

const run = spawnSync(found.path, [
  `-env:UserInstallation=${pathToFileURL(path.join(dir, "profile")).href}`,
  "--headless", "--norestore", "--nolockcheck",
  "--convert-to", "pdf",
  "--outdir", dir,
  input
], { encoding: "utf8", timeout: 120000 });

const ok = fs.existsSync(path.join(dir, "hello.pdf"));
console.log(ok ? "PASS: LibreOffice converted the file." : "FAIL: no PDF produced.");
if (!ok) console.log(run.stderr || run.error || "");
fs.rmSync(dir, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
