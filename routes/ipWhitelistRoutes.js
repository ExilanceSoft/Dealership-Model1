const express = require('express');
const router = express.Router();
const ipController = require('../controllers/ipWhitelistController');
const { protect, authorize } = require('../middlewares/auth');
const { logAction } = require('../middlewares/audit');

/**
 * @swagger
 * tags:
 *   name: IP Whitelist
 *   description: IP address management
 */

/**
 * @swagger
 * /api/v1/ip-whitelist:
 *   post:
 *     summary: Add IP to whitelist (Admin+)
 *     tags: [IP Whitelist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ip
 *             properties:
 *               ip:
 *                 type: string
 *                 example: "192.168.1.1"
 *               description:
 *                 type: string
 *                 example: "Head Office"
 *     responses:
 *       201:
 *         description: IP added
 */
router.post('/', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'), 
  logAction('CREATE', 'IP Whitelist'), 
  ipController.addIP
);

/**
 * @swagger
 * /api/v1/ip-whitelist:
 *   get:
 *     summary: Get all whitelisted IPs
 *     tags: [IP Whitelist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of IPs
 */
router.get('/', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'), 
  ipController.getIPs
);

/**
 * @swagger
 * /api/v1/ip-whitelist/{id}:
 *   delete:
 *     summary: Remove IP from whitelist (Admin+)
 *     tags: [IP Whitelist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IP removed
 */
router.delete('/:id', 
  protect, 
  authorize('SUPERADMIN', 'ADMIN','SALES_EXECUTIVE'), 
  logAction('DELETE', 'IP Whitelist'), 
  ipController.removeIP
);

module.exports = router;