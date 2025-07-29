const express = require("express");
const router = express.Router();
const rtoController = require("../controllers/rtoProcess");
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

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
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('CREATE', 'RtoProcess'),
  rtoController.createRtoProcess
);

/**
 * @swagger
 * /api/v1/rtoProcess/with-application-numbers:
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
router.get('/with-application-numbers', rtoController.getRtoProcessesWithApplicationNumbers);


/**
 * @swagger
 * /api/v1/rtoProcess/with-rtotax:
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
router.get('/with-rtotax', rtoController.getRtoProcessesWithRtoTaxCompleted);

/**
 * @swagger
 * /api/v1/rtoProcess/with-rtopaper:
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
router.get('/with-rtopaper', rtoController.getRtoProcessesWithRtoPaperStatus);


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
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
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
  authorize('SUPERADMIN', 'ADMIN', 'SALES_EXECUTIVE'),
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
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'RtoProcess'),
  rtoController.updateRtoProcess
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
  authorize('SUPERADMIN'),
  logAction('DELETE', 'RtoProcess'),
  rtoController.deleteRtoProcess
);

module.exports = router;
