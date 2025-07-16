const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/auth');
const pdfController = require('../controllers/pdfController');
const { logAction } = require('../middlewares/audit');
const qrController = require('../controllers/qrController');
// router.use(protect);
/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Vehicle booking management
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
 *           examples:
 *             B2C Booking:
 *               value:
 *                 model: "60d5ec9f8f9a8e001f4e8a9a"
 *                 color: "60d5ec9f8f9a8e001f4e8a9b"
 *                 customerType: "B2C"
 *                 rto: "MH"
 *                 personalDetails:
 *                   salutation: "Mr."
 *                   name: "John Doe"
 *                   mobile1: "9876543210"
 *                   address: "123 Main St"
 *                   pincode: "400001"
 *                 payment:
 *                   type: "CASH"
 *                   amount: 500000
 *                 branch: "60d5ec9f8f9a8e001f4e8a9c"
 *             B2B Booking:
 *               value:
 *                 model: "60d5ec9f8f9a8e001f4e8a9a"
 *                 color: "60d5ec9f8f9a8e001f4e8a9b"
 *                 customerType: "B2B"
 *                 gstin: "22AAAAA0000A1Z5"
 *                 rto: "BH"
 *                 rtoAmount: 15000
 *                 personalDetails:
 *                   salutation: "Mr."
 *                   name: "Business Corp"
 *                   mobile1: "9876543210"
 *                   address: "456 Business Ave"
 *                   pincode: "400002"
 *                 payment:
 *                   type: "FINANCE"
 *                   amount: 500000
 *                   financer: "60d5ec9f8f9a8e001f4e8a9d"
 *                   scheme: "Special Offer"
 *                 branch: "60d5ec9f8f9a8e001f4e8a9c"
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Validation error or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     BookingRequest:
 *       type: object
 *       required:
 *         - model_id
 *         - model_color
 *         - customer_type
 *         - rto_type
 *         - customer_details
 *         - payment
 *         - branch
 *       properties:
 *         model_id:
 *           type: string
 *           example: "685d1c1d7c59ad32056ab6e7"
 *         model_color:
 *           type: string
 *           example: "Red"
 *         customer_type:
 *           type: string
 *           enum: [B2B, B2C]
 *           example: "B2C"
 *         gstin:
 *           type: string
 *           example: ""
 *         rto_type:
 *           type: string
 *           enum: [MH, BH, CRTM]
 *           example: "BH"
 *         rto_amount:
 *           type: number
 *           example: 5000
 *         hpa:
 *           type: boolean
 *           example: true
 *         price_components:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               header_id:
 *                 type: string
 *                 example: "685bdfc67d7436e62972ec9c"
 *               value:
 *                 type: number
 *                 example: 46954
 *               is_discount:
 *                 type: boolean
 *                 example: false
 *         discount:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [amount, percentage]
 *               example: "amount"
 *             value:
 *               type: number
 *               example: 5000
 *         customer_details:
 *           type: object
 *           required:
 *             - name
 *             - gender
 *             - mobile1
 *           properties:
 *             name:
 *               type: string
 *               example: "Devita Aher"
 *             gender:
 *               type: string
 *               enum: [Male, Female, Other]
 *               example: "Female"
 *             dob:
 *               type: string
 *               format: date
 *               example: "1998-10-21"
 *             occupation:
 *               type: string
 *               example: "Software Developer"
 *             address:
 *               type: string
 *               example: "CIDCO, Nashik"
 *             taluka:
 *               type: string
 *               example: "Nashik"
 *             district:
 *               type: string
 *               example: "Nashik"
 *             pincode:
 *               type: string
 *               example: "422009"
 *             mobile1:
 *               type: string
 *               example: "9876543210"
 *             mobile2:
 *               type: string
 *               example: "1234567890"
 *             aadhar_number:
 *               type: string
 *               example: "123456789012"
 *             nominee_name:
 *               type: string
 *               example: "Rajendra Aher"
 *             nominee_relation:
 *               type: string
 *               example: "Father"
 *             nominee_age:
 *               type: number
 *               example: 50
 *         exchange:
 *           type: object
 *           properties:
 *             is_exchange:
 *               type: boolean
 *               example: true
 *             broker_id:
 *               type: string
 *               example: "broker123"
 *             fixed_broker_price:
 *               type: number
 *               example: 1000
 *             variable_broker_price:
 *               type: number
 *               example: 500
 *             exchange_price:
 *               type: number
 *               example: 20000
 *             vehicle_number:
 *               type: string
 *               example: "MH15XY1234"
 *             chassis_number:
 *               type: string
 *               example: "CH123456789"
 *         payment:
 *           type: object
 *           required:
 *             - type
 *             - amount
 *           properties:
 *             type:
 *               type: string
 *               enum: [cash, finance]
 *               example: "finance"
 *             financer_id:
 *               type: string
 *               example: "financer001"
 *             scheme:
 *               type: string
 *               example: "Gold EMI"
 *             emi_plan:
 *               type: string
 *               example: "12 Months"
 *             gc_applicable:
 *               type: boolean
 *               example: true
 *             gc_amount:
 *               type: number
 *               example: 1500
 *             amount:
 *               type: number
 *               example: 60000
 *         accessories:
 *           type: object
 *           properties:
 *             selected:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Seat Cover"
 *                   price:
 *                     type: number
 *                     example: 700
 *             accessories_total_header:
 *               type: number
 *               example: 1800
 *         branch:
 *           type: string
 *           example: "685641b4a584a450570f20ae"
 * 
 *     BookingResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           $ref: '#/components/schemas/Booking'
 * 
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Error message describing what went wrong"
 *         error:
 *           type: string
 *           description: "Detailed error stack (only in development)"
 */

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a new two-wheeler booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookingRequest'
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingResponse'
 *       400:
 *         description: Validation error or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect, 
  authorize('BOOKING', 'CREATE'), 
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
 *         description: Filter bookings from this date (YYYY-MM-DD)
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter bookings to this date (YYYY-MM-DD)
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookings:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Booking'
 *                     total:
 *                       type: integer
 *                       description: Total number of items
 *                     pages:
 *                       type: integer
 *                       description: Total number of pages
 *                     currentPage:
 *                       type: integer
 *                       description: Current page number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       500:
 *         description: Server error
 */
