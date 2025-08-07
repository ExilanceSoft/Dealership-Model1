const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role management endpoints
 */

/**
 * @swagger
 * /api/v1/roles:
 *   post:
 *     summary: Create a new role (SuperAdmin only)
 *     tags: [Roles]
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
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 example: "MANAGER"
 *               description:
 *                 type: string
 *                 example: "Branch Manager"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: ObjectId
 *                   description: Array of Permission IDs
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *     responses:
 *       201:
 *         description: Role created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Role'
 *       400:
 *         description: Invalid input or permissions not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       409:
 *         description: Role already exists
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('CREATE', 'Role'), 
  roleController.createRole
);

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     summary: Get all roles (active by default)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive roles
 *     responses:
 *       200:
 *         description: List of roles
 */
router.get('/', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN'), 
  roleController.getRoles
);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
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
 *         description: Role details
 */
router.get('/:id', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN'), 
  roleController.getRole
);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   put:
 *     summary: Update a role (SuperAdmin only)
 *     tags: [Roles]
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
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "UPDATED_MANAGER"
 *               description:
 *                 type: string
 *                 example: "Updated Branch Manager"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["READ", "CREATE", "UPDATE"]
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Role updated
 */
router.put('/:id', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('UPDATE', 'Role'), 
  roleController.updateRole
);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   delete:
 *     summary: Delete a role (Soft delete by marking as inactive, SuperAdmin only)
 *     tags: [Roles]
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
 *         description: Role deactivated
 */
router.delete('/:id', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('DELETE', 'Role'), 
  roleController.deleteRole
);

/**
 * @swagger
 * /api/v1/roles/assign:
 *   post:
 *     summary: Assign role to user
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - roleId
 *             properties:
 *               userId:
 *                 type: string
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role assigned
 */
router.post('/assign', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN'), 
  logAction('ASSIGN', 'Role'), 
  roleController.assignRole
);

/**
 * @swagger
 * /api/v1/roles/assign-permissions:
 *   post:
 *     summary: Assign permissions to a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *               - permissionIds
 *             properties:
 *               roleId:
 *                 type: string
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Permissions assigned
 */
router.post('/assign-permissions', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('ASSIGN_PERMISSIONS', 'Role'), 
  roleController.assignPermissions
);

/**
 * @swagger
 * /api/v1/roles/inherit:
 *   post:
 *     summary: Make a role inherit from another role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *               - parentRoleId
 *             properties:
 *               roleId:
 *                 type: string
 *               parentRoleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role inheritance added
 */
router.post('/inherit', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('INHERIT_ROLE', 'Role'), 
  roleController.inheritRole
);

module.exports = router;