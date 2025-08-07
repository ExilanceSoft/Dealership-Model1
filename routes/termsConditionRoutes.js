const express = require('express');
const router = express.Router();
const termsConditionController = require('../controllers/termsConditionController');
const { protect, authorize } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Terms & Conditions
 *   description: Terms and conditions management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TermsCondition:
 *       type: object
 *       required:
 *         - title
 *         - content
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *           example: 507f1f77bcf86cd799439011
 *         title:
 *           type: string
 *           description: Title of the term/condition
 *           example: Privacy Policy
 *         content:
 *           type: string
 *           description: Detailed content
 *           example: We respect your privacy and are committed to protecting it...
 *         order:
 *           type: integer
 *           description: Display order
 *           example: 1
 *         isActive:
 *           type: boolean
 *           description: Whether the term is active
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

/**
 * @swagger
 * /api/v1/terms-conditions:
 *   get:
 *     summary: Get all terms and conditions
 *     tags: [Terms & Conditions]
 *     responses:
 *       200:
 *         description: List of terms and conditions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TermsCondition'
 *       500:
 *         description: Server error
 */
router.get('/', termsConditionController.getTermsConditions);

/**
 * @swagger
 * /api/v1/terms-conditions/{id}:
 *   get:
 *     summary: Get a single term/condition by ID
 *     tags: [Terms & Conditions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Term/Condition ID
 *     responses:
 *       200:
 *         description: Term/Condition details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TermsCondition'
 *       500:
 *         description: Server error
 */
router.get('/:id', termsConditionController.getTermsCondition);

/**
 * @swagger
 * /api/v1/terms-conditions:
 *   post:
 *     summary: Create a new term/condition (Admin only)
 *     tags: [Terms & Conditions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TermsCondition'
 *           example:
 *             title: "Privacy Policy"
 *             content: "We respect your privacy..."
 *             order: 1
 *             isActive: true
 *     responses:
 *       201:
 *         description: Term/Condition created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TermsCondition'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  authorize('ADMIN'),
  termsConditionController.createTermsCondition
);

/**
 * @swagger
 * /api/v1/terms-conditions/{id}:
 *   put:
 *     summary: Update a term/condition (Admin only)
 *     tags: [Terms & Conditions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Term/Condition ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TermsCondition'
 *     responses:
 *       200:
 *         description: Term/Condition updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TermsCondition'
 *       400:
 *         description: Invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin)
 *       404:
 *         description: Term/Condition not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  authorize('ADMIN'),
  termsConditionController.updateTermsCondition
);

/**
 * @swagger
 * /api/v1/terms-conditions/{id}:
 *   delete:
 *     summary: Delete a term/condition (Admin only)
 *     tags: [Terms & Conditions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Term/Condition ID
 *     responses:
 *       200:
 *         description: Term/Condition deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin)
 *       404:
 *         description: Term/Condition not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  authorize('ADMIN','SALES_EXECUTIVE'),
  termsConditionController.deleteTermsCondition
);

module.exports = router;