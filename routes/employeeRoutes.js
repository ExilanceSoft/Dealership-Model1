const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { protect, authorize } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Employees
 *   description: Employee management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Employee:
 *       type: object
 *       required:
 *         - name
 *         - contact
 *         - email
 *         - branch
 *         - role
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           description: Employee's full name
 *           example: John Doe
 *         contact:
 *           type: string
 *           description: Employee's phone number (10 digits starting with 6-9)
 *           example: "9876543210"
 *         email:
 *           type: string
 *           format: email
 *           description: Employee's email address
 *           example: john.doe@example.com
 *         branch:
 *           type: string
 *           description: Branch ID reference
 *           example: 507f1f77bcf86cd799439012
 *         role:
 *           type: string
 *           description: Role ID reference
 *           example: 507f1f77bcf86cd799439013
 *         createdBy:
 *           type: string
 *           description: ID of user who created this record
 *           example: 507f1f77bcf86cd799439014
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *           example: "2023-06-15T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2023-06-15T00:00:00.000Z"
 *         branchDetails:
 *           $ref: '#/components/schemas/Branch'
 *         roleDetails:
 *           $ref: '#/components/schemas/Role'
 * 
 *     Branch:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: Mumbai Branch
 *         address:
 *           type: string
 *           example: 123 Main Street
 *         city:
 *           type: string
 *           example: Mumbai
 *         state:
 *           type: string
 *           example: Maharashtra
 * 
 *     Role:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: Sales Manager
 *         description:
 *           type: string
 *           example: Manages sales team
 * 
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Error message
 * 
 *     ValidationError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               msg:
 *                 type: string
 *                 example: Invalid email address
 *               param:
 *                 type: string
 *                 example: email
 *               location:
 *                 type: string
 *                 example: body
 * 
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 25
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
 *         totalPages:
 *           type: integer
 *           example: 3
 */

/**
 * @swagger
 * /api/v1/employees:
 *   post:
 *     summary: Create a new employee
 *     description: |
 *       Create a new employee record.
 *       - SuperAdmin can create for any branch
 *       - Admin/HR can only create for their own branch
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Employee'
 *           example:
 *             name: John Doe
 *             contact: "9876543210"
 *             email: john.doe@example.com
 *             branch: 507f1f77bcf86cd799439012
 *             role: 507f1f77bcf86cd799439013
 *     responses:
 *       201:
 *         description: Employee created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'HR', 'SALES_EXECUTIVE'),
  employeeController.createEmployee
);

/**
 * @swagger
 * /api/v1/employees:
 *   get:
 *     summary: Get list of employees
 *     description: |
 *       Get paginated list of employees.
 *       - SuperAdmin can view all branches
 *       - Others can only view their own branch employees
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter by branch ID (SuperAdmin only)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of employees
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
 *                     $ref: '#/components/schemas/Employee'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *             example:
 *               success: true
 *               data:
 *                 - id: 507f1f77bcf86cd799439011
 *                   name: John Doe
 *                   contact: "9876543210"
 *                   email: john.doe@example.com
 *                   branch: 507f1f77bcf86cd799439012
 *                   role: 507f1f77bcf86cd799439013
 *                   createdBy: 507f1f77bcf86cd799439014
 *                   branchDetails:
 *                     name: Mumbai Branch
 *                     address: "123 Main Street"
 *                     city: Mumbai
 *                     state: Maharashtra
 *                   roleDetails:
 *                     name: Sales Manager
 *                     description: Manages sales team
 *               pagination:
 *                 total: 1
 *                 page: 1
 *                 limit: 10
 *                 totalPages: 1
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  protect,
  employeeController.getEmployees
);

/**
 * @swagger
 * /api/v1/employees/{id}:
 *   get:
 *     summary: Get employee by ID
 *     description: |
 *       Get employee details by ID.
 *       - SuperAdmin can view any employee
 *       - Others can only view employees from their own branch
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Employee details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *             example:
 *               success: true
 *               data:
 *                 id: 507f1f77bcf86cd799439011
 *                 name: John Doe
 *                 contact: "9876543210"
 *                 email: john.doe@example.com
 *                 branch: 507f1f77bcf86cd799439012
 *                 role: 507f1f77bcf86cd799439013
 *                 createdBy: 507f1f77bcf86cd799439014
 *                 branchDetails:
 *                   name: Mumbai Branch
 *                   address: "123 Main Street"
 *                   city: Mumbai
 *                   state: Maharashtra
 *                 roleDetails:
 *                   name: Sales Manager
 *                   description: Manages sales team
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not authorized to view this employee)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Not authorized to access this employee
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Employee not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id',
  protect,
  employeeController.getEmployeeById
);

/**
 * @swagger
 * /api/v1/employees/{id}:
 *   put:
 *     summary: Update employee details
 *     description: |
 *       Update employee record.
 *       - SuperAdmin can update any employee
 *       - Admin/HR can only update employees from their own branch
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Employee'
 *           example:
 *             name: John Doe Updated
 *             contact: "9876543211"
 *             email: john.doe.updated@example.com
 *             role: 507f1f77bcf86cd799439014
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *             example:
 *               success: true
 *               data:
 *                 id: 507f1f77bcf86cd799439011
 *                 name: John Doe Updated
 *                 contact: "9876543211"
 *                 email: john.doe.updated@example.com
 *                 branch: 507f1f77bcf86cd799439012
 *                 role: 507f1f77bcf86cd799439014
 *                 createdBy: 507f1f77bcf86cd799439014
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not authorized to update this employee)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Not authorized to update this employee
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'HR','SALES_EXECUTIVE'),
  employeeController.updateEmployee
);

/**
 * @swagger
 * /api/v1/employees/{id}:
 *   delete:
 *     summary: Delete an employee
 *     description: |
 *       Delete an employee record.
 *       - SuperAdmin can delete any employee
 *       - Admin/HR can only delete employees from their own branch
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID to delete
 *     responses:
 *       200:
 *         description: Employee deleted successfully
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
 *                   example: Employee deleted successfully
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden (not authorized to delete this employee)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Not authorized to delete this employee
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/:id',
  protect,
  authorize('SUPERADMIN', 'ADMIN', 'HR','SALES_EXECUTIVE'),
  employeeController.deleteEmployee
);

module.exports = router;