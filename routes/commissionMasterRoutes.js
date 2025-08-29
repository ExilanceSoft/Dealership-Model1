// routes/commissionMasterRoutes.js
const express = require('express');
const router = express.Router();
const commissionMasterController = require('../controllers/commissionMasterController');
const { protect } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');
const upload = require('../middlewares/upload');

/**
 * @swagger
 * tags:
 *   name: Commission Master
 *   description: Commission management for subdealers based on model headers
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CommissionRate:
 *       type: object
 *       required:
 *         - header_id
 *         - commission_rate
 *       properties:
 *         header_id:
 *           type: string
 *           description: ID of the header
 *           example: 507f1f77bcf86cd799439011
 *         commission_rate:
 *           type: number
 *           description: Commission rate percentage (0-100)
 *           example: 5.5
 *         is_active:
 *           type: boolean
 *           description: Whether this commission rate is active
 *           example: true
 *     CommissionMasterInput:
 *       type: object
 *       required:
 *         - subdealer_id
 *         - model_id
 *         - commission_rates
 *       properties:
 *         subdealer_id:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         model_id:
 *           type: string
 *           example: 507f1f77bcf86cd799439013
 *         commission_rates:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommissionRate'
 *     CommissionCalculationInput:
 *       type: object
 *       required:
 *         - subdealer_id
 *         - model_id
 *         - booking_details
 *       properties:
 *         subdealer_id:
 *           type: string
 *           example: 507f1f77bcf86cd799439012
 *         model_id:
 *           type: string
 *           example: 507f1f77bcf86cd799439013
 *         booking_details:
 *           type: object
 *           description: Key-value pairs of header keys and their values
 *           example:
 *             base_price: 100000
 *             registration_charges: 5000
 *             insurance: 10000
 */

// Commission Master CRUD Operations
/**
 * @swagger
 * /api/v1/commission-master:
 *   post:
 *     summary: Create or update commission master (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionMasterInput'
 *     responses:
 *       200:
 *         description: Commission master created/updated successfully
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
 *                     commission_master:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         subdealer_id:
 *                           type: string
 *                         model_id:
 *                           type: string
 *                         commission_rates:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/CommissionRate'
 *                         is_active:
 *                           type: boolean
 *                         created_by:
 *                           type: string
 *                         updated_by:
 *                           type: string
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                         subdealer_details:
 *                           type: object
 *                         model_details:
 *                           type: object
 *                         created_by_details:
 *                           type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subdealer or model not found
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('SUBDEALER_COMMISSION.CREATE'),
  logAction('CREATE_UPDATE', 'CommissionMaster'),
  commissionMasterController.createOrUpdateCommissionMaster
);
/**
 * @swagger
 * /api/v1/commission-master/{subdealer_id}/monthly-report:
 *   get:
 *     summary: Get monthly commission report for a subdealer
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Year for the report (e.g., 2025)
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month for the report (1–12)
 *     responses:
 *       200:
 *         description: Monthly commission report generated successfully
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
 *                     subdealer:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                     month:
 *                       type: integer
 *                     year:
 *                       type: integer
 *                     total_bookings:
 *                       type: integer
 *                     total_commission:
 *                       type: number
 *                     booking_commissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           booking_id:
 *                             type: string
 *                           booking_number:
 *                             type: string
 *                           model:
 *                             type: string
 *                           booking_date:
 *                             type: string
 *                             format: date-time
 *                           customer_name:
 *                             type: string
 *                           total_amount:
 *                             type: number
 *                           total_commission:
 *                             type: number
 *                           commission_breakdown:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 header:
 *                                   type: string
 *                                 base:
 *                                   type: number
 *                                 rate:
 *                                   type: number
 *                                 commission:
 *                                   type: number
 *       400:
 *         description: Missing or invalid parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/:subdealer_id/monthly-report',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionMasterController.getMonthlyCommissionReport
);
/**
 * @swagger
 * /api/v1/commission-master/subdealer/{subdealer_id}:
 *   get:
 *     summary: Get all commission masters for a subdealer (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
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
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of commission masters
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
 *                     commission_masters:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         pages:
 *                           type: number
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *       400:
 *         description: Invalid subdealer ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.get('/subdealer/:subdealer_id',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionMasterController.getCommissionMastersBySubdealer
);

/**
 * @swagger
 * /api/v1/commission-master/{subdealer_id}/{model_id}:
 *   get:
 *     summary: Get commission master for a subdealer and model (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
 *       - in: path
 *         name: model_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the model
 *     responses:
 *       200:
 *         description: Commission master details
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
 *                     commission_master:
 *                       type: object
 *       400:
 *         description: Invalid IDs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Commission master not found
 *       500:
 *         description: Server error
 */
