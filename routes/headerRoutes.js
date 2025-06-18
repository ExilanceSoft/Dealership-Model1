const express = require('express');
const router = express.Router();
const headerController = require('../controllers/headerController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Headers
 *   description: Header management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Header:
 *       type: object
 *       required:
 *         - type
 *         - category_key
 *         - header_key
 *         - priority
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *           description: The auto-generated MongoDB ID
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           example: EV
 *           description: Header type (EV or ICE)
 *         category_key:
 *           type: string
 *           example: pricing
 *           description: Category identifier
 *         header_key:
 *           type: string
 *           example: ex_showroom_price
 *           description: Unique key for the header
 *         priority:
 *           type: number
 *           example: 1
 *           minimum: 1
 *           description: Display priority (lower numbers show first)
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           example: { displayName: "Ex-Showroom Price", unit: "INR" }
 *         createdAt:
 *           type: string
 *           format: date-time
 * 
 *     HeaderInput:
 *       type: object
 *       required:
 *         - type
 *         - category_key
 *         - header_key
 *         - priority
 *       properties:
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           example: EV
 *         category_key:
 *           type: string
 *           example: pricing
 *         header_key:
 *           type: string
 *           example: ex_showroom_price
 *         priority:
 *           type: number
 *           example: 1
 *           minimum: 1
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           example: { displayName: "Ex-Showroom Price", unit: "INR" }
 * 
 *     HeaderUpdate:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [EV, ICE]
 *           example: ICE
 *         category_key:
 *           type: string
 *           example: pricing_updated
 *         header_key:
 *           type: string
 *           example: ex_showroom_price_updated
 *         priority:
 *           type: number
 *           example: 2
 *           minimum: 1
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           example: { displayName: "Updated Price", unit: "USD" }
 * 
 *     HeaderResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: object
 *           properties:
 *             header:
 *               $ref: '#/components/schemas/Header'
 */

/**
 * @swagger
 * /api/v1/headers:
 *   post:
 *     summary: Create a new header (Admin+)
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HeaderInput'
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
 *                   example: success
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
 *                       type: number
 *       400:
 *         description: Validation error or priority conflict
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
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('CREATE', 'Header'),
  headerController.createHeader
);

/**
 * @swagger
 * /api/v1/headers/{id}:
 *   get:
 *     summary: Get a header by ID
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Header details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HeaderResponse'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Header not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  protect,
  headerController.getHeaderById
);

/**
 * @swagger
 * /api/v1/headers/{id}:
 *   put:
 *     summary: Update a header (Admin+)
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HeaderUpdate'
 *     responses:
 *       200:
 *         description: Header updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HeaderResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Header not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'Header'),
  headerController.updateHeader
);

/**
 * @swagger
 * /api/v1/headers/priorities:
 *   put:
 *     summary: Update multiple header priorities (Admin+)
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
 *                   enum: [EV, ICE]
 *                   example: EV
 *                 header_key:
 *                   type: string
 *                   example: ex_showroom_price
 *                 priority:
 *                   type: number
 *                   example: 1
 *                   minimum: 1
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
 *                   example: success
 *                 message:
 *                   type: string
 *                 updated:
 *                   type: number
 *                   example: 3
 *                 notFound:
 *                   type: number
 *                   example: 0
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.put(
  '/priorities',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'HeaderPriorities'),
  headerController.updateHeaderPriorities
);

/**
 * @swagger
 * /api/v1/headers/{id}:
 *   delete:
 *     summary: Delete a header (SuperAdmin only)
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       204:
 *         description: Header deleted successfully
 *       400:
 *         description: Header is referenced by models
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Header not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'Header'),
  headerController.deleteHeader
);

/**
 * @swagger
 * /api/v1/headers/type/{type}:
 *   get:
 *     summary: Get headers by type
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [EV, ICE]
 *         example: EV
 *       - in: query
 *         name: category_key
 *         schema:
 *           type: string
 *         description: Filter by category key
 *       - in: query
 *         name: grouped
 *         schema:
 *           type: boolean
 *         description: Return grouped by category if true
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [priority]
 *         description: Sort by priority if specified
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
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     headers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Header'
 *       400:
 *         description: Invalid type
 *       500:
 *         description: Server error
 */
router.get(
  '/type/:type',
  protect,
  headerController.getHeadersByType
);

/**
 * @swagger
 * /api/v1/headers:
 *   get:
 *     summary: Get all headers
 *     tags: [Headers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EV, ICE]
 *         description: Filter by header type
 *       - in: query
 *         name: grouped
 *         schema:
 *           type: boolean
 *         description: Return grouped by type and category if true
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [priority]
 *         description: Sort by priority if specified
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
 *                   example: success
 *                 results:
 *                   type: number
 *                   example: 10
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
router.get(
  '/',
  protect,
  headerController.getAllHeaders
);

module.exports = router;