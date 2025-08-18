const express = require('express');
const router = express.Router();
const accessoryController = require('../controllers/accessoryController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Accessories
 *   description: Vehicle accessories management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Accessory:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - applicable_models
 *         - part_number
 *         - category
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           example: Alloy Wheels
 *         description:
 *           type: string
 *           example: Premium alloy wheels
 *         price:
 *           type: number
 *           example: 500
 *         category:
 *           type: string
 *           example: 507f1f77bcf86cd799439014
 *         applicable_models:
 *           type: array
 *           items:
 *             type: string
 *             example: 507f1f77bcf86cd799439012
 *         part_number:
 *           type: string
 *           example: "90"
 *         part_number_status:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         createdBy:
 *           type: string
 *           example: 507f1f77bcf86cd799439013
 */

/**
 * @swagger
 * /api/v1/accessories:
 *   post:
 *     summary: Create a new accessory (Admin+)
 *     tags: [Accessories]
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
 *               - price
 *               - applicable_models
 *               - part_number
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alloy Wheels
 *               description:
 *                 type: string
 *                 example: Premium alloy wheels
 *               price:
 *                 type: number
 *                 example: 500
 *               category:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439014
 *               applicable_models:
 *                 type: array
 *                 items:
 *                   type: string
 *                   example: 507f1f77bcf86cd799439012
 *               part_number:
 *                 type: string
 *                 example: "90"
 *               part_number_status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *     responses:
 *       201:
 *         description: Accessory created successfully
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
 *                     accessory:
 *                       $ref: '#/components/schemas/Accessory'
 *       400:
 *         description: Validation error
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
  requirePermission('ACCESSORY.CREATE'),
  logAction('CREATE', 'Accessory'),
  accessoryController.createAccessory
);

/**
 * @swagger
 * /api/v1/accessories:
 *   get:
 *     summary: Get all accessories
 *     tags: [Accessories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *       - in: query
 *         name: part_number_status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by part number status
 *       - in: query
 *         name: model_id
 *         schema:
 *           type: string
 *         description: Filter by applicable model ID
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: min_price
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: max_price
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *     responses:
 *       200:
 *         description: List of accessories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Accessory'
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  requirePermission('ACCESSORY.READ'),
  accessoryController.getAllAccessories
);

/**
 * @swagger
 * /api/v1/accessories/{id}:
 *   get:
 *     summary: Get an accessory by ID
 *     tags: [Accessories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Accessory details
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
 *                     accessory:
 *                       $ref: '#/components/schemas/Accessory'
 *       404:
 *         description: Accessory not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  protect,
  requirePermission('ACCESSORY.READ'),
  accessoryController.getAccessoryById
);

/**
 * @swagger
 * /api/v1/accessories/{id}:
 *   put:
 *     summary: Update an accessory (Admin+)
 *     tags: [Accessories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Alloy Wheels
 *               description:
 *                 type: string
 *                 example: Updated premium alloy wheels
 *               price:
 *                 type: number
 *                 example: 550
 *               category:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439014
 *               applicable_models:
 *                 type: array
 *                 items:
 *                   type: string
 *                   example: 507f1f77bcf86cd799439012
 *               part_number:
 *                 type: string
 *                 example: "95"
 *               part_number_status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *     responses:
 *       200:
 *         description: Accessory updated successfully
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
 *                     accessory:
 *                       $ref: '#/components/schemas/Accessory'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Accessory not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  protect,
  requirePermission('ACCESSORY.UPDATE'),
  logAction('UPDATE', 'Accessory'),
  accessoryController.updateAccessory
);

/**
 * @swagger
 * /api/v1/accessories/{id}/status:
 *   put:
 *     summary: Update accessory status (Admin+)
 *     tags: [Accessories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: inactive
 *     responses:
 *       200:
 *         description: Status updated successfully
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
 *                     accessory:
 *                       $ref: '#/components/schemas/Accessory'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Accessory not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id/status',
  protect,
  requirePermission('ACCESSORY.UPDATE'),
  logAction('UPDATE_STATUS', 'Accessory'),
  accessoryController.updateAccessoryStatus
);

/**
 * @swagger
 * /api/v1/accessories/{id}/part-number-status:
 *   put:
 *     summary: Update accessory part number status (Admin+)
 *     tags: [Accessories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - part_number_status
 *             properties:
 *               part_number_status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: inactive
 *     responses:
 *       200:
 *         description: Part number status updated successfully
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
 *                     accessory:
 *                       $ref: '#/components/schemas/Accessory'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Accessory not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id/part-number-status',
  protect,
  requirePermission('ACCESSORY.UPDATE'),
  logAction('UPDATE_PART_NUMBER_STATUS', 'Accessory'),
  accessoryController.updatePartNumberStatus
);

/**
 * @swagger
 * /api/v1/accessories/{id}:
 *   delete:
 *     summary: Delete an accessory (SuperAdmin only)
 *     tags: [Accessories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       204:
 *         description: Accessory deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Accessory not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  protect,
  requirePermission('ACCESSORY.DELETE'),
  logAction('DELETE', 'Accessory'),
  accessoryController.deleteAccessory
);

/**
 * @swagger
 * /api/v1/accessories/model/{modelId}:
 *   get:
 *     summary: Get accessories by model
 *     tags: [Accessories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439012
 *     responses:
 *       200:
 *         description: List of accessories for the model
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Accessory'
 *       400:
 *         description: Invalid model ID
 *       500:
 *         description: Server error
 */
router.get(
  '/model/:modelId',
  protect,
  requirePermission('ACCESSORY.READ'),
  accessoryController.getAccessoriesByModel
);

module.exports = router;