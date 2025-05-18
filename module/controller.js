// image-scraper.js
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';

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

    // Validate if the file is a JPEG or PNG
    const isJpeg = buffer.slice(0, 2).equals(Buffer.from([0xff, 0xd8])); // JPEG magic number
    const isPng = buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); // PNG magic number

    if (!isJpeg && !isPng) {
      throw new Error(`Invalid image file: ${url}`);
    }

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

      // Wait for images to load
      await page.waitForSelector('img[src]', { timeout: 10000 });

      // Extract image URLs, excluding those inside divs with name="comment-post"
      const imgUrls = await page.$$eval('img', imgs =>
        imgs
          .filter(img => {
            let parent = img.parentElement;
            while (parent) {
              if (parent.getAttribute && parent.getAttribute('name') === 'comment-post') {
                return false; // Exclude images inside comment-post divs
              }
              parent = parent.parentElement;
            }
            return true;
          })
          .map(img => img.getAttribute('src'))
          .filter(src => src && (src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.png')))
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
        const imgPath = path.join(chapterDir, `page_${j + 1}.${imgUrl.endsWith('.png') ? 'png' : 'jpg'}`);
        console.log(`Downloading image ${j + 1}`);
        await downloadImage(imgUrl, imgPath);

        try {
          const imgBytes = fs.readFileSync(imgPath);
          let image;
          if (imgUrl.endsWith('.png')) {
            image = await pdfDoc.embedPng(imgBytes); // Embed PNG
          } else {
            image = await pdfDoc.embedJpg(imgBytes); // Embed JPEG
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