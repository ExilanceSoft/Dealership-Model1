const express = require('express');
const router = express.Router();
const rtoController = require('../controllers/rtoController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: RTOs
 *   description: Regional Transport Office management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RTO:
 *       type: object
 *       required:
 *         - rto_code
 *         - rto_name
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *           example: 65d1a3b1f8d1b61289e4a3d1
 *         rto_code:
 *           type: string
 *           description: Unique RTO code
 *           example: "MH01"
 *         rto_name:
 *           type: string
 *           description: RTO name
 *           example: "Mumbai Central"
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
 * /api/v1/rtos:
 *   post:
 *     summary: Create new RTO (Admin+)
 *     tags: [RTOs]
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
 *         description: RTO created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RTO'
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
  requirePermission('RTO.CREATE'),
  logAction('CREATE_RTO'),
  rtoController.createRTO
);

/**
 * @swagger
 * /api/v1/rtos:
 *   get:
 *     summary: Get all RTOs
 *     tags: [RTOs]
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
 *         description: RTO list
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
 *                     $ref: '#/components/schemas/RTO'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  requirePermission('RTO.READ'),
  rtoController.getRTOs
);

/**
 * @swagger
 * /api/v1/rtos/{id}:
 *   get:
 *     summary: Get RTO by ID
 *     tags: [RTOs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RTO ID
 *     responses:
 *       200:
 *         description: RTO details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RTO'
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
  requirePermission('RTO.READ'),
  rtoController.getRTO
);

/**
 * @swagger
 * /api/v1/rtos/{id}:
 *   put:
 *     summary: Update RTO (Admin+)
 *     tags: [RTOs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RTO ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RTO'
 *     responses:
 *       200:
 *         description: Updated RTO
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RTO'
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
  requirePermission('RTO.UPDATE'),
  logAction('UPDATE_RTO'),
  rtoController.updateRTO
);

/**
 * @swagger
 * /api/v1/rtos/{id}/status:
 *   patch:
 *     summary: Update RTO status (Admin+)
 *     tags: [RTOs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RTO ID
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
 *               $ref: '#/components/schemas/RTO'
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
  requirePermission('RTO.UPDATE'),
  logAction('UPDATE_RTO_STATUS'),
  rtoController.updateRTOStatus
);

/**
 * @swagger
 * /api/v1/rtos/{id}:
 *   delete:
 *     summary: Delete RTO (SuperAdmin only)
 *     tags: [RTOs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RTO ID
 *     responses:
 *       200:
 *         description: RTO deleted
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
  requirePermission('RTO.DELETE'),
  logAction('DELETE_RTO'),
  rtoController.deleteRTO
);

module.exports = router;