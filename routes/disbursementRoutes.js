const express = require('express');
const router = express.Router();
const disbursementController = require('../controllers/disbursementController');
const { protect, authorize } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Disbursements
 *   description: Disbursement management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Disbursement:
 *       type: object
 *       required:
 *         - booking
 *         - disbursementAmount
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the disbursement
 *           example: 507f1f77bcf86cd799439011
 *         booking:
 *           type: string
 *           description: ID of the booking this disbursement belongs to
 *           example: 507f1f77bcf86cd799439012
 *         bookingDetails:
 *           type: object
 *           properties:
 *             bookingNumber:
 *               type: string
 *             customerDetails:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *             model:
 *               type: string
 *         disbursementAmount:
 *           type: number
 *           description: The disbursement amount
 *           example: 500000
 *         notes:
 *           type: string
 *           description: Additional notes about the disbursement
 *           example: First installment disbursed
 *         status:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *           description: Disbursement status
 *           example: completed
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the disbursement
 *           example: 507f1f77bcf86cd799439013
 *         createdByDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             availableDeviationAmount:
 *               type: number
 *         disbursementDate:
 *           type: string
 *           format: date-time
 *           description: The date the disbursement was created
 *           example: "2023-01-01T00:00:00.000Z"
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
 *     DisbursementInput:
 *       type: object
 *       required:
 *         - bookingId
 *         - disbursementAmount
 *       properties:
 *         bookingId:
 *           type: string
 *           description: The booking ID
 *           example: 507f1f77bcf86cd799439012
 *         disbursementAmount:
 *           type: number
 *           description: The disbursement amount
 *           example: 500000
 *         notes:
 *           type: string
 *           description: Additional notes about the disbursement
 *           example: First installment disbursed
 *     DisbursementUpdateInput:
 *       type: object
 *       properties:
 *         disbursementAmount:
 *           type: number
 *           description: The disbursement amount
 *           example: 500000
 *         notes:
 *           type: string
 *           description: Additional notes about the disbursement
 *           example: Updated disbursement amount
 *         status:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *           description: Disbursement status
 *           example: completed
 *     DisbursementResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             disbursement:
 *               $ref: '#/components/schemas/Disbursement'
 *             financeExpected:
 *               type: number
 *               description: Expected finance amount
 *               example: 500000
 *             downPaymentExpected:
 *               type: number
 *               description: Expected down payment amount
 *               example: 100000
 */

/**
 * @swagger
 * /api/v1/disbursements:
 *   post:
 *     summary: Create a new disbursement with optional deviation handling
 *     tags: [Disbursements]
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
 *               - disbursementAmount
 *               - downPaymentExpected
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: ID of the booking
 *                 example: "68ae9ed09c576dc6af3620c6"
 *               disbursementAmount:
 *                 type: number
 *                 description: Amount to be disbursed
 *                 example: 5198
 *               downPaymentExpected:
 *                 type: number
 *                 description: Expected down payment amount
 *                 example: 69000
 *               is_deviation:
 *                 type: boolean
 *                 description: Whether to apply manager deviation
 *                 example: true
 *     responses:
 *       201:
 *         description: Disbursement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     disbursement:
 *                       $ref: '#/components/schemas/Disbursement'
 *                     financeExpected:
 *                       type: number
 *                       example: 5198
 *                     downPaymentExpected:
 *                       type: number
 *                       example: 69000
 *                     totalDealAmount:
 *                       type: number
 *                       example: 75198
 *       400:
 *         description: Validation error or insufficient deviation amount
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking or manager not found
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect, 
  requirePermission('BOOKING.CREATE'),
  disbursementController.createDisbursement
);


module.exports = router;