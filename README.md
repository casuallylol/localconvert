# LocalConvert

Offline image + document converter (Electron).

You and your friend both run the **same source code** the same way.
Nobody needs anything except Node.js and LibreOffice (see below).

## One-time setup (each person, each computer)

1. Install **Node.js LTS** from nodejs.org.
2. Install **LibreOffice** (64-bit) from libreoffice.org. Use the default
   install location. This is what makes DOC/DOCX/WPS/PDF conversion work
   while you develop.
3. In the project folder:
   ```
   npm install
   npm run test:lo     # should print PASS
   npm start
   ```

`npm install` only needs to be run again if `package.json` changes.
Never copy `node_modules` between folders.

## Everyday use

- `npm start` opens the app.
- Edit anything in `src/renderer/` (HTML, CSS, JS) and the window
  **reloads by itself** when you save. Ctrl+R reloads by hand.
- F12 or Ctrl+Shift+I opens developer tools (only while running from source).
- The terminal prints `[LocalConvert] Document engine: system ...` on
  startup. `none` means LibreOffice wasn't found.

## Troubleshooting

- **A "Waiting for printer connection" window appears, or previews hang.**
  LibreOffice is trying to reach your default printer and Windows can't.
  Settings > Printers & scanners > turn off "Let Windows manage my default
  printer" and set "Microsoft Print to PDF" as the default.
- **"Cannot find module ..." on start.** Run `npm install` again.
- **Terminal doesn't print `[LocalConvert] Document engine: ...`.** You are
  running an old folder. Run `npm start` inside this project folder.

## About PDF to DOCX

LibreOffice rebuilds a PDF page by placing every line of text in its own
text box. The app removes the full-page white rectangle it adds to every
page (`src/docx-clean.js`), puts highlights and shapes behind their text, and
PDF to TXT reads the text out of those boxes.
Layout stays close to the PDF, but the text is not one flowing, easily
editable document. That limit comes from LibreOffice itself.

## Who edits what

| Area | Files |
|---|---|
| UI (front end) | `src/renderer/*` |
| API between UI and back end | `src/preload.js` (see `FRONTEND.md`) |
| Conversion, back end | `src/main.js`, `src/converters.js`, `src/docx-clean.js`, `src/lo-paths.js` |

## Building the installer for other people (back end)

Users of the installer do NOT need LibreOffice. It is packed inside.

1. `npm run setup:lo`   copies your installed LibreOffice to `vendor/libreoffice`
2. `npm run test:lo`
3. `npm run dist`       creates `release\LocalConvert-Setup-1.0.0.exe`

Test the .exe on a computer without LibreOffice. A LibreOffice installed on
your PC is not bundled automatically; step 1 is required.

LibreOffice is MPL 2.0. Credit it and link to libreoffice.org somewhere
(an About screen, or the installer text) before distributing.
