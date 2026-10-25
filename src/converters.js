const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const sharp = require("sharp");
const heicConvert = require("heic-convert");
const { PDFDocument } = require("pdf-lib");
const { findLibreOffice } = require("./lo-paths");
const { cleanPdfDocx, docxToPlainText } = require("./docx-clean");

const imageExtensions = new Set([
  ".jpg", ".jpeg", ".jfif", ".png", ".webp", ".heic"
]);

const documentExtensions = new Set([
  ".doc", ".docx", ".wps", ".pdf"
]);

const imageTargets = new Set(["jpg", "png", "webp"]);
const documentTargets = new Set(["pdf", "docx", "doc", "txt"]);

const allowedTargets = new Set([...imageTargets, ...documentTargets]);

function locateLibreOffice() {
  return findLibreOffice({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath
  });
}

function runCommand(command, args, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });

    let stderr = "";
    let finished = false;
    let timer = null;

    const finish = (fn, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      fn(value);
    };

    if (timeoutMs) {
      timer = setTimeout(() => {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
            windowsHide: true
          });
        } else {
          child.kill("SIGKILL");
        }
        finish(reject, new Error("Conversion timed out."));
      }, timeoutMs);
    }

    child.stderr.on("data", data => {
      stderr += data.toString();
    });

    child.on("error", err => finish(reject, err));

    child.on("close", code => {
      if (code === 0) {
        finish(resolve);
      } else {
        finish(
          reject,
          new Error(stderr || `Process exited with code ${code}`)
        );
      }
    });
  });
}

const exportFilters = {
  pdf: "pdf:writer_pdf_Export",
  docx: "docx:MS Word 2007 XML",
  doc: "doc:MS Word 97",
  txt: "txt:Text"
};

let libreOfficeQueue = Promise.resolve();

function exclusive(task) {
  const run = libreOfficeQueue.then(task, task);
  libreOfficeQueue = run.catch(() => {});
  return run;
}

async function runLibreOffice(
  office,
  { input, outDir, target, infilter, timeoutMs = 120000 }
) {
  const profileUrl = pathToFileURL(
    path.join(app.getPath("userData"), "lo-profile")
  ).href;

  const args = [
    `-env:UserInstallation=${profileUrl}`,
    "--headless",
    "--norestore",
    "--nolockcheck"
  ];

  if (infilter) args.push(`--infilter=${infilter}`);

  args.push(
    "--convert-to", exportFilters[target],
    "--outdir", outDir,
    input
  );

  await exclusive(() => runCommand(office.path, args, timeoutMs));

  const produced = path.join(
    outDir,
    `${path.basename(input, path.extname(input))}.${target}`
  );

  if (!fsSync.existsSync(produced)) {
    throw new Error("The converter finished but produced no file.");
  }

  return produced;
}

async function convertDocument(
  source, ext, output, target, { timeoutMs = 120000 } = {}
) {
  const office = locateLibreOffice();

  if (!office.path) {
    throw new Error(
      app.isPackaged
        ? "The document converter is missing. Reinstall the app."
        : "LibreOffice not found. See README: " +
          "'Testing real document conversion'."
    );
  }

  if (ext === `.${target}`) {
    throw new Error("Input and output formats are the same.");
  }

  const fromPdf = ext === ".pdf";

  const firstTarget =
    fromPdf && (target === "doc" || target === "txt") ? "docx" : target;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "localconvert-"));

  try {
    let produced = await runLibreOffice(office, {
      input: source,
      outDir: tempDir,
      target: firstTarget,
      timeoutMs,
      infilter: fromPdf ? "writer_pdf_import" : null
    });

    if (fromPdf && firstTarget === "docx") {
      await cleanPdfDocx(produced);
    }

    if (fromPdf && target === "txt") {
      const textPath = path.join(tempDir, "result.txt");
      await fs.writeFile(textPath, await docxToPlainText(produced), "utf8");
      produced = textPath;
    } else if (firstTarget !== target) {
      const secondDir = path.join(tempDir, "step2");
      await fs.mkdir(secondDir);

      produced = await runLibreOffice(office, {
        input: produced,
        outDir: secondDir,
        target,
        timeoutMs
      });
    }

    await fs.copyFile(produced, output);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function documentToPdfForPreview(filePath) {
  const stat = await fs.stat(filePath);

  const key = crypto
    .createHash("sha1")
    .update(`${filePath}|${stat.size}|${stat.mtimeMs}`)
    .digest("hex");

  const cacheDir = path.join(app.getPath("userData"), "preview-cache");
  const cached = path.join(cacheDir, `${key}.pdf`);

  if (fsSync.existsSync(cached)) return cached;

  await fs.mkdir(cacheDir, { recursive: true });
  await convertDocument(
    filePath, path.extname(filePath).toLowerCase(), cached, "pdf",
    { timeoutMs: 45000 }
  );

  return cached;
}

async function clearPreviewCache() {
  await fs.rm(path.join(app.getPath("userData"), "preview-cache"), {
    recursive: true,
    force: true
  });
}

async function imageToPngBuffer(source, ext) {
  if (ext === ".heic") {
    return Buffer.from(
      await heicConvert({
        buffer: await fs.readFile(source),
        format: "PNG"
      })
    );
  }

  return sharp(source).rotate().png().toBuffer();
}

async function imageToImage(source, ext, output, target) {
  if (ext === ".heic") {
    const converted = await heicConvert({
      buffer: await fs.readFile(source),
      format: target === "jpg" ? "JPEG" : "PNG",
      quality: 0.9
    });

    let buffer = Buffer.from(converted);

    if (target === "webp") {
      buffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
    }

    await fs.writeFile(output, buffer);
    return;
  }

  let pipeline = sharp(source).rotate();

  if (target === "jpg") pipeline = pipeline.jpeg({ quality: 90 });
  if (target === "png") pipeline = pipeline.png();
  if (target === "webp") pipeline = pipeline.webp({ quality: 90 });

  await pipeline.toFile(output);
}

async function imageToPdf(source, ext, output) {
  const pngBuffer = await imageToPngBuffer(source, ext);

  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(pngBuffer);
  const page = pdf.addPage([image.width, image.height]);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height
  });

  await fs.writeFile(output, await pdf.save());
}

function uniquePath(dir, base, ext) {
  let candidate = path.join(dir, `${base}.${ext}`);
  let n = 1;

  while (fsSync.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${n}).${ext}`);
    n += 1;
  }

  return candidate;
}

async function convertFile(source, outputDir, target) {
  const ext = path.extname(source).toLowerCase();
  const base = path.basename(source, ext);
  const output = uniquePath(outputDir, base, target);

  try {
    if (imageExtensions.has(ext) && imageTargets.has(target)) {
      await imageToImage(source, ext, output, target);
    } else if (imageExtensions.has(ext) && target === "pdf") {
      await imageToPdf(source, ext, output);
    } else if (documentExtensions.has(ext) && documentTargets.has(target)) {
      await convertDocument(source, ext, output, target);
    } else {
      throw new Error(
        `Conversion from ${ext} to ${target.toUpperCase()} is not supported.`
      );
    }
  } catch (error) {
    await fs.rm(output, { force: true });
    throw error;
  }

  return output;
}

module.exports = {
  allowedTargets,
  clearPreviewCache,
  convertFile,
  documentToPdfForPreview,
  imageToPngBuffer,
  locateLibreOffice
};
