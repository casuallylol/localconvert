const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  shell
} = require("electron");

const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const { pathToFileURL } = require("node:url");

const {
  allowedTargets,
  clearPreviewCache,
  convertFile,
  documentToPdfForPreview,
  imageToPngBuffer,
  locateLibreOffice
} = require("./converters");

const { createHistoryStore } = require("./history-store");

let mainWindow;
let historyStore;

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 650,
    backgroundColor: "#12141c",
    title: "LocalConvert",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (!app.isPackaged) enableDevTools(mainWindow);
}

function enableDevTools(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    const key = input.key.toLowerCase();
    const ctrl = input.control || input.meta;

    if ((ctrl && key === "r") || key === "f5") {
      win.webContents.reload();
      event.preventDefault();
    }

    if (key === "f12" || (ctrl && input.shift && key === "i")) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  let timer = null;

  try {
    fsSync.watch(
      path.join(__dirname, "renderer"),
      { recursive: true },
      () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
        }, 150);
      }
    );
  } catch {
  }
}

app.whenReady().then(() => {
  historyStore = createHistoryStore(
    path.join(app.getPath("userData"), "conversion-history.json")
  );

  const engine = locateLibreOffice();

  console.log(
    "[LocalConvert] Document engine:",
    engine.source,
    engine.path || "(not found: document conversion will fail)"
  );

  clearPreviewCache().catch(() => {});
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

async function safeStatSize(filePath) {
  try {
    return (await fs.stat(filePath)).size;
  } catch {
    return 0;
  }
}

ipcMain.handle("pick-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Supported files",
        extensions: [
          "jpg", "jpeg", "jfif", "png", "webp", "heic",
          "pdf", "doc", "docx", "wps"
        ]
      },
      { name: "All files", extensions: ["*"] }
    ]
  });

  if (result.canceled) return [];

  return Promise.all(
    result.filePaths.map(async filePath => ({
      path: filePath,
      name: path.basename(filePath),
      size: await safeStatSize(filePath)
    }))
  );
});

ipcMain.handle("pick-output", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"]
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("open-path", async (_event, filePath) => {
  if (typeof filePath !== "string") return;
  return shell.openPath(filePath);
});

ipcMain.handle("get-document-engine-status", () => {
  const found = locateLibreOffice();
  return { available: found.source !== "none", source: found.source };
});

ipcMain.handle("convert-batch", async (_event, payload) => {
  const { files, outputDir, targetFormat } = payload || {};

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Choose at least one file.");
  }

  if (!outputDir) {
    throw new Error("Choose an output folder.");
  }

  if (!allowedTargets.has(targetFormat)) {
    throw new Error("Unsupported output format.");
  }

  await fs.mkdir(outputDir, { recursive: true });

  const results = [];

  for (const input of files) {
    const source = input && input.path;

    try {
      if (typeof source !== "string") {
        throw new Error("Invalid file.");
      }

      const output = await convertFile(source, outputDir, targetFormat);

      results.push({
        input: source,
        output,
        status: "success",
        message: "Converted successfully"
      });
    } catch (error) {
      results.push({
        input: source,
        output: null,
        status: "error",
        message: error.message
      });
    }
  }

  // Save every result (successes and failures) so the history is still
  // there the next time the app is opened.
  const time = Date.now();

  for (const result of results) {
    result.time = time;
    result.targetFormat = targetFormat;
  }

  try {
    historyStore.add(results);
  } catch (error) {
    console.error("[LocalConvert] Could not save history:", error.message);
  }

  return results;
});

ipcMain.handle("get-history", () => historyStore.all());

ipcMain.handle("clear-history", () => {
  historyStore.clear();
});

ipcMain.handle("preview-file", async (_event, filePath) => {
  if (typeof filePath !== "string") return null;

  const extension = path.extname(filePath).toLowerCase();

  const imageTypes = [
    ".jpg", ".jpeg", ".jfif", ".png", ".webp", ".heic"
  ];

  const documentTypes = [".docx", ".doc", ".wps", ".txt"];

  if (
    extension !== ".pdf" &&
    !imageTypes.includes(extension) &&
    !documentTypes.includes(extension)
  ) {
    return {
      kind: "unsupported",
      message:
        "Preview is unavailable for this file type. " +
        "Use Open file to view it in its default app."
    };
  }

  try {
    if (extension === ".pdf") {
      return { kind: "pdf", url: pathToFileURL(filePath).href };
    }

    if (documentTypes.includes(extension)) {
      const pdfPath = await documentToPdfForPreview(filePath);
      return { kind: "pdf", url: pathToFileURL(pdfPath).href };
    }

    const buffer = await imageToPngBuffer(filePath, extension);

    return {
      kind: "image",
      dataUrl: `data:image/png;base64,${buffer.toString("base64")}`
    };
  } catch (error) {
    const timedOut = /timed out/i.test(error.message);

    return {
      kind: "error",
      message: timedOut
        ? "The preview took too long. If a 'Waiting for printer " +
          "connection' window appeared, Windows can't reach your " +
          "default printer. Set the default printer to 'Microsoft " +
          "Print to PDF' and try again."
        : `Could not preview: ${error.message}`
    };
  }
});
