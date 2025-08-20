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
 *         - disbursementAmount
 *         - receivedAmount
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
 *         disbursementAmount:
 *           type: number
 *         receivedAmount:
 *           type: number
 *         remainingAmount:
 *           type: number
 *           description: Virtual field (disbursementAmount - receivedAmount)
 *         paymentMode:
 *           type: string
 *           enum: [NEFT, RTGS, IMPS, Cheque, DD, Other]
 *         bank:
 *           type: string
 *           description: Bank ID
 *         transactionReference:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, PARTIAL, COMPLETED, CANCELLED]
 *         remark:
 *           type: string
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
 *         - disbursementAmount
 *         - receivedAmount
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
 *         disbursementAmount:
 *           type: number
 *         receivedAmount:
 *           type: number
 *         paymentMode:
 *           type: string
 *           enum: [NEFT, RTGS, IMPS, Cheque, DD, Other]
 *         bankId:
 *           type: string
 *         transactionReference:
 *           type: string
 *         remark:
 *           type: string
 */

/**
 * @swagger
 * /api/finance-disbursements:
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
 *     responses:
 *       201:
 *         description: Finance disbursement created successfully
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
 * /api/finance-disbursements:
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
 *           enum: [PENDING, PARTIAL, COMPLETED, CANCELLED]
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
 * /api/finance-disbursements/{id}:
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
 * /api/finance-disbursements/{id}:
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
 *               receivedAmount:
 *                 type: number
 *               paymentMode:
 *                 type: string
 *                 enum: [NEFT, RTGS, IMPS, Cheque, DD, Other]
 *               bankId:
 *                 type: string
 *               transactionReference:
 *                 type: string
 *               remark:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [PENDING, PARTIAL, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Finance disbursement updated
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

// /**
//  * @swagger
//  * /api/bookings/{bookingId}/finance-disbursements:
//  *   get:
//  *     summary: Get disbursements for a booking (Finance+)
//  *     tags: [Finance Disbursements]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: bookingId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Booking ID
//  *     responses:
//  *       200:
//  *         description: List of disbursements for booking
//  *       400:
//  *         description: Invalid booking ID
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden
//  *       500:
//  *         description: Server error
//  */
// router.get('/bookings/:bookingId/finance-disbursements',
//   protect,
//   requirePermission('FINANCE_DISBURSEMENT.READ'),
//   getDisbursementsByBooking
// );

module.exports = router;