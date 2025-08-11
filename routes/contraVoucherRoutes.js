const express = require('express');
const router = express.Router();
const contraVoucherController = require('../controllers/contraController');

/**
 * @swagger
 * tags:
 *   name: ContraVouchers
 *   description: API for managing contra vouchers
 */

/**
 * @swagger
 * /api/v1/contra-vouchers:
 *   post:
 *     summary: Create a new contra voucher
 *     tags: [ContraVouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voucherType
 *               - recipientName
 *               - contraType
 *               - amount
 *               - bankLocation
 *             properties:
 *               voucherType:
 *                 type: string
 *                 enum: [credit, debit]
 *               recipientName:
 *                 type: string
 *               contraType:
 *                 type: string
 *               amount:
 *                 type: number
 *               remark:
 *                 type: string
 *               bankName:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *               bankLocation:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contra voucher created successfully
 */
router.post('/', contraVoucherController.createContraVoucher);

/**
 * @swagger
 * /api/v1/contra-vouchers:
 *   get:
 *     summary: Get all contra vouchers
 *     tags: [ContraVouchers]
 *     responses:
 *       200:
 *         description: List of all contra vouchers
 */
router.get('/', contraVoucherController.getAllContraVouchers);

/**
 * @swagger
 * /api/v1/contra-vouchers/status/{status}:
 *   get:
 *     summary: Get contra vouchers by status
 *     tags: [ContraVouchers]
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: List of contra vouchers filtered by status
 */
router.get('/status/:status', contraVoucherController.getContraVouchersByStatus);

/**
 * @swagger
 * /api/v1/contra-vouchers/{id}:
 *   get:
 *     summary: Get a contra voucher by ID
 *     tags: [ContraVouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contra voucher found
 *       404:
 *         description: Contra voucher not found
 */
router.get('/:id', contraVoucherController.getContraVoucherById);

/**
 * @swagger
 * /api/v1/contra-vouchers/{id}:
 *   put:
 *     summary: Update a contra voucher by ID
 *     tags: [ContraVouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               voucherType:
 *                 type: string
 *                 enum: [credit, debit]
 *               recipientName:
 *                 type: string
 *               contraType:
 *                 type: string
 *               amount:
 *                 type: number
 *               remark:
 *                 type: string
 *               bankName:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *               bankLocation:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contra voucher updated successfully
 *       404:
 *         description: Contra voucher not found
 */
router.put('/:id', contraVoucherController.updateContraVoucher);

/**
 * @swagger
 * /api/v1/contra-vouchers/{id}:
 *   delete:
 *     summary: Delete a contra voucher by ID
 *     tags: [ContraVouchers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contra voucher deleted successfully
 *       404:
 *         description: Contra voucher not found
 */
router.delete('/:id', contraVoucherController.deleteContraVoucher);

module.exports = router;
