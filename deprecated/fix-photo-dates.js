#!/usr/bin/env node
/**
 * fix-photo-dates.js
 *
 * Sets the EXIF "date taken" (DateTimeOriginal) and "creation date" (CreateDate)
 * of every photo inside a year/month folder structure so the date matches the
 * folder names, while preserving the existing day and time.
 *
 * Expected directory layout:
 *   <root>/<YEAR>/<MM>/photo.jpg   e.g. 2026/01/vacation.jpg
 *
 * Usage:
 *   node fix-photo-dates.js /path/to/photos [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run, -n   Show what would be changed without writing anything.
 *   --verbose, -v   Print per-file details.
 *   --help, -h      Show this help.
 *
 * Requires exiftool (https://exiftool.org/) to be installed and on PATH.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// EXIF tags to read (first one found wins for the existing day/time).
const TAGS_TO_READ = ['DateTimeOriginal', 'CreateDate'];

// EXIF tags to write with the new date.
const TAGS_TO_WRITE = ['DateTimeOriginal', 'CreateDate'];

// EXIF date/time format: "YYYY:MM:DD HH:MM:SS"
const DATE_FORMAT = '%Y:%m:%d %H:%M:%S';

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^(0[1-9]|1[0-2])$/;

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.tif', '.tiff', '.png', '.webp', '.heic', '.heif',
  '.mov', '.mp4', '.avi', '.m4v', '.mkv',
]);

function printHelp() {
  console.log(`
Usage: node fix-photo-dates.js <root-folder> [--dry-run] [--verbose]

  Sets DateTimeOriginal and CreateDate of every image inside a
  <YEAR>/<MM>/ folder so the date matches the folder names, keeping
  the existing day and time.

Arguments:
  <root-folder>   Top-level folder containing the year folders.
                  Defaults to the current working directory.

Options:
  --dry-run, -n   Show what would be changed without writing anything.
  --verbose, -v   Print per-file details.
  --help, -h      Show this help.

Example:
  node fix-photo-dates.js ~/Pictures --dry-run
  node fix-photo-dates.js ~/Pictures
`);
}

function parseArgs(argv) {
  const opts = { root: null, dryRun: false, verbose: false };
  const args = argv.slice(2);

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-') && opts.root === null) {
      opts.root = arg;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!opts.root) opts.root = process.cwd();
  return opts;
}

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
function writeDate(filePath, newDate, dryRun) {
  if (dryRun) return;

  const args = ['-overwrite_original'];
  for (const tag of TAGS_TO_WRITE) {
    args.push(`-${tag}=${newDate}`);
  }
  args.push(filePath);

  execFileSync('exiftool', args, { encoding: 'utf8' });
}

/**
 * Recursively yield every file under `dir`.
 */
function* walkFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function processPhotos(root, opts) {
  const stats = { scanned: 0, changed: 0, skipped: 0, errors: 0 };

  for (const filePath of walkFiles(root)) {
    const ext = path.extname(filePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

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
      writeDate(filePath, newDate, false);
      stats.changed++;
      if (opts.verbose) console.log(`  OK`);
    } catch (err) {
      stats.errors++;
      console.error(`ERROR writing ${filePath}: ${err.message}`);
    }
  }

  return stats;
}

function main() {
  const opts = parseArgs(process.argv);
  checkExiftool();

  const root = path.resolve(opts.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Error: not a directory: ${root}`);
    process.exit(1);
  }

  if (opts.dryRun) console.log('[DRY-RUN] No files will be modified.\n');

  const stats = processPhotos(root, opts);

  console.log('\nDone.');
  console.log(`  Scanned: ${stats.scanned}`);
  console.log(`  Changed: ${stats.changed}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors:  ${stats.errors}`);
}

main();
