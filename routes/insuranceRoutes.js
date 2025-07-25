const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insuranceController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Insurance
 *   description: Insurance management endpoints
 */

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Insurance:
//  *       type: object
//  *       required:
//  *         - booking
//  *         - insuranceProvider
//  *         - policyNumber
//  *         - premiumAmount
//  *         - validUptoDate
//  *         - paymentMode
//  *       properties:
//  *         id:
//  *           type: string
//  *           description: The auto-generated ID of the insurance
//  *           example: 507f1f77bcf86cd799439011
//  *         booking:
//  *           type: string
//  *           description: ID of the associated booking
//  *           example: 507f1f77bcf86cd799439012
//  *         insuranceProvider:
//  *           type: string
//  *           description: ID of the insurance provider
//  *           example: 507f1f77bcf86cd799439013
//  *         insuranceDate:
//  *           type: string
//  *           format: date-time
//  *           description: Date when insurance was purchased
//  *           example: "2023-01-01T00:00:00.000Z"
//  *         policyNumber:
//  *           type: string
//  *           description: Insurance policy number
//  *           example: POL12345678
//  *         rsaPolicyNumber:
//  *           type: string
//  *           description: RSA policy number (if applicable)
//  *           example: RSA123456
//  *         cmsPolicyNumber:
//  *           type: string
//  *           description: CMS policy number (if applicable)
//  *           example: CMS123456
//  *         premiumAmount:
//  *           type: number
//  *           description: Insurance premium amount
//  *           example: 15000
//  *         validUptoDate:
//  *           type: string
//  *           format: date-time
//  *           description: Date until which insurance is valid
//  *           example: "2024-01-01T00:00:00.000Z"
//  *         documents:
//  *           type: array
//  *           items:
//  *             type: object
//  *             properties:
//  *               url:
//  *                 type: string
//  *               name:
//  *                 type: string
//  *               type:
//  *                 type: string
//  *           description: Array of document objects
//  *         paymentMode:
//  *           type: string
//  *           enum: [CASH, ONLINE, CHEQUE, OTHER]
//  *           description: Payment mode for insurance
//  *           example: ONLINE
//  *         status:
//  *           type: string
//  *           enum: [PENDING, APPROVED, REJECTED]
//  *           description: Insurance approval status
//  *           example: PENDING
//  *         approvedBy:
//  *           type: string
//  *           description: ID of user who approved/rejected
//  *           example: 507f1f77bcf86cd799439014
//  *         approvalDate:
//  *           type: string
//  *           format: date-time
//  *           description: Date of approval/rejection
//  *           example: "2023-01-02T00:00:00.000Z"
//  *         rejectionReason:
//  *           type: string
//  *           description: Reason for rejection (if rejected)
//  *           example: Incomplete documents
//  *         createdAt:
//  *           type: string
//  *           format: date-time
//  *           description: Creation timestamp
//  *           example: "2023-01-01T00:00:00.000Z"
//  *         updatedAt:
//  *           type: string
//  *           format: date-time
//  *           description: Last update timestamp
//  *           example: "2023-01-02T00:00:00.000Z"
//  *         bookingDetails:
//  *           type: object
//  *           properties:
//  *             bookingNumber:
//  *               type: string
//  *             customerDetails:
//  *               type: object
//  *               properties:
//  *                 name:
//  *                   type: string
//  *                 mobile1:
//  *                   type: string
//  *             chassisNumber:
//  *               type: string
//  *             model:
//  *               type: object
//  *               properties:
//  *                 model_name:
//  *                   type: string
//  *             color:
//  *               type: object
//  *               properties:
//  *                 name:
//  *                   type: string
//  *         providerDetails:
//  *           type: object
//  *           properties:
//  *             provider_name:
//  *               type: string
//  *         approvedByDetails:
//  *           type: object
//  *           properties:
//  *             name:
//  *               type: string
//  *             email:
//  *               type: string
//  *     InsuranceInput:
//  *       type: object
//  *       required:
//  *         - insuranceProvider
//  *         - policyNumber
//  *         - premiumAmount
//  *         - validUptoDate
//  *         - paymentMode
//  *       properties:
//  *         insuranceProvider:
//  *           type: string
//  *           description: ID of the insurance provider
//  *           example: 507f1f77bcf86cd799439013
//  *         policyNumber:
//  *           type: string
//  *           description: Insurance policy number
//  *           example: POL12345678
//  *         rsaPolicyNumber:
//  *           type: string
//  *           description: RSA policy number (if applicable)
//  *           example: RSA123456
//  *         cmsPolicyNumber:
//  *           type: string
//  *           description: CMS policy number (if applicable)
//  *           example: CMS123456
//  *         premiumAmount:
//  *           type: number
//  *           description: Insurance premium amount
//  *           example: 15000
//  *         validUptoDate:
//  *           type: string
//  *           format: date-time
//  *           description: Date until which insurance is valid
//  *           example: "2024-01-01T00:00:00.000Z"
//  *         documents:
//  *           type: array
//  *           items:
//  *             type: object
//  *             properties:
//  *               url:
//  *                 type: string
//  *               name:
//  *                 type: string
//  *               type:
//  *                 type: string
//  *           description: Array of document objects
//  *         paymentMode:
//  *           type: string
//  *           enum: [CASH, ONLINE, CHEQUE, OTHER]
//  *           description: Payment mode for insurance
//  *           example: ONLINE
//  *     InsuranceStatusInput:
//  *       type: object
//  *       required:
//  *         - status
//  *       properties:
//  *         status:
//  *           type: string
//  *           enum: [APPROVED, REJECTED]
//  *           description: New status for insurance
//  *           example: APPROVED
//  *         rejectionReason:
//  *           type: string
//  *           description: Required if status is REJECTED
//  *           example: Incomplete documents
//  */

