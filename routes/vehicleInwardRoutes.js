const express = require('express');
const router = express.Router();
const vehicleInwardController = require('../controllers/vehicleInwardController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const upload = require('../middlewares/upload');

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
 *         - inward_id
 *         - model_id
 *         - color_id
 *         - branch_id
 *         - chassis_number
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *         inward_id:
 *           type: string
 *           description: Unique inward ID
 *         model_id:
 *           type: string
 *           description: Reference to VehicleModel
 *         color_id:
 *           type: string
 *           description: Reference to VehicleColor
 *         branch_id:
 *           type: string
 *           description: Reference to Branch
 *         chassis_number:
 *           type: string
 *           description: Unique chassis number
 *         engine_number:
 *           type: string
 *           description: Engine number (for ICE vehicles)
 *         battery_number:
 *           type: string
 *           description: Battery number (for EVs)
 *         motor_number:
 *           type: string
 *           description: Motor number (for EVs)
 *         key_number:
 *           type: string
 *           description: Vehicle key number
 *         purchase_invoice:
 *           type: string
 *           description: URL to purchase invoice
 *         qr_code:
 *           type: string
 *           description: Generated QR code data
 *         vehicle_status:
 *           type: string
 *           enum: [MAIN_BRANCH, GO_DOWN, DAMAGED, SOLD, UNDER_REPAIR]
 *           default: MAIN_BRANCH
 *         damage_description:
 *           type: string
 *           description: Description of damage if any
 *         is_damage_approved:
 *           type: boolean
 *           default: false
 *         approved_by:
 *           type: string
 *           description: User who approved damage
 *         createdBy:
 *           type: string
 *           description: User who created the record
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         modelDetails:
 *           $ref: '#/components/schemas/VehicleModel'
 *         colorDetails:
 *           $ref: '#/components/schemas/VehicleColor'
 *         branchDetails:
 *           $ref: '#/components/schemas/Branch'
 */

/**
 * @swagger
 * /api/v1/vehicle-inward:
 *   post:
 *     summary: Create a new vehicle inward entry (Admin+)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - model_id
 *               - color_id
 *               - branch_id
 *               - chassis_number
 *               - purchase_invoice
 *             properties:
 *               model_id:
 *                 type: string
 *               color_id:
 *                 type: string
 *               branch_id:
 *                 type: string
 *               chassis_number:
 *                 type: string
 *               engine_number:
 *                 type: string
 *               battery_number:
 *                 type: string
 *               motor_number:
 *                 type: string
 *               key_number:
 *                 type: string
 *               purchase_invoice:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Vehicle inward created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER'), 
  upload.single('purchase_invoice'),
  logAction('CREATE', 'VehicleInward'), 
  vehicleInwardController.createInward
);

/**
 * @swagger
 * /api/v1/vehicle-inward:
 *   get:
 *     summary: Get all vehicle inward entries (Admin+)
 *     tags: [Vehicle Inward]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vehicle inward entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleInward'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER'), 
  vehicleInwardController.getAllInwards
);

/**
 * @swagger
 * /api/v1/vehicle-inward/branch/{branchId}:
 *   get:
 *     summary: Get vehicle inward entries by branch (Admin+ or Branch Manager)
 *     tags: [Vehicle Inward]
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
 *         description: List of vehicle inward entries for the branch
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleInward'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.get('/branch/:branchId', 
  protect, 
  vehicleInwardController.getInwardsByBranch
);

/**
 * @swagger
 * /api/v1/vehicle-inward/{id}:
 *   get:
 *     summary: Get vehicle inward entry by ID (Admin+)
 *     tags: [Vehicle Inward]
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
 *         description: Vehicle inward details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Inward entry not found
 *       500:
 *         description: Server error
 */
router.get('/:id', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER'), 
  vehicleInwardController.getInwardById
);

/**
 * @swagger
 * /api/v1/vehicle-inward/{id}:
 *   put:
 *     summary: Update vehicle inward entry (Admin+)
 *     tags: [Vehicle Inward]
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
 *             $ref: '#/components/schemas/VehicleInward'
 *     responses:
 *       200:
 *         description: Vehicle inward updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Inward entry not found
 *       500:
 *         description: Server error
 */
router.put('/:id', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER'), 
  logAction('UPDATE', 'VehicleInward'), 
  vehicleInwardController.updateInward
);

/**
 * @swagger
 * /api/v1/vehicle-inward/{id}/damage:
 *   put:
 *     summary: Report damage on vehicle (Manager+)
 *     tags: [Vehicle Inward]
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
 *             required:
 *               - damage_description
 *             properties:
 *               damage_description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Damage reported
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Manager+)
 *       404:
 *         description: Inward entry not found
 *       500:
 *         description: Server error
 */
router.put('/:id/damage', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN', 'MANAGER'), 
  logAction('UPDATE', 'VehicleInward'), 
  vehicleInwardController.reportDamage
);

/**
 * @swagger
 * /api/v1/vehicle-inward/{id}/approve-damage:
 *   put:
 *     summary: Approve damage report (Admin+)
 *     tags: [Vehicle Inward]
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
 *         description: Damage approved and vehicle moved to go-down
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleInward'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Inward entry not found
 *       500:
 *         description: Server error
 */
router.put('/:id/approve-damage', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN'), 
  logAction('UPDATE', 'VehicleInward'), 
  vehicleInwardController.approveDamage
);

/**
 * @swagger
 * /api/v1/vehicle-inward/{id}:
 *   delete:
 *     summary: Delete vehicle inward entry (SuperAdmin only)
 *     tags: [Vehicle Inward]
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
 *         description: Inward entry deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Inward entry not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', 
  protect, 
  authorize('SUPERADMIN'), 
  logAction('DELETE', 'VehicleInward'), 
  vehicleInwardController.deleteInward
);

module.exports = router;