router.get('/', 
  protect, 
  authorize('BOOKING', 'READ'),  // Changed to permission check
  bookingController.getAllBookings
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
  authorize('BOOKING', 'READ'),  // Changed to permission check
  bookingController.getBookingById
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not authorized to update this booking)
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', 
  protect, 
  authorize('BOOKING', 'UPDATE'),  // Changed to permission check
  logAction('UPDATE', 'Booking'), 
  bookingController.updateBooking
);

/**
 * @swagger
 * /api/v1/bookings/{id}/approve:
 *   post:
 *     summary: Approve a booking and optionally allocate chassis number
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
 *                 description: Optional note for approval
 *               chassisNumber:
 *                 type: string
 *                 description: Optional 17-character chassis number to allocate
 *                 example: "MA6FRE4521KM12345"
 *     responses:
 *       200:
 *         description: Booking approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid input or booking doesn't require approval
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
  authorize('BOOKING', 'APPROVE'),  // Specific approve permission
  logAction('APPROVE', 'Booking'), 
  bookingController.approveBooking
);
/**
 * @swagger
 * /api/v1/bookings/{id}/form:
 *   get:
 *     summary: Get booking form HTML by ID
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
 *         description: Booking form HTML content
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/form', 
  protect, 
  authorize('BOOKING', 'READ'),
  bookingController.getBookingForm
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
 *                 description: Reason for rejection
 *     responses:
 *       200:
 *         description: Booking rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Booking doesn't require approval
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no approval permission)
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/reject', 
  protect, 
  authorize('BOOKING', 'APPROVE'),  // Uses same permission as approve
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no complete permission)
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/complete', 
  protect, 
  authorize('BOOKING', 'COMPLETE'),  // Specific complete permission
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
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Booking cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Booking cannot be cancelled in current state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no cancel permission)
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/cancel', 
  protect, 
  authorize('BOOKING', 'CANCEL'),  // Specific cancel permission
  logAction('CANCEL', 'Booking'), 
  bookingController.cancelBooking
);


/**
 * @swagger
 * /api/v1/bookings/{id}/receipt:
 *   get:
 *     summary: Generate booking receipt (PDF)
 *     description: Generates a PDF booking receipt. Only available for APPROVED or COMPLETED bookings.
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
 *         description: PDF booking receipt
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Booking not in APPROVED or COMPLETED state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/receipt', 
  protect, 
  authorize('BOOKING', 'READ'),  // Only need read access
  pdfController.generateBookingReceipt
);

/**
 * @swagger
 * /api/v1/bookings/{id}/helmet-invoice:
 *   get:
 *     summary: Generate helmet invoice (PDF)
 *     description: Generates a PDF invoice for the standard helmet included with the vehicle.
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
 *         description: PDF helmet invoice
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/helmet-invoice', 
  protect, 
  authorize('BOOKING', 'READ'),  // Only need read access
  pdfController.generateHelmetInvoice
);

/**
 * @swagger
 * /api/v1/bookings/{id}/accessories-challan:
 *   get:
 *     summary: Generate accessories challan (PDF)
 *     description: Generates a PDF accessories challan for the booking. Only available if booking has accessories.
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
 *         description: PDF accessories challan
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Booking has no accessories
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/accessories-challan', 
  protect, 
  authorize('BOOKING', 'READ'),  // Only need read access
  pdfController.generateAccessoriesChallan
);
/**
 * @swagger
 * /api/v1/bookings/{id}/documents:
 *   get:
 *     summary: Get booking with KYC and Finance Letter status
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
 *         description: Booking details with document statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *                 kycStatus:
 *                   type: string
 *                   enum: [PENDING, SUBMITTED, APPROVED, REJECTED]
 *                   description: Current KYC status
 *                 financeLetterStatus:
 *                   type: string
 *                   enum: [PENDING, SUBMITTED, APPROVED, REJECTED]
 *                   description: Current Finance Letter status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/documents',
  protect,
  authorize('BOOKING', 'READ'),
  bookingController.getBookingWithDocuments
);

/**
 * @swagger
 * /api/v1/bookings/{id}/ready-for-delivery:
 *   get:
 *     summary: Check if booking is ready for delivery
 *     description: Verifies all required documents (KYC, Finance Letter) are approved
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
 *         description: Delivery readiness status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                   description: Whether booking is ready for delivery
 *                 missingRequirements:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of missing requirements if not ready
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/ready-for-delivery',
  protect,
  authorize('BOOKING', 'READ'),
  bookingController.checkReadyForDelivery
);
/**
 * @swagger
 * /api/v1/bookings/{id}/qr-code:
 *   get:
 *     summary: Generate QR code for a booking
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
 *         description: QR code image as data URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 *                   description: Data URL of the QR code image
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/qr-code', 
  protect, 
  authorize('BOOKING', 'READ'),
  async (req, res) => {
    try {
      const qrCode = await qrController.generateQRCode(req.params.id);
      res.json({ qrCode });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/bookings/{id}/update-form:
 *   get:
 *     summary: Get booking data for update form
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
 *         description: Booking data and form HTML
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *                 formHtml:
 *                   type: string
 *                   description: HTML content of the form
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/update-form', 
  async (req, res) => {
    try {
      const result = await qrController.getBookingForUpdateForm(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/bookings/{id}/submit-update:
 *   post:
 *     summary: Submit booking update request
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
 *             type: object
 *             properties:
 *               updates:
 *                 type: object
 *                 description: Fields to update
 *     responses:
 *       200:
 *         description: Update request submitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid update request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/submit-update', 
  protect,
  async (req, res) => {
    try {
      const booking = await qrController.submitUpdateRequest(
        req.params.id, 
        req.body.updates, 
        req.user.id
      );
      res.json(booking);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/bookings/{id}/approve-update:
 *   post:
 *     summary: Approve booking update request
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
 *               note:
 *                 type: string
 *                 description: Optional approval note
 *     responses:
 *       200:
 *         description: Update approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/approve-update', 
  protect, 
  authorize('BOOKING', 'APPROVE'),
  logAction('APPROVE_UPDATE', 'Booking'),
  async (req, res) => {
    try {
      const booking = await qrController.processUpdateRequest(
        req.params.id, 
        'APPROVE', 
        req.user.id,
        req.body.note
      );
      res.json(booking);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/bookings/{id}/reject-update:
 *   post:
 *     summary: Reject booking update request
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
 *               note:
 *                 type: string
 *                 description: Optional rejection note
 *     responses:
 *       200:
 *         description: Update rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/reject-update', 
  protect, 
  authorize('BOOKING', 'APPROVE'),
  logAction('REJECT_UPDATE', 'Booking'),
  async (req, res) => {
    try {
      const booking = await qrController.processUpdateRequest(
        req.params.id, 
        'REJECT', 
        req.user.id,
        req.body.note
      );
      res.json(booking);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/bookings/pending-updates:
 *   get:
 *     summary: Get pending update requests
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookings with pending updates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/pending-updates', 
  protect, 
  authorize('BOOKING', 'APPROVE'),
  async (req, res) => {
    try {
      const branchId = req.user.isSuperAdmin ? null : req.user.branch;
      const bookings = await qrController.getPendingUpdateRequests(branchId);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);
module.exports = router;