const express = require("express");
const router = express.Router();
const cashVoucherController = require("../controllers/cashVouchersController");
const multer = require("multer");
const path = require("path");


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit per file
  },
});


/**
 * @swagger
 * components:
 *   schemas:
 *     CashVoucher:
 *       type: object
 *       required:
 *         - voucherType
 *         - recipientName
 *         - expenseType
 *         - amount
 *         - cashLocation
 *         - branch
 *       properties:
 *         voucherId:
 *           type: string
 *           description: Auto-generated unique voucher ID (read-only)
 *         date:
 *           type: string
 *           format: date-time
 *           description: Date of voucher (defaults to today)
 *         voucherType:
 *           type: string
 *           enum: [credit, debit]
 *         recipientName:
 *           type: string
 *         expenseType:
 *           type: string
 *         amount:
 *           type: number
 *         paymentMode:
 *           type: string
 *           enum: [cash]
 *           readOnly: true
 *         remark:
 *           type: string
 *         cashLocation:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         branch:
 *           type: string
 *           description: MongoDB ObjectId of the branch
 *         billUrl:
 *           type: string
 *           description: Optional uploaded bill file URL (read-only)
 */

/**
 * @swagger
 * /api/v1/cash-vouchers:
 *   post:
 *     summary: Create a new cash voucher with optional bill upload
 *     tags: [Cash Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               voucherType:
 *                 type: string
 *                 enum: [credit, debit]
 *               recipientName:
 *                 type: string
 *               expenseType:
 *                 type: string
 *               amount:
 *                 type: number
 *               cashLocation:
 *                 type: string
 *               branch:
 *                 type: string
 *               remark:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *               date:
 *                 type: string
 *                 format: date-time
 *               bill:
 *                 type: string
 *                 format: binary
 *                 description: Optional bill file (image or PDF)
 *     responses:
 *       201:
 *         description: Voucher created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashVoucher'
 */
router.post("/", upload.single("bill"), cashVoucherController.createCashVoucher);


/**
 * @swagger
 * /api/v1/cash-vouchers/status/{status}:
 *   get:
 *     summary: Get all cash vouchers by status
 *     tags: [Cash Vouchers]
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Status of the cash vouchers to retrieve
 *     responses:
 *       200:
 *         description: List of cash vouchers matching the status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CashVoucher'
 *       400:
 *         description: Invalid status value
 *       500:
 *         description: Server error
 */
router.get("/status/:status", cashVoucherController.getCashVouchersByStatus);

/**
 * @swagger
 * /api/v1/cash-vouchers:
 *   get:
 *     summary: Get all cash vouchers (with filters & pagination)
 *     tags: [Cash Vouchers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: voucherType
 *         schema:
 *           type: string
 *           enum: [credit, debit]
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of vouchers
 */
router.get("/", cashVoucherController.getAllCashVouchers);

/**
 * @swagger
 * /api/v1/cash-vouchers/{id}:
 *   get:
 *     summary: Get voucher by MongoDB ID
 *     tags: [Cash Vouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Single voucher
 *       404:
 *         description: Not found
 */
router.get("/:id", cashVoucherController.getCashVoucherById);

/**
 * @swagger
 * /api/v1/cash-vouchers/voucher-id/{voucherId}:
 *   get:
 *     summary: Get voucher by voucherId (custom ID)
 *     tags: [Cash Vouchers]
 *     parameters:
 *       - in: path
 *         name: voucherId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Voucher found
 *       404:
 *         description: Not found
 */
router.get("/voucher-id/:voucherId", cashVoucherController.getCashVoucherByVoucherId);

/**
 * @swagger
 * /api/v1/cash-vouchers/{id}:
 *   patch:
 *     summary: Partially update a cash voucher by ID
 *     description: Send only the fields you want to update. Fields not included in the request will remain unchanged.
 *     tags: [Cash Vouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the cash voucher
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               voucherType:
 *                 type: string
 *                 enum: [credit, debit]
 *               recipientName:
 *                 type: string
 *               expenseType:
 *                 type: string
 *               amount:
 *                 type: number
 *               cashLocation:
 *                 type: string
 *               branch:
 *                 type: string
 *                 description: Must be a valid MongoDB ObjectId
 *               remark:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *               date:
 *                 type: string
 *                 format: date-time
 *               bill:
 *                 type: string
 *                 format: binary
 *                 description: Optional bill file (image or PDF)
 *     responses:
 *       200:
 *         description: Voucher updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashVoucher'
 *       400:
 *         description: Invalid request data (e.g., invalid ObjectId for branch)
 *       404:
 *         description: Voucher not found
 *       500:
 *         description: Server error
 */
router.patch("/:id", upload.single("bill"), cashVoucherController.updateCashVoucher);


/**
 * @swagger
 * /api/v1/cash-vouchers/{id}:
 *   delete:
 *     summary: Delete voucher by ID
 *     tags: [Cash Vouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Voucher deleted
 *       404:
 *         description: Not found
 */
router.delete("/:id", cashVoucherController.deleteCashVoucher);

module.exports = router;
