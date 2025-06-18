const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { protect, authorize } = require('../middlewares/auth');
const {
  createEmployeeValidator,
  updateEmployeeValidator
} = require('../validators/employeeValidator');

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
 *         - full_name
 *         - branch
 *         - role
 *         - contact_info
 *         - address
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the employee
 *           example: 507f1f77bcf86cd799439011
 *         employee_id:
 *           type: string
 *           description: Auto-generated employee ID
 *           example: EMP-202306-1234
 *         full_name:
 *           type: string
 *           description: Employee's full name
 *           example: John Doe
 *         branch:
 *           type: string
 *           description: ID of the branch where employee works
 *           example: 507f1f77bcf86cd799439012
 *         role:
 *           type: string
 *           description: ID of the employee's role
 *           example: 507f1f77bcf86cd799439013
 *         contact_info:
 *           type: object
 *           properties:
 *             phone:
 *               type: string
 *               description: Employee's phone number (10 digits starting with 6-9)
 *               example: "9876543210"
 *             email:
 *               type: string
 *               format: email
 *               description: Employee's email address
 *               example: john.doe@example.com
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *               example: 123 Main St
 *             city:
 *               type: string
 *               example: Mumbai
 *             state:
 *               type: string
 *               example: Maharashtra
 *             pincode:
 *               type: string
 *               example: "400001"
 *             country:
 *               type: string
 *               example: India
 *         joining_date:
 *           type: string
 *           format: date-time
 *           description: Date when employee joined
 *           example: "2023-06-15T00:00:00.000Z"
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED]
 *           default: ACTIVE
 *           description: Current employment status
 *         createdBy:
 *           type: string
 *           description: ID of user who created this record
 *         branchDetails:
 *           $ref: '#/components/schemas/Branch'
 *         roleDetails:
 *           $ref: '#/components/schemas/Role'
 *       example:
 *         id: 507f1f77bcf86cd799439011
 *         employee_id: EMP-202306-1234
 *         full_name: John Doe
 *         branch: 507f1f77bcf86cd799439012
 *         role: 507f1f77bcf86cd799439013
 *         contact_info:
 *           phone: "9876543210"
 *           email: john.doe@example.com
 *         address:
 *           street: 123 Main St
 *           city: Mumbai
 *           state: Maharashtra
 *           pincode: "400001"
 *           country: India
 *         joining_date: "2023-06-15T00:00:00.000Z"
 *         status: ACTIVE
 *         createdBy: 507f1f77bcf86cd799439014
 * 
 *     Branch:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 * 
 *     Role:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 * 
 *     EmployeeStatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED]
 *           example: ACTIVE
 */

/**
 * @swagger
 * /api/v1/employees:
 *   post:
 *     summary: Create a new employee (Admin/HR only)
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
 *             full_name: John Doe
 *             branch: 507f1f77bcf86cd799439012
 *             role: 507f1f77bcf86cd799439013
 *             contact_info:
 *               phone: "9876543210"
 *               email: john.doe@example.com
 *             address:
 *               street: 123 Main St
 *               city: Mumbai
 *               state: Maharashtra
 *               pincode: "400001"
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                       param:
 *                         type: string
 *                       location:
 *                         type: string
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User doesn't have permission (Admin/HR required)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  protect,
  authorize('SUPERADMIN','ADMIN', 'HR'),
  createEmployeeValidator,
  employeeController.createEmployee
);

/**
 * @swagger
 * /api/v1/employees:
 *   get:
 *     summary: Get all employees (paginated)
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *         example: 507f1f77bcf86cd799439012
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED]
 *         description: Filter by employee status
 *         example: ACTIVE
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
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Paginated list of employees
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
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       500:
 *         description: Internal server error
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
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Employee details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Employee not found
 *       500:
 *         description: Internal server error
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
 *     summary: Update employee details (Admin/HR only)
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
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Employee'
 *           example:
 *             full_name: John Doe Updated
 *             contact_info:
 *               phone: "9876543210"
 *               email: john.doe.updated@example.com
 *             address:
 *               street: 456 Updated St
 *               city: Mumbai
 *               state: Maharashtra
 *               pincode: "400002"
 *     responses:
 *       200:
 *         description: Employee updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User doesn't have permission (Admin/HR required)
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  protect,
  authorize('SUPERADMIN','ADMIN', 'HR'),
  updateEmployeeValidator,
  employeeController.updateEmployee
);

/**
 * @swagger
 * /api/v1/employees/{id}/status:
 *   patch:
 *     summary: Update employee status (Admin/HR only)
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID to update status
 *         example: 507f1f77bcf86cd799439011
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeStatusUpdate'
 *           example:
 *             status: ON_LEAVE
 *     responses:
 *       200:
 *         description: Employee status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User doesn't have permission (Admin/HR required)
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/:id/status',
  protect,
  authorize('SUPERADMIN','ADMIN', 'HR'),
  employeeController.updateEmployeeStatus
);


/**
 * @swagger
 * /api/v1/employees/{id}:
 *   delete:
 *     summary: Delete an employee (Admin only)
 *     description: Permanently deletes an employee record. This action is irreversible.
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
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User doesn't have permission (Admin required)
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Employee not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:id',
  protect,
  authorize('SUPERADMIN','ADMIN', 'HR'),
  employeeController.deleteEmployee
);
module.exports = router;