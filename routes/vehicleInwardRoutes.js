const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleInwardController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const upload = require('../middlewares/upload');

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
 *         - color
 *         - chassisNumber
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the vehicle
 *           example: 507f1f77bcf86cd799439011
 *         model:
 *           type: string
 *           description: Vehicle model name
 *           example: Model X
 *         unloadLocation:
 *           $ref: '#/components/schemas/Branch'
 *           description: Branch where vehicle is unloaded
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           description: Vehicle type (Electric or Internal Combustion Engine)
 *           example: EV
 *         color:
 *           type: string
 *           description: Vehicle color
 *           example: Red
 *         batteryNumber:
 *           type: string
 *           description: Battery serial number (for EVs)
 *           example: BATT123456
 *         keyNumber:
 *           type: string
 *           description: Vehicle key number
 *           example: KEY123456
 *         chassisNumber:
 *           type: string
 *           description: Unique chassis number
 *           example: CHS1234567890
 *         motorNumber:
 *           type: string
 *           description: Motor number (for EVs)
 *           example: MOTOR123456
 *         chargerNumber:
 *           type: string
 *           description: Charger number (for EVs)
 *           example: CHARGER123
 *         engineNumber:
 *           type: string
 *           description: Engine number (for ICE vehicles)
 *           example: ENG123456
 *         hasDamage:
 *           type: boolean
 *           description: Whether vehicle has reported damage
 *           default: false
 *         damages:
 *           type: array
 *           description: List of damage reports
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Damage description
 *               images:
 *                 type: array
 *                 description: Array of image URLs
 *                 items:
 *                   type: string
 *               reportedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When damage was reported
 *         qrCode:
 *           type: string
 *           description: Unique QR code identifier
 *           example: VH-CHS1234567890-abc123
 *         qrCodeImage:
 *           type: string
 *           description: Base64 encoded QR code image
 *         status:
 *           type: string
 *           enum: [in_stock, in_transit, sold, service, damaged]
 *           description: Current vehicle status
 *           default: in_stock
 *         addedBy:
 *           $ref: '#/components/schemas/User'
 *           description: User who added the vehicle
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When vehicle was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When vehicle was last updated
 * 
 *     VehicleInput:
 *       type: object
 *       required:
 *         - model
 *         - unloadLocation
 *         - type
 *         - color
 *         - chassisNumber
 *       properties:
 *         model:
 *           type: string
 *           example: Model X
 *         unloadLocation:
 *           type: string
 *           description: Branch ID where vehicle is unloaded
 *           example: 507f1f77bcf86cd799439011
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           example: EV
 *         color:
 *           type: string
 *           example: Red
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
 *           required: when type is EV
 *         chargerNumber:
 *           type: string
 *           example: CHARGER123
 *           required: when type is EV
 *         engineNumber:
 *           type: string
 *           example: ENG123456
 *           required: when type is ICE
 * 
 *     DamageInput:
 *       type: object
 *       required:
 *         - description
 *         - images
 *       properties:
 *         description:
 *           type: string
 *           description: Description of the damage
 *           example: Scratch on left side door
 *         images:
 *           type: array
 *           description: Array of image URLs showing the damage
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
 *           description: New status for the vehicle
 *           example: in_transit
 * 
 *     VehicleCounts:
 *       type: object
 *       properties:
 *         branchId:
 *           type: string
 *           description: Branch ID
 *         branchName:
 *           type: string
 *           description: Branch name
 *         branchCity:
 *           type: string
 *           description: Branch city
 *         statusCounts:
 *           type: array
 *           description: Count of vehicles by status
 *           items:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               count:
 *                 type: integer
 *         total:
 *           type: integer
 *           description: Total vehicles at branch
 */

