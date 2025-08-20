const express = require('express');
const router = express.Router();
const {
  createOnAccountReceipt,
  listOnAccountReceipts,
  getOnAccountReceipt,
  allocateOnAccount,
  deallocateAllocation,
  getSubdealerOnAccountSummary,
} = require('../controllers/subdealerOnAccountController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Subdealer On-Account
 *   description: Subdealer on-account receipt and allocation management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OnAccountReceipt:
 *       type: object
 *       required:
 *         - subdealer
 *         - refNumber
 *         - amount
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the receipt
 *           example: 507f1f77bcf86cd799439011
 *         subdealer:
 *           type: string
 *           description: ID of the subdealer
 *           example: 507f1f77bcf86cd799439012
 *         subdealerDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             location:
 *               type: string
 *             type:
 *               type: string
 *         refNumber:
 *           type: string
 *           description: UTR/REF number of the receipt
 *           example: UTR1234567890
 *         paymentMode:
 *           type: string
 *           enum: [Cash, Bank, UPI, NEFT, RTGS, IMPS, Cheque, Pay Order, Other, On-Account]
 *           default: Bank
 *           description: Payment mode used
 *         bank:
 *           type: string
 *           description: ID of the bank (if payment mode requires it)
 *           example: 507f1f77bcf86cd799439013
 *         bankDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             accountNumber:
 *               type: string
 *             ifsc:
 *               type: string
 *         amount:
 *           type: number
 *           description: Receipt amount
 *           example: 10000.50
 *         receivedDate:
 *           type: string
 *           format: date-time
 *           description: Date when amount was received
 *         receivedBy:
 *           type: string
 *           description: ID of user who recorded the receipt
 *         receivedByDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         remark:
 *           type: string
 *           description: Optional remarks
 *         status:
 *           type: string
 *           enum: [OPEN, PARTIAL, CLOSED]
 *           default: OPEN
 *           description: Receipt status based on allocations
 *         allocations:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               booking:
 *                 type: string
 *                 description: Booking ID this allocation is for
 *               bookingDetails:
 *                 type: object
 *                 properties:
 *                   bookingNumber:
 *                     type: string
 *                   customerDetails:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                   discountedAmount:
 *                     type: number
 *                   receivedAmount:
 *                     type: number
 *                   balanceAmount:
 *                     type: number
 *                   bookingType:
 *                     type: string
 *               amount:
 *                 type: number
 *                 description: Amount allocated
 *               ledger:
 *                 type: string
 *                 description: ID of the ledger entry created
 *               ledgerDetails:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                   paymentMode:
 *                     type: string
 *                   transactionReference:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *               remark:
 *                 type: string
 *               allocatedAt:
 *                 type: string
 *                 format: date-time
 *               allocatedBy:
 *                 type: string
 *               allocatedByDetails:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *         allocatedTotal:
 *           type: number
 *           description: Total amount allocated so far
 *           default: 0
 *         balance:
 *           type: number
 *           description: Virtual field - remaining balance (amount - allocatedTotal)
 *         closedAt:
 *           type: string
 *           format: date-time
 *           description: Date when receipt was fully allocated (status=CLOSED)
 *         closedBy:
 *           type: string
 *           description: ID of user who closed the receipt
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     OnAccountReceiptInput:
 *       type: object
 *       required:
 *         - refNumber
 *         - amount
 *       properties:
 *         refNumber:
 *           type: string
 *           description: UTR/REF number
 *           example: UTR1234567890
 *         amount:
 *           type: number
 *           description: Receipt amount
 *           example: 10000.50
 *         paymentMode:
 *           type: string
 *           enum: [Cash, Bank, UPI, NEFT, RTGS, IMPS, Cheque, Pay Order, Other, On-Account]
 *           default: Bank
 *         bank:
 *           type: string
 *           description: Required if paymentMode is bank-related
 *         receivedDate:
 *           type: string
 *           format: date-time
 *           description: Optional receipt date (defaults to now)
 *         remark:
 *           type: string
 *     AllocationInput:
 *       type: object
 *       required:
 *         - bookingId
 *         - amount
 *       properties:
 *         bookingId:
 *           type: string
 *           description: Booking ID to allocate to
 *         amount:
 *           type: number
 *           description: Amount to allocate
 *         remark:
 *           type: string
 *     OnAccountSummary:
 *       type: object
 *       properties:
 *         byStatus:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 description: Status (OPEN, PARTIAL, CLOSED)
 *               count:
 *                 type: number
 *                 description: Number of receipts in this status
 *               totalAmount:
 *                 type: number
 *                 description: Total amount in this status
 *               totalAllocated:
 *                 type: number
 *                 description: Total allocated in this status
 *               totalBalance:
 *                 type: number
 *                 description: Total balance in this status
 *         totals:
 *           type: object
 *           properties:
 *             totalReceipts:
 *               type: number
 *               description: Total number of receipts
 *             grandAmount:
 *               type: number
 *               description: Grand total of all receipt amounts
 *             grandAllocated:
 *               type: number
 *               description: Grand total of allocated amounts
 *             grandBalance:
 *               type: number
 *               description: Grand total of remaining balances
 */

/**
 * @swagger
 * /api/v1/subdealersonaccount/{subdealerId}/on-account/receipts:
 *   post:
 *     summary: Create a new on-account receipt for a subdealer (Finance+)
 *     tags: [Subdealer On-Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OnAccountReceiptInput'
 *     responses:
 *       201:
 *         description: On-account receipt created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnAccountReceipt'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Finance+)
 *       404:
 *         description: Subdealer not found
 *       409:
 *         description: Duplicate UTR/REF number for this subdealer
 *       500:
 *         description: Server error
 */
router.post('/:subdealerId/on-account/receipts',
  protect,
  requirePermission('SUBDEALER_ON_ACCOUNT.CREATE'),
  logAction('CREATE', 'SubdealerOnAccountReceipt'),
  createOnAccountReceipt
);

/**
 * @swagger
 * /api/v1/subdealersonaccount/{subdealerId}/on-account/receipts:
 *   get:
 *     summary: List all on-account receipts for a subdealer (Finance+)
 *     tags: [Subdealer On-Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, PARTIAL, CLOSED]
 *         description: Filter by receipt status
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by UTR/REF number
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter receipts received on or after this date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter receipts received on or before this date
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
 *         name: sort
 *         schema:
 *           type: string
 *           default: -receivedDate
 *         description: Sort field and direction (prefix with - for descending)
 *     responses:
 *       200:
 *         description: Paginated list of on-account receipts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 docs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OnAccountReceipt'
 *                 totalDocs:
 *                   type: number
 *                 limit:
 *                   type: number
 *                 page:
 *                   type: number
 *                 totalPages:
 *                   type: number
 *                 pagingCounter:
 *                   type: number
 *                 hasPrevPage:
 *                   type: boolean
 *                 hasNextPage:
 *                   type: boolean
 *                 prevPage:
 *                   type: number
 *                 nextPage:
 *                   type: number
 *       400:
 *         description: Invalid subdealer ID or query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Finance+)
 *       500:
 *         description: Server error
 */
router.get('/:subdealerId/on-account/receipts',
  protect,
  requirePermission('SUBDEALER_ON_ACCOUNT.READ'),
  listOnAccountReceipts
);

/**
 * @swagger
 * /api/v1/subdealersonaccount/receipts/{id}:
 *   get:
 *     summary: Get a specific on-account receipt by ID (Finance+)
 *     tags: [Subdealer On-Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the on-account receipt
 *     responses:
 *       200:
 *         description: On-account receipt details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnAccountReceipt'
 *       400:
 *         description: Invalid receipt ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Finance+)
 *       404:
 *         description: Receipt not found
 *       500:
 *         description: Server error
 */
router.get('/receipts/:id',
  protect,
  requirePermission('SUBDEALER_ON_ACCOUNT.READ'),
  getOnAccountReceipt
);

/**
 * @swagger
 * /api/v1/subdealersonaccount/receipts/{id}/allocate:
 *   post:
 *     summary: Allocate an on-account receipt to bookings (Finance+)
 *     tags: [Subdealer On-Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the on-account receipt
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - allocations
 *             properties:
 *               allocations:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/AllocationInput'
 *     responses:
 *       200:
 *         description: Allocation successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnAccountReceipt'
 *       400:
 *         description: Invalid allocation data or receipt is CLOSED
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Finance+)
 *       404:
 *         description: Receipt or booking not found
 *       500:
 *         description: Server error
 */
router.post('/receipts/:id/allocate',
  protect,
  requirePermission('SUBDEALER_ON_ACCOUNT.CREATE'),
  logAction('ALLOCATE', 'SubdealerOnAccountReceipt'),
  allocateOnAccount
);

/**
 * @swagger
 * /api/v1/subdealersonaccount/receipts/{id}/allocations/{allocId}:
 *   delete:
 *     summary: Deallocate an allocation from an on-account receipt (Finance+)
 *     tags: [Subdealer On-Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the on-account receipt
 *       - in: path
 *         name: allocId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the allocation to remove
 *     responses:
 *       200:
 *         description: Deallocation successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnAccountReceipt'
 *       400:
 *         description: Invalid IDs or receipt is CLOSED
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Finance+)
 *       404:
 *         description: Receipt or allocation not found
 *       500:
 *         description: Server error
 */
router.delete('/receipts/:id/allocations/:allocId',
  protect,
  requirePermission('SUBDEALER_ON_ACCOUNT.DELETE'),
  logAction('DEALLOCATE', 'SubdealerOnAccountReceipt'),
  deallocateAllocation
);

/**
 * @swagger
 * /api/v1/subdealersonaccount/{subdealerId}/on-account/summary:
 *   get:
 *     summary: Get on-account summary for a subdealer (Finance+)
 *     tags: [Subdealer On-Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
 *     responses:
 *       200:
 *         description: On-account summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnAccountSummary'
 *       400:
 *         description: Invalid subdealer ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Finance+)
 *       500:
 *         description: Server error
 */
router.get('/:subdealerId/on-account/summary',
  protect,
  requirePermission('SUBDEALER_ON_ACCOUNT.READ'),
  getSubdealerOnAccountSummary
);

module.exports = router;