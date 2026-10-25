const $ = id => document.getElementById(id);

let files = [];
let outputDir = "";
let category = "image";
let history = [];
let previewPath = "";

const imageFormats = ["png", "jpg", "webp", "pdf"];
const docFormats = ["pdf", "docx", "doc", "txt"];

const supportedImage = [
  "jpg", "jpeg", "jfif", "png", "webp", "heic"
];

const supportedDoc = [
  "doc", "docx", "wps", "pdf"
];

const formatLabels = {
  png: "PNG image",
  jpg: "JPG image",
  webp: "WEBP image",
  pdf: "PDF document",
  docx: "Word document (DOCX)",
  doc: "Word document (DOC)",
  txt: "Text document"
};

const ICON = {
  check:
    '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 7v6M12 17v.01"/></svg>',
  remove:
    '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

const allSupported = [...supportedImage, ...supportedDoc];

function isEligible(file) {
  const extension = extOf(file.name);

  return category === "image"
    ? supportedImage.includes(extension)
    : supportedDoc.includes(extension);
}

function fmtSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function extOf(filePath) {
  return (filePath.split(".").pop() || "").toLowerCase();
}

function typeOf(file) {
  const extension = extOf(file.name);

  if (supportedImage.includes(extension)) return "Image";
  if (supportedDoc.includes(extension)) return "Document";
  return extension.toUpperCase() || "File";
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function updateStats() {
  $("queuedCount").textContent = files.length;

  const done =
    history.filter(item => item.status === "success").length;

  $("convertedCount").textContent = done;
  $("convertedCount").classList.toggle("hidden", !done);


  $("filesPanel").classList.toggle("has-files", files.length > 0);

  const ready = files.filter(isEligible).length;

  $("convertLabel").textContent = ready
    ? `Convert ${ready} file${ready === 1 ? "" : "s"} to ` +
      $("format").value.toUpperCase()
    : "Convert files";
}

function renderFiles() {
  $("fileList").innerHTML = files.length
    ? files.map((file, index) => `
        <div class="file-row ${isEligible(file) ? "" : "mismatch"}">
          <div class="file-name">
            <div class="file-icon">
              ${escapeHtml(extOf(file.name).slice(0, 4).toUpperCase())}
            </div>

            <div class="file-meta">
              <strong title="${escapeHtml(file.name)}">
                ${escapeHtml(file.name)}
              </strong>

              ${isEligible(file)
                ? `<small title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</small>`
                : `<small class="warn">Not ${category === "image" ? "an image" : "a document"}, so it will be skipped</small>`}
            </div>
          </div>

          <span class="file-size">${fmtSize(file.size)}</span>

          <span class="file-type">${typeOf(file)}</span>

          <button
            class="remove"
            data-remove="${index}"
            aria-label="Remove ${escapeHtml(file.name)}"
          >
            ${ICON.remove}
          </button>
        </div>
      `).join("")
    : '<div class="empty">No files added yet.</div>';

  document.querySelectorAll("[data-remove]").forEach(button => {
    button.onclick = () => {
      files.splice(Number(button.dataset.remove), 1);
      renderFiles();
    };
  });

  updateStats();
}

function renderHistory() {
  $("historyList").innerHTML = history.length
    ? history.slice().reverse().map(item => `
        <div class="result-row">
          <div class="result-symbol ${
            item.status === "error" ? "failed" : ""
          }">
            ${item.status === "success" ? ICON.check : ICON.alert}
          </div>

          <div class="result-info">
            <strong>
              ${escapeHtml(
                (item.output || item.input).split(/[\\/]/).pop()
              )}
            </strong>

            <small>
              ${new Date(item.time).toLocaleString()}
              · ${escapeHtml(item.message)}
            </small>
          </div>

          ${item.output ? `
            <div class="result-actions">
              <button
                class="small-btn"
                data-history-preview="${encodeURIComponent(item.output)}"
              >
                Preview
              </button>

              <button
                class="small-btn"
                data-history-open="${encodeURIComponent(item.output)}"
              >
                Open
              </button>
            </div>
          ` : ""}
        </div>
      `).join("")
    : '<div class="empty">No conversions yet.</div>';

  document.querySelectorAll("[data-history-preview]").forEach(button => {
    button.onclick = () => {
      showPreview(
        decodeURIComponent(button.dataset.historyPreview)
      );
    };
  });

  document.querySelectorAll("[data-history-open]").forEach(button => {
    button.onclick = () => {
      window.localConvert.openPath(
        decodeURIComponent(button.dataset.historyOpen)
      );
    };
  });
}

async function addFiles() {
  const selected = await window.localConvert.pickFiles();
  const knownPaths = new Set(files.map(file => file.path));

  files.push(
    ...selected.filter(file => !knownPaths.has(file.path))
  );

  renderFiles();
}

$("clearFiles").onclick = () => {
  files = [];
  renderFiles();
};

function setCategory(nextCategory) {
  category = nextCategory;

  document.querySelectorAll(".category").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.category === category
    );
  });

  const formats =
    category === "image" ? imageFormats : docFormats;

  $("format").innerHTML = formats.map(format => `
    <option value="${format}">
      ${formatLabels[format]}
    </option>
  `).join("");

  renderFiles();
}

