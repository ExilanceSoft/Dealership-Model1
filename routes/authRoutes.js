const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, hasPermission } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

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
 *     description: |
 *       - Open endpoint for first user registration (creates SuperAdmin)
 *       - Requires authentication for subsequent registrations
 *       - SuperAdmin can register any role
 *       - Other users need CAN_REGISTER_USERS permission
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Role ID (required for non-first registrations)
 *                 example: "507f1f77bcf86cd799439011"
 *               branch:
 *                 type: string
 *                 description: Branch ID (required for non-SuperAdmin users)
 *                 example: "507f1f77bcf86cd799439012"
 *               discount:
 *                 type: number
 *                 description: Discount amount (only for SALES_EXECUTIVE role)
 *                 example: 100
 *     responses:
 *       201:
 *         description: User registered successfully, OTP sent
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
 *                   example: "OTP sent to mobile for verification"
 *                 isSuperAdmin:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     mobile:
 *                       type: string
 *                     role:
 *                       type: string
 *                     discount:
 *                       type: number
 *       400:
 *         description: Validation error or trying to set discount for non-SALES_EXECUTIVE
 *       401:
 *         description: Unauthorized (for non-first registrations)
 *       403:
 *         description: Forbidden (missing permissions)
 *       500:
 *         description: Server error
 */
router.post('/register', authController.register);

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