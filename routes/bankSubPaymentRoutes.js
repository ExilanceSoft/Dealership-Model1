const express = require('express');
const router = express.Router();
const bankSubPaymentModeController = require('../controllers/bankPaymentModeController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: BankSubPaymentModes
 *   description: Bank Sub Payment Mode management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BankSubPaymentMode:
 *       type: object
 *       required:
 *         - payment_mode
 *         - payment_description
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *           example: 65d1a3b1f8d1b61289e4a3d1
 *         payment_mode:
 *           type: string
 *           description: Unique payment mode name
 *           example: "Credit Card"
 *         payment_description:
 *           type: string
 *           description: Payment mode description
 *           example: "Payment via credit card"
 *         is_active:
 *           type: boolean
 *           description: Active status
 *           example: true
 *         createdBy:
 *           type: string
 *           description: Creator user ID
 *           example: 65d1a3b1f8d1b61289e4a3d2
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *           example: "2024-02-18T12:34:56.789Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 *           example: "2024-02-18T12:34:56.789Z"
 */

/**
 * @swagger
 * /api/v1/banksubpaymentmodes:
 *   post:
 *     summary: Create new Bank Sub Payment Mode (Admin+)
 *     tags: [BankSubPaymentModes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payment_mode
 *               - payment_description
 *             properties:
 *               payment_mode:
 *                 type: string
 *                 example: "Credit Card"
 *               payment_description:
 *                 type: string
 *                 example: "Payment via credit card"
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Bank Sub Payment Mode created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BankSubPaymentMode'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  requirePermission('BANK_SUB_PAYMENT_MODE.CREATE'),
  logAction('CREATE_BANK_SUB_PAYMENT_MODE'),
  bankSubPaymentModeController.createBankSubPaymentMode
);

/**
 * @swagger
 * /api/v1/banksubpaymentmodes:
 *   get:
 *     summary: Get all Bank Sub Payment Modes
 *     tags: [BankSubPaymentModes]
 *     security:
 *       - bearerAuth: []
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *     responses:
 *       200:
 *         description: Bank Sub Payment Modes list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BankSubPaymentMode'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  requirePermission('BANK_SUB_PAYMENT_MODE.READ'),
  bankSubPaymentModeController.getBankSubPaymentModes
);

/**
 * @swagger
 * /api/v1/banksubpaymentmodes/{id}:
 *   get:
 *     summary: Get Bank Sub Payment Mode by ID
 *     tags: [BankSubPaymentModes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank Sub Payment Mode ID
 *     responses:
 *       200:
 *         description: Bank Sub Payment Mode details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BankSubPaymentMode'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  protect,
  requirePermission('BANK_SUB_PAYMENT_MODE.READ'),
  bankSubPaymentModeController.getBankSubPaymentMode
);

/**
 * @swagger
 * /api/v1/banksubpaymentmodes/{id}:
 *   put:
 *     summary: Update Bank Sub Payment Mode (Admin+)
 *     tags: [BankSubPaymentModes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank Sub Payment Mode ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payment_mode:
 *                 type: string
 *                 example: "Updated Credit Card"
 *               payment_description:
 *                 type: string
 *                 example: "Updated payment description"
 *     responses:
 *       200:
 *         description: Updated Bank Sub Payment Mode
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BankSubPaymentMode'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  protect,
  requirePermission('BANK_SUB_PAYMENT_MODE.UPDATE'),
  logAction('UPDATE_BANK_SUB_PAYMENT_MODE'),
  bankSubPaymentModeController.updateBankSubPaymentMode
);

/**
 * @swagger
 * /api/v1/banksubpaymentmodes/{id}/status:
 *   patch:
 *     summary: Update Bank Sub Payment Mode status (Admin+)
 *     tags: [BankSubPaymentModes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank Sub Payment Mode ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active:
 *                 type: boolean
 *             required:
 *               - is_active
 *     responses:
 *       200:
 *         description: Status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BankSubPaymentMode'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/status',
  protect,
  requirePermission('BANK_SUB_PAYMENT_MODE.UPDATE'),
  logAction('UPDATE_BANK_SUB_PAYMENT_MODE_STATUS'),
  bankSubPaymentModeController.updateBankSubPaymentModeStatus
);

/**
 * @swagger
 * /api/v1/banksubpaymentmodes/{id}:
 *   delete:
 *     summary: Delete Bank Sub Payment Mode (SuperAdmin only)
 *     tags: [BankSubPaymentModes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bank Sub Payment Mode ID
 *     responses:
 *       200:
 *         description: Bank Sub Payment Mode deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  protect,
  requirePermission('BANK_SUB_PAYMENT_MODE.DELETE'),
  logAction('DELETE_BANK_SUB_PAYMENT_MODE'),
  bankSubPaymentModeController.deleteBankSubPaymentMode
);

module.exports = router;