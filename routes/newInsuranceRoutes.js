const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/newInsuranceController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/insurance/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * @swagger
 * tags:
 *   name: new-insurance
 *   description: Insurance management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Insurance:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the insurance
 *         booking:
 *           type: string
 *           description: ID of the associated booking
 *         insuranceDate:
 *           type: string
 *           format: date
 *           description: Date when insurance was created
 *         policyNumber:
 *           type: string
 *           description: Insurance policy number
 *         premiumAmount:
 *           type: number
 *           description: Insurance premium amount
 *         validUptoDate:
 *           type: string
 *           format: date
 *           description: Date until insurance is valid
 *         status:
 *           type: string
 *           enum: [COMPLETED]
 *           description: Insurance status
 *         paymentStatus:
 *           type: string
 *           enum: [UNPAID, PARTIAL, PAID]
 *           description: Payment status of the insurance
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *       required:
 *         - booking
 *         - policyNumber
 *         - premiumAmount
 *         - validUptoDate
 */

/**
 * @swagger
 * /api/v1/new-insurance:
 *   get:
 *     summary: Get all insurances with booking details
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of insurances with booking details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Insurance'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  insuranceController.getAllInsurances
);

/**
 * @swagger
 * /api/v1/new-insurance/awaiting:
 *   get:
 *     summary: Get all bookings awaiting insurance
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookings awaiting insurance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/awaiting',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  insuranceController.getBookingsAwaitingInsurance
);

/**
 * @swagger
 * /api/v1/new-insurance/all-combined:
 *   get:
 *     summary: Get all bookings with their insurance details
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: insuranceStatus
 *         schema:
 *           type: string
 *           enum: [NOT_APPLICABLE, AWAITING, COMPLETED]
 *         description: Filter booking by insurance status
 *     responses:
 *       200:
 *         description: List of all bookings with insurance details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       booking:
 *                         $ref: '#/components/schemas/Booking'
 *                       insurance:
 *                         $ref: '#/components/schemas/Insurance'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/all-combined',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  insuranceController.getAllCombinedBookingInsuranceDetails
);

/**
 * @swagger
 * /api/v1/new-insurance/{bookingId}:
 *   post:
 *     summary: Add insurance details for a booking
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to add insurance for
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               insuranceDate:
 *                 type: string
 *                 format: date
 *                 description: Insurance date (YYYY-MM-DD)
 *               policyNumber:
 *                 type: string
 *                 description: Policy number
 *               rsaPolicyNumber:
 *                 type: string
 *                 description: RSA policy number (optional)
 *               cmsPolicyNumber:
 *                 type: string
 *                 description: CMS policy number (optional)
 *               premiumAmount:
 *                 type: number
 *                 description: Premium amount
 *               validUptoDate:
 *                 type: string
 *                 format: date
 *                 description: Valid until date (YYYY-MM-DD)
 *               remarks:
 *                 type: string
 *                 description: Additional remarks (optional)
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Insurance document (PDF/Image)
 *               document1:
 *                 type: string
 *                 format: binary
 *                 description: Additional insurance document (optional)
 *               document2:
 *                 type: string
 *                 format: binary
 *                 description: Additional insurance document (optional)
 *             required:
 *               - policyNumber
 *               - premiumAmount
 *               - validUptoDate
 *     responses:
 *       201:
 *         description: Insurance added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Insurance'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       409:
 *         description: Insurance already exists
 *       500:
 *         description: Server error
 */
router.post(
  '/:bookingId',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'document1', maxCount: 1 },
    { name: 'document2', maxCount: 1 }
  ]),
  logAction('CREATE', 'Insurance'),
  insuranceController.addInsurance
);

/**
 * @swagger
 * /api/v1/new-insurance/{chassisNumber}:
 *   get:
 *     summary: Get insurance details by chassis number
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chassisNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle chassis number
 *     responses:
 *       200:
 *         description: Insurance details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Insurance'
 *       400:
 *         description: Invalid chassis number format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: No booking or insurance found
 *       500:
 *         description: Server error
 */
router.get(
  '/:chassisNumber',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN', 'SALES_EXECUTIVE'),
  logAction('READ', 'Insurance'),
  insuranceController.getInsuranceByChassisNumber
);

