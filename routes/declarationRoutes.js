const express = require('express');
const router = express.Router();
const declarationController = require('../controllers/declarationController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Declarations
 *   description: Declaration management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Declaration:
 *       type: object
 *       required:
 *         - title
 *         - content
 *         - formType
 *         - priority
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the declaration
 *           example: 507f1f77bcf86cd799439011
 *         title:
 *           type: string
 *           description: The declaration title
 *           example: Privacy Policy
 *         content:
 *           type: string
 *           description: The declaration content
 *           example: We respect your privacy...
 *         formType:
 *           type: string
 *           enum: [loan, account, kyc, other]
 *           description: The form type this declaration applies to
 *           example: loan
 *         priority:
 *           type: number
 *           description: Priority within the form type (unique per formType)
 *           example: 1
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Declaration status
 *           example: active
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the declaration
 *           example: 507f1f77bcf86cd799439012
 *         createdByDetails:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the declaration was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the declaration was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 *     DeclarationInput:
 *       type: object
 *       required:
 *         - title
 *         - content
 *         - formType
 *         - priority
 *       properties:
 *         title:
 *           type: string
 *           description: The declaration title
 *           example: Privacy Policy
 *         content:
 *           type: string
 *           description: The declaration content
 *           example: We respect your privacy...
 *         formType:
 *           type: string
 *           enum: [loan, account, kyc, other]
 *           description: The form type this declaration applies to
 *           example: loan
 *         priority:
 *           type: number
 *           description: Priority within the form type (must be unique per formType)
 *           example: 1
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Declaration status
 *           example: active
 *     DeclarationStatusInput:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Declaration status
 *           example: active
 */

/**
 * @swagger
 * /api/v1/declarations:
 *   post:
 *     summary: Create a new declaration (Admin+)
 *     tags: [Declarations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeclarationInput'
 *     responses:
 *       201:
 *         description: Declaration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Declaration'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('DECLARATION.CREATE'),
  logAction('CREATE', 'Declaration'),
  declarationController.createDeclaration
);

/**
 * @swagger
 * /api/v1/declarations:
 *   get:
 *     summary: Get all declarations (Admin+)
 *     tags: [Declarations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: formType
 *         schema:
 *           type: string
 *           enum: [loan, account, kyc, other]
 *         description: Filter declarations by form type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter declarations by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search declarations by title or content
 *     responses:
 *       200:
 *         description: List of declarations
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
 *                     declarations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Declaration'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  requirePermission('DECLARATION.READ'),
  declarationController.getAllDeclarations
);

/**
 * @swagger
 * /api/v1/declarations/{id}:
 *   get:
 *     summary: Get a specific declaration by ID (Admin+)
 *     tags: [Declarations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the declaration to get
 *     responses:
 *       200:
 *         description: Declaration details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Declaration'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Declaration not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  requirePermission('DECLARATION.READ'),
  declarationController.getDeclarationById
);

/**
 * @swagger
 * /api/v1/declarations/{id}:
 *   patch:
 *     summary: Update a declaration (Admin+)
 *     tags: [Declarations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the declaration to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeclarationInput'
 *     responses:
 *       200:
 *         description: Declaration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Declaration'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Declaration not found
 *       500:
 *         description: Server error
 */
router.patch('/:id',
  protect,
  requirePermission('DECLARATION.UPDATE'),
  logAction('UPDATE', 'Declaration'),
  declarationController.updateDeclaration
);

/**
 * @swagger
 * /api/v1/declarations/{id}/status:
 *   patch:
 *     summary: Update declaration status (Admin+)
 *     tags: [Declarations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the declaration to update status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeclarationStatusInput'
 *     responses:
 *       200:
 *         description: Declaration status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Declaration'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Declaration not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status',
  protect,
  requirePermission('DECLARATION.UPDATE'),
  logAction('UPDATE_STATUS', 'Declaration'),
  declarationController.updateDeclarationStatus
);

/**
 * @swagger
 * /api/v1/declarations/{id}:
 *   delete:
 *     summary: Delete a declaration (SuperAdmin only)
 *     tags: [Declarations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the declaration to delete
 *     responses:
 *       204:
 *         description: Declaration deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Declaration not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  requirePermission('DECLARATION.DELETE'),
  logAction('DELETE', 'Declaration'),
  declarationController.deleteDeclaration
);

module.exports = router;