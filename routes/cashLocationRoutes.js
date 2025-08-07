const express = require('express');
const router = express.Router();
const cashLocationController = require('../controllers/cashLocationController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: CashLocations
 *   description: Cash location management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CashLocation:
 *       type: object
 *       required:
 *         - name
 *         - branch
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the cash location
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: The cash location name
 *           example: Main Vault
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Cash location status
 *           example: active
 *         description:
 *           type: string
 *           description: Additional details about the cash location
 *           example: Primary cash storage for the branch
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the cash location
 *           example: 507f1f77bcf86cd799439012
 *         branch:
 *           type: string
 *           description: ID of the branch this cash location belongs to
 *           example: 507f1f77bcf86cd799439013
 *         branchDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             id:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the cash location was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the cash location was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 *     CashLocationInput:
 *       type: object
 *       required:
 *         - name
 *         - branch
 *       properties:
 *         name:
 *           type: string
 *           description: The cash location name
 *           example: Main Vault
 *         branch:
 *           type: string
 *           description: The branch ID
 *           example: 507f1f77bcf86cd799439013
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Cash location status
 *           example: active
 *         description:
 *           type: string
 *           description: Additional details about the cash location
 *           example: Primary cash storage for the branch
 *     CashLocationStatusInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Cash location status
 *           example: active
 */

/**
 * @swagger
 * /api/v1/cash-locations:
 *   post:
 *     summary: Create a new cash location (Admin+)
 *     tags: [CashLocations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CashLocationInput'
 *     responses:
 *       201:
 *         description: Cash location created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashLocation'
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
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('CREATE', 'CashLocation'),
  cashLocationController.createCashLocation
);

/**
 * @swagger
 * /api/v1/cash-locations:
 *   get:
 *     summary: Get all cash locations (Admin+)
 *     tags: [CashLocations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter cash locations by branch ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter cash locations by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search cash locations by name
 *     responses:
 *       200:
 *         description: List of cash locations
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
 *                     cashLocations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CashLocation'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
  cashLocationController.getAllCashLocations
);

/**
 * @swagger
 * /api/v1/cash-locations/{id}:
 *   get:
 *     summary: Get a specific cash location by ID (Admin+)
 *     tags: [CashLocations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cash location to get
 *     responses:
 *       200:
 *         description: Cash location details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashLocation'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Cash location not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
  cashLocationController.getCashLocationById
);

/**
 * @swagger
 * /api/v1/cash-locations/{id}:
 *   put:
 *     summary: Update a cash location (Admin+)
 *     tags: [CashLocations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cash location to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CashLocationInput'
 *     responses:
 *       200:
 *         description: Cash location updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashLocation'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Cash location not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'CashLocation'),
  cashLocationController.updateCashLocation
);

/**
 * @swagger
 * /api/v1/cash-locations/{id}/status:
 *   patch:
 *     summary: Update cash location status (Admin+)
 *     tags: [CashLocations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cash location to update status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CashLocationStatusInput'
 *     responses:
 *       200:
 *         description: Cash location status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CashLocation'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Cash location not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE_STATUS', 'CashLocation'),
  cashLocationController.updateCashLocationStatus
);

/**
 * @swagger
 * /api/v1/cash-locations/{id}:
 *   delete:
 *     summary: Delete a cash location (SuperAdmin only)
 *     tags: [CashLocations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the cash location to delete
 *     responses:
 *       204:
 *         description: Cash location deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Cash location not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'CashLocation'),
  cashLocationController.deleteCashLocation
);

module.exports = router;