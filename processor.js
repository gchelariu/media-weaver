/**
 * processor.js
 * Core processing logic: walk the tree, match <YEAR>/<MM> folders,
 * compute the new date, and write it (or count what would change).
 */

const path = require('path');
const { walkFiles, isImageFile } = require('./fs-utils');
const { readExistingDate, writeDate } = require('./exif');
const { YEAR_RE, MONTH_RE } = require('./config');

function processPhotos(root, opts) {
  const stats = { scanned: 0, changed: 0, skipped: 0, errors: 0 };

  for (const filePath of walkFiles(root)) {
    if (!isImageFile(filePath)) continue;

    const parent = path.basename(path.dirname(filePath));        // month folder
    const grandParent = path.basename(path.dirname(path.dirname(filePath))); // year folder

    if (!YEAR_RE.test(grandParent) || !MONTH_RE.test(parent)) {
      continue; // not inside a <YEAR>/<MM> pair
    }

    stats.scanned++;

    const existing = readExistingDate(filePath);
    if (!existing) {
      stats.skipped++;
      if (opts.verbose) {
        console.log(`SKIP (no EXIF date found): ${filePath}`);
      }
      continue;
    }

    // Nothing to do if year/month already match the folders.
    if (existing.year === grandParent && existing.month === parent) {
      stats.skipped++;
      if (opts.verbose) {
        console.log(`SKIP (already correct): ${filePath}`);
      }
      continue;
    }

    const newDate = `${grandParent}:${parent}:${existing.day} ${existing.time}`;

    if (opts.dryRun || opts.verbose) {
      console.log(
        `${opts.dryRun ? '[DRY-RUN] ' : ''}${filePath}\n  ${existing.raw}  ->  ${newDate}`
      );
    }

    if (opts.dryRun) {
      stats.changed++; // counted as "would change"
      continue;
    }

    try {
      writeDate(filePath, newDate);
      stats.changed++;
      if (opts.verbose) console.log(`  OK`);
    } catch (err) {
      stats.errors++;
      console.error(`ERROR writing ${filePath}: ${err.message}`);
    }
  }

  return stats;
}

module.exports = { processPhotos };
