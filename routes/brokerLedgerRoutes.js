// routes/brokerLedgerRoutes.js
const express = require('express');
const router = express.Router();
const brokerLedgerController = require('../controllers/brokerLedgerController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: BrokerLedger
 *   description: Broker ledger management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       required:
 *         - amount
 *         - modeOfPayment
 *       properties:
 *         amount:
 *           type: number
 *           minimum: 0
 *           description: Payment amount
 *         modeOfPayment:
 *           type: string
 *           enum: [Cash, Bank, Finance Disbursement, Exchange, Pay Order]
 *           description: Payment method
 *         bank:
 *           type: string
 *           format: objectId
 *           description: Reference to Bank (required for Bank payments)
 *         cashLocation:
 *           type: string
 *           format: objectId
 *           description: Reference to CashLocation (required for Cash payments)
 *         remark:
 *           type: string
 *           description: Optional remarks
 * 
 *     BrokerLedger:
 *       type: object
 *       required:
 *         - broker
 *       properties:
 *         broker:
 *           type: string
 *           format: objectId
 *           description: Reference to Broker
 *         totalAmount:
 *           type: number
 *           description: Total amount paid
 *         balanceAmount:
 *           type: number
 *           description: Current balance
 *         payments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Payment'
 */

/**
 * @swagger
 * /api/v1/broker-ledger/{brokerId}/payment:
 *   post:
 *     summary: Add payment to broker ledger
 *     description: Add a payment entry to broker's ledger
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID of the broker
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - modeOfPayment
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 example: 5000
 *               modeOfPayment:
 *                 type: string
 *                 enum: [Cash, Bank, Finance Disbursement, Exchange, Pay Order]
 *                 example: "Bank"
 *               bank:
 *                 type: string
 *                 format: objectId
 *                 example: "507f1f77bcf86cd799439011"
 *               cashLocation:
 *                 type: string
 *                 format: objectId
 *                 example: "507f1f77bcf86cd799439012"
 *               remark:
 *                 type: string
 *                 example: "Commission payment for May"
 *     responses:
 *       201:
 *         description: Payment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BrokerLedger'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:brokerId/payment',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  logAction('ADD_PAYMENT', 'BrokerLedger'),
  brokerLedgerController.addPayment
);

/**
 * @swagger
 * /api/v1/broker-ledger/{brokerId}:
 *   get:
 *     summary: Get broker ledger
 *     description: Retrieve ledger for a specific broker
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID of the broker
 *     responses:
 *       200:
 *         description: Broker ledger details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BrokerLedger'
 *       404:
 *         description: Ledger not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:brokerId',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  brokerLedgerController.getLedger
);

/**
 * @swagger
 * /api/v1/broker-ledger:
 *   get:
 *     summary: Get all broker ledgers
 *     description: Retrieve all broker ledgers in the system
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all broker ledgers
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
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BrokerLedger'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  brokerLedgerController.getAllLedgers
);

module.exports = router;