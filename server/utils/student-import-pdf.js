const PDF_SIGNATURE = Buffer.from('%PDF-');
const MAX_PDF_PAGES = 100;

function hasPdfSignature(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= PDF_SIGNATURE.length
    && buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
}

function linesFromTextItems(items) {
  const lines = new Map();

  for (const item of items) {
    const text = String(item.str || '').trim();
    if (!text || !Array.isArray(item.transform)) continue;

    const y = Math.round(Number(item.transform[5]) * 2) / 2;
    const line = lines.get(y) || [];
    line.push({ x: Number(item.transform[4]) || 0, text });
    lines.set(y, line);
  }

  return [...lines.entries()]
    .sort(([leftY], [rightY]) => rightY - leftY)
    .map(([, line]) => line.sort((left, right) => left.x - right.x).map((item) => item.text).join(' '));
}

function parsePdfRosterLines(pages, defaults) {
  const rows = [];

  pages.forEach((lines, pageIndex) => {
    lines.forEach((line, lineIndex) => {
      const match = String(line).match(/^\s*(\d{1,3})\s+([A-Z0-9-]{4,30})\s+(.+?)\s+([A-Z0-9-]{2,20})\s*$/i);
      if (!match) return;

      rows.push({
        rowNumber: `page ${pageIndex + 1}, line ${lineIndex + 1}`,
        class_roll_number: match[1],
        university_roll_number: match[2],
        name: match[3],
        section: match[4],
        course: defaults.course,
        branch: defaults.branch,
        year: defaults.year,
      });
    });
  });

  return rows;
}

async function readPdfStudentRows(buffer, defaults) {
  if (!hasPdfSignature(buffer)) {
    throw new Error('The uploaded file content is not a valid PDF.');
  }

  if (!defaults.course || !defaults.branch || !defaults.year) {
    throw new Error('PDF roster imports require Course, Branch, and Year.');
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useWorkerFetch: false,
  });
  const document = await loadingTask.promise;

  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new Error(`PDF files may contain at most ${MAX_PDF_PAGES} pages.`);
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(linesFromTextItems(content.items));
      page.cleanup();
    }

    const rows = parsePdfRosterLines(pages, defaults);
    if (rows.length === 0) {
      throw new Error('No roster rows were found. Use a text-based BBDU roster PDF, not a scanned image PDF.');
    }
    return rows;
  } finally {
    await document.destroy();
  }
}

module.exports = {
  hasPdfSignature,
  linesFromTextItems,
  parsePdfRosterLines,
  readPdfStudentRows,
};
