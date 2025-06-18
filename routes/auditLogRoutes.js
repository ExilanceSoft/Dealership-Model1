const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { protect, authorize } = require('../middlewares/auth');
const { getAuditLogsValidator } = require('../validators/auditLogValidator');

/**
 * @swagger
 * tags:
 *   name: Audit Logs
 *   description: System audit log management
 */

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: Get all audit logs (Admin+)
 *     description: Retrieve system audit logs with optional filtering and pagination
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [CREATE, READ, UPDATE, DELETE, ASSIGN]
 *         description: Filter by action type
 *       - in: query
 *         name: entity
 *         schema:
 *           type: string
 *         description: Filter by entity type (e.g., "User", "Role")
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID who performed the action
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "-createdAt"
 *         description: Sort field and direction (prefix with - for descending)
 *     responses:
 *       200:
 *         description: List of audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Validation error in query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  getAuditLogsValidator,
  auditLogController.getAuditLogs
);

/**
 * @swagger
 * /api/v1/audit-logs/{id}:
 *   get:
 *     summary: Get audit log by ID (Admin+)
 *     description: Retrieve details of a specific audit log entry
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit log entry ID
 *     responses:
 *       200:
 *         description: Audit log details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AuditLog'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin+)
 *       404:
 *         description: Audit log not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  protect,
  authorize('ADMIN', 'SUPERADMIN'),
  auditLogController.getAuditLogById
);

module.exports = router;