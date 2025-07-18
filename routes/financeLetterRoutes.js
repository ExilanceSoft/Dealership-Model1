// routes/financeLetterRoutes.js
const express = require('express');
const router = express.Router();
const financeLetterController = require('../controllers/financeLetterController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit per file
  },
});

/**
 * @swagger
 * tags:
 *   name: Finance Letters
 *   description: Finance letter management
 */

/**
 * @swagger
 * /api/v1/finance-letters/{bookingId}:
 *   get:
 *     summary: Get finance letter details by booking ID
 *     tags: [Finance Letters]
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
 *               $ref: '#/components/schemas/FinanceLetter'
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Finance letter not found
 *       500:
 *         description: Server error
 */
router.get('/:bookingId', 
  protect,
  logAction('VIEW_FINANCE_LETTER', 'FINANCE_LETTER'),
  financeLetterController.getFinanceLetterByBooking
);

/**
 * @swagger
 * /api/v1/finance-letters/{bookingId}/submit:
 *   post:
 *     summary: Submit or resubmit finance letter for a booking
 *     tags: [Finance Letters]
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
 *                 description: PDF file of the finance letter
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
 *                     documentUrl:
 *                       type: string
 *                     submissionDate:
 *                       type: string
 *                       format: date-time
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
 * /api/v1/finance-letters/{bookingId}/verify:
 *   post:
 *     summary: Verify finance letter (Admin/Manager only)
 *     tags: [Finance Letters]
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 example: APPROVED
 *               verificationNote:
 *                 type: string
 *                 description: Reason for approval/rejection
 *                 example: "Document meets all requirements"
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
 *                     financeLetterId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     verifiedBy:
 *                       type: string
 *                     verificationNote:
 *                       type: string
 *                     verificationDate:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid status or finance letter already processed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin/manager)
 *       404:
 *         description: Booking or finance letter not found
 *       500:
 *         description: Server error
 */
router.post('/:bookingId/verify',
  protect,
  authorize('ADMIN', 'MANAGER'),
  logAction('VERIFY_FINANCE_LETTER', 'FINANCE_LETTER'),
  financeLetterController.verifyFinanceLetterByBooking
);

/**
 * @swagger
 * /api/v1/finance-letters/{bookingId}/status:
 *   get:
 *     summary: Get finance letter status by booking ID
 *     tags: [Finance Letters]
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
 *         description: Current finance letter status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookingId:
 *                   type: string
 *                 customerName:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [PENDING, APPROVED, REJECTED]
 *                 documentUrl:
 *                   type: string
 *                 verificationNote:
 *                   type: string
 *                 verifiedBy:
 *                   type: string
 *                 verificationDate:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking or finance letter not found
 *       500:
 *         description: Server error
 */
router.get('/:bookingId/status',
  protect,
  logAction('VIEW_FINANCE_LETTER_STATUS', 'FINANCE_LETTER'),
  financeLetterController.getFinanceLetterStatusByBooking
);

/**
 * @swagger
 * /api/v1/finance-letters/{bookingId}/download:
 *   get:
 *     summary: View or download finance letter
 *     tags: [Finance Letters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: query
 *         name: download
 *         schema:
 *           type: boolean
 *         description: Set to true to force download
 *     responses:
 *       200:
 *         description: Finance letter file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Finance letter not found
 *       500:
 *         description: Server error
 */
router.get('/:bookingId/download',
  protect,
  logAction('DOWNLOAD_FINANCE_LETTER', 'FINANCE_LETTER'),
  financeLetterController.downloadFinanceLetter
);

module.exports = router;