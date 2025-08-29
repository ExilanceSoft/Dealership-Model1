const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/ledgerApprovalController');
const { protect, authorize } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: LedgerApproval
 *   description: Ledger and broker transaction approval management endpoints
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     ApprovalResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: object
 *           properties:
 *             ledger:
 *               $ref: '#/components/schemas/Ledger'
 * 
 *     RejectionRequest:
 *       type: object
 *       required:
 *         - rejectionReason
 *       properties:
 *         rejectionReason:
 *           type: string
 *           description: Reason for rejection
 *           example: "Insufficient documentation"
 *         remark:
 *           type: string
 *           description: Additional remarks
 * 
 *     BrokerApprovalResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: object
 *           properties:
 *             transaction:
 *               $ref: '#/components/schemas/Transaction'
 *             currentBalance:
 *               type: number
 *               example: -15000
 *             onAccount:
 *               type: number
 *               example: 5000
 * 
 *     PendingApprovalsResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: object
 *           properties:
 *             ledgerEntries:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ledger'
 *             brokerTransactions:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   transaction:
 *                     $ref: '#/components/schemas/Transaction'
 *                   broker:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       mobile:
 *                         type: string
 *                       email:
 *                         type: string
 *                   branch:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *                   ledgerId:
 *                     type: string
 *             totalPending:
 *               type: number
 *               example: 5
 */

/**
 * @swagger
 * /api/v1/approvals/ledger/approve/{ledgerId}:
 *   put:
 *     summary: Approve a ledger entry
 *     tags: [LedgerApproval]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ledgerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the ledger entry to approve
 *     requestBody:
 *       description: Optional remark for approval
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remark:
 *                 type: string
 *                 description: Optional remark for the approval
 *                 example: "Payment verified with bank statement"
 *     responses:
 *       200:
 *         description: Ledger entry approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovalResponse'
 *       400:
 *         description: Entry is not pending approval
 *       404:
 *         description: Ledger entry not found
 *       500:
 *         description: Server error
 */
router.put(
  '/ledger/approve/:ledgerId',
  protect,
  requirePermission('LEDGER.UPDATE'),
  approvalController.approveLedgerEntry
);

/**
 * @swagger
 * /api/v1/approvals/ledger/reject/{ledgerId}:
 *   put:
 *     summary: Reject a ledger entry
 *     tags: [LedgerApproval]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ledgerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the ledger entry to reject
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RejectionRequest'
 *     responses:
 *       200:
 *         description: Ledger entry rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovalResponse'
 *       400:
 *         description: Entry is not pending approval or rejection reason missing
 *       404:
 *         description: Ledger entry not found
 *       500:
 *         description: Server error
 */
router.put(
  '/ledger/reject/:ledgerId',
  protect,
  requirePermission('LEDGER.UPDATE'),
  approvalController.rejectLedgerEntry
);

/**
 * @swagger
 * /api/v1/approvals/broker/{brokerId}/{branchId}/approve/{transactionId}:
 *   put:
 *     summary: Approve a broker ledger transaction
 *     tags: [LedgerApproval]
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
 *       description: Optional remark for approval
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remark:
 *                 type: string
 *                 description: Optional remark for the approval
 *                 example: "Broker payment verified"
 *     responses:
 *       200:
 *         description: Broker transaction approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrokerApprovalResponse'
 *       400:
 *         description: Transaction is not pending approval
 *       404:
 *         description: Broker ledger or transaction not found
 *       500:
 *         description: Server error
 */
router.put(
  '/broker/:brokerId/:branchId/approve/:transactionId',
  protect,
  requirePermission('BROKER_LEDGER.UPDATE'),
  approvalController.approveBrokerTransaction
);

/**
 * @swagger
 * /api/v1/approvals/broker/{brokerId}/{branchId}/reject/{transactionId}:
 *   put:
 *     summary: Reject a broker ledger transaction
 *     tags: [LedgerApproval]
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
 *         description: ID of the transaction to reject
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RejectionRequest'
 *     responses:
 *       200:
 *         description: Broker transaction rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrokerApprovalResponse'
 *       400:
 *         description: Transaction is not pending approval or rejection reason missing
 *       404:
 *         description: Broker ledger or transaction not found
 *       500:
 *         description: Server error
 */
router.put(
  '/broker/:brokerId/:branchId/reject/:transactionId',
  protect,
  requirePermission('BROKER_LEDGER.UPDATE'),
  approvalController.rejectBrokerTransaction
);

/**
 * @swagger
 * /api/v1/approvals/pending:
 *   get:
 *     summary: Get all pending approvals
 *     tags: [LedgerApproval]
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
 *         description: List of pending approvals
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PendingApprovalsResponse'
 *       500:
 *         description: Server error
 */
router.get(
  '/pending',
  protect,
  requirePermission(['LEDGER.READ', 'BROKER_LEDGER.READ']),
  approvalController.getPendingApprovals
);

module.exports = router;