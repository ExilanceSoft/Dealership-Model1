const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Ledger
 *   description: Financial ledger management
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     LedgerEntry:
 *       type: object
 *       required:
 *         - booking
 *         - paymentMode
 *         - amount
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         booking:
 *           type: string
 *           description: Reference to Booking
 *           example: 507f1f77bcf86cd799439012
 *         paymentMode:
 *           type: string
 *           enum: [Cash, Bank]
 *           example: Bank
 *         amount:
 *           type: number
 *           minimum: 0
 *           example: 5000
 *         receivedBy:
 *           type: string
 *           description: User who received the payment
 *           example: 507f1f77bcf86cd799439013
 *         cashLocation:
 *           type: string
 *           description: Required for cash payments
 *           example: Main Office
 *         bankLocation:
 *           type: string
 *           description: Required for bank payments
 *           example: Andheri Branch
 *         bank:
 *           type: string
 *           description: Reference to Bank for bank payments
 *           example: 507f1f77bcf86cd799439014
 *         remark:
 *           type: string
 *           example: Initial payment
 *         createdAt:
 *           type: string
 *           format: date-time
 *         bankDetails:
 *           $ref: '#/components/schemas/Bank'
 *         receivedByDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: John Doe
 * 
 *     LedgerSummary:
 *       type: object
 *       properties:
 *         totalAmount:
 *           type: number
 *           example: 100000
 *         totalReceived:
 *           type: number
 *           example: 50000
 *         balanceAmount:
 *           type: number
 *           example: 50000
 */

/**
 * @swagger
 * /api/v1/ledger/receipt:
 *   post:
 *     summary: Add a new receipt to ledger (Sales+)
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - paymentMode
 *               - amount
 *             properties:
 *               bookingId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439012
 *               paymentMode:
 *                 type: string
 *                 enum: [Cash, Bank]
 *                 example: Bank
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 5000
 *               cashLocation:
 *                 type: string
 *                 example: Main Office
 *               bankLocation:
 *                 type: string
 *                 example: Andheri Branch
 *               bankId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439014
 *               remark:
 *                 type: string
 *                 example: Initial payment
 *     responses:
 *       201:
 *         description: Receipt added successfully
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
 *                     ledger:
 *                       $ref: '#/components/schemas/LedgerEntry'
 *                     receipt:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         amount:
 *                           type: number
 *                         paymentMode:
 *                           type: string
 *                     booking:
 *                       type: object
 *                       properties:
 *                         receivedAmount:
 *                           type: number
 *                         balanceAmount:
 *                           type: number
 *       400:
 *         description: Validation error or amount exceeds balance
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Sales+)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post(
  '/receipt',
  protect,
  requirePermission('LEDGER.CREATE'),
  logAction('CREATE', 'Ledger'),
  ledgerController.addReceipt
);

/**
 * @swagger
 * /api/v1/ledger/booking-counts:
 *   get:
 *     summary: Get counts of different booking types (PF, NPF, etc.)
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Booking type counts
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
 *                     totalBookings:
 *                       type: integer
 *                       description: Total number of bookings
 *                       example: 100
 *                     pfBookings:
 *                       type: integer
 *                       description: Number of Proforma (PENDING_APPROVAL) bookings
 *                       example: 30
 *                     npfBookings:
 *                       type: integer
 *                       description: Number of Non-Proforma (APPROVED) bookings
 *                       example: 50
 *                     draftBookings:
 *                       type: integer
 *                       description: Number of DRAFT bookings
 *                       example: 10
 *                     rejectedBookings:
 *                       type: integer
 *                       description: Number of REJECTED bookings
 *                       example: 5
 *                     completedBookings:
 *                       type: integer
 *                       description: Number of COMPLETED bookings
 *                       example: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/booking-counts',
  ledgerController.getBookingTypeCounts
);

/**
 * @swagger
 * /api/v1/ledger/summary/branch:
 *   get:
 *     summary: Get ledger summary for all branches
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ledger summary by branch
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
 *                     allBranches:
 *                       type: object
 *                       properties:
 *                         totalCredit:
 *                           type: number
 *                         totalDebit:
 *                           type: number
 *                         finalBalance:
 *                           type: number
 *                     byBranch:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           branchId:
 *                             type: string
 *                           branchName:
 *                             type: string
 *                           totalCredit:
 *                             type: number
 *                           totalDebit:
 *                             type: number
 *                           finalBalance:
 *                             type: number
 *       500:
 *         description: Server error
 */
router.get(
  '/summary/branch',
  ledgerController.getBranchLedgerSummary
);

