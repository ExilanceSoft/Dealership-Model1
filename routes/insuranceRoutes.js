const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insuranceController');
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
    fileSize: 5 * 1024 * 1024
  }
});

/**
 * @swagger
 * tags:
 *   name: Insurance
 *   description: Insurance management endpoints
 */
/**
 * @swagger
 * /api/v1/insurance/all-combined:
 *   get:
 *     summary: Get all bookings with their insurance details
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter insurance by status
 *       - in: query
 *         name: insuranceStatus
 *         schema:
 *           type: string
 *           enum: [NOT_APPLICABLE, AWAITING, PENDING, COMPLETED, REJECTED]
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
 * /api/v1/insurance/{bookingId}:
 *   post:
 *     summary: Add insurance details for a booking (form data)
 *     tags: [Insurance]
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
 *               insuranceProvider:
 *                 type: string
 *                 description: ID of the insurance provider
 *               paymentMode:
 *                 type: string
 *                 enum: [CASH, BANK, CARD]
 *                 description: Payment mode for the insurance
 *               transactionReference:
 *                 type: string
 *                 description: Transaction reference number (required for BANK/CARD)
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
 *               - insuranceProvider
 *               - paymentMode
 *               - policyNumber
 *               - premiumAmount
 *               - validUptoDate
 *     responses:
 *       201:
 *         description: Insurance added successfully
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
 * /api/v1/insurance/{bookingId}/approve:
 *   patch:
 *     summary: Approve or reject insurance
 *     description: Update insurance status to APPROVED or REJECTED. When approved, booking insuranceStatus becomes COMPLETED.
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to update insurance status for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 required: true
 *               rejectionReason:
 *                 type: string
 *                 description: Required when status is REJECTED
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Insurance status updated successfully
 *       400:
 *         description: Invalid status or missing rejection reason
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin/Manager)
 *       404:
 *         description: Insurance not found for this booking
 *       500:
 *         description: Server error
 */
router.patch('/:bookingId/approve',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('UPDATE_STATUS', 'Insurance'),
  insuranceController.approveInsurance
);

/**
 * @swagger
 * /api/v1/insurance:
 *   get:
 *     summary: Get all insurances with booking details
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of insurances with booking details
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
 * /api/v1/insurance/completed:
 *   get:
 *     summary: Get all completed insurances
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of completed insurances
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/completed',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  insuranceController.getCompletedInsurances
);

/**
 * @swagger
 * /api/v1/insurance/pending:
 *   get:
 *     summary: Get all pending insurances
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending insurances
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/pending',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  insuranceController.getPendingInsurances
);

/**
 * @swagger
 * /api/v1/insurance/rejected:
 *   get:
 *     summary: Get all rejected insurances
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rejected insurances
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/rejected',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  insuranceController.getRejectedInsurances
);

/**
 * @swagger
 * /api/v1/insurance/awaiting:
 *   get:
 *     summary: Get all bookings awaiting insurance
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookings awaiting insurance
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
 * /api/v1/insurance/{chassisNumber}:
 *   get:
 *     summary: Get insurance details by chassis number
 *     description: Retrieve complete insurance information for a vehicle using its chassis number
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chassisNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle chassis number (case insensitive search)
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
 *                   type: object
 *                   properties:
 *                     insuranceId:
 *                       type: string
 *                     policyNumber:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [PENDING, APPROVED, REJECTED]
 *                     insuranceDate:
 *                       type: string
 *                       format: date
 *                     validUptoDate:
 *                       type: string
 *                       format: date
 *                     premiumAmount:
 *                       type: number
 *                     paymentMode:
 *                       type: string
 *                       enum: [CASH, BANK, CARD]
 *                     transactionReference:
 *                       type: string
 *                     insuranceProvider:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         provider_name:
 *                           type: string
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           url:
 *                             type: string
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [POLICY, RECEIPT, FORM, OTHER]
 *                     bookingDetails:
 *                       type: object
 *                       properties:
 *                         bookingNumber:
 *                           type: string
 *                         model:
 *                           type: object
 *                         color:
 *                           type: object
 *                         customer:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             mobile:
 *                               type: string
 *                             email:
 *                               type: string
 *                         chassisNumber:
 *                           type: string
 *                         branch:
 *                           type: object
 *                     createdBy:
 *                       $ref: '#/components/schemas/User'
 *                     approvedBy:
 *                       $ref: '#/components/schemas/User'
 *                     approvalDate:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid chassis number format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: No booking or insurance found for this chassis number
 *       500:
 *         description: Server error
 */
router.get('/:chassisNumber',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN', 'SALES_EXECUTIVE'),
  logAction('READ', 'Insurance'),
  insuranceController.getInsuranceByChassisNumber
);



module.exports = router;