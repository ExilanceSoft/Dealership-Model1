const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');
const { protect, authorize, roleAuthorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const path = require('path');
const { requirePermission } = require('../middlewares/requirePermission');

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
 *     CommissionRange:
 *       type: object
 *       required:
 *         - range
 *         - amount
 *       properties:
 *         range:
 *           type: string
 *           enum: ['1-20000', '20001-40000', '40001-60000', '60001']
 *           description: Predefined commission range
 *           example: "40001-60000"
 *         amount:
 *           type: number
 *           minimum: 0
 *           description: Commission amount for this range
 *           example: 1500
 * 
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
 *         commissionRanges:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommissionRange'
 *           description: Commission ranges with amounts (required for VARIABLE type)
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
 *         otp_required:
 *           type: boolean
 *           description: Whether OTP is required for this broker
 *           example: true
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
 *         otp_required:
 *           type: boolean
 *           description: Whether OTP is required for this broker
 *           example: true
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
 *               commissionRanges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - range
 *                     - amount
 *                   properties:
 *                     range:
 *                       type: string
 *                       enum: ['1-20000', '20001-40000', '40001-60000', '60001']
 *                       example: "40001-60000"
 *                     amount:
 *                       type: number
 *                       minimum: 0
 *                       example: 1500
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
 *             fixedCommissionExample:
 *               summary: Example with fixed commission
 *               value:
 *                 name: "John Doe"
 *                 mobile: "9876543210"
 *                 email: "john.doe@example.com"
 *                 otp_required: true
 *                 branchesData: [
 *                   {
 *                     branch: "507f1f77bcf86cd799439011",
 *                     commissionType: "FIXED",
 *                     fixedCommission: 1000,
 *                     isActive: true
 *                   }
 *                 ]
 *             variableCommissionExample:
 *               summary: Example with variable commission ranges
 *               value:
 *                 name: "Jane Smith"
 *                 mobile: "9876543211"
 *                 email: "jane.smith@example.com"
 *                 otp_required: false
 *                 branchesData: [
 *                   {
 *                     branch: "507f1f77bcf86cd799439011",
 *                     commissionType: "VARIABLE",
 *                     commissionRanges: [
 *                       { range: "1-20000", amount: 500 },
 *                       { range: "20001-40000", amount: 1000 },
 *                       { range: "40001-60000", amount: 1500 },
 *                       { range: "60001", amount: 2000 }
 *                     ],
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
 *           - Commission amount is required for each range
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
  requirePermission('BROKER.CREATE'),
  logAction('CREATE_OR_ADD_BROKER', 'Broker'),
  brokerController.createOrAddBroker
);

/**
 * @swagger
 * /api/v1/brokers/verify-otp:
 *   post:
 *     summary: Verify broker OTP
 *     description: Verify OTP received by broker during booking
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
 *               - brokerId
 *               - otp
 *             properties:
 *               brokerId:
 *                 type: string
 *                 format: objectId
 *                 example: "507f1f77bcf86cd799439013"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
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
 *                   example: "OTP verified successfully"
 *                 verified:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid OTP or expired
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/verify-otp',
  protect,
  brokerController.verifyBrokerOTP
);

/**
 * @swagger
 * /api/v1/brokers/{brokerId}/toggle-otp:
 *   post:
 *     summary: Toggle OTP requirement for a broker
 *     description: Enable or disable OTP requirement for a broker
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
 *         description: ID of the broker to toggle OTP requirement
 *     responses:
 *       200:
 *         description: OTP requirement toggled successfully
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
 *                     otp_required:
 *                       type: boolean
 *                       example: false
 *                 message:
 *                   type: string
 *                   example: "OTP requirement disabled successfully"
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
router.post(
  '/:brokerId/toggle-otp',
  protect,
  requirePermission('BROKER.UPDATE'),
  logAction('TOGGLE_OTP_REQUIREMENT', 'Broker'),
  brokerController.toggleBrokerOTPRequirement
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
  requirePermission('BROKER.READ'),
  brokerController.getBrokersByBranch
);

/**
 * @swagger
 * /api/v1/brokers/{brokerId}:
 *   put:
 *     summary: Update broker details including branches
 *     description: |
 *       - Updates broker name, mobile, email, OTP requirement, and branches
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
 *               otp_required:
 *                 type: boolean
 *                 example: false
 *               branchesData:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     branch:
 *                       type: string
 *                       format: objectId
 *                       example: "507f1f77bcf86cd799439011"
 *                     commissionType:
 *                       type: string
 *                       enum: [FIXED, VARIABLE]
 *                       example: "VARIABLE"
 *                     fixedCommission:
 *                       type: number
 *                       example: 1000
 *                     commissionRange:
 *                       type: string
 *                       enum: ['1-20000', '20001-40000', '40001-60000', '60001']
 *                       example: "40001-60000"
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
  requirePermission('BROKER.UPDATE'),
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
  requirePermission('BROKER.DELETE'),
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
  requirePermission('BROKER.READ'),
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
  requirePermission('BROKER.READ'),
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
  requirePermission('BROKER.DELETE'),
  logAction('DELETE_BROKER', 'Broker'),
  brokerController.deleteBroker
);

/**
 * @swagger
 * /api/v1/brokers/{brokerId}/send-otp:
 *   post:
 *     summary: Send OTP to broker's mobile
 *     description: Send OTP to broker for verification during booking
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
 *         description: ID of the broker to send OTP to
 *     responses:
 *       200:
 *         description: OTP sent successfully or not required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *                 otpRequired:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid broker ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Broker not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:brokerId/send-otp',
  protect,
  brokerController.sendBrokerOTP
);

module.exports = router;