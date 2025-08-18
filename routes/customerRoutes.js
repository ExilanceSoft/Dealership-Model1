const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { protect, authorize } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       required:
 *         - name
 *         - address
 *         - mobile1
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the customer
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: Customer's full name
 *           example: John Doe
 *         address:
 *           type: string
 *           description: Customer's address
 *           example: 123 Main St, Mumbai
 *         taluka:
 *           type: string
 *           description: Taluka/Tehsil
 *           example: Andheri
 *         district:
 *           type: string
 *           description: District
 *           example: Mumbai Suburban
 *         mobile1:
 *           type: string
 *           description: Primary 10-digit mobile number
 *           example: "9876543210"
 *         mobile2:
 *           type: string
 *           description: Secondary 10-digit mobile number
 *           example: "9876543211"
 *         createdBy:
 *           type: string
 *           description: ID of user who created the customer
 *           example: 507f1f77bcf86cd799439012
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

/**
 * @swagger
 * /api/v1/customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Customer'
 *           example:
 *             name: "John Doe"
 *             address: "123 Main St, Mumbai"
 *             taluka: "Andheri"
 *             district: "Mumbai Suburban"
 *             mobile1: "9876543210"
 *             mobile2: "9876543211"
 *     responses:
 *       201:
 *         description: Customer created successfully
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
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Missing required fields or invalid data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', 
  protect,
  requirePermission('CUSTOMER.CREATE'),
  customerController.createCustomer
);

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     summary: Get all customers with filtering, sorting and pagination
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by customer name (partial match)
 *       - in: query
 *         name: mobile1
 *         schema:
 *           type: string
 *         description: Filter by primary mobile number
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
 *           default: 100
 *         description: Limit number of results
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *         description: Comma-separated fields to include/exclude
 *         example: name,mobile1
 *     responses:
 *       200:
 *         description: List of customers
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
 *                     customers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Customer'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', 
  protect,
  requirePermission('CUSTOMER.READ'),
  customerController.getAllCustomers
);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   get:
 *     summary: Get a single customer by ID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer details
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
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id', 
  protect, 
  requirePermission('CUSTOMER.READ'),
  customerController.getCustomer
);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   patch:
 *     summary: Update a customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Customer'
 *           example:
 *             name: "Updated Name"
 *             mobile1: "9876543212"
 *     responses:
 *       200:
 *         description: Customer updated successfully
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
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Invalid mobile number format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.patch('/:id', 
  protect,
  requirePermission('CUSTOMER.UPDATE'),
  customerController.updateCustomer
);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   delete:
 *     summary: Delete a customer (Admin only)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       204:
 *         description: Customer deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not Admin)
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', 
  protect, 
  requirePermission('CUSTOMER.DELETE'),
  customerController.deleteCustomer
);

module.exports = router;