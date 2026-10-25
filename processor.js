/**
 * processor.js
 * Core processing logic: walk the tree, match <YEAR>/<MM> folders,
 * compute the new date, and write it (or count what would change).
 *
 * Images and videos are handled in a single pass:
 *   - Images: write DateTimeOriginal + CreateDate, then FileModifyDate.
 *   - Videos: write all metadata date tags (CreateDate, ModifyDate,
 *     TrackCreateDate, TrackModifyDate, MediaCreateDate, MediaModifyDate,
 *     DateTimeOriginal, XMP:CreateDate, XMP:DateTimeOriginal), then
 *     FileModifyDate.
 *
 * Single-pass behavior:
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
 * Compute the target date string from existing metadata and folder names.
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
 * Process a single image file.
 * Returns { changed, skipped } booleans (whether the file was changed/skipped).
 */
function processSingleImage(filePath, grandParent, month, opts) {
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
    logStep(opts, filePath, isDefault, existing, newDate);
    return { changed: false, skipped: true };
  }

  // DRY-RUN: count but don't write, and log.
  if (opts.dryRun) {
    logStep(opts, filePath, isDefault, existing, newDate);
    return { changed: true, skipped: false };
  }

  try {
    writeDate(filePath, newDate);
    logStep(opts, filePath, isDefault, existing, newDate);
    return { changed: true, skipped: false };
  } catch (err) {
    console.error(`ERROR writing ${filePath}: ${err.message}`);
    return { changed: false, skipped: false };
  }
}

/**
 * Process a single video file.
 * Returns { changed, skipped } booleans.
 */
function processSingleVideo(filePath, grandParent, month, opts) {
  const existing = readExistingDate(filePath, VIDEO_TAGS_TO_READ);
  const newDate = computeNewDate(existing, grandParent, month);
  const isDefault = !existing;

  // Skip if year/month already match and every video tag is present.
  const allVideoTagsPresent =
    existing && VIDEO_DATE_TAGS.every(tag => typeof existing[tag] === 'string');

  if (
    existing &&
    existing.year === grandParent &&
    existing.month === month &&
    allVideoTagsPresent
  ) {
    logStep(opts, filePath, isDefault, existing, newDate);
    return { changed: false, skipped: true };
  }

  // DRY-RUN: count but don't write, and log.
  if (opts.dryRun) {
    logStep(opts, filePath, isDefault, existing, newDate);
    return { changed: true, skipped: false };
  }

  try {
    writeVideoDate(filePath, newDate);
    logStep(opts, filePath, isDefault, existing, newDate);
    return { changed: true, skipped: false };
  } catch (err) {
    console.error(`ERROR writing ${filePath}: ${err.message}`);
    return { changed: false, skipped: false };
  }
}

/**
 * Process both images and videos in a single pass.
 */
function processMedia(root, opts) {
  const stats = { scanned: 0, changed: 0, skipped: 0, errors: 0 };

  for (const filePath of walkFiles(root)) {
    const parent = path.basename(path.dirname(filePath));        // month folder
    const grandParent = path.basename(path.dirname(path.dirname(filePath))); // year folder

    if (!YEAR_RE.test(grandParent) || !MONTH_PREFIX_RE.test(parent)) {
      continue; // not inside a <YEAR>/<MM*> pair
    }

    const month = parent.slice(0, 2);
    stats.scanned++;

    if (isImageFile(filePath)) {
      const result = processSingleImage(filePath, grandParent, month, opts);
      if (result.skipped) stats.skipped++;
      else if (result.changed) stats.changed++;
    } else if (isVideoFile(filePath)) {
      const result = processSingleVideo(filePath, grandParent, month, opts);
      if (result.skipped) stats.skipped++;
      else if (result.changed) stats.changed++;
    }
    // Non-matching extensions are ignored (already filtered by walk logic).
  }

  return stats;
}

module.exports = { processMedia };

function logStep(opts, filePath, isDefault, existing, newDate) {
  if (opts.dryRun || opts.verbose) {
    console.log(
      `${opts.dryRun ? '[DRY-RUN] ' : ''}${filePath}\n  ${isDefault ? '(no EXIF)  ->  ' : `${existing.raw}  ->  `}${newDate}`
    );
  }
}