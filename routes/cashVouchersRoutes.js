const express = require("express");
const router = express.Router();
const cashVoucherController = require("../controllers/cashVouchersController");

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
 *       example:
 *         voucherType: "credit"
 *         recipientName: "John Doe"
 *         expenseType: "Travel"
 *         amount: 500
 *         remark: "Trip to client office"
 *         cashLocation: "Main Branch"
 *         status: "pending"
 *         branch: "685641b4a584a450570f20ae"
 */

/**
 * @swagger
 * /api/v1/cash-vouchers:
 *   post:
 *     summary: Create a new cash voucher
 *     tags: [Cash Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CashVoucher'
 *     responses:
 *       201:
 *         description: Voucher created
 */
router.post("/", cashVoucherController.createCashVoucher);


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
 *   put:
 *     summary: Update voucher by ID
 *     tags: [Cash Vouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CashVoucher'
 *     responses:
 *       200:
 *         description: Voucher updated
 *       404:
 *         description: Not found
 */
router.put("/:id", cashVoucherController.updateCashVoucher);

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
