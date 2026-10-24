/**
 * exif.js
 * All exiftool subprocess calls.
 */

const { execFileSync } = require('child_process');
const { TAGS_TO_READ, TAGS_TO_WRITE, DATE_FORMAT } = require('./config');

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
 */
function readExistingDate(filePath) {
  let out;
  try {
    out = execFileSync(
      'exiftool',
      ['-json', '-d', DATE_FORMAT, ...TAGS_TO_READ.map(tag => `-${tag}`), filePath],
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

  return {
    ...first,
    hasDateTimeOriginal: typeof obj.DateTimeOriginal === 'string',
    hasCreateDate: typeof obj.CreateDate === 'string',
  };
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
    execFileSync('exiftool', args, { encoding: 'utf8' });
    return;
  } catch (err) {
    // Fallback: delete all existing EXIF (removing corrupt data), then write fresh.
    const wipeArgs = [
      '-overwrite_original',
      '-m',
      '-api',
      'IgnoreMinorErrors=1',
      '-exif:all=',
      ...dateArgs(newDate),
      filePath,
    ];
    execFileSync('exiftool', wipeArgs, { encoding: 'utf8' });
  }
}

module.exports = { checkExiftool, readExistingDate, writeDate };
