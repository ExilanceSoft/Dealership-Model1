const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const stockTransferController = require('../controllers/stockTransferController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const AppError = require('../utils/appError');
const { requirePermission } = require('../middlewares/requirePermission');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use absolute path to avoid any relative path issues
    const uploadDir = path.join(process.cwd(), 'uploads', 'transfers');
    
    // Create directory with better error handling
    fs.mkdir(uploadDir, { recursive: true }, (err) => {
      if (err) {
        console.error('Failed to create upload directory:', err);
        return cb(new AppError('Failed to create upload directory', 500));
      }
      cb(null, uploadDir);
    });
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `challan-${uniqueSuffix}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  const filetypes = /pdf|jpeg|jpg|png/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new AppError('Only PDF, JPEG, JPG, and PNG files are allowed', 400), false);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});
/**
 * @swagger
 * tags:
 *   name: Stock Transfer
 *   description: Unconditional vehicle stock transfer management endpoints
 */


/**
 * @swagger
 * components:
 *   schemas:
 *     TransferItemInput:
 *       type: object
 *       required:
 *         - vehicle
 *       properties:
 *         vehicle:
 *           type: string
 *           description: ID of the vehicle to transfer
 *           example: 507f1f77bcf86cd799439011
 *         notes:
 *           type: string
 *           description: Optional notes about this vehicle transfer
 *           maxLength: 500
 *           example: "Handle with care"
 *
 *     TransferItemResponse:
 *       type: object
 *       properties:
 *         vehicle:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         status:
 *           type: string
 *           enum: [completed, cancelled]
 *           example: completed
 *         receivedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-07-20T12:00:00Z"
 *         receivedBy:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         notes:
 *           type: string
 *           example: "Handle with care"
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
 *           description: ID of the source branch
 *           example: 507f1f77bcf86cd799439011
 *         toBranch:
 *           type: string
 *           description: ID of the destination branch
 *           example: 507f1f77bcf86cd799439012
 *         expectedDeliveryDate:
 *           type: string
 *           format: date-time
 *           description: Expected delivery date (defaults to current date)
 *           example: "2023-07-21T00:00:00Z"
 *         items:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/TransferItemInput'
 *         notes:
 *           type: string
 *           description: General notes about the transfer
 *           maxLength: 500
 *           example: "Urgent transfer needed"
 *
 *     StockTransferResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439013
 *         fromBranch:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         toBranch:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         transferDate:
 *           type: string
 *           format: date-time
 *           example: "2023-07-20T12:00:00Z"
 *         expectedDeliveryDate:
 *           type: string
 *           format: date-time
 *           example: "2023-07-21T00:00:00Z"
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TransferItemResponse'
 *         status:
 *           type: string
 *           enum: [completed, cancelled]
 *           example: completed
 *         initiatedBy:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         receivedBy:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         notes:
 *           type: string
 *           example: "Urgent transfer needed"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2023-07-20T12:00:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-07-20T12:00:00Z"
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
 *     StatusUpdateInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [cancelled]
 *           description: Only cancellation is allowed after creation
 *           example: cancelled
 *         notes:
 *           type: string
 *           description: Optional notes about the cancellation
 *           maxLength: 500
 *           example: "Cancelled due to incorrect destination"
 *
 *     VehicleAtBranchResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         chassisNumber:
 *           type: string
 *           example: "CH12345678"
 *         model:
 *           $ref: '#/components/schemas/VehicleModel'
 *         type:
 *           type: string
 *           example: "SUV"
 *         colors:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Color'
 *         status:
 *           type: string
 *           example: "in_stock"
 *         unloadLocation:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 */


/**
 * @swagger
 * /api/v1/transfers:
 *   post:
 *     summary: Create and complete a stock transfer (Admin+)
 *     description: |
 *       Creates and immediately completes a stock transfer, moving vehicles to destination branch.
 *       The transfer will be marked as completed and vehicles will be updated to new location.
 *     tags: [Stock Transfer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StockTransferInput'
 *           example:
 *             fromBranch: "507f1f77bcf86cd799439011"
 *             toBranch: "507f1f77bcf86cd799439012"
 *             expectedDeliveryDate: "2023-07-21T00:00:00Z"
 *             items:
 *               - vehicle: "507f1f77bcf86cd799439021"
 *                 notes: "Fragile windshield"
 *               - vehicle: "507f1f77bcf86cd799439022"
 *             notes: "Priority shipment"
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
 *                   $ref: '#/components/schemas/StockTransferResponse'
 *       400:
 *         description: |
 *           Possible errors:
 *           - Source and destination branches cannot be the same
 *           - At least one vehicle is required for transfer
 *           - Invalid branch or vehicle IDs
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/',
  protect,
  requirePermission('STOCK_TRANSFER.CREATE'),
  logAction('CREATE_TRANSFER', 'StockTransfer'),
  stockTransferController.createTransfer
);


/**
 * @swagger
 * /api/v1/transfers:
 *   get:
 *     summary: Get all stock transfers
 *     description: Retrieve all stock transfers with optional filtering
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
 *           enum: [completed, cancelled]
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
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     transfers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StockTransferResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/',
  protect,
  requirePermission('STOCK_TRANSFER.READ'),
   stockTransferController.getAllTransfers);


/**
 * @swagger
 * /api/v1/transfers/{transferId}:
 *   get:
 *     summary: Get transfer details
 *     description: Get detailed information about a specific stock transfer
 *     tags: [Stock Transfer]
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439013
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
 *                   $ref: '#/components/schemas/StockTransferResponse'
 *       400:
 *         description: Invalid transfer ID format
 *       404:
 *         description: Transfer not found
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:transferId',
  protect,
  requirePermission('STOCK_TRANSFER.READ'),
   stockTransferController.getTransferById);


/**
 * @swagger
 * /api/v1/transfers/{transferId}/status:
 *   put:
 *     summary: Cancel a stock transfer (Admin+)
 *     description: |
 *       Cancel a completed stock transfer. This will:
 *       - Mark the transfer as cancelled
 *       - Revert all vehicles to the source branch
 *     tags: [Stock Transfer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439013
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusUpdateInput'
 *           example:
 *             status: "cancelled"
 *             notes: "Cancelled due to incorrect destination"
 *     responses:
 *       200:
 *         description: Transfer cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/StockTransferResponse'
 *       400:
 *         description: Invalid status or request
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Transfer not found
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
  '/:transferId/status',
  protect,
  requirePermission('STOCK_TRANSFER.UPDATE'),
  logAction('CANCEL_TRANSFER', 'StockTransfer'),
  stockTransferController.updateTransferStatus
);


/**
 * @swagger
 * /api/v1/transfers/{transferId}/items/{itemId}:
 *   put:
 *     summary: Cancel a transfer item (Admin+)
 *     description: |
 *       Cancel a specific item in a transfer. This will:
 *       - Mark the item as cancelled
 *       - Revert the vehicle to the source branch
 *     tags: [Stock Transfer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439013
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439021
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusUpdateInput'
 *           example:
 *             status: "cancelled"
 *             notes: "Vehicle damaged during transfer"
 *     responses:
 *       200:
 *         description: Transfer item cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/StockTransferResponse'
 *       400:
 *         description: Invalid status or request
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Transfer or item not found
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
  '/:transferId/items/:itemId',
  protect,
  requirePermission('STOCK_TRANSFER.UPDATE'),
  logAction('CANCEL_TRANSFER_ITEM', 'StockTransfer'),
  stockTransferController.updateTransferItemStatus
);


/**
 * @swagger
 * /api/v1/transfers/branches/{branchId}:
 *   get:
 *     summary: Get transfers by branch
 *     description: Retrieve transfers associated with a branch (incoming, outgoing, or both)
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
 *         description: Filter by transfer direction
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
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: object
 *                   properties:
 *                     transfers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StockTransferResponse'
 *       400:
 *         description: Invalid branch ID
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/branches/:branchId',
  protect,
  requirePermission('STOCK_TRANSFER.READ'),
   stockTransferController.getTransfersByBranch);


/**
 * @swagger
 * /api/v1/transfers/branches/{branchId}/vehicles:
 *   get:
 *     summary: Get vehicles at branch
 *     description: Retrieve list of vehicles currently located at a branch
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
 *         description: List of vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/VehicleAtBranchResponse'
 *       400:
 *         description: Invalid branch ID
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/branches/:branchId/vehicles',
  protect,
  requirePermission('STOCK_TRANSFER.READ'),
  stockTransferController.getVehiclesAtBranch
);
/**
 * @swagger
 * /api/v1/transfers/{transferId}/challan:
 *   post:
 *     summary: Upload a challan document for a transfer (Admin+)
 *     description: Upload a single document/challan for a stock transfer
 *     tags: [Stock Transfer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439013
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               challan:
 *                 type: string
 *                 format: binary
 *                 description: The document file to upload (PDF, JPG, PNG)
 *     responses:
 *       200:
 *         description: Challan document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/StockTransferResponse'
 *       400:
 *         description: Invalid file or transfer ID
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Transfer not found
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/:transferId/challan',
  protect,
  requirePermission('STOCK_TRANSFER.UPDATE'),
  upload.single('challan'),
  (err, req, res, next) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size too large. Maximum 5MB allowed.', 400));
      }
      return next(err);
    }
    next();
  },
  logAction('UPLOAD_TRANSFER_CHALLAN', 'StockTransfer'),
  stockTransferController.uploadTransferChallan
);

module.exports = router;
