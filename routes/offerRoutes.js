const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

/**
 * @swagger
 * tags:
 *   name: Offers
 *   description: Special offers and promotions management
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
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the offer
 *           example: 507f1f77bcf86cd799439011
 *         title:
 *           type: string
 *           description: Title of the offer
 *           example: Summer Special Discount
 *         description:
 *           type: string
 *           description: Detailed description of the offer
 *           example: Get 10% off on all EV models this summer
 *         url:
 *           type: string
 *           description: Optional URL for more details
 *           example: https://example.com/summer-sale
 *         image:
 *           type: string
 *           description: Path to offer image
 *           example: /uploads/offers/offer-12345.jpg
 *         isActive:
 *           type: boolean
 *           description: Whether the offer is currently active
 *           example: true
 *         applyToAllModels:
 *           type: boolean
 *           description: Whether the offer applies to all models
 *           example: false
 *         applicableModels:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ModelReference'
 *           description: List of models this offer applies to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 * 
 *     ModelReference:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Model ID
 *         model_name:
 *           type: string
 *           description: Model name
 */

/**
 * @swagger
 * /api/v1/offers:
 *   post:
 *     summary: Create a new offer (Admin only)
 *     tags: [Offers]
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
 *               description:
 *                 type: string
 *               url:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               isActive:
 *                 type: boolean
 *               applyToAllModels:
 *                 type: boolean
 *               applicableModels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Offer created successfully
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
 *                     offer:
 *                       $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Missing required fields or invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  authorize('ADMIN'),
  upload.single('image'),
  offerController.createOffer
);

/**
 * @swagger
 * /api/v1/offers:
 *   get:
 *     summary: Get all offers with filtering and pagination
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search text in title and description
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by field (prefix with - for descending)
 *         example: -createdAt
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
router.get('/', offerController.getAllOffers);

/**
 * @swagger
 * /api/v1/offers/{id}:
 *   get:
 *     summary: Get a single offer by ID
 *     tags: [Offers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Offer ID
 *       - in: query
 *         name: populate
 *         schema:
 *           type: boolean
 *         description: Whether to populate applicable models
 *     responses:
 *       200:
 *         description: Offer details
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
 *                     offer:
 *                       $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Offer not found
 *       500:
 *         description: Server error
 */
router.get('/:id', offerController.getOfferById);

/**
 * @swagger
 * /api/v1/offers/{id}:
 *   put:
 *     summary: Update an offer (Admin only)
 *     tags: [Offers]
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
 *         description: Offer ID
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
 *               url:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               isActive:
 *                 type: boolean
 *               applyToAllModels:
 *                 type: boolean
 *               applicableModels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Offer updated successfully
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
 *                     offer:
 *                       $ref: '#/components/schemas/Offer'
 *       400:
 *         description: Invalid ID format or data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin)
 *       404:
 *         description: Offer not found
 *       500:
 *         description: Server error
 */
router.put('/:id',
  protect,
  authorize('ADMIN'),
  upload.single('image'),
  offerController.updateOffer
);

/**
 * @swagger
 * /api/v1/offers/{id}:
 *   delete:
 *     summary: Delete an offer (Admin only)
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Offer ID
 *     responses:
 *       204:
 *         description: Offer deleted successfully
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin)
 *       404:
 *         description: Offer not found
 *       500:
 *         description: Server error
 */
router.delete('/:id',
  protect,
  authorize('ADMIN'),
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
 *         description: Model ID
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
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid model ID format
 *       404:
 *         description: Model not found
 *       500:
 *         description: Server error
 */
router.get('/model/:modelId', offerController.getOffersForModel);

module.exports = router;