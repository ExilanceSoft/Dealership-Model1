const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Brokers
 *   description: Broker management with multi-branch support
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
 *           description: Reference to Branch
 *         addedBy:
 *           type: string
 *           description: User who added this branch association
 *         commissionType:
 *           type: string
 *           enum: [FIXED, VARIABLE]
 *         fixedCommission:
 *           type: number
 *           minimum: 0
 *         minCommission:
 *           type: number
 *           minimum: 0
 *         maxCommission:
 *           type: number
 *           minimum: 0
 *         isActive:
 *           type: boolean
 *           default: true
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
 *         brokerId:
 *           type: string
 *         name:
 *           type: string
 *         mobile:
 *           type: string
 *         email:
 *           type: string
 *         branches:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BrokerBranch'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     BrokerInput:
 *       type: object
 *       required:
 *         - name
 *         - mobile
 *         - email
 *         - branchData
 *       properties:
 *         name:
 *           type: string
 *         mobile:
 *           type: string
 *         email:
 *           type: string
 *         branchData:
 *           type: object
 *           required:
 *             - branch
 *             - commissionType
 *           properties:
 *             branch:
 *               type: string
 *             commissionType:
 *               type: string
 *               enum: [FIXED, VARIABLE]
 *             fixedCommission:
 *               type: number
 *             minCommission:
 *               type: number
 *             maxCommission:
 *               type: number
 *             isActive:
 *               type: boolean
 */

/**
 * @swagger
 * /api/v1/brokers:
 *   post:
 *     summary: Create new broker or add branch to existing broker (Branch Manager+)
 *     tags: [Brokers]
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
 *               - mobile
 *               - email
 *               - branchData
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               mobile:
 *                 type: string
 *                 example: "9876543210"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               branchData:
 *                 type: object
 *                 required:
 *                   - branch
 *                   - commissionType
 *                 properties:
 *                   branch:
 *                     type: string
 *                     example: "5f8d8f9c8f9c8f9c8f9c8f9c"
 *                   commissionType:
 *                     type: string
 *                     enum: [FIXED, VARIABLE]
 *                     example: "FIXED"
 *                   fixedCommission:
 *                     type: number
 *                     example: 1000
 *                     description: Required if commissionType is FIXED
 *                   minCommission:
 *                     type: number
 *                     example: 500
 *                     description: Required if commissionType is VARIABLE
 *                   maxCommission:
 *                     type: number
 *                     example: 1500
 *                     description: Required if commissionType is VARIABLE
 *                   isActive:
 *                     type: boolean
 *                     default: true
 *     responses:
 *       201:
 *         description: Broker created or branch added successfully
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
 *           - Broker already associated with this branch
 *           - Branch not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Branch Manager+)
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER','SALES_EXECUTIVE'),
  logAction('CREATE_OR_ADD_BROKER', 'Broker'),
  brokerController.createOrAddBroker
);

/**
 * @swagger
 * /api/v1/brokers/branch/{branchId}:
 *   get:
 *     summary: Get all brokers for a specific branch (Branch Manager+)
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of brokers for the branch
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Branch Manager+)
 *       500:
 *         description: Server error
 */
router.get(
  '/branch/:branchId',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER','SALES_EXECUTIVE'),
  brokerController.getBrokersByBranch
);
/**
 * @swagger
 * /api/v1/brokers/{brokerId}:
 *   put:
 *     summary: Update basic broker details (Admin+)
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the broker to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "neha"
 *               mobile:
 *                 type: string
 *                 example: "7989908767"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "nehaokk12@gmail.com"
 *               branches:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     branch:
 *                       type: string
 *                       example: "684d348c05326d3a467e431e"
 *                     commissionType:
 *                       type: string
 *                       enum: [FIXED, VARIABLE]
 *                       example: "VARIABLE"
 *                     fixedCommission:
 *                       type: number
 *                       example: 0
 *                     minCommission:
 *                       type: number
 *                       example: 900
 *                     maxCommission:
 *                       type: number
 *                       example: 1000
 *                     isActive:
 *                       type: boolean
 *                       example: true
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
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "684d4b805b62898835fdceb2"
 *                     name:
 *                       type: string
 *                       example: "neha"
 *                     mobile:
 *                       type: string
 *                       example: "7989908767"
 *                     email:
 *                       type: string
 *                       example: "nehaokk12@gmail.com"
 *                     brokerId:
 *                       type: string
 *                       example: "BRK0003"
 *                     branches:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           branch:
 *                             type: string
 *                             example: "684d348c05326d3a467e431e"
 *                           addedBy:
 *                             type: string
 *                             example: "68495ef550af1ed0494b8db2"
 *                           commissionType:
 *                             type: string
 *                             enum: [FIXED, VARIABLE]
 *                             example: "VARIABLE"
 *                           fixedCommission:
 *                             type: number
 *                             example: 0
 *                           minCommission:
 *                             type: number
 *                             example: 900
 *                           maxCommission:
 *                             type: number
 *                             example: 1000
 *                           isActive:
 *                             type: boolean
 *                             example: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-06-14T10:14:24.166Z"
 *                     createdBy:
 *                       type: string
 *                       example: "68495ef550af1ed0494b8db2"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-06-14T10:14:24.175Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-06-14T10:14:24.175Z"
 *                     __v:
 *                       type: number
 *                       example: 0
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Server error
 */

router.put(
  '/:brokerId',
  protect,
  authorize('SUPERADMIN', 'ADMIN','MANAGER','SALES_EXECUTIVE'),
  logAction('UPDATE_BROKER', 'Broker'),  // Ensure this matches your enum
  brokerController.updateBroker
);
/**
 * @swagger
 * /api/v1/brokers/{brokerId}/branch/{branchId}:
 *   delete:
 *     summary: Remove broker from branch (Admin+)
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brokerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Broker removed from branch
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Broker-branch association not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:brokerId/branch/:branchId',
  protect,
  authorize('SUPERADMIN', 'ADMIN','MANAGER','SALES_EXECUTIVE'),
  logAction('REMOVE_BROKER_BRANCH', 'Broker'),
  brokerController.removeBrokerBranch
);

/**
 * @swagger
 * /api/v1/brokers:
 *   get:
 *     summary: Get all brokers (SUPERADMIN sees all, others see only their branches)
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter by branch ID (must be accessible to user)
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
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Broker'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not authorized to access requested branch)
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER','SALES_EXECUTIVE'), // Optional but recommended
  brokerController.getAllBrokers
);

/**
 * @swagger
 * /api/v1/brokers/{id}:
 *   get:
 *     summary: Get a single broker by ID
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the broker to retrieve
 *     responses:
 *       200:
 *         description: Broker details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Broker'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER', 'SALES_EXECUTIVE'),
  brokerController.getBrokerById
);
// In brokerRoutes.js - add this new route before module.exports
/**
 * @swagger
 * /api/v1/brokers/{id}:
 *   delete:
 *     summary: Delete a broker (Admin+)
 *     tags: [Brokers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the broker to delete
 *     responses:
 *       200:
 *         description: Broker deleted successfully
 *       400:
 *         description: Invalid broker ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('DELETE_BROKER', 'Broker'),
  brokerController.deleteBroker
);

module.exports = router;