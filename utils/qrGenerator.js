const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const generateQRCode = async (data, bookingNumber) => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', 'qr-codes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate file name
    const fileName = `qr-${bookingNumber}-${Date.now()}.png`;
    const filePath = path.join(uploadDir, fileName);

    // Generate QR code and save to file
    await QRCode.toFile(filePath, data, {
      color: {
        dark: '#000000',  // Black dots
        light: '#ffffff' // White background
      },
      width: 300,
      margin: 2
    });

    return `/uploads/qr-codes/${fileName}`;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
};

module.exports = { generateQRCode };