const express = require('express');
const router = express.Router();
const accessoryCategoryController = require('../controllers/accessoryCategoryController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: AccessoryCategories
 *   description: Accessory categories management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AccessoryCategory:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           example: Wheels
 *         description:
 *           type: string
 *           example: All types of wheels and rims
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
 * /api/v1/accessory-categories:
 *   post:
 *     summary: Create a new accessory category (Admin+)
 *     tags: [AccessoryCategories]
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
 *                 example: Wheels
 *               description:
 *                 type: string
 *                 example: All types of wheels and rims
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *     responses:
 *       201:
 *         description: Category created successfully
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
 *                     category:
 *                       $ref: '#/components/schemas/AccessoryCategory'
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
  authorize('ADMIN', 'SUPERADMIN', 'SALES_EXECUTIVE'),
  logAction('CREATE', 'AccessoryCategory'),
  accessoryCategoryController.createAccessoryCategory
);

/**
 * @swagger
 * /api/v1/accessory-categories:
 *   get:
 *     summary: Get all accessory categories
 *     tags: [AccessoryCategories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of categories
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AccessoryCategory'
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  accessoryCategoryController.getAllAccessoryCategories
);

/**
 * @swagger
 * /api/v1/accessory-categories/{id}:
 *   get:
 *     summary: Get an accessory category by ID
 *     tags: [AccessoryCategories]
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
 *         description: Category details
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
 *                     category:
 *                       $ref: '#/components/schemas/AccessoryCategory'
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  protect,
  accessoryCategoryController.getAccessoryCategoryById
);

/**
 * @swagger
 * /api/v1/accessory-categories/{id}:
 *   put:
 *     summary: Update an accessory category (Admin+)
 *     tags: [AccessoryCategories]
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
 *                 example: Updated Wheels
 *               description:
 *                 type: string
 *                 example: Updated description
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *     responses:
 *       200:
 *         description: Category updated successfully
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
 *                     category:
 *                       $ref: '#/components/schemas/AccessoryCategory'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN', 'SALES_EXECUTIVE'),
  logAction('UPDATE', 'AccessoryCategory'),
  accessoryCategoryController.updateAccessoryCategory
);

/**
 * @swagger
 * /api/v1/accessory-categories/{id}/status:
 *   put:
 *     summary: Update accessory category status (Admin+)
 *     tags: [AccessoryCategories]
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
 *                     category:
 *                       $ref: '#/components/schemas/AccessoryCategory'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id/status',
  protect,
  authorize('ADMIN', 'SUPERADMIN', 'SALES_EXECUTIVE'),
  logAction('UPDATE_STATUS', 'AccessoryCategory'),
  accessoryCategoryController.updateAccessoryCategoryStatus
);

/**
 * @swagger
 * /api/v1/accessory-categories/{id}:
 *   delete:
 *     summary: Delete an accessory category (SuperAdmin only)
 *     tags: [AccessoryCategories]
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
 *         description: Category deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'AccessoryCategory'),
  accessoryCategoryController.deleteAccessoryCategory
);

module.exports = router;