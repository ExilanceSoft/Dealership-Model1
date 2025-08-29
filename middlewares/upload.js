const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');

// Use memory storage for direct buffer access
const storage = multer.memoryStorage();

// Enhanced file filter for CSV, XLSX, and XLS files
const fileFilter = (req, file, cb) => {
  const filetypes = /\.(csv|xlsx|xls)$/i;
  
  // MIME types for different file formats
  const mimetypes = /text\/csv|text\/plain|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel\.sheet\.macroEnabled\.12|application\/vnd\.ms-excel\.sheet\.binary\.macroEnabled\.12/;

  const extname = filetypes.test(path.extname(file.originalname));
  const mimetype = mimetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  
  cb(new Error('Only CSV, XLSX, and XLS files are allowed!'));
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Allow only 1 file
  }
});

// Export the configured multer instance
module.exports = upload;