const express = require('express');
const router = express.Router();
const vehicleModelController = require('../controllers/vehicleModelController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Vehicle Models
 *   description: Vehicle model management endpoints
 */

/**
 * @swagger
 * /api/v1/vehicle-models:
 *   post:
 *     summary: Create a new vehicle model (Admin+)
 *     tags: [Vehicle Models]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehicleModel'
 *     responses:
 *       201:
 *         description: Vehicle model created successfully
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
  requirePermission('VEHICLE_MODEL.CREATE'),
  logAction('CREATE', 'VehicleModel'), 
  vehicleModelController.createModel
);

/**
 * @swagger
 * /api/v1/vehicle-models:
 *   get:
 *     summary: Get all vehicle models
 *     tags: [Vehicle Models]
 *     responses:
 *       200:
 *         description: List of vehicle models
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleModel'
 *       500:
 *         description: Server error
 */
router.get('/',
  
  protect,
  requirePermission('VEHICLE_MODEL.READ'),
  vehicleModelController.getAllModels);

/**
 * @swagger
 * /api/v1/vehicle-models/{id}:
 *   get:
 *     summary: Get vehicle model by ID
 *     tags: [Vehicle Models]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vehicle model details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleModel'
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  requirePermission('VEHICLE_MODEL.READ'),
   vehicleModelController.getModelById);

/**
 * @swagger
 * /api/v1/vehicle-models/{id}:
 *   put:
 *     summary: Update vehicle model (Admin+)
 *     tags: [Vehicle Models]
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
 *             $ref: '#/components/schemas/VehicleModel'
 *     responses:
 *       200:
 *         description: Vehicle model updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  requirePermission('VEHICLE_MODEL.UPDATE'),
  logAction('UPDATE', 'VehicleModel'),
  vehicleModelController.updateModel
);

/**
 * @swagger
 * /api/v1/vehicle-models/{id}:
 *   delete:
 *     summary: Delete vehicle model (SuperAdmin only)
 *     tags: [Vehicle Models]
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
 *         description: Model deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  requirePermission('VEHICLE_MODEL.DELETE'),
  logAction('DELETE', 'VehicleModel'),
  vehicleModelController.deleteModel
);

module.exports = router;