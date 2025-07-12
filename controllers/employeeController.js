const Employee = require('../models/Employee');
const logger = require('../config/logger');
const { body, validationResult } = require('express-validator');

exports.createEmployee = [
  // Validation middleware
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('contact')
    .trim()
    .notEmpty().withMessage('Contact is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid mobile number'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  body('branch')
    .notEmpty().withMessage('Branch is required')
    .isMongoId().withMessage('Invalid branch ID'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isMongoId().withMessage('Invalid role ID'),

  // Controller logic
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { name, contact, email, branch, role } = req.body;
      
      // Check if employee with same email or contact already exists
      const existingEmployee = await Employee.findOne({
        $or: [{ email }, { contact }]
      });
      
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: 'Employee with this email or contact already exists'
        });
      }

      // Set branch based on user role
      const isSuperAdmin = await req.user.isSuperAdmin();
      const employeeBranch = isSuperAdmin ? branch : req.user.branch;

      // Create employee
      const employee = await Employee.create({
        name,
        contact,
        email,
        branch: employeeBranch,
        role,
        createdBy: req.user.id
      });

      // Populate references
      const populatedEmployee = await Employee.findById(employee._id)
        .populate('branchDetails')
        .populate('roleDetails');

      return res.status(201).json({
        success: true,
        data: populatedEmployee
      });

    } catch (err) {
      // Handle duplicate key errors specifically
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field} already exists`
        });
      }

      logger.error(`Failed to create employee: ${err.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to create employee'
      });
    }
  }
];

exports.getEmployees = async (req, res) => {
  try {
    const { branch, page = 1, limit = 10 } = req.query;
    const query = {};
    const isSuperAdmin = await req.user.isSuperAdmin();

    if (!isSuperAdmin) {
      query.branch = req.user.branch;
    } else if (branch) {
      query.branch = branch;
    }

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .populate('branchDetails')
        .populate('roleDetails')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Employee.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error(`Failed to fetch employees: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees'
    });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('branchDetails')
      .populate('roleDetails')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const isSuperAdmin = await req.user.isSuperAdmin();
    if (!isSuperAdmin && employee.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this employee'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (err) {
    logger.error(`Failed to fetch employee: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee'
    });
  }
};

exports.updateEmployee = [
  // Validation middleware
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('contact')
    .optional()
    .trim()
    .notEmpty().withMessage('Contact cannot be empty')
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid mobile number'),
  body('email')
    .optional()
    .trim()
    .notEmpty().withMessage('Email cannot be empty')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  body('branch')
    .optional()
    .isMongoId().withMessage('Invalid branch ID'),
  body('role')
    .optional()
    .isMongoId().withMessage('Invalid role ID'),

  // Controller logic
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const existingEmployee = await Employee.findById(req.params.id);
      if (!existingEmployee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const isSuperAdmin = await req.user.isSuperAdmin();
      if (!isSuperAdmin && existingEmployee.branch.toString() !== req.user.branch.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this employee'
        });
      }

      const { name, contact, email, role, branch } = req.body;
      const updateData = {
        name: name || existingEmployee.name,
        contact: contact || existingEmployee.contact,
        email: email || existingEmployee.email,
        role: role || existingEmployee.role,
        branch: isSuperAdmin ? (branch || existingEmployee.branch) : req.user.branch
      };

      const employee = await Employee.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('branchDetails').populate('roleDetails');

      res.status(200).json({
        success: true,
        data: employee
      });
    } catch (err) {
      logger.error(`Failed to update employee: ${err.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to update employee'
      });
    }
  }
];

exports.deleteEmployee = async (req, res) => {
  try {
    const existingEmployee = await Employee.findById(req.params.id);
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const isSuperAdmin = await req.user.isSuperAdmin();
    if (!isSuperAdmin && existingEmployee.branch.toString() !== req.user.branch.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this employee'
      });
    }

    await Employee.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (err) {
    logger.error(`Failed to delete employee: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to delete employee'
    });
  }
};