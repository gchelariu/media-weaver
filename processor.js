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
 *   - Files with no usable date: create metadata using the folder's year/month
 *     and the configured default day/time.
 */

const path = require('path');
const fs = require('fs');
const { walkFiles, isImageFile, isVideoFile } = require('./fs-utils');
const { readExistingDate, writeDate, writeVideoDate } = require('./exif');
const {
  YEAR_RE,
  MONTH_PREFIX_RE,
  DEFAULT_EXIF_DATE,
  IMAGE_DATE_TAGS,
  VIDEO_DATE_TAGS,
} = require('./config');

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

function fileModifyDateMatches(filePath, targetDate) {
  const mtime = fs.statSync(filePath).mtime;
  const mtimeFormatted = `${mtime.getFullYear()}:${String(mtime.getMonth() + 1).padStart(2, '0')}:${String(mtime.getDate()).padStart(2, '0')} ${String(mtime.getHours()).padStart(2, '0')}:${String(mtime.getMinutes()).padStart(2, '0')}:${String(mtime.getSeconds()).padStart(2, '0')}`;
  return mtimeFormatted === targetDate;
}

/**
 * Process a single image file.
 * Returns { changed, skipped } booleans (whether the file was changed/skipped).
 */
function processSingleMedia(filePath, year, month, tags, writeDateForType, opts) {
  try {
    const existing = readExistingDate(filePath, tags);
    const newDate = computeNewDate(existing, year, month);
    const isDefault = !existing;
    const tagsMatch = existing && tags.every(tag => existing[tag] === newDate);

    if (tagsMatch && fileModifyDateMatches(filePath, newDate)) {
      logStep(opts, filePath, isDefault, existing, newDate);
      return { skipped: true, changed: false, error: false };
    }

    if (opts.dryRun) {
      logStep(opts, filePath, isDefault, existing, newDate);
      return { skipped: false, changed: true, error: false };
    }

    writeDateForType(filePath, newDate);

    // Do not report a successful write unless the configured metadata and
    // filesystem timestamp can be read back with the requested values.
    const written = readExistingDate(filePath, tags);
    const tagsWritten = written && tags.every(tag => written[tag] === newDate);
    if (!tagsWritten || !fileModifyDateMatches(filePath, newDate)) {
      throw new Error('Post-write verification failed: one or more dates do not match the target');
    }

    logStep(opts, filePath, isDefault, existing, newDate);
    return { skipped: false, changed: true, error: false };
  } catch (err) {
    console.error(`ERROR processing ${filePath}: ${err.message}`);
    return { skipped: false, changed: false, error: true };
  }
}

/**
 * Process both images and videos in a single pass.
 */
function processMedia(root, opts) {
  const stats = { scanned: 0, changed: 0, skipped: 0, errors: 0 };

  const onWalkError = (directory, err) => {
    stats.errors++;
    console.error(`ERROR reading directory ${directory}: ${err.message}`);
  };

  for (const filePath of walkFiles(root, onWalkError)) {
    const parent = path.basename(path.dirname(filePath));        // month folder
    const grandParent = path.basename(path.dirname(path.dirname(filePath))); // year folder

    if (!YEAR_RE.test(grandParent) || !MONTH_PREFIX_RE.test(parent)) {
      continue; // not inside a <YEAR>/<MM*> pair
    }

    const month = parent.slice(0, 2);
    let result;
    if (isImageFile(filePath)) {
      stats.scanned++;
      result = processSingleMedia(filePath, grandParent, month, IMAGE_DATE_TAGS, writeDate, opts);
    } else if (isVideoFile(filePath)) {
      stats.scanned++;
      result = processSingleMedia(filePath, grandParent, month, VIDEO_DATE_TAGS, writeVideoDate, opts);
    } else {
      continue;
    }

    if (result.skipped) stats.skipped++;
    if (result.changed) stats.changed++;
    if (result.error) stats.errors++;
  }

  return stats;
}

module.exports = { computeNewDate, fileModifyDateMatches, processMedia };

function logStep(opts, filePath, isDefault, existing, newDate) {
  if (opts.dryRun || opts.verbose) {
    console.log(
      `${opts.dryRun ? '[DRY-RUN] ' : ''}${filePath}\n  ${isDefault ? '(no EXIF)  ->  ' : `${existing.raw}  ->  `}${newDate}`
    );
  }
}