router.get('/:subdealer_id/:model_id',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionMasterController.getCommissionMaster
);
/**
 * @swagger
 * /api/v1/commission-master/model/{model_id}:
 *   get:
 *     summary: Get all commission masters for a model (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: model_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the model
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
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of commission masters
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
 *                     commission_masters:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         pages:
 *                           type: number
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *       400:
 *         description: Invalid model ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/model/:model_id',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionMasterController.getCommissionMastersByModel
);

/**
 * @swagger
 * /api/v1/commission-master/{id}/status:
 *   patch:
 *     summary: Toggle commission master status (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the commission master
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Commission master status updated
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
 *                     commission_master:
 *                       type: object
 *       400:
 *         description: Invalid ID or status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Commission master not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status',
  protect,
  requirePermission('SUBDEALER_COMMISSION.UPDATE'),
  logAction('TOGGLE_STATUS', 'CommissionMaster'),
  commissionMasterController.toggleCommissionMasterStatus
);

/**
 * @swagger
 * /api/v1/commission-master/{id}:
 *   delete:
 *     summary: Delete a commission master (SuperAdmin only)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the commission master to delete
 *     responses:
 *       204:
 *         description: Commission master deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Commission master not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  requirePermission('SUBDEALER_COMMISSION.DELETE'),
  logAction('DELETE', 'CommissionMaster'),
  commissionMasterController.deleteCommissionMaster
);

// Header Management
/**
 * @swagger
 * /api/v1/commission-master/headers/{model_id}:
 *   get:
 *     summary: Get available headers for commission setup (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: model_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the model
 *     responses:
 *       200:
 *         description: List of available headers
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
 *                     headers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           header_key:
 *                             type: string
 *                           category_key:
 *                             type: string
 *                           priority:
 *                             type: number
 *                           is_mandatory:
 *                             type: boolean
 *                     model_type:
 *                       type: string
 *       400:
 *         description: Invalid model ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/headers/:model_id',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionMasterController.getAvailableHeaders
);

// Import/Export Operations
/**
 * @swagger
 * /api/v1/commission-master/export-template:
 *   get:
 *     summary: Export CSV template for commission setup (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subdealer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
 *       - in: query
 *         name: model_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [EV, ICE, CSD]
 *         description: Type of vehicles
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.get('/export-template',
  protect,
  requirePermission('SUBDEALER_COMMISSION.CREATE'),
  commissionMasterController.exportCommissionCSVTemplate
);

/**
 * @swagger
 * /api/v1/commission-master/import:
 *   post:
 *     summary: Import commission data from CSV (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
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
 *                 description: CSV file to upload
 *               subdealer_id:
 *                 type: string
 *                 description: ID of the subdealer
 *               model_type:
 *                 type: string
 *                 enum: [EV, ICE, CSD]
 *                 description: Type of vehicles in the CSV
 *     responses:
 *       200:
 *         description: CSV import results
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
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.post('/import',
  protect,
  requirePermission('SUBDEALER_COMMISSION.CREATE'),
  upload.single('file'),
  logAction('BULK_IMPORT', 'CommissionMaster'),
  commissionMasterController.importCommissionCSV
);


/**
 * @swagger
 * /api/v1/commission-master/subdealer/{subdealer_id}/commission-report:
 *   get:
 *     summary: Get commission report for a subdealer (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subdealer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering bookings (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering bookings (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Subdealer commission report
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
 *                     subdealer:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         location:
 *                           type: string
 *                         type:
 *                           type: string
 *                     period:
 *                       type: object
 *                       properties:
 *                         start_date:
 *                           type: string
 *                         end_date:
 *                           type: string
 *                     total_bookings:
 *                       type: number
 *                     total_commission:
 *                       type: number
 *                     booking_commissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           booking_id:
 *                             type: string
 *                           booking_number:
 *                             type: string
 *                           model:
 *                             type: string
 *                           booking_date:
 *                             type: string
 *                             format: date-time
 *                           customer_name:
 *                             type: string
 *                           total_amount:
 *                             type: number
 *                           total_commission:
 *                             type: number
 *                           commission_breakdown:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 header:
 *                                   type: string
 *                                 category:
 *                                   type: string
 *                                 component_value:
 *                                   type: number
 *                                 commission_rate:
 *                                   type: number
 *                                 commission_amount:
 *                                   type: number
 *       400:
 *         description: Invalid subdealer ID or date format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.get('/subdealer/:subdealer_id/commission-report',
  protect,
  requirePermission('SUBDEALER_COMMISSION.READ'),
  commissionMasterController.calculateSubdealerCommission
);

/**
 * @swagger
 * /api/v1/commission-master/{subdealer_id}/date-range-commission:
 *   put:
 *     summary: Set a commission date range for all rates of a subdealer (Admin+)
 *     tags: [Commission Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subdealer_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subdealer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromDate
 *               - toDate
 *             properties:
 *               fromDate:
 *                 type: string
 *                 format: date
 *                 description: Start date when commission becomes applicable
 *                 example: 2025-08-01
 *               toDate:
 *                 type: string
 *                 format: date
 *                 description: End date when commission expires
 *                 example: 2025-08-31
 *     responses:
 *       200:
 *         description: Commission date range set successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Subdealer not found
 *       500:
 *         description: Server error
 */
router.put('/:subdealer_id/date-range-commission',
  protect,
  requirePermission('SUBDEALER_COMMISSION.UPDATE'),
  logAction('DATE_RANGE_COMMISSION', 'CommissionMaster'),
  commissionMasterController.setCommissionDateRange
);

module.exports = router;