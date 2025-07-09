// routes/financeLetterRoutes.js
const express = require('express');
const router = express.Router();
const financeLetterController = require('../controllers/financeLetterController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * @swagger
 * tags:
 *   name: FinanceLetter
 *   description: Finance letter management
 */

/**
 * @swagger
 * /api/v1/finance-letter:
 *   get:
 *     summary: Get all finance letters with pagination (Admin only)
 *     tags: [FinanceLetter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of finance letters
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
 *                     $ref: '#/components/schemas/FinanceLetter'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN', 'MANAGER'),
  financeLetterController.getAllFinanceLetters
);

/**
 * @swagger
 * /api/v1/finance-letter/{bookingId}:
 *   get:
 *     summary: Get finance letter details for a booking
 *     tags: [FinanceLetter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Finance letter details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceLetterDetails'
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.get('/:bookingId', 
  protect, 
  financeLetterController.getFinanceLetterDetails
);

/**
 * @swagger
 * /api/v1/finance-letter/{bookingId}/submit:
 *   post:
 *     summary: Submit finance letter for a booking
 *     tags: [FinanceLetter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               financeLetter:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Finance letter submitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceLetterSubmission'
 *       400:
 *         description: Missing file or invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:bookingId/submit',
  protect,
  upload.single('financeLetter'),
  logAction('SUBMIT_FINANCE_LETTER', 'FINANCE_LETTER'),
  financeLetterController.submitFinanceLetter
);

/**
 * @swagger
 * /api/v1/finance-letter/{financeLetterId}/verify:
 *   post:
 *     summary: Verify finance letter (Admin only)
 *     tags: [FinanceLetter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: financeLetterId
 *         required: true
 *         schema:
 *           type: string
 *         description: Finance letter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinanceLetterVerification'
 *     responses:
 *       200:
 *         description: Verification status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceLetterVerificationResponse'
 *       400:
 *         description: Invalid status or ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Finance letter not found
 *       500:
 *         description: Server error
 */
router.post('/:financeLetterId/verify',
  protect,
  authorize('ADMIN', 'SUPERADMIN', 'MANAGER'),
  logAction('VERIFY_FINANCE_LETTER', 'FINANCE_LETTER'),
  financeLetterController.verifyFinanceLetter
);

/**
 * @swagger
 * /api/v1/finance-letter/{bookingId}/document:
 *   get:
 *     summary: Get finance letter document
 *     tags: [FinanceLetter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Finance letter document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinanceLetterDocument'
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get('/:bookingId/document',
  protect,
  financeLetterController.getFinanceLetterDocument
);

module.exports = router;