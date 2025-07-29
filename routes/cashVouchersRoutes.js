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
 *         - recipientName
 *         - expenseType
 *         - amount
 *         - cashLocation
 *       properties:
 *         recipientName:
 *           type: string
 *         expenseType:
 *           type: string
 *         amount:
 *           type: number
 *         remark:
 *           type: string
 *         cashLocation:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *       example:
 *         recipientName: "John Doe"
 *         expenseType: "Travel"
 *         amount: 500
 *         remark: "Trip to client office"
 *         cashLocation: "Main Branch"
 *         status: "PENDING"
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
 * /api/v1/cash-vouchers:
 *   get:
 *     summary: Get all cash vouchers
 *     tags: [Cash Vouchers]
 *     responses:
 *       200:
 *         description: List of vouchers
 */
router.get("/", cashVoucherController.getAllCashVouchers);

/**
 * @swagger
 * /api/v1/cash-vouchers/{id}:
 *   get:
 *     summary: Get voucher by ID
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
 * /cash-vouchers/{id}:
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
