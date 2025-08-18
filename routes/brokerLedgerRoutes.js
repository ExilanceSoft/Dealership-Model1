const express = require('express');
const router = express.Router();
const brokerLedgerController = require('../controllers/brokerLedgerController');
const { protect, authorize } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: BrokerLedger
 *   description: Broker ledger management
 */
/**
 * @swagger
 * /api/v1/broker-ledger/summary:
 *   get:
 *     summary: Get summary of all brokers with their ledger information
 *     tags: [BrokerLedger]
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
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of brokers with their ledger summary
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
 *                       broker:
 *                         $ref: '#/components/schemas/Broker'
 *                       totalCredit:
 *                         type: number
 *                       totalDebit:
 *                         type: number
 *                       currentBalance:
 *                         type: number
 *       500:
 *         description: Server error
 */
router.get(
  '/summary',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getDetailedBrokersSummary
);
/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       required:
 *         - type
 *         - amount
 *         - modeOfPayment
 *         - referenceNo
 *       properties:
 *         type:
 *           type: string
 *           enum: [CREDIT, DEBIT]
 *           description: Type of transaction
 *         amount:
 *           type: number
 *           minimum: 0.01
 *           description: Transaction amount
 *         modeOfPayment:
 *           type: string
 *           enum: [Cash, Bank, Finance Disbursement, Exchange, Pay Order]
 *           description: Payment mode
 *         referenceNo:
 *           type: string
 *           description: Transaction reference number
 *         bookingId:
 *           type: string
 *           description: Associated booking ID
 *         bankId:
 *           type: string
 *           description: Required for bank payments
 *         cashLocationId:
 *           type: string
 *           description: Required for cash payments
 *         remark:
 *           type: string
 *           maxLength: 200
 *           description: Optional remarks
 * 
 *     BrokerLedger:
 *       type: object
 *       properties:
 *         broker:
 *           type: string
 *           description: Broker reference
 *         openingBalance:
 *           type: number
 *           description: Opening balance
 *         currentBalance:
 *           type: number
 *           description: Current balance
 *         transactions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Transaction'
 *         createdBy:
 *           type: string
 *           description: User who created the ledger
 */

/**
 * @swagger
 * /api/v1/broker-ledger/{brokerId}/transactions:
 *   post:
 *     summary: Add transaction to broker ledger
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the broker
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Transaction'
 *     responses:
 *       201:
 *         description: Transaction added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrokerLedger'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:brokerId/transactions',
  protect,
  requirePermission('BROKER_LEDGER.CREATE'),
  brokerLedgerController.addTransaction
);

/**
 * @swagger
 * /api/v1/broker-ledger/{brokerId}:
 *   get:
 *     summary: Get broker ledger
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the broker
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
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transactions from this date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transactions to this date
 *     responses:
 *       200:
 *         description: Broker ledger details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrokerLedger'
 *       404:
 *         description: Ledger not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:brokerId',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getLedger
);

/**
 * @swagger
 * /api/v1/broker-ledger/{brokerId}/statement:
 *   get:
 *     summary: Get ledger statement
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the broker
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statement
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statement
 *     responses:
 *       200:
 *         description: Ledger statement
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 broker:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     brokerId:
 *                       type: string
 *                 openingBalance:
 *                   type: number
 *                 closingBalance:
 *                   type: number
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       type:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       mode:
 *                         type: string
 *                       referenceNo:
 *                         type: string
 *                       balance:
 *                         type: number
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalCredit:
 *                       type: number
 *                     totalDebit:
 *                       type: number
 *                     netBalance:
 *                       type: number
 *       404:
 *         description: Ledger not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:brokerId/statement',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getStatement
);

module.exports = router;