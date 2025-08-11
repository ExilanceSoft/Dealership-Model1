// routes/voucherRoutes.js
const express = require("express");
const router = express.Router();
const voucherController = require("../controllers/allCashRecipts");

/**
 * @swagger
 * tags:
 *   name: Vouchers
 *   description: Voucher management APIs
 */

/**
 * @swagger
 * /api/v1/vouchers:
 *   get:
 *     summary: Get all vouchers from Workshop, Cash, and Contra
 *     tags: [Vouchers]
 *     responses:
 *       200:
 *         description: List of all vouchers
 */
router.get("/", voucherController.getAllVouchers);

/**
 * @swagger
 * /api/v1/vouchers/receipt/{id}:
 *   get:
 *     summary: Download a voucher receipt PDF
 *     tags: [Vouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the voucher
 *     responses:
 *       200:
 *         description: PDF file of the voucher receipt
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Voucher not found
 */
router.get("/receipt/:id", voucherController.downloadVoucherReceipt);

module.exports = router;
