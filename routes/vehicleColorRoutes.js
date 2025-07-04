const express = require('express');
const router = express.Router();
const vehicleColorController = require('../controllers/vehicleColorController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Vehicle Colors
 *   description: Vehicle color management endpoints
 */

/**
 * @swagger
 * /api/v1/vehicle-colors:
 *   post:
 *     summary: Create a new vehicle color (Admin+)
 *     tags: [Vehicle Colors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehicleColor'
 *     responses:
 *       201:
 *         description: Vehicle color created successfully
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
  authorize('SUPERADMIN', 'SALES_EXECUTIVE'), 
  logAction('CREATE', 'VehicleColor'), 
  vehicleColorController.createColor
);

/**
 * @swagger
 * /api/v1/vehicle-colors:
 *   get:
 *     summary: Get all vehicle colors
 *     tags: [Vehicle Colors]
 *     responses:
 *       200:
 *         description: List of vehicle colors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleColor'
 *       500:
 *         description: Server error
 */
router.get('/', vehicleColorController.getAllColors);

/**
 * @swagger
 * /api/v1/vehicle-colors/model/{modelId}:
 *   get:
 *     summary: Get colors by model ID
 *     tags: [Vehicle Colors]
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of colors for the model
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleColor'
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/model/:modelId', vehicleColorController.getColorsByModel);

/**
 * @swagger
 * /api/v1/vehicle-colors/{id}:
 *   put:
 *     summary: Update vehicle color (Admin+)
 *     tags: [Vehicle Colors]
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
 *             $ref: '#/components/schemas/VehicleColor'
 *     responses:
 *       200:
 *         description: Color updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.put('/:id', 
  protect, 
  authorize('SUPERADMIN', 'SALES_EXECUTIVE'), 
  logAction('UPDATE', 'VehicleColor'), 
  vehicleColorController.updateColor
);

/**
 * @swagger
 * /api/v1/vehicle-colors/{id}:
 *   delete:
 *     summary: Delete vehicle color (SuperAdmin only)
 *     tags: [Vehicle Colors]
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
 *         description: Color deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Color not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', 
  protect, 
  authorize('SUPERADMIN','SALES_EXECUTIVE'), 
  logAction('DELETE', 'VehicleColor'), 
  vehicleColorController.deleteColor
);

module.exports = router;