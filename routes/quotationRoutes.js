const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

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
 *       required:
 *         - customerDetails
 *         - selectedModels
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the quotation
 *           example: 507f1f77bcf86cd799439011
 *         quotation_number:
 *           type: string
 *           description: Auto-generated quotation number
 *           example: "QTN-2023-0001"
 *         customer_id:
 *           type: string
 *           description: ID of the customer
 *           example: 507f1f77bcf86cd799439012
 *         customerDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "John Doe"
 *             address:
 *               type: string
 *               example: "123 Main St"
 *             mobile1:
 *               type: string
 *               example: "9876543210"
 *             finance_needed:
 *               type: boolean
 *               example: true
 *         models:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               model_id:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439013"
 *               model_name:
 *                 type: string
 *                 example: "Model X"
 *               base_price:
 *                 type: number
 *                 example: 500000
 *               prices:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     value:
 *                       type: number
 *                       example: 10000
 *                     header_key:
 *                       type: string
 *                       example: "ex-showroom"
 *         base_model_id:
 *           type: string
 *           description: ID of the base model (if applicable)
 *           example: "507f1f77bcf86cd799439014"
 *         expected_delivery_date:
 *           type: string
 *           format: date
 *           example: "2023-12-31"
 *         finance_needed:
 *           type: boolean
 *           example: true
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the quotation
 *           example: "507f1f77bcf86cd799439015"
 *         status:
 *           type: string
 *           enum: [draft, confirmed, cancelled]
 *           default: "draft"
 *           example: "draft"
 *         pdfUrl:
 *           type: string
 *           description: URL to the generated PDF
 *           example: "/quotations/quotation_QTN-2023-0001_123456789.pdf"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-01-01T00:00:00.000Z"
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
 *             type: object
 *             required:
 *               - customerDetails
 *               - selectedModels
 *             properties:
 *               customerDetails:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Existing customer ID (optional)
 *                   name:
 *                     type: string
 *                     required: true
 *                   address:
 *                     type: string
 *                     required: true
 *                   mobile1:
 *                     type: string
 *                     required: true
 *                   finance_needed:
 *                     type: boolean
 *                     default: false
 *               selectedModels:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     model_id:
 *                       type: string
 *                       required: true
 *               expected_delivery_date:
 *                 type: string
 *                 format: date
 *               finance_needed:
 *                 type: boolean
 *                 default: false
 *           example:
 *             customerDetails:
 *               name: "John Doe"
 *               address: "123 Main St"
 *               mobile1: "9876543210"
 *               finance_needed: true
 *             selectedModels:
 *               - model_id: "507f1f77bcf86cd799439013"
 *             expected_delivery_date: "2023-12-31"
 *             finance_needed: true
 *     responses:
 *       200:
 *         description: Quotation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quotation'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect, 
  logAction('CREATE', 'Quotation'), 
  quotationController.createQuotation
);
/**
 * @swagger
 * /api/v1/quotations:
 *   get:
 *     summary: Get all quotations
 *     description: Super admins see all quotations, others see only their own
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
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
 *                   example: "success"
 *                 results:
 *                   type: integer
 *                   example: 5
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
 *         description: Quotation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   $ref: '#/components/schemas/Quotation'
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.get('/:id', 
  protect, 
  quotationController.getQuotationById
);

/**
 * @swagger
 * /api/v1/quotations/pdf/{filename}:
 *   get:
 *     summary: Get quotation PDF
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: PDF filename (e.g. quotation_QTN-2023-0001_123456789.pdf)
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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: PDF not found
 *       500:
 *         description: Server error
 */
router.get('/pdf/:filename', 
  protect, 
  quotationController.getQuotationPDF
);

/**
 * @swagger
 * /api/v1/quotations/export/excel:
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
 *         description: Start date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid date parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No quotations found
 *       500:
 *         description: Server error
 */
router.get('/export/excel', 
  protect, 
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
 *         description: Today's quotation count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats/today', 
  protect, 
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
 *         description: This month's quotation count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                       example: 25
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats/month', 
  protect, 
  quotationController.getThisMonthQuotationCount
);

module.exports = router;