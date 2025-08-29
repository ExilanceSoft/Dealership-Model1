// routes/commissionPaymentRoutes.js
const express = require('express');
const router = express.Router();
const commissionPaymentController = require('../controllers/commissionPaymentController');
const { protect } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Commission Payments
 *   description: Subdealer commission payment management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CommissionPaymentInput:
 *       type: object
 *       required:
 *         - subdealer_id
 *         - month
 *         - year
 *         - payment_method
 *       properties:
 *         subdealer_id:
 *           type: string
 *           description: ID of the subdealer
 *           example: 507f1f77bcf86cd799439012
 *         month:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           description: Month for the commission (1-12)
 *           example: 8
 *         year:
 *           type: integer
 *           description: Year for the commission
 *           example: 2025
 *         payment_method:
 *           type: string
 *           enum: [ON_ACCOUNT, BANK_TRANSFER, UPI, CHEQUE]
 *           description: Payment method for the commission
 *         bank_id:
 *           type: string
 *           description: ID of the bank (required for BANK_TRANSFER)
 *           example: 507f1f77bcf86cd799439014
 *         transaction_reference:
 *           type: string
 *           description: Transaction reference number (required for non-ON_ACCOUNT payments)
 *           example: "TRX123456789"
 *         remarks:
 *           type: string
 *           description: Additional remarks
 *           example: "Commission for August 2025"
 *     CommissionPaymentResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         subdealer_id:
 *           type: string
 *         month:
 *           type: integer
 *         year:
 *           type: integer
 *         total_commission:
 *           type: number
 *         payment_method:
 *           type: string
 *         bank_id:
 *           type: string
 *         transaction_reference:
 *           type: string
 *         on_account_receipt_id:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, PROCESSED, FAILED]
 *         remarks:
 *           type: string
 *         created_by:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         subdealer_details:
 *           type: object
 *         bank_details:
 *           type: object
 *         booking_commissions:
 *           type: array
 *           items:
 *             type: object
 */

// Commission Payment Routes

/**
 * @swagger
 * /api/v1/commission-payments:
 *   post:
 *     summary: Process commission payment for a subdealer
 *     tags: [Commission Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionPaymentInput'
 *     responses:
 *       201:
 *         description: Commission payment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/CommissionPaymentResponse'
 *       400:
 *         description: Validation error or duplicate payment
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('SUBDEALER_COMMISSION.PAYMENT'),
  logAction('CREATE', 'CommissionPayment'),
  commissionPaymentController.processCommissionPayment
);

/**
 * @swagger
 * /api/v1/commission-payments:
 *   get:
 *     summary: Get all commission payments with filters
 *     tags: [Commission Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subdealer_id
 *         schema:
 *           type: string
 *         description: Filter by subdealer ID
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Filter by month (1-12)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by year
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSED, FAILED]
 *         description: Filter by status
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [ON_ACCOUNT, BANK_TRANSFER, UPI, CHEQUE]
 *         description: Filter by payment method
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
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of commission payments
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
 *                     payments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CommissionPaymentResponse'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         pages:
 *                           type: number
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionPaymentController.getCommissionPayments
);

/**
 * @swagger
 * /api/v1/commission-payments/{id}:
 *   get:
 *     summary: Get commission payment by ID
 *     tags: [Commission Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Commission payment ID
 *     responses:
 *       200:
 *         description: Commission payment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/CommissionPaymentResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Commission payment not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionPaymentController.getCommissionPaymentById
);

/**
 * @swagger
 * /api/v1/commission-payments/{id}/status:
 *   patch:
 *     summary: Update commission payment status
 *     tags: [Commission Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Commission payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PROCESSED, FAILED]
 *                 example: PROCESSED
 *               remarks:
 *                 type: string
 *                 example: "Payment processed successfully"
 *     responses:
 *       200:
 *         description: Commission payment status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/CommissionPaymentResponse'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Commission payment not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status',
  protect,
  requirePermission('SUBDEALER_COMMISSION.PAYMENT'),
  logAction('UPDATE_STATUS', 'CommissionPayment'),
  commissionPaymentController.updatePaymentStatus
);

module.exports = router;