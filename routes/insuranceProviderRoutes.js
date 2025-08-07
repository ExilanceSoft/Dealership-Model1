const express = require('express');
const router = express.Router();
const insuranceProviderController = require('../controllers/insuranceProviderController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: InsuranceProviders
 *   description: Insurance Provider management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     InsuranceProvider:
 *       type: object
 *       required:
 *         - provider_name
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *           example: 65d1a3b1f8d1b61289e4a3d1
 *         provider_name:
 *           type: string
 *           description: Insurance provider name
 *           example: "ABC Insurance"
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
 * /api/v1/insurance-providers:
 *   post:
 *     summary: Create new insurance provider (Admin+)
 *     tags: [InsuranceProviders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InsuranceProvider'
 *     responses:
 *       201:
 *         description: Insurance provider created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsuranceProvider'
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
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('CREATE_INSURANCE_PROVIDER'),
  insuranceProviderController.createInsuranceProvider
);

/**
 * @swagger
 * /api/v1/insurance-providers:
 *   get:
 *     summary: Get all insurance providers
 *     tags: [InsuranceProviders]
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
 *         description: Insurance providers list
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
 *                     $ref: '#/components/schemas/InsuranceProvider'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  insuranceProviderController.getInsuranceProviders
);

/**
 * @swagger
 * /api/v1/insurance-providers/{id}:
 *   get:
 *     summary: Get insurance provider by ID
 *     tags: [InsuranceProviders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Insurance provider ID
 *     responses:
 *       200:
 *         description: Insurance provider details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsuranceProvider'
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
  insuranceProviderController.getInsuranceProvider
);

/**
 * @swagger
 * /api/v1/insurance-providers/{id}:
 *   put:
 *     summary: Update insurance provider (Admin+)
 *     tags: [InsuranceProviders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Insurance provider ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InsuranceProvider'
 *     responses:
 *       200:
 *         description: Updated insurance provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsuranceProvider'
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
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('UPDATE_INSURANCE_PROVIDER'),
  insuranceProviderController.updateInsuranceProvider
);

/**
 * @swagger
 * /api/v1/insurance-providers/{id}/status:
 *   patch:
 *     summary: Update insurance provider status (Admin+)
 *     tags: [InsuranceProviders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Insurance provider ID
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
 *               $ref: '#/components/schemas/InsuranceProvider'
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
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('UPDATE_INSURANCE_PROVIDER_STATUS'),
  insuranceProviderController.updateInsuranceProviderStatus
);

/**
 * @swagger
 * /api/v1/insurance-providers/{id}:
 *   delete:
 *     summary: Delete insurance provider (SuperAdmin only)
 *     tags: [InsuranceProviders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Insurance provider ID
 *     responses:
 *       200:
 *         description: Insurance provider deleted
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
  authorize('SUPERADMIN','SALES_EXECUTIVE'),
  logAction('DELETE_INSURANCE_PROVIDER'),
  insuranceProviderController.deleteInsuranceProvider
);

module.exports = router;