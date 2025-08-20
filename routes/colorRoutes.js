const express = require('express');
const router = express.Router();
const colorController = require('../controllers/colorController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

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
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           example: Midnight Black
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *         models:
 *           type: array
 *           items:
 *             type: string
 *             description: Array of model IDs
 *         createdAt:
 *           type: string
 *           format: date-time
 * 
 *     ColorInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Midnight Black
 *         models:
 *           type: array
 *           items:
 *             type: string
 *           description: Optional array of model IDs to assign this color to
 * 
 *     ColorUpdate:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: Midnight Black Updated
 *         models:
 *           type: array
 *           items:
 *             type: string
 *           example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 * 
 *     ModelAssignment:
 *       type: object
 *       required:
 *         - modelIds
 *       properties:
 *         modelIds:
 *           type: array
 *           items:
 *             type: string
 *           example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 * 
 *     StatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           example: inactive
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
 *             $ref: '#/components/schemas/ColorInput'
 *     responses:
 *       201:
 *         description: Color created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     color:
 *                       $ref: '#/components/schemas/Color'
 *       400:
 *         description: Validation error or duplicate color name
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
  requirePermission('COLOR.CREATE'),
  logAction('CREATE', 'Color'),
  colorController.createColor
);

/**
 * @swagger
 * /api/v1/colors:
 *   get:
 *     summary: Get all colors
 *     tags: [Colors]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *       - in: query
 *         name: populate
 *         schema:
 *           type: string
 *           enum: [models]
 *         description: Populate models information
 *     responses:
 *       200:
 *         description: List of colors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     colors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Color'
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  requirePermission('COLOR.READ'),
   colorController.getAllColors);

/**
 * @swagger
 * /api/v1/colors/{colorId}:
 *   get:
 *     summary: Get a color by ID
 *     tags: [Colors]
 *     parameters:
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Color details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     color:
 *                       $ref: '#/components/schemas/Color'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.get('/:colorId',
  protect,
  requirePermission('COLOR.READ'),
   colorController.getColorById);

/**
 * @swagger
 * /api/v1/colors/{colorId}:
 *   put:
 *     summary: Update a color (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ColorUpdate'
 *     responses:
 *       200:
 *         description: Color updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     color:
 *                       $ref: '#/components/schemas/Color'
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
  '/:colorId',
  protect,
  requirePermission('COLOR.UPDATE'),
  logAction('UPDATE', 'Color'),
  colorController.updateColor
);

/**
 * @swagger
 * /api/v1/colors/{colorId}:
 *   delete:
 *     summary: Delete a color (SuperAdmin only)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       204:
 *         description: Color deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:colorId',
  protect,
  requirePermission('COLOR.DELETE'),
  logAction('DELETE', 'Color'),
  colorController.deleteColor
);

/**
 * @swagger
 * /api/v1/colors/{colorId}/assign:
 *   post:
 *     summary: Assign color to models (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModelAssignment'
 *     responses:
 *       200:
 *         description: Color assigned to models successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     color:
 *                       $ref: '#/components/schemas/Color'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color or model not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:colorId/assign',
  protect,
  requirePermission('COLOR.ASSIGN'),
  logAction('ASSIGN_COLOR', 'Model'),
  colorController.assignColorToModels
);

/**
 * @swagger
 * /api/v1/colors/{colorId}/unassign:
 *   post:
 *     summary: Unassign color from models (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModelAssignment'
 *     responses:
 *       200:
 *         description: Color unassigned from models successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     color:
 *                       $ref: '#/components/schemas/Color'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color or model not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:colorId/unassign',
  protect,
  requirePermission('COLOR.CREATE'),
  logAction('UNASSIGN_COLOR', 'Model'),
  colorController.unassignColorFromModels
);

/**
 * @swagger
 * /api/v1/colors/{colorId}/status:
 *   put:
 *     summary: Update color status (Admin+)
 *     tags: [Colors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusUpdate'
 *     responses:
 *       200:
 *         description: Color status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     color:
 *                       $ref: '#/components/schemas/Color'
 *       400:
 *         description: Invalid input
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
  '/:colorId/status',
  protect,
  requirePermission('COLOR.UPDATE'),
  logAction('UPDATE_STATUS', 'Color'),
  colorController.updateColorStatus
);

/**
 * @swagger
 * /api/v1/colors/{colorId}/models:
 *   get:
 *     summary: Get models for a specific color
 *     tags: [Colors]
 *     parameters:
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: List of models for the color
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     models:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Model'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.get('/:colorId/models',
  protect,
  requirePermission('COLOR.READ'),
  colorController.getColorModels);

/**
 * @swagger
 * /api/v1/colors/model/{modelId}:
 *   get:
 *     summary: Get colors by model ID
 *     tags: [Colors]
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: List of colors for the model
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     colors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Color'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/model/:modelId',
  colorController.getColorsByModelId);

module.exports = router;