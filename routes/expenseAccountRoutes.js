const express = require('express');
const router = express.Router();
const expenseAccountController = require('../controllers/expenseAccountController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: ExpenseAccounts
 *   description: Expense account management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ExpenseAccount:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the expense account
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: The expense account name
 *           example: Office Supplies
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Expense account status
 *           example: active
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the expense account
 *           example: 507f1f77bcf86cd799439012
 *         createdByDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the expense account was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the expense account was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 *     ExpenseAccountInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: The expense account name
 *           example: Office Supplies
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Expense account status
 *           example: active
 *     ExpenseAccountStatusInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Expense account status
 *           example: active
 */

/**
 * @swagger
 * /api/v1/expense-accounts:
 *   post:
 *     summary: Create a new expense account (Admin+)
 *     tags: [ExpenseAccounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExpenseAccountInput'
 *     responses:
 *       201:
 *         description: Expense account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpenseAccount'
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
  logAction('CREATE', 'ExpenseAccount'),
  expenseAccountController.createExpenseAccount
);

/**
 * @swagger
 * /api/v1/expense-accounts:
 *   get:
 *     summary: Get all expense accounts (Admin+)
 *     tags: [ExpenseAccounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter expense accounts by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search expense accounts by name
 *     responses:
 *       200:
 *         description: List of expense accounts
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
 *                     expenseAccounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ExpenseAccount'
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
  expenseAccountController.getAllExpenseAccounts
);

/**
 * @swagger
 * /api/v1/expense-accounts/{id}:
 *   get:
 *     summary: Get a specific expense account by ID (Admin+)
 *     tags: [ExpenseAccounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the expense account to get
 *     responses:
 *       200:
 *         description: Expense account details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpenseAccount'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Expense account not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
  expenseAccountController.getExpenseAccountById
);

/**
 * @swagger
 * /api/v1/expense-accounts/{id}:
 *   put:
 *     summary: Update an expense account (Admin+)
 *     tags: [ExpenseAccounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the expense account to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExpenseAccountInput'
 *     responses:
 *       200:
 *         description: Expense account updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpenseAccount'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Expense account not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'ExpenseAccount'),
  expenseAccountController.updateExpenseAccount
);

/**
 * @swagger
 * /api/v1/expense-accounts/{id}/status:
 *   patch:
 *     summary: Update expense account status (Admin+)
 *     tags: [ExpenseAccounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the expense account to update status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExpenseAccountStatusInput'
 *     responses:
 *       200:
 *         description: Expense account status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpenseAccount'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Expense account not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE_STATUS', 'ExpenseAccount'),
  expenseAccountController.updateExpenseAccountStatus
);

/**
 * @swagger
 * /api/v1/expense-accounts/{id}:
 *   delete:
 *     summary: Delete an expense account (SuperAdmin only)
 *     tags: [ExpenseAccounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the expense account to delete
 *     responses:
 *       204:
 *         description: Expense account deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Expense account not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'ExpenseAccount'),
  expenseAccountController.deleteExpenseAccount
);

module.exports = router;