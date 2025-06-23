// routes/colorRoutes.js
const express = require('express');
const router = express.Router();
const colorController = require('../controllers/colorController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Colors
 *   description: Color management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Color:
 *       type: object
 *       required:
 *         - name
 *         - hexCode
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the color
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: The color name
 *           example: Midnight Black
 *         hexCode:
 *           type: string
 *           description: The hex color code
 *           example: "#000000"
 *         models:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of model IDs this color is available for
 *         isActive:
 *           type: boolean
 *           description: Whether the color is active
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the color was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the color was last updated
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the color
 */

/**
 * @swagger
 * /api/v1/colors:
 *   post:
 *     summary: Create a new color (Admin+)
 *     tags: [Colors]
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
 *               - hexCode
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Midnight Black"
 *               hexCode:
 *                 type: string
 *                 example: "#000000"
 *               models:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of model IDs this color is available for
 *                 example: ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
 *     responses:
 *       201:
 *         description: Color created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('CREATE', 'Color'),
  colorController.createColor
);

/**
 * @swagger
 * /api/v1/colors:
 *   get:
 *     summary: Get all colors
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (true/false)
 *     responses:
 *       200:
 *         description: List of colors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Color'
 *       500:
 *         description: Server error
 */
router.get('/', protect, colorController.getColors);

/**
 * @swagger
 * /api/v1/colors/{id}:
 *   get:
 *     summary: Get color by ID
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID
 *     responses:
 *       200:
 *         description: Color details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, colorController.getColor);

/**
 * @swagger
 * /api/v1/colors/{id}:
 *   put:
 *     summary: Update color (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Black"
 *               hexCode:
 *                 type: string
 *                 example: "#111111"
 *               models:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of model IDs this color is available for
 *     responses:
 *       200:
 *         description: Color updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('UPDATE', 'Color'),
  colorController.updateColor
);

/**
 * @swagger
 * /api/v1/colors/{id}:
 *   delete:
 *     summary: Delete color (soft delete, Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID
 *     responses:
 *       200:
 *         description: Color deactivated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('DELETE', 'Color'),
  colorController.deleteColor
);

/**
 * @swagger
 * /api/v1/colors/{id}/assign:
 *   post:
 *     summary: Assign color to models (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - modelIds
 *             properties:
 *               modelIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of model IDs to assign this color to
 *     responses:
 *       200:
 *         description: Color assigned to models
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color or models not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:id/assign',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('ASSIGN', 'Color'),
  colorController.assignColorToModels
);

/**
 * @swagger
 * /api/v1/colors/{id}/remove:
 *   post:
 *     summary: Remove color from models (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - modelIds
 *             properties:
 *               modelIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of model IDs to remove this color from
 *     responses:
 *       200:
 *         description: Color removed from models
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color or models not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:id/remove',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('REMOVE', 'Color'),
  colorController.removeColorFromModels
);

/**
 * @swagger
 * /api/v1/colors/model/{modelId}:
 *   get:
 *     summary: Get colors available for a specific model
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Model ID
 *     responses:
 *       200:
 *         description: List of colors available for the model
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Color'
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/model/:modelId', protect, colorController.getColorsByModel);

/**
 * @swagger
 * /api/v1/colors/{id}/status:
 *   patch:
 *     summary: Toggle color active status (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID
 *     responses:
 *       200:
 *         description: Color status toggled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/status',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('TOGGLE_STATUS', 'Color'),
  colorController.toggleColorStatus
);

module.exports = router;