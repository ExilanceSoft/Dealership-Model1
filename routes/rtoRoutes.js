const express = require('express');
const router = express.Router();
const rtoController = require('../controllers/rtoController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: RTO
 *   description: Regional Transport Office Management
 */

/**
 * @swagger
 * /api/v1/rtos:
 *   post:
 *     summary: Create a new RTO (Admin only)
 *     tags: [RTO]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RTO'
 *     responses:
 *       201:
 *         description: RTO created successfully
 *       400:
 *         description: Validation error or duplicate RTO code
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires admin role)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('CREATE', 'RTO'),
  rtoController.createRto
);

/**
 * @swagger
 * /api/v1/rtos:
 *   get:
 *     summary: Get all RTOs with optional filtering
 *     tags: [RTO]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state (case-insensitive)
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city (case-insensitive)
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: Filter by district (case-insensitive)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of filtered RTOs
 *       500:
 *         description: Internal server error
 */
router.get('/', rtoController.getRtos);

/**
 * @swagger
 * /api/v1/rtos/{id}:
 *   get:
 *     summary: Get RTO by ID
 *     tags: [RTO]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: RTO details
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: RTO not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', rtoController.getRto);

/**
 * @swagger
 * /api/v1/rtos/{id}:
 *   put:
 *     summary: Update RTO (Admin only)
 *     tags: [RTO]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/RTO'
 *     responses:
 *       200:
 *         description: RTO updated successfully
 *       400:
 *         description: Validation error or trying to change RTO code
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires admin role)
 *       404:
 *         description: RTO not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'RTO'),
  rtoController.updateRto
);

/**
 * @swagger
 * /api/v1/rtos/{id}:
 *   delete:
 *     summary: Delete RTO (SuperAdmin only)
 *     tags: [RTO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: RTO deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires superadmin role)
 *       404:
 *         description: RTO not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:id',
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'RTO'),
  rtoController.deleteRto
);

module.exports = router;