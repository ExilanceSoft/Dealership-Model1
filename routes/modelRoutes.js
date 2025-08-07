const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Models
 *   description: Vehicle model management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Model:
 *       type: object
 *       required:
 *         - model_name
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         model_name:
 *           type: string
 *           example: Model X
 *         type:
 *           type: string
 *           enum: [EV, ICE, CSD]
 *           example: EV
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *         prices:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               value:
 *                 type: number
 *                 example: 50000
 *               header_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439012
 *               branch_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439013
 *         createdAt:
 *           type: string
 *           format: date-time
 * 
 *     ModelInput:
 *       type: object
 *       required:
 *         - model_name
 *         - type
 *       properties:
 *         model_name:
 *           type: string
 *           example: Model X
 *         type:
 *           type: string
 *           enum: [EV, ICE,CSD]
 *           example: EV
 *         prices:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               value:
 *                 type: number
 *                 example: 50000
 *               header_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439012
 *               branch_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439013
 * 
 *     ModelUpdate:
 *       type: object
 *       properties:
 *         model_name:
 *           type: string
 *           example: Model X Updated
 *         type:
 *           type: string
 *           enum: [EV, ICE,CSD]
 *           example: ICE
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           example: inactive
 * 
 *     PriceUpdate:
 *       type: object
 *       required:
 *         - prices
 *       properties:
 *         prices:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - value
 *               - header_id
 *             properties:
 *               value:
 *                 type: number
 *                 example: 55000
 *               header_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439012
 *               branch_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439013
 * 
 *     ModelResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: object
 *           properties:
 *             model:
 *               $ref: '#/components/schemas/Model'
 */

/**
 * @swagger
 * /api/v1/models:
 *   post:
 *     summary: Create a new model (Admin+)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModelInput'
 *     responses:
 *       201:
 *         description: Model created successfully
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
 *                     model:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         model_name:
 *                           type: string
 *                         type:
 *                           type: string
 *                         prices:
 *                           type: array
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error or duplicate model name
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('CREATE', 'Model'),
  modelController.createModel
);

/**
 * @swagger
 * /api/v1/models/with-prices:
 *   get:
 *     summary: Get all models with prices
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of models with prices
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
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     models:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           model_name:
 *                             type: string
 *                           type:
 *                             type: string
 *                           status:
 *                             type: string
 *                           prices:
 *                             type: array
 *                           createdAt:
 *                             type: string
 *       400:
 *         description: Invalid branch ID
 *       500:
 *         description: Server error
 */