// /**
//  * @swagger
//  * /api/v1/insurance/dashboard:
//  *   get:
//  *     summary: Get insurance dashboard counts (Admin+)
//  *     tags: [Insurance]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Insurance dashboard counts
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     pendingCount:
//  *                       type: integer
//  *                       description: Count of pending insurance requests
//  *                       example: 5
//  *                     approvedCount:
//  *                       type: integer
//  *                       description: Count of approved insurance requests
//  *                       example: 12
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden (not Admin+)
//  *       500:
//  *         description: Server error
//  */
// router.get('/dashboard',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
//   insuranceController.getInsuranceDashboard
// );

// /**
//  * @swagger
//  * /api/v1/insurance/{bookingId}:
//  *   post:
//  *     summary: Add insurance details for a booking (Admin+)
//  *     tags: [Insurance]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: bookingId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID of the booking to add insurance for
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/InsuranceInput'
//  *     responses:
//  *       201:
//  *         description: Insurance added successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Insurance'
//  *       400:
//  *         description: Invalid booking ID or missing required fields
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden (not Admin+)
//  *       404:
//  *         description: Booking not found
//  *       409:
//  *         description: Insurance already exists for this booking
//  *       500:
//  *         description: Server error
//  */
// router.post('/:bookingId',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
//   logAction('CREATE', 'Insurance'),
//   insuranceController.addInsurance
// );

// /**
//  * @swagger
//  * /api/v1/insurance/pending:
//  *   get:
//  *     summary: Get all pending insurance bookings (Admin+)
//  *     tags: [Insurance]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: List of pending insurance bookings
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/Insurance'
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden (not Admin+)
//  *       500:
//  *         description: Server error
//  */
// router.get('/pending',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
//   insuranceController.getPendingInsurances
// );

// /**
//  * @swagger
//  * /api/v1/insurance/approved:
//  *   get:
//  *     summary: Get all approved insurance bookings (Admin+)
//  *     tags: [Insurance]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: List of approved insurance bookings
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     $ref: '#/components/schemas/Insurance'
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden (not Admin+)
//  *       500:
//  *         description: Server error
//  */
// router.get('/approved',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN', 'SALES_EXECUTIVE'),
//   insuranceController.getApprovedInsurances
// );

// /**
//  * @swagger
//  * /api/v1/insurance/{bookingId}/status:
//  *   patch:
//  *     summary: Update insurance approval status (Admin+)
//  *     tags: [Insurance]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: bookingId
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: ID of the booking to update insurance status for
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/InsuranceStatusInput'
//  *     responses:
//  *       200:
//  *         description: Insurance status updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/Insurance'
//  *       400:
//  *         description: Invalid status or missing rejection reason
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden (not Admin+)
//  *       404:
//  *         description: Insurance not found for this booking
//  *       500:
//  *         description: Server error
//  */
// router.patch('/:bookingId/status',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
//   logAction('UPDATE_STATUS', 'Insurance'),
//   insuranceController.updateInsuranceStatus
// );

