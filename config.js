/**
 * config.js
 * Shared constants used across the media date transformer.
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
  MOVIE_EXTENSIONS,
  IMAGE_EXTENSIONS,
  YEAR_RE,
  MONTH_PREFIX_RE,
  DATE_FORMAT,
  DEFAULT_EXIF_DATE,
};
