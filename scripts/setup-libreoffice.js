const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const vendor = path.join(root, "vendor");
const target = path.join(vendor, "libreoffice");
const exe = path.join(target, "program", "soffice.exe");

if (fs.existsSync(exe)) {
  console.log("Already set up: vendor/libreoffice");
  process.exit(0);
}

fs.mkdirSync(vendor, { recursive: true });

const zip = process.argv[2] || path.join(root, "libreoffice-bundle.zip");

if (fs.existsSync(zip)) {
  console.log(`Extracting ${zip} (this can take a few minutes)...`);
  const run = spawnSync("tar", ["-xf", zip, "-C", vendor], { stdio: "inherit" });

  if (run.status === 0 && fs.existsSync(exe)) {
    console.log("Done. LibreOffice is ready in vendor/libreoffice");
    process.exit(0);
  }

  console.error("Extraction failed or the zip has the wrong layout.");
  console.error("Expected the zip to contain a top-level 'libreoffice' folder.");
  process.exit(1);
}

const sources = [
  "C:\\Program Files\\LibreOffice",
  "C:\\Program Files (x86)\\LibreOffice",
  process.env.LOCALAPPDATA &&
    path.join(process.env.LOCALAPPDATA, "Programs", "LocalConvert", "resources", "libreoffice"),
  "C:\\Program Files\\LocalConvert\\resources\\libreoffice"
].filter(Boolean);

const found = sources.find(dir =>
  fs.existsSync(path.join(dir, "program", "soffice.exe"))
);

if (found) {
  console.log(`Copying ${found} (this can take a few minutes)...`);
  fs.cpSync(found, target, { recursive: true });
  console.log("Done. LibreOffice is ready in vendor/libreoffice");
  process.exit(0);
}

console.error(
  "\nNo LibreOffice found. Do ONE of these:\n" +
  "  - install LibreOffice (64-bit) from libreoffice.org, then re-run\n" +
  "  - put libreoffice-bundle.zip in the project folder, then re-run\n"
);
process.exit(1);
