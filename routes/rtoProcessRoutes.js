const express = require("express");
const router = express.Router();
const rtoController = require("../controllers/rtoProcess");
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: RTO Processes
 *   description: RTO process management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RtoProcess:
 *       type: object
 *       required:
 *         - bookingId
 *         - applicationNumber
 *         - createdBy
 *       properties:
 *         id:
 *           type: string
 *         bookingId:
 *           type: string
 *         applicationNumber:
 *           type: string
 *         rtoStatus:
 *           type: string
 *           enum: ['pending', 'completed']
 *         rtoPaperStatus:
 *           type: string
 *           enum: ['Not Submitted', 'Submitted', 'Verified', 'Rejected']
 *         rtoAmount:
 *           type: number
 *         numberPlate:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         rtoPendingTaxStatus:
 *           type: string
 *           enum: ['Paid', 'Unpaid', 'N/A']
 *         hsrbOrdering:
 *           type: boolean
 *         hsrbInstallation:
 *           type: boolean
 *         rcConfirmation:
 *           type: boolean
 *         rtoNumber:
 *           type: string
 *         rtoDate:
 *           type: string
 *           format: date-time
 *         rtoProcess:
 *           type: boolean
 *         createdBy:
 *           type: string
 *         updatedBy:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     RtoProcessInput:
 *       type: object
 *       required:
 *         - bookingId
 *         - applicationNumber
 *         - createdBy
 *       properties:
 *         bookingId:
 *           type: string
 *         applicationNumber:
 *           type: string
 *         rtoAmount:
 *           type: number
 *         numberPlate:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         rtoPendingTaxStatus:
 *           type: string
 *           enum: ['Paid', 'Unpaid', 'N/A']
 *         hsrbOrdering:
 *           type: boolean
 *         hsrbInstallation:
 *           type: boolean
 *         rcConfirmation:
 *           type: boolean
 *         rtoNumber:
 *           type: string
 *         createdBy:
 *           type: string
 *         updatedBy:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/rtoProcess:
 *   post:
 *     summary: Create a new RTO process (Admin+)
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RtoProcessInput'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RtoProcess'
 */
router.post(
  "/",
  protect,
  requirePermission('RTO_PROCESS.CREATE'),
  logAction('CREATE', 'RtoProcess'),
  rtoController.createRtoProcess
);

/**
 * @swagger
 * /api/v1/rtoProcess/application-numbers:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/application-numbers',
  protect,
  requirePermission('RTO_PROCESS.READ'),
  rtoController.getRtoProcessesWithApplicationNumbers);


/**
 * @swagger
 * /api/v1/rtoProcess/rtotaxpending:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/rtotaxpending',
  protect,
  requirePermission('RTO_PROCESS.READ'),
   rtoController.getRtoProcessesWithRtoTaxPending);

/**
 * @swagger
 * /api/v1/rtoProcess/stats:
 *   get:
 *     summary: Get total, monthly, and daily counts for all RTO process steps
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Counts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalApplications:
 *                       $ref: '#/components/schemas/StatBlock'
 *                     rtoPaperVerify:
 *                       $ref: '#/components/schemas/StatBlock'
 *                     rtoTaxVerify:
 *                       $ref: '#/components/schemas/StatBlock'
 *                     rtoTaxUpdate:
 *                       $ref: '#/components/schemas/StatBlock'
 *                     hsrpOrdering:
 *                       $ref: '#/components/schemas/StatBlock'
 *                     hsrpInstallation:
 *                       $ref: '#/components/schemas/StatBlock'
 *                     rcConfirmation:
 *                       $ref: '#/components/schemas/StatBlock'
 */
router.get('/stats',
  protect,
  requirePermission('RTO_PROCESS.READ'),
  rtoController.getRtoProcessStats);

