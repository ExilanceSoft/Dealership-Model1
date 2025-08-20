const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const generatePDFFromHtml = async (html) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ],
            ignoreHTTPSErrors: true,
            timeout: 30000
        });

        const page = await browser.newPage();
        
        await page.setViewport({
            width: 1200,
            height: 800,
            deviceScaleFactor: 1
        });

        await page.setContent(html, {
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 30000
        });

        // Replace waitForTimeout with this:
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            preferCSSPageSize: true
        });

        return pdfBuffer;
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close().catch(e => console.error('Error closing browser:', e));
        }
    }
};

module.exports = {
    generatePDFFromHtml
};