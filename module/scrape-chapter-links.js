// scrape-chapter-links.js
import { chromium } from 'playwright';
import fs from 'fs';

const mangaUrl = process.argv[2];
if (!mangaUrl) {
  console.error('Usage: node scrape-chapter-links.js <manga_series_url>');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  console.log(`Navigating to ${mangaUrl}`);
  await page.goto(mangaUrl, { waitUntil: 'networkidle' });

  // Extract chapter links
  const links = await page.$$eval('a', anchors =>
    anchors
      .filter(a => a.href.includes('/title/') && a.href.match(/ch_\d+/i))
      .map(a => a.href)
  );

  const uniqueLinks = [...new Set(links)].reverse();
  fs.writeFileSync('chapters.txt', uniqueLinks.join('\n'));
  console.log(`Saved ${uniqueLinks.length} chapter links to chapters.txt`);

  await browser.close();
})();
