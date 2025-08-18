const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insuranceController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requirePermission } = require('../middlewares/requirePermission');

// Configure multer for file uploads
const insuranceUploadPath = path.join(__dirname, '../uploads/insurance');
if (!fs.existsSync(insuranceUploadPath)) {
  fs.mkdirSync(insuranceUploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, insuranceUploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * @swagger
 * tags:
 *   name: Insurance
 *   description: Insurance management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Insurance:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the insurance
 *         booking:
 *           type: string
 *           description: Reference to the booking
 *         insuranceProvider:
 *           type: string
 *           description: Reference to the insurance provider
 *         policyNumber:
 *           type: string
 *           description: Insurance policy number
 *         rsaPolicyNumber:
 *           type: string
 *           description: RSA policy number
 *         cmsPolicyNumber:
 *           type: string
 *           description: CMS policy number
 *         documents:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: ['POLICY', 'RECEIPT', 'FORM', 'OTHER']
 *         status:
 *           type: string
 *           enum: ['PENDING', 'COMPLETED', 'LATER']
 *           description: Insurance status
 *         remarks:
 *           type: string
 *           description: Additional remarks
 *         createdBy:
 *           type: string
 *           description: User who created the insurance
 *         updatedBy:
 *           type: string
 *           description: User who last updated the insurance
 *         approvedBy:
 *           type: string
 *           description: User who approved the insurance
 *         approvalDate:
 *           type: string
 *           format: date-time
 *           description: Date of approval
 *       required:
 *         - booking
 *         - insuranceProvider
 *         - policyNumber
 */

// Insurance CRUD routes
router.route('/')
  /**
   * @swagger
   * /api/v1/insurance:
   *   get:
   *     summary: Get all insurances
   *     tags: [Insurance]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of all insurances
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
   *                     $ref: '#/components/schemas/Insurance'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       500:
   *         description: Server error
   */
  .get(
    protect,
    requirePermission('INSURANCE.READ'),
    insuranceController.getAllInsurances
  )
  
  /**
   * @swagger
   * /api/v1/insurance:
   *   post:
   *     summary: Create a new insurance
   *     description: >
   *       Creates a new insurance record.  
   *       **If the status is set to `COMPLETED`, the associated booking's `insuranceStatus` will automatically be updated to `COMPLETED`.**  
   *       Otherwise, the booking's insurance status will remain unchanged.
   *     tags: [Insurance]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               booking:
   *                 type: string
   *               insuranceProvider:
   *                 type: string
   *               policyNumber:
   *                 type: string
   *               rsaPolicyNumber:
   *                 type: string
   *               cmsPolicyNumber:
   *                 type: string
   *               status:
   *                 type: string
   *                 enum: ['PENDING', 'COMPLETED', 'LATER']
   *               remarks:
   *                 type: string
   *               document:
   *                 type: string
   *                 format: binary
   *               document1:
   *                 type: string
   *                 format: binary
   *               document2:
   *                 type: string
   *                 format: binary
   *             required:
   *               - booking
   *               - insuranceProvider
   *               - policyNumber
   *     responses:
   *       201:
   *         description: Insurance created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Insurance'
   *       400:
   *         description: Bad Request
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  .post(
    protect,
    requirePermission('INSURANCE.CREATE'),
    upload.fields([
      { name: 'document', maxCount: 1 },
      { name: 'document1', maxCount: 1 },
      { name: 'document2', maxCount: 1 }
    ]),
    logAction('CREATE', 'Insurance'),
    insuranceController.createInsurance
  );

/**
 * @swagger
 * /api/v1/insurance/status/{status}:
 *   get:
 *     summary: Get insurances by status
 *     description: Retrieve a list of insurance records filtered by status.
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, LATER]
 *         description: Status of the insurance
 *     responses:
 *       200:
 *         description: List of insurances with the specified status
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
 *                     $ref: '#/components/schemas/Insurance'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: No insurances found with the given status
 *       500:
 *         description: Server error
 */
router.get(
  '/status/:status',
  protect,
  requirePermission('INSURANCE.READ'),
  logAction('READ', 'Insurance'),
  insuranceController.getInsuranceByStatus
);

router.route('/:id')
  /**
   * @swagger
   * /api/v1/insurance/{id}:
   *   get:
   *     summary: Get insurance by ID
   *     tags: [Insurance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Insurance ID
   *     responses:
   *       200:
   *         description: Insurance details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Insurance'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Insurance not found
   *       500:
   *         description: Server error
   */
  .get(
    protect,
    requirePermission('INSURANCE.READ'),
    logAction('READ', 'Insurance'),
    insuranceController.getInsuranceById
  )
  /**
   * @swagger
   * /api/v1/insurance/{id}:
   *   put:
   *     summary: Update insurance
   *     description: >
   *       Updates an existing insurance record.  
   *       **If the status is changed to `COMPLETED`, the associated booking's `insuranceStatus` will automatically be updated to `COMPLETED`.**  
   *       Otherwise, the booking's insurance status will remain unchanged.
   *     tags: [Insurance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Insurance ID
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: ['PENDING', 'COMPLETED', 'LATER']
   *               policyNumber:
   *                 type: string
   *               rsaPolicyNumber:
   *                 type: string
   *               cmsPolicyNumber:
   *                 type: string
   *               remarks:
   *                 type: string
   *               document:
   *                 type: string
   *                 format: binary
   *               document1:
   *                 type: string
   *                 format: binary
   *               document2:
   *                 type: string
   *                 format: binary
   *     responses:
   *       200:
   *         description: Insurance updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Insurance'
   *       400:
   *         description: Bad Request
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Insurance not found
   *       500:
   *         description: Server error
   */
  .put(
    protect,
    requirePermission('INSURANCE.UPDATE'),
    upload.fields([
      { name: 'document', maxCount: 1 },
      { name: 'document1', maxCount: 1 },
      { name: 'document2', maxCount: 1 }
    ]),
    logAction('UPDATE', 'Insurance'),
    insuranceController.updateInsurance
  )
  /**
   * @swagger
   * /api/v1/insurance/{id}:
   *   delete:
   *     summary: Delete insurance
   *     tags: [Insurance]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Insurance ID
   *     responses:
   *       200:
   *         description: Insurance deleted successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Insurance not found
   *       500:
   *         description: Server error
   */
  .delete(
    protect,
    requirePermission('INSURANCE.DELETE'),
    logAction('DELETE', 'Insurance'),
    insuranceController.deleteInsurance
  );

/**
 * @swagger
 * /api/v1/insurance/booking/{bookingId}:
 *   put:
 *     summary: Update insurance by booking ID
 *     description: >
 *       Updates insurance record associated with a specific booking.
 *       **If status is changed to COMPLETED, documents are required.**
 *     tags: [Insurance]
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
 *               status:
 *                 type: string
 *                 enum: ['PENDING', 'COMPLETED', 'LATER']
 *               policyNumber:
 *                 type: string
 *               rsaPolicyNumber:
 *                 type: string
 *               cmsPolicyNumber:
 *                 type: string
 *               remarks:
 *                 type: string
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Policy document
 *               document1:
 *                 type: string
 *                 format: binary
 *                 description: Receipt document
 *               document2:
 *                 type: string
 *                 format: binary
 *                 description: Other document
 *     responses:
 *       200:
 *         description: Insurance updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Insurance'
 *       400:
 *         description: Bad request (missing documents for COMPLETED status)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Insurance or booking not found
 *       500:
 *         description: Server error
 */
router.put(
  '/booking/:bookingId',
  protect,
  requirePermission('INSURANCE.UPDATE'),
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'document1', maxCount: 1 },
    { name: 'document2', maxCount: 1 }
  ]),
  logAction('UPDATE', 'Insurance'),
  insuranceController.updateInsuranceByBookingId
);

module.exports = router;