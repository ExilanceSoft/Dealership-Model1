const Employee = require('../models/Employee');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

exports.createEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const employeeData = req.body;
    employeeData.createdBy = req.user.id;

    const employee = await Employee.create(employeeData);

    res.status(201).json({
      success: true,
      data: employee
    });
  } catch (err) {
    logger.error(`Failed to create employee: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create employee'
    });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const { branch, status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (branch) query.branch = branch;
    if (status) query.status = status;

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

exports.updateEmployee = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('branchDetails').populate('roleDetails');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

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
};

exports.updateEmployeeStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('branchDetails').populate('roleDetails');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (err) {
    logger.error(`Failed to update employee status: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee status'
    });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

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