/**
 * processor.js
 * Core processing logic: walk the tree, match <YEAR>/<MM> folders,
 * compute the new date, and write it (or count what would change).
 *
 * Single-pass behavior:
 *   - Files that already have an EXIF date: keep existing day/time, update
 *     year/month to match the folder.
 *   - Files with NO EXIF date: create EXIF metadata using the folder's
 *     year/month with default day/time (01 01:00:00).
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

    let newDate;
    let isDefault;

    if (existing) {
      // Keep existing day/time, use folder year/month.
      newDate = `${grandParent}:${parent}:${existing.day} ${existing.time}`;
      isDefault = false;
    } else {
      // No EXIF metadata: create it using folder year/month, default day/time.
      newDate = `${grandParent}:${parent}:01 01:00:00`;
      isDefault = true;
    }

    // Nothing to do if year/month already match the folders.
    if (!isDefault && existing.year === grandParent && existing.month === parent) {
      stats.skipped++;
      if (opts.verbose) {
        console.log(`SKIP (already correct): ${filePath}`);
      }
      continue;
    }

    logStep(opts, filePath, isDefault, existing, newDate);

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
function logStep(opts, filePath, isDefault, existing, newDate) {
  if (opts.dryRun || opts.verbose) {
    console.log(
      `${opts.dryRun ? '[DRY-RUN] ' : ''}${filePath}\n  ${isDefault ? '(no EXIF)  ->  ' : `${existing.raw}  ->  `}${newDate}`
    );
  }
}

