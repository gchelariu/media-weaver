/**
 * server.js
 * Tiny Express web server for the Photo Date Fixer UI.
 *
 * Serves index.html and exposes a POST /run endpoint that spawns
 * the existing Node CLI (main.js) as a child process and returns
 * its output and summary stats to the browser.
 */

const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.resolve(__dirname, '..');

app.use(express.json());

// Serve the UI page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Run the photo date fixer CLI
app.post('/run', (req, res) => {
  const { root, dryRun, verbose } = req.body;

  if (!root) {
    return res.status(400).json({ error: 'root folder is required' });
  }

  // Build the exact same command you'd run by hand:
  // node main.js [--dry-run] [--verbose] <root>
  const args = [path.join(PROJECT_ROOT, 'main.js')];
  if (dryRun) args.push('--dry-run');
  if (verbose) args.push('--verbose');
  args.push(root);

  const child = spawn('node', args, { cwd: PROJECT_ROOT });

  let output = '';

  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  child.on('close', (code) => {
    // Try to parse the summary stats from the CLI output so the UI can show them nicely
    const stats = {};
    const scanned = output.match(/Scanned:\s*(\d+)/);
    const changed = output.match(/Changed:\s*(\d+)/);
    const skipped = output.match(/Skipped:\s*(\d+)/);
    const errors = output.match(/Errors:\s*(\d+)/);
    if (scanned) stats.scanned = parseInt(scanned[1], 10);
    if (changed) stats.changed = parseInt(changed[1], 10);
    if (skipped) stats.skipped = parseInt(skipped[1], 10);
    if (errors) stats.errors = parseInt(errors[1], 10);

    res.json({
      code,
      output,
      stats: Object.keys(stats).length ? stats : null
    });
  });

  child.on('error', (err) => {
    res.status(500).json({ error: err.message, output });
  });
});

app.listen(PORT, () => {
  console.log(`UI server running at http://localhost:${PORT}`);
});
