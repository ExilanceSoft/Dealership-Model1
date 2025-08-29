const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, hasPermission } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');
const { requirePermission } = require('../middlewares/requirePermission');

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
 *               - roleId
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
 *                 description: "Role ID for the user"
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
 *               totalDeviationAmount:
 *                 type: number
 *                 description: "Deviation amount for SALES_EXECUTIVE or MANAGER roles"
 *                 example: 1000
 *               perTransactionDeviationLimit:
 *                 type: number
 *                 description: "Per transaction deviation limit for SALES_EXECUTIVE or MANAGER roles"
 *                 example: 100
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
 *                     totalDeviationAmount:
 *                       type: number
 *                       description: "Total deviation amount"
 *                     perTransactionDeviationLimit:
 *                       type: number
 *                       description: "Per transaction deviation limit"
 *                     currentDeviationUsage:
 *                       type: number
 *                       description: "Current deviation usage"
 *                     directPermissions:
 *                       type: number
 *                       description: "Count of direct permissions assigned"
 *                     rolePermissions:
 *                       type: number
 *                       description: "Count of role permissions"
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