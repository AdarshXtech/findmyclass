const { createWorker } = require('tesseract.js');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let activeRecognition = false;
const cachePath = path.join(os.tmpdir(), 'findmyclass-ocr');

async function recognizeTimetableImage(buffer) {
  if (activeRecognition) {
    const error = new Error('Another timetable image is being processed. Please try again shortly.');
    error.status = 429;
    throw error;
  }
  activeRecognition = true;
  let worker;
  try {
    fs.mkdirSync(cachePath, { recursive: true });
    worker = await createWorker('eng', undefined, { cachePath });
    const result = await worker.recognize(buffer);
    return result.data.text;
  } finally {
    activeRecognition = false;
    await worker?.terminate();
  }
}

module.exports = { recognizeTimetableImage };
