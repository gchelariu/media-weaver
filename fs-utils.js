/**
 * fs-utils.js
 * Filesystem helpers: recursive file walking and image-extension checks.
 */

const fs = require('fs');
const path = require('path');
const { IMAGE_EXTENSIONS, MOVIE_EXTENSIONS } = require('./config');

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MOVIE_EXTENSIONS.has(ext);
}

/**
 * Recursively yield every file under `dir`.
 */
function* walkFiles(dir, onError) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (onError) {
      onError(dir, err);
      return;
    }
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full, onError);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

module.exports = { isImageFile, isVideoFile, walkFiles };
