const fs = require("node:fs/promises");
const JSZip = require("jszip");

const EMU_PER_PT = 12700;

function pageSizePt(xml) {
  const tag = xml.match(/<w:pgSz\b[^>]*>/);
  const w = tag && tag[0].match(/\bw:w="(\d+)"/);
  const h = tag && tag[0].match(/\bw:h="(\d+)"/);

  return {
    width: w ? Number(w[1]) / 20 : 612,
    height: h ? Number(h[1]) / 20 : 792
  };
}

const isWhite = value =>
  /^(white|#?f{6}|#?fff)$/i.test((value || "").trim());

function removeWhitePageShapes(xml) {
  const page = pageSizePt(xml);
  const minSide = Math.min(page.width, page.height) * 0.9;
  const covers = (w, h) => w >= minSide && h >= minSide;

  let removed = 0;

  xml = xml.replace(
    /<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g,
    block => {
      if (block.includes("<w:txbxContent>")) return block;

      const ext = block.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
      const fill = block.match(
        /<wps:spPr>[\s\S]*?<a:solidFill>\s*<a:srgbClr val="(\w+)"/
      );

      if (
        ext && fill && isWhite(fill[1]) &&
        covers(ext[1] / EMU_PER_PT, ext[2] / EMU_PER_PT)
      ) {
        removed += 1;
        return "";
      }

      return block;
    }
  );

  xml = xml.replace(/<w:pict>[\s\S]*?<\/w:pict>/g, block => {
    if (block.includes("<v:textbox")) return block;

    const fill = block.match(/fillcolor="([^"]*)"/);
    const style = block.match(
      /width:([\d.]+)pt;height:([\d.]+)pt/
    );

    if (
      fill && style && isWhite(fill[1]) &&
      covers(Number(style[1]), Number(style[2]))
    ) {
      removed += 1;
      return "";
    }

    return block;
  });

  return { xml, removed };
}

function fixShapeLayering(xml) {
  let fixed = 0;

  xml = xml.replace(
    /<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g,
    block => {
      const hasText = block.includes("<w:txbxContent>");
      const wanted = hasText ? "0" : "1";

      const next = block.replace(
        /(<wp:anchor\b[^>]*?\bbehindDoc=")[01](")/,
        `$1${wanted}$2`
      );

      if (next !== block) fixed += 1;
      return next;
    }
  );

  let z = -251658240;

  const parts = xml.split(/(<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>)/);

  xml = parts
    .map(part => {
      if (part.startsWith("<mc:AlternateContent>")) return part;

      return part.replace(/<w:pict>[\s\S]*?<\/w:pict>/g, block => {
        if (block.includes("<v:textbox")) return block;

        const next = block.replace(
          /(<v:shape\b[^>]*?\sstyle=")([^"]*)(")/,
          (_m, a, style, c) => {
            const cleaned = style.replace(/;?\s*z-index:[^;]*/g, "");
            z += 1;
            return `${a}${cleaned};z-index:${z}${c}`;
          }
        );

        if (next !== block) fixed += 1;
        return next;
      });
    })
    .join("");

  return { xml, fixed };
}

async function cleanPdfDocx(docxPath) {
  try {
    const zip = await JSZip.loadAsync(await fs.readFile(docxPath));
    const entry = zip.file("word/document.xml");
    if (!entry) return 0;

    const cleaned = removeWhitePageShapes(await entry.async("string"));
    const layered = fixShapeLayering(cleaned.xml);

    const xml = layered.xml;
    const removed = cleaned.removed + layered.fixed;

    if (!removed) return 0;

    zip.file("word/document.xml", xml);

    await fs.writeFile(
      docxPath,
      await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE"
      })
    );

    return removed;
  } catch {
    return 0;
  }
}

async function docxToPlainText(docxPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(docxPath));
  const entry = zip.file("word/document.xml");
  if (!entry) return "";

  const xml = await entry.async("string");
  const lines = [];

  const primary = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "");

  for (const paragraph of primary.split("</w:p>")) {
    const pieces = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)];
    if (!pieces.length) continue;

    lines.push(
      pieces
        .map(match => match[1])
        .join("")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
    );
  }

  return lines.join("\n") + "\n";
}

module.exports = { cleanPdfDocx, docxToPlainText, removeWhitePageShapes };
