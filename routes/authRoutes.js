const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, hasPermission } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the user
 *         name:
 *           type: string
 *           description: The user's full name
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address
 *         mobile:
 *           type: string
 *           description: The user's mobile number
 *         discount:
 *           type: number
 *           description: Discount amount for SALES_EXECUTIVE users
 *           example: 100
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of role IDs assigned to the user
 *         branch:
 *           type: string
 *           description: The branch ID the user belongs to (mutually exclusive with subdealer)
 *         subdealer:
 *           type: string
 *           description: The subdealer ID the user belongs to (mutually exclusive with branch)
 *         branchDetails:
 *           $ref: '#/components/schemas/Branch'
 *         subdealerDetails:
 *           $ref: '#/components/schemas/Subdealer'
 *         status:
 *           type: string
 *           enum: [ACTIVE, FROZEN, EXTENDED, INACTIVE]
 *           description: Current status of the user account
 * 
 *     Branch:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 * 
 *     Subdealer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         location:
 *           type: string
 *         type:
 *           type: string
 *           enum: [B2B, B2C]
 *         discount:
 *           type: number
 * 
 *     UserUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Updated Name"
 *         email:
 *           type: string
 *           format: email
 *           example: "updated@example.com"
 *         mobile:
 *           type: string
 *           example: "9876543210"
 *         branch:
 *           type: string
 *           description: "Branch ID (mutually exclusive with subdealer, SuperAdmin only)"
 *           example: "60d21b4667d0d8992e610c86"
 *         subdealer:
 *           type: string
 *           description: "Subdealer ID (mutually exclusive with branch, SuperAdmin only)"
 *           example: "60d21b4667d0d8992e610c87"
 *         discount:
 *           type: number
 *           description: "Only for SALES_EXECUTIVE role"
 *           example: 15
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: "Permission IDs to assign (requires USER.MANAGE permission)"
 *           example: ["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"]
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and registration
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []  # No auth required for first registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - mobile
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               mobile:
 *                 type: string
 *                 pattern: '^[6-9]\d{9}$'
 *                 example: "9876543210"
 *               roleId:
 *                 type: string
 *                 description: "Required for subsequent registrations (not first user)"
 *                 example: "60d21b4667d0d8992e610c85"
 *               branch:
 *                 type: string
 *                 description: "Branch ID (mutually exclusive with subdealer)"
 *                 example: "60d21b4667d0d8992e610c86"
 *               subdealer:
 *                 type: string
 *                 description: "Subdealer ID (mutually exclusive with branch)"
 *                 example: "60d21b4667d0d8992e610c87"
 *               discount:
 *                 type: number
 *                 description: "Only for SALES_EXECUTIVE role"
 *                 example: 10
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: "Permission IDs to assign"
 *                 example: ["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"]
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User registered successfully. OTP sent for verification."
 *                 isSuperAdmin:
 *                   type: boolean
 *                   description: "True if this is the first user (SuperAdmin)"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     mobile:
 *                       type: string
 *                     role:
 *                       type: string
 *                     branch:
 *                       type: string
 *                       nullable: true
 *                     subdealer:
 *                       type: string
 *                       nullable: true
 *                     discount:
 *                       type: number
 *                       optional: true
 *                     permissions:
 *                       type: number
 *                       description: "Count of permissions assigned"
 *                       optional: true
 *       400:
 *         description: Validation error (invalid input, missing fields, both branch and subdealer provided, etc.)
 *       401:
 *         description: Unauthorized (missing or invalid token for subsequent registrations)
 *       403:
 *         description: Forbidden (insufficient permissions)
 *       500:
 *         description: Internal server error
 */
router.post('/register', authController.register);
router.get('/verify-token', authController.verifyToken);

/**
 * @swagger
 * /api/v1/auth/request-otp:
 *   post:
 *     summary: Request OTP for login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobile
 *             properties:
 *               mobile:
 *                 type: string
 *                 pattern: '^[6-9]\d{9}$'
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *       400:
 *         description: Invalid mobile number
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/request-otp', authController.requestOTP);

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobile
 *               - otp
 *             properties:
 *               mobile:
 *                 type: string
 *                 pattern: '^[6-9]\d{9}$'
 *                 example: "9876543210"
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: JWT token for authenticated requests
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     mobile:
 *                       type: string
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           isSuperAdmin:
 *                             type: boolean
 *                           is_active:
 *                             type: boolean
 *                           permissions:
 *                             type: array
 *                             items:
 *                               type: object
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           module:
 *                             type: string
 *                           action:
 *                             type: string
 *                           name:
 *                             type: string
 *       400:
 *         description: Invalid OTP or expired
 *       500:
 *         description: Server error
 */
router.post('/verify-otp', authController.verifyOTP);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/me', protect, logAction('READ', 'User'), authController.getMe);


module.exports = router;