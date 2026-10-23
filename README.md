- Day (15) and time (14:30:00) preserved; year/month taken from folders
- Invalid month folders (13) and non-month dirs (notamonth) skipped
- Files with no EXIF date skipped
- Re-run skips already-correct files
- --dry-run, --verbose, --help all work

Entry point:
node main.js /path/to/photos --dry-run --verbose
node main.js /path/to/photos --verbose


How to run UI

cd UI
npm install            # (or corepack npm install) — only needed once
node server.js         # or: npm start
Then open http://localhost:3000 in your browser, paste your photos folder path, toggle options, and hit Run.