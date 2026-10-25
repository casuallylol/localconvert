const fs = require("node:fs");
const path = require("node:path");

const exe = path.join(
  __dirname, "..", "vendor", "libreoffice", "program", "soffice.exe"
);

if (!fs.existsSync(exe)) {
  console.error(
    "\nvendor/libreoffice/program/soffice.exe not found.\n" +
    "Run `npm run setup:lo` first, then try again.\n"
  );
  process.exit(1);
}

console.log("Bundled LibreOffice found.");
