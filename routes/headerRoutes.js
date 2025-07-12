const express = require('express');
const router = express.Router();
const headerController = require('../controllers/headerController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Headers
 *   description: Header management endpoints
 */

/**
 * @swagger
 * /api/v1/headers:
 *   post:
 *     summary: Create a new header
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Header'
 *           example:
 *             category_key: "engine"
 *             type: "EV"
 *             header_key: "battery_capacity"
 *             priority: 1
 *             is_mandatory: true
 *             is_discount: false
 *             metadata: { unit: "kWh" }
 *     responses:
 *       201:
 *         description: Header created successfully
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
 *                     header_id:
 *                       type: string
 *                     type:
 *                       type: string
 *                     category_key:
 *                       type: string
 *                     header_key:
 *                       type: string
 *                     priority:
 *                       type: integer
 *                     is_mandatory:
 *                       type: boolean
 *                     is_discount:
 *                       type: boolean
 *       400:
 *         description: Invalid input or duplicate header
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', protect, headerController.createHeader);

/**
 * @swagger
 * /api/v1/headers:
 *   get:
 *     summary: Get all headers with optional filtering
 *     tags: [Headers]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EV, ICE, CSD]
 *         description: Filter by header type
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by field (priority)
 *       - in: query
 *         name: grouped
 *         schema:
 *           type: boolean
 *         description: Return grouped by category
 *     responses:
 *       200:
 *         description: List of headers
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
 *                     headers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Header'
 *       500:
 *         description: Server error
 */
router.get('/', headerController.getAllHeaders);

/**
 * @swagger
 * /api/v1/headers/bulk-priorities:
 *   patch:
 *     summary: Update multiple header priorities
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - type
 *                 - header_key
 *                 - priority
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [EV, ICE, CSD]
 *                 header_key:
 *                   type: string
 *                 priority:
 *                   type: integer
 *                   minimum: 1
 *           example:
 *             - type: "EV"
 *               header_key: "battery_capacity"
 *               priority: 2
 *             - type: "ICE"
 *               header_key: "engine_cc"
 *               priority: 1
 *     responses:
 *       200:
 *         description: Priorities updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 updated:
 *                   type: integer
 *                 notFound:
 *                   type: integer
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch('/bulk-priorities', protect, headerController.updateHeaderPriorities);

/**
 * @swagger
 * /api/v1/headers/id/{id}:
 *   get:
 *     summary: Get header by ID
 *     tags: [Headers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Header ID
 *     responses:
 *       200:
 *         description: Header details
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
 *                     header:
 *                       $ref: '#/components/schemas/Header'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Header not found
 *       500:
 *         description: Server error
 */
router.get('/id/:id', headerController.getHeaderById);

/**
 * @swagger
 * /api/v1/headers/{id}:
 *   patch:
 *     summary: Update a header
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Header ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Header'
 *           example:
 *             priority: 3
 *             is_mandatory: false
 *     responses:
 *       200:
 *         description: Header updated successfully
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
 *                     header:
 *                       $ref: '#/components/schemas/Header'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Header not found
 *       500:
 *         description: Server error
 */
router.patch('/:id', protect, headerController.updateHeader);

/**
 * @swagger
 * /api/v1/headers/{id}:
 *   delete:
 *     summary: Delete a header
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Header ID
 *     responses:
 *       204:
 *         description: Header deleted successfully
 *       400:
 *         description: Header is referenced by models
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Header not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, headerController.deleteHeader);

module.exports = router;