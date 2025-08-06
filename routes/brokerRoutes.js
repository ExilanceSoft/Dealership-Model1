const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');
const { protect, authorize, roleAuthorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const path = require('path');

/**
 * @swagger
 * tags:
 *   name: Brokers
 *   description: Broker management endpoints with multi-branch support
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BrokerBranch:
 *       type: object
 *       required:
 *         - branch
 *         - addedBy
 *         - commissionType
 *       properties:
 *         branch:
 *           type: string
 *           format: objectId
 *           description: Reference to Branch document
 *           example: "507f1f77bcf86cd799439011"
 *         addedBy:
 *           type: string
 *           format: objectId
 *           description: User who added this branch association
 *           example: "507f1f77bcf86cd799439012"
 *         commissionType:
 *           type: string
 *           enum: [FIXED, VARIABLE]
 *           description: Type of commission structure
 *           example: "VARIABLE"
 *         fixedCommission:
 *           type: number
 *           minimum: 0
 *           description: Fixed commission amount (required for FIXED type)
 *           example: 1000
 *         commissionRange:
 *           type: string
 *           enum: [20k-40k, 40k-60k, 60k-80k, 80k-100k, 100k+]
 *           description: Predefined commission range (required for VARIABLE type)
 *           example: "40k-60k"
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the branch association is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when branch was added
 * 
 *     Broker:
 *       type: object
 *       required:
 *         - name
 *         - mobile
 *         - email
 *         - branches
 *       properties:
 *         id:
 *           type: string
 *           description: Auto-generated unique identifier
 *         brokerId:
 *           type: string
 *           description: Auto-generated broker ID (BRK0001 format)
 *           example: "BRK0001"
 *         name:
 *           type: string
 *           description: Full name of the broker
 *           example: "John Doe"
 *         mobile:
 *           type: string
 *           description: 10-digit mobile number
 *           example: "9876543210"
 *         email:
 *           type: string
 *           format: email
 *           description: Valid email address
 *           example: "john.doe@example.com"
 *         branches:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BrokerBranch'
 *           description: List of branch associations
 *         createdBy:
 *           type: string
 *           format: objectId
 *           description: User who created the broker
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when broker was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when broker was last updated
 * 
 *     BrokerInput:
 *       type: object
 *       required:
 *         - name
 *         - mobile
 *         - email
 *         - branchesData
 *       properties:
 *         name:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *           example: "John Doe"
 *         mobile:
 *           type: string
 *           pattern: '^[6-9]\d{9}$'
 *           example: "9876543210"
 *         email:
 *           type: string
 *           format: email
 *           example: "john.doe@example.com"
 *         branchesData:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - branch
 *               - commissionType
 *             properties:
 *               branch:
 *                 type: string
 *                 format: objectId
 *                 example: "507f1f77bcf86cd799439011"
 *               commissionType:
 *                 type: string
 *                 enum: [FIXED, VARIABLE]
 *                 example: "VARIABLE"
 *               fixedCommission:
 *                 type: number
 *                 minimum: 0
 *                 example: 1000
 *               commissionRange:
 *                 type: string
 *                 enum: [20k-40k, 40k-60k, 60k-80k, 80k-100k, 100k+]
 *                 example: "40k-60k"
 *               isActive:
 *                 type: boolean
 *                 default: true
 */

/**
 * @swagger
 * /api/v1/brokers:
 *   post:
 *     summary: Create new broker with multiple branches or add branches to existing broker
 *     description: |
 *       - Creates new broker with multiple branches if doesn't exist
 *       - Adds branches to existing broker if already exists
 *       - Requires Branch Manager+ privileges
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BrokerInput'
 *           examples:
 *             multipleBranchesExample:
 *               summary: Example with multiple branches
 *               value:
 *                 name: "John Doe"
 *                 mobile: "9876543210"
 *                 email: "john.doe@example.com"
 *                 branchesData: [
 *                   {
 *                     branch: "507f1f77bcf86cd799439011",
 *                     commissionType: "FIXED",
 *                     fixedCommission: 1000,
 *                     isActive: true
 *                   },
 *                   {
 *                     branch: "507f1f77bcf86cd799439012",
 *                     commissionType: "VARIABLE",
 *                     commissionRange: "40k-60k",
 *                     isActive: true
 *                   }
 *                 ]
 *     responses:
 *       201:
 *         description: Broker created or branches added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Broker'
 *       400:
 *         description: |
 *           Possible validation errors:
 *           - Branch reference is required
 *           - Invalid commission type configuration
 *           - Broker already associated with one or more branches
 *           - One or more branches not found
 *           - Invalid commission range
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  logAction('CREATE_OR_ADD_BROKER', 'Broker'),
  brokerController.createOrAddBroker
);

/**
 * @swagger
 * /api/v1/brokers/branch/{branchId}:
 *   get:
 *     summary: Get all brokers for a specific branch
 *     description: |
 *       - Returns all active brokers associated with the specified branch
 *       - Requires Branch Manager+ privileges
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: List of brokers for the branch
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
 *                     $ref: '#/components/schemas/Broker'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/branch/:branchId',
  protect,
  roleAuthorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  brokerController.getBrokersByBranch
);

/**
 * @swagger
 * /api/v1/brokers/{brokerId}:
 *   put:
 *     summary: Update basic broker details
 *     description: |
 *       - Updates broker name, mobile, or email
 *       - Requires Admin+ privileges
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID of the broker to update
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Name"
 *               mobile:
 *                 type: string
 *                 example: "9876543210"
 *               email:
 *                 type: string
 *                 example: "updated.email@example.com"
 *     responses:
 *       200:
 *         description: Broker details updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Broker'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:brokerId',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  logAction('UPDATE_BROKER', 'Broker'),
  brokerController.updateBroker
);

/**
 * @swagger
 * /api/v1/brokers/{brokerId}/branch/{branchId}:
 *   delete:
 *     summary: Remove broker from branch
 *     description: |
 *       - Removes branch association from broker
 *       - Requires Admin+ privileges
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         example: "507f1f77bcf86cd799439013"
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Broker removed from branch successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Broker'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Broker or branch not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:brokerId/branch/:branchId',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  logAction('REMOVE_BROKER_BRANCH', 'Broker'),
  brokerController.removeBrokerBranch
);

/**
 * @swagger
 * /api/v1/brokers:
 *   get:
 *     summary: Get all brokers
 *     description: |
 *       - Returns all brokers in the system
 *       - SUPERADMIN sees all brokers
 *       - Others see only brokers from their accessible branches
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Filter by branch ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of brokers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Broker'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  brokerController.getAllBrokers
);

/**
 * @swagger
 * /api/v1/brokers/{id}:
 *   get:
 *     summary: Get broker by ID
 *     description: Returns a single broker by ID
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID of the broker to retrieve
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Broker details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Broker'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  brokerController.getBrokerById
);

/**
 * @swagger
 * /api/v1/brokers/{id}:
 *   delete:
 *     summary: Delete a broker
 *     description: |
 *       - Permanently deletes a broker and all associations
 *       - Requires Admin+ privileges
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID of the broker to delete
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Broker deleted successfully
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
 *                   example: {}
 *       400:
 *         description: Invalid broker ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('DELETE_BROKER', 'Broker'),
  brokerController.deleteBroker
);

module.exports = router;