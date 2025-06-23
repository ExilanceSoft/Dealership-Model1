const express = require('express');
const router = express.Router();
const vehicleInwardController = require('../controllers/vehicleInwardController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Vehicle Inward
 *   description: Vehicle inward management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     VehicleInward:
 *       type: object
 *       required:
 *         - model
 *         - type
 *         - color
 *         - unloadLocation
 *         - chassisNumber
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the vehicle inward record
 *         model:
 *           type: string
 *           description: ID of the vehicle model
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           description: Type of vehicle (Electric or Internal Combustion Engine)
 *         color:
 *           type: string
 *           description: ID of the vehicle color
 *         unloadLocation:
 *           type: string
 *           description: ID of the branch where vehicle is unloaded
 *         batteryNumber:
 *           type: string
 *           description: Battery number (required for EV)
 *         keyNumber:
 *           type: string
 *           description: Key number
 *         chassisNumber:
 *           type: string
 *           description: Chassis number (unique)
 *         motorNumber:
 *           type: string
 *           description: Motor number (required for EV)
 *         chargerNumber:
 *           type: string
 *           description: Charger number (required for EV)
 *         engineNumber:
 *           type: string
 *           description: Engine number (required for ICE)
 *         hasDamage:
 *           type: boolean
 *           description: Whether vehicle has damage
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
 *               severity:
 *                 type: string
 *                 enum: [minor, medium, major]
 *         qrCode:
 *           type: string
 *           description: Unique QR code for vehicle identification
 *         status:
 *           type: string
 *           enum: [inwarded, inspected, approved, rejected, dispatched]
 *           description: Current status of vehicle
 *         branch:
 *           type: string
 *           description: ID of the branch where vehicle belongs
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when record was created
 */

/**
 * @swagger
 * /api/v1/inward:
 *   post:
 *     summary: Create a new vehicle inward record
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *               - type
 *               - color
 *               - unloadLocation
 *               - chassisNumber
 *             properties:
 *               model:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               type:
 *                 type: string
 *                 enum: [EV, ICE]
 *                 example: "EV"
 *               color:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *               unloadLocation:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439013"
 *               batteryNumber:
 *                 type: string
 *                 example: "BAT12345"
 *               keyNumber:
 *                 type: string
 *                 example: "KEY67890"
 *               chassisNumber:
 *                 type: string
 *                 example: "CHS123456789"
 *               motorNumber:
 *                 type: string
 *                 example: "MOT98765"
 *               chargerNumber:
 *                 type: string
 *                 example: "CHG54321"
 *               engineNumber:
 *                 type: string
 *                 example: "ENG12345"
 *               hasDamage:
 *                 type: boolean
 *                 example: false
 *               damages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                       example: "Scratch on left side"
 *                     images:
 *                       type: array
 *                       items:
 *                         type: string
 *                         example: "damage1.jpg"
 *                     severity:
 *                       type: string
 *                       enum: [minor, medium, major]
 *                       example: "minor"
 *     responses:
 *       201:
 *         description: Vehicle inward record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  logAction('CREATE', 'VehicleInward'),
  vehicleInwardController.createVehicleInward
);

/**
 * @swagger
 * /api/v1/inward/qr/{qrCode}:
 *   get:
 *     summary: Get vehicle details by QR code
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *         description: QR code of the vehicle
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get(
  '/qr/:qrCode',
  protect,
  logAction('READ', 'VehicleInward'),
  vehicleInwardController.getVehicleByQRCode
);

/**
 * @swagger
 * /api/v1/inward/chassis/{chassisNumber}:
 *   get:
 *     summary: Get vehicle details by chassis number
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chassisNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Chassis number of the vehicle
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get(
  '/chassis/:chassisNumber',
  protect,
  logAction('READ', 'VehicleInward'),
  vehicleInwardController.getVehicleByChassisNumber
);

/**
 * @swagger
 * /api/v1/inward/branch/{branchId}:
 *   get:
 *     summary: Get all vehicles for a branch
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [inwarded, inspected, approved, rejected, dispatched]
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EV, ICE]
 *         description: Filter by vehicle type
 *     responses:
 *       200:
 *         description: List of vehicles
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
 *                     $ref: '#/components/schemas/VehicleInward'
 *       500:
 *         description: Server error
 */
router.get(
  '/branch/:branchId',
  protect,
  logAction('READ', 'VehicleInward'),
  vehicleInwardController.getVehiclesByBranch
);

/**
 * @swagger
 * /api/v1/inward/{id}/status:
 *   patch:
 *     summary: Update vehicle status (Admin/Manager+)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle inward ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [inwarded, inspected, approved, rejected, dispatched]
 *                 example: "approved"
 *     responses:
 *       200:
 *         description: Vehicle status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin/Manager+)
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/status',
  protect,
  authorize('ADMIN', 'MANAGER', 'SUPERADMIN'),
  logAction('UPDATE_STATUS', 'VehicleInward'),
  vehicleInwardController.updateVehicleStatus
);

/**
 * @swagger
 * /api/v1/inward/{id}/damage:
 *   post:
 *     summary: Add damage to vehicle
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle inward ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - images
 *             properties:
 *               description:
 *                 type: string
 *                 example: "Scratch on left side"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["damage1.jpg", "damage2.jpg"]
 *               severity:
 *                 type: string
 *                 enum: [minor, medium, major]
 *                 example: "minor"
 *     responses:
 *       200:
 *         description: Damage added to vehicle
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       400:
 *         description: Invalid damage data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:id/damage',
  protect,
  logAction('ADD_DAMAGE', 'VehicleInward'),
  vehicleInwardController.addDamageToVehicle
);

module.exports = router;