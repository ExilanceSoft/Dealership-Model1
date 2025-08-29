// routes/financeDisbursementRoutes.js
const express = require('express');
const router = express.Router();
const {
  createFinanceDisbursement,
  listFinanceDisbursements,
  getFinanceDisbursement,
  updateFinanceDisbursement,
  getDisbursementsByBooking
} = require('../controllers/financeDisbursementController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Finance Disbursements
 *   description: Finance disbursement management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FinanceDisbursement:
 *       type: object
 *       required:
 *         - booking
 *         - financeProvider
 *         - disbursementReference
 *         - amount
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *         booking:
 *           type: string
 *           description: Booking ID
 *         financeProvider:
 *           type: string
 *           description: Finance provider ID
 *         disbursementReference:
 *           type: string
 *           description: Unique reference number
 *         disbursementDate:
 *           type: string
 *           format: date-time
 *         amount:
 *           type: number
 *         paymentMode:
 *           type: string
 *           enum: [FINANCE_DISBURSEMENT]
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELLED]
 *         createdBy:
 *           type: string
 *         ledgerEntry:
 *           type: string
 *           description: Linked ledger entry ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     FinanceDisbursementInput:
 *       type: object
 *       required:
 *         - bookingId
 *         - financeProviderId
 *         - disbursementReference
 *         - amount
 *       properties:
 *         bookingId:
 *           type: string
 *         financeProviderId:
 *           type: string
 *         disbursementReference:
 *           type: string
 *         disbursementDate:
 *           type: string
 *           format: date-time
 *         amount:
 *           type: number
 */

/**
 * @swagger
 * /api/v1/finance-disbursements:
 *   post:
 *     summary: Create a new finance disbursement (Finance+)
 *     tags: [Finance Disbursements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinanceDisbursementInput'
 *           example:
 *             bookingId: "68a45bca0dd1eb0b7823e3e9"
 *             financeProviderId: "6858e83a64f24098902f0226"
 *             disbursementReference: "DISB001"
 *             disbursementDate: "2025-08-20T04:37:31.931Z"
 *             amount: 400
 *     responses:
 *       201:
 *         description: Finance disbursement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FinanceDisbursement'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Duplicate disbursement reference
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('FINANCE_DISBURSEMENT.CREATE'),
  logAction('CREATE', 'FinanceDisbursement'),
  createFinanceDisbursement
);

/**
 * @swagger
 * /api/v1/finance-disbursements:
 *   get:
 *     summary: List finance disbursements (Finance+)
 *     tags: [Finance Disbursements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *         description: Filter by booking ID
 *       - in: query
 *         name: financeProviderId
 *         schema:
 *           type: string
 *         description: Filter by finance provider ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELLED]
 *         description: Filter by status
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -disbursementDate
 *         description: Sort field
 *     responses:
 *       200:
 *         description: List of finance disbursements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 docs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FinanceDisbursement'
 *                 totalDocs:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pagingCounter:
 *                   type: integer
 *                 hasPrevPage:
 *                   type: boolean
 *                 hasNextPage:
 *                   type: boolean
 *                 prevPage:
 *                   type: integer
 *                 nextPage:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  requirePermission('FINANCE_DISBURSEMENT.READ'),
  listFinanceDisbursements
);

/**
 * @swagger
 * /api/v1/finance-disbursements/{id}:
 *   get:
 *     summary: Get a finance disbursement by ID (Finance+)
 *     tags: [Finance Disbursements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Disbursement ID
 *     responses:
 *       200:
 *         description: Finance disbursement details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FinanceDisbursement'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  requirePermission('FINANCE_DISBURSEMENT.READ'),
  getFinanceDisbursement
);

/**
 * @swagger
 * /api/v1/finance-disbursements/{id}:
 *   patch:
 *     summary: Update a finance disbursement (Finance+)
 *     tags: [Finance Disbursements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Disbursement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [PENDING, COMPLETED, CANCELLED]
 *           example:
 *             amount: 500
 *             status: "COMPLETED"
 *     responses:
 *       200:
 *         description: Finance disbursement updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FinanceDisbursement'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.patch('/:id',
  protect,
  requirePermission('FINANCE_DISBURSEMENT.UPDATE'),
  logAction('UPDATE', 'FinanceDisbursement'),
  updateFinanceDisbursement
);

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/finance-disbursements:
 *   get:
 *     summary: Get disbursements for a booking (Finance+)
 *     tags: [Finance Disbursements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: List of disbursements for booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     disbursements:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FinanceDisbursement'
 *                     totalDisbursed:
 *                       type: number
 *                     count:
 *                       type: integer
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/bookings/:bookingId/finance-disbursements',
  protect,
  requirePermission('FINANCE_DISBURSEMENT.READ'),
  getDisbursementsByBooking
);

module.exports = router;