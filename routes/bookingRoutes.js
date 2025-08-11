const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/auth');
const { validateSalesExecutive } = require('../middlewares/validateSalesExecutive');
const pdfController = require('../controllers/pdfController');
const { logAction } = require('../middlewares/audit');
const qrController = require('../controllers/qrController');
const Vehicle = require('../models/vehicleInwardModel');


// const { checkSalesExecutiveStatus } = require('../middlewares/userStatusMiddleware');

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
 * /api/v1/bookings/pfbookings:
 *   get:
 *     summary: Get all fully paid bookings with pending RTO status
 *     description: Returns bookings where balanceAmount is 0 and rtoStatus is 'pending'
 *     tags:
 *       - Bookings
 *     responses:
 *       200:
 *         description: List of fully paid bookings with pending RTO status
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
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 64cb5c2f6f8ef21a3819a7b2
 *                       bookingId:
 *                         type: string
 *                         example: BK20250729
 *                       customerName:
 *                         type: string
 *                         example: Rutik Jadhav
 *                       chassisNumber:
 *                         type: string
 *                         example: CH123456789
 *                       balanceAmount:
 *                         type: number
 *                         example: 0
 *                       rtoStatus:
 *                         type: string
 *                         example: pending
 *                       model:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Activa 6G
 *                       color:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Red
 *                       branch:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Hadapsar Branch
 *                       salesExecutive:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Raj Patel
 *                           email:
 *                             type: string
 *                             example: raj.patel@example.com
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-07-28T10:20:00Z
 */
router.get('/pfbookings', bookingController.getFullyPaidPendingRTOBookings);

