/**
 * config.js
 * Shared constants used across the photo date transformer.
 */

const TAGS_TO_READ = ['DateTimeOriginal', 'CreateDate'];
const TAGS_TO_WRITE = ['DateTimeOriginal', 'CreateDate'];

// EXIF date/time format: "YYYY:MM:DD HH:MM:SS"
const DATE_FORMAT = '%Y:%m:%d %H:%M:%S';

// Default EXIF date/time assigned to files that have no EXIF metadata.
// Year and month are what matter most (YYYY:MM:DD HH:MM:SS).
const DEFAULT_EXIF_DATE = '0001:01:01 01:00:00';

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^(0[1-9]|1[0-2])$/;

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.tif', '.tiff', '.png', '.webp', '.heic', '.heif',
  '.mov', '.mp4', '.avi', '.m4v', '.mkv',
]);

module.exports = {
  TAGS_TO_READ,
  TAGS_TO_WRITE,
  DATE_FORMAT,
  YEAR_RE,
  MONTH_RE,
  IMAGE_EXTENSIONS,
  DEFAULT_EXIF_DATE,
};
