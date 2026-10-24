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
const { YEAR_RE, MONTH_PREFIX_RE, DEFAULT_EXIF_DATE } = require('./config');

function processPhotos(root, opts) {
  const stats = { scanned: 0, changed: 0, skipped: 0, errors: 0 };

  for (const filePath of walkFiles(root)) {
    if (!isImageFile(filePath)) continue;

    const parent = path.basename(path.dirname(filePath));        // month folder (e.g. "05" or "05-Test-test")
    const grandParent = path.basename(path.dirname(path.dirname(filePath))); // year folder

    if (!YEAR_RE.test(grandParent) || !MONTH_PREFIX_RE.test(parent)) {
      continue; // not inside a <YEAR>/<MM*> pair
    }

    // Month is just the first two digits (anything after is ignored).
    const month = parent.slice(0, 2);

    stats.scanned++;

    const existing = readExistingDate(filePath);

    let newDate;
    let isDefault;
    let needsWrite = true;

    if (existing) {
      // Keep existing day/time, use folder year/month.
      newDate = `${grandParent}:${month}:${existing.day} ${existing.time}`;
      isDefault = false;

      // If year/month already match the folder, still write if either tag
      // (DateTimeOriginal / CreateDate) is missing.
      if (
        existing.year === grandParent &&
        existing.month === month &&
        existing.hasDateTimeOriginal &&
        existing.hasCreateDate
      ) {
        needsWrite = false;
      }
    } else {
      // No EXIF metadata: create it using folder year/month, default day/time.
      const [defaultDate, defaultTime] = DEFAULT_EXIF_DATE.split(' ');
      const [, , defaultDay] = defaultDate.split(':');
      newDate = `${grandParent}:${month}:${defaultDay} ${defaultTime}`;
      isDefault = true;
    }

    // Nothing to do if already correct and both tags present.
    if (!needsWrite) {
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

