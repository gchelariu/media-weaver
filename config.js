/**
 * config.js
 * Shared constants used across the photo date transformer.
 * 
 * Primary arrays (only 2):
 *   - IMAGE_DATE_TAGS: used for images skip logic and writing
 *   - VIDEO_DATE_TAGS: used for videos skip logic and writing
 *
 * Derived arrays reference the primary ones to avoid duplication.
 */

// Single list of image date tags - used for skip logic and writing.
// If all tags in this array already match the target date, the image is skipped.
const IMAGE_DATE_TAGS = ['DateTimeOriginal', 'CreateDate', 'ModifyDate'];

// Single list of video date tags - used for skip logic and writing.
// If all tags in this array already match the target date, the video is skipped.
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

// Derived: tags to write for images (same reference as IMAGE_DATE_TAGS)
// This ensures writeDate() writes exactly the tags we check for skipping.
const TAGS_TO_WRITE = IMAGE_DATE_TAGS;

// Derived: tags to read from EXIF for images.
// We use first 2 tags from IMAGE_DATE_TAGS (DateTimeOriginal, CreateDate)
// because ModifyDate is metadata that's a side-effect of writeDate().
const TAGS_TO_READ = IMAGE_DATE_TAGS.slice(0, 2);

// Derived: QuickTime tags - just CreateDate and ModifyDate from the primary lists.
// We take tags 1 and 2 from IMAGE_DATE_TAGS (skipping DateTimeOriginal at index 0).
const QT_TAGS_TO_READ = VIDEO_DATE_TAGS.slice(1);  // ['CreateDate', 'ModifyDate']
const QT_TAGS_TO_WRITE = VIDEO_DATE_TAGS.slice(1); // ['CreateDate', 'ModifyDate']

const MOVIE_EXTENSIONS = new Set(['.mov', '.mp4', '.m4v', '.mkv']);

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.tif', '.tiff', '.png', '.webp', '.heic', '.heif',
]);

const YEAR_RE = /^\d{4}$/;
const MONTH_PREFIX_RE = /^(0[1-9]|1[0-2])/;

const DATE_FORMAT = '%Y:%m:%d %H:%M:%S';
const DEFAULT_EXIF_DATE = '0001:01:02 12:31:56';

module.exports = {
  IMAGE_DATE_TAGS,
  VIDEO_DATE_TAGS,
  TAGS_TO_WRITE,
  TAGS_TO_READ,
  QT_TAGS_TO_READ,
  QT_TAGS_TO_WRITE,
  MOVIE_EXTENSIONS,
  IMAGE_EXTENSIONS,
  YEAR_RE,
  MONTH_PREFIX_RE,
  DATE_FORMAT,
  DEFAULT_EXIF_DATE,
};