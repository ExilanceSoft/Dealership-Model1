// routes/commissionRangeRoutes.js
const express = require('express');
const router = express.Router();
const commissionRangeController = require('../controllers/commissionRangeController');
const { protect } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: CommissionRanges
 *   description: Commission range management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CommissionRange:
 *       type: object
 *       required:
 *         - minAmount
 *       properties:
 *         minAmount:
 *           type: number
 *           minimum: 0
 *           description: Minimum amount for this range
 *           example: 1
 *         maxAmount:
 *           type: number
 *           nullable: true
 *           description: Maximum amount for this range (null for open-ended)
 *           example: 20000
 *         isActive:
 *           type: boolean
 *           default: true
 */

/**
 * @swagger
 * /api/v1/commission-ranges:
 *   post:
 *     summary: Create new commission range
 *     tags: [CommissionRanges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionRange'
 *     responses:
 *       201:
 *         description: Commission range created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/',
  protect,
  requirePermission('BROKER.CREATE'),
  logAction('CREATE_COMMISSION_RANGE', 'CommissionRange'),
  commissionRangeController.createCommissionRange
);

/**
 * @swagger
 * /api/v1/commission-ranges:
 *   get:
 *     summary: Get all commission ranges
 *     tags: [CommissionRanges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of commission ranges
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  protect,
  requirePermission('BROKER.READ'),
  commissionRangeController.getAllCommissionRanges
);

/**
 * @swagger
 * /api/v1/commission-ranges/{id}:
 *   put:
 *     summary: Update commission range
 *     tags: [CommissionRanges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Commission range ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionRange'
 *     responses:
 *       200:
 *         description: Commission range updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Commission range not found
 */
router.put(
  '/:id',
  protect,
  requirePermission('BROKER.UPDATE'),
  logAction('UPDATE_COMMISSION_RANGE', 'CommissionRange'),
  commissionRangeController.updateCommissionRange
);

/**
 * @swagger
 * /api/v1/commission-ranges/{id}:
 *   delete:
 *     summary: Delete commission range
 *     tags: [CommissionRanges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Commission range ID
 *     responses:
 *       200:
 *         description: Commission range deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Commission range not found
 */
router.delete(
  '/:id',
  protect,
  requirePermission('BROKER.DELETE'),
  commissionRangeController.deleteCommissionRange
);

module.exports = router;