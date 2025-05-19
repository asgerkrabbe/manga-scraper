// image-scraper.js
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

const chapterListPath = 'chapters.txt';
const outputBase = 'chapters';
const pdfOutput = 'pdf-output';
fs.mkdirSync(outputBase, { recursive: true });
fs.mkdirSync(pdfOutput, { recursive: true });

const urls = fs.readFileSync(chapterListPath, 'utf-8')
  .split(/\r?\n/)
  .filter(Boolean);

const downloadImage = async (url, filepath) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}`);
    const buffer = await res.buffer();
    fs.writeFileSync(filepath, buffer);
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true }); // Use headless mode to reduce detection
  const page = await browser.newPage();

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\nProcessing Chapter ${i + 1}: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Scroll through the page to trigger lazy loading
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let totalHeight = 0;
          const distance = 200;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              setTimeout(resolve, 2000); // Wait for images to load
            }
          }, 100);
        });
      });

      // Wait for at least one manga image to load inside the image-items container
      await page.waitForSelector('div[name="image-items"] img', { timeout: 30000 });

      // Extract image URLs only from the manga image container, now including .webp
      const imgUrls = await page.$$eval('div[name="image-items"] img', imgs =>
        imgs
          .map(img => img.getAttribute('src'))
          .filter(src =>
            src &&
            (src.endsWith('.jpg') ||
             src.endsWith('.jpeg') ||
             src.endsWith('.png') ||
             src.endsWith('.webp'))
          )
      );

      console.log(`Found ${imgUrls.length} images.`);
      if (imgUrls.length === 0) {
        console.warn(`No images found for Chapter ${i + 1}. Skipping...`);
        continue;
      }

      const chapterDir = path.join(outputBase, `chapter_${i + 1}`);
      fs.mkdirSync(chapterDir, { recursive: true });

      const pdfDoc = await PDFDocument.create();

      for (let j = 0; j < imgUrls.length; j++) {
        const imgUrl = imgUrls[j];
        let ext = 'jpg';
        if (imgUrl.endsWith('.png')) ext = 'png';
        else if (imgUrl.endsWith('.webp')) ext = 'webp';
        const imgPath = path.join(chapterDir, `page_${j + 1}.${ext}`);
        console.log(`Downloading image ${j + 1}`);
        await downloadImage(imgUrl, imgPath);

        try {
          let imgBytes;
          let image;
          if (ext === 'webp') {
            // Convert webp to png in memory
            const pngBuffer = await sharp(imgPath).png().toBuffer();
            image = await pdfDoc.embedPng(pngBuffer);
          } else if (ext === 'png') {
            imgBytes = fs.readFileSync(imgPath);
            image = await pdfDoc.embedPng(imgBytes);
          } else {
            imgBytes = fs.readFileSync(imgPath);
            image = await pdfDoc.embedJpg(imgBytes);
          }
          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        } catch (error) {
          console.error(`Error embedding image ${j + 1} into PDF: ${error.message}`);
        }
      }

      const pdfBytes = await pdfDoc.save();
      const pdfPath = path.join(pdfOutput, `chapter_${i + 1}.pdf`);
      fs.writeFileSync(pdfPath, pdfBytes);
      console.log(`PDF saved to ${pdfPath}`);
    } catch (error) {
      console.error(`Error processing Chapter ${i + 1}: ${error.message}`);
    }
  }

  await browser.close();
  console.log('Scraping completed.');
})();