/**
 * @swagger
 * /api/v1/bookings/insurance-status/{status}:
 *   get:
 *     summary: Get bookings by insurance status
 *     description: Returns a list of bookings filtered by a specific insurance status (AWAITING, COMPLETED, LATER).
 *     tags:
 *       - Bookings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: ['AWAITING', 'COMPLETED', 'LATER']
 *           example: AWAITING
 *         description: The insurance status to filter bookings by.
 *     responses:
 *       200:
 *         description: List of bookings filtered by insurance status
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
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 64cb5c2f6f8ef21a3819a7b2
 *                       bookingId:
 *                         type: string
 *                         example: BK20250810
 *                       customerName:
 *                         type: string
 *                         example: Priya Sharma
 *                       insuranceStatus:
 *                         type: string
 *                         enum: ['AWAITING', 'COMPLETED', 'LATER']
 *                         example: AWAITING
 *                       model:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Activa 6G
 *                       color:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Pearl White
 *                       branch:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Hadapsar Branch
 *                       salesExecutive:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: Anil Kumar
 *                           email:
 *                             type: string
 *                             example: anil.kumar@example.com
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-08-10T10:20:00Z
 *       400:
 *         description: Invalid insurance status provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/insurance-status/:status', protect, bookingController.getBookingsByInsuranceStatus);


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
  // validateSalesExecutive,
  authorize('BOOKING', 'CREATE'), 
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),
  logAction('CREATE', 'Booking'), 
  bookingController.createBooking
);

/**
 * @swagger
 * /api/v1/bookings/stats:
 *   get:
 *     summary: Get booking statistics and document counts
 *     description: |
 *       Returns counts of bookings (today, this week, this month) and pending document counts.
 *       SuperAdmin sees all data with sales executive breakdown, others see only their own data.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Booking statistics
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
 *                     counts:
 *                       type: object
 *                       properties:
 *                         today:
 *                           type: number
 *                           description: Bookings created today
 *                         thisWeek:
 *                           type: number
 *                           description: Bookings created this week
 *                         thisMonth:
 *                           type: number
 *                           description: Bookings created this month
 *                     pendingDocuments:
 *                       type: object
 *                       properties:
 *                         kyc:
 *                           type: number
 *                           description: Count of pending KYC documents
 *                         financeLetter:
 *                           type: number
 *                           description: Count of pending Finance Letters
 *                     salesExecutiveStats:
 *                       type: array
 *                       description: Only shown for SuperAdmin - bookings by sales executive
 *                       items:
 *                         type: object
 *                         properties:
 *                           salesExecutiveId:
 *                             type: string
 *                           salesExecutiveName:
 *                             type: string
 *                           salesExecutiveEmail:
 *                             type: string
 *                           count:
 *                             type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/stats', 
  protect,
  authorize('BOOKING', 'READ'),
  bookingController.getBookingStats
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'), 
  authorize('BOOKING', 'APPROVE'),
  async (req, res) => {
    try {
      const branchId = req.user.isSuperAdmin ? null : req.user.branch;
      const pendingUpdates = await qrController.getPendingUpdateRequests(branchId);
      
      res.json({
        success: true,
        count: pendingUpdates.length,
        data: pendingUpdates
      });
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
  authorize('BOOKING', 'UPDATE'),  // Changed to permission check
  logAction('UPDATE', 'Booking'), 
  bookingController.updateBooking
);

/**
 * @swagger
 * /api/v1/bookings/{id}/approve:
 *   put:
 *     summary: Approve a booking (simple version - just updates status)
 *     description: |
 *       Updates booking status to APPROVED and records approval details.
 *       Requires ADMIN or MANAGER role.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Booking ID to approve
 *     requestBody:
 *       description: Optional approval note
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approvalNote:
 *                 type: string
 *                 description: Optional note about the approval
 *                 example: "Customer documents verified"
 *     responses:
 *       200:
 *         description: Booking approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *                 message:
 *                   type: string
 *                   example: "Booking approved successfully"
 *       400:
 *         description: Invalid booking ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid booking ID format"
 *       403:
 *         description: Unauthorized to approve bookings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Unauthorized to approve bookings"
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Booking not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id/approve', 
  protect,
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
  authorize('BOOKING', 'APPROVE'),  // Specific approve permission
  logAction('APPROVE', 'Booking'), 
  bookingController.approveBooking
);
/**
 * @swagger
 * /api/v1/bookings/{id}/allocate:
 *   put:
 *     summary: Allocate chassis number to a booking
 *     description: |
 *       Assigns a 17-character chassis number to a booking and updates status to ALLOCATED.
 *       Requires ADMIN or MANAGER role.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Booking ID to allocate chassis number to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chassisNumber
 *             properties:
 *               chassisNumber:
 *                 type: string
 *                 pattern: '^[A-Z0-9]{17}$'
 *                 description: 17-character alphanumeric chassis number
 *                 example: "MA6FRE4521KM12345"
 *     responses:
 *       200:
 *         description: Chassis number allocated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *                 message:
 *                   type: string
 *                   example: "Chassis number allocated successfully"
 *       400:
 *         description: Invalid input (bad ID format, invalid chassis number, or duplicate)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidId:
 *                 value:
 *                   success: false
 *                   message: "Invalid booking ID format"
 *               invalidChassis:
 *                 value:
 *                   success: false
 *                   message: "Chassis number must be exactly 17 alphanumeric characters"
 *               duplicateChassis:
 *                 value:
 *                   success: false
 *                   message: "Chassis number already assigned to another booking"
 *       403:
 *         description: Unauthorized to allocate chassis numbers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Unauthorized to allocate chassis numbers"
 *       404:
 *         description: Booking not found or not in valid status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Booking not found or not in a valid status for allocation"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id/allocate', 
  protect,
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
  authorize('BOOKING', 'ALLOCATE'),  // Specific approve permission
  logAction('ALLOCATE', 'Booking'), 
  bookingController.allocateChassisNumber
);
// Add this to your routes file
// /**
//  * @swagger
//  * /api/v1/bookings/{chassisNumber}:
//  *   get:
//  *     summary: Retrieve vehicle details by chassis number
//  *     description: |
//  *       Fetches critical vehicle components by its 17-character chassis number.
//  *       Returns battery, key, motor, charger, and engine numbers along with status.
//  *     tags: [Vehicle Testing]
//  *     parameters:
//  *       - in: path
//  *         name: chassisNumber
//  *         required: true
//  *         schema:
//  *           type: string
//  *           pattern: '^[A-Z0-9]{17}$'
//  *           example: "MA6FRE4521KM12345"
//  *         description: 17-character alphanumeric chassis number (case insensitive)
//  *     responses:
//  *       200:
//  *         description: Vehicle details retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     batteryNumber:
//  *                       type: string
//  *                     keyNumber:
//  *                       type: string
//  *                     motorNumber:
//  *                       type: string
//  *                     chargerNumber:
//  *                       type: string
//  *                     engineNumber:
//  *                       type: string
//  *                     status:
//  *                       type: string
//  *       400:
//  *         description: Invalid chassis number format
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  *             example:
//  *               success: false
//  *               message: "Invalid chassis number format"
//  *       404:
//  *         description: Vehicle not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  *             example:
//  *               success: false
//  *               message: "Vehicle not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               $ref: '#/components/schemas/ErrorResponse'
//  *             example:
//  *               success: false
//  *               message: "Server error"
//  */
// router.get('/:chassisNumber', async (req, res) => {
//   try {
//     const { chassisNumber } = req.params;
    
//     // Updated validation to be more permissive while maintaining length requirement
//     if (!chassisNumber || chassisNumber.length !== 17 || !/^[A-Z0-9]+$/i.test(chassisNumber)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid chassis number format - must be exactly 17 alphanumeric characters'
//       });
//     }

