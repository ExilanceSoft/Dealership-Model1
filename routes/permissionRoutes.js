// routes/permissionRoutes.js
const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { protect } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Permission management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       required:
 *         - name
 *         - module
 *         - action
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *           example: "60d21b4667d0d8992e610c85"
 *         name:
 *           type: string
 *           description: "Unique permission name (format: MODULE_ACTION)"
 *           example: "BANK_READ"
 *         description:
 *           type: string
 *           description: "Description of what the permission allows"
 *           example: "Allows reading bank information"
 *         module:
 *           type: string
 *           description: "The module this permission applies to"
 *           example: "BANK"
 *         action:
 *           type: string
 *           description: "The action this permission allows"
 *           enum: ["CREATE", "READ", "UPDATE", "DELETE", "MANAGE", "APPROVE", "ALL"]
 *           example: "READ"
 *         category:
 *           type: string
 *           description: "Category for grouping permissions"
 *           example: "FINANCE"
 *         is_active:
 *           type: boolean
 *           description: "Whether the permission is active"
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Creation timestamp"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: "Last update timestamp"
 */
/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: List all active permissions
 *     description: Returns a list of active permissions. Public endpoint for frontend permission matrix.
 *     tags: [Permissions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 200
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *           description: Filter by module name
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search in name, description or module
 *     responses:
 *       200:
 *         description: List of permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Permission'
 *       500:
 *         description: Server error
 */
router.get('/', permissionController.getPermissions);

/**
 * @swagger
 * /api/v1/permissions/{id}:
 *   get:
 *     summary: Get a permission by ID
 *     description: Fetch a single permission by its ID. Requires PERMISSION.READ permission.
 *     tags: [Permissions]
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
 *         description: Permission details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Permission'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  protect,
  requirePermission('PERMISSION.READ'),
  permissionController.getPermissionById
);

module.exports = router;