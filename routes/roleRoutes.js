// // // routes/roleRoutes.js
// // Clean router: ensure protect() so req.user exists, then hit controller.
// // (You can add requirePermission('ROLE.CREATE') back once that middleware is stable.)

// const express = require('express');
// const router = express.Router();

// const roleController = require('../controllers/roleController');
// const { protect } = require('../middlewares/auth');

// // List & read
// router.get('/',        protect, roleController.getAllRoles);
// router.get('/:id',     protect, roleController.getRoleById);

// // Create / Update / Delete
// router.post('/',       protect, roleController.createRole);
// router.put('/:id',     protect, roleController.updateRole);
// router.patch('/:id',   protect, roleController.updateRole);
// router.delete('/:id',  protect, roleController.deleteRole);

// module.exports = router;
// routes/roleRoutes.js

const express = require('express');
const router = express.Router();

const roleController = require('../controllers/roleController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role-based access control management
 */

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     summary: List roles
 *     description: Returns a list of roles. Optionally include inactive roles with query parameter.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include inactive roles
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', protect, roleController.getAllRoles);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   get:
 *     summary: Get a role by ID
 *     description: Fetch a single role by its ID with populated permissions.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, roleController.getRoleById);

/**
 * @swagger
 * /api/v1/roles:
 *   post:
 *     summary: Create a role
 *     description: Creates a new role with permissions. Requires authentication.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "ADMIN"
 *               description:
 *                 type: string
 *                 example: "Administrator role with all permissions"
 *               is_active:
 *                 type: boolean
 *                 default: true
 *               permissions:
 *                 type: array
 *                 items:
 *                   oneOf:
 *                     - type: string
 *                       description: Permission ID
 *                       example: "507f1f77bcf86cd799439011"
 *                     - type: string
 *                       description: Permission key in MODULE.ACTION format
 *                       example: "USER.CREATE"
 *     responses:
 *       201:
 *         description: Role created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: Validation error (missing name or invalid permissions)
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Role already exists
 *       500:
 *         description: Server error
 */
router.post('/', protect, roleController.createRole);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   put:
 *     summary: Update a role
 *     description: Updates an existing role's details and/or permissions.
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
 *                 example: "UPDATED_ROLE"
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               permissions:
 *                 type: array
 *                 items:
 *                   oneOf:
 *                     - type: string
 *                     - type: string
 *     responses:
 *       200:
 *         description: Role updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: Validation error (invalid ID or permissions)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.put('/:id', protect, roleController.updateRole);
router.patch('/:id', protect, roleController.updateRole);

/**
 * @swagger
 * /api/v1/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     description: Soft deletes a role by setting is_active to false.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid role ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Role not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, roleController.deleteRole);

/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Permission'
 *         is_active:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     Permission:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         module:
 *           type: string
 *         action:
 *           type: string
 *         is_active:
 *           type: boolean
 */

module.exports = router;