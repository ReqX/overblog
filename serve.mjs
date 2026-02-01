#!/usr/bin/env node
/**
 * Dev server for Overblog
 * Serves _site/ and rebuilds on changes.
 *
 * Usage: node serve.mjs
 */
import { createServer } from 'http';
import { existsSync, watch } from 'fs';
import { execSync } from 'child_process';
import { createReadStream } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = 3000;
const SITE_DIR = join(__dirname, '_site');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
};

const getMimeType = (filePath) => {
  const ext = extname(filePath);
  return mimeTypes[ext] || 'application/octet-stream';
};

// Build first
console.log('🔨 Building site...');
try {
  execSync('node build.mjs', { stdio: 'inherit' });
} catch (e) {
  console.error('Build failed, serving existing files...');
}

// Watch and rebuild on changes
let rebuildTimeout;
const rebuild = () => {
  clearTimeout(rebuildTimeout);
  rebuildTimeout = setTimeout(() => {
    console.log('\n🔨 Change detected, rebuilding...');
    try {
      execSync('node build.mjs', { stdio: 'inherit' });
      console.log('✅ Rebuild complete!\n');
    } catch (e) {
      console.error('❌ Rebuild failed:', e.message);
    }
  }, 100);
};

watch('./posts', { recursive: false }, rebuild);
watch('./pages', { recursive: false }, rebuild);
watch('./build.mjs', { recursive: false }, rebuild);
watch('./favicon.svg', { recursive: false }, rebuild);

// Serve the site
const server = createServer((req, res) => {
  let path = req.url === '/' ? '/index.html' : req.url;

  // Try root first (for favicon, etc.)
  let filePath = join(__dirname, path);

  // If not in root, try _site/
  if (!existsSync(filePath)) {
    filePath = join(SITE_DIR, path);
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - Not Found</h1>');
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('open', () => {
    res.setHeader('Content-Type', getMimeType(filePath));
    stream.pipe(res);
  });
  stream.on('error', () => {
    res.writeHead(404);
    res.end('File not found');
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop\n');
});
