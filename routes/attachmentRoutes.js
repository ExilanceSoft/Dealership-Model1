const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachmentController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Attachments
 *   description: API endpoints for managing attachments (images, videos, documents, etc.)
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Attachment:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *           example: 507f1f77bcf86cd799439011
 *         title:
 *           type: string
 *           description: Attachment title
 *           example: Product Catalog
 *         description:
 *           type: string
 *           description: Optional description
 *           example: Summer 2023 collection
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AttachmentItem'
 *         isForAllModels:
 *           type: boolean
 *           default: true
 *         applicableModels:
 *           type: array
 *           items:
 *             type: string
 *           description: Model IDs this attachment applies to
 *         createdBy:
 *           type: string
 *           description: User ID who created this
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     AttachmentItem:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [image, video, youtube, document, text]
 *         url:
 *           type: string
 *         content:
 *           type: string
 *         thumbnail:
 *           type: string
 *     AttachmentInput:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         isForAllModels:
 *           type: boolean
 *         applicableModels:
 *           type: array
 *           items:
 *             type: string
 *         youtubeUrls:
 *           type: array
 *           items:
 *             type: string
 *         textContents:
 *           type: array
 *           items:
 *             type: string
 *     WhatsAppShareRequest:
 *       type: object
 *       required:
 *         - quotationId
 *         - phoneNumber
 *       properties:
 *         quotationId:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         attachmentIds:
 *           type: array
 *           items:
 *             type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         error:
 *           type: string
 */

/**
 * @swagger
 * /api/v1/attachments:
 *   post:
 *     summary: Create a new attachment (Admin only)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Product Images
 *               description:
 *                 type: string
 *                 example: High quality product images
 *               isForAllModels:
 *                 type: boolean
 *                 example: true
 *               applicableModels:
 *                 type: string
 *                 description: JSON string array of model IDs
 *                 example: '["modelId1", "modelId2"]'
 *               youtubeUrls:
 *                 type: string
 *                 description: JSON string array of YouTube URLs
 *                 example: '["https://youtube.com/watch?v=abc123"]'
 *               textContents:
 *                 type: string
 *                 description: JSON string array of text contents
 *                 example: '["Important product details"]'
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               videos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Attachment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin access required)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('ATTACHMENTS.CREATE'),
  logAction('CREATE', 'Attachment'),
  attachmentController.uploadAttachmentFile,
  attachmentController.createAttachment
);

/**
 * @swagger
 * /api/v1/attachments:
 *   get:
 *     summary: Get all attachments
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all attachments
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
 *                     attachments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  requirePermission('ATTACHMENTS.READ'),
  attachmentController.getAllAttachments
);

/**
 * @swagger
 * /api/v1/attachments/model/{modelId}:
 *   get:
 *     summary: Get attachments for specific model
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Model ID to filter attachments
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: List of attachments for the model
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
 *                     attachments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/model/:modelId',
  protect,
  requirePermission('ATTACHMENTS.READ'),
  attachmentController.getAttachmentsForModel
);

/**
 * @swagger
 * /api/v1/attachments/{id}:
 *   get:
 *     summary: Get single attachment by ID
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Attachment data
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
 *                     attachment:
 *                       $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  requirePermission('ATTACHMENTS.READ'),
  attachmentController.getAttachmentById
);

/**
 * @swagger
 * /api/v1/attachments/{id}:
 *   put:
 *     summary: Update an attachment (Admin only)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment ID to update
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated Product Images
 *               description:
 *                 type: string
 *                 example: Updated product images
 *               isForAllModels:
 *                 type: boolean
 *                 example: false
 *               applicableModels:
 *                 type: string
 *                 description: JSON string array of model IDs
 *                 example: '["modelId1", "modelId2"]'
 *               youtubeUrls:
 *                 type: string
 *                 description: JSON string array of YouTube URLs
 *                 example: '["https://youtube.com/watch?v=abc123"]'
 *               textContents:
 *                 type: string
 *                 description: JSON string array of text contents
 *                 example: '["Updated product details"]'
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               videos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Updated attachment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin access required)
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  requirePermission('ATTACHMENTS.UPDATE'),
  logAction('UPDATE', 'Attachment'),
  attachmentController.uploadAttachmentFile,
  attachmentController.updateAttachment
);

/**
 * @swagger
 * /api/v1/attachments/{id}:
 *   delete:
 *     summary: Delete an attachment (SuperAdmin only)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment ID to delete
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       204:
 *         description: Attachment deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (SuperAdmin access required)
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  requirePermission('ATTACHMENTS.DELETE'),
  logAction('DELETE', 'Attachment'),
  attachmentController.deleteAttachment
);

/**
 * @swagger
 * /api/v1/attachments/whatsapp/{id}:
 *   get:
 *     summary: Generate WhatsApp share data for quotation
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: WhatsApp share data
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
 *                     pdfUrl:
 *                       type: string
 *                     attachments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           items:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/AttachmentItem'
 *                     numbers:
 *                       type: array
 *                       items:
 *                         type: string
 *                     quotationNumber:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.get('/whatsapp/:id',
  protect,
  requirePermission('ATTACHMENTS.READ'),
  attachmentController.generateWhatsAppLink
);

/**
 * @swagger
 * /api/v1/attachments/whatsapp/share:
 *   post:
 *     summary: Share quotation via WhatsApp
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WhatsAppShareRequest'
 *     responses:
 *       200:
 *         description: WhatsApp message sent
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
 *                     messageId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.post('/whatsapp/share',
  protect,
  requirePermission('ATTACHMENTS.CREATE'),
  attachmentController.shareOnWhatsApp
);

module.exports = router;