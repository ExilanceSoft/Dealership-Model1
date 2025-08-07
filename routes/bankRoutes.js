const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Banks
 *   description: Bank name management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Bank:
 *       type: object
 *       required:
 *         - name
 *         - branch
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the bank
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: The bank name
 *           example: State Bank of India
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Bank status
 *           example: active
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the bank
 *           example: 507f1f77bcf86cd799439012
 *         branch:
 *           type: string
 *           description: ID of the branch this bank belongs to
 *           example: 507f1f77bcf86cd799439013
 *         branchDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             id:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the bank was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the bank was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 *     BankInput:
 *       type: object
 *       required:
 *         - name
 *         - branch
 *       properties:
 *         name:
 *           type: string
 *           description: The bank name
 *           example: State Bank of India
 *         branch:
 *           type: string
 *           description: The branch ID
 *           example: 507f1f77bcf86cd799439013
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Bank status
 *           example: active
 *     BankStatusInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Bank status
 *           example: active
 */

/**
 * @swagger
 * /api/v1/banks:
 *   post:
 *     summary: Create a new bank (Admin+)
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BankInput'
 *     responses:
 *       201:
 *         description: Bank created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bank'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('CREATE', 'Bank'),
  bankController.createBank
);

/**
 * @swagger
 * /api/v1/banks:
 *   get:
 *     summary: Get all banks (Admin+)
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter banks by branch ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter banks by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search banks by name
 *     responses:
 *       200:
 *         description: List of banks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     banks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Bank'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
  bankController.getAllBanks
);

/**
 * @swagger
 * /api/v1/banks/{id}:
 *   get:
 *     summary: Get a specific bank by ID (Admin+)
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the bank to get
 *     responses:
 *       200:
 *         description: Bank details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bank'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Bank not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
  bankController.getBankById
);

/**
 * @swagger
 * /api/v1/banks/{id}:
 *   put:
 *     summary: Update a bank (Admin+)
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the bank to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BankInput'
 *     responses:
 *       200:
 *         description: Bank updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bank'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Bank not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'Bank'),
  bankController.updateBank
);

/**
 * @swagger
 * /api/v1/banks/{id}/status:
 *   patch:
 *     summary: Update bank status (Admin+)
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the bank to update status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BankStatusInput'
 *     responses:
 *       200:
 *         description: Bank status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bank'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Bank not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE_STATUS', 'Bank'),
  bankController.updateBankStatus
);

/**
 * @swagger
 * /api/v1/banks/{id}:
 *   delete:
 *     summary: Delete a bank (SuperAdmin only)
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the bank to delete
 *     responses:
 *       204:
 *         description: Bank deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Bank not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'Bank'),
  bankController.deleteBank
);

module.exports = router;