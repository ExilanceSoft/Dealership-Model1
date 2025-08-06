const express = require('express');
const router = express.Router();
const stockTransferController = require('../controllers/stockTransferController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Stock Transfer
 *   description: Vehicle stock transfer management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TransferItem:
 *       type: object
 *       required:
 *         - vehicle
 *       properties:
 *         vehicle:
 *           type: string
 *           description: Reference to Vehicle
 *           example: 507f1f77bcf86cd799439011
 *         status:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *           default: pending
 *         receivedAt:
 *           type: string
 *           format: date-time
 *         receivedBy:
 *           type: string
 *           description: Reference to User who received the item
 *         notes:
 *           type: string
 *           maxLength: 500
 * 
 *     StockTransfer:
 *       type: object
 *       required:
 *         - fromBranch
 *         - toBranch
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         fromBranch:
 *           type: string
 *           description: Reference to source Branch
 *           example: 507f1f77bcf86cd799439011
 *         toBranch:
 *           type: string
 *           description: Reference to destination Branch
 *           example: 507f1f77bcf86cd799439012
 *         transferDate:
 *           type: string
 *           format: date-time
 *           description: When the transfer was initiated
 *         expectedDeliveryDate:
 *           type: string
 *           format: date-time
 *           description: When the transfer is expected to be completed (defaults to current date)
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TransferItem'
 *         status:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *           default: pending
 *         initiatedBy:
 *           type: string
 *           description: Reference to User who initiated the transfer
 *           example: 507f1f77bcf86cd799439011
 *         receivedBy:
 *           type: string
 *           description: Reference to User who received the transfer
 *         notes:
 *           type: string
 *           maxLength: 500
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         fromBranchDetails:
 *           $ref: '#/components/schemas/Branch'
 *         toBranchDetails:
 *           $ref: '#/components/schemas/Branch'
 *         initiatedByDetails:
 *           $ref: '#/components/schemas/User'
 *         receivedByDetails:
 *           $ref: '#/components/schemas/User'
 *         vehicleDetails:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Vehicle'
 * 
 *     StockTransferInput:
 *       type: object
 *       required:
 *         - fromBranch
 *         - toBranch
 *         - items
 *       properties:
 *         fromBranch:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         toBranch:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         expectedDeliveryDate:
 *           type: string
 *           format: date-time
 *           example: "2023-12-31T00:00:00.000Z"
 *           description: Optional, defaults to current date if not provided
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               vehicle:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               notes:
 *                 type: string
 *                 example: "Handle with care"
 *         notes:
 *           type: string
 *           example: "Urgent transfer needed"
 * 
 *     StatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [completed, cancelled]
 *           example: completed
 *         notes:
 *           type: string
 *           example: "Additional notes about the status update"
 */

/**
 * @swagger
 * /api/v1/transfers:
 *   post:
 *     summary: Create a new stock transfer (Admin+)
 *     description: Creates a new stock transfer that is immediately marked as completed and moves vehicles to destination branch
 *     tags: [Stock Transfer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StockTransferInput'
 *     responses:
 *       201:
 *         description: Transfer created and completed successfully
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
 *                     transfer:
 *                       $ref: '#/components/schemas/StockTransfer'
 *       400:
 *         description: Validation error or invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Branch or vehicle not found
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  logAction('CREATE', 'StockTransfer'),
  stockTransferController.createTransfer
);

/**
 * @swagger
 * /api/v1/transfers:
 *   get:
 *     summary: Get all stock transfers with filtering options
 *     description: Retrieve all stock transfers with optional filtering by branch, status, or date range
 *     tags: [Stock Transfer]
 *     parameters:
 *       - in: query
 *         name: fromBranch
 *         schema:
 *           type: string
 *         description: Filter by source branch ID
 *       - in: query
 *         name: toBranch
 *         schema:
 *           type: string
 *         description: Filter by destination branch ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *         description: Filter by transfer status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transfers after this date (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter transfers before this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of stock transfers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     transfers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StockTransfer'
 *       500:
 *         description: Server error
 */
router.get('/', stockTransferController.getAllTransfers);

/**
 * @swagger
 * /api/v1/transfers/{transferId}:
 *   get:
 *     summary: Get a stock transfer by ID
 *     description: Retrieve detailed information about a specific stock transfer
 *     tags: [Stock Transfer]
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Transfer details
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
 *                     transfer:
 *                       $ref: '#/components/schemas/StockTransfer'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Transfer not found
 *       500:
 *         description: Server error
 */
router.get('/:transferId', stockTransferController.getTransferById);

/**
 * @swagger
 * /api/v1/transfers/{transferId}/status:
 *   put:
 *     summary: Update stock transfer status (Admin+)
 *     description: Update the status of a stock transfer (only cancellation is allowed after creation)
 *     tags: [Stock Transfer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusUpdate'
 *     responses:
 *       200:
 *         description: Transfer status updated
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
 *                     transfer:
 *                       $ref: '#/components/schemas/StockTransfer'
 *       400:
 *         description: Invalid status or request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Transfer not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:transferId/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  logAction('UPDATE_STATUS', 'StockTransfer'),
  stockTransferController.updateTransferStatus
);

/**
 * @swagger
 * /api/v1/transfers/{transferId}/items/{itemId}:
 *   put:
 *     summary: Update individual transfer item status (Admin+)
 *     description: Update the status of a specific item in a transfer (only cancellation is allowed)
 *     tags: [Stock Transfer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusUpdate'
 *     responses:
 *       200:
 *         description: Transfer item status updated
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
 *                     transfer:
 *                       $ref: '#/components/schemas/StockTransfer'
 *       400:
 *         description: Invalid status or request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Transfer or item not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:transferId/items/:itemId',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  logAction('UPDATE_ITEM_STATUS', 'StockTransfer'),
  stockTransferController.updateTransferItemStatus
);

/**
 * @swagger
 * /api/v1/transfers/branches/{branchId}:
 *   get:
 *     summary: Get transfers by branch (incoming, outgoing, or both)
 *     description: Retrieve all transfers associated with a specific branch
 *     tags: [Stock Transfer]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [incoming, outgoing, both]
 *           default: both
 *         description: Filter by transfer direction (incoming, outgoing, or both)
 *     responses:
 *       200:
 *         description: List of transfers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     transfers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StockTransfer'
 *       400:
 *         description: Invalid branch ID
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.get('/branches/:branchId', stockTransferController.getTransfersByBranch);

/**
 * @swagger
 * /api/v1/transfers/branches/{branchId}/available-vehicles:
 *   get:
 *     summary: Get vehicles available for transfer from a branch
 *     description: Retrieve list of vehicles that are available for transfer from a specific branch
 *     tags: [Stock Transfer]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Filter by model ID
 *     responses:
 *       200:
 *         description: List of available vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid branch ID
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.get(
  '/branches/:branchId/available-vehicles',
  stockTransferController.getAvailableVehiclesForTransfer
);

module.exports = router;