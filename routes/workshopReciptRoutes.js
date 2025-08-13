const express = require("express");
const router = express.Router();
const workshopReciptController = require("../controllers/workShopReciptController");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

/**
 * @swagger
 * tags:
 *   name: WorkShopReciptVouchers
 *   description: API for managing workshop receipt vouchers
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     WorkShopReciptVoucher:
 *       type: object
 *       required:
 *         - voucherType
 *         - recipientName
 *         - receiptType
 *         - amount
 *         - branch
 *       properties:
 *         voucherType:
 *           type: string
 *           enum: [credit, debit]
 *         recipientName:
 *           type: string
 *         receiptType:
 *           type: string
 *           enum: [Workshop, Other]
 *         amount:
 *           type: number
 *         remark:
 *           type: string
 *         bankName:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         bankLocation:
 *           type: string
 *         branch:
 *           type: string
 *           description: MongoDB ObjectId of the branch
 *         billUrl:
 *           type: string
 *           description: URL of the uploaded bill file
 *         date:
 *           type: string
 *           format: date
 *       example:
 *         voucherType: credit
 *         recipientName: "John Doe"
 *         receiptType: "Workshop"
 *         amount: 2500
 *         remark: "Service payment"
 *         bankName: "HDFC Bank"
 *         status: pending
 *         bankLocation: "Pune"
 *         branch: "64b2f0c4e4b0c3a1b5f5f1b2"
 *         date: "2025-08-13"
 */

/**
 * @swagger
 * /api/v1/workshop-receipts:
 *   post:
 *     summary: Create a new workshop receipt voucher (with optional bill file)
 *     tags: [WorkShopReciptVouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/WorkShopReciptVoucher'
 *               - type: object
 *                 properties:
 *                   bill:
 *                     type: string
 *                     format: binary
 *                     description: Bill file to upload
 *     responses:
 *       201:
 *         description: Workshop receipt voucher created
 *       400:
 *         description: Invalid request body
 */
router.post("/", upload.single("bill"), workshopReciptController.createWorkShopReceiptVoucher);

/**
 * @swagger
 * /api/v1/workshop-receipts:
 *   get:
 *     summary: Get all workshop receipt vouchers
 *     tags: [WorkShopReciptVouchers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of workshop receipt vouchers
 */
router.get("/", workshopReciptController.getAllWorkShopReceiptVouchers);

/**
 * @swagger
 * /api/v1/workshop-receipts/status/{status}:
 *   get:
 *     summary: Get workshop receipt vouchers by status
 *     tags: [WorkShopReciptVouchers]
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: List of vouchers with given status
 */
router.get("/status/:status", workshopReciptController.getWorkShopReceiptVouchersByStatus);

/**
 * @swagger
 * /api/v1/workshop-receipts/{id}:
 *   get:
 *     summary: Get a workshop receipt voucher by ID
 *     tags: [WorkShopReciptVouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Voucher found
 *       404:
 *         description: Voucher not found
 */
router.get("/:id", workshopReciptController.getWorkShopReceiptVoucherById);

/**
 * @swagger
 * /api/v1/workshop-receipts/{id}:
 *   put:
 *     summary: Update a workshop receipt voucher by ID (with optional bill file)
 *     tags: [WorkShopReciptVouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/WorkShopReciptVoucher'
 *               - type: object
 *                 properties:
 *                   bill:
 *                     type: string
 *                     format: binary
 *                     description: Bill file to upload
 *     responses:
 *       200:
 *         description: Voucher updated
 *       404:
 *         description: Voucher not found
 */
router.put("/:id", upload.single("bill"), workshopReciptController.updateWorkShopReceiptVoucher);

/**
 * @swagger
 * /api/v1/workshop-receipts/{id}:
 *   delete:
 *     summary: Delete a workshop receipt voucher by ID
 *     tags: [WorkShopReciptVouchers]
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
 *         description: Voucher not found
 */
router.delete("/:id", workshopReciptController.deleteWorkShopReceiptVoucher);

module.exports = router;
