const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
// const userStatusMiddleware = require('../middleware/userStatusMiddleware');
const { requirePermission } = require('../middlewares/requirePermission');



/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the user
 *         name:
 *           type: string
 *           description: The user's full name
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address
 *         mobile:
 *           type: string
 *           description: The user's mobile number
 *         discount:
 *           type: number
 *           description: Discount amount for SALES_EXECUTIVE users
 *           example: 100
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of role IDs assigned to the user
 *         branch:
 *           type: string
 *           description: The branch ID the user belongs to
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
 *   name: Users
 *   description: User management API
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all users (Admin+)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  protect,
  requirePermission('USER.READ'),
  userController.getUsers
);


/**
 * @swagger
 * /api/v1/users/frozen-sales-executives:
 *   get:
 *     summary: Get all frozen SALES_EXECUTIVE users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of frozen sales executives
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not authorized)
 *       500:
 *         description: Internal server error
 */
router.get('/frozen-sales-executives', 
  protect, 
  requirePermission('USER.READ'),
  userController.getFrozenSalesExecutives
);
/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID (Admin+)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not Admin+ or trying to access user from another branch)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', 
  protect, 
  requirePermission('USER.READ'), 
  userController.getUser
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  protect,
  requirePermission('USER.UPDATE'),
  logAction('UPDATE', 'User'),
  userController.updateUser
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete user (SuperAdmin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "User deleted successfully"
 *       400:
 *         description: Bad request (trying to delete yourself)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', 
  protect, 
  requirePermission('USER.DELETE'), 
  logAction('DELETE', 'User'), 
  userController.deleteUser
);

/**
 * @swagger
 * /api/v1/users/{id}/permissions:
 *   get:
 *     summary: Get all permissions for a user (including role permissions)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "MANAGE_USERS"
 *                           module:
 *                             type: string
 *                             example: "USERS"
 *                           action:
 *                             type: string
 *                             example: "MANAGE"
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not Admin+ or trying to access user from another branch)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/permissions', 
  protect, 
  requirePermission('USER.READ'), 
  userController.getUserPermissions
);

/**
 * @swagger
 * /api/v1/users/assign-permissions:
 *   post:
 *     summary: Assign permissions directly to a user
 *     tags: [Users]
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
 *               - permissionIds
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user to assign permissions to
 *                 example: "60a1b2c3d4e5f6a7b8c9d0e1"
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of permission IDs to assign
 *                 example: ["60a1b2c3d4e5f6a7b8c9d0e2", "60a1b2c3d4e5f6a7b8c9d0e3"]
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date for the permissions
 *                 example: "2023-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Permissions assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User permissions assigned successfully"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request (missing fields or invalid permission IDs)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/assign-permissions', 
  protect, 
  requirePermission('USER.CREATE'), 
  logAction('ASSIGN_USER_PERMISSIONS', 'User'), 
  userController.assignUserPermissions
);

/**
 * @swagger
 * /api/v1/users/delegate-permissions:
 *   post:
 *     summary: Delegate your permissions to another user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - permissionIds
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: The ID of the user to delegate permissions to
 *                 example: "60a1b2c3d4e5f6a7b8c9d0e1"
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of permission IDs to delegate
 *                 example: ["60a1b2c3d4e5f6a7b8c9d0e2", "60a1b2c3d4e5f6a7b8c9d0e3"]
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date for the delegation
 *                 example: "2023-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Permissions delegated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Permissions delegated successfully"
 *       400:
 *         description: Bad request (missing fields, invalid permission IDs, or trying to delegate permissions you don't have)
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       404:
 *         description: Target user not found
 *       500:
 *         description: Internal server error
 */
router.post('/delegate-permissions', 
  protect, 
  logAction('DELEGATE_PERMISSIONS', 'User'), 
  userController.delegatePermissions
);

/**
 * @swagger
 * /api/v1/users/{userId}/extend-buffer:
 *   post:
 *     summary: Extend document submission buffer time for a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to extend buffer for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hours
 *               - reason
 *             properties:
 *               hours:
 *                 type: number
 *                 description: Number of hours to extend the buffer
 *               reason:
 *                 type: string
 *                 description: Reason for the extension
 *     responses:
 *       200:
 *         description: Buffer time extended successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/:userId/extend-buffer', 
  protect, 
  requirePermission('USER.UPDATE'),
  userController.extendBufferTime
);

/**
 * @swagger
 * /api/v1/users/{userId}/buffer-history:
 *   get:
 *     summary: Get buffer time extension history for a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to get history for
 *     responses:
 *       200:
 *         description: Buffer history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (no permission)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:userId/buffer-history', 
  protect, 
  requirePermission('USER.READ'), 
  userController.getBufferHistory
);

// ... (previous code remains the same)

/**
 * @swagger
 * /api/v1/users/{id}/extend-deadline:
 *   post:
 *     summary: Extend document submission deadline for a SALES_EXECUTIVE (Manager+)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the SALES_EXECUTIVE user to extend deadline for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - additionalHours
 *             properties:
 *               additionalHours:
 *                 type: number
 *                 description: Number of hours to extend the deadline
 *                 example: 24
 *               reason:
 *                 type: string
 *                 description: Reason for the extension
 *                 example: "Additional time needed for document collection"
 *     responses:
 *       200:
 *         description: Deadline extended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input or not a SALES_EXECUTIVE user
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not Manager+)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:id/extend-deadline',
  protect,
  requirePermission('USER.UPDATE'),
  logAction('EXTEND_DEADLINE', 'User'),
  userController.extendDocumentDeadline
);

/**
 * @swagger
 * /api/v1/users/{id}/unfreeze:
 *   post:
 *     summary: Unfreeze a frozen SALES_EXECUTIVE user (Manager+)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the frozen user to unfreeze
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for unfreezing
 *                 example: "Documents have been submitted"
 *     responses:
 *       200:
 *         description: User unfrozen successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (not Manager+)
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:id/unfreeze',
  protect,
  requirePermission('USER.UPDATE'),
  logAction('UNFREEZE_USER', 'User'),
  userController.unfreezeUser
);

module.exports = router;

module.exports = router;