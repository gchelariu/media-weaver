# Media Weaver

Media Weaver synchronizes image and video date metadata with a `YEAR/MM` folder structure. It preserves the existing day and time while replacing the year and month from the containing folders. Files without a usable date receive the configured default day and time.

For images, it writes `DateTimeOriginal`, `CreateDate`, and `ModifyDate`. For videos, it writes the configured QuickTime and XMP date tags. Both file types also get an operating-system `FileModifyDate` matching the target date. Files are skipped only when all configured metadata dates and `FileModifyDate` already match.

## Requirements

- Node.js 14 or newer
- ExifTool installed and available on `PATH`

## Run from the repository

```bash
node main.js /path/to/photos --dry-run
node main.js /path/to/photos --verbose
```

The tool looks for files directly inside folders shaped like `<root>/<YEAR>/<MM...>/`. A month folder may have a suffix, such as `05-Holiday`; only its first two characters are used.

Options:

- `--dry-run`, `-n`: report files that would be changed without writing
- `--verbose`, `-v`: print details for each processed media file
- `--help`, `-h`: show CLI help

## Install the `mweaver` command

Install the package from its local checkout so npm can create the command shim:

```bash
npm install --global /path/to/media-weaver
mweaver /path/to/photos --dry-run
```

Alternatively, run `./mweaver` from the repository. Do not copy the wrapper by itself: it expects `main.js` beside it.

## Tests

```bash
npm test
```

For an integration smoke test against your own media collection, run the CLI with `--dry-run`; this checks metadata reads and proposed changes without writing files.

## Optional web UI

The UI is a separate Express app in `UI/`:

```bash
cd UI
npm install
npm start
```

Then open `http://localhost:3000`.
