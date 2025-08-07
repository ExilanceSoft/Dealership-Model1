const express = require('express');
const router = express.Router();
const financeDocumentController = require('../controllers/financeDocumentController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Finance Documents
 *   description: Financial document management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FinanceDocument:
 *       type: object
 *       required:
 *         - name
 *         - content
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the document
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: Document name/title
 *           example: Loan Agreement
 *         content:
 *           type: string
 *           description: Document content or description
 *           example: Terms and conditions for vehicle loan
 *         isActive:
 *           type: boolean
 *           description: Whether the document is active
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
 * /api/v1/finance-documents:
 *   get:
 *     summary: Get all finance documents
 *     tags: [Finance Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of finance documents
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
 *                     $ref: '#/components/schemas/FinanceDocument'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', 
  protect, 
  financeDocumentController.getFinanceDocuments
);

/**
 * @swagger
 * /api/v1/finance-documents/{id}:
 *   get:
 *     summary: Get a single finance document by ID
 *     tags: [Finance Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance document ID
 *     responses:
 *       200:
 *         description: Finance document details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FinanceDocument'
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get('/:id', 
  protect, 
  financeDocumentController.getFinanceDocument
);

/**
 * @swagger
 * /api/v1/finance-documents:
 *   post:
 *     summary: Create a new finance document
 *     tags: [Finance Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinanceDocument'
 *           example:
 *             name: "Loan Agreement"
 *             content: "Terms and conditions for vehicle loan"
 *             isActive: true
 *     responses:
 *       201:
 *         description: Finance document created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FinanceDocument'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect, 
  financeDocumentController.createFinanceDocument
);

/**
 * @swagger
 * /api/v1/finance-documents/{id}:
 *   put:
 *     summary: Update a finance document
 *     tags: [Finance Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinanceDocument'
 *           example:
 *             name: "Updated Loan Agreement"
 *             content: "Updated terms and conditions"
 *     responses:
 *       200:
 *         description: Finance document updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FinanceDocument'
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.put('/:id', 
  protect, 
  financeDocumentController.updateFinanceDocument
);

/**
 * @swagger
 * /api/v1/finance-documents/{id}:
 *   delete:
 *     summary: Delete a finance document
 *     tags: [Finance Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance document ID
 *     responses:
 *       200:
 *         description: Finance document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', 
  protect, 
  financeDocumentController.deleteFinanceDocument
);

module.exports = router;