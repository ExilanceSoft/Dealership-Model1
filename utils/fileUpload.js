const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');

// Use memory storage for direct buffer access
const storage = multer.memoryStorage();

// Enhanced file filter
const fileFilter = (req, file, cb) => {
  const filetypes = /\.(csv|txt)$/i; // Allow both .csv and .txt extensions
  const mimetypes = /text\/csv|text\/plain|application\/vnd.ms-excel/;

  const extname = filetypes.test(path.extname(file.originalname));
  const mimetype = mimetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only CSV files are allowed!'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Allow only 1 file
  }
}).single('file'); // Explicitly handle single file upload

module.exports = upload;