// /**
//  * @swagger
//  * /api/v1/insurance:
//  *   get:
//  *     summary: Get all insurance details (Admin+)
//  *     tags: [Insurance]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: List of all insurance details
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: array
//  *                   items:
//  *                     type: object
//  *                     properties:
//  *                       _id:
//  *                         type: string
//  *                       customerName:
//  *                         type: string
//  *                       chassisNumber:
//  *                         type: string
//  *                       insuranceDate:
//  *                         type: string
//  *                         format: date-time
//  *                       policyNumber:
//  *                         type: string
//  *                       rsaPolicyNumber:
//  *                         type: string
//  *                       cmsPolicyNumber:
//  *                         type: string
//  *                       premiumAmount:
//  *                         type: number
//  *                       validUptoDate:
//  *                         type: string
//  *                         format: date-time
//  *                       model:
//  *                         type: string
//  *                       vehicleRegNo:
//  *                         type: string
//  *                       insuranceCompany:
//  *                         type: string
//  *                       mobileNo:
//  *                         type: string
//  *                       paymentMode:
//  *                         type: string
//  *                       status:
//  *                         type: string
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden (not Admin+)
//  *       500:
//  *         description: Server error
//  */
// router.get('/',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
//   insuranceController.getAllInsuranceDetails
// );

// /**
//  * @swagger
//  * /api/v1/insurance/chassis/{chassisNumber}:
//  *   get:
//  *     summary: Get insurance details by chassis number (Admin+)
//  *     tags: [Insurance]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: chassisNumber
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Chassis number to search for
//  *     responses:
//  *       200:
//  *         description: Insurance details for the chassis number
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     _id:
//  *                       type: string
//  *                     customerName:
//  *                       type: string
//  *                     chassisNumber:
//  *                       type: string
//  *                     insuranceDate:
//  *                       type: string
//  *                       format: date-time
//  *                     policyNumber:
//  *                       type: string
//  *                     rsaPolicyNumber:
//  *                       type: string
//  *                     cmsPolicyNumber:
//  *                       type: string
//  *                     premiumAmount:
//  *                       type: number
//  *                     validUptoDate:
//  *                       type: string
//  *                       format: date-time
//  *                     model:
//  *                       type: string
//  *                     vehicleRegNo:
//  *                       type: string
//  *                     insuranceCompany:
//  *                       type: string
//  *                     mobileNo:
//  *                       type: string
//  *                     paymentMode:
//  *                       type: string
//  *                     status:
//  *                       type: string
//  *                     documents:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           url:
//  *                             type: string
//  *                           name:
//  *                             type: string
//  *                           type:
//  *                             type: string
//  *       400:
//  *         description: Invalid chassis number format
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden (not Admin+)
//  *       404:
//  *         description: Booking or insurance not found
//  *       500:
//  *         description: Server error
//  */
// router.get('/chassis/:chassisNumber',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN', 'SALES_EXECUTIVE'),
//   insuranceController.getInsuranceByChassisNumber
// );


/**
 * @swagger
 * /api/v1/insurance/awaiting-insurance:
 *   get:
 *     summary: Get all bookings awaiting insurance processing
 *     description: Retrieve a list of bookings that require insurance processing (Admin/Manager/Sales Executive access)
 *     tags: [Bookings]
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
 *                   example: true
 *                 count:
 *                   type: integer
 *                   description: Number of bookings found
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User doesn't have required permissions
 *       500:
 *         description: Internal server error
 * 
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 5f8d04b3ab3a1d2a3c4d5e6f
 *         bookingNumber:
 *           type: string
 *           example: "BK-2023-00123"
 *         customer:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "John Doe"
 *             mobile1:
 *               type: string
 *               example: "+919876543210"
 *         model:
 *           type: object
 *           properties:
 *             model_name:
 *               type: string
 *               example: "Swift Dzire"
 *         color:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Pearl White"
 *         chassisNumber:
 *           type: string
 *           example: "MA3FHEB1S00123456"
 *         bookingStatus:
 *           type: string
 *           example: "DELIVERED"
 *         insuranceStatus:
 *           type: string
 *           example: "PENDING"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2023-01-15T10:30:00.000Z"
 */
router.get(
  '/awaiting-insurance',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN', 'SALES_EXECUTIVE'),
  insuranceController.getBookingsAwaitingInsurance
);

// router.get('/chassis/:chassisNumber',
//   protect,
//   authorize('ADMIN', 'MANAGER', 'SUPERADMIN', 'SALES_EXECUTIVE'),
//   insuranceController.getInsuranceByChassisNumber
// );
 module.exports = router;