/**
 * @swagger
 * /api/v1/new-insurance/{insuranceId}/payment-status:
 *   get:
 *     summary: Get insurance payment status and history
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: insuranceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the insurance record
 *     responses:
 *       200:
 *         description: Insurance payment status retrieved
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
 *                     insurance:
 *                       $ref: '#/components/schemas/Insurance'
 *                     paymentHistory:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ledger'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalEntries:
 *                           type: number
 *                         totalPaid:
 *                           type: number
 *                         remainingAmount:
 *                           type: number
 *                         paymentStatus:
 *                           type: string
 *                           enum: [PAID, PARTIAL, UNPAID]
 *                         paymentPercentage:
 *                           type: number
 *       400:
 *         description: Invalid insurance ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Insurance not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:insuranceId/payment-status',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('READ', 'InsurancePaymentStatus'),
  insuranceController.getInsurancePaymentStatus
);

/**
 * @swagger
 * /api/v1/new-insurance/{insuranceId}/ledger:
 *   post:
 *     summary: Create ledger entry for insurance payment
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: insuranceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the insurance record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMode:
 *                 type: string
 *                 enum: [Cash, Bank, Finance Disbursement, Exchange, Pay Order]
 *                 description: Payment mode
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               cashLocation:
 *                 type: string
 *                 description: Cash location ID (required for cash payments)
 *               bank:
 *                 type: string
 *                 description: Bank ID (required for non-cash payments)
 *               remark:
 *                 type: string
 *                 description: Additional remarks
 *             required:
 *               - paymentMode
 *               - amount
 *     responses:
 *       201:
 *         description: Ledger entry created successfully
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
 *                     ledger:
 *                       $ref: '#/components/schemas/Ledger'
 *                     insurance:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         policyNumber:
 *                           type: string
 *                         premiumAmount:
 *                           type: number
 *                         totalPaid:
 *                           type: number
 *                         remainingAmount:
 *                           type: number
 *                         paymentStatus:
 *                           type: string
 *                           enum: [PAID, PARTIAL, UNPAID]
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Insurance not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:insuranceId/ledger',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('CREATE', 'InsuranceLedger'),
  insuranceController.createInsuranceLedgerEntry
);

/**
 * @swagger
 * /api/v1/new-insurance/{insuranceId}/ledger:
 *   get:
 *     summary: Get insurance ledger history
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: insuranceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the insurance record
 *     responses:
 *       200:
 *         description: Insurance ledger history retrieved successfully
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
 *                     insurance:
 *                       $ref: '#/components/schemas/Insurance'
 *                     ledgerEntries:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ledger'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalEntries:
 *                           type: number
 *                         totalPaid:
 *                           type: number
 *                         remainingAmount:
 *                           type: number
 *                         paymentStatus:
 *                           type: string
 *                           enum: [PAID, PARTIAL, UNPAID]
 *       400:
 *         description: Invalid insurance ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Insurance not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:insuranceId/ledger',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('READ', 'InsuranceLedger'),
  insuranceController.getInsuranceLedgerHistory
);

/**
 * @swagger
 * /api/v1/new-insurance/ledger/{ledgerId}:
 *   put:
 *     summary: Update insurance ledger entry
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ledgerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the ledger entry
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMode:
 *                 type: string
 *                 enum: [Cash, Bank, Finance Disbursement, Exchange, Pay Order]
 *                 description: Payment mode
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               cashLocation:
 *                 type: string
 *                 description: Cash location ID (required for cash payments)
 *               bank:
 *                 type: string
 *                 description: Bank ID (required for non-cash payments)
 *               transactionReference:
 *                 type: string
 *                 description: Transaction reference
 *               remark:
 *                 type: string
 *                 description: Additional remarks
 *     responses:
 *       200:
 *         description: Ledger entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ledger'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Ledger entry not found
 *       500:
 *         description: Server error
 */
router.put(
  '/ledger/:ledgerId',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('UPDATE', 'InsuranceLedger'),
  insuranceController.updateInsuranceLedgerEntry
);

/**
 * @swagger
 * /api/v1/new-insurance/ledger/{ledgerId}:
 *   delete:
 *     summary: Delete insurance ledger entry
 *     tags: [new-insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ledgerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the ledger entry
 *     responses:
 *       200:
 *         description: Ledger entry deleted successfully
 *       400:
 *         description: Invalid ledger ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Ledger entry not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/ledger/:ledgerId',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('DELETE', 'InsuranceLedger'),
  insuranceController.deleteInsuranceLedgerEntry
);

/**
 * @swagger
 * /api/v1/new-insurance/payments/summary:
 *   get:
 *     summary: Get insurance payments summary
 *     tags: [new-insurance]
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
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [PAID, PARTIAL, UNPAID]
 *         description: Filter by payment status
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter by branch ID (SuperAdmin only)
 *     responses:
 *       200:
 *         description: Insurance payments summary
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
 *                     insurances:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Insurance'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalInsurances:
 *                           type: number
 *                         totalPremiumAmount:
 *                           type: number
 *                         totalPaidAmount:
 *                           type: number
 *                         totalRemainingAmount:
 *                           type: number
 *                         paidCount:
 *                           type: number
 *                         partialCount:
 *                           type: number
 *                         unpaidCount:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/payments/summary',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('READ', 'InsurancePaymentsSummary'),
  insuranceController.getInsurancePaymentsSummary
);

module.exports = router;