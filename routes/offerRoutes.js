const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: Offers
 *   description: Offer management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Offer:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - offerLanguage
 *         - priority
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the offer
 *           example: 507f1f77bcf86cd799439011
 *         title:
 *           type: string
 *           description: The offer title
 *           example: Summer Special Discount
 *         description:
 *           type: string
 *           description: Detailed offer description
 *           example: Get 20% off on all models this summer
 *         image:
 *           type: string
 *           description: Path to offer image
 *           example: /uploads/offers/summer-special.jpg
 *         url:
 *           type: string
 *           description: Optional URL for the offer
 *           example: https://example.com/summer-sale
 *         isActive:
 *           type: boolean
 *           description: Whether the offer is currently active
 *           default: true
 *         applyToAllModels:
 *           type: boolean
 *           description: Whether the offer applies to all models
 *           default: false
 *         applicableModels:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of model IDs this offer applies to
 *         offerLanguage:
 *           type: string
 *           enum: [English, Marathi]
 *           description: offerLanguage of the offer
 *           example: English
 *         priority:
 *           type: integer
 *           minimum: 1
 *           description: Priority number for ordering offers
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the offer was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the offer was last updated
 *     OfferInput:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - offerLanguage
 *         - priority
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         image:
 *           type: string
 *           format: binary
 *         url:
 *           type: string
 *         isActive:
 *           type: boolean
 *         applyToAllModels:
 *           type: boolean
 *         applicableModels:
 *           type: array
 *           items:
 *             type: string
 *           description: JSON string array of model IDs
 *         offerLanguage:
 *           type: string
 *           enum: [English, Marathi]
 *         priority:
 *           type: integer
 *           minimum: 1
 */

/**
 * @swagger
 * /api/v1/offers:
 *   post:
 *     summary: Create a new offer (Admin+)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/OfferInput'
 *     responses:
 *       201:
 *         description: Offer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('CREATE', 'Offer'),
  offerController.uploadOfferImage,
  offerController.createOffer
);

/**
 * @swagger
 * /api/v1/offers:
 *   get:
 *     summary: Get all offers
 *     tags: [Offers]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: applyToAllModels
 *         schema:
 *           type: boolean
 *         description: Filter by whether offer applies to all models
 *       - in: query
 *         name: offerLanguage
 *         schema:
 *           type: string
 *           enum: [English, Marathi]
 *         description: Filter by offerLanguage
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search offers by title or description
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by field (prefix with - for descending)
 *         example: -priority,-createdAt
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Limit number of results
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of offers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     offers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Offer'
 *       500:
 *         description: Server error
 */
router.get('/',
  offerController.getAllOffers
);

/**
 * @swagger
 * /api/v1/offers/{id}:
 *   get:
 *     summary: Get a specific offer by ID
 *     tags: [Offers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the offer to get
 *       - in: query
 *         name: populate
 *         schema:
 *           type: boolean
 *         description: Whether to populate applicableModels
 *     responses:
 *       200:
 *         description: Offer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Offer not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  offerController.getOfferById
);

/**
 * @swagger
 * /api/v1/offers/{id}:
 *   put:
 *     summary: Update an offer (Admin+)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the offer to update
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/OfferInput'
 *     responses:
 *       200:
 *         description: Offer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Offer not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN'),
  logAction('UPDATE', 'Offer'),
  offerController.uploadOfferImage,
  offerController.updateOffer
);

/**
 * @swagger
 * /api/v1/offers/{id}:
 *   delete:
 *     summary: Delete an offer (SuperAdmin only)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the offer to delete
 *     responses:
 *       204:
 *         description: Offer deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Offer not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  authorize('SUPERADMIN'),
  logAction('DELETE', 'Offer'),
  offerController.deleteOffer
);

/**
 * @swagger
 * /api/v1/offers/model/{modelId}:
 *   get:
 *     summary: Get active offers for a specific model
 *     tags: [Offers]
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the model to get offers for
 *     responses:
 *       200:
 *         description: List of active offers for the model
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     offers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Invalid model ID format
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/model/:modelId',
  offerController.getOffersForModel
);

module.exports = router;