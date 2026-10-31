/**
 * exif.js
 * All exiftool subprocess calls.
 */

const { execFileSync } = require('child_process');
const {
  IMAGE_DATE_TAGS,
  DATE_FORMAT,
  VIDEO_DATE_TAGS,
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

function readTagValue(obj, tag) {
  const isXmpTag = tag.startsWith('XMP:');
  const tagName = isXmpTag ? tag.slice('XMP:'.length) : tag;
  const matchingValues = Object.entries(obj)
    .filter(([key]) => key.endsWith(`:${tagName}`) && key.startsWith('XMP-') === isXmpTag)
    .map(([, value]) => value)
    .filter(value => typeof value === 'string');

  // A tag such as TrackCreateDate can occur on multiple tracks. Consider it
  // matched only when every reported instance agrees.
  if (!matchingValues.length || matchingValues.some(value => value !== matchingValues[0])) {
    return undefined;
  }
  return matchingValues[0];
}

function exifToolError(action, err) {
  const stderr = err.stderr && err.stderr.toString().trim();
  return new Error(`ExifTool failed to ${action}: ${stderr || err.message}`);
}

/**
 * Read the existing date/taken time from a file.
 * Returns { year, month, day, time, raw, ...requestedTags }
 * or null if ExifTool reads the file but no usable date exists.
 *
 * If `extraTags` is provided (e.g. for videos), those tags are also read and
 * copied onto the returned object so callers can check whether they're present.
 */
function readExistingDate(filePath, extraTags) {
  const tagsToRead = [...new Set([...IMAGE_DATE_TAGS.slice(0, 2), ...(extraTags || [])])];

  let out;
  try {
    out = execFileSync(
      'exiftool',
      ['-json', '-G1', '-d', DATE_FORMAT, ...tagsToRead.map(tag => `-${tag}`), filePath],
      { encoding: 'utf8' }
    );
  } catch (err) {
    throw exifToolError(`read metadata from ${filePath}`, err);
  }

  let arr;
  try {
    arr = JSON.parse(out);
  } catch (err) {
    throw new Error(`Could not parse ExifTool metadata for ${filePath}: ${err.message}`);
  }

  const obj = arr && arr.length ? arr[0] : {};
  let first = null;
  for (const tag of IMAGE_DATE_TAGS.slice(0, 2)) {
    const value = readTagValue(obj, tag);
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
  };

  if (extraTags) {
    for (const tag of extraTags) {
      result[tag] = readTagValue(obj, tag);
    }
  }

  return result;
}

function dateArgs(tags, newDate) {
  const args = ['-overwrite_original', '-m', '-api', 'IgnoreMinorErrors=1'];
  for (const tag of tags) {
    args.push(`-${tag}=${newDate}`);
  }
  return args;
}

function isKnownExifStructureError(err) {
  const message = `${err.message || ''}\n${err.stderr || ''}`;
  return /(?:bad|corrupt|invalid).*OtherImageStart|OtherImageStart.*(?:bad|corrupt|invalid)/i.test(message);
}

function writeMetadataDate(filePath, newDate, tags) {
  const args = [...dateArgs(tags, newDate), filePath];
  try {
    execFileSync('exiftool', args, { encoding: 'utf8' });
  } catch (err) {
    // Only wipe EXIF for the specific known broken structure this fallback handles.
    if (!isKnownExifStructureError(err)) {
      throw exifToolError(`write metadata to ${filePath}`, err);
    }

    const wipeArgs = [
      ...args.slice(0, 4),
      '-exif:all=',
      ...args.slice(4, -1),
      filePath,
    ];
    try {
      execFileSync('exiftool', wipeArgs, { encoding: 'utf8' });
    } catch (fallbackErr) {
      throw exifToolError(`repair EXIF and write metadata to ${filePath}`, fallbackErr);
    }
  }

  const fmArgs = ['-overwrite_original', `-FileModifyDate=${newDate}`, filePath];
  try {
    execFileSync('exiftool', fmArgs, { encoding: 'utf8' });
  } catch (err) {
    throw exifToolError(`set FileModifyDate on ${filePath}`, err);
  }
}

function writeDate(filePath, newDate) {
  return writeMetadataDate(filePath, newDate, IMAGE_DATE_TAGS);
}

function writeVideoDate(filePath, newDate) {
  return writeMetadataDate(filePath, newDate, VIDEO_DATE_TAGS);
}

module.exports = {
  checkExiftool,
  isKnownExifStructureError,
  readExistingDate,
  readTagValue,
  writeDate,
  writeVideoDate,
};
