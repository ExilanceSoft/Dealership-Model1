const express = require('express');
const router = express.Router();
const downPaymentController = require('../controllers/downPaymentController');
const { protect, authorize } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Down Payments
 *   description: Down payment disbursement and manager deviation management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DownPayment:
 *       type: object
 *       required:
 *         - bookingId
 *         - disbursementAmount
 *         - financeProviderId
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the disbursement
 *           example: 507f1f77bcf86cd799439011
 *         booking:
 *           type: string
 *           description: ID of the booking
 *           example: 507f1f77bcf86cd799439012
 *         disbursementReference:
 *           type: string
 *           description: Unique reference for the disbursement
 *           example: FD-1704038400000-123
 *         disbursementAmount:
 *           type: number
 *           description: Amount to be disbursed
 *           example: 500000
 *         receivedAmount:
 *           type: number
 *           description: Amount actually received
 *           example: 500000
 *         financeProvider:
 *           type: string
 *           description: ID of the finance provider
 *           example: 507f1f77bcf86cd799439013
 *         financeProviderDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             id:
 *               type: string
 *         status:
 *           type: string
 *           enum: [PENDING, PARTIAL, COMPLETED, CANCELLED]
 *           description: Disbursement status
 *           example: COMPLETED
 *         notes:
 *           type: string
 *           description: Additional notes
 *           example: Disbursement processed successfully
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the disbursement
 *           example: 507f1f77bcf86cd799439014
 *         createdByDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             id:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the disbursement was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the disbursement was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 *     DownPaymentInput:
 *       type: object
 *       required:
 *         - bookingId
 *         - disbursementAmount
 *         - financeProviderId
 *       properties:
 *         bookingId:
 *           type: string
 *           description: ID of the booking
 *           example: 507f1f77bcf86cd799439012
 *         disbursementAmount:
 *           type: number
 *           description: Amount to be disbursed
 *           example: 500000
 *         financeProviderId:
 *           type: string
 *           description: ID of the finance provider
 *           example: 507f1f77bcf86cd799439013
 *         notes:
 *           type: string
 *           description: Additional notes
 *           example: Disbursement for booking #12345
 *     ManagerDeviationInput:
 *       type: object
 *       required:
 *         - bookingId
 *         - deviationAmount
 *         - reason
 *       properties:
 *         bookingId:
 *           type: string
 *           description: ID of the booking
 *           example: 507f1f77bcf86cd799439012
 *         deviationAmount:
 *           type: number
 *           description: Deviation amount
 *           example: 50000
 *         reason:
 *           type: string
 *           description: Reason for deviation
 *           example: Customer requested additional discount
 *     ReceivedAmountInput:
 *       type: object
 *       required:
 *         - receivedAmount
 *       properties:
 *         receivedAmount:
 *           type: number
 *           description: Amount actually received
 *           example: 500000
 *     DownPaymentSummary:
 *       type: object
 *       properties:
 *         booking:
 *           type: object
 *           properties:
 *             dealAmount:
 *               type: number
 *               example: 600000
 *             financeExpected:
 *               type: number
 *               example: 500000
 *             downPaymentExpected:
 *               type: number
 *               example: 100000
 *             customerPaid:
 *               type: number
 *               example: 100000
 *             balanceAmount:
 *               type: number
 *               example: 0
 *         disbursements:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 1
 *             disbursedAmount:
 *               type: number
 *               example: 500000
 *             pendingAmount:
 *               type: number
 *               example: 0
 *             details:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DownPayment'
 *         managerDeviations:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *               example: 0
 *             details:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     example: 0
 *                   reason:
 *                     type: string
 *                   manager:
 *                     type: string
 *                   appliedAt:
 *                     type: string
 *                     format: date-time
 *         allocation:
 *           type: object
 *           properties:
 *             totalAllocated:
 *               type: number
 *               example: 600000
 *             allocationMet:
 *               type: boolean
 *               example: true
 *             shortfall:
 *               type: number
 *               example: 0
 */

/**
 * @swagger
 * /api/v1/down-payments/disbursement:
 *   post:
 *     summary: Create a new down payment (BOOKING.CREATE permission required)
 *     tags: [Down Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DownPaymentInput'
 *     responses:
 *       201:
 *         description: Down payment disbursement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     disbursement:
 *                       $ref: '#/components/schemas/DownPayment'
 *                     financeExpected:
 *                       type: number
 *                       example: 500000
 *                     downPaymentExpected:
 *                       type: number
 *                       example: 100000
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (missing BOOKING.CREATE permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post(
  '/disbursement',
  protect,
  requirePermission('BOOKING.CREATE'),
  downPaymentController.addFinanceDisbursement
);

/**
 * @swagger
 *  /api/v1/down-payments/deviation:
 *   post:
 *     summary: Add manager deviation to a booking (BOOKING.CREATE permission required)
 *     tags: [Down Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ManagerDeviationInput'
 *     responses:
 *       201:
 *         description: Manager deviation added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     deviation:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                           example: 50000
 *                         reason:
 *                           type: string
 *                           example: Customer requested additional discount
 *                         manager:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               example: 507f1f77bcf86cd799439014
 *                             name:
 *                               type: string
 *                               example: John Doe
 *                         appliedAt:
 *                           type: string
 *                           format: date-time
 *                     allocation:
 *                       type: object
 *                       properties:
 *                         financeReceived:
 *                           type: number
 *                           example: 450000
 *                         customerPaid:
 *                           type: number
 *                           example: 100000
 *                         managerDeviation:
 *                           type: number
 *                           example: 50000
 *                         totalAllocated:
 *                           type: number
 *                           example: 600000
 *                         dealAmount:
 *                           type: number
 *                           example: 600000
 *                         allocationMet:
 *                           type: boolean
 *                           example: true
 *                     manager:
 *                       type: object
 *                       properties:
 *                         availableDeviation:
 *                           type: number
 *                           example: 450000
 *                         perTransactionLimit:
 *                           type: number
 *                           example: 100000
 *       400:
 *         description: Validation error, insufficient deviation limit, or allocation not met
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (missing BOOKING.CREATE permission)
 *       404:
 *         description: Booking or manager not found
 *       500:
 *         description: Server error
 */
router.post(
  '/deviation',
  protect,
  requirePermission('BOOKING.CREATE'),
  downPaymentController.addManagerDeviation
);

/**
 * @swagger
 *  /api/v1/down-payments/summary/{bookingId}:
 *   get:
 *     summary: Get down payment summary for a booking
 *     tags: [Down Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to get summary for
 *     responses:
 *       200:
 *         description: Down payment summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DownPaymentSummary'
 *       400:
 *         description: Invalid booking ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get(
  '/summary/:bookingId',
  protect,
  downPaymentController.getFinanceDisbursementSummary
);

/**
 * @swagger
 *  /api/v1/down-payments/disbursement/{disbursementId}/received:
 *   patch:
 *     summary: Update received amount for a disbursement (BOOKING.UPDATE permission required)
 *     tags: [Down Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disbursementId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the disbursement to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReceivedAmountInput'
 *     responses:
 *       200:
 *         description: Disbursement received amount updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     disbursement:
 *                       $ref: '#/components/schemas/DownPayment'
 *                     allocationStatus:
 *                       type: string
 *                       example: COMPLETED
 *       400:
 *         description: Validation error or received amount exceeds disbursement amount
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (missing BOOKING.UPDATE permission)
 *       404:
 *         description: Disbursement not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/disbursement/:disbursementId/received',
  protect,
  requirePermission('BOOKING.UPDATE'),
  downPaymentController.updateDisbursementReceived
);

module.exports = router;