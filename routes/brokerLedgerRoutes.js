const express = require('express');
const router = express.Router();
const brokerLedgerController = require('../controllers/brokerLedgerController');
const { protect, authorize } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');
const validateObjectIds = (params) => {
  return (req, res, next) => {
    for (const param of params) {
      if (req.params[param] && !mongoose.isValidObjectId(req.params[param])) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${param} ID format`
        });
      }
    }
    next();
  };
};
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
 *         subPaymentMode:
 *           type: string
 *           description: Sub-payment mode ID (required for bank payments)
 *         referenceNumber:
 *           type: string
 *           description: Transaction reference number
 *         bookingId:
 *           type: string
 *           description: Associated booking ID
 *         bankId:
 *           type: string
 *           description: Required for bank payments
 *         cashLocation:
 *           type: string
 *           description: Required for cash payments
 *         remark:
 *           type: string
 *           maxLength: 200
 *           description: Optional remarks
 *         adjustAgainstBookings:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               bookingId:
 *                 type: string
 *               amount:
 *                 type: number
 * 
 *     Allocation:
 *       type: object
 *       required:
 *         - booking
 *         - amount
 *       properties:
 *         booking:
 *           type: string
 *           format: objectId
 *         amount:
 *           type: number
 *           minimum: 0.01
 * 
 *     AllocationRequest:
 *       type: object
 *       required:
 *         - referenceNumber
 *         - allocations
 *       properties:
 *         referenceNumber:
 *           type: string
 *         allocations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Allocation'
 * 
 *     DepositRequest:
 *       type: object
 *       required:
 *         - amount
 *         - modeOfPayment
 *         - referenceNumber
 *       properties:
 *         amount:
 *           type: number
 *           minimum: 0.01
 *         modeOfPayment:
 *           type: string
 *           enum: [Cash, Bank, Finance Disbursement, Exchange, Pay Order]
 *         subPaymentMode:
 *           type: string
 *           description: Sub-payment mode ID (required for bank payments)
 *         referenceNumber:
 *           type: string
 *         bankId:
 *           type: string
 *         remark:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 * 
 *     BrokerLedger:
 *       type: object
 *       properties:
 *         broker:
 *           type: string
 *           description: Broker reference
 *         branch:
 *           type: string
 *           description: Branch reference
 *         currentBalance:
 *           type: number
 *           description: Current balance
 *         onAccount:
 *           type: number
 *           description: On-account balance
 *         transactions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Transaction'
 *         createdBy:
 *           type: string
 *           description: User who created the ledger
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 * tags:
 *   - name: BrokerLedger
 *     description: Broker ledger management endpoints
 */

/**
 * @swagger
 * /api/v1/broker-ledger/initialize/{brokerId}/{branchId}:
 *   post:
 *     summary: Initialize ledger for a broker in a branch
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *     responses:
 *       200:
 *         description: Ledger initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrokerLedger'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/initialize/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.CREATE'),
  brokerLedgerController.initializeLedger
);

/**
 * @swagger
 * /api/v1/broker-ledger/transaction/{brokerId}/{branchId}:
 *   post:
 *     summary: Add transaction to broker ledger in a specific branch
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
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
  '/transaction/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.CREATE'),
  brokerLedgerController.addTransaction
);
/**
 * @swagger
 * /api/v1/broker-ledger/approve-transaction/{brokerId}/{branchId}/{transactionId}:
 *   patch:
 *     summary: Approve a pending broker ledger transaction
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the transaction to approve
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remark:
 *                 type: string
 *                 description: Optional remark for the approval
 *     responses:
 *       200:
 *         description: Transaction approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/Transaction'
 *                     currentBalance:
 *                       type: number
 *                     onAccount:
 *                       type: number
 *       400:
 *         description: Transaction is not pending approval
 *       404:
 *         description: Broker ledger or transaction not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/approve-transaction/:brokerId/:branchId/:transactionId',
  protect,
  requirePermission('BROKER_LEDGER.UPDATE'),
  brokerLedgerController.approveBrokerTransaction
);
/**
 * @swagger
 * /api/v1/broker-ledger/approve-on-account/{brokerId}/{branchId}/{transactionId}:
 *   patch:
 *     summary: Approve an on-account payment
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the on-account transaction to approve
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remark:
 *                 type: string
 *                 description: Optional remark for the approval
 *     responses:
 *       200:
 *         description: On-account payment approved successfully
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
 *                     transaction:
 *                       $ref: '#/components/schemas/Transaction'
 *                     currentBalance:
 *                       type: number
 *                     onAccount:
 *                       type: number
 *                     onAccountBalance:
 *                       type: number
 *                 message:
 *                   type: string
 *       400:
 *         description: Transaction is not an on-account payment or not pending approval
 *       404:
 *         description: Broker ledger or transaction not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/approve-on-account/:brokerId/:branchId/:transactionId',
  protect,
  requirePermission('BROKER_LEDGER.UPDATE'),
  brokerLedgerController.approveOnAccountPayment
);
/**
 * @swagger
 * /api/v1/broker-ledger/pending-transactions/{brokerId}/{branchId}:
 *   get:
 *     summary: Get pending approval transactions for a broker in a branch
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
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
 *         description: List of pending approval transactions
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
 *                     broker:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         mobile:
 *                           type: string
 *                         email:
 *                           type: string
 *                     branch:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         code:
 *                           type: string
 *                     pendingTransactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         count:
 *                           type: integer
 *                         totalRecords:
 *                           type: integer
 *       404:
 *         description: Ledger not found
 *       500:
 *         description: Server error
 */
router.get(
  '/pending-transactions/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getPendingTransactions
);

/**
 * @swagger
 * /api/v1/broker-ledger/on-account/{brokerId}/{branchId}:
 *   post:
 *     summary: Add on-account payment for a broker in a specific branch
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
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
 *                 minimum: 0.01
 *               modeOfPayment:
 *                 type: string
 *                 enum: [Cash, Bank, Finance Disbursement, Exchange, Pay Order]
 *               subPaymentMode:
 *                 type: string
 *                 description: Sub-payment mode ID (required for bank payments)
 *               referenceNumber:
 *                 type: string
 *               bankId:
 *                 type: string
 *               cashLocation:
 *                 type: string
 *               remark:
 *                 type: string
 *     responses:
 *       201:
 *         description: On-account payment added successfully
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
  '/on-account/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.CREATE'),
  brokerLedgerController.addOnAccountPayment
);
/**
 * @swagger
 * /api/v1/broker-ledger/deposit/{brokerId}/{branchId}:
 *   post:
 *     summary: Deposit on-account payment
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DepositRequest'
 *     responses:
 *       201:
 *         description: Deposit successful
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
 *                     broker:
 *                       type: string
 *                     branch:
 *                       type: string
 *                     onAccount:
 *                       type: number
 *                     reference:
 *                       type: object
 *                       properties:
 *                         referenceNumber:
 *                           type: string
 *                         amount:
 *                           type: number
 *                         modeOfPayment:
 *                           type: string
 *                         bankId:
 *                           type: string
 *                         remark:
 *                           type: string
 *                         remaining:
 *                           type: number
 *       400:
 *         description: Validation error
 *       409:
 *         description: Reference number already exists
 *       500:
 *         description: Server error
 */
router.post(
  '/deposit/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.CREATE'),
  brokerLedgerController.depositOnAccount
);
/**
 * @swagger
 * /api/v1/broker-ledger/allocate/{brokerId}/{branchId}:
 *   post:
 *     summary: Allocate reference to bookings
 *     description: |
 *       Allocates funds from a specific reference (deposit) to one or multiple bookings.
 *       This process decreases the on-account balance and applies the allocated amounts
 *       against outstanding booking balances.
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *     requestBody:
 *       required: true
 *       description: Allocation request containing reference number and booking allocations
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referenceNumber
 *               - allocations
 *             properties:
 *               referenceNumber:
 *                 type: string
 *                 description: Reference number of the deposit to allocate from
 *                 example: "BANKREF12345"
 *               allocations:
 *                 type: array
 *                 description: List of booking allocations
 *                 items:
 *                   type: object
 *                   required:
 *                     - booking
 *                     - amount
 *                   properties:
 *                     booking:
 *                       type: string
 *                       description: Booking ID to allocate funds to
 *                       example: "60d21b4667d0d8992e610c85"
 *                     amount:
 *                       type: number
 *                       minimum: 0.01
 *                       description: Amount to allocate to this booking
 *                       example: 5000.00
 *     responses:
 *       201:
 *         description: Allocation successful
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
 *                 message:
 *                   type: string
 *                   example: "Allocation successful"
 *       400:
 *         description: |
 *           Validation error or insufficient funds. Possible reasons:
 *           - Missing required fields
 *           - Total allocation exceeds remaining reference amount
 *           - Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Total allocation (6000) exceeds remaining reference amount (5000)"
 *       404:
 *         description: |
 *           Not found. Possible reasons:
 *           - Ledger not found for broker and branch
 *           - Reference transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Reference transaction not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Error allocating reference"
 */
router.post(
  '/allocate/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.CREATE'),
  brokerLedgerController.allocateReference
);





/**
 * @swagger
 * /api/v1/broker-ledger/on-account/{brokerId}/{branchId}:
 *   get:
 *     summary: Get on-account summary
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *     responses:
 *       200:
 *         description: On-account summary
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
 *                     onAccount:
 *                       type: number
 *                     references:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           referenceNumber:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           allocated:
 *                             type: number
 *                           remaining:
 *                             type: number
 *                           modeOfPayment:
 *                             type: string
 *                           bankId:
 *                             type: string
 *                           remark:
 *                             type: string
 *                           date:
 *                             type: string
 *                             format: date-time
 *       500:
 *         description: Server error
 */
router.get(
  '/on-account/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getOnAccountSummary
);

/**
 * @swagger
 * /api/v1/broker-ledger/pending-debits/{brokerId}/{branchId}:
 *   get:
 *     summary: Get pending debits and on-account balance
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *     responses:
 *       200:
 *         description: Pending debits and on-account balance
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
 *                     pendingDebits:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           booking:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               bookingNumber:
 *                                 type: string
 *                               customerDetails:
 *                                 type: object
 *                               chassisNumber:
 *                                 type: string
 *                               exchangeDetails:
 *                                 type: object
 *                           outstandingAmount:
 *                             type: number
 *                     onAccountBalance:
 *                       type: number
 *       404:
 *         description: Ledger not found
 *       500:
 *         description: Server error
 */
router.get(
  '/pending-debits/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getPendingDebits
);
/**
 * @swagger
 * /api/v1/broker-ledger/auto-allocate/{brokerId}/{branchId}:
 *   post:
 *     summary: Manually trigger auto-allocation of on-account funds to pending debits
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
 *     responses:
 *       200:
 *         description: Auto-allocation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BrokerLedger'
 *                 onAccountBalance:
 *                   type: number
 *                 message:
 *                   type: string
 *       404:
 *         description: Ledger not found
 *       500:
 *         description: Server error
 */
router.post(
  '/auto-allocate/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.CREATE'),
  brokerLedgerController.autoAllocateFunds
);
/**
 * @swagger
 * /api/v1/broker-ledger/statement/{brokerId}:
 *   get:
 *     summary: Get ledger statement for a broker across all branches
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
 *         description: Ledger statement across all branches
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
 *                     broker:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         brokerId:
 *                           type: string
 *                     branches:
 *                       type: array
 *                       items:
 *                         type: string
 *                     closingBalance:
 *                       type: number
 *                     fromDate:
 *                       type: string
 *                       format: date-time
 *                     toDate:
 *                       type: string
 *                       format: date-time
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           type:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           mode:
 *                             type: string
 *                           referenceNumber:
 *                             type: string
 *                           branch:
 *                             type: string
 *                           booking:
 *                             type: object
 *                             properties:
 *                               bookingNumber:
 *                                 type: string
 *                               customerName:
 *                                 type: string
 *                               chassisNumber:
 *                                 type: string
 *                               model:
 *                                 type: string
 *                               color:
 *                                 type: string
 *                           bank:
 *                             type: string
 *                           cashLocation:
 *                             type: string
 *                           remark:
 *                             type: string
 *                           balance:
 *                             type: number
 *                           createdBy:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalCredit:
 *                           type: number
 *                         totalDebit:
 *                           type: number
 *                         netBalance:
 *                           type: number
 *       404:
 *         description: No ledgers found
 *       500:
 *         description: Server error
 */
router.get(
  '/statement/:brokerId',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getStatement
);
/**
 * @swagger
 * /api/v1/broker-ledger/summary/branch/{branchId}:
 *   get:
 *     summary: Get broker-wise summary for a specific branch
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
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
 *         description: Broker-wise summary for the branch
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
 *                     branch:
 *                       type: string
 *                     brokers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           broker:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               mobile:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               brokerId:
 *                                 type: string
 *                           totalBookings:
 *                             type: integer
 *                           totalExchangeAmount:
 *                             type: number
 *                           ledger:
 *                             type: object
 *                             properties:
 *                               currentBalance:
 *                                 type: number
 *                               onAccount:
 *                                 type: number
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         count:
 *                           type: integer
 *                         totalRecords:
 *                           type: integer
 *       500:
 *         description: Server error
 */
router.get(
  '/summary/branch/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getBrokerWiseSummary
);
/**
 * @swagger
 * /api/v1/broker-ledger/summary/detailed:
 *   get:
 *     summary: Get summary of all brokers with their ledger information
 *     tags: [BrokerLedger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *         description: Filter by branch ID
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
 *                   type: object
 *                   properties:
 *                     brokers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           broker:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               mobile:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               brokerId:
 *                                 type: string
 *                           branch:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                           totalBookings:
 *                             type: integer
 *                           totalExchangeAmount:
 *                             type: number
 *                           ledger:
 *                             type: object
 *                             properties:
 *                               currentBalance:
 *                                 type: number
 *                               totalCredit:
 *                                 type: number
 *                               totalDebit:
 *                                 type: number
 *                               onAccount:
 *                                 type: number
 *                           lastUpdated:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         count:
 *                           type: integer
 *                         totalRecords:
 *                           type: integer
 *       500:
 *         description: Server error
 */
router.get(
  '/summary/detailed',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getDetailedBrokersSummary
);
/**
 * @swagger
 * /api/v1/broker-ledger/{brokerId}/{branchId}:
 *   get:
 *     summary: Get ledger for a broker in a specific branch
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
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch
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
  '/:brokerId/:branchId',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getLedger
);

/**
 * @swagger
 * /api/v1/broker-ledger/pending-credits:
 *   get:
 *     summary: Get all pending CREDIT transactions for approval
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
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - in: query
 *         name: brokerId
 *         schema:
 *           type: string
 *         description: Filter by broker ID
 *     responses:
 *       200:
 *         description: List of pending CREDIT transactions across all brokers and branches
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
 *                     pendingCreditTransactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           modeOfPayment:
 *                             type: string
 *                           referenceNumber:
 *                             type: string
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           remark:
 *                             type: string
 *                           createdBy:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                           broker:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               mobile:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               brokerId:
 *                                 type: string
 *                           branch:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               code:
 *                                 type: string
 *                           booking:
 *                             type: object
 *                             properties:
 *                               bookingNumber:
 *                                 type: string
 *                               customerName:
 *                                 type: string
 *                               chassisNumber:
 *                                 type: string
 *                           bank:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                           cashLocation:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                           subPaymentMode:
 *                             type: object
 *                             properties:
 *                               payment_mode:
 *                                 type: string
 *                           ledgerId:
 *                             type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         count:
 *                           type: integer
 *                         totalRecords:
 *                           type: integer
 *       500:
 *         description: Server error
 */
router.get(
  '/pending-credits',
  protect,
  requirePermission('BROKER_LEDGER.READ'),
  brokerLedgerController.getPendingCreditTransactions
);

module.exports = router;