/**
 * @swagger
 * /api/v1/ledger/{bookingId}:
 *   get:
 *     summary: Get all ledger entries for a booking
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: List of ledger entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: object
 *                   properties:
 *                     ledgerEntries:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LedgerEntry'
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No entries found
 *       500:
 *         description: Server error
 */
router.get(
  '/:bookingId',
  ledgerController.getLedgerEntries
);

/**
 * @swagger
 * /api/v1/ledger/summary/{bookingId}:
 *   get:
 *     summary: Get ledger summary for a booking
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: Ledger summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/LedgerSummary'
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get(
  '/summary/:bookingId',
  ledgerController.getLedgerSummary
);

/**
 * @swagger
 * /api/v1/ledger/report/{bookingId}:
 *   get:
 *     summary: Get detailed ledger report for a booking
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: Detailed ledger report
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
 *                     customerDetails:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         address:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         aadharNo:
 *                           type: string
 *                         panNo:
 *                           type: string
 *                     vehicleDetails:
 *                       type: object
 *                       properties:
 *                         chassisNo:
 *                           type: string
 *                         engineNo:
 *                           type: string
 *                         model:
 *                           type: string
 *                         color:
 *                           type: string
 *                     financeDetails:
 *                       type: object
 *                       properties:
 *                         financer:
 *                           type: string
 *                     salesExecutive:
 *                       type: string
 *                     ledgerDate:
 *                       type: string
 *                     entries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           description:
 *                             type: string
 *                           receiptNo:
 *                             type: string
 *                           status:
 *                             type: string
 *                           credit:
 *                             type: number
 *                           debit:
 *                             type: number
 *                           balance:
 *                             type: number
 *                     totals:
 *                       type: object
 *                       properties:
 *                         totalCredit:
 *                           type: number
 *                         totalDebit:
 *                           type: number
 *                         finalBalance:
 *                           type: number
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get(
  '/report/:bookingId',
  ledgerController.getLedgerReport
);

/**
 * @swagger
 * /api/v1/ledger/update/{receiptId}:
 *   put:
 *     summary: Update a ledger entry (Sales+)
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: receiptId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439015
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMode:
 *                 type: string
 *                 enum: [Cash, Bank]
 *                 example: Bank
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 5500
 *               cashLocation:
 *                 type: string
 *                 example: Main Office
 *               bankLocation:
 *                 type: string
 *                 example: Andheri Branch
 *               bankId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439014
 *               remark:
 *                 type: string
 *                 example: Updated payment
 *     responses:
 *       200:
 *         description: Ledger entry updated
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
 *                     ledger:
 *                       $ref: '#/components/schemas/LedgerEntry'
 *                     booking:
 *                       type: object
 *                       properties:
 *                         receivedAmount:
 *                           type: number
 *                         balanceAmount:
 *                           type: number
 *       400:
 *         description: Validation error or amount exceeds balance
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Sales+)
 *       404:
 *         description: Ledger entry or booking not found
 *       500:
 *         description: Server error
 */
router.put(
  '/update/:receiptId',
  protect,
  requirePermission('LEDGER.UPDATE'),
  logAction('UPDATE', 'Ledger'),
  ledgerController.updateLedgerEntry
);

/**
 * @swagger
 * /api/v1/ledger/debit:
 *   post:
 *     summary: Add a new debit entry to ledger
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - paymentMode
 *               - amount
 *               - debitReason
 *             properties:
 *               bookingId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439012
 *               paymentMode:
 *                 type: string
 *                 enum: [Late Payment, Penalty, Cheque Bounce, Insurance Endorsement, Other Debit]
 *                 example: Penalty
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 500
 *               debitReason:
 *                 type: string
 *                 example: Late payment penalty
 *               remark:
 *                 type: string
 *                 example: Customer was 10 days late
 *     responses:
 *       201:
 *         description: Debit entry added successfully
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
 *                     ledger:
 *                       $ref: '#/components/schemas/LedgerEntry'
 *                     booking:
 *                       type: object
 *                       properties:
 *                         balanceAmount:
 *                           type: number
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not authorized)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post(
  '/debit',
  protect,
  requirePermission('LEDGER.CREATE'),
  logAction('CREATE', 'Debit Ledger'),
  ledgerController.addDebit
);

/**
 * @swagger
 * /api/v1/ledger/debit/booking/{bookingId}:
 *   get:
 *     summary: Get debit entries for a booking
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: List of debit entries for the booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     debits:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LedgerEntry'
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No entries found
 *       500:
 *         description: Server error
 */
router.get(
  '/debit/booking/:bookingId',
  ledgerController.getDebitsByBooking
);

module.exports = router;