/**
 * processor.js
 * Core processing logic: walk the tree, match <YEAR>/<MM> folders,
 * compute the new date, and write it (or count what would change).
 *
 * Images and videos are handled by separate methods because they write
 * different sets of metadata tags:
 *   - Images: DateTimeOriginal + CreateDate, then FileModifyDate.
 *   - Videos: all metadata date tags (CreateDate, ModifyDate,
 *     TrackCreateDate, TrackModifyDate, MediaCreateDate, MediaModifyDate,
 *     DateTimeOriginal, XMP:CreateDate, XMP:DateTimeOriginal), then
 *     FileModifyDate.
 *
 * Single-pass behavior (both types):
 *   - Files that already have an EXIF date: keep existing day/time, update
 *     year/month to match the folder.
 *   - Files with NO EXIF date: create EXIF metadata using the folder's
 *     year/month with default day/time (01 01:00:00).
 */

const path = require('path');
const { walkFiles, isImageFile, isVideoFile } = require('./fs-utils');
const { readExistingDate, writeDate, writeVideoDate } = require('./exif');
const {
  YEAR_RE,
  MONTH_PREFIX_RE,
  DEFAULT_EXIF_DATE,
  VIDEO_DATE_TAGS,
  VIDEO_TAGS_TO_READ,
} = require('./config');

const IMAGE_TAGS = ['DateTimeOriginal', 'CreateDate'];

/**
 * Compute the target date string from the existing metadata and folder names.
 * Keeps the existing day/time, swaps in folder year/month.
 */
function computeNewDate(existing, grandParent, month) {
  if (existing) {
    return `${grandParent}:${month}:${existing.day} ${existing.time}`;
  }
  const [defaultDate, defaultTime] = DEFAULT_EXIF_DATE.split(' ');
  const [, , defaultDay] = defaultDate.split(':');
  return `${grandParent}:${month}:${defaultDay} ${defaultTime}`;
}

/**
 * Process image files only.
 */
function processImages(root, opts) {
  const stats = { scanned: 0, changed: 0, skipped: 0, errors: 0 };

  for (const filePath of walkFiles(root)) {
    if (!isImageFile(filePath)) continue;

    const parent = path.basename(path.dirname(filePath));        // month folder
    const grandParent = path.basename(path.dirname(path.dirname(filePath))); // year folder

    if (!YEAR_RE.test(grandParent) || !MONTH_PREFIX_RE.test(parent)) {
      continue; // not inside a <YEAR>/<MM*> pair
    }

    const month = parent.slice(0, 2);

    stats.scanned++;

    const existing = readExistingDate(filePath);
    const newDate = computeNewDate(existing, grandParent, month);
    const isDefault = !existing;

    // Skip if year/month already match and both image tags are present.
    if (
      existing &&
      existing.year === grandParent &&
      existing.month === month &&
      existing.hasDateTimeOriginal &&
      existing.hasCreateDate
    ) {
      stats.skipped++;
      if (opts.verbose) {
        console.log(`SKIP (already correct): ${filePath}`);
      }
      continue;
    }

    logStep(opts, filePath, isDefault, existing, newDate);
    if (opts.dryRun) {
      stats.changed++;
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

/**
 * Process video files only.
 */
function processVideos(root, opts) {
  const stats = { scanned: 0, changed: 0, skipped: 0, errors: 0 };

  for (const filePath of walkFiles(root)) {
    if (!isVideoFile(filePath)) continue;

    const parent = path.basename(path.dirname(filePath));        // month folder
    const grandParent = path.basename(path.dirname(path.dirname(filePath))); // year folder

    if (!YEAR_RE.test(grandParent) || !MONTH_PREFIX_RE.test(parent)) {
      continue; // not inside a <YEAR>/<MM*> pair
    }

    const month = parent.slice(0, 2);

    stats.scanned++;

    const existing = readExistingDate(filePath, VIDEO_TAGS_TO_READ);
    const newDate = computeNewDate(existing, grandParent, month);
    const isDefault = !existing;

    // Skip if year/month already match and every video tag is present.
    const allVideoTagsPresent =
      existing &&
      VIDEO_DATE_TAGS.every(tag => typeof existing[tag] === 'string');

    if (
      existing &&
      existing.year === grandParent &&
      existing.month === month &&
      allVideoTagsPresent
    ) {
      stats.skipped++;
      if (opts.verbose) {
        console.log(`SKIP (already correct): ${filePath}`);
      }
      continue;
    }

    logStep(opts, filePath, isDefault, existing, newDate);
    if (opts.dryRun) {
      stats.changed++;
      continue;
    }

    try {
      writeVideoDate(filePath, newDate);
      stats.changed++;
      if (opts.verbose) console.log(`  OK`);
    } catch (err) {
      stats.errors++;
      console.error(`ERROR writing ${filePath}: ${err.message}`);
    }
  }

  return stats;
}

/**
 * Process both images and videos, returning merged stats.
 */
function processMedia(root, opts) {
  const imageStats = processImages(root, opts);
  const videoStats = processVideos(root, opts);

  return {
    scanned: imageStats.scanned + videoStats.scanned,
    changed: imageStats.changed + videoStats.changed,
    skipped: imageStats.skipped + videoStats.skipped,
    errors: imageStats.errors + videoStats.errors,
  };
}

module.exports = { processMedia, processImages, processVideos };

function logStep(opts, filePath, isDefault, existing, newDate) {
  if (opts.dryRun || opts.verbose) {
    console.log(
      `${opts.dryRun ? '[DRY-RUN] ' : ''}${filePath}\n  ${isDefault ? '(no EXIF)  ->  ' : `${existing.raw}  ->  `}${newDate}`
    );
  }
}
