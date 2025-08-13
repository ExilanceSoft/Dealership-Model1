const express = require("express");
const router = express.Router();
const workshopReciptController = require("../controllers/workShopReciptController");

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
 *         - reciptType
 *         - amount
 *         - bankLocation
 *         - branch
 *       properties:
 *         voucherType:
 *           type: string
 *           enum: [credit, debit]
 *         recipientName:
 *           type: string
 *         reciptType:
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
 *         date:
 *           type: string
 *           format: date
 *       example:
 *         voucherType: credit
 *         recipientName: "John Doe"
 *         reciptType: "Workshop"
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
 *     summary: Create a new workshop receipt voucher
 *     tags: [WorkShopReciptVouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkShopReciptVoucher'
 *     responses:
 *       201:
 *         description: Workshop receipt voucher created
 */
router.post("/", workshopReciptController.createWorkShopReciptVoucher);

/**
 * @swagger
 * /api/v1/workshop-receipts:
 *   get:
 *     summary: Get all workshop receipt vouchers
 *     tags: [WorkShopReciptVouchers]
 *     responses:
 *       200:
 *         description: List of workshop receipt vouchers
 */
router.get("/", workshopReciptController.getAllWorkShopReciptVouchers);

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
 *         description: The status of vouchers
 *     responses:
 *       200:
 *         description: List of vouchers with given status
 */
router.get("/status/:status", workshopReciptController.getWorkShopReciptVouchersByStatus);

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
 *         description: The voucher ID
 *     responses:
 *       200:
 *         description: Voucher found
 *       404:
 *         description: Voucher not found
 */
router.get("/:id", workshopReciptController.getWorkShopReciptVoucherById);

/**
 * @swagger
 * /api/v1/workshop-receipts/{id}:
 *   put:
 *     summary: Update a workshop receipt voucher by ID
 *     tags: [WorkShopReciptVouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The voucher ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkShopReciptVoucher'
 *     responses:
 *       200:
 *         description: Voucher updated
 *       404:
 *         description: Voucher not found
 */
router.put("/:id", workshopReciptController.updateWorkShopReciptVoucher);

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
 *         description: The voucher ID
 *     responses:
 *       200:
 *         description: Voucher deleted
 *       404:
 *         description: Voucher not found
 */
router.delete("/:id", workshopReciptController.deleteWorkShopReciptVoucher);

module.exports = router;
