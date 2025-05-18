// scrape-chapter-links.js
import { chromium } from 'playwright';
import fs from 'fs';

const mangaUrl = process.argv[2];
if (!mangaUrl) {
  console.error('Usage: node scrape-chapter-links.js <manga_series_url>');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true }); // Use headless mode to reduce detection
  const page = await browser.newPage();
  console.log(`Navigating to ${mangaUrl}`);
  await page.goto(mangaUrl, { waitUntil: 'networkidle' });

  // Extract chapter links
  const links = await page.$$eval('a', anchors =>
    anchors
      .filter(a => a.href.includes('/title/') && a.href.match(/ch_\d+/i))
      .map(a => a.href)
  );

  // Sort links by chapter number (numerically)
  const sortedLinks = [...new Set(links)].sort((a, b) => {
    const getChapterNum = href => {
      const match = href.match(/ch_(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    };
    return getChapterNum(a) - getChapterNum(b);
  }).map(link =>
    link.includes('?') ? `${link}&load=2` : `${link}?load=2`
  );

  fs.writeFileSync('chapters.txt', sortedLinks.join('\n'));
  console.log(`Saved ${sortedLinks.length} chapter links to chapters.txt`);

  await browser.close();
})();
