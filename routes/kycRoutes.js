// routes/kycRoutes.js
const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  }
});

/**
 * @swagger
 * tags:
 *   name: KYC
 *   description: KYC document management
 */

/**
 * @swagger
 * /api/v1/kyc/{bookingId}:
 *   get:
 *     summary: Get KYC details for a booking
 *     tags: [KYC]
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
 *         description: KYC details
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
 *                     address:
 *                       type: string
 *                     kycStatus:
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
  kycController.getKYCDetails
);

/**
 * @swagger
 * /api/v1/kyc/{bookingId}/submit:
 *   post:
 *     summary: Submit KYC documents for a booking
 *     tags: [KYC]
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
 *               aadharFront:
 *                 type: string
 *                 format: binary
 *               aadharBack:
 *                 type: string
 *                 format: binary
 *               panCard:
 *                 type: string
 *                 format: binary
 *               vPhoto:
 *                 type: string
 *                 format: binary
 *               chasisNoPhoto:
 *                 type: string
 *                 format: binary
 *               addressProof1:
 *                 type: string
 *                 format: binary
 *               addressProof2:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: KYC submitted successfully
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
 *                     kycId:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Missing required documents or invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Server error
 */
router.post('/:bookingId/submit',
  protect,
  upload.fields([
    { name: 'aadharFront', maxCount: 1 },
    { name: 'aadharBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'vPhoto', maxCount: 1 },
    { name: 'chasisNoPhoto', maxCount: 1 },
    { name: 'addressProof1', maxCount: 1 },
    { name: 'addressProof2', maxCount: 1 }
  ]),
  logAction('SUBMIT_KYC', 'KYC'),
  kycController.submitKYC
);

/**
 * @swagger
 * /api/v1/kyc/{kycId}/verify:
 *   post:
 *     summary: Verify KYC documents (Admin only)
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: kycId
 *         required: true
 *         schema:
 *           type: string
 *         description: KYC ID
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
 *         description: KYC verification status updated
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
 *         description: Invalid status or KYC ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin)
 *       404:
 *         description: KYC not found
 *       500:
 *         description: Server error
 */
router.post('/:kycId/verify',
  protect,
  authorize('ADMIN', 'SUPERADMIN', 'MANAGER'),
  logAction('VERIFY_KYC', 'KYC'),
  kycController.verifyKYC
);

/**
 * @swagger
 * /api/v1/kyc/{bookingId}/documents:
 *   get:
 *     summary: Get KYC documents for a booking
 *     tags: [KYC]
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
 *         description: KYC documents
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
 *                     aadharFront:
 *                       type: string
 *                     aadharBack:
 *                       type: string
 *                     panCard:
 *                       type: string
 *                     vPhoto:
 *                       type: string
 *                     chasisNoPhoto:
 *                       type: string
 *                     addressProof1:
 *                       type: string
 *                     addressProof2:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Invalid booking ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: KYC not found
 *       500:
 *         description: Server error
 */
router.get('/:bookingId/documents',
  protect,
  kycController.getKYCDocuments
);

module.exports = router;