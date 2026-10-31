#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DEFAULT_EXIF_DATE } = require('../config');
const {
  isKnownExifStructureError,
  readTagValue,
} = require('../exif');
const { computeNewDate, fileModifyDateMatches } = require('../processor');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('resolves ExifTool group-qualified XMP tag keys', () => {
  const metadata = {
    'XMP-xmp:CreateDate': '2014:05:29 11:37:31',
    'XMP-exif:DateTimeOriginal': '2014:05:29 11:37:31',
  };
  assert.strictEqual(readTagValue(metadata, 'XMP:CreateDate'), '2014:05:29 11:37:31');
  assert.strictEqual(readTagValue(metadata, 'XMP:DateTimeOriginal'), '2014:05:29 11:37:31');
});

test('rejects conflicting duplicate track date values', () => {
  const metadata = {
    'Track1:TrackCreateDate': '2014:05:29 11:37:31',
    'Track2:TrackCreateDate': '2014:05:29 11:37:32',
  };
  assert.strictEqual(readTagValue(metadata, 'TrackCreateDate'), undefined);
});

test('only enables EXIF wipe fallback for known structure corruption', () => {
  assert.strictEqual(isKnownExifStructureError(new Error('Bad OtherImageStart data')), true);
  assert.strictEqual(isKnownExifStructureError(new Error('Permission denied')), false);
  assert.strictEqual(isKnownExifStructureError(new Error('Unsupported file type')), false);
});

test('preserves existing day/time while replacing folder year/month', () => {
  const existing = { day: '29', time: '11:37:31' };
  assert.strictEqual(computeNewDate(existing, '2024', '05'), '2024:05:29 11:37:31');
});

test('uses configured default day/time when no date exists', () => {
  const [date, time] = DEFAULT_EXIF_DATE.split(' ');
  const [, , day] = date.split(':');
  assert.strictEqual(computeNewDate(null, '2024', '05'), `2024:05:${day} ${time}`);
});

test('FileModifyDate comparison matches local filesystem time to second', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'media-weaver-test-'));
  const filePath = path.join(directory, 'mtime-fixture');
  try {
    fs.writeFileSync(filePath, 'fixture');
    const expected = new Date(2014, 4, 29, 11, 37, 31);
    fs.utimesSync(filePath, expected, expected);
    assert.strictEqual(fileModifyDateMatches(filePath, '2014:05:29 11:37:31'), true);
    assert.strictEqual(fileModifyDateMatches(filePath, '2014:05:29 11:37:32'), false);
  } finally {
    fs.unlinkSync(filePath);
    fs.rmdirSync(directory);
  }
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}: ${err.stack || err.message}`);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} tests passed`);
process.exitCode = failures ? 1 : 0;
