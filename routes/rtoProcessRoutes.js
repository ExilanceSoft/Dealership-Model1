const express = require("express");
const router = express.Router();
const rtoController = require("../controllers/rtoProcess");
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: RTO Processes
 *   description: RTO process management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RtoProcess:
 *       type: object
 *       required:
 *         - bookingId
 *         - rtoId
 *         - customerName
 *         - chassisNumber
 *         - modelName
 *         - bookingDate
 *         - mobileNumber
 *         - rtoAmount
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the RTO process
 *           example: 507f1f77bcf86cd799439011
 *         bookingId:
 *           type: string
 *           description: Unique booking ID
 *           example: BOOK12345
 *         rtoId:
 *           type: string
 *           description: RTO ID
 *           example: RTO123
 *         customerName:
 *           type: string
 *           description: Customer's full name
 *           example: John Doe
 *         chassisNumber:
 *           type: string
 *           description: 17-character vehicle chassis number
 *           example: MA3EDLBS001234567
 *         modelName:
 *           type: string
 *           description: Vehicle model name
 *           example: Honda City
 *         bookingDate:
 *           type: string
 *           format: date-time
 *           description: Booking date
 *           example: "2023-01-01T00:00:00.000Z"
 *         mobileNumber:
 *           type: string
 *           description: Customer's mobile number
 *           example: "9876543210"
 *         rtoStatus:
 *           type: string
 *           enum: ["Pending", "Completed", "Rejected", "In Progress"]
 *           description: Current RTO status
 *           example: Pending
 *         contactNumber:
 *           type: string
 *           description: Alternate contact number
 *           example: "9876543210"
 *         rtoPaperStatus:
 *           type: string
 *           enum: ["Not Submitted", "Submitted", "Verified", "Rejected"]
 *           description: Paper submission status
 *           example: Not Submitted
 *         rtoAmount:
 *           type: number
 *           description: RTO fees amount
 *           example: 15000
 *         numberPlate:
 *           type: string
 *           description: Vehicle number plate
 *           example: MH01AB1234
 *         receiptNumber:
 *           type: string
 *           description: RTO receipt number
 *           example: RCPT12345
 *         rtoPendingTaxStatus:
 *           type: string
 *           enum: ["Paid", "Unpaid", "N/A"]
 *           description: Tax payment status
 *           example: N/A
 *         hsrbOrdering:
 *           type: boolean
 *           description: HSRB ordering status
 *           example: false
 *         hsrbInstallation:
 *           type: boolean
 *           description: HSRB installation status
 *           example: false
 *         rcConfirmation:
 *           type: boolean
 *           description: RC confirmation status
 *           example: false
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the record
 *           example: 507f1f77bcf86cd799439012
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the record was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the record was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 *     RtoProcessInput:
 *       type: object
 *       required:
 *         - bookingId
 *         - rtoId
 *         - customerName
 *         - chassisNumber
 *         - modelName
 *         - bookingDate
 *         - mobileNumber
 *         - rtoAmount
 *       properties:
 *         bookingId:
 *           type: string
 *           example: BOOK12345
 *         rtoId:
 *           type: string
 *           example: RTO123
 *         customerName:
 *           type: string
 *           example: John Doe
 *         chassisNumber:
 *           type: string
 *           example: MA3EDLBS001234567
 *         modelName:
 *           type: string
 *           example: Honda City
 *         bookingDate:
 *           type: string
 *           format: date-time
 *           example: "2023-01-01T00:00:00.000Z"
 *         mobileNumber:
 *           type: string
 *           example: "9876543210"
 *         rtoAmount:
 *           type: number
 *           example: 15000
 *         contactNumber:
 *           type: string
 *           example: "9876543210"
 *         numberPlate:
 *           type: string
 *           example: MH01AB1234
 *         receiptNumber:
 *           type: string
 *           example: RCPT12345
 */

/**
 * @swagger
 * /api/v1/rtoProcess:
 *   post:
 *     summary: Create a new RTO process (Admin+)
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RtoProcessInput'
 *     responses:
 *       201:
 *         description: RTO process created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RtoProcess'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post("/",
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('CREATE', 'RtoProcess'),
  rtoController.createRtoProcess
);

/**
 * @swagger
 * /api/v1/rtoProcess:
 *   get:
 *     summary: Get all RTO processes (Admin+)
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rtoStatus
 *         schema:
 *           type: string
 *           enum: ["Pending", "Completed", "Rejected", "In Progress"]
 *         description: Filter by RTO status
 *       - in: query
 *         name: rtoPaperStatus
 *         schema:
 *           type: string
 *           enum: ["Not Submitted", "Submitted", "Verified", "Rejected"]
 *         description: Filter by paper status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by customer name or booking ID
 *     responses:
 *       200:
 *         description: List of RTO processes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get("/",
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
  rtoController.getAllRtoProcesses
);

/**
 * @swagger
 * /api/v1/rtoProcess/{id}:
 *   get:
 *     summary: Get RTO process by ID (Admin+)
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RTO process ID
 *     responses:
 *       200:
 *         description: RTO process details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RtoProcess'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get("/:id",
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
  rtoController.getRtoProcessById
);

/**
 * @swagger
 * /api/v1/rtoProcess/{id}:
 *   patch:
 *     summary: Update RTO process fields (Admin+)
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RTO process ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rtoStatus:
 *                 type: string
 *                 enum: ["Pending", "Completed", "Rejected", "In Progress"]
 *               rtoPaperStatus:
 *                 type: string
 *                 enum: ["Not Submitted", "Submitted", "Verified", "Rejected"]
 *               numberPlate:
 *                 type: string
 *               receiptNumber:
 *                 type: string
 *               rtoPendingTaxStatus:
 *                 type: string
 *                 enum: ["Paid", "Unpaid", "N/A"]
 *               hsrbOrdering:
 *                 type: boolean
 *               hsrbInstallation:
 *                 type: boolean
 *               rcConfirmation:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: RTO process updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RtoProcess'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.patch("/:id",
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'RtoProcess'),
  rtoController.updateRtoProcess
);

/**
 * @swagger
 * /api/v1/rtoProcess/{id}:
 *   delete:
 *     summary: Delete RTO process (SuperAdmin only)
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RTO process ID
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.delete("/:id",
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'RtoProcess'),
  rtoController.deleteRtoProcess
);

module.exports = router;