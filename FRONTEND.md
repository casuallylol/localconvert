# Front-end guide

You work in **`src/renderer/`**:

```
index.html   markup
style.css    styling
renderer.js  behaviour
```

Run it with `npm start` (setup steps are in `README.md`). The window reloads
by itself whenever you save a file in `src/renderer/`, so you can edit CSS and
watch it change. F12 opens developer tools.

Leave `src/main.js`, `src/converters.js`, `src/lo-paths.js` and
`src/preload.js` to the back-end person. Ask if you need something new.

## What the UI can call

Only `window.localConvert`:

| Call | Returns |
|---|---|
| `pickFiles()` | `[{ path, name, size }]`, `[]` if cancelled |
| `pickOutput()` | folder path, or `null` |
| `openPath(filePath)` | opens a file in its default app |
| `previewFile(filePath)` | `{ kind: "image", dataUrl }`, `{ kind: "pdf", url }`, or `{ kind: "unsupported" \| "error", message }` |
| `convertBatch({ files, outputDir, targetFormat })` | `[{ input, output, status, message }]` (`status` is `"success"` or `"error"`, `output` is `null` on error) |
| `getDocumentEngineStatus()` | `{ available, source }` |
| `getPathForFile(file)` | real path of a dropped `File` |

`targetFormat`: `png jpg webp pdf docx doc txt`.

## Rules that will bite you

- Strict CSP in `index.html`: no inline `<script>`, `<style>` or
  `style="..."` attributes, no CDN links, no web fonts from the internet.
  Put CSS in `style.css`, JS in `renderer.js`, and keep fonts/images as local
  files inside `src/renderer/`.
- If you delete an element, also delete the `$("thatId")` lines in
  `renderer.js` that use it, or the script stops with an error.
- The app is offline-only: nothing that calls the internet.