/**
 * @swagger
 * /api/v1/rtoProcess/rtotaxcompleted:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/rtotaxcompleted',
  protect,
  requirePermission('RTO_PROCESS.READ'),
   rtoController.getRtoProcessesWithRtoTaxCompleted);

/**
 * @swagger
 * /api/v1/rtoProcess/rtopaperapproved:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/rtopaperapproved',
  protect,
  requirePermission('RTO_PROCESS.READ'),
   rtoController.getRtoProcessesWithRtoPaperStatus);

/**
 * @swagger
 * /api/v1/rtoProcess/rtopaperspending:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/rtopaperspending',
  protect,
  requirePermission('RTO_PROCESS.READ'),
  rtoController.getRtoProcessesWithRtoPaperStatusAsNotSubmitted);

/**
 * @swagger
 * /api/v1/rtoProcess/hsrpordered:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/hsrpordered', 
  protect,
  requirePermission('RTO_PROCESS.READ'),
  rtoController.getRtoProcessesWithHsrpOrderedStatus);

/**
 * @swagger
 * /api/v1/rtoProcess/hsrpinstallation:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/hsrpinstallation',
  protect,
  requirePermission('RTO_PROCESS.READ'),
  rtoController.getRtoProcessesWithHsrpInstallationStatus);

/**
 * @swagger
 * /api/v1/rtoProcess/hsrporderedpending:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/hsrporderedpending',
  protect,
  requirePermission('RTO_PROCESS.READ'),
   rtoController.getRtoProcessesWithHsrpOrderedStatusIsfalse);


/**
 * @swagger
 * /api/v1/rtoProcess/rcpending:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/rcpending',
  protect,
  requirePermission('RTO_PROCESS.READ'),
   rtoController.getRtoProcessesWithRcConfirmationStatusIsfalse);

/**
 * @swagger
 * /api/v1/rtoProcess/rccompleted:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/rccompleted',
  protect,
  requirePermission('RTO_PROCESS.READ'),
   rtoController.getRtoProcessesWithRcConfirmationStatus);


/**
 * @swagger
 * /api/v1/rtoProcess/hsrpinstallationpending:
 *   get:
 *     summary: Get RTO processes with application numbers
 *     tags: [RTO Processes]
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get('/hsrpinstallationpending',
  protect,
  requirePermission('RTO_PROCESS.READ'),
   rtoController.getRtoProcessesWithHsrpInstallationStatusIsfalse);


/**
 * @swagger
 * /api/v1/rtoProcess:
 *   get:
 *     summary: Get all RTO processes
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rtoStatus
 *         schema:
 *           type: string
 *           enum: ['pending', 'completed']
 *       - in: query
 *         name: rtoPaperStatus
 *         schema:
 *           type: string
 *           enum: ['Not Submitted', 'Submitted', 'Verified', 'Rejected']
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 */
router.get(
  "/",
  protect,
  requirePermission('RTO_PROCESS.READ'),
  rtoController.getAllRtoProcesses
);

/**
 * @swagger
 * /api/v1/rtoProcess/{id}:
 *   get:
 *     summary: Get RTO process by ID
 *     tags: [RTO Processes]
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
 *         description: Found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RtoProcess'
 */
router.get(
  "/:id",
  protect,
  requirePermission('RTO_PROCESS.READ'),
  rtoController.getRtoProcessById
);

/**
 * @swagger
 * /api/v1/rtoProcess/{id}:
 *   patch:
 *     summary: Update an RTO process
 *     tags: [RTO Processes]
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
 *             properties:
 *               rtoStatus:
 *                 type: string
 *                 enum: ['pending', 'completed']
 *               rtoPaperStatus:
 *                 type: string
 *                 enum: ['Not Submitted', 'Submitted', 'Verified', 'Rejected']
 *               numberPlate:
 *                 type: string
 *               receiptNumber:
 *                 type: string
 *               rtoPendingTaxStatus:
 *                 type: string
 *                 enum: ['Paid', 'Unpaid', 'N/A']
 *               hsrbOrdering:
 *                 type: boolean
 *               hsrbInstallation:
 *                 type: boolean
 *               rcConfirmation:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RtoProcess'
 */
router.patch(
  "/:id",
  protect,
  requirePermission('RTO_PROCESS.UPDATE'),
  logAction('UPDATE', 'RtoProcess'),
  rtoController.updateRtoProcess
);

/**
 * @swagger
 * /api/v1/rtoProcess/update-rto-details:
 *   put:
 *     summary: Update RTO details for multiple RTO IDs (bulk update)
 *     tags: [RTO Processes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - rtoId
 *                     - rtoAmount
 *                     - numberPlate
 *                     - receiptNumber
 *                   properties:
 *                     rtoId:
 *                       type: string
 *                       description: RTO Process ID
 *                       example: "64f9e9f9a1b2c3d4e5f6a7b8"
 *                     rtoAmount:
 *                       type: number
 *                       example: 2500
 *                     numberPlate:
 *                       type: string
 *                       example: "MH12AB1234"
 *                     receiptNumber:
 *                       type: string
 *                       example: "RCPT2025-789"
 *     responses:
 *       200:
 *         description: RTO records updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 updated:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RtoProcess'
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.put(
  '/update-rto-details',
  protect,
  requirePermission('RTO_PROCESS.UPDATE'),
  logAction('BULK_UPDATE', 'RtoProcess'),
  rtoController.updateMultipleRtoProcessesTaxDetails
);



/**
 * @swagger
 * /api/v1/rtoProcess/{id}:
 *   delete:
 *     summary: Delete RTO process
 *     tags: [RTO Processes]
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
 *         description: Deleted
 */
router.delete(
  "/:id",
  protect,
  requirePermission('RTO_PROCESS.DELETE'),
  logAction('DELETE', 'RtoProcess'),
  rtoController.deleteRtoProcess
);

module.exports = router;
