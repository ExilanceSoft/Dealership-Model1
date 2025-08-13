const express = require('express');
const router = express.Router();
const contraVoucherController = require('../controllers/contraController');
const multer = require("multer");
const path = require("path");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit per file
  },
});


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
 *               - branch
 *             properties:
 *               voucherType:
 *                 type: string
 *                 enum: [credit, debit]
 *                 description: Type of voucher (credit or debit)
 *               recipientName:
 *                 type: string
 *               contraType:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               remark:
 *                 type: string
 *               bankLocation:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *               branch:
 *                 type: string
 *                 description: MongoDB ObjectId of the branch
 *     responses:
 *       201:
 *         description: Contra voucher created successfully
 */
router.post('/', contraVoucherController.createContraVoucher);


/**
 * @swagger
 * /api/v1/contra-vouchers:
 *   get:
 *     summary: Get all contra vouchers (supports filters and pagination)
 *     tags: [ContraVouchers]
 *     parameters:
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
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
 *     summary: Update a contra voucher by ID (with file upload support)
 *     tags: [ContraVouchers]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
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
 *               contraType:
 *                 type: string
 *               amount:
 *                 type: number
 *               remark:
 *                 type: string
 *               bankLocation:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected]
 *               branch:
 *                 type: string
 *               bill_url:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Contra voucher updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Contra voucher not found
 *       500:
 *         description: Server error
 */
router.put('/:id', upload.single('bill_url'), contraVoucherController.updateContraVoucher);




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
