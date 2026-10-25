#!/usr/bin/env node
/**
 * main.js
 * CLI entry point: parse arguments, check exiftool, run the processor,
 * and print a summary.
 */

const fs = require('fs');
const path = require('path');
const { checkExiftool } = require('./exif');
const { processMedia } = require('./processor');

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

function main() {
  const opts = parseArgs(process.argv);
  checkExiftool();

  const root = path.resolve(opts.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`Error: not a directory: ${root}`);
    process.exit(1);
  }

  if (opts.dryRun) console.log('[DRY-RUN] No files will be modified.\n');

  const stats = processMedia(root, opts);

  console.log('\nDone.');
  console.log(`  Scanned: ${stats.scanned}`);
  console.log(`  Changed: ${stats.changed}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors:  ${stats.errors}`);
}

main();
