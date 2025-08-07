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
 *             $ref: '#/components/schemas/ContraVoucher'
 *     responses:
 *       201:
 *         description: Contra voucher created
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
 *         description: List of contra vouchers
 */
router.get('/', contraVoucherController.getAllContraVouchers);

/**
 * @swagger
 * /api/v1/contra-vouchers/pending:
 *   get:
 *     summary: Get all pending contra vouchers
 *     tags: [ContraVouchers]
 *     responses:
 *       200:
 *         description: List of pending vouchers
 */
router.get('/pending', contraVoucherController.getPendingContraVouchers);

/**
 * @swagger
 * /api/v1/contra-vouchers/approved:
 *   get:
 *     summary: Get all approved contra vouchers
 *     tags: [ContraVouchers]
 *     responses:
 *       200:
 *         description: List of approved vouchers
 */
router.get('/approved', contraVoucherController.getApprovedContraVouchers);

/**
 * @swagger
 * /api/v1/contra-vouchers/rejected:
 *   get:
 *     summary: Get all rejected contra vouchers
 *     tags: [ContraVouchers]
 *     responses:
 *       200:
 *         description: List of rejected vouchers
 */
router.get('/rejected', contraVoucherController.getRejectedContraVouchers);

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
 *         description: The voucher ID
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
 *         description: The voucher ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContraVoucher'
 *     responses:
 *       200:
 *         description: Contra voucher updated
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
 *         description: The voucher ID
 *     responses:
 *       200:
 *         description: Contra voucher deleted
 *       404:
 *         description: Contra voucher not found
 */
router.delete('/:id', contraVoucherController.deleteContraVoucher);

module.exports = router;
