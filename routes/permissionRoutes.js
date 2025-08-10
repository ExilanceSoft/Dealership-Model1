const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

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
 *           description: The auto-generated ID of the permission
 *         name:
 *           type: string
 *           description: Unique name of the permission (uppercase)
 *         description:
 *           type: string
 *           description: Description of what the permission allows
 *         module:
 *           type: string
 *           description: The module this permission applies to
 *         action:
 *           type: string
 *           enum: [CREATE, READ, UPDATE, DELETE, MANAGE, ALL]
 *           description: The action allowed by this permission
 *         is_active:
 *           type: boolean
 *           default: true
 *           description: Whether the permission is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *       example:
 *         id: 5f8d04b3ab35de3a3427d9f3
 *         name: MANAGE_USERS
 *         description: Allows full management of user accounts
 *         module: USERS
 *         action: MANAGE
 *         is_active: true
 *         createdAt: 2020-10-20T14:56:51.778Z
 *         updatedAt: 2020-10-20T14:56:51.778Z
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: The permissions management API
 */

/**
 * @swagger
 * /api/v1/permissions:
 *   post:
 *     summary: Create a new permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Permission'
 *           example:
 *             name: VIEW_REPORTS
 *             description: Allows viewing all reports
 *             module: REPORTS
 *             action: READ
 *     responses:
 *       201:
 *         description: The permission was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Permission'
 *       400:
 *         description: Missing required fields or invalid data
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       409:
 *         description: Permission with this name already exists
 *       500:
 *         description: Internal server error
 */
router.post('/', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('CREATE', 'Permission'), 
  permissionController.createPermission
);

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: Returns the list of all permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive permissions (default false)
 *     responses:
 *       200:
 *         description: The list of permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Permission'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not SuperAdmin or Admin)
 *       500:
 *         description: Internal server error
 */
// router.get('/', 
//   protect, 
//   authorize('SUPERADMIN', 'ADMIN'), 
//   permissionController.getPermissions
// );
router.get('/', permissionController.getPermissions);

/**
 * @swagger
 * /api/v1/permissions/{id}:
 *   put:
 *     summary: Update a permission by ID
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The permission ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Permission'
 *           example:
 *             description: Updated description for this permission
 *             is_active: false
 *     responses:
 *       200:
 *         description: The permission was updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Permission'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('UPDATE', 'Permission'), 
  permissionController.updatePermission
);

/**
 * @swagger
 * /api/v1/permissions/{id}:
 *   delete:
 *     summary: Delete a permission by ID (soft delete)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The permission ID
 *     responses:
 *       200:
 *         description: The permission was deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *               example:
 *                 success: true
 *                 message: Permission deactivated successfully
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('DELETE', 'Permission'), 
  permissionController.deletePermission
);

module.exports = router;