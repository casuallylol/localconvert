const path = require("node:path");
const fs = require("node:fs");

const EXE = path.join("program", "soffice.exe");

function findLibreOffice({ packaged = false, resourcesPath = "" } = {}) {
  const root = path.join(__dirname, "..");
  const candidates = [];

  candidates.push([
    "bundled",
    packaged
      ? path.join(resourcesPath, "libreoffice", EXE)
      : path.join(root, "vendor", "libreoffice", EXE)
  ]);

  if (process.env.LOCALCONVERT_LO) {
    candidates.push(["env", path.join(process.env.LOCALCONVERT_LO, EXE)]);
  }

  candidates.push(
    ["system", path.join("C:\\Program Files\\LibreOffice", EXE)],
    ["system", path.join("C:\\Program Files (x86)\\LibreOffice", EXE)]
  );

  if (!packaged) {
    if (process.env.LOCALAPPDATA) {
      candidates.push([
        "installed-app",
        path.join(
          process.env.LOCALAPPDATA,
          "Programs", "LocalConvert", "resources", "libreoffice", EXE
        )
      ]);
    }

    candidates.push([
      "installed-app",
      path.join(
        "C:\\Program Files\\LocalConvert\\resources\\libreoffice", EXE
      )
    ]);
  }

  for (const [source, exePath] of candidates) {
    if (fs.existsSync(exePath)) return { path: exePath, source };
  }

  return { path: null, source: "none" };
}

module.exports = { findLibreOffice };
