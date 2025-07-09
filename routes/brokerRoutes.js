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
 *         description: Field to sort by (createdAt, updatedAt)
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       bookingId:
 *                         type: string
 *                       bookingReference:
 *                         type: string
 *                       vehicle:
 *                         type: string
 *                       customerName:
 *                         type: string
 *                       status:
 *                         type: string
 *                       verifiedBy:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       verificationNote:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin)
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     customerName:
 *                       type: string
 *                     financeLetterStatus:
 *                       type: string
 *                       enum: [NOT_SUBMITTED, PENDING, APPROVED, REJECTED]
 *                     verificationNote:
 *                       type: string
 *                     verifiedBy:
 *                       type: string
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
 *         description: Finance letter submitted successfully
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
 *                     financeLetterId:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Missing finance letter or invalid booking ID
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
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               verificationNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Finance letter verification status updated
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
 *                     status:
 *                       type: string
 *                     verifiedBy:
 *                       type: string
 *                     verificationNote:
 *                       type: string
 *       400:
 *         description: Invalid status or finance letter ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin)
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
 *     summary: Get finance letter document for a booking
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentPath:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Finance letter not found
 *       500:
 *         description: Server error
 */
router.get('/:bookingId/document',
  protect,
  financeLetterController.getFinanceLetterDocument
);

module.exports = router;