//     const vehicle = await Vehicle.findOne({ 
//       chassisNumber: chassisNumber.toUpperCase() 
//     }).select('batteryNumber keyNumber motorNumber chargerNumber engineNumber status');

//     if (!vehicle) {
//       return res.status(404).json({
//         success: false,
//         message: 'Vehicle not found'
//       });
//     }

//     res.json({
//       success: true,
//       data: vehicle
//     });
//   } catch (err) {
//     console.error('Test vehicle lookup error:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error'
//     });
//   }
// });
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
  authorize('BOOKING', 'COMPLETE'),  // Specific complete permission
  logAction('COMPLETE', 'Booking'), 
  bookingController.completeBooking
);
/**
 * @swagger
 * /api/v1/bookings/chassis/{chassisNumber}:
 *   get:
 *     summary: Get booking by chassis number
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chassisNumber
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{17}$'
 *         description: 17-character chassis number
 *     responses:
 *       200:
 *         description: Booking details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Invalid chassis number format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not authorized to view this booking)
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/chassis/:chassisNumber', 
  protect,
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
  authorize('BOOKING', 'READ'),
  bookingController.getBookingByChassisNumber
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'), 
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'),  
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'), 
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'), 
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'), 
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

// /**
//  * @swagger
//  * /api/v1/bookings/{id}/update-form:
//  *   get:
//  *     summary: Get booking data for update form
//  *     tags: [Bookings]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Booking ID
//  *     responses:
//  *       200:
//  *         description: Booking data and form HTML
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 booking:
//  *                   $ref: '#/components/schemas/Booking'
//  *                 formHtml:
//  *                   type: string
//  *                   description: HTML content of the form
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden
//  *       404:
//  *         description: Booking not found
//  *       500:
//  *         description: Server error
//  */
// router.get('/:id/update-form', 
//   async (req, res) => {
//     try {
//       const result = await qrController.getBookingForUpdateForm(req.params.id);
//       res.json(result);
//     } catch (error) {
//       res.status(500).json({ 
//         success: false, 
//         message: error.message 
//       });
//     }
//   }
// );

/**
 * @swagger
 * /api/v1/bookings/{id}/submit-update:
 *   post:
 *     summary: Submit booking update request (unauthenticated)
 *     tags: [Bookings]
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
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/v1/bookings/{id}/submit-update:
 *   post:
 *     summary: Submit booking update request (unauthenticated)
 *     tags: [Bookings]
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
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:id/submit-update', 
  qrController.submitUpdateRequest
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
  // authorize('SUPERADMIN','SALES_EXECUTIVE'), 
  authorize('BOOKING', 'APPROVE'),
  logAction('APPROVE_UPDATE', 'Booking'),
  async (req, res) => {
    try {
      const result = await qrController.approveUpdateRequest(req, res);
      if (!res.headersSent) {
        res.json(result);
      }
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
 * /api/v1/bookings/{id}/update-form:
 *   get:
 *     summary: Get booking update form HTML
 *     description: Returns an HTML form for updating booking details, accessible via QR code
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: HTML form for updating booking
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid booking ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
router.get('/:id/update-form', bookingController.getUpdateForm);
// bookingRoutes.js - Add this new route

/**
 * @swagger
 * /api/v1/bookings/{id}/pending-update:
 *   get:
 *     summary: Get pending update request for a specific booking
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
 *         description: Pending update request details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Booking ID
 *                 bookingNumber:
 *                   type: string
 *                   description: Booking number
 *                 customerName:
 *                   type: string
 *                   description: Customer name
 *                 model:
 *                   type: string
 *                   description: Model name
 *                 color:
 *                   type: string
 *                   description: Color name
 *                 pendingUpdates:
 *                   type: object
 *                   description: Requested updates
 *                 updateRequestStatus:
 *                   type: string
 *                   enum: [NONE, PENDING, APPROVED, REJECTED]
 *                   description: Update request status
 *                 updateRequestNote:
 *                   type: string
 *                   description: Update request note
 *                 updateRequestedBy:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid booking ID or no pending updates
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:id/pending-update', 
  protect, 
  authorize('BOOKING', 'APPROVE'),
  async (req, res) => {
    try {
      const pendingUpdate = await qrController.getPendingUpdateRequestById(req.params.id);
      res.json({
        success: true,
        data: pendingUpdate
      });
    } catch (error) {
      let statusCode = 500;
      if (error.message === 'Invalid booking ID format') statusCode = 400;
      if (error.message === 'Booking not found') statusCode = 404;
      if (error.message === 'No pending update request found for this booking') statusCode = 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);



module.exports = router;