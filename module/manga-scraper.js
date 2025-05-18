// manga-scraper.js
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';

const chapterUrl = process.argv[2];
if (!chapterUrl) {
    console.error('Usage: node manga-scraper.js <chapter_url>');
    process.exit(1);
}

const downloadImage = async (url, filepath) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}`);
    const buffer = await res.buffer();
    fs.writeFileSync(filepath, buffer);
};

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    console.log(`Navigating to ${chapterUrl}`);
    await page.goto(chapterUrl, { waitUntil: 'networkidle' });

    // Scroll to ensure lazy-loaded images are loaded
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });

    const imgUrls = await page.$$eval('img', imgs =>
        imgs.map(img => img.src).filter(src => src && src.includes('/manga/'))
    );

    console.log(`Found ${imgUrls.length} images.`);

    const outputDir = './downloads';
    fs.mkdirSync(outputDir, { recursive: true });

    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < imgUrls.length; i++) {
        const url = imgUrls[i];
        const imgPath = path.join(outputDir, `page_${i + 1}.jpg`);
        console.log(`Downloading page ${i + 1}...`);
        await downloadImage(url, imgPath);

        const imgBytes = fs.readFileSync(imgPath);
        const img = await pdfDoc.embedJpg(imgBytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('chapter.pdf', pdfBytes);
    console.log('PDF saved as chapter.pdf');

    await browser.close();
})();
