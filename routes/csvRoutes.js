const express = require('express');
const router = express.Router();
const csvController = require('../controllers/csvController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

/**
 * @swagger
 * tags:
 *   name: CSV
 *   description: CSV import/export operations for vehicle models
 */

/**
 * @swagger
 * /api/v1/csv/export-template:
 *   get:
 *     summary: Export CSV template for vehicle models
 *     description: |
 *       Exports a CSV template containing all active models of specified type (EV/ICE/CSD) for a branch.
 *       Requires ADMIN or SUPERADMIN privileges.
 *     tags: [CSV]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EV, ICE, CSD]
 *           example: EV
 *         required: true
 *         description: Vehicle type (Electric Vehicle, Internal Combustion Engine, or Commercial Service Diesel)
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *           format: ObjectId
 *           example: 507f1f77bcf86cd799439011
 *         required: true
 *         description: ID of the branch to export data for
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *             description: Filename for the downloaded CSV
 *       400:
 *         description: Bad request (invalid type or missing branch_id)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Internal server error
 */
router.get('/export-template',
  protect,
  authorize('ADMIN', 'SUPERADMIN','SALES_EXECUTIVE'),
  csvController.exportCSVTemplate
);

/**
 * @swagger
 * /api/v1/csv/import:
 *   post:
 *     summary: Import vehicle models from CSV
 *     description: |
 *       Imports vehicle model data from a CSV file.
 *       Updates existing models or creates new ones.
 *       Requires ADMIN or SUPERADMIN privileges.
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
 *             required:
 *               - file
 *               - type
 *               - branch_id
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file to import
 *               type:
 *                 type: string
 *                 enum: [EV, ICE, CSD]
 *                 example: EV
 *                 description: Vehicle type (EV, ICE or CSD)
 *               branch_id:
 *                 type: string
 *                 format: ObjectId
 *                 example: 507f1f77bcf86cd799439011
 *                 description: ID of the branch to import data to
 *     responses:
 *       200:
 *         description: CSV import completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: CSV import completed
 *                 imported:
 *                   type: integer
 *                   description: Number of successfully processed models
 *                   example: 15
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array of error messages (if any)
 *       400:
 *         description: Bad request (invalid file, missing fields, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Branch not found
 *       413:
 *         description: File too large (max 5MB)
 *       415:
 *         description: Unsupported media type (not CSV)
 *       500:
 *         description: Internal server error
 */
router.post('/import',
  protect,
  authorize('ADMIN', 'SUPERADMIN','SALES_EXECUTIVE'),
  upload.single('file'),
  csvController.importCSV
);

module.exports = router;