router.get(
  '/with-prices',
  protect,
  modelController.getAllModelsWithPrices
);
/**
 * @swagger
 * /api/v1/models/{modelId}:
 *   get:
 *     summary: Get a model by ID
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Model details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelResponse'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:modelId',
  protect,
  modelController.getModelById
);

/**
 * @swagger
 * /api/v1/models/{modelId}:
 *   put:
 *     summary: Update a model (Admin+)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModelUpdate'
 *     responses:
 *       200:
 *         description: Model updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelResponse'
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
router.put(
  '/:modelId',
  protect,
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('UPDATE', 'Model'),
  modelController.updateModel
);

/**
 * @api/v1/models/{modelId}/prices:
 *   put:
 *     summary: Update model prices (Admin+)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PriceUpdate'
 *     responses:
 *       200:
 *         description: Prices updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelResponse'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:modelId/prices',
  protect,
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('UPDATE', 'ModelPrices'),
  modelController.updateModelPrices
);

/**
 * @swagger
 * /api/v1/models/{modelId}:
 *   delete:
 *     summary: Delete a model (SuperAdmin only)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       204:
 *         description: Model deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:modelId',
  protect,
  authorize('SUPERADMIN','SALES_EXECUTIVE'),
  logAction('DELETE', 'Model'),
  modelController.deleteModel
);

/**
 * @swagger
 * /api/v1/models:
 *   get:
 *     summary: Get all active models (filterable by customer type)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customerType
 *         schema:
 *           type: string
 *           enum: [B2B, B2C, CSD]
 *         description: |
 *           Filter models by customer type:
 *           - B2B/B2C will return EV and ICE models
 *           - CSD will return only CSD models
 *     responses:
 *       200:
 *         description: List of active models
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
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     models:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           model_name:
 *                             type: string
 *                           prices:
 *                             type: array
 *                           createdAt:
 *                             type: string
 *                           type:
 *                             type: string
 *                           id:
 *                             type: string
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  modelController.getAllModels
);

/**
 * @swagger
 * /api/v1/models/all/status:
 *   get:
 *     summary: Get all models with any status (Admin+)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all models
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
 *                     models:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Model'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get(
  '/all/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  modelController.getAllModelsStatus
);


/**
 * @swagger
 * /api/v1/models/{modelId}/with-prices:
 *   get:
 *     summary: Get a model with prices
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *     responses:
 *       200:
 *         description: Model with prices
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
 *                     model:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         model_name:
 *                           type: string
 *                         prices:
 *                           type: array
 *                         createdAt:
 *                           type: string
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:modelId/with-prices',
  protect,
  modelController.getModelWithPrices
);

/**
 * @swagger
 * /api/v1/models/{modelId}/details:
 *   get:
 *     summary: Get basic model details
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Model details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelResponse'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:modelId/details',
  protect,
  modelController.getModelDetails
);

/**
 * @swagger
 * /api/v1/models/cleanup:
 *   delete:
 *     summary: Clean up malformed models (SuperAdmin only)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Cleaned up 3 malformed models
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       500:
 *         description: Server error
 */
router.delete(
  '/cleanup',
  protect,
  authorize('SUPERADMIN','SALES_EXECUTIVE'),
  logAction('CLEANUP', 'Models'),
  modelController.cleanupModels
);

/**
 * @swagger
 * /api/v1/models/base-models:
 *   get:
 *     summary: Identify base models (lowest price in each series)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of base models
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
 *                     baseModels:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           series:
 *                             type: string
 *                           base_model_id:
 *                             type: string
 *                           base_model_name:
 *                             type: string
 *                           base_price:
 *                             type: number
 *                           other_models:
 *                             type: array
 *       404:
 *         description: Ex-Showroom header not found
 *       500:
 *         description: Server error
 */
router.get(
  '/base-models',
  protect,
  modelController.identifyBaseModels
);

/**
 * @swagger
 * /api/v1/models/base-model:
 *   post:
 *     summary: Get base model for selected models
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - modelIds
 *             properties:
 *               modelIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *     responses:
 *       200:
 *         description: Base model information
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
 *                     base_model_id:
 *                       type: string
 *                     base_model_name:
 *                       type: string
 *                     base_price:
 *                       type: number
 *                     series:
 *                       type: string
 *                     is_single_series:
 *                       type: boolean
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Ex-Showroom header not found
 *       500:
 *         description: Server error
 */
router.post(
  '/base-model',
  protect,
  modelController.getBaseModelForSelectedModels
);

/**
 * @swagger
 * /api/v1/models/{modelId}/status:
 *   put:
 *     summary: Update model status (Admin+)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
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
 *                 enum: [active, inactive]
 *                 example: inactive
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
 *                     model:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         model_name:
 *                           type: string
 *                         status:
 *                           type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:modelId/status',
  protect,
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'),
  logAction('UPDATE_STATUS', 'Model'),
  modelController.updateModelStatus
);

// Add this to modelRoutes.js
/**
 * @swagger
 * /api/v1/models/csd:
 *   get:
 *     summary: Get all active CSD models
 *     description: Retrieve all active Commercial Service Diesel (CSD) models with their prices
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *     responses:
 *       200:
 *         description: List of CSD models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     models:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           model_name:
 *                             type: string
 *                           prices:
 *                             type: array
 *                           createdAt:
 *                             type: string
 *                           type:
 *                             type: string
 *                           status:
 *                             type: string
 *       500:
 *         description: Server error
 */
router.get(
  '/csd',
  protect,
  modelController.getAllCSDModels
);
module.exports = router;