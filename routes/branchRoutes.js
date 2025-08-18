const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const multer = require('multer');
// const validateSalesExecutive  = require('../middlewares/validateSalesExecutive');
// const bookingController = require('../controllers/bookingController');
const { requirePermission } = require('../middlewares/requirePermission');


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

/**
 * @swagger
 * tags:
 *   name: Branches
 *   description: Branch management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Branch:
 *       type: object
 *       required:
 *         - name
 *         - address
 *         - city
 *         - state
 *         - pincode
 *         - phone
 *         - email
 *         - gst_number
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the branch
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: The branch name
 *           example: Mumbai Central Branch
 *         address:
 *           type: string
 *           description: The branch address
 *           example: 123 Main Street
 *         city:
 *           type: string
 *           description: The branch city
 *           example: Mumbai
 *         state:
 *           type: string
 *           description: The branch state
 *           example: Maharashtra
 *         pincode:
 *           type: string
 *           description: The branch pincode (6 digits)
 *           example: "400001"
 *         phone:
 *           type: string
 *           description: The branch phone number (10 digits starting with 6-9)
 *           example: "9876543210"
 *         email:
 *           type: string
 *           format: email
 *           description: The branch email
 *           example: mumbai@dealership.com
 *         gst_number:
 *           type: string
 *           description: The branch GST number
 *           example: "22ABCDE1234F1Z5"
 *         logo1:
 *           type: string
 *           description: URL to the first logo image
 *           example: "/uploads/branches/507f1f77bcf86cd799439011/logo1.png"
 *         logo2:
 *           type: string
 *           description: URL to the second logo image
 *           example: "/uploads/branches/507f1f77bcf86cd799439011/logo2.png"
 *         is_active:
 *           type: boolean
 *           description: Whether the branch is active
 *           example: true
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the branch
 *           example: 507f1f77bcf86cd799439012
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the branch was created
 *           example: "2023-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the branch was last updated
 *           example: "2023-01-01T00:00:00.000Z"
 */

/**
 * @swagger
 * /api/v1/branches:
 *   post:
 *     summary: Create a new branch (SuperAdmin only)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               gst_number:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               logo1:
 *                 type: string
 *                 format: binary
 *               logo2:
 *                 type: string
 *                 format: binary
 *             required:
 *               - name
 *               - address
 *               - city
 *               - state
 *               - pincode
 *               - phone
 *               - email
 *               - gst_number
 *     responses:
 *       201:
 *         description: Branch created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       400:
 *         description: Validation error or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       500:
 *         description: Server error
 */
router.post('/',
  protect,
  requirePermission('BRANCH.CREATE'),
  upload.fields([{ name: 'logo1', maxCount: 1 }, { name: 'logo2', maxCount: 1 }]),
  logAction('CREATE', 'Branch'), 
  branchController.createBranch
);

/**
 * @swagger
 * /api/v1/branches:
 *   get:
 *     summary: Get all branches (Admin+)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter branches by status (optional)
 *     responses:
 *       200:
 *         description: List of branches
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Branch'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get('/', 
  protect, 
  requirePermission('BRANCH.READ'), 
  branchController.getBranches
);

/**
 * @swagger
 * /api/v1/branches/{id}:
 *   get:
 *     summary: Get branch by ID (Admin+)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Branch details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.get('/:id', 
  protect, 
  requirePermission('BRANCH.READ'), 
  branchController.getBranch
);

/**
 * @swagger
 * /api/v1/branches/{id}:
 *   put:
 *     summary: Update branch (SuperAdmin only)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               gst_number:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               logo1:
 *                 type: string
 *                 format: binary
 *               logo2:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Branch updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.put('/:id', 
  protect, 
  requirePermission('BRANCH.UPDATE'), 
  upload.fields([{ name: 'logo1', maxCount: 1 }, { name: 'logo2', maxCount: 1 }]),
  logAction('UPDATE', 'Branch'), 
  branchController.updateBranch
);

/**
 * @swagger
 * /api/v1/branches/{id}/status:
 *   patch:
 *     summary: Update branch activation status (SuperAdmin only)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 description: New activation status
 *             required:
 *               - is_active
 *     responses:
 *       200:
 *         description: Branch status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       400:
 *         description: Invalid request body or status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status', 
  protect, 
  requirePermission('BRANCH.UPDATE'), 
  logAction('UPDATE', 'Branch'), 
  branchController.updateBranchStatus
);

/**
 * @swagger
 * /api/v1/branches/{id}:
 *   delete:
 *     summary: Permanently delete a branch (SuperAdmin only)
 *     description: >
 *       WARNING: This will permanently delete the branch.
 *       Branch can only be deleted if it has no users assigned (active or inactive).
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     responses:
 *       200:
 *         description: Branch deleted permanently
 *       400:
 *         description: Cannot delete branch with assigned users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', 
  protect, 
  requirePermission('BRANCH.DELETE'), 
  logAction('DELETE', 'Branch'), 
  branchController.deleteBranch
);
/**
 * @swagger
 * /api/v1/branches/{id}/opening-balance:
 *   post:
 *     summary: Add opening balance to a branch (SuperAdmin only)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Opening balance amount
 *                 example: 10000
 *               note:
 *                 type: string
 *                 description: Optional note about the balance
 *                 example: "Initial opening balance"
 *             required:
 *               - amount
 *     responses:
 *       201:
 *         description: Opening balance added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       400:
 *         description: Invalid amount or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.post('/:id/opening-balance', 
  protect, 
  requirePermission('BRANCH.CREATE'), 
  logAction('CREATE', 'Branch Opening Balance'), 
  branchController.addOpeningBalance
);

/**
 * @swagger
 * /api/v1/branches/{id}/opening-balance:
 *   patch:
 *     summary: Update branch opening balance (SuperAdmin only)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: New opening balance amount
 *                 example: 15000
 *               note:
 *                 type: string
 *                 description: Optional note about the update
 *                 example: "Updated opening balance"
 *             required:
 *               - amount
 *     responses:
 *       200:
 *         description: Opening balance updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       400:
 *         description: Invalid amount or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/opening-balance', 
  protect, 
  requirePermission('BRANCH.UPDATE'), 
  logAction('UPDATE', 'Branch Opening Balance'), 
  branchController.updateOpeningBalance
);

/**
 * @swagger
 * /api/v1/branches/{id}/opening-balance:
 *   delete:
 *     summary: Reset branch opening balance to zero (SuperAdmin only)
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 description: Optional note about the reset
 *                 example: "Reset opening balance"
 *     responses:
 *       200:
 *         description: Opening balance reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Branch'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not SuperAdmin)
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.delete('/:id/opening-balance', 
  protect, 
  requirePermission('BRANCH.DELETE'), 
  logAction('DELETE', 'Branch Opening Balance'), 
  branchController.resetOpeningBalance
);

module.exports = router;