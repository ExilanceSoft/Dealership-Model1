const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect, authorize } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   - name: Finance Providers
 *     description: Manage financial institutions (banks/NBFCs)
 *   - name: Finance Rates
 *     description: Manage branch-specific GC rates
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FinanceProvider:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           example: "ABC Finance"
 *         is_active:
 *           type: boolean
 *           example: true
 *         createdBy:
 *           $ref: '#/components/schemas/UserReference'
 *         updatedBy:
 *           $ref: '#/components/schemas/UserReference'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-01-01T00:00:00.000Z"
 * 
 *     FinanceRate:
 *       type: object
 *       required:
 *         - branch
 *         - financeProvider
 *         - gcRate
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         branch:
 *           $ref: '#/components/schemas/BranchReference'
 *         financeProvider:
 *           $ref: '#/components/schemas/FinanceProviderReference'
 *         gcRate:
 *           type: number
 *           example: 12.5
 *         is_active:
 *           type: boolean
 *           example: true
 *         createdBy:
 *           $ref: '#/components/schemas/UserReference'
 *         updatedBy:
 *           $ref: '#/components/schemas/UserReference'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-01-01T00:00:00.000Z"
 * 
 *     UserReference:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439013
 *         name:
 *           type: string
 *           example: "John Doe"
 *         email:
 *           type: string
 *           example: "john@example.com"
 * 
 *     BranchReference:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439014
 *         name:
 *           type: string
 *           example: "Mumbai Branch"
 *         city:
 *           type: string
 *           example: "Mumbai"
 * 
 *     FinanceProviderReference:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439015
 *         name:
 *           type: string
 *           example: "ABC Finance"
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// ====================== FINANCE PROVIDERS ======================

/**
 * @swagger
 * /api/v1/financers/providers:
 *   post:
 *     summary: Create a new finance provider
 *     tags: [Finance Providers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ABC Finance"
 *     responses:
 *       201:
 *         description: Finance provider created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceProvider'
 *       400:
 *         description: Invalid input or provider already exists
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.post('/providers', 
  protect, 
  requirePermission('FINANCE_PROVIDER.CREATE'),
  financeController.createProvider
);

/**
 * @swagger
 * /api/v1/financers/providers:
 *   get:
 *     summary: Get all finance providers
 *     tags: [Finance Providers]
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of finance providers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FinanceProvider'
 *       500:
 *         description: Server error
 */
router.get('/providers',
  protect,
  requirePermission('FINANCE_PROVIDER.READ'),
  financeController.getProviders);

/**
 * @swagger
 * /api/v1/financers/providers/{id}:
 *   get:
 *     summary: Get a single finance provider
 *     tags: [Finance Providers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance provider ID
 *     responses:
 *       200:
 *         description: Finance provider details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceProvider'
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Server error
 */
router.get('/providers/:id',
  protect,
  requirePermission('FINANCE_PROVIDER.READ'),
   financeController.getProvider);

/**
 * @swagger
 * /api/v1/financers/providers/{id}:
 *   put:
 *     summary: Update a finance provider
 *     tags: [Finance Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance provider ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ABC Finance Corp"
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Provider updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceProvider'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Server error
 */
router.put('/providers/:id', 
  protect, 
  requirePermission('FINANCE_PROVIDER.UPDATE'),
  financeController.updateProvider
);

/**
 * @swagger
 * /api/v1/financers/providers/{id}:
 *   delete:
 *     summary: Delete a finance provider
 *     tags: [Finance Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance provider ID
 *     responses:
 *       200:
 *         description: Provider deleted successfully
 *       400:
 *         description: Cannot delete - provider has existing rates
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Server error
 */
router.delete('/providers/:id', 
  protect, 
  requirePermission('FINANCE_PROVIDER.DELETE'), 
  financeController.deleteProvider
);

// ====================== FINANCE RATES ======================

/**
 * @swagger
 * /api/v1/financers/rates:
 *   post:
 *     summary: Create a new GC rate for branch-provider combination
 *     tags: [Finance Rates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branchId
 *               - providerId
 *               - gcRate
 *             properties:
 *               branchId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439016"
 *               providerId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439017"
 *               gcRate:
 *                 type: number
 *                 example: 12.5
 *     responses:
 *       201:
 *         description: GC rate created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceRate'
 *       400:
 *         description: Invalid input or rate already exists
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.post('/rates', 
  protect, 
  requirePermission('FINANCE_PROVIDER.CREATE'), 
  financeController.createRate
);

/**
 * @swagger
 * /api/v1/financers/rates/{id}:
 *   get:
 *     summary: Get a single GC rate
 *     tags: [Finance Rates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance rate ID
 *     responses:
 *       200:
 *         description: GC rate details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceRate'
 *       404:
 *         description: Rate not found
 *       500:
 *         description: Server error
 */
router.get('/rates/:id',
  protect,
  requirePermission('FINANCE_PROVIDER.READ'),
   financeController.getRate);

/**
 * @swagger
 * /api/v1/financers/rates/{id}:
 *   put:
 *     summary: Update a GC rate
 *     tags: [Finance Rates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance rate ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gcRate:
 *                 type: number
 *                 example: 11.5
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Rate updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceRate'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Rate not found
 *       500:
 *         description: Server error
 */
router.put('/rates/:id', 
  protect, 
  requirePermission('FINANCE_PROVIDER.UPDATE'),
  financeController.updateRate
);

/**
 * @swagger
 * /api/v1/financers/rates/{id}:
 *   delete:
 *     summary: Delete a GC rate
 *     tags: [Finance Rates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance rate ID
 *     responses:
 *       200:
 *         description: Rate deleted successfully
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Rate not found
 *       500:
 *         description: Server error
 */
router.delete('/rates/:id', 
  protect, 
  requirePermission('FINANCE_PROVIDER.DELETE'), 
  financeController.deleteRate
);

/**
 * @swagger
 * /api/v1/financers/branches/{branchId}/rates:
 *   get:
 *     summary: Get all GC rates for a branch
 *     tags: [Finance Rates]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of GC rates for the branch
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FinanceRate'
 *       500:
 *         description: Server error
 */
router.get('/branches/:branchId/rates',
  protect,
  requirePermission('FINANCE_PROVIDER.READ'),
  financeController.getBranchRates);

/**
 * @swagger
 * /api/v1/financers/rates:
 *   get:
 *     summary: Get all finance rates
 *     tags: [Finance Rates]
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: string
 *         description: Filter by finance provider ID
 *     responses:
 *       200:
 *         description: List of all finance rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FinanceRate'
 *       500:
 *         description: Server error
 */
router.get('/rates',
  protect,
  requirePermission('FINANCE_PROVIDER.READ'),
  financeController.getAllRates);

/**
 * @swagger
 * /api/v1/financers/providers/{id}/rates:
 *   get:
 *     summary: Get finance provider details with all associated GC rates
 *     tags: [Finance Providers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance provider ID
 *     responses:
 *       200:
 *         description: Provider details with associated rates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     provider:
 *                       $ref: '#/components/schemas/FinanceProvider'
 *                     rates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FinanceRate'
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Server error
 */
router.get('/providers/:id/rates',
  protect,
  requirePermission('FINANCE_PROVIDER.READ'),
  financeController.getProviderWithRates);

module.exports = router;