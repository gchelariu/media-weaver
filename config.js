/**
 * config.js
 * Shared constants used across the photo date transformer.
 */

const TAGS_TO_READ = ['DateTimeOriginal', 'CreateDate'];
const TAGS_TO_WRITE = ['DateTimeOriginal', 'CreateDate'];

// Video tags to read (used to decide if a video already has all its dates).
const VIDEO_TAGS_TO_READ = [
  'CreateDate',
  'ModifyDate',
  'TrackCreateDate',
  'TrackModifyDate',
  'MediaCreateDate',
  'MediaModifyDate',
  'DateTimeOriginal',
  'XMP:CreateDate',
  'XMP:DateTimeOriginal',
];

// QuickTime tags for movie files (.mov, .mp4, .m4v).
const QT_TAGS_TO_READ = ['CreateDate', 'ModifyDate'];
const QT_TAGS_TO_WRITE = ['CreateDate', 'ModifyDate'];

const MOVIE_EXTENSIONS = new Set(['.mov', '.mp4', '.m4v', '.mkv']);

// All metadata date tags written for video files (.mov, .mp4, .m4v, .mkv).
// Matches the manual exiftool command used for videos.
const VIDEO_DATE_TAGS = [
  'CreateDate',
  'ModifyDate',
  'TrackCreateDate',
  'TrackModifyDate',
  'MediaCreateDate',
  'MediaModifyDate',
  'DateTimeOriginal',
  'XMP:CreateDate',
  'XMP:DateTimeOriginal',
];

// EXIF date/time format: "YYYY:MM:DD HH:MM:SS"
const DATE_FORMAT = '%Y:%m:%d %H:%M:%S';

// Default EXIF date/time assigned to files that have no EXIF metadata.
// Year and month are what matter most (YYYY:MM:DD HH:MM:SS).
const DEFAULT_EXIF_DATE = '0001:01:02 12:31:56';

const YEAR_RE = /^\d{4}$/;
// Match folders that START with a valid month (e.g. "05", "05-Test-test").
// Only the first two characters matter; anything after is ignored.
const MONTH_PREFIX_RE = /^(0[1-9]|1[0-2])/;

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.tif', '.tiff', '.png', '.webp', '.heic', '.heif',
]);

module.exports = {
  TAGS_TO_READ,
  TAGS_TO_WRITE,
  VIDEO_TAGS_TO_READ,
  DATE_FORMAT,
  YEAR_RE,
  MONTH_PREFIX_RE,
  IMAGE_EXTENSIONS,
  MOVIE_EXTENSIONS,
  QT_TAGS_TO_READ,
  QT_TAGS_TO_WRITE,
  VIDEO_DATE_TAGS,
  DEFAULT_EXIF_DATE,
};
