/**
 * exif.js
 * All exiftool subprocess calls.
 */

const { execFileSync } = require('child_process');
const {
  TAGS_TO_READ,
  TAGS_TO_WRITE,
  DATE_FORMAT,
  VIDEO_DATE_TAGS,
  VIDEO_TAGS_TO_READ,
} = require('./config');

function checkExiftool() {
  try {
    execFileSync('exiftool', ['-ver'], { stdio: 'pipe' });
  } catch (err) {
    console.error('Error: exiftool is not installed or not on your PATH.');
    console.error('Install it (e.g. `apt install libimage-exiftool-perl` or `brew install exiftool`) and try again.');
    process.exit(1);
  }
}

/**
 * Read the existing date/taken time from a file.
 * Returns { year, month, day, time, raw, hasDateTimeOriginal, hasCreateDate }
 * or null if no usable date exists.
 *
 * If `extraTags` is provided (e.g. for videos), those tags are also read and
 * copied onto the returned object so callers can check whether they're present.
 */
function readExistingDate(filePath, extraTags) {
  const tagsToRead = extraTags ? [...TAGS_TO_READ, ...extraTags] : TAGS_TO_READ;

  let out;
  try {
    out = execFileSync(
      'exiftool',
      ['-json', '-d', DATE_FORMAT, ...tagsToRead.map(tag => `-${tag}`), filePath],
      { encoding: 'utf8' }
    );
  } catch (err) {
    return null;
  }

  let arr;
  try {
    arr = JSON.parse(out);
  } catch (err) {
    return null;
  }

  const obj = arr && arr.length ? arr[0] : {};
  let first = null;
  for (const tag of TAGS_TO_READ) {
    const value = obj[tag];
    if (typeof value !== 'string') continue;
    const m = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/);
    if (m) {
      if (!first) {
        first = {
          year: m[1],
          month: m[2],
          day: m[3],
          time: m[4],
          raw: value,
        };
      }
    }
  }
  if (!first) return null;

  const result = {
    ...first,
    hasDateTimeOriginal: typeof obj.DateTimeOriginal === 'string',
    hasCreateDate: typeof obj.CreateDate === 'string',
  };

  if (extraTags) {
    for (const tag of extraTags) {
      result[tag] = typeof obj[tag] === 'string' ? obj[tag] : undefined;
    }
  }

  return result;
}

/**
 * Build the date-tag exiftool args (plus overwrite/minor-error flags).
 */
function dateArgs(newDate) {
  const args = ['-overwrite_original', '-m', '-api', 'IgnoreMinorErrors=1'];
  for (const tag of TAGS_TO_WRITE) {
    args.push(`-${tag}=${newDate}`);
  }
  return args;
}

/**
 * Write the new date to the file's EXIF tags.
 * If the file has corrupt EXIF structure (e.g. bad OtherImageStart data),
 * the normal write may fail. In that case we wipe the broken EXIF block
 * with `-exif:all=` and write fresh metadata.
 */
function writeDate(filePath, newDate) {
  const args = [...dateArgs(newDate), filePath];
  try {
    execFileSync("exiftool", args, { encoding: "utf8" });
  } catch (err) {
    // Fallback: delete all existing EXIF (removing corrupt data), then write fresh metadata.
    const wipeArgs = [
      "-overwrite_original",
      "-m",
      "-api",
      "IgnoreMinorErrors=1",
      "-exif:all=",
      ...dateArgs(newDate),
      filePath,
    ];
    execFileSync("exiftool", wipeArgs, { encoding: "utf8" });
  }

  // Also set the file modification date to match.
  const fmArgs = ["-overwrite_original", `-FileModifyDate=${newDate}`, filePath];
  execFileSync("exiftool", fmArgs, { encoding: "utf8" });
}

module.exports = { checkExiftool, readExistingDate, writeDate, writeVideoDate };

/**
 * Build the exiftool args for writing all video metadata date tags.
 */
function videoDateArgs(newDate) {
  const args = ['-overwrite_original', '-m', '-api', 'IgnoreMinorErrors=1'];
  for (const tag of VIDEO_DATE_TAGS) {
    args.push(`-${tag}=${newDate}`);
  }
  return args;
}

/**
 * Write all metadata dates for a video file, then set the file
 * modification date in a second exiftool call (matching the manual
 * exiftool command used for videos).
 */
function writeVideoDate(filePath, newDate) {
  const writeArgs = [...videoDateArgs(newDate), filePath];
  try {
    execFileSync('exiftool', writeArgs, { encoding: 'utf8' });
  } catch (err) {
    // Fallback: delete all existing EXIF (removing corrupt data), then write fresh metadata.
    const wipeArgs = [
      '-overwrite_original',
      '-m',
      '-api',
      'IgnoreMinorErrors=1',
      '-exif:all=',
      ...videoDateArgs(newDate),
      filePath,
    ];
    execFileSync('exiftool', wipeArgs, { encoding: 'utf8' });
  }

  // Second pass: set FileModifyDate.
  const fmArgs = ['-overwrite_original', `-FileModifyDate=${newDate}`, filePath];
  execFileSync('exiftool', fmArgs, { encoding: 'utf8' });
}
