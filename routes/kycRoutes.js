const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');

// // Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 5MB limit per file
  },
})
//   fileFilter: (req, file, cb) => {
//     const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
//     if (allowedMimes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'), false);
//     }
//   }
// });

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
 *     summary: Get complete KYC details for a booking
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
 *         description: Complete KYC details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KYCDetails'
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
  logAction('VIEW_KYC_DETAILS', 'KYC'),
  kycController.getKYCDetails
);

/**
 * @swagger
 * /api/v1/kyc/{bookingId}/submit:
 *   post:
 *     summary: Submit or resubmit KYC documents for a booking
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
 *                     submissionDate:
 *                       type: string
 *                       format: date-time
 *                     isResubmission:
 *                       type: boolean
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
 *                     verificationDate:
 *                       type: string
 *                       format: date-time
 *                     bookingStatus:
 *                       type: string
 *       400:
 *         description: Invalid status or KYC ID, or KYC already processed
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
 *     summary: Get all KYC documents for a booking
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
 *         description: All KYC documents
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KYCDocuments'
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
  logAction('VIEW_KYC_DOCUMENTS', 'KYC'),
  kycController.getKYCDocuments
);

/**
 * @swagger
 * /api/v1/kyc/{kycId}:
 *   delete:
 *     summary: Delete KYC (Admin only)
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
 *     responses:
 *       200:
 *         description: KYC deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid KYC ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin)
 *       404:
 *         description: KYC not found
 *       500:
 *         description: Server error
 */
router.delete('/:kycId',
  protect,
  authorize('ADMIN', 'SUPERADMIN', 'MANAGER'),
  logAction('DELETE_KYC', 'KYC'),
  kycController.deleteKYC
);

module.exports = router;