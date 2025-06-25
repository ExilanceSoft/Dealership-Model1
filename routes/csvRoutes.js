const express = require('express');
const router = express.Router();
const csvController = require('../controllers/csvController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const multer = require('multer'); // Add multer import

/**
 * @swagger
 * tags:
 *   name: CSV
 *   description: CSV import/export endpoints
 */

// Error handling wrapper for async middleware
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @swagger
 * /api/v1/csv/export-template:
 *   get:
 *     summary: Export CSV template for models (Admin+)
 *     tags: [CSV]
 *     security:
 *       - bearerAuth: []
 */
router.get('/export-template',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  asyncHandler(csvController.exportCSVTemplate)
);

/**
 * @swagger
 * /api/v1/csv/import:
 *   post:
 *     summary: Import models from CSV (Admin+)
 *     tags: [CSV]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 */
router.post('/import',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  upload.single('file'), // Use .single() here instead of calling upload directly
  asyncHandler(csvController.importCSV)
);

module.exports = router;