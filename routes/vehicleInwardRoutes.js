const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleInwardController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Vehicle Inward
 *   description: Vehicle inward stock management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Vehicle:
 *       type: object
 *       required:
 *         - model
 *         - unloadLocation
 *         - type
 *         - colors
 *         - chassisNumber
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         model:
 *           type: string
 *           description: Reference to Model
 *           example: 507f1f77bcf86cd799439011
 *         unloadLocation:
 *           type: string
 *           description: Reference to Branch
 *           example: 507f1f77bcf86cd799439011
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           example: EV
 *         colors:
 *           type: array
 *           items:
 *             type: string
 *             description: Reference to Color
 *           example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *         batteryNumber:
 *           type: string
 *           example: BATT123456
 *         keyNumber:
 *           type: string
 *           example: KEY123456
 *         chassisNumber:
 *           type: string
 *           example: CHS1234567890
 *         motorNumber:
 *           type: string
 *           example: MOTOR123456
 *         chargerNumber:
 *           type: string
 *           example: CHARGER123
 *         engineNumber:
 *           type: string
 *           example: ENG123456
 *         hasDamage:
 *           type: boolean
 *           default: false
 *         damages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               reportedAt:
 *                 type: string
 *                 format: date-time
 *         qrCode:
 *           type: string
 *           example: VH-CHS1234567890-abc123
 *         qrCodeImage:
 *           type: string
 *           description: Base64 encoded QR code image
 *         status:
 *           type: string
 *           enum: [in_stock, in_transit, sold, service, damaged]
 *           default: in_stock
 *         addedBy:
 *           type: string
 *           description: Reference to User
 *           example: 507f1f77bcf86cd799439011
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         modelDetails:
 *           $ref: '#/components/schemas/Model'
 *         locationDetails:
 *           $ref: '#/components/schemas/Branch'
 *         colorDetails:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Color'
 *         addedByDetails:
 *           $ref: '#/components/schemas/User'
 * 
 *     VehicleInput:
 *       type: object
 *       required:
 *         - model
 *         - unloadLocation
 *         - type
 *         - colors
 *         - chassisNumber
 *       properties:
 *         model:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         unloadLocation:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           example: EV
 *         colors:
 *           type: array
 *           items:
 *             type: string
 *           example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *         batteryNumber:
 *           type: string
 *           example: BATT123456
 *         keyNumber:
 *           type: string
 *           example: KEY123456
 *         chassisNumber:
 *           type: string
 *           example: CHS1234567890
 *         motorNumber:
 *           type: string
 *           example: MOTOR123456
 *         chargerNumber:
 *           type: string
 *           example: CHARGER123
 *         engineNumber:
 *           type: string
 *           example: ENG123456
 *         hasDamage:
 *           type: boolean
 *           example: false
 *         damages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 * 
 *     DamageInput:
 *       type: object
 *       required:
 *         - description
 *         - images
 *       properties:
 *         description:
 *           type: string
 *           example: Scratch on left side door
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["image1.jpg", "image2.jpg"]
 * 
 *     StatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [in_stock, in_transit, sold, service, damaged]
 *           example: in_transit
 */

/**
 * @swagger
 * /api/v1/inward:
 *   post:
 *     summary: Add a new vehicle to inward stock (Admin+)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehicleInput'
 *     responses:
 *       201:
 *         description: Vehicle added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Model, location or color not found
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER','SALES_EXECUTIVE'),
  logAction('CREATE', 'Vehicle'),
  vehicleController.createVehicle
);

/**
 * @swagger
 * /api/v1/inward:
 *   get:
 *     summary: Get all inward vehicles with filtering options
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EV, ICE]
 *         description: Filter by vehicle type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [in_stock, in_transit, sold, service, damaged]
 *         description: Filter by status
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Filter by model ID
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by unload location ID
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Filter by color ID
 *       - in: query
 *         name: hasDamage
 *         schema:
 *           type: boolean
 *         description: Filter by damage status
 *     responses:
 *       200:
 *         description: List of vehicles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 *       500:
 *         description: Server error
 */
router.get('/', vehicleController.getAllVehicles);

/**
 * @swagger
 * /api/v1/inward/{vehicleId}:
 *   get:
 *     summary: Get an inward vehicle by ID
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get('/:vehicleId', vehicleController.getVehicleById);

/**
 * @swagger
 * /api/v1/inward/qr/{qrCode}:
 *   get:
 *     summary: Get an inward vehicle by QR code
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *         example: VH-CHS1234567890-abc123
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get('/qr/:qrCode', vehicleController.getVehicleByQrCode);

/**
 * @swagger
 * /api/v1/inward/{vehicleId}/status:
 *   put:
 *     summary: Update inward vehicle status (Admin+)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusUpdate'
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:vehicleId/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER','SALES_EXECUTIVE'),
  logAction('UPDATE_STATUS', 'Vehicle'),
  vehicleController.updateVehicleStatus
);

/**
 * @swagger
 * /api/v1/inward/{vehicleId}/damage:
 *   post:
 *     summary: Add damage to inward vehicle (Admin+)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DamageInput'
 *     responses:
 *       200:
 *         description: Damage added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:vehicleId/damage',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  logAction('ADD_DAMAGE', 'Vehicle'),
  vehicleController.addDamage
);

/**
 * @swagger
 * /api/v1/inward/{vehicleId}/generate-qr:
 *   get:
 *     summary: Generate QR code for inward vehicle (Admin+)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: QR code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *                     qrCodeUrl:
 *                       type: string
 *                       description: Base64 encoded QR code image
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:vehicleId/generate-qr',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  logAction('GENERATE_QR', 'Vehicle'),
  vehicleController.generateQrCode
);

/**
 * @swagger
 * /api/v1/inward/branch/{branchId}:
 *   get:
 *     summary: Get vehicles by branch
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: List of vehicles in the specified branch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 10
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.get('/branch/:branchId', vehicleController.getVehiclesByBranch);
module.exports = router;