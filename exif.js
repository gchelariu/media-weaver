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
 * Returns { year, month, day, time, raw } or null if no usable date exists.
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
  for (const tag of TAGS_TO_READ) {
    const value = obj[tag];
    if (typeof value !== 'string') continue;
    const m = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/);
    if (m) {
      return {
        year: m[1],
        month: m[2],
        day: m[3],
        time: m[4],
        raw: value,
      };
    }
  }
  return null;
}

/**
 * Write the new date to the file's EXIF tags.
 */
function writeDate(filePath, newDate) {
  const args = ['-overwrite_original'];
  for (const tag of TAGS_TO_WRITE) {
    args.push(`-${tag}=${newDate}`);
  }
  args.push(filePath);
  execFileSync('exiftool', args, { encoding: 'utf8' });
}

module.exports = { checkExiftool, readExistingDate, writeDate };
