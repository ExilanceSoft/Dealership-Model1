const express = require('express');
const router = express.Router();
const subdealerController = require('../controllers/subdealerController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Subdealers
 *   description: Subdealer management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Subdealer:
 *       type: object
 *       required:
 *         - name
 *         - location
 *         - rateOfInterest
 *         - type
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the subdealer
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: The subdealer name
 *           example: ABC Distributors
 *         location:
 *           type: string
 *           description: The subdealer location
 *           example: Mumbai, India
 *         rateOfInterest:
 *           type: number
 *           description: The rate of interest
 *           example: 5.5
 *         type:
 *           type: string
 *           enum: [B2B, B2C]
 *           description: The type of subdealer
 *           example: B2B
 *         discount:
 *           type: number
 *           description: Discount percentage (0-100)
 *           example: 10
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Subdealer status
 *           example: active
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the subdealer
 *           example: 507f1f77bcf86cd799439012
 *         createdByDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the subdealer was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the subdealer was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 *     SubdealerInput:
 *       type: object
 *       required:
 *         - name
 *         - location
 *         - rateOfInterest
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           example: ABC Distributors
 *         location:
 *           type: string
 *           example: Mumbai, India
 *         rateOfInterest:
 *           type: number
 *           example: 5.5
 *         type:
 *           type: string
 *           enum: [B2B, B2C]
 *           example: B2B
 *         discount:
 *           type: number
 *           example: 10
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           example: active
 *     SubdealerStatusInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           example: active
 */

/**
 * @swagger
 * /api/v1/subdealers:
 *   post:
 *     summary: Create a new subdealer (Admin+)
 *     tags: [Subdealers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubdealerInput'
 *     responses:
 *       201:
 *         description: Subdealer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subdealer'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('SUBDEALER.CREATE'),
  logAction('CREATE', 'Subdealer'),
  subdealerController.createSubdealer
);

/**
 * @swagger
 * /api/v1/subdealers:
 *   get:
 *     summary: Get all subdealers (Admin+)
 *     tags: [Subdealers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [B2B, B2C]
 *         description: Filter subdealers by type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter subdealers by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search subdealers by name
 *     responses:
 *       200:
 *         description: List of subdealers
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
 *                   type: object
 *                   properties:
 *                     subdealers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Subdealer'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  requirePermission('SUBDEALER.READ'),
  subdealerController.getAllSubdealers
);

/**
 * @swagger
 * /api/v1/subdealers/{id}:
 *   get:
 *     summary: Get a specific subdealer by ID (Admin+)
 *     tags: [Subdealers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer to get
 *     responses:
 *       200:
 *         description: Subdealer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subdealer'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  requirePermission('SUBDEALER.READ'),
  subdealerController.getSubdealerById
);

/**
 * @swagger
 * /api/v1/subdealers/{id}:
 *   put:
 *     summary: Update a subdealer (Admin+)
 *     tags: [Subdealers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubdealerInput'
 *     responses:
 *       200:
 *         description: Subdealer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subdealer'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  requirePermission('SUBDEALER.UPDATE'),
  logAction('UPDATE', 'Subdealer'),
  subdealerController.updateSubdealer
);

/**
 * @swagger
 * /api/v1/subdealers/{id}/status:
 *   patch:
 *     summary: Update subdealer status (Admin+)
 *     tags: [Subdealers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer to update status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubdealerStatusInput'
 *     responses:
 *       200:
 *         description: Subdealer status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subdealer'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status',
  protect,
  requirePermission('SUBDEALER.UPDATE'),
  logAction('UPDATE_STATUS', 'Subdealer'),
  subdealerController.updateSubdealerStatus
);

/**
 * @swagger
 * /api/v1/subdealers/{id}:
 *   delete:
 *     summary: Delete a subdealer (SuperAdmin only)
 *     tags: [Subdealers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer to delete
 *     responses:
 *       204:
 *         description: Subdealer deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  requirePermission('SUBDEALER.DELETE'),
  logAction('DELETE', 'Subdealer'),
  subdealerController.deleteSubdealer
);

module.exports = router;