/**
 * @swagger
 * /api/v1/vehicles:
 *   post:
 *     summary: Create a new vehicle (Admin+, Inventory Manager, Sales Executive)
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
 *               - unloadLocation
 *               - type
 *               - color
 *               - chassisNumber
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model ID from the Model collection
 *                 example: 68710ac8e7279a51e9d637d0
 *               unloadLocation:
 *                 type: string
 *                 description: Branch ID where vehicle is unloaded
 *                 example: 686e4594988c62482fff2c0f
 *               type:
 *                 type: string
 *                 enum: [EV, ICE]
 *                 description: Vehicle type (must match model type)
 *                 example: EV
 *               color:
 *                 type: object
 *                 required:
 *                   - id
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Color ID from the Color collection
 *                     example: 689337b8d4a76527ffa35ada
 *               batteryNumber:
 *                 type: string
 *                 description: Battery serial number (for EVs)
 *                 example: BATT123456
 *               keyNumber:
 *                 type: string
 *                 description: Vehicle key number
 *                 example: KEY123456
 *               chassisNumber:
 *                 type: string
 *                 description: Unique chassis number
 *                 example: CHS1234567890
 *               motorNumber:
 *                 type: string
 *                 description: Motor number (for EVs)
 *                 example: MOTOR123456
 *               chargerNumber:
 *                 type: string
 *                 description: Charger number (for EVs)
 *                 example: CHARGER123
 *     responses:
 *       201:
 *         description: Vehicle created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Missing required fields or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Model or color not found
 *       409:
 *         description: Conflict (duplicate chassis number)
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_EXECUTIVE'),
  logAction('CREATE', 'Vehicle'),
  vehicleController.createVehicle
);
/**
 * @swagger
 * /api/v1/vehicles/approve:
 *   post:
 *     summary: Approve multiple vehicles (Admin+, Inventory Manager)
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
 *               - vehicleIds
 *             properties:
 *               vehicleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of vehicle IDs to approve
 *     responses:
 *       200:
 *         description: Vehicles approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     approvedCount:
 *                       type: integer
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid vehicle IDs or no vehicles to approve
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: No vehicles found to approve
 *       500:
 *         description: Server error
 */
router.post(
  '/approve',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  logAction('APPROVE_VEHICLES', 'Vehicle'),
  vehicleController.approveVehicles
);

/**
 * @swagger
 * /api/v1/vehicles/export-csv:
 *   get:
 *     summary: Export vehicles as CSV template (Admin+, Inventory Manager)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [EV, ICE]
 *         description: Vehicle type to export
 *       - in: query
 *         name: branch_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID to filter vehicles
 *     responses:
 *       200:
 *         description: CSV file downloaded
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Missing type or branch_id, or invalid branch ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.get('/export-csv',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  logAction('EXPORT_CSV', 'Vehicle'),
  vehicleController.exportCSVTemplate
);

/**
 * @swagger
 * /api/v1/vehicles/import-csv:
 *   post:
 *     summary: Import vehicles from CSV (Admin+, Inventory Manager)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [EV, ICE]
 *         description: Vehicle type for imported vehicles
 *       - in: query
 *         name: branch_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID for imported vehicles
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file to import
 *     responses:
 *       200:
 *         description: CSV import completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 imported:
 *                   type: integer
 *                 updated:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: No file uploaded or invalid CSV format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Server error
 */
router.post('/import-csv',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  upload.single('file'),
  logAction('IMPORT_CSV', 'Vehicle'),
  vehicleController.importCSV
);
/**
 * @swagger
 * /api/v1/vehicles/counts:
 *   get:
 *     summary: Get vehicle counts by status (All authenticated users)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vehicle counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/VehicleCounts'
 *                     - type: array
 *                       items:
 *                         $ref: '#/components/schemas/VehicleCounts'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/counts',
  protect,
  logAction('GET_COUNTS', 'Vehicle'),
  vehicleController.getVehicleCounts
);

/**
 * @swagger
 * /api/v1/vehicles:
 *   get:
 *     summary: Get all vehicles (Public)
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
 *         description: Filter by vehicle status
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Filter by vehicle model
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Filter by vehicle color
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
 *                 results:
 *                   type: integer
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
 * /api/v1/vehicles/{vehicleId}:
 *   get:
 *     summary: Get a vehicle by ID (Public)
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the vehicle to retrieve
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid vehicle ID format
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get('/:vehicleId', vehicleController.getVehicleById);
/**
 * @swagger
 * /api/v1/vehicles/status/{status}:
 *   get:
 *     summary: Get vehicles by status (Admin+, Inventory Manager)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [not_approved, in_stock, in_transit, sold, service, damaged]
 *         description: Status to filter vehicles by
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of vehicles with the specified status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid status parameter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Server error
 */
