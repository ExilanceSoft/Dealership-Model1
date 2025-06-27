const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Vehicle booking management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       required:
 *         - model
 *         - color
 *         - customerType
 *         - rto
 *         - personalDetails
 *         - payment
 *         - branch
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the booking
 *         bookingNumber:
 *           type: string
 *           description: Auto-generated booking number
 *         model:
 *           type: string
 *           description: ID of the selected vehicle model
 *         color:
 *           type: string
 *           description: ID of the selected color
 *         customerType:
 *           type: string
 *           enum: [B2B, B2C]
 *           description: Type of customer (B2B or B2C)
 *         gstin:
 *           type: string
 *           description: GSTIN number (required for B2B)
 *         rto:
 *           type: string
 *           description: ID of the selected RTO
 *         rtoAmount:
 *           type: number
 *           description: RTO charges (required for certain RTOs)
 *         hpa:
 *           type: boolean
 *           description: Whether HPA (Hypothecation) is selected
 *         hypothecationCharges:
 *           type: number
 *           description: HPA charges if applicable
 *         personalDetails:
 *           type: object
 *           properties:
 *             salutation:
 *               type: string
 *               enum: [Mr., Mrs., Miss]
 *             name:
 *               type: string
 *             birthDate:
 *               type: string
 *               format: date
 *             occupation:
 *               type: string
 *             address:
 *               type: string
 *             taluka:
 *               type: string
 *             district:
 *               type: string
 *             pincode:
 *               type: string
 *             mobile1:
 *               type: string
 *             mobile2:
 *               type: string
 *             aadharNumber:
 *               type: string
 *             nomineeName:
 *               type: string
 *             nomineeRelation:
 *               type: string
 *             nomineeAge:
 *               type: number
 *         exchange:
 *           type: boolean
 *           description: Whether exchange vehicle is selected
 *         exchangeDetails:
 *           type: object
 *           properties:
 *             broker:
 *               type: string
 *               description: ID of the selected broker
 *             price:
 *               type: number
 *             vehicleNumber:
 *               type: string
 *             chassisNumber:
 *               type: string
 *             commissionType:
 *               type: string
 *               enum: [FIXED, VARIABLE]
 *             commissionAmount:
 *               type: number
 *         payment:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [CASH, FINANCE]
 *             amount:
 *               type: number
 *             financer:
 *               type: string
 *               description: ID of the financer (required for FINANCE)
 *             scheme:
 *               type: string
 *             emiDetails:
 *               type: string
 *             gcApplicable:
 *               type: boolean
 *             gcAmount:
 *               type: number
 *         accessories:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               accessory:
 *                 type: string
 *                 description: ID of the accessory
 *               price:
 *                 type: number
 *               discount:
 *                 type: number
 *         priceComponents:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               header:
 *                 type: string
 *                 description: ID of the price header
 *               originalValue:
 *                 type: number
 *               discountedValue:
 *                 type: number
 *               isDiscountable:
 *                 type: boolean
 *               isMandatory:
 *                 type: boolean
 *         discounts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [FIXED, PERCENTAGE]
 *               approvedBy:
 *                 type: string
 *                 description: ID of approving user
 *               approvalStatus:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *               approvalNote:
 *                 type: string
 *         totalAmount:
 *           type: number
 *           description: Total amount after all calculations
 *         status:
 *           type: string
 *           enum: [DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED]
 *           default: DRAFT
 *         branch:
 *           type: string
 *           description: ID of the branch where booking was made
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the booking
 *         approvedBy:
 *           type: string
 *           description: ID of the user who approved the booking
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Booking'
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect, 
  authorize('SALES', 'ADMIN', 'SUPERADMIN'),
  logAction('CREATE', 'Booking'), 
  bookingController.createBooking
);

/**
 * @swagger
 * /api/v1/bookings:
 *   get:
 *     summary: Get all bookings (filterable)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED]
 *         description: Filter by status
 *       - in: query
 *         name: customerType
 *         schema:
 *           type: string
 *           enum: [B2B, B2C]
 *         description: Filter by customer type
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Filter by model ID
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter bookings from this date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter bookings to this date
 *     responses:
 *       200:
 *         description: List of bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', 
  protect, 
  authorize('SALES', 'ADMIN', 'SUPERADMIN'),
  bookingController.getBookings
);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not authorized to view this booking)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id', 
  protect, 
  authorize('SALES', 'ADMIN', 'SUPERADMIN'),
  bookingController.getBooking
);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   put:
 *     summary: Update booking (only DRAFT or PENDING_APPROVAL status)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Booking'
 *     responses:
 *       200:
 *         description: Booking updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Validation error or invalid status for update
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not authorized to update this booking)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.put('/:id', 
  protect, 
  authorize('SALES', 'ADMIN', 'SUPERADMIN'),
  logAction('UPDATE', 'Booking'), 
  bookingController.updateBooking
);

/**
 * @swagger
 * /api/v1/bookings/{id}/approve:
 *   post:
 *     summary: Approve a booking (requires APPROVE_BOOKING permission)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approvalNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Booking doesn't require approval
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no approval permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/approve', 
  protect, 
  authorize('MANAGER', 'ADMIN', 'SUPERADMIN'),
  logAction('APPROVE', 'Booking'), 
  bookingController.approveBooking
);

/**
 * @swagger
 * /api/v1/bookings/{id}/reject:
 *   post:
 *     summary: Reject a booking (requires APPROVE_BOOKING permission)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rejectionNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Booking doesn't require approval
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no approval permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/reject', 
  protect, 
  authorize('MANAGER', 'ADMIN', 'SUPERADMIN'),
  logAction('REJECT', 'Booking'), 
  bookingController.rejectBooking
);

/**
 * @swagger
 * /api/v1/bookings/{id}/complete:
 *   post:
 *     summary: Mark booking as completed (requires COMPLETE_BOOKING permission)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Booking cannot be completed in current state
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no complete permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/complete', 
  protect, 
  authorize('SALES', 'ADMIN', 'SUPERADMIN'),
  logAction('COMPLETE', 'Booking'), 
  bookingController.completeBooking
);

/**
 * @swagger
 * /api/v1/bookings/{id}/cancel:
 *   post:
 *     summary: Cancel a booking (requires CANCEL_BOOKING permission)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancellationReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Booking cannot be cancelled in current state
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no cancel permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/cancel', 
  protect, 
  authorize('SALES', 'ADMIN', 'SUPERADMIN'),
  logAction('CANCEL', 'Booking'), 
  bookingController.cancelBooking
);

module.exports = router;