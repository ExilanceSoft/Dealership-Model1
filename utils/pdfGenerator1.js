const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const generatePDFFromHtml = async (html) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        return pdfBuffer;
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

module.exports = {
    generatePDFFromHtml
};