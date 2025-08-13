// routes/voucherRoutes.js
const express = require("express");
const router = express.Router();
const voucherController = require("../controllers/allCashRecipts");

/**
 * @swagger
 * tags:
 *   name: Vouchers
 *   description: Voucher management APIs (Workshop, Cash, Contra)
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
 * /api/v1/vouchers/branch/{branchId}/daybook/{date}:
 *   get:
 *     summary: Get vouchers filtered by branch ID and up to a selected date (inclusive)
 *     tags: [Vouchers]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID to filter vouchers
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date (YYYY-MM-DD) to get vouchers up to (inclusive)
 *     responses:
 *       200:
 *         description: List of vouchers filtered by branch and date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Voucher object from workshop, cash, or contra collections
 *       400:
 *         description: Missing or invalid parameters
 *       500:
 *         description: Server error
 */
router.get(
  "/branch/:branchId/daybook/:date",
  voucherController.getVouchersByBranchAndUptoDate
);

/**
 * @swagger
 * /api/v1/vouchers/{id}:
 *   get:
 *     summary: Get voucher by ID (searches across Workshop, Cash, and Contra)
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
 *         description: Voucher details
 *       404:
 *         description: Voucher not found
 */
router.get("/:id", voucherController.getVoucherById);

/**
 * @swagger
 * /api/v1/vouchers/branch/{branchId}/cashbook/{date}:
 *   get:
 *     summary: Get all vouchers from Workshop, Cash, and Contra by branch and date
 *     tags: [Vouchers]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         schema:
 *           type: string
 *         required: true
 *         description: Branch ID to filter vouchers
 *       - in: path
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Date (YYYY-MM-DD) to filter vouchers
 *     responses:
 *       200:
 *         description: List of vouchers for the given branch and date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Missing branchId or date
 *       500:
 *         description: Server error
 */
router.get(
  "/branch/:branchId/cashbook/:date",
  voucherController.getVouchersByBranchAndDate
);

/**
 * @swagger
 * /api/v1/vouchers/status/{status}:
 *   get:
 *     summary: Get vouchers by status (pending, approved, rejected)
 *     tags: [Vouchers]
 *     parameters:
 *       - in: path
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         required: true
 *         description: The status of vouchers to filter by
 *     responses:
 *       200:
 *         description: List of vouchers with given status
 */
router.get("/status/:status", voucherController.getVouchersByStatus);

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
