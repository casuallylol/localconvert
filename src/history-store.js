// Saves the conversion history to a file on the user's computer so it is
// still there after the app is closed. Nothing here touches the internet.
//
// Each record: { time, input, output, status, message, targetFormat }
//   time          milliseconds since 1970 (the UI shows date and time from it)
//   input         full path of the source file
//   output        full path of the converted file, or null if it failed
//   status        "success" or "error"
//   message       "Converted successfully" or the error text
//   targetFormat  the format that was chosen (png, jpg, docx, ...)

const fs = require("node:fs");
const path = require("node:path");

const MAX_RECORDS = 1000;

function createHistoryStore(filePath) {
  let records = load();

  function load() {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return Array.isArray(data) ? data : [];
    } catch {
      // No file yet, or it is damaged: start with an empty history.
      return [];
    }
  }

  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Write to a temporary file first, then rename it, so a crash in the
    // middle of saving cannot leave a half-written history file.
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf8");
    fs.renameSync(tempPath, filePath);
  }

  return {
    all() {
      return records.slice();
    },

    add(newRecords) {
      records.push(...newRecords);

      if (records.length > MAX_RECORDS) {
        records = records.slice(records.length - MAX_RECORDS);
      }

      save();
    },

    clear() {
      records = [];
      save();
    }
  };
}

module.exports = { createHistoryStore };
