const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { protect, authorize,roleAuthorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Quotations
 *   description: Quotation management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Quotation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated ID of the quotation
 *         quotation_number:
 *           type: string
 *           description: Unique quotation number
 *         customer_id:
 *           type: string
 *           description: Reference to customer
 *         models:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               model_id:
 *                 type: string
 *               model_name:
 *                 type: string
 *               prices:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     value:
 *                       type: number
 *                     header_key:
 *                       type: string
 *         status:
 *           type: string
 *           enum: [draft, sent, accepted, rejected, converted]
 *         pdfUrl:
 *           type: string
 *           description: URL to generated PDF
 *         createdAt:
 *           type: string
 *           format: date-time
 * 
 *     QuotationInput:
 *       type: object
 *       required:
 *         - customerDetails
 *         - selectedModels
 *       properties:
 *         customerDetails:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               description: Existing customer ID (optional)
 *             name:
 *               type: string
 *             mobile1:
 *               type: string
 *         selectedModels:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               model_id:
 *                 type: string
 *         expected_delivery_date:
 *           type: string
 *           format: date
 *         finance_needed:
 *           type: boolean
 */

/**
 * @swagger
 * /api/v1/quotations:
 *   post:
 *     summary: Create a new quotation
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuotationInput'
 *     responses:
 *       200:
 *         description: Quotation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quotation'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('QUOTATION.CREATE'),
  logAction('CREATE', 'Quotation'),
  quotationController.createQuotation
);

/**
 * @swagger
 * /api/v1/quotations:
 *   get:
 *     summary: Get all quotations
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status (draft, sent, accepted, rejected, converted)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by customer name or quotation number
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field (prefix with - for descending)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of quotations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     quotations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Quotation'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  requirePermission('QUOTATION.READ'),
  quotationController.getAllQuotations
);

/**
 * @swagger
 * /api/v1/quotations/{id}:
 *   get:
 *     summary: Get quotation by ID
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *     responses:
 *       200:
 *         description: Quotation data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quotation'
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Quotation not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  requirePermission('QUOTATION.READ'),
  quotationController.getQuotationById
);

/**
 * @swagger
 * /api/v1/quotations/pdf/{filename}:
 *   get:
 *     summary: Get quotation PDF
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: PDF filename
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid filename
 *       404:
 *         description: PDF not found
 *       500:
 *         description: Server error
 */
router.get('/pdf/:filename',
  requirePermission('QUOTATION.READ'),
  quotationController.getQuotationPDF
);

/**
 * @swagger
 * /api/v1/quotations/export:
 *   get:
 *     summary: Export quotations to Excel
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *         description: Branch ID to filter
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/export',
  protect,
  requirePermission('QUOTATION.EXPORT'),
  quotationController.exportQuotationsToExcel
);

/**
 * @swagger
 * /api/v1/quotations/stats/today:
 *   get:
 *     summary: Get today's quotation count
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats/today',
  protect,
  requirePermission('QUOTATION.READ'),
  quotationController.getTodaysQuotationCount
);

/**
 * @swagger
 * /api/v1/quotations/stats/month:
 *   get:
 *     summary: Get this month's quotation count
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats/month',
  protect,
  requirePermission('QUOTATION.READ'),
  quotationController.getThisMonthQuotationCount
);

/**
 * @swagger
 * /api/v1/quotations/{id}/send-whatsapp:
 *   post:
 *     summary: Send quotation via WhatsApp
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: WhatsApp phone number with country code
 *                 example: "919876543210"
 *     responses:
 *       200:
 *         description: WhatsApp message sent successfully
 *       400:
 *         description: Invalid input or quotation not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/:id/send-whatsapp',
  protect,
  requirePermission('QUOTATION.READ'),
  logAction('SEND_WHATSAPP', 'Quotation'),
  quotationController.sendQuotationViaWhatsApp
);

module.exports = router;