document.querySelectorAll(".category").forEach(button => {
  button.onclick = () => setCategory(button.dataset.category);
});

$("format").onchange = updateStats;

$("chooseOutput").onclick = async () => {
  const selected = await window.localConvert.pickOutput();

  if (selected) {
    outputDir = selected;

    $("outputName").textContent = selected;
    $("outputName").title = selected;

    updateStats();
  }
};

$("convertBtn").onclick = async () => {
  if (!files.length) {
    alert("Add at least one file first.");
    return;
  }

  if (!outputDir) {
    alert("Choose an output folder first.");
    return;
  }

  const targetFormat = $("format").value;

  const eligible = files.filter(isEligible);

  if (!eligible.length) {
    alert(
      `No files in the queue match the ${category} category.`
    );
    return;
  }

  $("convertBtn").disabled = true;
  $("progressWrap").classList.remove("hidden");
  $("progressText").textContent = "Processing files locally…";
  $("progressPct").textContent = "Working";
  $("progressBar").style.width = "15%";

  try {
    const converted = await window.localConvert.convertBatch({
      files: eligible,
      outputDir,
      targetFormat
    });

    history.push(
      ...converted.map(result => ({
        ...result,
        time: Date.now()
      }))
    );

    $("progressBar").style.width = "100%";
    $("progressPct").textContent = "100%";

    const succeeded = converted.filter(
      result => result.status === "success"
    ).length;

    const failed = converted.length - succeeded;

    $("progressText").textContent =
      `Finished: ${succeeded} successful, ${failed} failed. ` +
      "See Conversion history.";

    renderHistory();
    updateStats();
  } catch (error) {
    $("progressWrap").classList.add("hidden");
    alert(error.message || String(error));
  } finally {
    $("convertBtn").disabled = false;
  }
};

async function showPreview(filePath) {
  if (!filePath) return;

  previewPath = filePath;

  $("previewTitle").textContent =
    filePath.split(/[\\/]/).pop();

  $("previewSub").textContent = filePath;

  $("previewContent").innerHTML =
    '<div class="preview-message">Preparing local preview…</div>';

  $("previewModal").classList.remove("hidden");

  const data = await window.localConvert.previewFile(filePath);
  const content = $("previewContent");

  if (data.kind === "image") {
    content.innerHTML = `
      <img
        alt="Local file preview"
        src="${data.dataUrl}"
      >
    `;
  } else if (data.kind === "pdf") {
    content.innerHTML = `
      <iframe
        title="PDF preview"
        src="${data.url}"
      ></iframe>
    `;
  } else {
    content.innerHTML = `
      <div class="preview-message">
        ${escapeHtml(data.message || "Preview unavailable.")}
      </div>
    `;
  }
}

function setPreviewFull(on) {
  const label = on ? "Exit full screen" : "Full screen";

  $("previewModal").classList.toggle("full", on);
  $("toggleFullscreen").setAttribute("aria-label", label);
  $("toggleFullscreen").title = label;
}

function closePreview() {
  setPreviewFull(false);
  $("previewModal").classList.add("hidden");
}

$("toggleFullscreen").onclick = () => {
  setPreviewFull(!$("previewModal").classList.contains("full"));
};

$("closePreview").onclick = closePreview;

$("previewModal").onclick = event => {
  if (event.target === $("previewModal")) {
    closePreview();
  }
};

document.addEventListener("keydown", event => {
  if (
    event.key !== "Escape" ||
    $("previewModal").classList.contains("hidden")
  ) {
    return;
  }

  if ($("previewModal").classList.contains("full")) {
    setPreviewFull(false);
  } else {
    closePreview();
  }
});

$("previewOpen").onclick = () => {
  if (previewPath) {
    window.localConvert.openPath(previewPath);
  }
};

$("previewPrint").onclick = async () => {
  if (!previewPath) return;

  await window.localConvert.openPath(previewPath);
};

const dropZone = $("dropZone");
let dragDepth = 0;

dropZone.onclick = addFiles;

dropZone.onkeydown = event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    addFiles();
  }
};

window.addEventListener("dragenter", event => {
  event.preventDefault();
  dragDepth += 1;
  dropZone.classList.add("dragover");
});

window.addEventListener("dragover", event => {
  event.preventDefault();
});

window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);

  if (!dragDepth) {
    dropZone.classList.remove("dragover");
  }
});

window.addEventListener("drop", event => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove("dragover");

  const knownPaths = new Set(files.map(file => file.path));

  const dropped = Array.from(event.dataTransfer.files)
    .map(file => ({
      path: window.localConvert.getPathForFile(file),
      name: file.name,
      size: file.size
    }))
    .filter(file =>
      file.path &&
      allSupported.includes(extOf(file.name)) &&
      !knownPaths.has(file.path)
    );

  if (dropped.length) {
    files.push(...dropped);
    renderFiles();
  }
});

document.querySelectorAll(".nav").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".nav").forEach(nav => {
      nav.classList.toggle("active", nav === button);
    });

    const isHistory = button.dataset.tab === "history";

    $("convertView").classList.toggle("hidden", isHistory);
    $("historyView").classList.toggle("hidden", !isHistory);
  };
});

$("clearHistory").onclick = () => {
  history = [];
  renderHistory();
  updateStats();
};

setCategory("image");
renderFiles();
renderHistory();