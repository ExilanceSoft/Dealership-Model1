const express = require('express');
const router = express.Router();
const csvController = require('../controllers/csvController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

/**
 * @swagger
 * tags:
 *   name: CSV
 *   description: CSV import/export endpoints
 */

/**
 * @swagger
 * /api/v1/csv/export-template:
 *   get:
 *     summary: Export CSV template for models (Admin+)
 *     tags: [CSV]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [EV, ICE]
 *         description: Vehicle type (EV or ICE)
 *       - in: query
 *         name: branch_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     responses:
 *       200:
 *         description: CSV file downloaded
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid type or missing branch_id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.get('/export-template',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  csvController.exportCSVTemplate
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
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file to import
 *               type:
 *                 type: string
 *                 enum: [EV, ICE]
 *                 description: Vehicle type (EV or ICE)
 *               branch_id:
 *                 type: string
 *                 description: Branch ID
 *     responses:
 *       200:
 *         description: CSV imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 imported:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid CSV or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.post('/import',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  upload.single('file'),
  csvController.importCSV
);

module.exports = router;