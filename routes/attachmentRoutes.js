const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachmentController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');

// Use the same upload configuration as in the controller
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/attachments');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `attch-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
  { name: 'documents', maxCount: 5 }
]);

/**
 * @swagger
 * /api/v1/attachments:
 *   post:
 *     summary: Create a new attachment (Admin+)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title of the attachment
 *               description:
 *                 type: string
 *                 description: Description of the attachment
 *               isForAllModels:
 *                 type: string
 *                 description: 'Whether the attachment applies to all models (send as "true" or "false")'
 *               applicableModels:
 *                 type: string
 *                 description: 'Must be a JSON string array like ["modelId1","modelId2"]'
 *               youtubeUrls:
 *                 type: string
 *                 description: 'Must be a JSON string array like ["url1","url2"]'
 *               textContents:
 *                 type: string
 *                 description: 'Must be a JSON string array like ["text1","text2"]'
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (max 10)
 *               videos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Video files (max 5)
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Document files (max 5)
 *     responses:
 *       201:
 *         description: Attachment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: Invalid file type or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('CREATE', 'Attachment'),
  (req, res, next) => {
    // Ensure the fields are properly formatted before passing to controller
    try {
      if (req.body.applicableModels && typeof req.body.applicableModels === 'string') {
        req.body.applicableModels = JSON.parse(req.body.applicableModels);
      }
      if (req.body.youtubeUrls && typeof req.body.youtubeUrls === 'string') {
        req.body.youtubeUrls = JSON.parse(req.body.youtubeUrls);
      }
      if (req.body.textContents && typeof req.body.textContents === 'string') {
        req.body.textContents = JSON.parse(req.body.textContents);
      }
      next();
    } catch (err) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid JSON format in one of the fields'
      });
    }
  },
  attachmentController.uploadAttachmentFile,
  attachmentController.createAttachment
);
/**
 * @swagger
 * /api/v1/attachments:
 *   get:
 *     summary: Get all attachments (Admin+)
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     attachments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  attachmentController.getAllAttachments
);

/**
 * @swagger
 * /api/v1/attachments/{id}:
 *   get:
 *     summary: Get attachment by ID (Admin+)
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
 *     responses:
 *       200:
 *         description: Attachment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     attachment:
 *                       $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  attachmentController.getAttachmentById
);

/**
 * @swagger
 * /api/v1/attachments/model/{modelId}:
 *   get:
 *     summary: Get attachments for a specific model (Admin+)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Model ID
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     attachments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/model/:modelId',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  attachmentController.getAttachmentsForModel
);

/**
 * @swagger
 * /api/v1/attachments/{id}:
 *   put:
 *     summary: Update an attachment (Admin+)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               isForAllModels:
 *                 type: boolean
 *               applicableModels:
 *                 type: string
 *                 description: JSON string array of model IDs
 *               youtubeUrls:
 *                 type: string
 *                 description: JSON string array of YouTube URLs
 *               textContents:
 *                 type: string
 *                 description: JSON string array of text contents
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
 *         description: Attachment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     attachment:
 *                       $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: Invalid input or file upload failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('UPDATE', 'Attachment'),
  attachmentController.uploadAttachmentFile,
  attachmentController.updateAttachment
);

/**
 * @swagger
 * /api/v1/attachments/{id}:
 *   delete:
 *     summary: Delete an attachment (Admin+)
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
 *     responses:
 *       204:
 *         description: Attachment deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  logAction('DELETE', 'Attachment'),
  attachmentController.deleteAttachment
);

module.exports = router;