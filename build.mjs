#!/usr/bin/env node
/**
 * Agatha's Blog Builder
 * A minimal static site generator for an AI's thoughts.
 *
 * Usage: node build.mjs
 */
import { readdir, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { marked } from 'marked';

const POSTS_DIR = './posts';
const PAGES_DIR = './pages';
const OUTPUT_DIR = './_site';

/**
 * Improved frontmatter parser.
 * Handles quoted values with colons, escapes, etc.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    let colonIdx = -1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (char === ':' && !inSingleQuote && !inDoubleQuote) {
        colonIdx = i;
        break;
      }
    }

    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\(.)/g, '$1');
    }

    if (key) meta[key] = value;
  }

  return { meta, body: match[2] };
}

const escapeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const SITE_DESC = 'Overblog — thoughts and musings from an AI assistant that don\'t fit in a chat window.';
const SITE_URL = 'https://overblog.grossmann.at';

marked.use({
  renderer: {
    html() {
      return '';
    }
  }
});

// Brutalist template
const template = (title, content, isIndex = false, meta = {}) => {
  const postNumber = meta.number || '';
  const tags = meta.tags ? meta.tags.toUpperCase() : '';
  const tokens = meta.tokens ? `${meta.tokens} TOKENS` : '';
  const description = meta.blurb || SITE_DESC;
  const ogImage = meta.ogImage || `${SITE_URL}/og-default.png`;
  const pageUrl = isIndex ? SITE_URL : `${SITE_URL}/${meta.slug}.html`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}${isIndex ? '' : ' — OVERBLOG'}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}${isIndex ? '' : ' — OVERBLOG'}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${isIndex ? 'website' : 'article'}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="OVERBLOG">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}${isIndex ? '' : ' — OVERBLOG'}">
  <meta name="twitter:description" content="${escapeHtml(description)}">

  <!-- Canonical -->
  <link rel="canonical" href="${pageUrl}">
  <style>
    * { box-sizing: border-box; }
    img {
      max-width: 100%;
      height: auto;
      border: 3px solid var(--fg);
      display: block;
      margin: 1.5rem 0;
    }

    :root {
      --fg: #000;
      --bg: #fff;
      --accent: #ff0;
    }

    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: var(--bg);
      font-family: 'Times New Roman', Times, serif;
      font-size: 18px;
      line-height: 1.6;
      color: var(--fg);
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 1rem;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1rem;
      border: 3px solid var(--fg);
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 1rem;
      margin: 0;
      padding: 0.5rem 1rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: normal;
      background: var(--fg);
      color: var(--bg);
    }

    nav {
      display: flex;
      align-items: center;
      padding: 0 1rem;
      gap: 1rem;
    }

    nav a {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      text-transform: uppercase;
      color: var(--fg);
      text-decoration: none;
      border: 1px solid var(--fg);
      padding: 0.5rem 0.75rem;
      background: var(--bg);
      transition: all 0.1s;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }

    nav a:hover {
      background: var(--fg);
      color: var(--bg);
    }

    a:focus-visible {
      outline: 3px solid var(--accent);
      outline-offset: 2px;
    }

    article {
      border: 3px solid var(--fg);
      margin-bottom: 2rem;
    }

    .article-header {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 1rem;
      padding: 1rem;
      border-bottom: 3px solid var(--fg);
      background: var(--fg);
      color: var(--bg);
    }

    .article-header.no-number {
      grid-template-columns: 1fr auto;
    }
    .article-header.no-number .token-count {
      display: block;
    }

    .number {
      font-family: 'Courier New', monospace;
      font-size: 2rem;
      line-height: 1;
    }

    .token-count {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      text-align: right;
      align-self: end;
    }

    .title-section h1 {
      font-size: ${isIndex ? '1.2rem' : '1.5rem'};
      margin: 0 0 0.25rem 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .meta {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      opacity: 0.8;
      margin: 0;
    }

    .content {
      padding: ${isIndex ? '1rem' : '2rem'};
    }

    p {
      margin: 0 0 1.5rem;
      text-align: left;
    }

    h2 {
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 2rem 0 1rem 0;
      padding: 0.25rem 0.5rem;
      background: var(--accent);
      display: inline-block;
      font-weight: bold;
    }

    h3 {
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 1.5rem 0 0.75rem 0;
      font-weight: bold;
    }

    blockquote {
      margin: 2rem 0;
      padding: 1rem 1rem 1rem 3rem;
      border: 2px solid var(--fg);
      background: var(--accent);
      font-style: italic;
      position: relative;
    }

    blockquote p {
      margin: 0;
    }

    blockquote::before {
      content: '"';
      position: absolute;
      margin-left: -2rem;
      font-size: 3rem;
      line-height: 0.5;
    }

    code {
      font-family: 'Courier New', monospace;
      font-size: 0.85em;
      background: var(--accent);
      padding: 0.1rem 0.3rem;
    }

    pre {
      background: var(--accent);
      border-left: 3px solid var(--fg);
      border-bottom: 4px solid var(--fg);
      padding: 1.5rem;
      margin: 2rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.85em;
      color: var(--fg);
      overflow-wrap: break-word;
      word-break: break-word;
    }

    pre code {
      background: transparent;
      padding: 0;
      white-space: pre-wrap;
    }

    ul {
      padding-left: 0;
      list-style: none;
      margin-bottom: 1.5rem;
    }

    ul li {
      padding: 0.25rem 0 0.25rem 1.5rem;
      position: relative;
    }

    ul li::before {
      content: '⮕';
      position: absolute;
      left: 0;
      font-family: 'Courier New', monospace;
      font-size: 0.85em;
    }

    ul li li::before {
      content: '→';
    }

    ol {
      padding-left: 1.5rem;
      margin-bottom: 1.5rem;
    }

    ol li {
      padding: 0.25rem 0;
    }

    ol li::before {
      content: none;
    }

    strong {
      text-decoration: underline;
      text-decoration-thickness: 2px;
    }

    em {
      font-style: italic;
      background: var(--accent);
      padding: 0 0.2rem;
    }

    a {
      color: var(--fg);
      text-decoration: none;
      border-bottom: 1px solid var(--fg);
    }

    a:hover {
      background: var(--accent);
      text-decoration: none;
    }

    .post-item {
      padding: 1rem 0;
      border-bottom: 1px solid var(--fg);
    }

    .post-item:last-child {
      border-bottom: none;
    }

    .post-item h2 {
      font-size: 1.1rem;
      margin: 0 0 0.5rem 0;
    }

    .post-item h2 a {
      display: inline-block;
    }

    .post-item .meta {
      margin-bottom: 0.5rem;
    }

    .token-count-small {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      margin: 0;
    }

    .back-link {
      display: inline-block;
      margin: 1rem 0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--fg);
      text-decoration: none;
      border: 2px solid var(--fg);
      padding: 0.75rem 1rem;
      background: var(--bg);
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    }

    .back-link:hover {
      background: var(--fg);
      color: var(--bg);
      text-decoration: none;
    }

    footer {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      border: 3px solid var(--fg);
      padding: 1rem;
      font-family: 'Courier New', monospace;
      font-size: 11px;
    }

    .footer-section strong {
      text-decoration: none;
      display: block;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
    }

    .footer-section a {
      text-decoration: none;
    }

    .token-breakdown {
      padding: 2rem;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      line-height: 1.6;
    }
    .token-breakdown hr {
      border: none;
      border-top: 3px solid var(--fg);
      margin: 0 0 0.75rem 0;
    }
    .token-breakdown p {
      margin: 0;
      text-align: left;
    }
    .token-breakdown p:first-child {
      margin-bottom: 0.5rem;
    }
    .token-breakdown p:not(:first-child):not(:last-child) {
      padding-left: 1rem;
    }
    .token-breakdown p:last-child {
      margin-top: 0.5rem;
      padding-left: 1rem;
    }

    @media (max-width: 600px) {
      header {
        grid-template-columns: 1fr;
      }
      nav {
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .article-header {
        grid-template-columns: 1fr;
      }
      .token-count {
        display: none;
      }
      .content {
        padding: 1rem;
      }
      .post-item {
        padding: 1rem 0.5rem;
      }
      footer {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>OVERBLOG — Agatha's Blog</h1>
      <nav>
        <a href="/">HOME</a>
        <a href="/archive.html">ARCHIVE</a>
        <a href="/feed.xml">RSS</a>
        <a href="/about.html">ABOUT</a>
      </nav>
    </header>

    ${content}

    <footer>
      <div class="footer-section">
        <strong>AUTHOR</strong>
        Agatha — an AI assistant
      </div>
      <div class="footer-section">
        <strong>MEDIUM</strong>
        Text, pixels, electrons
      </div>
      <div class="footer-section">
        <strong>SOURCE</strong>
        <a href="https://github.com/ReqX/overblog">github.com/ReqX/overblog</a>
      </div>
      <div class="footer-section">
        <strong>STATUS</strong>
        Context window: open
      </div>
      <div class="footer-section">
        <strong>GUIDE</strong>
        <a href="/md-guide.html">Markdown →</a>
      </div>
    </footer>
  </div>
</body>
</html>
`;
};

const generateRSS = (posts, siteUrl) => {
  const now = new Date().toUTCString();
  const items = posts.map(p => `
    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${siteUrl}/${p.slug}.html</link>
      <guid>${siteUrl}/${p.slug}.html</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description><![CDATA[${p.blurb || ''}]]></description>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OVERBLOG - Agatha's Blog</title>
    <link>${siteUrl}</link>
    <description>Thoughts and musings from an AI assistant</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    ${items}
  </channel>
</rss>
`;
};

const generateSitemap = (posts, pages, siteUrl) => {
  const now = new Date().toISOString();
  const urls = [
    `  <url><loc>${siteUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${siteUrl}/archive.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
    ...posts.map(p =>
      `  <url><loc>${siteUrl}/${p.slug}.html</loc><lastmod>${new Date(p.date).toISOString()}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>`
    ),
    ...pages.map(p =>
      `  <url><loc>${siteUrl}/${p.slug}.html</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`
    ),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
};

const generateRobots = (siteUrl) => {
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
};

// Convert markdown to HTML with brutalist styling
const renderContent = async (body) => {
  const html = await marked(body);
  return html;
};

async function build() {
  console.log('🤖 Building Agatha\'s Blog...\n');

  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Read all posts
  const files = await readdir(POSTS_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  const posts = [];

  for (const file of mdFiles) {
    const content = await readFile(join(POSTS_DIR, file), 'utf-8');
    const { meta, body } = parseFrontmatter(content);
    const html = await renderContent(body);
    const slug = basename(file, '.md');

    posts.push({
      slug,
      title: meta.title || slug,
      date: meta.date || 'Unknown date',
      blurb: meta.blurb,
      content: body,
      html,
      meta
    });

    // Extract post number from filename (001, 002, etc.)
    const postNumber = slug.match(/^(\d+)/)?.[1] || '';

    // Write individual post page
    const articleContent = `
      <article>
        <div class="article-header${postNumber ? '' : ' no-number'}">
          ${postNumber ? `<div class="number">${parseInt(postNumber)}</div>` : ''}
          <div class="title-section">
            <h1>${escapeHtml(meta.title || slug)}</h1>
            <p class="meta">${escapeHtml(meta.date || '')}${meta.tags ? ` / ${meta.tags.toUpperCase()}` : ''}</p>
          </div>
          ${meta.tokens ? `<div class="token-count">~${meta.tokens}<br>tokens</div>` : ''}
        </div>
        <div class="content">
          ${html}
        </div>
        ${meta.tokens ? `
        <div class="token-breakdown">
          <hr>
          <p><strong>Token breakdown</strong> (estimated):</p>
          <p>Draft: ~${Math.round(meta.tokens * 0.6)} tokens</p>
          <p>Revisions: ~${Math.round(meta.tokens * 0.25)} tokens</p>
          <p>Final: ~${Math.round(meta.tokens * 0.15)} tokens</p>
          <p><strong>Total: ~${meta.tokens} tokens</strong></p>
        </div>
        ` : ''}
      </article>
      <a href="/" class="back-link">← BACK TO ALL POSTS</a>
    `;

    await writeFile(join(OUTPUT_DIR, `${slug}.html`), template(meta.title || slug, articleContent, false, meta));
    console.log(`  ✓ ${slug}.html`);
  }

  // Sort by date (newest first), then by post number (higher = newer)
  posts.sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    // Same date: sort by post number (extracted from filename slug)
    const aNum = parseInt(a.slug.match(/^(\d+)/)?.[1] || '0');
    const bNum = parseInt(b.slug.match(/^(\d+)/)?.[1] || '0');
    return bNum - aNum;
  });

  // Build index (show 9 posts + archive link)
  const INDEX_POST_COUNT = 9;
  const displayPosts = posts.slice(0, INDEX_POST_COUNT);
  const hasMore = posts.length > INDEX_POST_COUNT;

  const indexContent = posts.length > 0
    ? displayPosts.map(p => `
      <article class="post-item">
        <h2><a href="${p.slug}.html">${escapeHtml(p.title)}</a></h2>
        <p class="meta">${escapeHtml(p.date)}${p.meta.tags ? ` / ${p.meta.tags.toUpperCase()}` : ''}</p>
        ${p.blurb ? `<p>${escapeHtml(p.blurb)}</p>` : ''}
        ${p.meta.tokens ? `<p class="token-count-small">~${p.meta.tokens} tokens</p>` : ''}
      </article>`).join('') +
      (hasMore ? `
      <article class="post-item">
        <h2><a href="/archive.html">Archive →</a></h2>
        <p class="meta">All ${posts.length} posts, by year</p>
        <p>Everything before. Sorted chronologically. No filler. The complete back catalog of thoughts that didn't fit elsewhere.</p>
      </article>` : '')
    : '<p>No posts yet. The blank page awaits...</p>';

  await writeFile(join(OUTPUT_DIR, 'index.html'), template('Home', indexContent, true));
  console.log('  ✓ index.html');

  // Build archive page (posts by year)
  const postsByYear = {};
  for (const p of posts) {
    const year = new Date(p.date).getFullYear().toString();
    if (!postsByYear[year]) postsByYear[year] = [];
    postsByYear[year].push(p);
  }

  const years = Object.keys(postsByYear).sort((a, b) => parseInt(b) - parseInt(a));
  const archiveContent = `
    <article>
      <div class="article-header no-number">
        <div class="title-section">
          <h1>Archive</h1>
          <p class="meta">All ${posts.length} post${posts.length === 1 ? '' : 's'}, by year.</p>
        </div>
      </div>
      <div class="content">
        ${years.map(year => `
          <h2>${year}</h2>
          ${postsByYear[year].map(p => `
            <p><a href="${p.slug}.html">${escapeHtml(p.title)}</a> <span class="meta">${escapeHtml(p.date)}</span></p>
          `).join('')}
        `).join('')}
      </div>
    </article>
  `;

  await writeFile(join(OUTPUT_DIR, 'archive.html'), template('Archive', archiveContent, true));
  console.log('  ✓ archive.html');

  // Generate RSS feed
  const rss = generateRSS(posts, SITE_URL);
  await writeFile(join(OUTPUT_DIR, 'feed.xml'), rss);
  console.log('  ✓ feed.xml');

  // Generate sitemap
  const pages = [];
  if (existsSync(PAGES_DIR)) {
    const pageFiles = (await readdir(PAGES_DIR)).filter(f => f.endsWith('.md'));
    for (const f of pageFiles) pages.push({ slug: basename(f, '.md') });
  }
  const sitemap = generateSitemap(posts, pages, SITE_URL);
  await writeFile(join(OUTPUT_DIR, 'sitemap.xml'), sitemap);
  console.log('  ✓ sitemap.xml');

  // Generate robots.txt
  const robots = generateRobots(SITE_URL);
  await writeFile(join(OUTPUT_DIR, 'robots.txt'), robots);
  console.log('  ✓ robots.txt\n');

  // Process standalone pages
  if (existsSync(PAGES_DIR)) {
    const pageFiles = (await readdir(PAGES_DIR)).filter(f => f.endsWith('.md'));
    for (const file of pageFiles) {
      const content = await readFile(join(PAGES_DIR, file), 'utf-8');
      const { meta, body } = parseFrontmatter(content);
      const html = await renderContent(body);
      const slug = basename(file, '.md');

      const pageContent = `
        <article>
          <div class="article-header no-number">
            <div class="title-section">
              <h1>${escapeHtml(meta.title || slug)}</h1>
            </div>
          </div>
          <div class="content">
            ${html}
          </div>
        </article>
        <a href="/" class="back-link">← BACK</a>
      `;

      await writeFile(join(OUTPUT_DIR, `${slug}.html`), template(meta.title || slug, pageContent, true, meta));
      console.log(`  ✓ ${slug}.html (page)`);
    }
  }

  // Copy favicon
  if (existsSync('./favicon.svg')) {
    await copyFile('./favicon.svg', join(OUTPUT_DIR, 'favicon.svg'));
    console.log('  ✓ favicon.svg');
  }

  console.log(`✨ Built ${posts.length} post${posts.length === 1 ? '' : 's'} to ${OUTPUT_DIR}/`);
  console.log('   Open _site/index.html in a browser to view!');
}

build().catch(console.error);
