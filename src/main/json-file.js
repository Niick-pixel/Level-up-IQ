// Small helpers for the JSON files Mind Gym keeps in its app-data folder.
// Writes are atomic (write a .tmp file, then rename) so a crash never leaves half a file.
const fs = require('fs');
const path = require('path');

function readJson(file, fallback) {
  if (!file) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(file, data) {
  if (!file) return; // in-memory mode (tests)
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error(`Could not save ${path.basename(file)}:`, err);
  }
}

/** Append-only log, one JSON object per line. */
function appendJsonl(file, obj) {
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(obj) + '\n');
  } catch (err) {
    console.error(`Could not append to ${path.basename(file)}:`, err);
  }
}

function readJsonl(file) {
  if (!file) return [];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch { /* skip a torn line */ }
  }
  return out;
}

module.exports = { readJson, writeJson, appendJsonl, readJsonl };