router.get(
  '/status/:status',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER'),
  vehicleController.getVehiclesByStatus
);
/**
 * @swagger
 * /api/v1/vehicles/qr/{qrCode}:
 *   get:
 *     summary: Get a vehicle by QR code (Public)
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *         description: QR code of the vehicle to retrieve
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get('/qr/:qrCode', vehicleController.getVehicleByQrCode);

/**
 * @swagger
 * /api/v1/vehicles/{vehicleId}/status:
 *   put:
 *     summary: Update vehicle status (Admin+, Inventory Manager, Sales Executive)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the vehicle to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusUpdate'
 *     responses:
 *       200:
 *         description: Vehicle status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid status or vehicle ID format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:vehicleId/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER', 'SALES_EXECUTIVE'),
  logAction('UPDATE_STATUS', 'Vehicle'),
  vehicleController.updateVehicleStatus
);
/**
 * @swagger
 * /api/v1/vehicles/model/{model}/details:
 *   get:
 *     summary: Get chassis numbers and colors by vehicle model (Public)
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: model
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle model to filter details
 *     responses:
 *       200:
 *         description: List of chassis numbers and colors for the specified model
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
 *                     model:
 *                       type: string
 *                     chassisNumbers:
 *                       type: array
 *                       items:
 *                         type: string
 *                     colors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *       400:
 *         description: Model name is required
 *       500:
 *         description: Server error
 */
router.get('/model/:model/details', vehicleController.getModelDetails);

/**
 * @swagger
 * /api/v1/vehicles/{vehicleId}/damage:
 *   post:
 *     summary: Add damage report to vehicle (Admin+, Inventory Manager)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the vehicle to report damage
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DamageInput'
 *     responses:
 *       200:
 *         description: Damage reported successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Missing description/images or invalid vehicle ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
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
 * /api/v1/vehicles/model/{model}/chassis-numbers:
 *   get:
 *     summary: Get chassis numbers by vehicle model (Public)
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: model
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle model to filter chassis numbers
 *     responses:
 *       200:
 *         description: List of chassis numbers for the specified model
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
 *                     chassisNumbers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           chassisNumber:
 *                             type: string
 *                           model:
 *                             type: string
 *       400:
 *         description: Model name is required
 *       500:
 *         description: Server error
 */
router.get('/model/:model/chassis-numbers', vehicleController.getChassisNumbersByModel);
/**
 * @swagger
 * /api/v1/vehicles/{vehicleId}/generate-qr:
 *   get:
 *     summary: Generate QR code for vehicle (Admin+, Inventory Manager)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the vehicle to generate QR code
 *     responses:
 *       200:
 *         description: QR code generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *                     qrCodeUrl:
 *                       type: string
 *                       description: Base64 encoded QR code image
 *       400:
 *         description: Invalid vehicle ID format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
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
 * /api/v1/vehicles/branch/{branchId}:
 *   get:
 *     summary: Get vehicles by branch (Public)
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the branch to filter vehicles
 *     responses:
 *       200:
 *         description: List of vehicles at branch
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
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Invalid branch ID format
 *       500:
 *         description: Server error
 */
router.get('/branch/:branchId', vehicleController.getVehiclesByBranch);

/**
 * @swagger
 * /api/v1/vehicles/chassis/{chassisNumber}:
 *   get:
 *     summary: Get vehicle by chassis number (Public)
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: chassisNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Chassis number of the vehicle to retrieve
 *     responses:
 *       200:
 *         description: Vehicle details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Chassis number is required
 *       404:
 *         description: Vehicle not found
 *       500:
 *         description: Server error
 */
router.get('/chassis/:chassisNumber', vehicleController.getVehicleByChassisNumber);
/**
 * @swagger
 * /api/v1/vehicles/model/{modelId}/{colorId}/chassis-numbers:
 *   get:
 *     summary: Get chassis numbers by model ID and color ID (Public)
 *     tags: [Vehicle Inward]
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Model ID to filter chassis numbers
 *       - in: path
 *         name: colorId
 *         required: true
 *         schema:
 *           type: string
 *         description: Color ID to filter chassis numbers
 *     responses:
 *       200:
 *         description: List of chassis numbers for the specified model and color
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
 *                     modelId:
 *                       type: string
 *                     colorId:
 *                       type: string
 *                     modelName:
 *                       type: string
 *                     chassisNumbers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           chassisNumber:
 *                             type: string
 *                           model:
 *                             type: string
 *                           color:
 *                             type: string
 *       400:
 *         description: Invalid model or color ID format
 *       404:
 *         description: Model or color not found
 *       500:
 *         description: Server error
 */
 
router.get('/model/:modelId/:colorId/chassis-numbers', vehicleController.getChassisNumbersByModelAndColor);



module.exports = router;